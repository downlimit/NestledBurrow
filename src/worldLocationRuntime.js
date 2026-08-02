import { createDebugMovementConfigFromPolicy, getActorProfile } from "./actorProfiles.js";
import { createCharacter } from "./character.js";
import { createRuntimeMovementConfig } from "./characterMovement.js";
import { getCharacterVisualProfile } from "./characterVisualProfiles.js";
import { createIdleController, createPatrolController } from "./controllers.js";
import { createCookingRuntime } from "./cookingRuntime.js";
import { createDebrisRuntime } from "./debrisRuntime.js";
import { createFacilityRuntime } from "./facilityRuntime.js";
import { createFarmingRuntime } from "./farmingRuntime.js";
import { applyGameplayTuning, refillEnergy, resetBalanceRun } from "./gameSessionState.js";
import { formatClock } from "./gameClock.js";
import { GUEST_CONFIG } from "./guestConfig.js";
import { addInventoryItem, createInventoryItem } from "./inventoryDomain.js";
import { createKitchenInteractionRuntime } from "./kitchenInteractionRuntime.js";
import { createMeleeRuntime } from "./meleeRuntime.js";
import { createMerchantRuntime } from "./merchantRuntime.js";
import { getFootBox } from "./movement.js";
import { MovementDebugPanel } from "./movementDebugPanel.js";
import { createNeedsInteractionCoordinator } from "./needsInteractionCoordinator.js";
import { needMeterValues } from "./needsFlowRuntime.js";
import { NPCS } from "./npcConfig.js";
import { getResourceProfile } from "./resourceDomain.js";
import { RESOURCE_OBJECTS } from "./resourceConfig.js";
import { createTavernServiceRuntime } from "./tavernServiceRuntime.js";
import { createTavernSignRuntime } from "./tavernSignRuntime.js";
import { createWorldBuildCoordinator } from "./worldBuildCoordinator.js";

const EMPTY_OWNERS = Object.freeze(createEmptyOwners());

const DEFAULT_FACTORIES = Object.freeze({
  character: createCharacter,
  merchant: createMerchantRuntime,
  debris: createDebrisRuntime,
  melee: createMeleeRuntime,
  facility: createFacilityRuntime,
  needsInteraction: createNeedsInteractionCoordinator,
  tavernSign: createTavernSignRuntime,
  tavernService: createTavernServiceRuntime,
  farming: createFarmingRuntime,
  cooking: createCookingRuntime,
  kitchenInteraction: createKitchenInteractionRuntime,
  movementDebugPanel: (options) => new MovementDebugPanel(options),
  worldBuildCoordinator: createWorldBuildCoordinator,
});

export function createWorldLocationRuntime(options) {
  return new WorldLocationRuntime(options);
}

export class WorldLocationRuntime {
  constructor({
    renderingHost,
    inputHost,
    sessionState,
    localization,
    presentationRuntime,
    characterSystem,
    movementConfig,
    movementDebugEnabled = false,
    gameplayTuning,
    globalOwners = {},
    callbacks = {},
    authoring = {},
    factories = {},
  } = {}) {
    if (!renderingHost || !sessionState || !presentationRuntime || !characterSystem) {
      throw new Error("WorldLocationRuntime requires rendering host, session state, presentation runtime and character system");
    }
    this.renderingHost = renderingHost;
    this.inputHost = inputHost;
    this.sessionState = sessionState;
    this.localization = localization;
    this.presentationRuntime = presentationRuntime;
    this.characterSystem = characterSystem;
    this.movementConfig = movementConfig;
    this.movementDebugEnabled = movementDebugEnabled;
    this.gameplayTuning = gameplayTuning;
    this.globalOwners = globalOwners;
    this.callbacks = callbacks;
    this.authoring = authoring;
    this.factories = { ...DEFAULT_FACTORIES, ...factories };
    this.owners = createEmptyOwners();
    this.ownerSnapshot = EMPTY_OWNERS;
    this.npcMovementConfigs = [];
    this.authoringListeners = null;
    this.unregisterMerchantVisibility = null;
    this.activeDefinition = null;
    this.activeLayout = null;
    this.destroyed = false;
  }

