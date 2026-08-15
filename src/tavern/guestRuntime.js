import { createActorNavigation, findGridPath } from "./gridPathfinder.js";
import { GUEST_ACTIVE_CAP } from "./tavernServiceDomain.js";
import {
  advanceOrderTimer,
  createPlannedOrder,
  ORDER_STATUS,
  transitionOrder,
} from "./orderDomain.js";

const NAVIGATION_CELL_SIZE = 16;
const TARGET_SEARCH_RADIUS_CELLS = 2;
export const GUEST_ORDER_INTERACTION_KIND = "accept-tavern-order";

export const GUEST_STATES = Object.freeze({
  approachingSign: "approaching-sign",
  checkingSign: "checking-sign",
  approachingOrder: "approaching-order",
  offered: "offered-order",
  accepted: "accepted-order",
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
  isOrderItemActive = () => true,
  getSignPoint = () => config.points.sign,
  getServicePoint,
  getSeatPoint,
  claimOrderStation = () => null,
  releaseOrderStation = () => false,
  reserveSeat = () => null,
  releaseSeat = () => false,
  reserveExactItem = () => null,
  releaseReservation = () => false,
  consumeReservation = () => null,
  onReservationChange = () => {},
  onOrderChange = () => {},
  onOrderFailure = () => {},
  onVisitFinished = () => {},
  onPurchaseComplete = () => {},
  getSalePrice = () => 0,
  getPersonDisplayName = (personId) => personId,
  getItemLabel = (itemId) => itemId,
  getOrderPrompt = (itemId) => itemId === "lemonade"
    ? "hud:interaction.acceptOrderLemonade"
    : "hud:interaction.acceptOrderFriedPotato",
  createFeedback = () => ({ set: () => {}, setOrder: () => {}, update: () => {}, destroy: () => {} }),
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
      const timer = advanceOrderTimer(visit.order, delta);
      visit.orderTimedOut = timer.timedOut;
      syncMovingFacilityTarget(visit);
      if (visit.path) updateMovement(visit, delta);
      else updateStationary(visit);
    }
    syncPersistedState();
  }

  function spawnVisit(personId, orderItemId, acceptableItemIds = []) {
    if (destroyed || visits.size >= GUEST_ACTIVE_CAP || !personId) return false;
    if ([...visits.values()].some((visit) => visit.personId === personId)) return false;
    if (Array.isArray(orderItemId)) {
      acceptableItemIds = orderItemId;
      [orderItemId] = acceptableItemIds;
    }
    let order;
    try {
      order = createPlannedOrder(orderItemId);
    } catch {
      return false;
    }
    const id = `tavern-guest-${++serviceState.nextGuestId}`;
    const controller = config.createController();
    const character = createGuest(controller, id, config.points.spawn);
    const feedback = createFeedback(character);
    const visit = baseVisit({
      id,
      personId,
      character,
      controller,
      feedback,
      order,
      acceptableItemIds,
      position: config.points.spawn,
    });
    visits.set(id, visit);
    feedback.set("arriving");
    if (!planTo(visit, getSignPoint())) {
      cancelVisit(visit);
      return false;
    }
    syncPersistedState();
    return id;
  }

  function baseVisit({ id, personId, character, controller, feedback, order, acceptableItemIds }) {
    return {
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
      order,
      orderTimedOut: false,
      itemId: order.itemId,
      acceptableItemIds: [...acceptableItemIds],
      servingTableId: null,
      diningTableId: null,
      reservationActive: false,
      mealCompleted: false,
      paid: false,
      failureRecorded: false,
    };
  }

  function restoreVisit(snapshot) {
    const controller = config.createController();
    const character = createGuest(controller, snapshot.id, snapshot.position);
    const visit = baseVisit({
      id: snapshot.id,
      personId: snapshot.personId,
      character,
      controller,
      feedback: createFeedback(character),
      order: { ...snapshot.order },
      acceptableItemIds: snapshot.acceptableItemIds,
    });
    Object.assign(visit, {
      state: restoreState(snapshot),
      stateElapsedMs: snapshot.stateElapsedMs,
      target: null,
      signDecision: snapshot.state === GUEST_STATES.checkingSign ? null : true,
      itemId: snapshot.itemId ?? snapshot.order.itemId,
      servingTableId: snapshot.servingTableId,
      diningTableId: snapshot.diningTableId,
      reservationActive: snapshot.reservationActive,
      mealCompleted: snapshot.mealCompleted,
      paid: snapshot.paid,
      failureRecorded: snapshot.order.status === ORDER_STATUS.failed,
    });
    if (visit.servingTableId) claimOrderStation(visit.id, visit.order.itemId, visit.servingTableId);
    if (visit.order.itemId === "fried-potato-dish" && visit.diningTableId) {
      visit.diningTableId = reserveSeat(visit.id, visit.diningTableId)?.diningTableId ?? null;
    }
    visits.set(visit.id, visit);
    setFeedbackForVisit(visit);
    const target = targetForState(visit);
    if (target && !planTo(visit, target)) cancelVisit(visit);
  }

  function restoreState(snapshot) {
    const status = snapshot.order.status;
    if (status === ORDER_STATUS.offered) return GUEST_STATES.offered;
    if (status === ORDER_STATUS.accepted) return GUEST_STATES.accepted;
    if (status === ORDER_STATUS.reserved) return GUEST_STATES.approachingService;
    if (status === ORDER_STATUS.failed) return GUEST_STATES.leaving;
    if (status === ORDER_STATUS.completed) return GUEST_STATES.leaving;
    if (status === ORDER_STATUS.served) {
      return snapshot.order.itemId === "fried-potato-dish"
        ? (snapshot.state === GUEST_STATES.eating ? GUEST_STATES.eating : GUEST_STATES.carryingToSeat)
        : GUEST_STATES.leaving;
    }
    return Object.values(GUEST_STATES).includes(snapshot.state) ? snapshot.state : GUEST_STATES.approachingSign;
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
    if (visit.state === GUEST_STATES.checkingSign) updateSignCheck(visit);
    else if (visit.state === GUEST_STATES.offered) updateOfferedOrder(visit);
    else if (visit.state === GUEST_STATES.accepted) updateAcceptedOrder(visit);
    else if (visit.order.status === ORDER_STATUS.failed) updateFailedOrder(visit);
    else if (visit.state === GUEST_STATES.eating) updateEating(visit);
  }

  function updateSignCheck(visit) {
    if (visit.signDecision === null && visit.stateElapsedMs >= config.signCheckMs) {
      visit.signDecision = getTavernOpen() && isOrderItemActive(visit.order.itemId);
      visit.stateElapsedMs = 0;
      visit.feedback.set(visit.signDecision ? "open-reaction" : "closed-reaction");
      return;
    }
    if (visit.signDecision === null || visit.stateElapsedMs < (config.signReactionMs ?? 0)) return;
    if (!visit.signDecision || !getTavernOpen() || !isOrderItemActive(visit.order.itemId)) {
      leaveWithoutFailure(visit);
      return;
    }
    const station = claimOrderStation(visit.id, visit.order.itemId, visit.servingTableId);
    if (!station) {
      if (visit.stateElapsedMs >= (config.signReactionMs ?? 0) + (config.orderStationWaitMs ?? 10_000)) {
        leaveWithoutFailure(visit);
      }
      return;
    }
    visit.servingTableId = station.servingTableId;
    transition(visit, GUEST_STATES.approachingOrder, getServicePoint(visit.servingTableId));
  }

  function updateOfferedOrder(visit) {
    if (!getTavernOpen() || !isOrderItemActive(visit.order.itemId) || visit.orderTimedOut) {
      leaveWithoutFailure(visit);
    }
  }

  function updateAcceptedOrder(visit) {
    if (visit.orderTimedOut) {
      transitionOrder(visit.order, ORDER_STATUS.failed);
      visit.failureRecorded = true;
      releaseOrderStation(visit.id, visit.servingTableId);
      onOrderFailure(orderSnapshot(visit));
      onOrderChange(orderSnapshot(visit));
      visit.stateElapsedMs = 0;
      visit.feedback.set("order-failed");
      return;
    }
    reserveAcceptedOrder(visit);
  }

  function reserveAcceptedOrder(visit) {
    if (visit.order.itemId === "fried-potato-dish" && !visit.diningTableId) {
      visit.diningTableId = reserveSeat(visit.id)?.diningTableId ?? null;
      if (!visit.diningTableId) return false;
    }
    const reservation = reserveExactItem(
      visit.id,
      visit.servingTableId,
      visit.order.itemId,
    );
    if (!reservation) return false;
    visit.reservationActive = true;
    transitionOrder(visit.order, ORDER_STATUS.reserved);
    onReservationChange({
      guestId: visit.id,
      active: true,
      itemId: reservation.itemId,
      servingTableId: reservation.servingTableId,
      diningTableId: visit.diningTableId,
    });
    onOrderChange(orderSnapshot(visit));
    transition(visit, GUEST_STATES.approachingService, getServicePoint(visit.servingTableId), { preserveFeedback: true });
    return true;
  }

  function updateFailedOrder(visit) {
    if (visit.stateElapsedMs >= (config.signReactionMs ?? 900)) {
      transition(visit, GUEST_STATES.leaving, config.points.exit, { preserveFeedback: true });
    }
  }

  function updateEating(visit) {
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

  function arrive(visit) {
    visit.path = null;
    visit.controller.stop();
    visit.stateElapsedMs = 0;
    if (visit.state === GUEST_STATES.approachingSign) {
      visit.state = GUEST_STATES.checkingSign;
      visit.controller.face(config.signFacing ?? { x: 1, y: 0 });
      visit.feedback.set("checking");
    } else if (visit.state === GUEST_STATES.approachingOrder) {
      visit.state = GUEST_STATES.offered;
      transitionOrder(visit.order, ORDER_STATUS.offered);
      setOrderFeedback(visit);
      onOrderChange(orderSnapshot(visit));
    } else if (visit.state === GUEST_STATES.approachingService) {
      serveReservedOrder(visit);
    } else if (visit.state === GUEST_STATES.carryingToSeat) {
      visit.state = GUEST_STATES.eating;
      visit.controller.face({ x: 1, y: 0 });
      visit.feedback.set("eating");
    } else if (visit.state === GUEST_STATES.leaving) {
      finishVisit(visit);
    }
  }

  function serveReservedOrder(visit) {
    const consumed = visit.reservationActive ? consumeReservation(visit.id, visit.servingTableId) : null;
    if (!consumed || consumed.itemId !== visit.order.itemId) {
      cancelVisit(visit);
      return;
    }
    visit.reservationActive = false;
    visit.itemId = consumed.itemId;
    transitionOrder(visit.order, ORDER_STATUS.served);
    releaseOrderStation(visit.id, visit.servingTableId);
    onReservationChange({
      guestId: visit.id,
      active: false,
      itemId: consumed.itemId,
      servingTableId: consumed.servingTableId,
      diningTableId: visit.diningTableId,
      consumed: true,
    });
    onOrderChange(orderSnapshot(visit));
    if (visit.itemId === "lemonade") {
      visit.feedback.set("carrying-lemonade");
      visit.state = GUEST_STATES.leaving;
      completePurchase(visit);
      transition(visit, GUEST_STATES.leaving, config.points.exit, { preserveFeedback: true });
      return;
    }
    const seatPoint = getSeatPoint(visit.diningTableId);
    if (!seatPoint) {
      cancelVisit(visit);
      return;
    }
    transition(visit, GUEST_STATES.carryingToSeat, seatPoint);
  }

  function acceptGuestOrder(guestId) {
    const visit = visits.get(guestId);
    if (!visit || visit.order.status !== ORDER_STATUS.offered) {
      return { status: "order-not-offered", mutated: false };
    }
    transitionOrder(visit.order, ORDER_STATUS.accepted);
    visit.state = GUEST_STATES.accepted;
    visit.stateElapsedMs = 0;
    setOrderFeedback(visit);
    onOrderChange(orderSnapshot(visit));
    return { status: "order-accepted", mutated: true, order: { ...visit.order }, guestId: visit.id };
  }

  function completePurchase(visit) {
    if (visit.paid) return;
    visit.paid = true;
    if (visit.order.status === ORDER_STATUS.served) transitionOrder(visit.order, ORDER_STATUS.completed);
    onOrderChange(orderSnapshot(visit));
    onPurchaseComplete({
      guestId: visit.id,
      personId: visit.personId,
      itemId: visit.order.itemId,
      value: getSalePrice(visit.order.itemId),
      position: { ...visit.character.motor.position },
      order: { ...visit.order },
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

  function leaveWithoutFailure(visit) {
    releaseVisitReservation(visit);
    releaseOrderStation(visit.id, visit.servingTableId);
    releaseSeat(visit.id, visit.diningTableId);
    visit.diningTableId = null;
    transition(visit, GUEST_STATES.leaving, config.points.exit);
  }

  function planTo(visit, target, { keepReplans = false } = {}) {
    if (!visits.has(visit.id) || !target) return false;
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
    else if ([GUEST_STATES.approachingOrder, GUEST_STATES.approachingService].includes(visit.state)) {
      facilityPoint = getServicePoint(visit.servingTableId);
    } else if (visit.state === GUEST_STATES.carryingToSeat) facilityPoint = getSeatPoint(visit.diningTableId);
    if (facilityPoint && !samePoint(facilityPoint, visit.target)) planTo(visit, facilityPoint);
  }

  function releaseVisitReservation(visit) {
    if (!visit.reservationActive) return false;
    const released = releaseReservation(visit.id, visit.servingTableId);
    visit.reservationActive = false;
    if (released) onReservationChange({
      guestId: visit.id,
      active: false,
      itemId: visit.order.itemId,
      servingTableId: visit.servingTableId,
      diningTableId: visit.diningTableId,
    });
    return released;
  }

  function cancelVisit(visit) {
    releaseVisitReservation(visit);
    releaseOrderStation(visit.id, visit.servingTableId);
    finishVisit(visit);
  }

  function finishVisit(visit) {
    if (!visits.has(visit.id)) return;
    visit.state = GUEST_STATES.finished;
    visit.feedback.destroy();
    releaseSeat(visit.id, visit.diningTableId);
    releaseOrderStation(visit.id, visit.servingTableId);
    removeGuest(visit.character.id);
    visits.delete(visit.id);
    onVisitFinished(orderSnapshot(visit));
    syncPersistedState();
  }

  function targetForState(visit) {
    if (visit.state === GUEST_STATES.approachingSign) return getSignPoint();
    if ([GUEST_STATES.approachingOrder, GUEST_STATES.approachingService].includes(visit.state)) {
      return getServicePoint(visit.servingTableId);
    }
    if (visit.state === GUEST_STATES.carryingToSeat) return getSeatPoint(visit.diningTableId);
    if (visit.state === GUEST_STATES.leaving) return config.points.exit;
    return null;
  }

  function setFeedbackForVisit(visit) {
    if ([ORDER_STATUS.offered, ORDER_STATUS.accepted, ORDER_STATUS.reserved].includes(visit.order.status)) {
      setOrderFeedback(visit);
    } else if (visit.order.status === ORDER_STATUS.failed) visit.feedback.set("order-failed");
    else if (visit.state === GUEST_STATES.checkingSign) visit.feedback.set("checking");
    else if (visit.state === GUEST_STATES.carryingToSeat) visit.feedback.set("carrying-dish");
    else if (visit.state === GUEST_STATES.eating) visit.feedback.set(visit.mealCompleted ? "meal-complete" : "eating");
    else if (visit.state === GUEST_STATES.leaving && visit.order.itemId === "lemonade") visit.feedback.set("carrying-lemonade");
    else visit.feedback.set("moving");
  }

  function setOrderFeedback(visit) {
    visit.feedback.setOrder?.({
      displayName: getPersonDisplayName(visit.personId),
      itemLabel: getItemLabel(visit.order.itemId),
      status: visit.order.status,
    });
  }

  function orderSnapshot(visit) {
    return {
      guestId: visit.id,
      personId: visit.personId,
      servingTableId: visit.servingTableId,
      order: { ...visit.order },
    };
  }

  function getInteractionDefinitions() {
    return [...visits.values()]
      .filter((visit) => visit.order.status === ORDER_STATUS.offered)
      .map((visit) => ({
        id: `tavern-order:${visit.id}`,
        entityId: visit.id,
        kind: GUEST_ORDER_INTERACTION_KIND,
        position: { ...visit.character.motor.position },
        radius: 38,
        priority: 92,
        requiresFacing: true,
        facingDotThreshold: -0.15,
        prompt: getOrderPrompt(visit.order.itemId),
        payload: { guestId: visit.id },
      }));
  }

  function setOrderElapsedMs(guestId, value) {
    const visit = visits.get(guestId);
    if (!visit || ![ORDER_STATUS.offered, ORDER_STATUS.accepted].includes(visit.order.status)) return false;
    visit.order.statusElapsedMs = Math.max(0, Number(value) || 0);
    return true;
  }

  function syncPersistedState() {
    serviceState.guests = [...visits.values()].map((visit) => ({
      id: visit.id,
      personId: visit.personId,
      state: visit.state,
      stateElapsedMs: visit.stateElapsedMs,
      position: { ...visit.character.motor.position },
      itemId: visit.order.itemId,
      order: { ...visit.order },
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
    acceptGuestOrder,
    getInteractionDefinitions,
    setOrderElapsedMs,
    getActivePersonIds: () => [...visits.values()].map((visit) => visit.personId),
    getActivePersonBindings: () => [...visits.values()].map((visit) => ({
      actorId: visit.id,
      personId: visit.personId,
      position: { ...visit.character.motor.position },
    })),
    isDishReserved: () => [...visits.values()].some((visit) => visit.reservationActive),
    isDiningTableReserved: (tableId) => [...visits.values()].some((visit) => visit.diningTableId === tableId),
    getState: () => {
      const guests = [...visits.values()].map((visit) => ({
        id: visit.id,
        personId: visit.personId,
        displayName: getPersonDisplayName(visit.personId),
        state: visit.state,
        reservedDish: visit.reservationActive,
        itemId: visit.order.itemId,
        order: { ...visit.order },
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
