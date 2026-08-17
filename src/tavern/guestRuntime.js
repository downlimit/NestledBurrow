import { createActorNavigation, findGridPath } from "./gridPathfinder.js";
import { GUEST_ACTIVE_CAP } from "./tavernServiceDomain.js";
import { VISIT_GROUP_MAX_SIZE } from "./visitPartyDomain.js";
import {
  advanceOrderTimer,
  createPlannedOrder,
  ORDER_FULFILLMENT_TIMEOUT_MS,
  ORDER_STATUS,
  transitionOrder,
} from "./orderDomain.js";
import {
  advanceLiveGuestNeeds,
  applyGuestNeedResolution,
  arbitrateGuestIntent,
  computeVisitSatisfactionTier,
  GUEST_INTENTS,
  isIntentResolved,
  menuReadingDurationMs,
  shouldDrinkTakeout,
  shouldInterruptOrder,
  stableIntentDurationMs,
} from "./guestIntentDomain.js";

const NAVIGATION_CELL_SIZE = 16;
const TARGET_SEARCH_RADIUS_CELLS = 2;
const SOCIAL_RANGE = 42;
export const GUEST_ORDER_INTERACTION_KIND = "accept-tavern-order";
export const GUEST_TALK_INTERACTION_KIND = "talk-tavern-guest";