  mount({ definition, layout } = {}) {
    if (this.destroyed) throw new Error("WorldLocationRuntime is destroyed");
    if (!definition || !layout) throw new Error("WorldLocationRuntime.mount requires definition and layout");
    const capabilities = validateLocationCapabilities(definition.capabilities);
    if (this.activeDefinition) this.unmount();
    this.activeDefinition = definition;
    this.activeLayout = layout;
    this.presentationRuntime.mount(layout);
    try {
      if (capabilities.npcs) {
        this.mountNpcCharacters();
        this.mountMerchant();
      }
      this.mountDebris(capabilities.homeSystems);
      if (capabilities.meleeWeapons) this.mountMelee(capabilities.trainingDummy);
      if (capabilities.facilities) this.mountFacilities();
      if (capabilities.tavernService) this.mountTavern();
      if (capabilities.farming) this.mountFarming();
      if (capabilities.cooking) this.mountCooking();
      if (capabilities.buildMode) {
        this.mountMovementDebugPanel();
        this.mountBuildCoordinator();
      }
      this.updateOwnerSnapshot();
      this.globalOwners.worldInteractionCoordinator?.rebindLocationOwners?.(this.interactionOwners());
      this.globalOwners.interactionRuntime?.resetCandidate?.();
      this.callbacks.syncGameplayHudVisibility?.();
      return this.ownerSnapshot;
    } catch (error) {
      this.unmount();
      throw error;
    }
  }

  unmount() {
    if (!this.activeDefinition) return;
    this.globalOwners.interactionRuntime?.resetCandidate?.();
    this.globalOwners.worldInteractionCoordinator?.unbindLocationOwners?.();
    this.owners.worldBuildCoordinator?.destroy?.();
    this.owners.worldBuildCoordinator = null;
    this.owners.buildModeRuntime = null;
    this.unmountAuthoringInput();
    this.owners.movementDebugPanel?.destroy?.();
    this.owners.movementDebugPanel = null;
    this.owners.cookingRuntime?.destroy?.();
    this.owners.cookingRuntime = null;
    this.owners.kitchenInteractionRuntime = null;
    this.owners.farmingRuntime?.destroy?.();
    this.owners.farmingRuntime = null;
    this.owners.tavernServiceRuntime?.destroy?.();
    this.owners.tavernServiceRuntime = null;
    this.owners.guestRuntime = null;
    this.owners.coinRuntime = null;
    this.owners.tavernSignRuntime?.destroy?.();
    this.owners.tavernSignRuntime = null;
    this.owners.needsInteractionCoordinator = null;
    this.owners.facilityRuntime?.destroy?.();
    this.owners.facilityRuntime = null;
    this.owners.meleeRuntime?.destroy?.();
    this.owners.meleeRuntime = null;
    this.owners.debrisRuntime?.destroy?.();
    this.owners.debrisRuntime = null;
    this.unregisterMerchantVisibility?.();
    this.unregisterMerchantVisibility = null;
    this.owners.merchantRuntime?.destroy?.();
    this.owners.merchantRuntime = null;
    this.unmountNpcCharacters();
    this.presentationRuntime.unmount();
    this.activeDefinition = null;
    this.activeLayout = null;
    this.updateOwnerSnapshot();
  }

  handleFrameActions(actions) {
    this.owners.meleeRuntime?.handleActions?.(actions);
  }

  updateRealTime(deltaMs) {
    this.owners.needsInteractionCoordinator?.update?.(deltaMs);
    this.callbacks.updateGameplayTime?.(deltaMs);
    this.owners.cookingRuntime?.update?.(deltaMs);
  }

  runWorldStep(deltaMs, updateCharacters) {
    this.owners.tavernServiceRuntime?.update?.(deltaMs);
    this.owners.meleeRuntime?.beforeCharacterUpdate?.(deltaMs);
    updateCharacters?.(deltaMs);
    this.owners.meleeRuntime?.afterCharacterUpdate?.(deltaMs);
  }

