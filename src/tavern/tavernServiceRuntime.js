import { getActorProfile } from "../character/actorProfiles.js";
import { createCharacter } from "../character/character.js";
import { getCharacterVisualProfile } from "../character/characterVisualProfiles.js";
import {
  householdAvailableCoins,
  householdIdForPerson,
  releaseHouseholdPurchase,
  reserveHouseholdPurchase,
  settleHouseholdPurchase,
  tavernHouseholdReservationId,
} from "../character/householdEconomyDomain.js";
import { createCoinRuntime } from "./coinRuntime.js";
import {
  consumeServingReservation,
  getServingTableStock,
  releaseServingReservation,
  reserveServingItem,
} from "./cookingDomain.js";
import { GUEST_CONFIG } from "./guestConfig.js";
import { createGuestController } from "./guestController.js";
import { createGuestFeedback } from "./guestFeedback.js";
import { throwDirectionTowardPoint, throwOriginFromPlayer } from "../inventory/worldThrowDirection.js";
import { createGuestRuntime } from "./guestRuntime.js";
import { evaluatePopulationPerson } from "../character/populationDomain.js";
import { isVenueOfferItemActive } from "./venueOfferDomain.js";
import { createVenueMenuRuntime } from "./venueMenuRuntime.js";
import {
  chooseServiceFormat,
  getSalePrice,
  SERVICE_FORMATS,
} from "./saleProfileDomain.js";
import {
  hasCapacityForVisitGroup,
  recordCompletedVisit,
  recordFailedAcceptedOrder,
} from "./tavernServiceDomain.js";
import {
  advanceTavernFeedbackTime,
  boostTavernFlowPressure,
  cloneTavernFeedbackState,
  recordAcceptedOrderFailureFeedback,
  recordCompletedVisitFeedback,
  recordOpenUnservedFeedback,
  sampleVisitOpportunityDelay,
  setTavernFlowPressure,
  visitFeedbackFactors,
} from "./tavernFeedbackDomain.js";
import { decideFoodVisit } from "./visitDemandDomain.js";
import {
  buildVisitCandidateWeights,
  describeVisitCandidate,
  selectRelatedVisitCandidates,
  selectVisitLead,
} from "./visitPartyDomain.js";

