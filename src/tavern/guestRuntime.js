import { createActorNavigation, findGridPath } from "./gridPathfinder.js";
import { GUEST_ACTIVE_CAP } from "./tavernServiceDomain.js";

const NAVIGATION_CELL_SIZE = 16;
const TARGET_SEARCH_RADIUS_CELLS = 2;

export const GUEST_STATES = Object.freeze({
  approachingSign: "approaching-sign",
  checkingSign: "checking-sign",
  entering: "entering",
  approachingService: "approaching-service",
  carryingToSeat: "carrying-to-seat",
  eating: "eating",
  leaving: "leaving",
  finished: "finished",
});

export function createGuestRuntime({
  config,
  serviceState,
  worldLayout,
  createGuest,
  removeGuest,
  getTavernOpen,
  getSignPoint = () => config.points.sign,
  getServicePoint,
  getSeatPoint,
  reserveSeat = () => null,
  releaseSeat = () => false,
  reserveItem = () => null,
  releaseReservation = () => false,
  consumeReservation = () => null,
  onReservationChange = () => {},
  onPurchaseComplete = () => {},
  getSalePrice = () => 0,
  createFeedback = () => ({ set: () => {}, update: () => {}, destroy: () => {} }),
}) {
  if (typeof getSignPoint !== "function" || typeof getServicePoint !== "function" || typeof getSeatPoint !== "function") {
    throw new Error("Guest runtime requires live sign, service and seat point resolvers");
  }
  const visits = new Map();
  let destroyed = false;

  for (const snapshot of serviceState.guests) restoreVisit(snapshot);
  syncPersistedState();

  function update(deltaMs) {
    if (destroyed) return;
    const delta = Math.max(0, Number(deltaMs) || 0);
    for (const visit of [...visits.values()]) {
      visit.feedback.update?.();
      visit.stateElapsedMs += delta;
      syncMovingFacilityTarget(visit);
      if (visit.path) updateMovement(visit, delta);
      else updateStationary(visit);
    }
    syncPersistedState();
  }

  function spawnVisit(personId, acceptableItemIds = []) {
    if (destroyed || visits.size >= GUEST_ACTIVE_CAP || !personId) return false;
    if ([...visits.values()].some((visit) => visit.personId === personId)) return false;
    const id = `tavern-guest-${++serviceState.nextGuestId}`;
    const controller = config.createController();
    const character = createGuest(controller, id, config.points.spawn);
    const feedback = createFeedback(character);
    const visit = {
      id,
      personId,
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
      target: getSignPoint(),
      signDecision: null,
      itemId: null,
      acceptableItemIds: [...acceptableItemIds],
      servingTableId: null,
      diningTableId: null,
      reservationActive: false,
      mealCompleted: false,
      paid: false,
    };
    visits.set(id, visit);
    feedback.set("arriving");
    if (!planTo(visit, getSignPoint())) {
      cancelVisit(visit);
      return false;
    }
    syncPersistedState();
    return id;
  }

  function restoreVisit(snapshot) {
    const controller = config.createController();
    const character = createGuest(controller, snapshot.id, snapshot.position);
    const visit = {
      id: snapshot.id,
      personId: snapshot.personId,
      character,
      controller,
      feedback: createFeedback(character),
      state: snapshot.state,
      stateElapsedMs: snapshot.stateElapsedMs,
      path: null,
      waypointIndex: 0,
      blockedMs: 0,
      lastWaypointDistance: Number.POSITIVE_INFINITY,
      replans: 0,
      target: null,
      signDecision: snapshot.state === GUEST_STATES.checkingSign ? null : true,
      itemId: snapshot.itemId,
      acceptableItemIds: [...snapshot.acceptableItemIds],
      servingTableId: snapshot.servingTableId,
      diningTableId: snapshot.diningTableId,
      reservationActive: snapshot.reservationActive,
      mealCompleted: snapshot.mealCompleted,
      paid: snapshot.paid,
    };
    if (visit.itemId === "fried-potato-dish" && visit.state !== GUEST_STATES.leaving) {
      visit.diningTableId = reserveSeat(visit.id, visit.diningTableId)?.diningTableId ?? null;
    }
    visits.set(visit.id, visit);
    visit.feedback.set(feedbackForState(visit));
    const target = targetForState(visit);
    if (target) planTo(visit, target);
  }

  function updateMovement(visit, deltaMs) {
    const waypoint = visit.path[visit.waypointIndex];
    const position = visit.character.motor.position;
    const dx = waypoint.x - position.x;
    const dy = waypoint.y - position.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= config.arrivalRadius) {
      visit.waypointIndex += 1;
      visit.blockedMs = 0;
      if (visit.waypointIndex >= visit.path.length) arrive(visit);
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
    if (visit.replans > config.maxReplans || !planTo(visit, visit.target, { keepReplans: true })) cancelVisit(visit);
  }

  function updateStationary(visit) {
    if (visit.state === GUEST_STATES.approachingService
      && visit.itemId === "fried-potato-dish"
      && visit.reservationActive
      && !visit.diningTableId) {
      visit.diningTableId = reserveSeat(visit.id)?.diningTableId ?? null;
      if (visit.diningTableId) arrive(visit);
      return;
    }
    if (visit.state === GUEST_STATES.checkingSign) {
      if (visit.signDecision === null && visit.stateElapsedMs >= config.signCheckMs) {
        visit.signDecision = getTavernOpen();
        visit.stateElapsedMs = 0;
        visit.feedback.set(visit.signDecision ? "open-reaction" : "closed-reaction");
        return;
      }
      if (visit.signDecision === null || visit.stateElapsedMs < (config.signReactionMs ?? 0)) return;
      if (!visit.signDecision) {
        releaseVisitReservation(visit);
        transition(visit, GUEST_STATES.leaving, config.points.exit);
        return;
      }
      if (!visit.reservationActive) {
        const claims = reserveServiceClaims(visit.id, visit.acceptableItemIds);
        const reservation = claims?.reservation ?? null;
        if (!reservation) {
          transition(visit, GUEST_STATES.leaving, config.points.exit);
          return;
        }
        visit.reservationActive = true;
        visit.itemId = reservation.itemId;
        visit.servingTableId = reservation.servingTableId;
        visit.diningTableId = claims.diningTableId;
        onReservationChange({
          guestId: visit.id,
          active: true,
          itemId: reservation.itemId,
          servingTableId: reservation.servingTableId,
          diningTableId: visit.diningTableId,
        });
      }
      transition(visit, GUEST_STATES.approachingService, getServicePoint(visit.servingTableId));
      return;
    }
    if (visit.state === GUEST_STATES.eating) {
      const seatPoint = getSeatPoint(visit.diningTableId);
      if (!seatPoint) {
        cancelVisit(visit);
        return;
      }
      if (!visit.mealCompleted && !isNearPoint(visit.character.motor.position, seatPoint, config.arrivalRadius)) {
        transition(visit, GUEST_STATES.carryingToSeat, seatPoint);
        return;
      }
      if (!visit.mealCompleted && visit.stateElapsedMs >= config.eatingMs) {
        visit.mealCompleted = true;
        visit.stateElapsedMs = 0;
        visit.feedback.set("meal-complete");
        completePurchase(visit);
      } else if (visit.mealCompleted && visit.stateElapsedMs >= (config.mealCompleteReactionMs ?? 0)) {
        transition(visit, GUEST_STATES.leaving, config.points.exit);
      }
    }
  }

  function reserveServiceClaims(guestId, acceptableItemIds) {
    const excludedServingTableIds = [];
    while (true) {
      const reservation = reserveItem(guestId, { excludedServingTableIds, acceptableItemIds });
      if (!reservation) return null;
      if (reservation.itemId !== "fried-potato-dish") return { reservation, diningTableId: null };
      const diningTableId = reserveSeat(guestId)?.diningTableId ?? null;
      if (diningTableId) return { reservation, diningTableId };
      releaseReservation(guestId, reservation.servingTableId);
      if (excludedServingTableIds.includes(reservation.servingTableId)) return null;
      excludedServingTableIds.push(reservation.servingTableId);
    }
  }

  function arrive(visit) {
    visit.path = null;
    visit.controller.stop();
    visit.stateElapsedMs = 0;
    if (visit.state === GUEST_STATES.approachingSign) {
      visit.state = GUEST_STATES.checkingSign;
      visit.controller.face(config.signFacing ?? { x: 1, y: 0 });
      visit.feedback.set("checking");
    } else if (visit.state === GUEST_STATES.entering) {
      transition(visit, GUEST_STATES.approachingService, config.points.insideDoor);
    } else if (visit.state === GUEST_STATES.approachingService && samePoint(visit.target, config.points.insideDoor)) {
      transition(visit, GUEST_STATES.approachingService, getServicePoint(visit.servingTableId));
    } else if (visit.state === GUEST_STATES.approachingService) {
      if (visit.itemId === "fried-potato-dish" && !visit.diningTableId) {
        visit.diningTableId = reserveSeat(visit.id)?.diningTableId ?? null;
        if (!visit.diningTableId) return;
      }
      const consumed = visit.reservationActive ? consumeReservation(visit.id, visit.servingTableId) : null;
      if (!consumed) {
        releaseVisitReservation(visit);
        transition(visit, GUEST_STATES.leaving, config.points.exit);
        return;
      }
      visit.reservationActive = false;
      visit.itemId = consumed.itemId;
      onReservationChange({
        guestId: visit.id,
        active: false,
        itemId: consumed.itemId,
        servingTableId: consumed.servingTableId,
        diningTableId: visit.diningTableId,
        consumed: true,
      });
      if (visit.itemId === "lemonade") {
        visit.feedback.set("carrying-lemonade");
        completePurchase(visit);
        transition(visit, GUEST_STATES.leaving, config.points.exit, { preserveFeedback: true });
      } else {
        const seatPoint = getSeatPoint(visit.diningTableId);
        if (!seatPoint) {
          cancelVisit(visit);
          return;
        }
        transition(visit, GUEST_STATES.carryingToSeat, seatPoint);
      }
    } else if (visit.state === GUEST_STATES.carryingToSeat) {
      visit.state = GUEST_STATES.eating;
      visit.controller.face({ x: 1, y: 0 });
      visit.feedback.set("eating");
    } else if (visit.state === GUEST_STATES.leaving) {
      finishVisit(visit);
    }
  }

  function completePurchase(visit) {
    if (visit.paid) return;
    visit.paid = true;
    onPurchaseComplete({
      guestId: visit.id,
      personId: visit.personId,
      itemId: visit.itemId,
      value: getSalePrice(visit.itemId),
      position: { ...visit.character.motor.position },
    });
  }

  function transition(visit, state, target, { preserveFeedback = false } = {}) {
    visit.state = state;
    visit.stateElapsedMs = 0;
    if (!preserveFeedback) visit.feedback.set(state === GUEST_STATES.leaving
      ? "leaving"
      : state === GUEST_STATES.carryingToSeat ? "carrying-dish" : "moving");
    if (!planTo(visit, target)) cancelVisit(visit);
  }

  function planTo(visit, target, { keepReplans = false } = {}) {
    if (!visits.has(visit.id)) return false;
    const character = visit.character;
    const navigation = createActorNavigation(worldLayout, {
      cellSize: NAVIGATION_CELL_SIZE,
      footWidth: character.footWidth,
      footDepth: character.footDepth,
    });
    const path = candidateTargetsAround(target).reduce((match, goal) => match ?? findGridPath({
      start: character.motor.position,
      goal,
      bounds: worldLayout.bounds,
      cellSize: NAVIGATION_CELL_SIZE,
      ...navigation,
    }), null);
    if (!path) return false;
    visit.target = { ...target };
    visit.path = path.length > 0 ? path : [{ ...target }];
    visit.waypointIndex = 0;
    visit.lastWaypointDistance = Number.POSITIVE_INFINITY;
    if (!keepReplans) visit.replans = 0;
    return true;
  }

  function syncMovingFacilityTarget(visit) {
    if (!visit.path) return;
    let facilityPoint = null;
    if (visit.state === GUEST_STATES.approachingSign) facilityPoint = getSignPoint();
    else if (visit.state === GUEST_STATES.approachingService
      && !samePoint(visit.target, config.points.insideDoor)) facilityPoint = getServicePoint(visit.servingTableId);
    else if (visit.state === GUEST_STATES.carryingToSeat) facilityPoint = getSeatPoint(visit.diningTableId);
    if (facilityPoint && !samePoint(facilityPoint, visit.target)) planTo(visit, facilityPoint);
  }

  function releaseVisitReservation(visit) {
    if (!visit.reservationActive) return false;
    const released = releaseReservation(visit.id, visit.servingTableId);
    visit.reservationActive = false;
    if (released) onReservationChange({
      guestId: visit.id,
      active: false,
      itemId: visit.itemId,
      servingTableId: visit.servingTableId,
      diningTableId: visit.diningTableId,
    });
    return released;
  }

  function cancelVisit(visit) {
    releaseVisitReservation(visit);
    finishVisit(visit);
  }

  function finishVisit(visit) {
    if (!visits.has(visit.id)) return;
    visit.state = GUEST_STATES.finished;
    visit.feedback.destroy();
    releaseSeat(visit.id, visit.diningTableId);
    removeGuest(visit.character.id);
    visits.delete(visit.id);
    syncPersistedState();
  }

  function targetForState(visit) {
    if (visit.state === GUEST_STATES.approachingSign) return getSignPoint();
    if (visit.state === GUEST_STATES.entering) return config.points.outsideDoor;
    if (visit.state === GUEST_STATES.approachingService) return getServicePoint(visit.servingTableId);
    if (visit.state === GUEST_STATES.carryingToSeat) return getSeatPoint(visit.diningTableId);
    if (visit.state === GUEST_STATES.leaving) return config.points.exit;
    return null;
  }

  function feedbackForState(visit) {
    if (visit.state === GUEST_STATES.checkingSign) return "checking";
    if (visit.state === GUEST_STATES.carryingToSeat) return "carrying-dish";
    if (visit.state === GUEST_STATES.eating) return visit.mealCompleted ? "meal-complete" : "eating";
    if (visit.state === GUEST_STATES.leaving && visit.itemId === "lemonade") return "carrying-lemonade";
    return "moving";
  }

  function syncPersistedState() {
    serviceState.guests = [...visits.values()].map((visit) => ({
      id: visit.id,
      personId: visit.personId,
      state: visit.state,
      stateElapsedMs: visit.stateElapsedMs,
      position: { ...visit.character.motor.position },
      itemId: visit.itemId,
      acceptableItemIds: [...visit.acceptableItemIds],
      servingTableId: visit.servingTableId,
      diningTableId: visit.diningTableId,
      reservationActive: visit.reservationActive,
      mealCompleted: visit.mealCompleted,
      paid: visit.paid,
    }));
  }

  return {
    update,
    spawnVisit,
    getActivePersonIds: () => [...visits.values()].map((visit) => visit.personId),
    isDishReserved: () => [...visits.values()].some((visit) => visit.reservationActive),
    isDiningTableReserved: (tableId) => [...visits.values()].some((visit) => visit.diningTableId === tableId),
    getState: () => {
      const guests = [...visits.values()].map((visit) => ({
        id: visit.id,
        personId: visit.personId,
        state: visit.state,
        reservedDish: visit.reservationActive,
        itemId: visit.itemId,
        acceptableItemIds: [...visit.acceptableItemIds],
        servingTableId: visit.servingTableId,
        diningTableId: visit.diningTableId,
        position: { ...visit.character.motor.position },
        replans: visit.replans,
        paid: visit.paid,
      }));
      return {
        active: guests.length > 0,
        activeCount: guests.length,
        guests,
        state: guests[0]?.state ?? null,
        id: guests[0]?.id ?? null,
        reservedDish: guests[0]?.reservedDish ?? false,
      };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      syncPersistedState();
      for (const visit of visits.values()) {
        visit.feedback.destroy();
        removeGuest(visit.character.id);
      }
      visits.clear();
    },
  };
}

function samePoint(a, b) {
  return a?.x === b?.x && a?.y === b?.y;
}

function isNearPoint(a, b, radius) {
  return Math.hypot(a.x - b.x, a.y - b.y) <= radius;
}

function candidateTargetsAround(target) {
  const candidates = [{ ...target }];
  for (let radius = 1; radius <= TARGET_SEARCH_RADIUS_CELLS; radius += 1) {
    for (let y = -radius; y <= radius; y += 1) {
      for (let x = -radius; x <= radius; x += 1) {
        if (Math.max(Math.abs(x), Math.abs(y)) !== radius) continue;
        candidates.push({
          x: target.x + x * NAVIGATION_CELL_SIZE,
          y: target.y + y * NAVIGATION_CELL_SIZE,
        });
      }
    }
  }
  return candidates;
}