  updateCandidate(candidate) {
    this.owners.merchantRuntime?.updateCandidate?.(candidate);
    this.owners.debrisRuntime?.updateCandidate?.(candidate);
    this.owners.farmingRuntime?.updateCandidate?.(candidate);
    this.owners.movementDebugPanel?.updateStatus?.();
  }

  canTransition() {
    return !Boolean(
      this.callbacks.isSleeping?.()
      || this.callbacks.isOptionsOpen?.()
      || this.callbacks.isConfirmationActive?.()
      || this.owners.buildModeRuntime?.isActive?.()
      || this.owners.facilityRuntime?.isUsing?.()
      || this.owners.cookingRuntime?.isActive?.()
      || this.globalOwners.interactionRuntime?.isDialogueActive?.()
      || this.owners.merchantRuntime?.isActive?.()
    );
  }

  getOwners() {
    return this.ownerSnapshot;
  }

  destroy() {
    if (this.destroyed) return;
    this.unmount();
    this.destroyed = true;
    this.renderingHost = null;
    this.inputHost = null;
    this.characterSystem = null;
    this.globalOwners = {};
    this.callbacks = {};
    this.authoring = {};
  }

  mountNpcCharacters() {
    this.npcMovementConfigs = [];
    for (const npc of NPCS) {
      if (this.characterSystem.has(npc.id)) continue;
      const actorProfile = getActorProfile(npc.profileId);
      const visualProfile = getCharacterVisualProfile(npc.visualProfileId);
      const character = this.factories.character(this.renderingHost, {
        id: npc.id,
        spawn: npc.spawn,
        controller: npc.patrol
          ? createPatrolController({
            ...npc.patrol,
            isPaused: () => this.globalOwners.interactionRuntime?.isEntityInActiveDialogue?.(npc.id) ?? false,
          })
          : createIdleController(),
        movementConfig: this.createNpcMovementConfig(actorProfile),
        actorProfile,
        visualProfile,
      });
      this.characterSystem.add(character);
    }
  }

  unmountNpcCharacters() {
    for (const npc of NPCS) this.characterSystem?.remove?.(npc.id);
    this.npcMovementConfigs = [];
  }

  createNpcMovementConfig(profile) {
    if (!this.movementDebugEnabled) return createRuntimeMovementConfig(profile.movement, profile.movement);
    const config = createRuntimeMovementConfig(
      createDebugMovementConfigFromPolicy(profile, this.movementConfig),
      profile.movement,
    );
    this.npcMovementConfigs.push({ profileId: profile.id, movementConfig: config });
    return config;
  }

  syncNpcMovementConfig() {
    for (const npcConfig of this.npcMovementConfigs) {
      const profile = getActorProfile(npcConfig.profileId);
      Object.assign(
        npcConfig.movementConfig,
        createRuntimeMovementConfig(
          createDebugMovementConfigFromPolicy(profile, this.movementConfig),
          profile.movement,
        ),
      );
    }
  }

  mountMerchant() {
    this.owners.merchantRuntime = this.factories.merchant(this.renderingHost, {
      sessionState: this.sessionState,
      localization: this.localization,
      onActiveChange: () => this.callbacks.syncGameplayHudVisibility?.(),
      playEffect: (type) => this.globalOwners.audioRuntime?.playEffect?.(type),
      onInventoryGain: (result) => this.globalOwners.gameHud?.notifyInventoryGain?.(result),
      onPersistentMutation: () => {
        this.globalOwners.gameHud?.render?.();
        this.callbacks.saveSession?.();
      },
    });
    this.unregisterMerchantVisibility = this.globalOwners.uiVisibilityCoordinator?.register?.(
      this.owners.merchantRuntime,
      ["gameplay-overlay", "option-sensitive"],
    );
  }