export const GUEST_STATES = Object.freeze({
  approachingSign: "approaching-sign",
  checkingSign: "checking-sign",
  approachingOrder: "approaching-order",
  offered: "offered-order",
  accepted: "accepted-order",
  approachingNeed: "approaching-need",
  resolvingNeed: "resolving-need",
  eating: "eating",
  drinking: "drinking",
  chilling: "chilling",
  satisfaction: "satisfaction",
  paying: "paying",
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
  claimServicePlace = () => null,
  releaseServicePlace = () => false,
  claimNeedFacility = () => null,
  releaseNeedFacility = () => false,
  getNeedFacilityPoint = () => null,
  reserveExactItem = () => null,
  releaseReservation = () => false,
  consumeReservation = () => null,
  getPerson = (personId) => ({ id: personId, needs: fullNeeds(), lastEvaluatedWorldTimeSeconds: 0 }),
  getWorldTimeSeconds = () => 0,
  getPlayerPosition = () => null,
  isPlayerAvailable = () => false,
  createPlayerFeedback = () => null,
  onLiveNeedsChange = () => {},
  onReservationChange = () => {},
  onOrderChange = () => {},
  onOrderFailure = () => {},
  onOpenUnserved = () => {},
  onVisitFinished = () => {},
  onPurchaseComplete = () => {},
  getSalePrice = () => 0,
  getPersonDisplayName = (personId) => personId,
  getItemLabel = (itemId) => itemId,
  getOrderPrompt = () => "hud:interaction.acceptGuestOrder",
  getTalkPrompt = () => "hud:interaction.talkGuest",
  createFeedback = () => emptyFeedback(),
}) {
  if (typeof getSignPoint !== "function" || typeof getServicePoint !== "function") {
    throw new Error("Guest runtime requires live sign and service-place point resolvers");
  }
  const visits = new Map();
  let playerFeedback = null;
  let playerTalkGuestId = null;
  let destroyed = false;
  let needsSaveElapsedMs = 0;

  for (const snapshot of serviceState.guests) restoreVisit(snapshot);
  syncPersistedState();

  function update(deltaMs) {
    if (destroyed) return;
    const delta = Math.max(0, Number(deltaMs) || 0);
    needsSaveElapsedMs += delta;
    for (const visit of [...visits.values()]) updateVisit(visit, delta);
    if (needsSaveElapsedMs >= 1_000) {
      needsSaveElapsedMs %= 1_000;
      onLiveNeedsChange({ status: "guest-live-needs", mutated: true });
    }
    playerFeedback?.update?.(delta);
    syncPersistedState();
  }

  function updateVisit(visit, deltaMs) {
    visit.feedback.update?.(deltaMs);
    visit.stateElapsedMs += deltaMs;
    const person = getPerson(visit.personId);
    const resolvingIntent = [GUEST_STATES.resolvingNeed, GUEST_STATES.approachingNeed].includes(visit.state)
      ? visit.currentIntent
      : GUEST_INTENTS.none;
    advanceLiveGuestNeeds(person, deltaMs, {
      moving: Boolean(visit.path),
      resolvingIntent,
      worldTimeSeconds: getWorldTimeSeconds(),
    });
    updateIntent(visit, person);
    updateMenuReading(visit, deltaMs);
    const timer = advanceOrderTimer(visit.order, deltaMs);
    visit.orderTimedOut = timer.timedOut;
    if (visit.order.status === ORDER_STATUS.accepted) {
      visit.fulfillmentElapsedMs = visit.order.statusElapsedMs;
      reserveAcceptedOrder(visit);
    }
    visit.feedback.setProgress?.(
      visit.order.status === ORDER_STATUS.accepted
        ? Math.min(1, visit.order.statusElapsedMs / ORDER_FULFILLMENT_TIMEOUT_MS)
        : null,
    );
    if (visit.orderTimedOut && visit.order.status === ORDER_STATUS.accepted) {
      failAcceptedOrder(visit, "fulfillment-timeout");
      return;
    }
    if (maybeInterruptOrder(visit, person, deltaMs)) return;
    syncMovingTarget(visit);
    if (visit.path) updateMovement(visit, deltaMs);
    else updateStationary(visit, person);
  }

  function spawnVisit(personId, orderItemId, acceptableItemIds = [], options = {}) {
    if (destroyed || visits.size >= GUEST_ACTIVE_CAP || !personId) return false;
    if ([...visits.values()].some((visit) => visit.personId === personId)) return false;
    if (Array.isArray(orderItemId)) {
      acceptableItemIds = orderItemId;
      [orderItemId] = acceptableItemIds;
    }
    let order;
    try { order = createPlannedOrder(orderItemId); } catch { return false; }
    const id = `tavern-guest-${++serviceState.nextGuestId}`;
    const controller = config.createController();
    const character = createGuest(controller, id, options.spawnPosition ?? config.points.spawn);
    const visit = baseVisit({
      id,
      personId,
      character,
      controller,
      feedback: createFeedback(character),
      order,
      acceptableItemIds,
      offerFit: options.offerFit,
    });
    visits.set(id, visit);
    visit.feedback.set("arriving");
    if (!planTo(visit, getSignPoint())) {
      cancelVisit(visit, "sign-unreachable");
      return false;
    }
    syncPersistedState();
    return id;
  }

  function spawnVisitGroup(participants) {
    if (!Array.isArray(participants) || participants.length === 0
      || participants.length > VISIT_GROUP_MAX_SIZE) return false;
    if (destroyed || visits.size + participants.length > GUEST_ACTIVE_CAP) return false;
    const activePersonIds = new Set([...visits.values()].map((visit) => visit.personId));
    const requestedPersonIds = new Set();
    for (const participant of participants) {
      if (!participant?.personId || activePersonIds.has(participant.personId)
        || requestedPersonIds.has(participant.personId)) return false;
      try { createPlannedOrder(participant.orderItemId); } catch { return false; }
      requestedPersonIds.add(participant.personId);
    }
    const offsets = participants.length === 1 ? [0] : participants.length === 2 ? [-5, 5] : [-7, 0, 7];
    const guestIds = [];
    for (let index = 0; index < participants.length; index += 1) {
      const participant = participants[index];
      const guestId = spawnVisit(
        participant.personId,
        participant.orderItemId,
        participant.acceptableItemIds,
        {
          ...(participant.options ?? {}),
          spawnPosition: {
            x: config.points.spawn.x + offsets[index],
            y: config.points.spawn.y,
          },
        },
      );
      if (!guestId) {
        for (const spawnedGuestId of guestIds) finishVisit(visits.get(spawnedGuestId));
        syncPersistedState();
        return false;
      }
      guestIds.push(guestId);
    }
    return guestIds;
  }

  function baseVisit({ id, personId, character, controller, feedback, order, acceptableItemIds, offerFit = 0.5 }) {
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
      acceptableItemIds: [...acceptableItemIds],
      servingTableId: null,
      reservationActive: false,
      servedItemOnTable: false,
      mealCompleted: false,
      paid: false,
      failureRecorded: false,
      menuStarted: false,
      menuElapsedMs: 0,
      menuDurationMs: menuReadingDurationMs(offerFit),
      menuComplete: false,
      atServiceTable: false,
      currentIntent: GUEST_INTENTS.none,
      intentCritical: false,
      intentUnavailableMs: 0,
      needFacilityId: null,
      resumeState: null,
      resolvedInterrupts: 0,
      fulfillmentElapsedMs: 0,
      satisfactionTier: null,
      chillBeforePayment: false,
      chillDurationMs: 0,
      takeoutDrink: false,
      socialPartnerId: null,
      playerConversation: false,
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
      offerFit: snapshot.offerFit,
    });
    Object.assign(visit, {
      state: restoreState(snapshot),
      stateElapsedMs: snapshot.stateElapsedMs,
      signDecision: true,
      servingTableId: snapshot.servingTableId,
      reservationActive: snapshot.reservationActive,
      servedItemOnTable: Boolean(snapshot.servedItemOnTable || snapshot.order.status === ORDER_STATUS.served && snapshot.reservationActive),
      mealCompleted: snapshot.mealCompleted,
      paid: snapshot.paid,
      failureRecorded: snapshot.order.status === ORDER_STATUS.failed,
      menuStarted: Boolean(snapshot.menuStarted || snapshot.servingTableId),
      menuElapsedMs: Number(snapshot.menuElapsedMs) || 0,
      menuDurationMs: Number(snapshot.menuDurationMs) || menuReadingDurationMs(snapshot.offerFit),
      menuComplete: Boolean(snapshot.menuComplete || snapshot.order.status !== ORDER_STATUS.planned),
      fulfillmentElapsedMs: Number(snapshot.fulfillmentElapsedMs) || snapshot.order.statusElapsedMs || 0,
    });
    if (visit.servingTableId) claimServicePlace(visit.id, visit.order.itemId, visit.servingTableId);
    if (visit.reservationActive) reserveExactItem(visit.id, visit.servingTableId, visit.order.itemId);
    visits.set(visit.id, visit);
    visit.atServiceTable = isNearPoint(visit.character.motor.position, getServicePoint(visit.servingTableId), config.arrivalRadius);
    setFeedbackForVisit(visit);
    const target = targetForState(visit);
    if (target && !planTo(visit, target)) cancelVisit(visit, "restore-target-unreachable");
  }

  function restoreState(snapshot) {
    if (snapshot.order.status === ORDER_STATUS.failed || snapshot.order.status === ORDER_STATUS.completed) return GUEST_STATES.leaving;
    if (snapshot.order.status === ORDER_STATUS.served) {
      return snapshot.order.itemId === "lemonade" ? GUEST_STATES.drinking : GUEST_STATES.eating;
    }
    if (snapshot.order.status === ORDER_STATUS.accepted || snapshot.order.status === ORDER_STATUS.reserved) {
      return GUEST_STATES.accepted;
    }
    if (snapshot.order.status === ORDER_STATUS.offered) return GUEST_STATES.offered;
    return Object.values(GUEST_STATES).includes(snapshot.state) ? snapshot.state : GUEST_STATES.approachingSign;
  }

  function updateIntent(visit, person) {
    if ([GUEST_STATES.leaving, GUEST_STATES.paying, GUEST_STATES.satisfaction].includes(visit.state)) return;
    const result = arbitrateGuestIntent(person, visit.currentIntent, { orderStatus: visit.order.status });
    visit.currentIntent = result.intent;
    visit.intentCritical = Boolean(result.critical);
    visit.feedback.setThought?.(result.intent === GUEST_INTENTS.none ? null : result.intent);
  }

  function updateMenuReading(visit, deltaMs) {
    if (!visit.menuStarted || visit.menuComplete) return;
    visit.menuElapsedMs += deltaMs;
    if (visit.menuElapsedMs < visit.menuDurationMs) return;
    visit.menuComplete = true;
    if (visit.order.status === ORDER_STATUS.planned) {
      transitionOrder(visit.order, ORDER_STATUS.offered);
      visit.state = GUEST_STATES.offered;
      visit.stateElapsedMs = 0;
      setOrderFeedback(visit);
      onOrderChange(orderSnapshot(visit));
    }
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
    if (visit.replans > config.maxReplans || !planTo(visit, visit.target, { keepReplans: true })) {
      cancelVisit(visit, "route-blocked");
    }
  }

  function updateStationary(visit, person) {
    if (visit.state === GUEST_STATES.checkingSign) updateSignCheck(visit);
    else if (visit.state === GUEST_STATES.offered) updateOfferedOrder(visit);
    else if (visit.state === GUEST_STATES.accepted) updateAcceptedOrder(visit, person);
    else if (visit.state === GUEST_STATES.resolvingNeed) updateNeedResolution(visit, person);
    else if ([GUEST_STATES.eating, GUEST_STATES.drinking].includes(visit.state)) updateConsumption(visit, person);
    else if (visit.state === GUEST_STATES.chilling) updateChilling(visit);
    else if ([GUEST_STATES.satisfaction, GUEST_STATES.paying].includes(visit.state)) updateOutcome(visit);
    else if (visit.order.status === ORDER_STATUS.failed && visit.stateElapsedMs >= (config.signReactionMs ?? 900)) {
      transition(visit, GUEST_STATES.leaving, config.points.exit, { preserveFeedback: true });
    }
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
    const place = claimServicePlace(visit.id, visit.order.itemId, visit.servingTableId);
    if (!place) {
      if (visit.stateElapsedMs >= (config.signReactionMs ?? 0) + (config.orderStationWaitMs ?? 10_000)) {
        onOpenUnserved({
          guestId: visit.id,
          personId: visit.personId,
          itemId: visit.order.itemId,
          reason: "service-capacity-unavailable",
        });
        leaveWithoutFailure(visit);
      }
      return;
    }
    visit.servingTableId = place.servingTableId;
    visit.menuStarted = true;
    visit.feedback.set("reading-menu");
    transition(visit, GUEST_STATES.approachingOrder, getServicePoint(visit.servingTableId), { preserveFeedback: true });
  }

  function updateOfferedOrder(visit) {
    if (!getTavernOpen() || !isOrderItemActive(visit.order.itemId) || visit.orderTimedOut) leaveWithoutFailure(visit);
  }

  function updateAcceptedOrder(visit, person) {
    if (!visit.atServiceTable) {
      const point = getServicePoint(visit.servingTableId);
      if (point) transition(visit, GUEST_STATES.accepted, point, { preserveFeedback: true });
      return;
    }
    if (visit.order.status === ORDER_STATUS.reserved && visit.reservationActive) beginConsumption(visit, person);
  }

  function reserveAcceptedOrder(visit) {
    if (visit.reservationActive) return true;
    const reservation = reserveExactItem(visit.id, visit.servingTableId, visit.order.itemId);
    if (!reservation) return false;
    visit.reservationActive = true;
    transitionOrder(visit.order, ORDER_STATUS.reserved);
    onReservationChange({
      guestId: visit.id,
      active: true,
      itemId: reservation.itemId,
      servingTableId: reservation.servingTableId,
    });
    onOrderChange(orderSnapshot(visit));
    setOrderFeedback(visit);
    return true;
  }

  function beginConsumption(visit, person) {
    transitionOrder(visit.order, ORDER_STATUS.served);
    visit.servedItemOnTable = true;
    visit.stateElapsedMs = 0;
    visit.takeoutDrink = visit.order.itemId === "lemonade" && shouldDrinkTakeout(person);
    onOrderChange(orderSnapshot(visit));
    if (visit.takeoutDrink) {
      consumeTableItem(visit);
      applyGuestNeedResolution(person, GUEST_INTENTS.food, 35);
      beginOutcome(visit, person);
      return;
    }
    visit.state = visit.order.itemId === "lemonade" ? GUEST_STATES.drinking : GUEST_STATES.eating;
    visit.feedback.set(visit.state === GUEST_STATES.drinking ? "drinking" : "eating");
  }

  function updateConsumption(visit, person) {
    const duration = visit.state === GUEST_STATES.drinking ? (config.drinkingMs ?? 3_500) : config.eatingMs;
    if (visit.stateElapsedMs < duration) return;
    if (!consumeTableItem(visit)) {
      cancelVisit(visit, "served-item-missing");
      return;
    }
    visit.mealCompleted = true;
    applyGuestNeedResolution(person, GUEST_INTENTS.food, visit.order.itemId === "lemonade" ? 35 : 65);
    beginOutcome(visit, person);
  }

  function consumeTableItem(visit) {
    const consumed = visit.reservationActive ? consumeReservation(visit.id, visit.servingTableId) : null;
    if (!consumed || consumed.itemId !== visit.order.itemId) return false;
    visit.reservationActive = false;
    visit.servedItemOnTable = false;
    onReservationChange({
      guestId: visit.id,
      active: false,
      itemId: consumed.itemId,
      servingTableId: consumed.servingTableId,
      consumed: true,
    });
    return true;
  }

  function beginOutcome(visit, person) {
    visit.satisfactionTier = computeVisitSatisfactionTier({
      fulfillmentElapsedMs: visit.fulfillmentElapsedMs,
      resolvedInterrupts: visit.resolvedInterrupts,
    });
    const postMealIntent = arbitrateGuestIntent(person, visit.currentIntent, { orderStatus: visit.order.status }).intent;
    if ([GUEST_INTENTS.rest, GUEST_INTENTS.wander, GUEST_INTENTS.social].includes(postMealIntent)) {
      visit.state = GUEST_STATES.chilling;
      visit.chillBeforePayment = true;
      visit.chillDurationMs = stableIntentDurationMs(visit.personId, postMealIntent);
      visit.stateElapsedMs = 0;
      visit.feedback.set("chilling");
      return;
    }
    showSatisfaction(visit);
  }

  function updateChilling(visit) {
    if (visit.stateElapsedMs < visit.chillDurationMs) return;
    if (visit.chillBeforePayment) showSatisfaction(visit);
    else transition(visit, GUEST_STATES.leaving, config.points.exit, { preserveFeedback: true });
  }

  function showSatisfaction(visit) {
    visit.state = GUEST_STATES.satisfaction;
    visit.stateElapsedMs = 0;
    visit.feedback.set("satisfaction", { satisfactionTier: visit.satisfactionTier });
  }

  function updateOutcome(visit) {
    if (visit.state === GUEST_STATES.satisfaction) {
      if (visit.stateElapsedMs < (config.satisfactionMs ?? config.mealCompleteReactionMs ?? 900)) return;
      visit.state = GUEST_STATES.paying;
      visit.stateElapsedMs = 0;
      visit.feedback.set("paying");
      return;
    }
    if (visit.stateElapsedMs < (config.payingMs ?? config.signReactionMs ?? 1_200)) return;
    completePurchase(visit);
    if (visit.takeoutDrink) {
      visit.feedback.set("carrying-lemonade");
      transition(visit, GUEST_STATES.leaving, config.points.exit, { preserveFeedback: true });
      return;
    }
    const person = getPerson(visit.personId);
    const intent = arbitrateGuestIntent(person, visit.currentIntent).intent;
    if ([GUEST_INTENTS.rest, GUEST_INTENTS.wander, GUEST_INTENTS.social].includes(intent)) {
      visit.state = GUEST_STATES.chilling;
      visit.chillBeforePayment = false;
      visit.chillDurationMs = stableIntentDurationMs(visit.personId, `${intent}:paid`, 900, 2_200);
      visit.stateElapsedMs = 0;
      visit.feedback.set("chilling");
    } else transition(visit, GUEST_STATES.leaving, config.points.exit);
  }

  function maybeInterruptOrder(visit, person, deltaMs) {
    if ([GUEST_STATES.approachingNeed, GUEST_STATES.resolvingNeed].includes(visit.state)) return false;
    const result = arbitrateGuestIntent(person, visit.currentIntent, { orderStatus: visit.order.status });
    if (!shouldInterruptOrder(result, visit.order.status)) return false;
    visit.currentIntent = result.intent;
    visit.intentCritical = true;
    visit.resumeState = visit.state;
    if ([GUEST_INTENTS.toilet, GUEST_INTENTS.wash].includes(result.intent)) {
      const claim = claimNeedFacility(visit.id, result.intent, visit.needFacilityId);
      if (!claim) {
        visit.controller.stop();
        visit.intentUnavailableMs += deltaMs;
        if (visit.intentUnavailableMs >= (config.criticalUnresolvedMs ?? 8_000)) departForUnresolvedCritical(visit);
        return true;
      }
      visit.needFacilityId = claim.facilityId;
      visit.intentUnavailableMs = 0;
      visit.feedback.set(result.intent === GUEST_INTENTS.wash ? "washing" : "waiting");
      transition(visit, GUEST_STATES.approachingNeed, getNeedFacilityPoint(claim.facilityId), { preserveFeedback: true });
      return true;
    }
    if (result.intent === GUEST_INTENTS.social && !startNearbyNpcConversation(visit)) {
      visit.intentUnavailableMs += deltaMs;
      if (visit.intentUnavailableMs >= (config.criticalUnresolvedMs ?? 8_000)) departForUnresolvedCritical(visit);
      return false;
    }
    visit.intentUnavailableMs = 0;
    if (result.intent === GUEST_INTENTS.wander) {
      visit.state = GUEST_STATES.approachingNeed;
      visit.stateElapsedMs = 0;
      visit.feedback.set("chilling");
      if (planTo(visit, wanderPointForVisit(visit))) return true;
    }
    visit.state = GUEST_STATES.resolvingNeed;
    visit.stateElapsedMs = 0;
    visit.path = null;
    visit.controller.stop();
    visit.feedback.set(result.intent === GUEST_INTENTS.rest || result.intent === GUEST_INTENTS.wander ? "chilling" : "talking");
    return true;
  }

  function startNearbyNpcConversation(visit) {
    const partner = [...visits.values()].find((candidate) => candidate.id !== visit.id
      && !isExclusiveState(candidate.state)
      && isNearPoint(candidate.character.motor.position, visit.character.motor.position, SOCIAL_RANGE));
    if (!partner) return false;
    for (const participant of [visit, partner]) {
      participant.resumeState ??= participant.state;
      participant.state = GUEST_STATES.resolvingNeed;
      participant.stateElapsedMs = 0;
      participant.path = null;
      participant.controller.stop();
      participant.currentIntent = GUEST_INTENTS.social;
      participant.socialPartnerId = participant.id === visit.id ? partner.id : visit.id;
      participant.feedback.setThought?.(GUEST_INTENTS.social);
      participant.feedback.set("talking");
    }
    return true;
  }

  function updateNeedResolution(visit, person) {
    if (isIntentResolved(person, visit.currentIntent)) {
      finishNeedResolution(visit);
      return;
    }
    if (visit.currentIntent === GUEST_INTENTS.social && !visit.socialPartnerId && !visit.playerConversation) {
      visit.intentUnavailableMs += 50;
      if (visit.intentCritical && visit.intentUnavailableMs >= (config.criticalUnresolvedMs ?? 8_000)) departForUnresolvedCritical(visit);
    }
  }

  function finishNeedResolution(visit) {
    releaseNeedFacility(visit.id, visit.needFacilityId);
    visit.needFacilityId = null;
    visit.resolvedInterrupts += 1;
    visit.intentCritical = false;
    visit.intentUnavailableMs = 0;
    const partner = visits.get(visit.socialPartnerId);
    visit.socialPartnerId = null;
    if (visit.playerConversation) stopPlayerConversation(visit);
    visit.playerConversation = false;
    resumeOrderFlow(visit);
    if (partner?.state === GUEST_STATES.resolvingNeed && isIntentResolved(getPerson(partner.personId), partner.currentIntent)) {
      partner.socialPartnerId = null;
      resumeOrderFlow(partner);
    }
  }

  function resumeOrderFlow(visit) {
    visit.feedback.setThought?.(null);
    visit.resumeState = null;
    if ([ORDER_STATUS.accepted, ORDER_STATUS.reserved].includes(visit.order.status)) {
      visit.state = GUEST_STATES.accepted;
      visit.stateElapsedMs = 0;
      setOrderFeedback(visit);
      const point = getServicePoint(visit.servingTableId);
      visit.atServiceTable = isNearPoint(visit.character.motor.position, point, config.arrivalRadius);
      if (!visit.atServiceTable && !planTo(visit, point)) cancelVisit(visit, "resume-table-unreachable");
    } else if (visit.order.status === ORDER_STATUS.offered) {
      visit.state = GUEST_STATES.offered;
      visit.stateElapsedMs = 0;
      setOrderFeedback(visit);
    }
  }

  function departForUnresolvedCritical(visit) {
    if ([ORDER_STATUS.accepted, ORDER_STATUS.reserved].includes(visit.order.status)) failAcceptedOrder(visit, "critical-need-unresolved");
    else leaveWithoutFailure(visit);
  }

  function arrive(visit) {
    visit.path = null;
    visit.controller.stop();
    visit.stateElapsedMs = 0;
    if (visit.state === GUEST_STATES.approachingSign) {
      visit.state = GUEST_STATES.checkingSign;
      visit.controller.face(config.signFacing ?? { x: 1, y: 0 });
      visit.feedback.set("checking");
    } else if ([GUEST_STATES.approachingOrder, GUEST_STATES.offered, GUEST_STATES.accepted].includes(visit.state)) {
      visit.atServiceTable = true;
      visit.state = visit.order.status === ORDER_STATUS.offered ? GUEST_STATES.offered : GUEST_STATES.accepted;
      if (visit.menuComplete) setOrderFeedback(visit);
      else visit.feedback.set("reading-menu");
    } else if (visit.state === GUEST_STATES.approachingNeed) {
      visit.state = GUEST_STATES.resolvingNeed;
      visit.feedback.set(visit.currentIntent === GUEST_INTENTS.wash ? "washing" : "waiting");
    } else if (visit.state === GUEST_STATES.leaving) finishVisit(visit);
  }

  function acceptGuestOrder(guestId) {
    const visit = visits.get(guestId);
    if (!visit || visit.order.status !== ORDER_STATUS.offered) return { status: "order-not-offered", mutated: false };
    transitionOrder(visit.order, ORDER_STATUS.accepted);
    visit.state = GUEST_STATES.accepted;
    visit.stateElapsedMs = 0;
    setOrderFeedback(visit);
    onOrderChange(orderSnapshot(visit));
    return {
      status: "order-accepted",
      mutated: true,
      order: { ...visit.order },
      itemLabel: getItemLabel(visit.order.itemId),
      guestId: visit.id,
    };
  }

  function startPlayerConversation(guestId) {
    const visit = visits.get(guestId);
    if (!visit || visit.currentIntent !== GUEST_INTENTS.social || !isPlayerAvailable() || isExclusiveState(visit.state)) {
      return { status: "talk-unavailable", mutated: false };
    }
    visit.resumeState = visit.state;
    visit.state = GUEST_STATES.resolvingNeed;
    visit.stateElapsedMs = 0;
    visit.path = null;
    visit.controller.stop();
    visit.playerConversation = true;
    visit.feedback.set("talking");
    playerTalkGuestId = visit.id;
    playerFeedback ??= createPlayerFeedback();
    playerFeedback?.set?.("talking");
    return { status: "guest-talk-started", mutated: true, guestId: visit.id };
  }

  function stopPlayerConversation(visit) {
    if (playerTalkGuestId !== visit.id) return;
    playerFeedback?.set?.(null);
    playerTalkGuestId = null;
  }

  function handleGuestInteraction(candidate) {
    if (candidate?.kind === GUEST_ORDER_INTERACTION_KIND) return acceptGuestOrder(candidate.payload?.guestId);
    if (candidate?.kind === GUEST_TALK_INTERACTION_KIND) return startPlayerConversation(candidate.payload?.guestId);
    return { status: "ignored", mutated: false };
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
      satisfactionTier: visit.satisfactionTier,
      order: { ...visit.order },
    });
  }

  function failAcceptedOrder(visit, reason) {
    if (visit.failureRecorded) return;
    if (visit.order.status === ORDER_STATUS.reserved) releaseVisitReservation(visit);
    if ([ORDER_STATUS.accepted, ORDER_STATUS.reserved].includes(visit.order.status)) {
      transitionOrder(visit.order, ORDER_STATUS.failed);
    }
    visit.failureRecorded = true;
    releaseServicePlace(visit.id, visit.servingTableId);
    releaseNeedFacility(visit.id, visit.needFacilityId);
    onOrderFailure({ ...orderSnapshot(visit), reason });
    onOrderChange(orderSnapshot(visit));
    visit.state = GUEST_STATES.leaving;
    visit.stateElapsedMs = 0;
    visit.feedback.setThought?.(GUEST_INTENTS.leave);
    visit.feedback.set("order-failed");
  }

  function transition(visit, state, target, { preserveFeedback = false } = {}) {
    visit.state = state;
    visit.stateElapsedMs = 0;
    if (!preserveFeedback) visit.feedback.set(state === GUEST_STATES.leaving ? "leaving" : "moving");
    if (!planTo(visit, target)) cancelVisit(visit, "transition-unreachable");
  }

  function leaveWithoutFailure(visit) {
    releaseVisitReservation(visit);
    releaseServicePlace(visit.id, visit.servingTableId);
    releaseNeedFacility(visit.id, visit.needFacilityId);
    transition(visit, GUEST_STATES.leaving, config.points.exit);
  }

  function planTo(visit, target, { keepReplans = false } = {}) {
    if (!visits.has(visit.id) || !target) return false;
    const navigation = createActorNavigation(worldLayout, {
      cellSize: NAVIGATION_CELL_SIZE,
      footWidth: visit.character.footWidth,
      footDepth: visit.character.footDepth,
    });
    const path = candidateTargetsAround(target).reduce((match, goal) => match ?? findGridPath({
      start: visit.character.motor.position,
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

  function wanderPointForVisit(visit) {
    const numericId = Number(/(\d+)$/.exec(visit.id)?.[1]) || 0;
    const direction = numericId % 2 === 0 ? 1 : -1;
    const bounds = worldLayout.bounds;
    return {
      x: Math.min(bounds.right - NAVIGATION_CELL_SIZE, Math.max(bounds.left + NAVIGATION_CELL_SIZE, visit.character.motor.position.x + direction * 48)),
      y: Math.min(bounds.bottom - NAVIGATION_CELL_SIZE, Math.max(bounds.top + NAVIGATION_CELL_SIZE, visit.character.motor.position.y + 32)),
    };
  }

  function syncMovingTarget(visit) {
    if (!visit.path) return;
    let point = null;
    if (visit.state === GUEST_STATES.approachingSign) point = getSignPoint();
    else if ([GUEST_STATES.approachingOrder, GUEST_STATES.offered, GUEST_STATES.accepted].includes(visit.state)) {
      point = getServicePoint(visit.servingTableId);
    } else if (visit.state === GUEST_STATES.approachingNeed) point = getNeedFacilityPoint(visit.needFacilityId);
    if (point && !samePoint(point, visit.target)) planTo(visit, point);
  }

  function releaseVisitReservation(visit) {
    if (!visit.reservationActive) return false;
    const released = releaseReservation(visit.id, visit.servingTableId);
    visit.reservationActive = false;
    visit.servedItemOnTable = false;
    if (released) onReservationChange({
      guestId: visit.id,
      active: false,
      itemId: visit.order.itemId,
      servingTableId: visit.servingTableId,
    });
    return released;
  }

  function cancelVisit(visit, reason) {
    if ([ORDER_STATUS.accepted, ORDER_STATUS.reserved].includes(visit.order.status)) {
      failAcceptedOrder(visit, reason);
      if (!visit.path) transition(visit, GUEST_STATES.leaving, config.points.exit, { preserveFeedback: true });
      return;
    }
    releaseVisitReservation(visit);
    finishVisit(visit);
  }

  function finishVisit(visit) {
    if (!visits.has(visit.id)) return;
    visit.state = GUEST_STATES.finished;
    visit.feedback.destroy();
    releaseServicePlace(visit.id, visit.servingTableId);
    releaseNeedFacility(visit.id, visit.needFacilityId);
    stopPlayerConversation(visit);
    removeGuest(visit.character.id);
    visits.delete(visit.id);
    onVisitFinished(orderSnapshot(visit));
    syncPersistedState();
  }

  function targetForState(visit) {
    if (visit.state === GUEST_STATES.approachingSign) return getSignPoint();
    if ([GUEST_STATES.approachingOrder, GUEST_STATES.offered, GUEST_STATES.accepted].includes(visit.state)) {
      return getServicePoint(visit.servingTableId);
    }
    if (visit.state === GUEST_STATES.approachingNeed) return getNeedFacilityPoint(visit.needFacilityId);
    if (visit.state === GUEST_STATES.leaving) return config.points.exit;
    return null;
  }

  function setFeedbackForVisit(visit) {
    if ([ORDER_STATUS.offered, ORDER_STATUS.accepted, ORDER_STATUS.reserved].includes(visit.order.status)) setOrderFeedback(visit);
    else if (visit.order.status === ORDER_STATUS.failed) visit.feedback.set("order-failed");
    else if (visit.state === GUEST_STATES.checkingSign) visit.feedback.set("checking");
    else if (visit.state === GUEST_STATES.eating) visit.feedback.set("eating");
    else if (visit.state === GUEST_STATES.drinking) visit.feedback.set("drinking");
    else if (visit.menuStarted && !visit.menuComplete) visit.feedback.set("reading-menu");
    else visit.feedback.set("moving");
  }

  function setOrderFeedback(visit) {
    visit.feedback.setOrder?.({
      displayName: getPersonDisplayName(visit.personId),
      itemId: visit.order.itemId,
      itemLabel: getItemLabel(visit.order.itemId),
      status: visit.order.status,
      progress: visit.order.status === ORDER_STATUS.accepted
        ? Math.min(1, visit.order.statusElapsedMs / ORDER_FULFILLMENT_TIMEOUT_MS)
        : null,
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
    const orderDefinitions = [...visits.values()]
      .filter((visit) => visit.order.status === ORDER_STATUS.offered)
      .map((visit) => interactionDefinition(visit, GUEST_ORDER_INTERACTION_KIND, 92, getOrderPrompt()));
    const talkDefinitions = isPlayerAvailable() ? [...visits.values()]
      .filter((visit) => visit.currentIntent === GUEST_INTENTS.social && !isExclusiveState(visit.state))
      .map((visit) => interactionDefinition(visit, GUEST_TALK_INTERACTION_KIND, 91, getTalkPrompt())) : [];
    return [...orderDefinitions, ...talkDefinitions];
  }

  function interactionDefinition(visit, kind, priority, prompt) {
    return {
      id: `${kind}:${visit.id}`,
      entityId: visit.id,
      kind,
      position: { ...visit.character.motor.position },
      radius: 38,
      priority,
      requiresFacing: true,
      facingDotThreshold: -0.15,
      prompt,
      payload: { guestId: visit.id },
    };
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
      reservationActive: visit.reservationActive,
      servedItemOnTable: visit.servedItemOnTable,
      mealCompleted: visit.mealCompleted,
      paid: visit.paid,
      menuStarted: visit.menuStarted,
      menuElapsedMs: visit.menuElapsedMs,
      menuDurationMs: visit.menuDurationMs,
      menuComplete: visit.menuComplete,
      fulfillmentElapsedMs: visit.fulfillmentElapsedMs,
    }));
  }

  return Object.freeze({
    update,
    spawnVisit,
    spawnVisitGroup,
    acceptGuestOrder,
    handleGuestInteraction,
    getInteractionDefinitions,
    setOrderElapsedMs,
    getActivePersonIds: () => [...visits.values()].map((visit) => visit.personId),
    getActivePersonBindings: () => [...visits.values()].map((visit) => ({
      actorId: visit.id,
      personId: visit.personId,
      position: { ...visit.character.motor.position },
    })),
    isDishReserved: () => [...visits.values()].some((visit) => visit.reservationActive),
    isServicePlaceReserved: (tableId) => [...visits.values()].some((visit) => visit.servingTableId === tableId),
    isDiningTableReserved: () => false,
    getState: () => {
      const guests = [...visits.values()].map((visit) => ({
        id: visit.id,
        personId: visit.personId,
        displayName: getPersonDisplayName(visit.personId),
        state: visit.state,
        intent: visit.currentIntent,
        intentCritical: visit.intentCritical,
        needs: { ...(getPerson(visit.personId)?.needs ?? {}) },
        reservedDish: visit.reservationActive,
        servedItemOnTable: visit.servedItemOnTable,
        itemId: visit.order.itemId,
        order: { ...visit.order },
        acceptableItemIds: [...visit.acceptableItemIds],
        servingTableId: visit.servingTableId,
        diningTableId: null,
        position: { ...visit.character.motor.position },
        menu: { elapsedMs: visit.menuElapsedMs, durationMs: visit.menuDurationMs, complete: visit.menuComplete },
        overhead: visit.feedback.getState?.() ?? null,
        satisfactionTier: visit.satisfactionTier,
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
      playerFeedback?.destroy?.();
      for (const visit of visits.values()) {
        visit.feedback.destroy();
        removeGuest(visit.character.id);
      }
      visits.clear();
    },
  });
}

function samePoint(a, b) {
  return a?.x === b?.x && a?.y === b?.y;
}

function isNearPoint(a, b, radius) {
  return Boolean(a && b) && Math.hypot(a.x - b.x, a.y - b.y) <= radius;
}

function candidateTargetsAround(target) {
  const candidates = [{ ...target }];
  for (let radius = 1; radius <= TARGET_SEARCH_RADIUS_CELLS; radius += 1) {
    for (let y = -radius; y <= radius; y += 1) {
      for (let x = -radius; x <= radius; x += 1) {
        if (Math.max(Math.abs(x), Math.abs(y)) !== radius) continue;
        candidates.push({ x: target.x + x * NAVIGATION_CELL_SIZE, y: target.y + y * NAVIGATION_CELL_SIZE });
      }
    }
  }
  return candidates;
}

function isExclusiveState(state) {
  return [
    GUEST_STATES.resolvingNeed,
    GUEST_STATES.eating,
    GUEST_STATES.drinking,
    GUEST_STATES.satisfaction,
    GUEST_STATES.paying,
    GUEST_STATES.leaving,
  ].includes(state);
}

function fullNeeds() {
  return { novelty: 100, energy: 100, satiety: 100, toilet: 100, lustre: 100, dialogue: 100 };
}

function emptyFeedback() {
  return { set() {}, setOrder() {}, setThought() {}, setProgress() {}, update() {}, destroy() {}, getState: () => null };
}
