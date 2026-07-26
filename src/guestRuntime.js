import { createActorNavigation, findGridPath } from "./gridPathfinder.js";

export const GUEST_STATES = Object.freeze({
  approachingSign: "approaching-sign",
  checkingSign: "checking-sign",
  entering: "entering",
  approachingService: "approaching-service",
  waitingForDish: "waiting-for-dish",
  carryingToSeat: "carrying-to-seat",
  eating: "eating",
  leaving: "leaving",
  finished: "finished",
});

export function createGuestRuntime({
  config,
  worldLayout,
  createGuest,
  removeGuest,
  getTavernOpen,
  getKitchenState,
  getServicePoint,
  getSeatPoint,
  onReservationChange = () => {},
  onDishConsumed = () => {},
  randomSource = Math.random,
  createFeedback = () => ({ set: () => {}, destroy: () => {} }),
}) {
  if (typeof getServicePoint !== "function" || typeof getSeatPoint !== "function") {
    throw new Error("Guest runtime requires live service and seat point resolvers");
  }
  let visit = null;
  let spawnRemainingMs = config.initialSpawnDelayMs;
  let destroyed = false;
  let reservation = false;

  function update(deltaMs) {
    if (destroyed) return;
    const delta = Math.max(0, Number(deltaMs) || 0);
    if (!visit) {
      spawnRemainingMs -= delta;
      if (spawnRemainingMs <= 0) spawn();
      return;
    }
    visit.feedback.update?.();
    visit.stateElapsedMs += delta;
    syncMovingFacilityTarget();
    if (visit.path) updateMovement(delta);
    else updateStationary();
  }

  function spawn() {
    if (visit || destroyed) return false;
    const controller = config.createController();
    const character = createGuest(controller);
    const feedback = createFeedback(character);
    visit = {
      character,
      controller,
      feedback,
      state: GUEST_STATES.approachingSign,
      stateElapsedMs: 0,
      path: null,
      waypointIndex: 0,
      blockedMs: 0,
      lastWaypointDistance: Number.POSITIVE_INFINITY,
      replans: 0,
      target: config.points.sign,
      signDecision: null,
      emptyTableReacting: false,
      mealCompleted: false,
    };
    feedback.set("arriving");
    return planTo(config.points.sign);
  }

  function updateMovement(deltaMs) {
    const waypoint = visit.path[visit.waypointIndex];
    const position = visit.character.motor.position;
    const dx = waypoint.x - position.x;
    const dy = waypoint.y - position.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= config.arrivalRadius) {
      visit.waypointIndex += 1;
      visit.blockedMs = 0;
      if (visit.waypointIndex >= visit.path.length) arrive();
      return;
    }
    visit.controller.setMovement({ x: dx, y: dy });
    const madeProgress = distance < visit.lastWaypointDistance - 0.05;
    const blockedAxes = visit.character.lastBlockedAxes ?? visit.character.motor.lastBlockedAxes ?? {};
    const pushingIntoCollision = (Math.abs(dx) > config.arrivalRadius && blockedAxes.x)
      || (Math.abs(dy) > config.arrivalRadius && blockedAxes.y);
    visit.blockedMs = pushingIntoCollision || !madeProgress ? visit.blockedMs + deltaMs : 0;
    if (madeProgress) visit.replans = 0;
    visit.lastWaypointDistance = distance;
    if (visit.blockedMs < config.blockedReplanMs) return;
    visit.blockedMs = 0;
    visit.replans += 1;
    if (visit.replans > config.maxReplans || !planTo(visit.target, { keepReplans: true })) cancelVisit();
  }

  function updateStationary() {
    if (visit.state === GUEST_STATES.checkingSign) {
      if (visit.signDecision === null && visit.stateElapsedMs >= config.signCheckMs) {
        visit.signDecision = getTavernOpen();
        visit.stateElapsedMs = 0;
        visit.feedback.set(visit.signDecision ? "open-reaction" : "closed-reaction");
        return;
      }
      if (visit.signDecision === null || visit.stateElapsedMs < (config.signReactionMs ?? 0)) return;
      if (visit.signDecision) transition(GUEST_STATES.entering, config.points.outsideDoor);
      else transition(GUEST_STATES.leaving, config.points.exit);
      return;
    }
    if (visit.state === GUEST_STATES.waitingForDish) {
      const servicePoint = getServicePoint();
      if (!isNearPoint(visit.character.motor.position, servicePoint, config.arrivalRadius)) {
        transition(GUEST_STATES.approachingService, servicePoint);
        return;
      }
      if (tryReserveDish()) transition(GUEST_STATES.carryingToSeat, getSeatPoint());
      else if (visit.emptyTableReacting) {
        if (visit.stateElapsedMs >= (config.emptyTableReactionMs ?? 0)) {
          visit.emptyTableReacting = false;
          visit.stateElapsedMs = 0;
          visit.feedback.set("waiting");
        }
      }
      else if (visit.stateElapsedMs >= config.dishWaitMs) transition(GUEST_STATES.leaving, config.points.exit);
      return;
    }
    if (visit.state === GUEST_STATES.eating) {
      const seatPoint = getSeatPoint();
      if (!visit.mealCompleted && !isNearPoint(visit.character.motor.position, seatPoint, config.arrivalRadius)) {
        transition(GUEST_STATES.carryingToSeat, seatPoint);
        return;
      }
      if (!visit.mealCompleted && visit.stateElapsedMs >= config.eatingMs) {
        consumeReservedDish();
        visit.mealCompleted = true;
        visit.stateElapsedMs = 0;
        visit.feedback.set("meal-complete");
      } else if (visit.mealCompleted && visit.stateElapsedMs >= (config.mealCompleteReactionMs ?? 0)) {
        transition(GUEST_STATES.leaving, config.points.exit);
      }
    }
  }

  function arrive() {
    visit.path = null;
    visit.controller.stop();
    visit.stateElapsedMs = 0;
    if (visit.state === GUEST_STATES.approachingSign) {
      visit.state = GUEST_STATES.checkingSign;
      visit.controller.face(config.signFacing ?? { x: 1, y: 0 });
      visit.feedback.set("checking");
    } else if (visit.state === GUEST_STATES.entering) {
      transition(GUEST_STATES.approachingService, config.points.insideDoor);
    } else if (visit.state === GUEST_STATES.approachingService && samePoint(visit.target, config.points.insideDoor)) {
      transition(GUEST_STATES.approachingService, getServicePoint());
    } else if (visit.state === GUEST_STATES.approachingService) {
      if (tryReserveDish()) transition(GUEST_STATES.carryingToSeat, getSeatPoint());
      else {
        visit.state = GUEST_STATES.waitingForDish;
        visit.emptyTableReacting = true;
        visit.feedback.set("empty-reaction");
      }
    } else if (visit.state === GUEST_STATES.carryingToSeat) {
      visit.state = GUEST_STATES.eating;
      visit.controller.face({ x: 1, y: 0 });
      visit.feedback.set("eating");
    } else if (visit.state === GUEST_STATES.leaving) finishVisit();
  }

  function transition(state, target) {
    visit.state = state;
    visit.stateElapsedMs = 0;
    visit.feedback.set(state === GUEST_STATES.leaving
      ? "leaving"
      : state === GUEST_STATES.carryingToSeat ? "carrying" : "moving");
    if (!planTo(target)) cancelVisit();
  }

  function planTo(target, { keepReplans = false } = {}) {
    if (!visit) return false;
    const character = visit.character;
    const navigation = createActorNavigation(worldLayout, {
      cellSize: 16,
      footWidth: character.footWidth,
      footDepth: character.footDepth,
    });
    const path = findGridPath({
      start: character.motor.position,
      goal: target,
      bounds: worldLayout.bounds,
      cellSize: 16,
      ...navigation,
    });
    if (!path) return false;
    visit.target = target;
    visit.path = path.length > 0 ? path : [{ ...target }];
    visit.waypointIndex = 0;
    visit.lastWaypointDistance = Number.POSITIVE_INFINITY;
    if (!keepReplans) visit.replans = 0;
    return true;
  }

  function syncMovingFacilityTarget() {
    if (!visit?.path) return;
    let facilityPoint = null;
    if (visit.state === GUEST_STATES.approachingService
      && !samePoint(visit.target, config.points.insideDoor)) facilityPoint = getServicePoint();
    else if (visit.state === GUEST_STATES.carryingToSeat) facilityPoint = getSeatPoint();
    if (facilityPoint && !samePoint(facilityPoint, visit.target)) planTo(facilityPoint);
  }

  function tryReserveDish() {
    if (reservation || !getKitchenState()?.servingTableHasDish) return false;
    reservation = true;
    onReservationChange(true);
    return true;
  }

  function consumeReservedDish() {
    if (!reservation) return false;
    const kitchen = getKitchenState();
    if (!kitchen?.servingTableHasDish) return releaseReservation();
    kitchen.servingTableHasDish = false;
    reservation = false;
    onReservationChange(false);
    onDishConsumed({ position: { ...visit.character.motor.position } });
    return true;
  }

  function releaseReservation() {
    if (!reservation) return false;
    reservation = false;
    onReservationChange(false);
    return true;
  }

  function cancelVisit() {
    releaseReservation();
    finishVisit();
  }

  function finishVisit() {
    if (!visit) return;
    visit.state = GUEST_STATES.finished;
    visit.feedback.destroy();
    removeGuest(visit.character.id);
    visit = null;
    spawnRemainingMs = nextSpawnDelay();
  }

  function nextSpawnDelay() {
    const fraction = Math.min(1, Math.max(0, Number(randomSource()) || 0));
    return config.subsequentSpawnDelayMinMs
      + fraction * (config.subsequentSpawnDelayMaxMs - config.subsequentSpawnDelayMinMs);
  }

  return {
    update,
    forceSpawn: spawn,
    isDishReserved: () => reservation,
    getState: () => visit ? {
      active: true,
      id: visit.character.id,
      state: visit.state,
      reservedDish: reservation,
      position: { ...visit.character.motor.position },
      replans: visit.replans,
    } : { active: false, state: null, reservedDish: false, spawnRemainingMs },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      releaseReservation();
      if (visit) {
        visit.feedback.destroy();
        removeGuest(visit.character.id);
        visit = null;
      }
    },
  };
}

function samePoint(a, b) {
  return a.x === b.x && a.y === b.y;
}

function isNearPoint(a, b, radius) {
  return Math.hypot(a.x - b.x, a.y - b.y) <= radius;
}