  mountDebris(includeBed) {
    this.owners.debrisRuntime = this.factories.debris(this.renderingHost, {
      sessionState: this.sessionState,
      worldLayout: this.activeLayout,
      resourceDefinitions: this.activeLayout.resourceDefinitions,
      includeBed,
      getSelectedItem: () => this.globalOwners.gameHud?.getSelectedInventoryItem?.() ?? null,
      getGameplayTuning: () => this.gameplayTuning,
      onPersistentMutation: (result) => {
        this.globalOwners.gameHud?.render?.();
        if (result.inventory?.mutated) this.globalOwners.gameHud?.notifyInventoryGain?.(result.inventory);
        this.globalOwners.interactionRuntime?.refresh?.();
        this.callbacks.saveSession?.();
      },
    });
  }

  mountMelee(includeTrainingDummy) {
    this.owners.meleeRuntime = this.factories.melee(this.renderingHost, {
      worldLayout: this.activeLayout,
      includeTrainingDummy,
      getPlayerCharacter: () => this.callbacks.getPlayerCharacter?.(),
      getSelectedItem: () => this.callbacks.getFrameMeleeItem?.(),
      getControllerMoveDirection: () => this.callbacks.getControllerMoveDirection?.(),
      playEffect: (type) => this.globalOwners.audioRuntime?.playEffect?.(type),
      damageLog: (resourceId, multiplier) => this.owners.debrisRuntime?.damageLog?.(resourceId, multiplier),
      canPerformPhysicalAction: (weaponId) => this.globalOwners.needsRuntime?.canPerformPhysicalAction?.(weaponId) ?? { allowed: true, cost: 0 },
      recordPhysicalAction: (weaponId) => this.globalOwners.needsRuntime?.recordPhysicalAction?.(weaponId),
      isSuppressed: () => Boolean(
        this.callbacks.isSleeping?.()
        || this.callbacks.isOptionsOpen?.()
        || this.callbacks.isConfirmationActive?.()
        || this.owners.buildModeRuntime?.isActive?.()
        || this.owners.cookingRuntime?.isActive?.()
        || this.owners.facilityRuntime?.isUsing?.()
        || this.owners.needsInteractionCoordinator?.isLocked?.()
        || this.globalOwners.interactionRuntime?.isDialogueActive?.()
        || this.owners.merchantRuntime?.isActive?.()
      ),
    });
  }

  mountFacilities() {
    this.owners.facilityRuntime = this.factories.facility(this.renderingHost, {
      worldLayout: this.activeLayout,
      getKitchenState: () => this.sessionState.gameplay.kitchen,
      getInventoryState: () => this.sessionState.gameplay.inventory,
      getSelectedItem: () => this.globalOwners.gameHud?.getSelectedInventoryItem?.() ?? null,
      isFacilityReserved: (facilityId) => this.owners.guestRuntime?.isDiningTableReserved?.(facilityId) ?? false,
    });
    this.owners.needsInteractionCoordinator = this.factories.needsInteraction({
      facilityRuntime: this.owners.facilityRuntime,
      debrisRuntime: this.owners.debrisRuntime,
      getPlayer: () => this.callbacks.getPlayerCharacter?.(),
      startSleep: (options) => this.callbacks.startSleep?.(options),
      stopSleep: (options) => this.callbacks.stopSleep?.(options),
      isSleeping: () => this.callbacks.isSleeping?.() ?? false,
      toiletAccidentTuning: this.gameplayTuning.needs.toiletAccident,
      onToiletAccident: (event) => this.globalOwners.needsRuntime?.beginToiletAccident?.(event),
      onToiletAccidentRecovery: (progress) => this.globalOwners.needsRuntime?.advanceToiletAccidentRecovery?.(progress),
      refresh: () => this.globalOwners.interactionRuntime?.refresh?.(),
    });
  }

