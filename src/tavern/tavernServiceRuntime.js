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
  sampleVisitOpportunityDelay,
} from "./tavernServiceDomain.js";
import { decideFoodVisit, selectVisitCandidate } from "./visitDemandDomain.js";

export function createTavernServiceRuntime(scene, {
  sessionState,
  worldLayout,
  facilityRuntime,
  characterSystem,
  createNpcMovementConfig,
  getPlayerPosition = () => null,
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
  const diningTableByGuest = new Map();
  const guestByDiningTable = new Map();
  let candidateRandomSource = randomSource;
  let decisionRandomSource = randomSource;
  let forcedCandidatePersonId = null;
  let lastDecision = null;

  const definitionsByType = (facilityType) => facilityRuntime?.getDefinitions?.()
    ?.filter((facility) => facility.facilityType === facilityType) ?? [];
  const servingTableIds = () => definitionsByType("serving-table").map(({ id }) => id);
  const offeredServingTableIds = (acceptableItemIds = null) => servingTableIds().filter((servingTableId) => {
    const itemId = getServingTableStock(sessionState.gameplay.kitchen, servingTableId).itemId;
    return isVenueOfferItemActive(sessionState.gameplay.venueOffer, itemId)
      && (!acceptableItemIds || acceptableItemIds.includes(itemId));
  });
  const getServicePoint = (servingTableId) => facilityRuntime?.getDefinition?.(servingTableId)?.usePosition
    ?? definitionsByType("serving-table")[0]?.usePosition
    ?? GUEST_CONFIG.points.insideDoor;
  const getSeatPoint = (diningTableId) => facilityRuntime?.getDefinition?.(diningTableId)?.usePosition ?? null;
  const reserveSeat = (guestId, preferredDiningTableId = null) => {
    const existing = diningTableByGuest.get(guestId);
    if (existing && getSeatPoint(existing)) return { diningTableId: existing };
    if (existing) {
      diningTableByGuest.delete(guestId);
      guestByDiningTable.delete(existing);
    }
    const activeId = facilityRuntime?.getActiveId?.() ?? null;
    const candidates = definitionsByType("table");
    const preferred = candidates.find(({ id }) => id === preferredDiningTableId);
    const selected = [preferred, ...candidates].find((facility, index, values) => facility
      && values.findIndex((candidate) => candidate?.id === facility.id) === index
      && facility.id !== activeId
      && !guestByDiningTable.has(facility.id));
    if (!selected) return null;
    diningTableByGuest.set(guestId, selected.id);
    guestByDiningTable.set(selected.id, guestId);
    return { diningTableId: selected.id };
  };
  const releaseSeat = (guestId, diningTableId = null) => {
    const tableId = diningTableByGuest.get(guestId) ?? diningTableId;
    if (!tableId || guestByDiningTable.get(tableId) !== guestId) return false;
    diningTableByGuest.delete(guestId);
    guestByDiningTable.delete(tableId);
    return true;
  };
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
    if (guestRuntime.getActivePersonIds().length >= GUEST_ACTIVE_CAP) {
      return { status: "guest-cap-reached", decision: null, guestId: null };
    }
    const requestedPersonId = personId ?? forcedCandidatePersonId;
    forcedCandidatePersonId = null;
    const activePersonIds = guestRuntime.getActivePersonIds();
    const candidate = requestedPersonId
      ? sessionState.gameplay.population.find((person) => person.id === requestedPersonId
        && !activePersonIds.includes(person.id)) ?? null
      : selectVisitCandidate(sessionState.gameplay.population, activePersonIds, candidateRandomSource);
    if (!candidate) return { status: "no-candidate", decision: null, guestId: null };
    const evaluation = evaluatePopulationPerson(
      sessionState.gameplay.population,
      candidate.id,
      getWorldTimeSeconds(),
    );
    const decision = decideFoodVisit({
      person: evaluation.person,
      venueOffer: sessionState.gameplay.venueOffer,
      visitorHistory: sessionState.gameplay.tavernService.visitorHistoryByPersonId[candidate.id],
      worldTimeSeconds: getWorldTimeSeconds(),
      randomSource: Number.isFinite(Number(roll)) ? () => Number(roll) : decisionRandomSource,
    });
    const guestId = decision.decision === "VISIT"
      ? guestRuntime.spawnVisit(candidate.id, decision.acceptableItemIds)
      : null;
    lastDecision = { ...decision, guestId: guestId || null };
    onPersistentMutation({
      status: "visit-opportunity-evaluated",
      mutated: Boolean(evaluation.mutated || guestId),
      personId: candidate.id,
      decision: lastDecision,
    });
    return { status: guestId ? "visit-started" : "decision-complete", decision: { ...lastDecision }, guestId: guestId || null };
  }

  function updateOpportunityScheduler(deltaMs) {
    if (!sessionState.gameplay.tavernOpen) return;
    const serviceState = sessionState.gameplay.tavernService;
    serviceState.opportunityRemainingMs = Math.max(0, serviceState.opportunityRemainingMs - deltaMs);
    if (serviceState.opportunityRemainingMs > 0) return;
    serviceState.opportunityRemainingMs = sampleVisitOpportunityDelay(candidateRandomSource);
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
    getSignPoint,
    getServicePoint,
    getSeatPoint,
    reserveSeat,
    releaseSeat,
    reserveItem: (guestId, { excludedServingTableIds = [], acceptableItemIds = [] } = {}) => reserveServingItem(
      sessionState.gameplay.kitchen,
      guestId,
      offeredServingTableIds(acceptableItemIds).filter((tableId) => !excludedServingTableIds.includes(tableId)),
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
    onReservationChange: () => {
      facilityRuntime?.syncKitchenVisuals?.();
      scene.interactionRuntime?.refresh?.();
      onPersistentMutation({ status: "reservation-changed", mutated: true });
    },
    onPurchaseComplete: ({ position, value, itemId, personId }) => {
      facilityRuntime?.syncKitchenVisuals?.();
      scene.audioRuntime?.playEffect?.("coin-toss");
      coinRuntime.spawn(position, value);
      const history = recordCompletedVisit(
        sessionState.gameplay.tavernService,
        personId,
        getWorldTimeSeconds(),
      );
      onPersistentMutation({ status: "guest-purchase", mutated: true, value, itemId, personId, history: history.history });
    },
    getSalePrice,
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
      return person ? guestRuntime.spawnVisit(person.id, sessionState.gameplay.venueOffer.foodItemIds) : false;
    },
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
      diningReservations: Object.fromEntries(diningTableByGuest),
      demand: {
        opportunityRemainingMs: sessionState.gameplay.tavernService.opportunityRemainingMs,
        lastDecision: lastDecision ? { ...lastDecision } : null,
      },
    }),
    destroy() {
      venueMenuRuntime.destroy();
      guestRuntime.destroy();
      coinRuntime.destroy();
    },
  };
}
