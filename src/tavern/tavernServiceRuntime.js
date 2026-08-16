import { getActorProfile } from "../character/actorProfiles.js";
import { createCharacter } from "../character/character.js";
import { getCharacterVisualProfile } from "../character/characterVisualProfiles.js";
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
import { getSalePrice } from "./saleProfileDomain.js";
import {
  GUEST_ACTIVE_CAP,
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
  selectReputationBiasedCandidate,
  setTavernFlowPressure,
  visitFeedbackFactors,
} from "./tavernFeedbackDomain.js";
import { decideFoodVisit } from "./visitDemandDomain.js";

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

  function runVisitOpportunity({ personId = null, roll = null } = {}) {
    if (!sessionState.gameplay.tavernOpen) return { status: "menu-inactive", decision: null, guestId: null };
    const requestedPersonId = personId ?? forcedCandidatePersonId;
    forcedCandidatePersonId = null;
    const activePersonIds = guestRuntime.getActivePersonIds();
    const candidate = requestedPersonId
      ? sessionState.gameplay.population.find((person) => person.id === requestedPersonId
        && !activePersonIds.includes(person.id)) ?? null
      : selectReputationBiasedCandidate(
        sessionState.gameplay.population,
        sessionState.gameplay.tavernFeedback,
        activePersonIds,
        candidateRandomSource,
      );
    if (!candidate) return { status: "no-candidate", decision: null, guestId: null };
    const evaluation = evaluatePopulationPerson(
      sessionState.gameplay.population,
      candidate.id,
      getWorldTimeSeconds(),
    );
    const feedbackFactors = visitFeedbackFactors(
      sessionState.gameplay.tavernFeedback,
      candidate.id,
      getWorldTimeSeconds(),
    );
    const decision = decideFoodVisit({
      person: evaluation.person,
      venueOffer: sessionState.gameplay.venueOffer,
      visitorHistory: sessionState.gameplay.tavernService.visitorHistoryByPersonId[candidate.id],
      ...feedbackFactors,
      worldTimeSeconds: getWorldTimeSeconds(),
      randomSource: Number.isFinite(Number(roll)) ? () => Number(roll) : decisionRandomSource,
    });
    let guestId = null;
    let capacityOutcome = null;
    if (decision.decision === "VISIT" && activePersonIds.length >= GUEST_ACTIVE_CAP) {
      capacityOutcome = recordOpenUnservedFeedback(sessionState.gameplay.tavernFeedback, {
        personId: candidate.id,
        worldTimeSeconds: getWorldTimeSeconds(),
      });
    } else if (decision.decision === "VISIT") {
      guestId = guestRuntime.spawnVisit(
        candidate.id,
        decision.bestOfferItemId,
        decision.acceptableItemIds,
        { offerFit: decision.bestOfferFit },
      );
    }
    lastDecision = {
      ...decision,
      guestId: guestId || null,
      capacityOutcome: capacityOutcome?.outcome ?? null,
    };
    onPersistentMutation({
      status: "visit-opportunity-evaluated",
      mutated: Boolean(evaluation.mutated || guestId || capacityOutcome),
      personId: candidate.id,
      decision: lastDecision,
      feedback: capacityOutcome,
    });
    return {
      status: capacityOutcome ? "visitor-turned-away-cap" : guestId ? "visit-started" : "decision-complete",
      decision: { ...lastDecision },
      guestId: guestId || null,
      feedback: capacityOutcome,
    };
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
    onVisitFinished: () => scene.interactionRuntime?.refresh?.(),
    onPurchaseComplete: ({ position, value, itemId, personId, satisfactionTier }) => {
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
      return person ? guestRuntime.spawnVisit(
        person.id,
        itemId,
        sessionState.gameplay.venueOffer.foodItemIds,
        { offerFit: 0.75 },
      ) : false;
    },
    forceGuestOrder(personId = null, itemId = null) {
      const active = guestRuntime.getActivePersonIds();
      const person = personId
        ? sessionState.gameplay.population.find((candidate) => candidate.id === personId && !active.includes(candidate.id))
        : sessionState.gameplay.population.find((candidate) => !active.includes(candidate.id));
      const exactItemId = itemId ?? sessionState.gameplay.venueOffer.foodItemIds[0] ?? null;
      return person ? guestRuntime.spawnVisit(person.id, exactItemId, [exactItemId], { offerFit: 1 }) : false;
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
    getVisitorHistory: () => JSON.parse(JSON.stringify(sessionState.gameplay.tavernService.visitorHistoryByPersonId)),
    getFeedbackState: () => cloneTavernFeedbackState(sessionState.gameplay.tavernFeedback),
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