  mountTavern() {
    this.owners.tavernSignRuntime = this.factories.tavernSign(this.renderingHost, {
      getTavernOpen: () => this.sessionState.gameplay.tavernOpen,
      worldLayout: this.activeLayout,
    });
    this.owners.tavernServiceRuntime = this.factories.tavernService(this.renderingHost, {
      sessionState: this.sessionState,
      worldLayout: this.activeLayout,
      facilityRuntime: this.owners.facilityRuntime,
      characterSystem: this.characterSystem,
      createNpcMovementConfig: (profile) => this.createNpcMovementConfig(profile),
      getPlayerPosition: () => this.callbacks.getPlayerCharacter?.()?.motor?.position,
      getSignPoint: () => this.owners.tavernSignRuntime?.getGuestCheckPoint?.() ?? GUEST_CONFIG.points.sign,
      onPersistentMutation: (result) => {
        if (result?.status === "coin-collected") this.globalOwners.gameHud?.notifyCoinDelta?.(result.value);
        this.owners.facilityRuntime?.syncKitchenVisuals?.();
        this.globalOwners.gameHud?.render?.();
        this.globalOwners.interactionRuntime?.refresh?.();
        this.callbacks.saveSession?.();
      },
    });
    this.owners.guestRuntime = this.owners.tavernServiceRuntime.guestRuntime;
    this.owners.coinRuntime = this.owners.tavernServiceRuntime.coinRuntime;
  }

  mountFarming() {
    this.owners.farmingRuntime = this.factories.farming(this.renderingHost, {
      sessionState: this.sessionState,
      worldLayout: this.activeLayout,
      getSelectedItem: () => this.globalOwners.gameHud?.getSelectedInventoryItem?.() ?? null,
      spawnHarvestDrops: (itemId, quantity, origin) => this.globalOwners.gameHud?.spawnWorldItems?.(itemId, quantity, origin),
      isModalActive: () => Boolean(
        this.owners.merchantRuntime?.isActive?.()
        || this.owners.cookingRuntime?.isActive?.()
        || this.owners.buildModeRuntime?.isActive?.()
        || this.callbacks.isConfirmationActive?.()
      ),
      canPerformPhysicalAction: (toolId) => this.globalOwners.needsRuntime?.canPerformPhysicalAction?.(toolId) ?? { allowed: true, cost: 0 },
      recordPhysicalAction: (toolId) => this.globalOwners.needsRuntime?.recordPhysicalAction?.(toolId),
      onPersistentMutation: () => {
        this.globalOwners.gameHud?.render?.();
        this.globalOwners.interactionRuntime?.refresh?.();
        this.callbacks.saveSession?.();
      },
      playEffect: (type) => this.globalOwners.audioRuntime?.playEffect?.(type),
    });
  }

  mountCooking() {
    this.owners.cookingRuntime = this.factories.cooking(this.renderingHost, {
      sessionState: this.sessionState,
      localization: this.localization,
      playEffect: (type) => this.globalOwners.audioRuntime?.playEffect?.(type),
      onInventoryGain: (result) => this.globalOwners.gameHud?.notifyInventoryGain?.(result),
      onActiveChange: (active) => {
        this.callbacks.setCookingOverlayActive?.(active);
        this.globalOwners.gameHud?.setGameplayOverlayActive?.(active);
        this.callbacks.syncGameplayHudVisibility?.();
        this.callbacks.getMobileJoystick?.()?.reset?.();
        if (active) {
          const player = this.characterSystem?.require?.(this.sessionState.playerId);
          if (player?.motor?.movement?.velocity) {
            player.motor.movement.velocity.x = 0;
            player.motor.movement.velocity.y = 0;
          }
        } else {
          this.globalOwners.interactionRuntime?.refresh?.();
        }
      },
      onPersistentMutation: () => {
        this.owners.facilityRuntime?.syncKitchenVisuals?.();
        this.globalOwners.gameHud?.render?.();
        this.globalOwners.interactionRuntime?.refresh?.();
        this.callbacks.saveSession?.();
      },
    });
    this.owners.kitchenInteractionRuntime = this.factories.kitchenInteraction({
      sessionState: this.sessionState,
      facilityRuntime: this.owners.facilityRuntime,
      cookingRuntime: this.owners.cookingRuntime,
      localization: this.localization,
      getSelectedItem: () => this.globalOwners.gameHud?.getSelectedInventoryItem?.() ?? null,
      onInventoryGain: (result) => this.globalOwners.gameHud?.notifyInventoryGain?.(result),
      showMessage: (key, options) => this.globalOwners.gameHud?.showTransientMessage?.(key, options),
      playEffect: (type) => this.globalOwners.audioRuntime?.playEffect?.(type),
      onPersistentMutation: () => {
        this.globalOwners.gameHud?.render?.();
        this.globalOwners.interactionRuntime?.refresh?.();
        this.callbacks.saveSession?.();
      },
    });
  }

