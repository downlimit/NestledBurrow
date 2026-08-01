import { getActorProfile } from "./actorProfiles.js";
import { createCharacter } from "./character.js";
import { getCharacterVisualProfile } from "./characterVisualProfiles.js";
import { createCoinRuntime } from "./coinRuntime.js";
import {
  consumeServingReservation,
  getAvailableServingPortions,
  releaseServingReservation,
  reserveServingItem,
} from "./cookingDomain.js";
import { GUEST_CONFIG } from "./guestConfig.js";
import { createGuestController } from "./guestController.js";
import { createGuestFeedback } from "./guestFeedback.js";
import { throwDirectionTowardPoint, throwOriginFromPlayer } from "./worldThrowDirection.js";
import { createGuestRuntime } from "./guestRuntime.js";

export function createTavernServiceRuntime(scene, {
  sessionState,
  worldLayout,
  facilityRuntime,
  characterSystem,
  createNpcMovementConfig,
  getPlayerPosition = () => null,
  onPersistentMutation = () => {},
  randomSource = Math.random,
} = {}) {
  const actorProfile = getActorProfile(GUEST_CONFIG.profileId);
  const visualProfile = getCharacterVisualProfile(GUEST_CONFIG.visualProfileId);
  const diningTableByGuest = new Map();
  const guestByDiningTable = new Map();

  const definitionsByType = (facilityType) => facilityRuntime?.getDefinitions?.()
    ?.filter((facility) => facility.facilityType === facilityType) ?? [];
  const servingTableIds = () => definitionsByType("serving-table").map(({ id }) => id);
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
    getServicePoint,
    getSeatPoint,
    reserveSeat,
    releaseSeat,
    getAvailablePortions: () => getAvailableServingPortions(sessionState.gameplay.kitchen, servingTableIds()),
    reserveItem: (guestId, { excludedServingTableIds = [] } = {}) => reserveServingItem(
      sessionState.gameplay.kitchen,
      guestId,
      servingTableIds().filter((tableId) => !excludedServingTableIds.includes(tableId)),
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
    onPurchaseComplete: ({ position, value, itemId }) => {
      facilityRuntime?.syncKitchenVisuals?.();
      scene.audioRuntime?.playEffect?.("coin-toss");
      coinRuntime.spawn(position, value);
      onPersistentMutation({ status: "guest-purchase", mutated: true, value, itemId });
    },
    randomSource,
    createFeedback: (character) => createGuestFeedback(scene, character),
  });

  return {
    guestRuntime,
    coinRuntime,
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
      guestRuntime.update(deltaMs);
      coinRuntime.update(deltaMs);
    },
    getState: () => ({
      guests: guestRuntime.getState(),
      coins: coinRuntime.getState(),
      diningReservations: Object.fromEntries(diningTableByGuest),
    }),
    destroy() {
      guestRuntime.destroy();
      coinRuntime.destroy();
    },
  };
}