export function createTavernServiceRuntime(scene, {
  sessionState,
  worldLayout,
  facilityRuntime,
  characterSystem,
  createNpcMovementConfig,
  getPlayerPosition = () => null,
  getPlayerCharacter = () => null,
  isPlayerAvailable = () => false,
  getWorldTimeSeconds = () => sessionState?.gameplay?.worldTimeSeconds ?? 0,
  getSignPoint = () => GUEST_CONFIG.points.sign,
  localization,
  onPersistentMutation = () => {},
  onVenueMenuActiveChange = () => {},
  playEffect = () => {},
  syncSign = () => {},
  randomSource = Math.random,
} = {}) {
  const actorProfile = getActorProfile(GUEST_CONFIG.profileId);
  const visualProfile = getCharacterVisualProfile(GUEST_CONFIG.visualProfileId);
  const servicePlaceByGuest = new Map();
  const guestByServicePlace = new Map();
  const needFacilityByGuest = new Map();
  const guestByNeedFacility = new Map();
  let candidateRandomSource = randomSource;
  let decisionRandomSource = randomSource;
  let forcedCandidatePersonId = null;
  let lastDecision = null;
  let lastVisitGroup = null;

  const definitionsByType = (facilityType) => facilityRuntime?.getDefinitions?.()
    ?.filter((facility) => facility.facilityType === facilityType) ?? [];
  const serviceCapableDefinitions = () => facilityRuntime?.getDefinitions?.()
    ?.filter((facility) => facility.capabilities?.includes?.("guest-service")) ?? [];
  const servingTableIds = () => serviceCapableDefinitions().map(({ id }) => id);
  const getServicePoint = (servingTableId) => facilityRuntime?.getDefinition?.(servingTableId)?.usePosition
    ?? definitionsByType("serving-table")[0]?.usePosition
    ?? GUEST_CONFIG.points.insideDoor;
  const claimServicePlace = (guestId, itemId, preferredServingTableId = null) => {
    const existing = servicePlaceByGuest.get(guestId);
    if (existing && facilityRuntime?.getDefinition?.(existing)) return { servingTableId: existing };
    if (existing) {
      servicePlaceByGuest.delete(guestId);
      guestByServicePlace.delete(existing);
    }
    const candidates = servingTableIds()
      .filter((tableId) => !guestByServicePlace.has(tableId) || guestByServicePlace.get(tableId) === guestId);
    const preferred = candidates.includes(preferredServingTableId) ? preferredServingTableId : null;
    const exact = candidates.filter((tableId) => getServingTableStock(
      sessionState.gameplay.kitchen,
      tableId,
    ).itemId === itemId);
    const empty = candidates.filter((tableId) => !getServingTableStock(
      sessionState.gameplay.kitchen,
      tableId,
    ).itemId);
    const selected = preferred ?? exact[0] ?? empty[0] ?? candidates[0] ?? null;
    if (!selected) return null;
    servicePlaceByGuest.set(guestId, selected);
    guestByServicePlace.set(selected, guestId);
    return { servingTableId: selected };
  };
  const releaseServicePlace = (guestId, servingTableId = null) => {
    const tableId = servicePlaceByGuest.get(guestId) ?? servingTableId;
    if (!tableId || guestByServicePlace.get(tableId) !== guestId) return false;
    servicePlaceByGuest.delete(guestId);
    guestByServicePlace.delete(tableId);
    return true;
  };
  const claimVisitService = (guestId, itemId, {
    preferredServingTableId = null,
    preferTakeaway = false,
    requestedFormat = null,
  } = {}) => {
    const candidates = servingTableIds()
      .filter((tableId) => !guestByServicePlace.has(tableId) || guestByServicePlace.get(tableId) === guestId);
    const exactStockTableIds = candidates.filter((tableId) => {
      const stock = getServingTableStock(sessionState.gameplay.kitchen, tableId);
      return stock.itemId === itemId && stock.quantity > stock.reservations.length;
    });
    let serviceFormat = chooseServiceFormat(itemId, {
      hasSelfServiceStock: exactStockTableIds.length > 0,
      hasServicePlace: candidates.length > 0,
      preferTakeaway,
      requestedFormat,
    });
    if (!serviceFormat && requestedFormat && candidates.length > 0) {
      serviceFormat = chooseServiceFormat(itemId, {
        hasSelfServiceStock: exactStockTableIds.length > 0,
        hasServicePlace: true,
        preferTakeaway,
      });
    }
    if (serviceFormat === SERVICE_FORMATS.selfService) {
      for (const tableId of exactStockTableIds) {
        const reservation = reserveServingItem(sessionState.gameplay.kitchen, guestId, [tableId], itemId);
        if (!reservation) continue;
        const place = claimServicePlace(guestId, itemId, tableId);
        if (place) return { ...place, serviceFormat, reservation };
        releaseServingReservation(sessionState.gameplay.kitchen, guestId, tableId);
      }
      serviceFormat = chooseServiceFormat(itemId, {
        hasSelfServiceStock: false,
        hasServicePlace: candidates.length > 0,
        preferTakeaway,
      });
    }
    if (!serviceFormat) return null;
    const place = claimServicePlace(guestId, itemId, preferredServingTableId);
    return place ? { ...place, serviceFormat, reservation: null } : null;
  };
  const claimNeedFacility = (guestId, intent, preferredFacilityId = null) => {
    const existing = needFacilityByGuest.get(guestId);
    if (existing && facilityRuntime?.getDefinition?.(existing)) return { facilityId: existing };
    if (existing) {
      needFacilityByGuest.delete(guestId);
      guestByNeedFacility.delete(existing);
    }
    const types = intent === "toilet" ? ["toilet"] : intent === "wash" ? ["sink", "shower"] : [];
    const candidates = types.flatMap((type) => definitionsByType(type))
      .filter(({ id }) => !guestByNeedFacility.has(id));
    const selected = candidates.find(({ id }) => id === preferredFacilityId) ?? candidates[0] ?? null;
    if (!selected) return null;
    needFacilityByGuest.set(guestId, selected.id);
    guestByNeedFacility.set(selected.id, guestId);
    return { facilityId: selected.id };
  };
  const releaseNeedFacility = (guestId, facilityId = null) => {
    const id = needFacilityByGuest.get(guestId) ?? facilityId;
    if (!id || guestByNeedFacility.get(id) !== guestId) return false;
    needFacilityByGuest.delete(guestId);
    guestByNeedFacility.delete(id);
    return true;
  };
  const getNeedFacilityPoint = (facilityId) => facilityRuntime?.getDefinition?.(facilityId)?.usePosition ?? null;
  const coinRuntime = createCoinRuntime(scene, {
    getPlayerPosition,
    onCollect: ({ value }) => {
      sessionState.gameplay.coins += value;
      onPersistentMutation({ status: "coin-collected", mutated: true, value });
    },
  });
  const venueMenuRuntime = createVenueMenuRuntime(scene, {
    sessionState,
    localization,
    onActiveChange: onVenueMenuActiveChange,
    onPersistentMutation,
    playEffect,
    syncSign,
  });

  function runVisitOpportunity({
    personId = null,
    roll = null,
    rollsByPersonId = null,
    includeGroup = null,
  } = {}) {
    if (!sessionState.gameplay.tavernOpen) return { status: "menu-inactive", decision: null, guestId: null };
    const requestedPersonId = personId ?? forcedCandidatePersonId;
    forcedCandidatePersonId = null;
    const activePersonIds = guestRuntime.getActivePersonIds();
    const worldTimeSeconds = getWorldTimeSeconds();
    const selection = requestedPersonId
      ? forcedVisitLead(requestedPersonId, activePersonIds, worldTimeSeconds)
      : selectVisitLead(
        sessionState.gameplay.population,
        sessionState.gameplay.tavernFeedback,
        activePersonIds,
        worldTimeSeconds,
        candidateRandomSource,
      );
    const candidate = selection.person;
    if (!candidate) return { status: "no-candidate", decision: null, guestId: null };
    const primary = evaluateVisitParticipant(candidate, worldTimeSeconds, explicitRoll(
      candidate.id,
      rollsByPersonId,
      roll,
    ));
    const shouldBuildGroup = includeGroup === null ? requestedPersonId === null : Boolean(includeGroup);
    const relatedCandidates = primary.decision.decision === "VISIT" && shouldBuildGroup
      ? selectRelatedVisitCandidates(
        sessionState.gameplay.population,
        primary.evaluation.person,
        activePersonIds,
        worldTimeSeconds,
        candidateRandomSource,
      )
      : [];
    const evaluated = [primary];
    for (const person of relatedCandidates) {
      evaluated.push(evaluateVisitParticipant(
        person,
        worldTimeSeconds,
        explicitRoll(person.id, rollsByPersonId),
        plannedSpendForHousehold(person.id, evaluated),
      ));
    }
    const agreed = evaluated.filter(({ decision }) => decision.decision === "VISIT");
    const funded = [];
    for (const participant of agreed) {
      const reservation = reserveVisitFunds(participant.person.id, participant.decision.bestOfferPrice);
      if (reservation.reserved) funded.push(participant);
      else participant.decision = {
        ...participant.decision,
        decision: "NO_VISIT",
        reason: "no-household-funds",
      };
    }
    const capacityAvailable = funded.length > 0
      && hasCapacityForVisitGroup(activePersonIds.length, funded.length);
    const capacityFeedbacks = !capacityAvailable && funded.length > 0
      ? funded.map(({ person }) => recordOpenUnservedFeedback(sessionState.gameplay.tavernFeedback, {
        personId: person.id,
        worldTimeSeconds,
      }))
      : [];
    if (!capacityAvailable) releaseVisitFundsForParticipants(funded);
    const spawnedGuestIds = capacityAvailable
      ? guestRuntime.spawnVisitGroup(funded.map(({ person, decision }) => ({
        personId: person.id,
        orderItemId: decision.bestOfferItemId,
        acceptableItemIds: decision.acceptableItemIds,
        options: { offerFit: decision.bestOfferFit },
      })))
      : [];
    const guestIds = Array.isArray(spawnedGuestIds) ? spawnedGuestIds : [];
    if (capacityAvailable && guestIds.length !== funded.length) releaseVisitFundsForParticipants(funded);
    const guestIdByPersonId = Object.fromEntries(funded.map(({ person }, index) => [
      person.id,
      guestIds[index] ?? null,
    ]));
    const capacityFeedbackByPersonId = Object.fromEntries(capacityFeedbacks.map((feedback) => [
      feedback.personId,
      feedback,
    ]));
    const primaryCapacityOutcome = capacityFeedbackByPersonId[candidate.id] ?? null;
    const guestId = guestIdByPersonId[candidate.id] ?? null;
    lastDecision = {
      ...primary.decision,
      guestId: guestId || null,
      capacityOutcome: primaryCapacityOutcome?.outcome ?? null,
    };
    lastVisitGroup = {
      worldTimeSeconds,
      period: selection.selected.period,
      primaryCandidate: { ...selection.selected },
      candidateWeights: selection.candidateWeights.map((candidateWeight) => ({ ...candidateWeight })),
      relatedCandidatePersonIds: relatedCandidates.map(({ id }) => id),
      agreedPersonIds: funded.map(({ person }) => person.id),
      materializedPersonIds: funded.filter(({ person }) => guestIdByPersonId[person.id]).map(({ person }) => person.id),
      guestIds: [...guestIds],
      decisions: evaluated.map(({ person, decision, evaluation }) => ({
        personId: person.id,
        time: describeVisitCandidate(person, sessionState.gameplay.tavernFeedback, worldTimeSeconds),
        decision: { ...decision },
        guestId: guestIdByPersonId[person.id] ?? null,
        capacityOutcome: capacityFeedbackByPersonId[person.id]?.outcome ?? null,
        populationEvaluated: evaluation.mutated,
      })),
    };
    onPersistentMutation({
      status: "visit-opportunity-evaluated",
      mutated: Boolean(evaluated.some(({ evaluation }) => evaluation.mutated)
        || guestIds.length > 0 || capacityFeedbacks.length > 0),
      personId: candidate.id,
      personIds: evaluated.map(({ person }) => person.id),
      decision: lastDecision,
      visitGroup: lastVisitGroup,
      feedback: primaryCapacityOutcome,
      feedbacks: capacityFeedbacks,
    });
    const turnedAway = capacityFeedbacks.length > 0;
    return {
      status: turnedAway
        ? funded.length > 1 ? "group-turned-away-cap" : "visitor-turned-away-cap"
        : guestIds.length > 1 ? "group-visit-started" : guestId ? "visit-started" : "decision-complete",
      decision: { ...lastDecision },
      guestId: guestId || null,
      guestIds: [...guestIds],
      visitGroup: clone(lastVisitGroup),
      feedback: primaryCapacityOutcome,
      feedbacks: capacityFeedbacks.map((feedback) => ({ ...feedback })),
    };
  }

  function forcedVisitLead(personId, activePersonIds, worldTimeSeconds) {
    const person = sessionState.gameplay.population.find((candidate) => candidate.id === personId
      && !activePersonIds.includes(candidate.id)) ?? null;
    if (!person) return { person: null, selected: null, candidateWeights: [] };
    return {
      person,
      selected: describeVisitCandidate(person, sessionState.gameplay.tavernFeedback, worldTimeSeconds),
      candidateWeights: buildVisitCandidateWeights(
        sessionState.gameplay.population,
        sessionState.gameplay.tavernFeedback,
        activePersonIds,
        worldTimeSeconds,
      ).map(({ person: _person, ...candidateWeight }) => candidateWeight),
    };
  }

  function evaluateVisitParticipant(person, worldTimeSeconds, requestedRoll = null, plannedSpend = 0) {
    const evaluation = evaluatePopulationPerson(
      sessionState.gameplay.population,
      person.id,
      worldTimeSeconds,
    );
    const feedbackFactors = visitFeedbackFactors(
      sessionState.gameplay.tavernFeedback,
      person.id,
      worldTimeSeconds,
    );
    const decision = decideFoodVisit({
      person: evaluation.person,
      venueOffer: sessionState.gameplay.venueOffer,
      visitorHistory: sessionState.gameplay.tavernService.visitorHistoryByPersonId[person.id],
      ...feedbackFactors,
      householdAvailableCoins: Math.max(0,
        householdAvailableCoins(sessionState.gameplay.householdEconomy, person.id) - plannedSpend),
      worldTimeSeconds,
      randomSource: isFiniteRoll(requestedRoll) ? () => Number(requestedRoll) : decisionRandomSource,
    });
    return { person: evaluation.person, evaluation, decision };
  }

  function plannedSpendForHousehold(personId, evaluated) {
    const householdId = householdIdForPerson(sessionState.gameplay.householdEconomy, personId);
    if (!householdId) return 0;
    return evaluated.reduce((sum, participant) => {
      if (participant.decision.decision !== "VISIT") return sum;
      const participantHouseholdId = householdIdForPerson(
        sessionState.gameplay.householdEconomy,
        participant.person.id,
      );
      return participantHouseholdId === householdId
        ? sum + Math.max(0, Number(participant.decision.bestOfferPrice) || 0)
        : sum;
    }, 0);
  }

  function reserveVisitFunds(personId, amount) {
    return reserveHouseholdPurchase(sessionState.gameplay.householdEconomy, sessionState.gameplay.population, {
      personId,
      reservationId: tavernHouseholdReservationId(personId),
      amount,
    });
  }

  function releaseVisitFunds(personId) {
    return releaseHouseholdPurchase(
      sessionState.gameplay.householdEconomy,
      tavernHouseholdReservationId(personId),
    );
  }

  function releaseVisitFundsForParticipants(participants) {
    for (const participant of participants) releaseVisitFunds(participant.person.id);
  }

  function explicitRoll(personId, rollsByPersonId, primaryRoll = null) {
    const requested = rollsByPersonId && typeof rollsByPersonId === "object"
      ? rollsByPersonId[personId]
      : undefined;
    if (isFiniteRoll(requested)) return Number(requested);
    return isFiniteRoll(primaryRoll) ? Number(primaryRoll) : null;
  }

  function updateOpportunityScheduler(deltaMs) {
    const timeResult = advanceTavernFeedbackTime(sessionState.gameplay.tavernFeedback, {
      worldTimeSeconds: getWorldTimeSeconds(),
      tavernOpen: sessionState.gameplay.tavernOpen,
    });
    if (timeResult.flowDelta !== 0) {
      onPersistentMutation({ status: "tavern-closure-feedback", mutated: true, ...timeResult });
    }
    if (!sessionState.gameplay.tavernOpen) return;
    const serviceState = sessionState.gameplay.tavernService;
    serviceState.opportunityRemainingMs = Math.max(0, serviceState.opportunityRemainingMs - deltaMs);
    if (serviceState.opportunityRemainingMs > 0) return;
    serviceState.opportunityRemainingMs = sampleVisitOpportunityDelay(
      candidateRandomSource,
      sessionState.gameplay.tavernFeedback.flowPressure,
    );
    runVisitOpportunity();
  }

  const guestRuntime = createGuestRuntime({
    config: { ...GUEST_CONFIG, createController: createGuestController },
    serviceState: sessionState.gameplay.tavernService,
    worldLayout,
    createGuest: (controller, id, spawn) => {
      const character = createCharacter(scene, {
        id,
        spawn,
        controller,
        movementConfig: createNpcMovementConfig(actorProfile),
        actorProfile,
        visualProfile,
      });
      character.sprite.setTint?.(GUEST_CONFIG.tint);
      return characterSystem.add(character);
    },
    removeGuest: (id) => characterSystem.remove(id),
    getTavernOpen: () => sessionState.gameplay.tavernOpen,
    isOrderItemActive: (itemId) => isVenueOfferItemActive(sessionState.gameplay.venueOffer, itemId),
    getSignPoint,
    getServicePoint,
    claimServicePlace,
    claimVisitService,
    releaseServicePlace,
    claimNeedFacility,
    releaseNeedFacility,
    getNeedFacilityPoint,
    reserveExactItem: (guestId, servingTableId, itemId) => reserveServingItem(
      sessionState.gameplay.kitchen,
      guestId,
      [servingTableId],
      itemId,
    ),
    releaseReservation: (guestId, servingTableId) => releaseServingReservation(
      sessionState.gameplay.kitchen,
      guestId,
      servingTableId,
    ),
    consumeReservation: (guestId, servingTableId) => consumeServingReservation(
      sessionState.gameplay.kitchen,
      guestId,
      servingTableId,
    ),
    getPerson: (personId) => sessionState.gameplay.population.find((person) => person.id === personId) ?? null,
    getWorldTimeSeconds,
    getPlayerPosition,
    isPlayerAvailable,
    createPlayerFeedback: () => {
      const player = getPlayerCharacter();
      return player ? createGuestFeedback(scene, player) : null;
    },
    onLiveNeedsChange: onPersistentMutation,
    onReservationChange: () => {
      facilityRuntime?.syncKitchenVisuals?.();
      scene.interactionRuntime?.refresh?.();
      onPersistentMutation({ status: "reservation-changed", mutated: true });
    },
    onOrderChange: ({ guestId, personId, servingTableId, order }) => {
      scene.interactionRuntime?.refresh?.();
      onPersistentMutation({
        status: "guest-order-changed",
        mutated: true,
        guestId,
        personId,
        servingTableId,
        order,
      });
    },
    onOrderFailure: ({ guestId, personId, order }) => {
      releaseVisitFunds(personId);
      const history = recordFailedAcceptedOrder(
        sessionState.gameplay.tavernService,
        personId,
        getWorldTimeSeconds(),
      );
      const feedback = recordAcceptedOrderFailureFeedback(sessionState.gameplay.tavernFeedback, {
        personId,
        worldTimeSeconds: getWorldTimeSeconds(),
      });
      onPersistentMutation({
        status: "guest-order-failed",
        mutated: true,
        guestId,
        personId,
        order,
        history: history.history,
        feedback,
      });
    },
    onOpenUnserved: ({ guestId, personId, reason }) => {
      releaseVisitFunds(personId);
      const feedback = recordOpenUnservedFeedback(sessionState.gameplay.tavernFeedback, {
        personId,
        worldTimeSeconds: getWorldTimeSeconds(),
      });
      onPersistentMutation({
        status: "guest-open-unserved",
        mutated: true,
        guestId,
        personId,
        reason,
        feedback,
      });
    },
    onVisitFinished: ({ personId }) => {
      releaseVisitFunds(personId);
      scene.interactionRuntime?.refresh?.();
    },
    onPurchaseComplete: ({ position, value, itemId, personId, satisfactionTier }) => {
      const householdPayment = settleHouseholdPurchase(
        sessionState.gameplay.householdEconomy,
        tavernHouseholdReservationId(personId),
      );
      if (!householdPayment.settled) {
        onPersistentMutation({
          status: "guest-payment-missing-household-reservation",
          mutated: false,
          value,
          itemId,
          personId,
        });
        return;
      }
      facilityRuntime?.syncKitchenVisuals?.();
      scene.audioRuntime?.playEffect?.("coin-toss");
      coinRuntime.spawn(position, value);
      const history = recordCompletedVisit(
        sessionState.gameplay.tavernService,
        personId,
        getWorldTimeSeconds(),
      );
      const feedback = recordCompletedVisitFeedback(sessionState.gameplay.tavernFeedback, {
        personId,
        satisfactionTier,
        itemId,
        worldTimeSeconds: getWorldTimeSeconds(),
      });
      onPersistentMutation({
        status: "guest-purchase",
        mutated: true,
        value,
        itemId,
        personId,
        householdPayment,
        history: history.history,
        feedback,
      });
    },
    getSalePrice,
    getPersonDisplayName: (personId) => sessionState.gameplay.population
      .find((person) => person.id === personId)?.displayName ?? personId,
    getItemLabel: (itemId) => localization.t(itemId === "lemonade"
      ? "hud:venueMenu.lemonade"
      : "hud:venueMenu.friedPotatoDish"),
    getOrderPrompt: () => "hud:interaction.acceptGuestOrder",
    getTalkPrompt: () => "hud:interaction.talkGuest",
    createFeedback: (character) => createGuestFeedback(scene, character),
  });

  function spawnForcedVisit(person, itemId, acceptableItemIds, options) {
    if (!person || !itemId) return false;
    const reservation = reserveVisitFunds(person.id, getSalePrice(itemId));
    if (!reservation.reserved) return false;
    const guestId = guestRuntime.spawnVisit(person.id, itemId, acceptableItemIds, options);
    if (!guestId) releaseVisitFunds(person.id);
    return guestId;
  }

  function spawnForcedGroup(materializable) {
    const reservedPersonIds = [];
    for (const participant of materializable) {
      const reservation = reserveVisitFunds(participant.personId, getSalePrice(participant.orderItemId));
      if (!reservation.reserved) {
        for (const personId of reservedPersonIds) releaseVisitFunds(personId);
        return false;
      }
      reservedPersonIds.push(participant.personId);
    }
    const result = guestRuntime.spawnVisitGroup(materializable);
    if (!result) for (const personId of reservedPersonIds) releaseVisitFunds(personId);
    return result;
  }

  return {
    guestRuntime,
    coinRuntime,
    venueMenuRuntime,
    forceVisitOpportunity: (options) => runVisitOpportunity(options),
    forceGuestVisit(personId = null) {
      const active = guestRuntime.getActivePersonIds();
      const person = personId
        ? sessionState.gameplay.population.find((candidate) => candidate.id === personId && !active.includes(candidate.id))
        : sessionState.gameplay.population.find((candidate) => !active.includes(candidate.id));
      const itemId = sessionState.gameplay.venueOffer.foodItemIds[0] ?? null;
      return spawnForcedVisit(
        person,
        itemId,
        sessionState.gameplay.venueOffer.foodItemIds,
        { offerFit: 0.75, serviceFormat: SERVICE_FORMATS.assisted },
      );
    },
    forceGuestOrder(personId = null, itemId = null, { serviceFormat = SERVICE_FORMATS.assisted } = {}) {
      const active = guestRuntime.getActivePersonIds();
      const person = personId
        ? sessionState.gameplay.population.find((candidate) => candidate.id === personId && !active.includes(candidate.id))
        : sessionState.gameplay.population.find((candidate) => !active.includes(candidate.id));
      const exactItemId = itemId ?? sessionState.gameplay.venueOffer.foodItemIds[0] ?? null;
      return spawnForcedVisit(person, exactItemId, [exactItemId], {
        offerFit: 1,
        serviceFormat: serviceFormat === "auto" ? null : serviceFormat,
      });
    },
    forceGuestGroup(participants = []) {
      const active = new Set(guestRuntime.getActivePersonIds());
      const requested = Array.isArray(participants) ? participants : [];
      const materializable = requested.map((participant) => {
        const person = sessionState.gameplay.population.find((candidate) => (
          candidate.id === participant?.personId && !active.has(candidate.id)
        ));
        if (!person) return null;
        return {
          personId: person.id,
          orderItemId: participant.itemId,
          acceptableItemIds: [participant.itemId],
          options: {
            offerFit: 1,
            serviceFormat: participant.serviceFormat === "auto" ? null : participant.serviceFormat,
          },
        };
      });
      return materializable.every(Boolean) ? spawnForcedGroup(materializable) : false;
    },
    getOrderInteractionDefinitions: () => guestRuntime.getInteractionDefinitions(),
    getGuestInteractionDefinitions: () => guestRuntime.getInteractionDefinitions(),
    handleGuestInteraction: (candidate) => guestRuntime.handleGuestInteraction(candidate),
    acceptGuestOrder: (guestId) => guestRuntime.acceptGuestOrder(guestId),
    setGuestOrderElapsedMs: (guestId, value) => guestRuntime.setOrderElapsedMs(guestId, value),
    setForcedCandidatePersonId(personId) {
      forcedCandidatePersonId = typeof personId === "string" ? personId : null;
      return forcedCandidatePersonId;
    },
    setDemandRandomSource(next) {
      if (typeof next !== "function") return false;
      candidateRandomSource = next;
      decisionRandomSource = next;
      return true;
    },
    setDecisionRandomSource(next) {
      if (typeof next !== "function") return false;
      decisionRandomSource = next;
      return true;
    },
    getLastDecision: () => lastDecision ? { ...lastDecision, acceptableItemIds: [...lastDecision.acceptableItemIds] } : null,
    getLastVisitGroup: () => clone(lastVisitGroup),
    getVisitorHistory: () => JSON.parse(JSON.stringify(sessionState.gameplay.tavernService.visitorHistoryByPersonId)),
    getFeedbackState: () => cloneTavernFeedbackState(sessionState.gameplay.tavernFeedback),
    getHouseholdEconomy: () => clone(sessionState.gameplay.householdEconomy),
    setFlowPressure(value) {
      const result = setTavernFlowPressure(sessionState.gameplay.tavernFeedback, value);
      if (result.mutated) onPersistentMutation({ status: "tavern-flow-set", ...result });
      return result;
    },
    boostFlowPressure(amount) {
      const result = boostTavernFlowPressure(sessionState.gameplay.tavernFeedback, amount);
      if (result.mutated) onPersistentMutation({ status: "tavern-flow-boosted", ...result });
      return result;
    },
    dropWalletCoin({ position, playerSprite, facing, pointerWorld } = {}) {
      if (!position || sessionState.gameplay.coins < 1) {
        return { status: "wallet-empty", mutated: false };
      }
      sessionState.gameplay.coins -= 1;
      const origin = throwOriginFromPlayer(playerSprite ?? position);
      const direction = throwDirectionTowardPoint(origin, pointerWorld, facing);
      const coinId = coinRuntime.spawn(origin, 1, { direction, throwStart: origin });
      scene.audioRuntime?.playEffect?.("coin-toss");
      onPersistentMutation({
        status: "wallet-coin-dropped",
        mutated: true,
        value: 1,
        coinId,
        direction,
        origin,
      });
      return { status: "wallet-coin-dropped", mutated: true, value: 1, coinId, direction, origin };
    },
    update(deltaMs) {
      updateOpportunityScheduler(Math.max(0, Number(deltaMs) || 0));
      guestRuntime.update(deltaMs);
      coinRuntime.update(deltaMs);
    },
    getState: () => ({
      guests: guestRuntime.getState(),
      coins: coinRuntime.getState(),
      servicePlaces: Object.fromEntries(servicePlaceByGuest),
      needFacilities: Object.fromEntries(needFacilityByGuest),
      demand: {
        opportunityRemainingMs: sessionState.gameplay.tavernService.opportunityRemainingMs,
        flowPressure: sessionState.gameplay.tavernFeedback.flowPressure,
        lastDecision: lastDecision ? { ...lastDecision } : null,
      },
      feedback: cloneTavernFeedbackState(sessionState.gameplay.tavernFeedback),
    }),
    destroy() {
      venueMenuRuntime.destroy();
      guestRuntime.destroy();
      coinRuntime.destroy();
    },
  };
}

function clone(value) {
  return value === null || value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function isFiniteRoll(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}