  mountMovementDebugPanel() {
    this.owners.movementDebugPanel = this.factories.movementDebugPanel({
      enabled: this.movementDebugEnabled,
      movementConfig: this.movementConfig,
      onConfigChange: () => this.syncNpcMovementConfig(),
      gameplayTuning: this.gameplayTuning,
      onGameplayTuningChange: (tuning) => {
        applyGameplayTuning(this.sessionState, tuning);
        this.globalOwners.cameraRuntime?.setTuning?.(tuning);
        this.callbacks.syncPlayerEnergyTarget?.();
        this.globalOwners.gameHud?.render?.();
      },
      onRefillEnergy: () => {
        refillEnergy(this.sessionState);
        this.globalOwners.needsFlowRuntime?.reset?.(needMeterValues(this.sessionState.gameplay));
        this.callbacks.syncPlayerEnergyTarget?.();
        this.globalOwners.gameHud?.render?.();
        this.callbacks.saveSession?.();
      },
      onSetNeedsDebugPreset: (preset) => {
        if (preset === "clear") this.globalOwners.needsRuntime?.clearDebugPreset?.();
        else this.globalOwners.needsRuntime?.setDebugPreset?.(preset);
        this.globalOwners.needsFlowRuntime?.reset?.(needMeterValues(this.sessionState.gameplay));
        this.callbacks.syncPlayerEnergyTarget?.();
        this.globalOwners.gameHud?.render?.();
      },
      onAddCookedDish: () => {
        const result = addInventoryItem(this.sessionState.gameplay.inventory, createInventoryItem("fried-potato-dish", 1));
        if (result.mutated) this.globalOwners.gameHud?.notifyInventoryGain?.(result);
        this.globalOwners.gameHud?.render?.();
        this.globalOwners.interactionRuntime?.refresh?.();
        this.callbacks.saveSession?.();
      },
      onColliderVisibilityChange: (visible) => this.authoring.setColliderDebugVisible?.(visible),
      onBuildGridVisibilityChange: (visible) => this.owners.buildModeRuntime?.setGridEnabled?.(visible),
      onColliderEditModeChange: (active) => this.authoring.setColliderEditMode?.(active),
      onPivotEditModeChange: (active) => this.authoring.setPivotEditMode?.(active),
      onVisualOffsetEditModeChange: (active) => this.authoring.setVisualOffsetEditMode?.(active),
      onColliderDraftConfirm: () => this.authoring.confirmColliderDraft?.(),
      onColliderRound: () => this.authoring.roundSelectedCollider?.(),
      onPivotAlign: (axis) => this.authoring.alignSelectedPivot?.(axis),
      onVisualOffsetReset: () => this.authoring.resetSelectedVisualOffset?.(),
      onResetBalanceRun: () => {
        resetBalanceRun(this.sessionState);
        this.globalOwners.worldInteractionCoordinator?.resetResourceActivity?.();
        this.owners.debrisRuntime?.rebuild?.();
        this.callbacks.syncPlayerEnergyTarget?.();
        this.globalOwners.gameHud?.render?.();
        this.globalOwners.interactionRuntime?.refresh?.();
        this.callbacks.saveSession?.();
      },
      getStatusSnapshot: () => this.getDebugStatusSnapshot(),
    });
    this.mountAuthoringInput();
  }

