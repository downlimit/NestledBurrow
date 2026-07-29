import { getActorProfile } from "./actorProfiles.js";
import { createCharacter } from "./character.js";
import { getCharacterVisualProfile } from "./characterVisualProfiles.js";
import { createCoinRuntime } from "./coinRuntime.js";
import {
  consumeServingReservation,
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
    getServicePoint: () => facilityRuntime?.getDefinitionByType?.("serving-table")?.usePosition
      ?? GUEST_CONFIG.points.insideDoor,
    getSeatPoint: () => facilityRuntime?.getDefinitionByType?.("table")?.usePosition
      ?? facilityRuntime?.getDefinitionByType?.("serving-table")?.usePosition
      ?? GUEST_CONFIG.points.insideDoor,
    getAvailablePortions: () => {
      const stock = sessionState.gameplay.kitchen.servingTable;
      return Math.max(0, stock.quantity - stock.reservations.length);
    },
    reserveItem: (guestId) => reserveServingItem(sessionState.gameplay.kitchen, guestId),
    releaseReservation: (guestId) => releaseServingReservation(sessionState.gameplay.kitchen, guestId),
    consumeReservation: (guestId) => consumeServingReservation(sessionState.gameplay.kitchen, guestId),
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
    }),
    destroy() {
      guestRuntime.destroy();
      coinRuntime.destroy();
    },
  };
}