  mountBuildCoordinator() {
    const registries = this.presentationRuntime.getBuildSurfaceRegistries();
    this.owners.worldBuildCoordinator = this.factories.worldBuildCoordinator({
      renderingHost: this.renderingHost,
      localization: this.localization,
      worldLayout: this.activeLayout,
      assetProfiles: () => this.callbacks.getAssetProfiles?.(),
      farmState: this.sessionState.gameplay.farm,
      ...registries,
      facilityRuntime: this.owners.facilityRuntime,
      debrisRuntime: this.owners.debrisRuntime,
      tavernSignRuntime: this.owners.tavernSignRuntime,
      meleeRuntime: this.owners.meleeRuntime,
      hasFarmCell: (point) => this.owners.farmingRuntime?.hasFarmCell?.(point) ?? false,
      getPlayerFootBox: () => {
        const player = this.characterSystem?.require?.(this.sessionState.playerId);
        return player ? getFootBox(player.motor.position, player.motor.footWidth, player.motor.footDepth) : null;
      },
      addCanonicalTile: (tile, textureKey, depth) => this.presentationRuntime.addCanonicalTile(tile, textureKey, depth),
      createCanonicalWallEntry: (tile) => this.presentationRuntime.createCanonicalWallEntry(tile),
      playEffect: (effect) => this.globalOwners.audioRuntime?.playEffect?.(effect),
      refreshInteractions: () => this.globalOwners.interactionRuntime?.refresh?.(),
      persistGameplay: () => this.callbacks.saveSession?.(),
      isActivationAllowed: () => !this.owners.cookingRuntime?.isActive?.(),
      getBuildGridEnabled: () => Boolean(this.owners.movementDebugPanel?.buildGridCheckbox?.checked),
      onModeChange: (active) => {
        this.globalOwners.audioRuntime?.playEffect?.(active ? "menu-open" : "menu-close");
        this.callbacks.syncGameplayHudVisibility?.();
        this.owners.movementDebugPanel?.setSuppressed?.(active);
        this.callbacks.getMobileJoystick?.()?.reset?.();
        if (!active) this.globalOwners.interactionRuntime?.refresh?.();
      },
    });
    this.owners.buildModeRuntime = this.owners.worldBuildCoordinator.getBuildModeRuntime();
    this.owners.farmingRuntime?.attachWorldBuildCoordinator?.(this.owners.worldBuildCoordinator);
  }

  mountAuthoringInput() {
    if (!this.inputHost || this.authoringListeners) return;
    const listeners = {
      colliderDown: (pointer) => this.authoring.beginColliderEditPointer?.(pointer),
      colliderMove: (pointer) => this.authoring.continueColliderEditPointer?.(pointer),
      colliderUp: () => this.authoring.endColliderEditPointer?.(),
      pivotDown: (pointer) => this.authoring.beginPivotEditPointer?.(pointer),
      pivotMove: (pointer) => this.authoring.continuePivotEditPointer?.(pointer),
      pivotUp: () => this.authoring.endPivotEditPointer?.(),
      pivotKey: (event) => this.authoring.handlePivotKeyDown?.(event),
      visualDown: (pointer) => this.authoring.beginVisualOffsetEditPointer?.(pointer),
      visualMove: (pointer) => this.authoring.continueVisualOffsetEditPointer?.(pointer),
      visualUp: () => this.authoring.endVisualOffsetEditPointer?.(),
      visualKey: (event) => this.authoring.handleVisualOffsetKeyDown?.(event),
    };
    this.inputHost.on("pointerdown", listeners.colliderDown);
    this.inputHost.on("pointermove", listeners.colliderMove);
    this.inputHost.on("pointerup", listeners.colliderUp);
    this.inputHost.on("pointerdown", listeners.pivotDown);
    this.inputHost.on("pointermove", listeners.pivotMove);
    this.inputHost.on("pointerup", listeners.pivotUp);
    this.inputHost.keyboard.on("keydown", listeners.pivotKey);
    this.inputHost.on("pointerdown", listeners.visualDown);
    this.inputHost.on("pointermove", listeners.visualMove);
    this.inputHost.on("pointerup", listeners.visualUp);
    this.inputHost.keyboard.on("keydown", listeners.visualKey);
    this.authoringListeners = listeners;
  }

  unmountAuthoringInput() {
    const listeners = this.authoringListeners;
    if (!listeners || !this.inputHost) return;
    this.inputHost.off("pointerdown", listeners.colliderDown);
    this.inputHost.off("pointermove", listeners.colliderMove);
    this.inputHost.off("pointerup", listeners.colliderUp);
    this.inputHost.off("pointerdown", listeners.pivotDown);
    this.inputHost.off("pointermove", listeners.pivotMove);
    this.inputHost.off("pointerup", listeners.pivotUp);
    this.inputHost.keyboard.off("keydown", listeners.pivotKey);
    this.inputHost.off("pointerdown", listeners.visualDown);
    this.inputHost.off("pointermove", listeners.visualMove);
    this.inputHost.off("pointerup", listeners.visualUp);
    this.inputHost.keyboard.off("keydown", listeners.visualKey);
    this.authoringListeners = null;
  }

  getDebugStatusSnapshot() {
    if (!this.callbacks.getPlayerCharacter?.()) return null;
    return {
      energy: this.sessionState.gameplay.currentEnergy,
      clock: formatClock(this.sessionState.gameplay.worldTimeSeconds, this.localization.getLanguage()),
      smallLogsCleared: RESOURCE_OBJECTS.filter((item) => getResourceProfile(item.profileId).id === "log-small"
        && this.sessionState.gameplay.resourceNodes[item.id]?.cleared).length,
      wood: this.sessionState.gameplay.wood,
      stone: this.sessionState.gameplay.stone,
      rubies: this.sessionState.gameplay.rubies,
    };
  }

  interactionOwners() {
    return {
      merchantRuntime: this.owners.merchantRuntime,
      farmingRuntime: this.owners.farmingRuntime,
      tavernSignRuntime: this.owners.tavernSignRuntime,
      facilityRuntime: this.owners.facilityRuntime,
      kitchenInteractionRuntime: this.owners.kitchenInteractionRuntime,
      needsInteractionCoordinator: this.owners.needsInteractionCoordinator,
      cookingRuntime: this.owners.cookingRuntime,
      debrisRuntime: this.owners.debrisRuntime,
    };
  }

  updateOwnerSnapshot() {
    this.ownerSnapshot = Object.freeze({ ...this.owners });
  }
}

export function validateLocationCapabilities(capabilities = {}) {
  const normalized = Object.freeze({
    homeSystems: Boolean(capabilities.homeSystems),
    npcs: Boolean(capabilities.npcs),
    meleeWeapons: Boolean(capabilities.meleeWeapons),
    trainingDummy: Boolean(capabilities.trainingDummy),
    facilities: Boolean(capabilities.facilities),
    tavernService: Boolean(capabilities.tavernService),
    farming: Boolean(capabilities.farming),
    cooking: Boolean(capabilities.cooking),
    buildMode: Boolean(capabilities.buildMode),
  });
  if (normalized.tavernService && !normalized.facilities) {
    throw new Error("Invalid location capabilities: tavernService requires facilities");
  }
  if (normalized.cooking && !normalized.facilities) {
    throw new Error("Invalid location capabilities: cooking requires facilities");
  }
  return normalized;
}

function createEmptyOwners() {
  return {
    merchantRuntime: null,
    debrisRuntime: null,
    meleeRuntime: null,
    facilityRuntime: null,
    needsInteractionCoordinator: null,
    tavernSignRuntime: null,
    tavernServiceRuntime: null,
    guestRuntime: null,
    coinRuntime: null,
    farmingRuntime: null,
    cookingRuntime: null,
    kitchenInteractionRuntime: null,
    movementDebugPanel: null,
    worldBuildCoordinator: null,
    buildModeRuntime: null,
  };
}
