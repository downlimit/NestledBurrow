import Phaser from "phaser";
import "@fontsource/pixelify-sans/latin.css";
import "@fontsource/pixelify-sans/cyrillic.css";
import "./style.css";
import { clampVectorLength, isPlayerMovementSuppressed } from "./input.js";
import { getFootBox } from "./movement.js";
import { createMovementState, createRuntimeMovementConfig, energyTargetSpeedMultiplier } from "./characterMovement.js";
import {
  ACTOR_PROFILE_IDS,
  createDebugMovementConfigFromPolicy,
  getActorProfile,
} from "./actorProfiles.js";
import { createCharacter } from "./character.js";
import { createCharacterSystem } from "./characterSystem.js";
import { createIdleController, createPatrolController, createPlayerController } from "./controllers.js";
import {
  BASIC_VILLAGE_ASSET_PATH,
  GAME_HEIGHT,
  GAME_WIDTH,
  HOUSE_IMAGE_PATH,
  HOUSE_FRAMES,
  HOUSE_TEXTURE_KEY,
  OUTDOOR_FRAMES,
  OUTDOOR_IMAGE_PATH,
  OUTDOOR_TEXTURE_KEY,
  TILE_SIZE,
  TREES_IMAGE_PATH,
  TREES_TEXTURE_KEY,
} from "./worldConfig.js";
import { createWorldLayout } from "./worldLayout.js";
import { WORLD_IDS } from "./worldLocationConfig.js";
import { createWorldLocationCoordinator } from "./worldLocationCoordinator.js";
import { canTransitionWorldLocation, destroyWorldLocation, mountWorldLocation, renderWorldLocation } from "./worldLocationLifecycle.js";
import { NPCS } from "./npcConfig.js";
import { advanceGameTime, applyGameplayTuning, createFreshGameSessionState, hitResourceDefinition, refillEnergy, resetBalanceRun } from "./gameSessionState.js";
import { dayNightMultiplyColor, formatClock } from "./gameClock.js";
import { getDialogueDefinition } from "./dialogueConfig.js";
import { INTERACTION_DEFINITIONS } from "./interactionConfig.js";
import { createInteractionRuntime } from "./interactionRuntime.js";
import { createInteractionApproachResolver } from "./interactionApproach.js";
import { createInteractionHud } from "./interactionHud.js";
import { createGameHud, shouldShakeEnergyAfterInteraction } from "./gameHud.js";
import { createSessionPersistence } from "./sessionPersistence.js";
import { createLocalization } from "./localization/index.js";
import { PIXELIFY_FONT_KEY } from "./localization/font.js";
import { createAudioSettingsStore } from "./audioSettings.js";
import { PhaserAudioRuntime, preloadMusicPlaylist } from "./audioRuntime.js";
import { HUD_DEPTH } from "./hud.js";
import { createMobileJoystick } from "./mobileJoystick.js";
import { MovementDebugPanel, loadMovementDebugConfig } from "./movementDebugPanel.js";
import { loadColliderDebugOverrides, saveColliderDebugOverrides } from "./colliderDebugOverrides.js";
import { loadAssetProfiles, saveAssetProfiles } from "./assetProfiles.js";
import { migrateDirectionalWallOverrides, worldDepthFromAnchorY } from "./buildWorldGeometry.js";
import { getColliderResizeEdges, getPixelColliderBounds, resizeColliderDraft, roundColliderDraftToGrid } from "./colliderResize.js";
import { BED_INTERACTION_KIND, BED_OBJECT, BED_WAKE_TILE } from "./debrisConfig.js";
import { DEFAULT_RESOURCE_ID, getResourceObjectsForWorld, PLACEMENT_CELL_SIZE, RESOURCE_INTERACTION_KIND, RESOURCE_OBJECTS } from "./resourceConfig.js";
import { getResourceProfile, resourceActionForTool, resourceEffectType } from "./resourceDomain.js";
import { createDebrisRuntime } from "./debrisRuntime.js";
import { FACILITY_INTERACTION_KIND, FACILITIES, preloadFacilityAssets } from "./facilityConfig.js";
import { createFacilityRuntime } from "./facilityRuntime.js";
import { createNeedsRuntime } from "./needsRuntime.js";
import { createNeedsFlowRuntime, needMeterValues } from "./needsFlowRuntime.js";
import { createNeedsInteractionCoordinator } from "./needsInteractionCoordinator.js";
import { loadGameplayDebugTuning } from "./gameplayDebugTuning.js";
import { CameraFollowRuntime } from "./cameraFollowRuntime.js";
import { createCookingRuntime } from "./cookingRuntime.js";
import { GUEST_CONFIG, TAVERN_SIGN, TAVERN_SIGN_ASSET, TAVERN_SIGN_KIND } from "./guestConfig.js";
import { createTavernSignRuntime } from "./tavernSignRuntime.js";
import {
  CHARACTER_VISUAL_PROFILE_IDS,
  getCharacterVisualProfile,
  toPhaserFrame,
} from "./characterVisualProfiles.js";
import { preloadFarmingAssets } from "./farmingConfig.js";
import { createFarmingRuntime } from "./farmingRuntime.js";
import { createMerchantRuntime } from "./merchantRuntime.js";
import { createWorldBuildCoordinator } from "./worldBuildCoordinator.js";
import { preloadLemonadeAssets } from "./lemonadeConfig.js";
import { createTavernServiceRuntime } from "./tavernServiceRuntime.js";
import { createKitchenInteractionRuntime } from "./kitchenInteractionRuntime.js";
import { installWorldE2EBridge } from "./e2eBridge.js";
import { UiVisibilityCoordinator } from "./uiVisibilityCoordinator.js";
import { addInventoryItem, createInventoryItem } from "./inventoryDomain.js";
import { createGameCanvasInputGuard } from "./gameCanvasInputGuard.js";
import {
  createMeleeStartingWorldItems,
  isMeleeWeaponId,
  preloadMeleeAssets,
  resolveMeleeActionItem,
  TRAINING_DUMMY,
} from "./meleeConfig.js";
import { createMeleeRuntime } from "./meleeRuntime.js";
import { loadStartingLayout } from "./startingLayout.js";
import STARTING_LAYOUT_DEFAULT from "./startingLayoutDefault.js";

const BUILD_ID = import.meta.env.VITE_BUILD_ID ?? "local";
const VILLAGE_ASSET_URL = `${import.meta.env.BASE_URL}${BASIC_VILLAGE_ASSET_PATH}`;

class WorldScene extends Phaser.Scene {
  constructor() {
    super("world");
    this.localization = window.__NESTLED_BURROW_LOCALIZATION__;
  }

  preload() {
    preloadMusicPlaylist(this, import.meta.env.BASE_URL);
    preloadFacilityAssets(this, import.meta.env.BASE_URL);
    preloadFarmingAssets(this, import.meta.env.BASE_URL);
    preloadLemonadeAssets(this, import.meta.env.BASE_URL);
    preloadMeleeAssets(this);
    this.load.spritesheet(TAVERN_SIGN_ASSET.key, `${import.meta.env.BASE_URL}${TAVERN_SIGN_ASSET.path}`, {
      frameWidth: TAVERN_SIGN_ASSET.frameWidth,
      frameHeight: TAVERN_SIGN_ASSET.frameHeight,
    });
    this.getUsedCharacterVisualProfiles().forEach((visualProfile) => {
      this.preloadCharacterVisualProfile(visualProfile);
    });

    const sheet = { frameWidth: TILE_SIZE, frameHeight: TILE_SIZE };
    this.load.spritesheet(OUTDOOR_TEXTURE_KEY, `${VILLAGE_ASSET_URL}/${OUTDOOR_IMAGE_PATH}`, sheet);
    this.load.spritesheet(HOUSE_TEXTURE_KEY, `${VILLAGE_ASSET_URL}/${HOUSE_IMAGE_PATH}`, sheet);
    this.load.spritesheet(TREES_TEXTURE_KEY, `${VILLAGE_ASSET_URL}/${TREES_IMAGE_PATH}`, sheet);
  }


  getUsedCharacterVisualProfiles() {
    return new Map([
      [
        CHARACTER_VISUAL_PROFILE_IDS.player,
        getCharacterVisualProfile(CHARACTER_VISUAL_PROFILE_IDS.player),
      ],
      ...NPCS.map((npc) => [npc.visualProfileId, getCharacterVisualProfile(npc.visualProfileId)]), [GUEST_CONFIG.visualProfileId, getCharacterVisualProfile(GUEST_CONFIG.visualProfileId)],
    ]).values();
  }

  preloadCharacterVisualProfile(visualProfile) {
    for (const resource of visualProfile.resources) {
      if (resource.type === "images") {
        for (const frame of resource.frames) {
          this.load.image(
            frame.textureKey,
            `${import.meta.env.BASE_URL}${resource.path}/${frame.fileName}`,
          );
        }
        continue;
      }
      if (resource.type === "spritesheet") {
        this.load.spritesheet(
          resource.textureKey,
          `${import.meta.env.BASE_URL}${resource.path}`,
          { frameWidth: resource.frameWidth, frameHeight: resource.frameHeight },
        );
        continue;
      }
      throw new Error(`Unknown character visual resource type: ${resource.type}`);
    }
  }

  create() {
    this.movementDebugEnabled = true;
    this.colliderOverrides = migrateColliderOverrideGroups(loadColliderDebugOverrides(window.localStorage));
    this.assetProfiles = loadAssetProfiles(window.localStorage, this.colliderOverrides);
    for (const [profileKey, profile] of Object.entries(this.assetProfiles)) {
      this.colliderOverrides[profileKey] = profile.colliderOffsets;
    }
    saveColliderDebugOverrides(this.colliderOverrides, window.localStorage);
    this.createGameplayTuning();
    this.loadSessionState();
    this.worldLocationCoordinator = createWorldLocationCoordinator({
      sessionState: this.sessionState,
      createLayout: (worldId) => createWorldLayout(worldId),
      applyColliderOverrides: (layout) => this.applyColliderOverridesToLayout(layout),
      getPlayerCharacter: () => this.playerCharacter,
      canTransition: () => this.canTransitionLocation(),
      beforeLocationChange: () => this.destroyLocationLifecycle(),
      applyLocationLayout: ({ layout }) => this.applyLocationLayout(layout),
      afterLocationChange: () => this.mountLocationLifecycle(),
      setCameraBounds: (bounds) => this.cameras.main.setBounds(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top),
      resetCamera: (position) => this.cameraRuntime?.reset?.(position),
      refreshInteractions: () => this.interactionRuntime?.refresh?.(),
      saveSession: () => this.saveSession(),
    });
    this.worldLayout = this.worldLocationCoordinator.createInitialLayout();
    this.characterSystem = createCharacterSystem({ collisionEnvironment: this.worldLayout });
    this.cameras.main.setBounds(0, 0, this.worldLayout.bounds.right, this.worldLayout.bounds.bottom);
    this.renderWorld();
    this.createCharacterAnimations();
    this.createInput();
    this.createCharacters();
    this.createAudio();
    this.createCameraRuntime();
    this.createSessionAndInteractionRuntime();
    this.sleeping = false;
    this.exhaustedSleeping = false;
    this.isRunning = false;
    this.simulationScale = this.playerTimeScale = 1;
    this.timeScale = 1;
    this.autosaveAccumulatorSeconds = 0;
    this.lastSuccessfulHitAtMs = Number.NEGATIVE_INFINITY;
    this.lastWakeAttemptAtMs = Number.NEGATIVE_INFINITY;
    this.createDayNightRuntime();
    this.createHud();
    this.mountLocationLifecycle();
    this.attachSceneListeners();
    this.createJoystick();
    this.syncIntegerZoom();
    this.installE2EBridge();
  }

  renderWorld() { renderWorldLocation(this, { outdoorTextureKey: OUTDOOR_TEXTURE_KEY, houseTextureKey: HOUSE_TEXTURE_KEY, treesTextureKey: TREES_TEXTURE_KEY, tileSize: TILE_SIZE }); }

  addTile(tile, textureKey, depth) {
    const sprite = this.add
      .image(tile.worldX ?? tile.x * TILE_SIZE, tile.worldY ?? tile.y * TILE_SIZE, textureKey, tile.frame)
      .setOrigin(0, 0)
      .setDepth(depth);
    this.worldRenderSprites?.push?.(sprite);
    return sprite;
  }

  createCanonicalWallEntry(tile) {
    const depth = worldDepthFromAnchorY((tile.worldY ?? tile.y * TILE_SIZE) + TILE_SIZE, tile.id);
    const extraSprites = (tile.supplements ?? []).map((supplement) => this.add
      .image(supplement.worldX, supplement.worldY, HOUSE_TEXTURE_KEY, supplement.frame)
      .setOrigin(0, 0)
      .setCrop(supplement.cropX, 0, supplement.cropWidth, TILE_SIZE)
      .setDepth(depth));
    this.worldRenderSprites?.push?.(...extraSprites);
    const sprite = this.addTile(tile, HOUSE_TEXTURE_KEY, depth);
    return { sprite, extraSprites, tile };
  }

  createCharacterAnimations() {
    for (const visual of this.getUsedCharacterVisualProfiles()) {
      Object.entries(visual.frames).forEach(([facing, frames]) => {
        const key = `${visual.animationPrefix}-walk-${facing}`;
        if (this.anims.exists(key)) return;
        this.anims.create({
          key,
          frames: visual.walkFrameSequence.map((frameIndex) => toPhaserFrame(frames[frameIndex])),
          frameRate: visual.walkFrameRate,
          repeat: -1,
        });
      });
    }
  }

  createCharacters() {
    const playerProfile = getActorProfile(ACTOR_PROFILE_IDS.player);
    const playerVisualProfile = getCharacterVisualProfile(CHARACTER_VISUAL_PROFILE_IDS.player);
    const debugOverrides = loadMovementDebugConfig({ enabled: this.movementDebugEnabled });
    this.movementConfig = createRuntimeMovementConfig(debugOverrides, playerProfile.movement);
    this.npcMovementConfigs = [];
    this.playerCharacter = createCharacter(this, {
      id: "player",
      spawn: this.worldLayout.spawn,
      controller: createPlayerController({
        getInputDirection: () => this.getMovementVector(),
        getAimDirection: () => this.meleeRuntime?.getAimDirection?.() ?? null,
        getActions: () => this.frameActions,
      }),
      movementConfig: this.movementConfig,
      actorProfile: playerProfile,
      visualProfile: playerVisualProfile,
    });
    this.characterSystem.add(this.playerCharacter);
    this.player = this.characterSystem.require("player").sprite;
  }

  mountVillageCharacters() {
    this.npcMovementConfigs = [];
    for (const npc of NPCS) {
      if (this.characterSystem.has(npc.id)) continue;
      const actorProfile = getActorProfile(npc.profileId);
      const visualProfile = getCharacterVisualProfile(npc.visualProfileId);
      this.characterSystem.add(createCharacter(this, {
        id: npc.id,
        spawn: npc.spawn,
        controller: npc.patrol
          ? createPatrolController({
            ...npc.patrol,
            isPaused: () => this.interactionRuntime?.isEntityInActiveDialogue(npc.id) ?? false,
          })
          : createIdleController(),
        movementConfig: this.createNpcRuntimeMovementConfig(actorProfile),
        actorProfile,
        visualProfile,
      }));
    }
  }

  destroyVillageCharacters() {
    for (const npc of NPCS) this.characterSystem?.remove?.(npc.id);
    this.npcMovementConfigs = [];
  }

  createNpcRuntimeMovementConfig(profile) {
    if (!this.movementDebugEnabled) {
      return createRuntimeMovementConfig(profile.movement, profile.movement);
    }

    const config = createRuntimeMovementConfig(
      createDebugMovementConfigFromPolicy(profile, this.movementConfig),
      profile.movement,
    );
    this.npcMovementConfigs.push({ profileId: profile.id, movementConfig: config });
    return config;
  }

  syncNpcMovementConfig() {
    if (!this.npcMovementConfigs) return;
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

  createInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys("W,A,S,D");
    this.interactKeys = this.input.keyboard.addKeys("SPACE");
    this.runKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.gameHudHidden = false;
    this.gameHudConfirmationActive = false;
    this.cookingOverlayActive = false;
    this.onHudToggleKey = (event) => {
      if (event?.repeat) return;
      event?.preventDefault?.();
      this.gameHudHidden = !this.gameHudHidden;
      this.syncGameplayHudVisibility();
    };
    this.input.keyboard.on("keydown-X", this.onHudToggleKey);
    this.frameMeleeItem = null;
    this.frameActions = Object.freeze({ interact: false, primary: false, secondary: false });
  }

  createAudio() {
    this.audioSettings = createAudioSettingsStore({ storage: window.localStorage });
    this.audioRuntime = new PhaserAudioRuntime(this, this.audioSettings);
    this.audioRuntime.startMusic();
  }

  createGameplayTuning() {
    this.gameplayTuning = loadGameplayDebugTuning({ enabled: this.movementDebugEnabled });
  }

  loadSessionState() {
    this.sessionPersistence = this.createPersistence();
    const loaded = this.sessionPersistence?.load();
    this.sessionState = loaded?.state ?? this.createFreshSessionState();
    this.pendingTask049MigrationWarning = Boolean(this.sessionState.flags?.["migration.task049WarningPending"]);
    if (loaded?.diagnostic) console.warn("Recovered NestledBurrow session", loaded.diagnostic);
  }

  createCameraRuntime() {
    this.cameraRuntime = new CameraFollowRuntime(this, {
      presentationPosition: this.getPlayerPresentationPosition(),
      tuning: this.gameplayTuning,
      movingSpeedThreshold: this.movementConfig.movingSpeedThreshold,
    });
  }

  createSessionAndInteractionRuntime() {
    this.interactionHud = createInteractionHud(this, {
      isCoarsePointer: () => this.isCoarsePointer(),
      localization: this.localization,
    });
    this.uiVisibilityCoordinator = new UiVisibilityCoordinator();
    this.uiVisibilityCoordinator.register(this.interactionHud, ["gameplay-overlay", "option-sensitive", "merchant-active", "inventory-action-blocked"]);
    applyGameplayTuning(this.sessionState, this.gameplayTuning);
    this.needsRuntime = createNeedsRuntime({
      sessionState: this.sessionState,
      tuning: this.gameplayTuning.needs,
      onCollapse: () => this.needsInteractionCoordinator?.collapse(),
      onWake: () => this.needsInteractionCoordinator?.wake(),
      onToiletAccidentReady: (event) => this.needsInteractionCoordinator?.beginToiletAccident(event),
      onToiletAccident: ({ witnessed }) => this.gameHud?.showTransientMessage?.(
        witnessed ? "hud:needs.toiletAccidentWitnessed" : "hud:needs.toiletAccidentPrivate",
      ),
    });
    this.needsFlowRuntime = createNeedsFlowRuntime({ initialValues: needMeterValues(this.sessionState.gameplay) });
    this.interactionApproachResolver = createInteractionApproachResolver({ worldLayout: this.worldLayout, getPlayer: () => this.playerCharacter });
    this.syncPlayerEnergyTarget();
    this.interactionRuntime = createInteractionRuntime({
      sessionState: this.sessionState,
      characterSystem: this.characterSystem,
      interactionDefinitions: [],
      getInteractionDefinitions: () => this.worldLocationCoordinator?.hasCapability("npcs") ? INTERACTION_DEFINITIONS : [],
      getDialogueDefinition,
      onPersistentMutation: (result) => {
        if (result?.completion) this.needsRuntime?.applyMeaningfulConversation?.();
        this.gameHud?.render?.();
        this.saveSession();
      },
      getStaticInteractionDefinitions: () => [
        ...(this.debrisRuntime?.getInteractionDefinitions?.() ?? []),
        ...(this.facilityRuntime?.getInteractionDefinitions?.() ?? []),
        ...(this.tavernSignRuntime?.getInteractionDefinitions?.() ?? []),
        ...(this.farmingRuntime?.getInteractionDefinitions?.() ?? []),
        ...(this.sleeping && !this.exhaustedSleeping ? [this.getSleepingWakeInteraction()] : []),
      ],
      isInteractionAllowed: (definition) => !this.cookingRuntime?.isActive?.()
        && (this.needsInteractionCoordinator?.allowsInteraction?.(definition) ?? true)
        && (!this.facilityRuntime?.isUsing()
          || (definition.kind === FACILITY_INTERACTION_KIND && definition.id === this.facilityRuntime.getActiveId())),
      resolveInteractionTarget: (definition, player) => this.interactionApproachResolver.resolve(definition, player),
      runWorldObjectInteraction: (candidate) => this.runWorldObjectInteraction(candidate),
      presenter: this.interactionHud,
    });
  }

  createMerchantRuntime() {
    this.merchantRuntime = createMerchantRuntime(this, {
      sessionState: this.sessionState,
      localization: this.localization,
      onActiveChange: () => this.syncGameplayHudVisibility(),
      playEffect: (type) => this.audioRuntime?.playEffect?.(type),
      onInventoryGain: (result) => this.gameHud?.notifyInventoryGain?.(result),
      onPersistentMutation: () => {
        this.gameHud?.render?.();
        this.saveSession();
      },
    });
    this.unregisterMerchantVisibility = this.uiVisibilityCoordinator?.register?.(this.merchantRuntime, ["gameplay-overlay", "option-sensitive"]);
  }

  createDebrisRuntime() {
    this.debrisRuntime = createDebrisRuntime(this, {
      sessionState: this.sessionState,
      worldLayout: this.worldLayout,
      resourceDefinitions: getResourceObjectsForWorld(this.worldLocationCoordinator.getCurrentDefinition().id),
      includeBed: this.worldLocationCoordinator.hasCapability("homeSystems"),
      getSelectedItem: () => this.gameHud?.getSelectedInventoryItem?.() ?? null,
      getGameplayTuning: () => this.gameplayTuning,
      onPersistentMutation: (result) => { this.gameHud?.render?.(); if (result.inventory?.mutated) this.gameHud?.notifyInventoryGain?.(result.inventory); this.interactionRuntime?.refresh?.(); this.saveSession(); },
    });
  }

  createFacilityRuntime() {
    this.facilityRuntime = createFacilityRuntime(this, {
      worldLayout: this.worldLayout,
      getKitchenState: () => this.sessionState?.gameplay?.kitchen, getInventoryState: () => this.sessionState?.gameplay?.inventory,
      getSelectedItem: () => this.gameHud?.getSelectedInventoryItem?.() ?? null,
      isFacilityReserved: (facilityId) => this.tavernServiceRuntime?.guestRuntime?.isDiningTableReserved?.(facilityId) ?? false,
    });
    this.needsInteractionCoordinator = createNeedsInteractionCoordinator({
      facilityRuntime: this.facilityRuntime,
      debrisRuntime: this.debrisRuntime,
      getPlayer: () => this.playerCharacter,
      startSleep: (options) => this.startSleeping(options),
      stopSleep: (options) => this.wakeUp(options),
      isSleeping: () => this.sleeping,
      toiletAccidentTuning: this.gameplayTuning.needs.toiletAccident,
      onToiletAccident: (event) => this.needsRuntime?.beginToiletAccident(event),
      onToiletAccidentRecovery: (progress) => this.needsRuntime?.advanceToiletAccidentRecovery(progress),
      refresh: () => this.interactionRuntime?.refresh?.(),
    });
  }

  createTavernRuntime() {
    this.tavernSignRuntime = createTavernSignRuntime(this, {
      getTavernOpen: () => this.sessionState?.gameplay?.tavernOpen,
      worldLayout: this.worldLayout,
    });
    this.tavernServiceRuntime = createTavernServiceRuntime(this, {
      sessionState: this.sessionState,
      worldLayout: this.worldLayout,
      facilityRuntime: this.facilityRuntime,
      characterSystem: this.characterSystem,
      createNpcMovementConfig: (profile) => this.createNpcRuntimeMovementConfig(profile),
      getPlayerPosition: () => this.playerCharacter?.motor?.position,
      getSignPoint: () => this.tavernSignRuntime?.getGuestCheckPoint?.() ?? GUEST_CONFIG.points.sign,
      onPersistentMutation: (result) => {
        if (result?.status === "coin-collected") this.gameHud?.notifyCoinDelta?.(result.value);
        this.facilityRuntime?.syncKitchenVisuals?.();
        this.gameHud?.render?.();
        this.interactionRuntime?.refresh?.();
        this.saveSession();
      },
    });
    this.guestRuntime = this.tavernServiceRuntime.guestRuntime;
    this.coinRuntime = this.tavernServiceRuntime.coinRuntime;
  }

  runWorldObjectInteraction(candidate) {
    const merchantResult = this.merchantRuntime?.handleInteraction?.(candidate);
    if (merchantResult && merchantResult.status !== "ignored") {
      this.suppressNextInteract = true;
      return merchantResult;
    }
    const farmingResult = this.farmingRuntime?.handleInteraction?.(candidate);
    if (farmingResult && farmingResult.status !== "ignored") {
      let presentedFarmingResult = farmingResult;
      if (farmingResult.messageKey) {
        this.gameHud?.showTransientMessage?.(farmingResult.messageKey);
        presentedFarmingResult = { ...farmingResult, transientMessageShown: true };
      }
      this.suppressNextInteract = true;
      return presentedFarmingResult;
    }
    if (candidate.kind === TAVERN_SIGN_KIND) {
      this.sessionState.gameplay.tavernOpen = !this.sessionState.gameplay.tavernOpen; this.audioRuntime?.playEffect?.(this.sessionState.gameplay.tavernOpen ? "tavern-open" : "tavern-close");
      this.tavernSignRuntime?.sync?.();
      this.interactionRuntime?.refresh?.();
      this.suppressNextInteract = true;
      return { status: this.sessionState.gameplay.tavernOpen ? "opened" : "closed", mutated: true };
    }
    if (candidate.kind === FACILITY_INTERACTION_KIND) {
      const facility = this.facilityRuntime.getDefinition(candidate.payload.facilityId);
      if (["cutting-table", "gas-stove"].includes(facility?.facilityType)
        && !this.needsRuntime.canStartLongAction()) {
        return { status: "urgent-toilet", mutated: false, messageKey: "hud:needs.urgentLongAction" };
      }
      const kitchenResult = this.kitchenInteractionRuntime?.handleFacility?.(facility);
      if (kitchenResult?.status !== "ignored") {
        this.suppressNextInteract = true;
        this.interactionRuntime?.refresh?.();
        return kitchenResult;
      }
      const result = this.needsInteractionCoordinator.useFacility(candidate.payload.facilityId, candidate.payload);
      this.suppressNextInteract = true;
      this.interactionRuntime?.refresh?.();
      return result;
    }
    if (candidate.kind === BED_INTERACTION_KIND) {
      const result = this.needsInteractionCoordinator.useBed(candidate.payload.bedId, candidate.payload);
      this.suppressNextInteract = true;
      return result;
    }
    if (this.facilityRuntime?.isUsing() || this.needsInteractionCoordinator?.isLocked()) return { status: "busy", mutated: false };
    if (candidate.kind === "wake-exhausted") {
      return this.tryWakeFromExhaustion(this.e2eWakeRandom ?? Math.random);
    }
    if (candidate.kind !== RESOURCE_INTERACTION_KIND) return { status: "ignored" };
    const nowMs = globalThis.performance?.now?.() ?? Date.now();
    if (nowMs - this.lastSuccessfulHitAtMs < this.gameplayTuning.universalHitCooldownSeconds * 1000) return { status: "cooldown", mutated: false };
    const definition = this.debrisRuntime?.getResourceDefinition?.(candidate.payload.resourceId);
    if (!definition) return { status: "unknown-resource", mutated: false };
    const profile = getResourceProfile(definition.profileId);
    const action = resourceActionForTool(profile, this.gameHud?.getSelectedInventoryItem?.()?.id);
    if (!action) return { status: "wrong-tool", mutated: false };
    const energyBefore = this.sessionState.gameplay.currentEnergy;
    const physicalAction = this.needsRuntime.canPerformPhysicalAction(profile.requiredTool);
    const result = hitResourceDefinition(this.sessionState, definition, {
      action,
      damage: this.gameplayTuning.axeDamage,
      energyPerHit: physicalAction.cost,
      tuning: this.gameplayTuning,
    });
    if (result.mutated) {
      this.needsRuntime.recordPhysicalAction(profile.requiredTool, { energyAlreadySpent: true });
      this.lastSuccessfulHitAtMs = nowMs;
      this.activeResourceProfileId = profile.id;
      this.interactionHud?.triggerCooldownFeedback?.();
      this.gameHud?.render?.();
      if (result.inventory?.mutated) this.gameHud?.notifyInventoryGain?.(result.inventory);
      this.applySuccessfulHitFeedback(resourceEffectType(profile, result.status), energyBefore);
      this.debrisRuntime?.hitWithFeedback?.(definition.id, result, () => this.interactionRuntime?.refresh?.());
      this.saveSession();
    }
    return result;
  }

  applySuccessfulHitFeedback(effectType, energyBefore) {
    this.syncPlayerEnergyTarget();
    this.audioRuntime?.playEffect?.(effectType);
    const gameplay = this.sessionState.gameplay;
    if (shouldShakeEnergyAfterInteraction({ mutated: true, energyBefore, currentEnergy: gameplay.currentEnergy, maximumEnergy: gameplay.maximumEnergy })) {
      this.gameHud?.triggerEnergyShake?.();
    }
  }

  getPlayerPresentationPosition() {
    const sprite = this.playerCharacter?.sprite;
    const motor = this.playerCharacter?.motor;
    return {
      x: Number(sprite?.x ?? motor?.position?.x ?? 0),
      y: Number(sprite?.y ?? motor?.position?.y ?? 0),
    };
  }

  getPlayerCameraPosition() {
    const motorPosition = this.playerCharacter?.motor?.position;
    if ((this.needsInteractionCoordinator?.isLocked?.() || this.sleeping) && motorPosition) {
      return { x: Number(motorPosition.x), y: Number(motorPosition.y) };
    }
    return this.getPlayerPresentationPosition();
  }

  syncPlayerEnergyTarget() {
    if (!this.playerCharacter?.motor || !this.sessionState?.gameplay) return;
    const needsMovement = this.needsRuntime?.movementState?.();
    this.playerCharacter.motor.targetSpeedMultiplier = needsMovement?.multiplier ?? energyTargetSpeedMultiplier(
      this.sessionState.gameplay.currentEnergy,
      this.sessionState.gameplay.maximumEnergy,
      this.gameplayTuning.minimumFatigueSpeedMultiplier,
    );
    if (needsMovement && !needsMovement.runningAllowed) this.isRunning = false;
    this.playerCharacter.motor.runSpeedMultiplier = this.isRunning
      ? this.gameplayTuning.runSpeedMultiplier * (needsMovement?.runningSpeedMultiplier ?? 1)
      : 1;
  }

  createPersistence() {
    try {
      return createSessionPersistence({
        storage: window.localStorage,
        createFreshState: () => this.createFreshSessionState(),
      });
    } catch (error) {
      console.warn("Session persistence unavailable", error);
      return null;
    }
  }

  createFreshSessionState() {
    const villageLayout = this.worldLayout?.locationId === WORLD_IDS.village
      ? this.worldLayout
      : createWorldLayout(WORLD_IDS.village);
    const startingLayout = loadStartingLayout(window.localStorage, STARTING_LAYOUT_DEFAULT);
    const trainingDummyPosition = startingLayout?.furniture?.find(({ id }) => id === TRAINING_DUMMY.id)?.position;
    return createFreshGameSessionState({
      currentWorldId: WORLD_IDS.village,
      playerId: "player",
      initialEntityIds: NPCS.map((npc) => npc.id),
      initialWorldItems: createMeleeStartingWorldItems(villageLayout, [], trainingDummyPosition),
    });
  }

  saveSession() {
    if (this.needsRuntime?.shouldSuppressPersistence?.()) return { status: "debug-skipped" };
    const result = this.sessionPersistence?.save(this.sessionState);
    if (result?.status === "error") console.warn("Session save failed", result.diagnostic);
    return result;
  }

  applyColliderOverridesToLayout(layout) {
    for (const [id, offsets] of Object.entries(this.colliderOverrides ?? {})) layout.setColliderOverride(id, offsets);
  }

  applyLocationLayout(layout) {
    this.worldLayout = layout;
    if (this.characterSystem) this.characterSystem.collisionEnvironment = layout;
    this.renderWorld();
  }

  mountLocationLifecycle() { mountWorldLocation(this); }

  destroyLocationLifecycle() { destroyWorldLocation(this); }

  canTransitionLocation() { return canTransitionWorldLocation(this); }

  createMovementDebugPanel() {
    this.movementDebugPanel = new MovementDebugPanel({
      enabled: this.movementDebugEnabled,
      movementConfig: this.movementConfig,
      onConfigChange: () => this.syncNpcMovementConfig(),
      gameplayTuning: this.gameplayTuning,
      onGameplayTuningChange: (tuning) => {
        applyGameplayTuning(this.sessionState, tuning);
        this.cameraRuntime?.setTuning(tuning);
        this.syncPlayerEnergyTarget();
        this.gameHud?.render?.();
      },
      onRefillEnergy: () => { refillEnergy(this.sessionState); this.needsFlowRuntime?.reset(needMeterValues(this.sessionState.gameplay)); this.syncPlayerEnergyTarget(); this.gameHud?.render?.(); this.saveSession(); },
      onSetNeedsDebugPreset: (preset) => {
        if (preset === "clear") this.needsRuntime?.clearDebugPreset?.();
        else this.needsRuntime?.setDebugPreset?.(preset);
        this.needsFlowRuntime?.reset(needMeterValues(this.sessionState.gameplay));
        this.syncPlayerEnergyTarget();
        this.gameHud?.render?.();
      },
      onAddCookedDish: () => {
        const result = addInventoryItem(this.sessionState.gameplay.inventory, createInventoryItem("fried-potato-dish", 1));
        if (result.mutated) this.gameHud?.notifyInventoryGain?.(result);
        this.gameHud?.render?.();
        this.interactionRuntime?.refresh?.();
        this.saveSession();
      },
      onColliderVisibilityChange: (visible) => this.setColliderDebugVisible(visible),
      onBuildGridVisibilityChange: (visible) => this.buildMode?.setGridEnabled?.(visible),
      onColliderEditModeChange: (active) => this.setColliderEditMode(active),
      onPivotEditModeChange: (active) => this.setPivotEditMode(active),
      onVisualOffsetEditModeChange: (active) => this.setVisualOffsetEditMode(active),
      onColliderDraftConfirm: () => this.confirmColliderDraft(),
      onColliderRound: () => this.roundSelectedCollider(),
      onPivotAlign: (axis) => this.alignSelectedPivot(axis),
      onVisualOffsetReset: () => this.resetSelectedVisualOffset(),
      onResetBalanceRun: () => { resetBalanceRun(this.sessionState); this.lastSuccessfulHitAtMs = Number.NEGATIVE_INFINITY; this.debrisRuntime?.rebuild?.(); this.syncPlayerEnergyTarget(); this.gameHud?.render?.(); this.interactionRuntime?.refresh?.(); this.saveSession(); },
      getStatusSnapshot: () => {
        if (!this.playerCharacter) return null;
        return {
          energy: this.sessionState?.gameplay?.currentEnergy,
          clock: formatClock(this.sessionState?.gameplay?.worldTimeSeconds, this.localization.getLanguage()),
          smallLogsCleared: RESOURCE_OBJECTS.filter((item) => getResourceProfile(item.profileId).id === "log-small" && this.sessionState?.gameplay?.resourceNodes[item.id]?.cleared).length,
          wood: this.sessionState?.gameplay?.wood,
          stone: this.sessionState?.gameplay?.stone,
          rubies: this.sessionState?.gameplay?.rubies,
        };
      },
    });
    this.onColliderEditPointerDown = (pointer) => this.beginColliderEditPointer(pointer);
    this.onColliderEditPointerMove = (pointer) => this.continueColliderEditPointer(pointer);
    this.onColliderEditPointerUp = () => { this.colliderResizeDrag = null; };
    this.input.on("pointerdown", this.onColliderEditPointerDown);
    this.input.on("pointermove", this.onColliderEditPointerMove);
    this.input.on("pointerup", this.onColliderEditPointerUp);
    this.onPivotEditPointerDown = (pointer) => this.beginPivotEditPointer(pointer);
    this.onPivotEditPointerMove = (pointer) => this.continuePivotEditPointer(pointer);
    this.onPivotEditPointerUp = () => { this.pivotDrag = null; };
    this.onPivotKeyDown = (event) => this.handlePivotKeyDown(event);
    this.input.on("pointerdown", this.onPivotEditPointerDown);
    this.input.on("pointermove", this.onPivotEditPointerMove);
    this.input.on("pointerup", this.onPivotEditPointerUp);
    this.input.keyboard.on("keydown", this.onPivotKeyDown);
    this.onVisualOffsetEditPointerDown = (pointer) => this.beginVisualOffsetEditPointer(pointer);
    this.onVisualOffsetEditPointerMove = (pointer) => this.continueVisualOffsetEditPointer(pointer);
    this.onVisualOffsetEditPointerUp = () => { this.visualOffsetDrag = null; };
    this.onVisualOffsetKeyDown = (event) => this.handleVisualOffsetKeyDown(event);
    this.input.on("pointerdown", this.onVisualOffsetEditPointerDown);
    this.input.on("pointermove", this.onVisualOffsetEditPointerMove);
    this.input.on("pointerup", this.onVisualOffsetEditPointerUp);
    this.input.keyboard.on("keydown", this.onVisualOffsetKeyDown);
  }

  updateMovementDebugStatus() {
    this.movementDebugPanel?.updateStatus();
  }

  setColliderDebugVisible(visible) {
    this.colliderDebugVisible = Boolean(visible);
    if (!this.colliderDebugGraphics) this.colliderDebugGraphics = this.add.graphics().setDepth(8970);
    this.colliderDebugGraphics.setVisible(this.colliderDebugVisible);
    this.renderColliderDebug();
  }

  setColliderEditMode(active) {
    this.colliderEditEnabled = Boolean(active);
    if (this.colliderEditEnabled) {
      this.setColliderDebugVisible(true);
      this.colliderEditSelection = null;
      this.movementDebugPanel?.setColliderEditorState?.(null);
    }
    else {
      this.colliderEditSelection = null;
      this.movementDebugPanel?.setColliderEditorState?.(null);
      this.renderColliderDebug();
    }
  }

  beginColliderEditPointer(pointer) {
    if (!this.colliderEditEnabled || this.buildMode?.isActive?.()) return;
    const point = { x: Number(pointer.worldX ?? pointer.x), y: Number(pointer.worldY ?? pointer.y) };
    let selection = this.colliderEditSelection;
    let edges = selection ? getColliderResizeEdges(point, selection.draft) : null;
    if (edges) {
      this.colliderResizeDrag = { edges, startPoint: point, startDraft: { ...selection.draft } };
      return;
    }
    const entry = this.worldLayout.getWorldObjectColliders()
      .filter(({ rect }) => point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom)
      .sort((a, b) => ((a.rect.right - a.rect.left) * (a.rect.bottom - a.rect.top))
        - ((b.rect.right - b.rect.left) * (b.rect.bottom - b.rect.top)))[0];
    if (!entry) return;
    this.colliderEditSelection = { id: entry.id, groupKey: entry.groupKey, base: { ...entry.base }, draft: { ...entry.rect } };
    selection = this.colliderEditSelection;
    edges = getColliderResizeEdges(point, selection.draft);
    if (edges) this.colliderResizeDrag = { edges, startPoint: point, startDraft: { ...selection.draft } };
    this.syncColliderEditorPanel();
    this.renderColliderDebug();
  }

  continueColliderEditPointer(pointer) {
    if (!this.colliderEditEnabled || !this.colliderResizeDrag || !pointer.isDown || !this.colliderEditSelection) return;
    const point = { x: Number(pointer.worldX ?? pointer.x), y: Number(pointer.worldY ?? pointer.y) };
    this.colliderEditSelection.draft = resizeColliderDraft(
      this.colliderResizeDrag.startDraft,
      this.colliderResizeDrag.edges,
      { x: point.x - this.colliderResizeDrag.startPoint.x, y: point.y - this.colliderResizeDrag.startPoint.y },
    );
    this.syncColliderEditorPanel();
    this.renderColliderDebug();
  }

  confirmColliderDraft() {
    const selection = this.colliderEditSelection;
    if (!selection) return { status: "empty" };
    const offsets = {
      left: selection.draft.left - selection.base.left,
      right: selection.draft.right - selection.base.right,
      top: selection.draft.top - selection.base.top,
      bottom: selection.draft.bottom - selection.base.bottom,
    };
    this.colliderOverrides[selection.groupKey] = offsets;
    if (this.assetProfiles?.[selection.groupKey]) {
      this.assetProfiles = {
        ...this.assetProfiles,
        [selection.groupKey]: { ...this.assetProfiles[selection.groupKey], colliderOffsets: { ...offsets } },
      };
      saveAssetProfiles(this.assetProfiles, window.localStorage);
    }
    this.worldLayout.setColliderOverride(selection.groupKey, offsets);
    saveColliderDebugOverrides(this.colliderOverrides, window.localStorage);
    this.colliderEditSelection.draft = { ...this.worldLayout.getWorldObjectColliders().find(({ id }) => id === selection.id)?.rect };
    this.syncColliderEditorPanel();
    this.renderColliderDebug();
    return { status: "saved", id: selection.id };
  }

  roundSelectedCollider() {
    const selection = this.colliderEditSelection;
    if (!selection) return { status: "empty" };
    if (!this.assetProfiles?.[selection.groupKey]) return { status: "unsupported" };
    selection.draft = roundColliderDraftToGrid(selection.draft, PLACEMENT_CELL_SIZE, 2);
    this.syncColliderEditorPanel();
    this.renderColliderDebug();
    return { status: "rounded", id: selection.id, draft: { ...selection.draft } };
  }

  alignSelectedPivot(axis) {
    const selection = this.movementDebugPanel?.authoringRuntime?.alignPivotToCollider?.(axis) ?? null;
    this.movementDebugPanel?.setPivotEditorState?.(selection);
    this.renderPivotDebug();
    return selection;
  }

  resetSelectedVisualOffset() {
    const selection = this.movementDebugPanel?.authoringRuntime?.resetVisualOffset?.() ?? null;
    this.movementDebugPanel?.setVisualOffsetEditorState?.(selection);
    this.renderVisualOffsetDebug();
    return selection;
  }

  syncColliderEditorPanel() {
    const selection = this.colliderEditSelection;
    this.movementDebugPanel?.setColliderEditorState?.(selection ? {
      id: selection.groupKey,
      width: selection.draft.right - selection.draft.left,
      height: selection.draft.bottom - selection.draft.top,
    } : null);
  }

  renderColliderDebug() {
    const graphics = this.colliderDebugGraphics;
    if (!graphics) return;
    graphics.clear();
    if (!this.colliderDebugVisible) return;
    graphics.fillStyle(0xffb24d, 0.22);
    for (const cell of this.worldLayout.blocked) {
      const [x, y] = cell.split(",").map(Number);
      graphics.fillRect(x * this.worldLayout.cellSize, y * this.worldLayout.cellSize, this.worldLayout.cellSize, this.worldLayout.cellSize);
    }
    graphics.lineStyle(1, 0xff4f63, 0.55);
    for (const box of [...this.worldLayout.wallColliders, ...this.worldLayout.objectColliders]) {
      const pixelBounds = getPixelColliderBounds(box);
      graphics.strokeRect(
        pixelBounds.left + 0.5,
        pixelBounds.top + 0.5,
        pixelBounds.right - pixelBounds.left,
        pixelBounds.bottom - pixelBounds.top,
      );
    }
    graphics.lineStyle(1, 0x54d8ff, 0.55);
    for (const character of this.characterSystem?.values?.() ?? []) {
      const box = getFootBox(character.motor.position, character.footWidth, character.footDepth);
      graphics.strokeRect(box.left, box.top, box.right - box.left, box.bottom - box.top);
    }
    const draft = this.colliderEditSelection?.draft;
    if (draft) {
      const pixelBounds = getPixelColliderBounds(draft);
      const centerX = Math.round((pixelBounds.left + pixelBounds.right) / 2);
      const centerY = Math.round((pixelBounds.top + pixelBounds.bottom) / 2);
      graphics.lineStyle(1, 0x62ff91, 0.55);
      graphics.strokeRect(
        pixelBounds.left + 0.5,
        pixelBounds.top + 0.5,
        pixelBounds.right - pixelBounds.left,
        pixelBounds.bottom - pixelBounds.top,
      );
      graphics.fillStyle(0xffffff, 1);
      for (const [x, y] of [
        [pixelBounds.left, pixelBounds.top], [centerX, pixelBounds.top], [pixelBounds.right, pixelBounds.top],
        [pixelBounds.left, centerY], [pixelBounds.right, centerY],
        [pixelBounds.left, pixelBounds.bottom], [centerX, pixelBounds.bottom], [pixelBounds.right, pixelBounds.bottom],
      ]) {
        graphics.fillRect(x, y, 1, 1);
      }
    }
  }

  createHud() {
    this.gameContainer = document.getElementById("game");
    this.gameHud = createGameHud(this, {
      buildId: BUILD_ID,
      localization: this.localization,
      gameContainer: this.gameContainer,
      audioSettings: this.audioSettings,
      isCoarsePointer: () => this.isCoarsePointer(),
      getGameplayState: () => ({ ...this.sessionState?.gameplay, clock: formatClock(this.sessionState.gameplay.worldTimeSeconds, this.localization.getLanguage()), sleeping: this.sleeping, timeScale: this.simulationScale, selectedTimeScale: this.playerTimeScale, energyFlow: this.getEnergyFlow(), needsFlow: this.getNeedsHudFlow() }),
      onLanguageChange: () => this.interactionRuntime?.refresh?.(), onTimeScaleChange: (scale) => { if (scale > 1) this.audioRuntime?.playEffect?.("time-speed-up"); else if (scale === 1 && this.playerTimeScale !== 1) this.audioRuntime?.playEffect?.("time-speed-normal"); this.playerTimeScale = scale; }, onDroppedItemCollision: (item, collider) => this.farmingRuntime?.handleDroppedItemCollision?.(item, collider), playEffect: (type) => this.audioRuntime?.playEffect?.(type),
      onCoinDrop: (pointerWorld) => this.tavernServiceRuntime?.dropWalletCoin?.({
        position: this.playerCharacter?.motor?.position,
        playerSprite: this.playerCharacter?.sprite,
        facing: this.playerCharacter?.lastFacing,
        pointerWorld,
      }),
      onOptionsChange: (active) => { this.audioRuntime?.playEffect?.(active ? "menu-open" : "menu-close"); this.optionsOpen = Boolean(active); this.syncGameplayHudVisibility(); this.cookingRuntime?.setInputSuppressed?.(active); },
      onConfirmationChange: (active) => {
        this.gameHudConfirmationActive = Boolean(active);
        this.syncGameplayHudVisibility();
        this.cookingRuntime?.setInputSuppressed?.(active);
        if (!active) this.interactionRuntime?.refresh?.();
      },
      onNewGame: () => this.startNewGame(),
    });
    if (this.pendingTask049MigrationWarning) {
      this.gameHud.showTransientMessage("hud:migration.task049");
      this.sessionState.flags["migration.task049WarningPending"] = false;
      this.pendingTask049MigrationWarning = false;
      this.saveSession();
    }
    this.syncGameplayHudVisibility();
  }

  createFarmingRuntime() {
    this.farmingRuntime = createFarmingRuntime(this, {
      sessionState: this.sessionState,
      worldLayout: this.worldLayout,
      getSelectedItem: () => this.gameHud?.getSelectedInventoryItem?.() ?? null,
      spawnHarvestDrops: (itemId, quantity, origin) => this.gameHud?.spawnWorldItems?.(itemId, quantity, origin),
      isModalActive: () => Boolean(this.merchantRuntime?.isActive?.()
        || this.cookingRuntime?.isActive?.() || this.buildMode?.isActive?.() || this.gameHudConfirmationActive),
      canPerformPhysicalAction: (toolId) => this.needsRuntime?.canPerformPhysicalAction?.(toolId) ?? { allowed: true, cost: 0 },
      recordPhysicalAction: (toolId) => this.needsRuntime?.recordPhysicalAction?.(toolId),
      onPersistentMutation: () => { this.gameHud?.render?.(); this.interactionRuntime?.refresh?.(); this.saveSession(); }, playEffect: (type) => this.audioRuntime?.playEffect?.(type),
    });
  }

  createCookingRuntime() {
    this.cookingRuntime = createCookingRuntime(this, {
      sessionState: this.sessionState,
      localization: this.localization, playEffect: (type) => this.audioRuntime?.playEffect?.(type),
      onInventoryGain: (result) => this.gameHud?.notifyInventoryGain?.(result),
      onActiveChange: (active) => {
        this.cookingOverlayActive = Boolean(active);
        this.gameHud?.setGameplayOverlayActive?.(active);
        this.syncGameplayHudVisibility();
        this.mobileJoystick?.reset?.();
        if (active) {
          const player = this.characterSystem?.require?.(this.sessionState.playerId);
          if (player?.motor?.movement?.velocity) {
            player.motor.movement.velocity.x = 0;
            player.motor.movement.velocity.y = 0;
          }
        } else {
          this.interactionRuntime?.refresh?.();
        }
      },
      onPersistentMutation: () => {
        this.facilityRuntime?.syncKitchenVisuals?.();
        this.gameHud?.render?.();
        this.interactionRuntime?.refresh?.();
        this.saveSession();
      },
    });
    this.kitchenInteractionRuntime = createKitchenInteractionRuntime({
      sessionState: this.sessionState,
      facilityRuntime: this.facilityRuntime,
      cookingRuntime: this.cookingRuntime,
      localization: this.localization,
      getSelectedItem: () => this.gameHud?.getSelectedInventoryItem?.() ?? null,
      onInventoryGain: (result) => this.gameHud?.notifyInventoryGain?.(result),
      showMessage: (key, options) => this.gameHud?.showTransientMessage?.(key, options),
      playEffect: (type) => this.audioRuntime?.playEffect?.(type),
      onPersistentMutation: () => {
        this.gameHud?.render?.();
        this.interactionRuntime?.refresh?.();
        this.saveSession();
      },
    });
  }

  createMeleeRuntime() {
    this.meleeRuntime = createMeleeRuntime(this, {
      worldLayout: this.worldLayout,
      includeTrainingDummy: this.worldLocationCoordinator.hasCapability("trainingDummy"),
      getPlayerCharacter: () => this.playerCharacter,
      getSelectedItem: () => this.frameMeleeItem,
      getControllerMoveDirection: () => this.getControllerMoveDirection(),
      playEffect: (type) => this.audioRuntime?.playEffect?.(type),
      damageLog: (resourceId, multiplier) => this.debrisRuntime?.damageLog?.(resourceId, multiplier),
      canPerformPhysicalAction: (weaponId) => this.needsRuntime?.canPerformPhysicalAction?.(weaponId) ?? { allowed: true, cost: 0 },
      recordPhysicalAction: (weaponId) => this.needsRuntime?.recordPhysicalAction?.(weaponId),
      isSuppressed: () => Boolean(
        this.sleeping
        || this.optionsOpen
        || this.gameHudConfirmationActive
        || this.buildMode?.isActive?.()
        || this.cookingRuntime?.isActive?.()
        || this.facilityRuntime?.isUsing?.()
        || this.needsInteractionCoordinator?.isLocked?.()
        || this.interactionRuntime?.isDialogueActive?.()
        || this.merchantRuntime?.isActive?.()
      ),
    });
  }

  createBuildCoordinator() {
    this.worldBuildCoordinator = createWorldBuildCoordinator({
      renderingHost: this,
      localization: this.localization,
      worldLayout: this.worldLayout,
      assetProfiles: () => this.assetProfiles,
      farmState: this.sessionState.gameplay.farm,
      groundSprites: this.groundSprites,
      floorSprites: this.floorSprites,
      wallSprites: this.wallSprites,
      facilityRuntime: this.facilityRuntime,
      debrisRuntime: this.debrisRuntime,
      tavernSignRuntime: this.tavernSignRuntime,
      meleeRuntime: this.meleeRuntime,
      hasFarmCell: (point) => this.farmingRuntime?.hasFarmCell?.(point) ?? false,
      getPlayerFootBox: () => {
        const player = this.characterSystem?.require?.(this.sessionState.playerId);
        return player
          ? getFootBox(player.motor.position, player.motor.footWidth, player.motor.footDepth)
          : null;
      },
      addCanonicalTile: (tile, textureKey, depth) => this.addTile(tile, textureKey, depth),
      createCanonicalWallEntry: (tile) => this.createCanonicalWallEntry(tile),
      playEffect: (effect) => this.audioRuntime?.playEffect?.(effect),
      refreshInteractions: () => this.interactionRuntime?.refresh?.(),
      persistGameplay: () => this.saveSession(),
      isActivationAllowed: () => !this.cookingRuntime?.isActive?.(),
      getBuildGridEnabled: () => Boolean(this.movementDebugPanel?.buildGridCheckbox?.checked),
      onModeChange: (active) => {
        this.audioRuntime?.playEffect?.(active ? "menu-open" : "menu-close");
        this.syncGameplayHudVisibility();
        this.movementDebugPanel?.setSuppressed?.(active);
        this.mobileJoystick?.reset?.();
        if (!active) this.interactionRuntime?.refresh?.();
      },
    });
    this.buildMode = this.worldBuildCoordinator.getBuildModeRuntime();
    this.farmingRuntime?.attachWorldBuildCoordinator?.(this.worldBuildCoordinator);
  }

  syncGameplayHudVisibility() {
    const buildActive = this.buildMode?.isActive?.() ?? false;
    const gameplayOverlay = this.gameHudHidden || buildActive || this.cookingOverlayActive || this.gameHudConfirmationActive;
    this.gameHud?.setSuppressed?.(this.gameHudHidden || buildActive);
    this.uiVisibilityCoordinator?.setClassHidden("gameplay-overlay", gameplayOverlay);
    this.uiVisibilityCoordinator?.setClassHidden("option-sensitive", this.optionsOpen);
    this.uiVisibilityCoordinator?.setClassHidden("merchant-active", this.merchantRuntime?.isActive?.());
    this.uiVisibilityCoordinator?.setClassHidden("inventory-action-blocked", this.gameHud?.isInventoryInteractionBlocked?.() ?? false);
    if (this.gameHudHidden) this.mobileJoystick?.reset?.();
  }

  setPivotEditMode(active) {
    this.pivotEditEnabled = Boolean(active);
    if (!this.pivotDebugGraphics) this.pivotDebugGraphics = this.add.graphics().setDepth(8975);
    this.pivotDebugGraphics.setVisible(this.pivotEditEnabled);
    if (this.pivotEditEnabled) {
      this.movementDebugPanel?.setPivotEditorState?.(null);
    } else {
      this.pivotDrag = null;
      this.movementDebugPanel?.authoringRuntime?.clearPivotSelection?.();
      this.movementDebugPanel?.setPivotEditorState?.(null);
    }
    this.renderPivotDebug();
  }

  beginPivotEditPointer(pointer) {
    if (!this.pivotEditEnabled || this.buildMode?.isActive?.()) return;
    const point = { x: Math.round(Number(pointer.worldX ?? pointer.x)), y: Math.round(Number(pointer.worldY ?? pointer.y)) };
    const runtime = this.movementDebugPanel?.authoringRuntime;
    const selection = runtime?.selectPivotAt?.(point);
    if (!selection) {
      this.movementDebugPanel?.setPivotEditorState?.(null);
      this.renderPivotDebug();
      return;
    }
    this.pivotDrag = { startPoint: point, startOffset: { ...selection.offset } };
    this.movementDebugPanel?.setPivotEditorState?.(selection);
    this.renderPivotDebug();
  }

  continuePivotEditPointer(pointer) {
    if (!this.pivotEditEnabled || !this.pivotDrag || !pointer.isDown) return;
    const point = { x: Math.round(Number(pointer.worldX ?? pointer.x)), y: Math.round(Number(pointer.worldY ?? pointer.y)) };
    const selection = this.movementDebugPanel?.authoringRuntime?.setPivotOffset?.({
      x: this.pivotDrag.startOffset.x + point.x - this.pivotDrag.startPoint.x,
      y: this.pivotDrag.startOffset.y + point.y - this.pivotDrag.startPoint.y,
    });
    this.movementDebugPanel?.setPivotEditorState?.(selection);
    this.renderPivotDebug();
  }

  handlePivotKeyDown(event) {
    if (!this.pivotEditEnabled) return;
    const delta = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    }[event?.key];
    if (!delta) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    const selection = this.movementDebugPanel?.authoringRuntime?.nudgePivot?.(delta.x, delta.y);
    this.movementDebugPanel?.setPivotEditorState?.(selection);
    this.renderPivotDebug();
  }

  renderPivotDebug() {
    const graphics = this.pivotDebugGraphics;
    if (!graphics) return;
    graphics.clear();
    if (!this.pivotEditEnabled) return;
    const marker = this.movementDebugPanel?.authoringRuntime?.getPivotSelection?.()?.marker;
    if (!marker) return;
    graphics.fillStyle(0xffff3b, 1);
    graphics.fillRect(Math.round(marker.x), Math.round(marker.y), 1, 1);
  }

  setVisualOffsetEditMode(active) {
    this.visualOffsetEditEnabled = Boolean(active);
    if (!this.visualOffsetDebugGraphics) this.visualOffsetDebugGraphics = this.add.graphics().setDepth(8975);
    this.visualOffsetDebugGraphics.setVisible(this.visualOffsetEditEnabled);
    if (this.visualOffsetEditEnabled) {
      this.movementDebugPanel?.setVisualOffsetEditorState?.(null);
    } else {
      this.visualOffsetDrag = null;
      this.movementDebugPanel?.authoringRuntime?.clearVisualOffsetSelection?.();
      this.movementDebugPanel?.setVisualOffsetEditorState?.(null);
    }
    this.renderVisualOffsetDebug();
  }

  beginVisualOffsetEditPointer(pointer) {
    if (!this.visualOffsetEditEnabled || this.buildMode?.isActive?.()) return;
    const point = { x: Math.round(Number(pointer.worldX ?? pointer.x)), y: Math.round(Number(pointer.worldY ?? pointer.y)) };
    const selection = this.movementDebugPanel?.authoringRuntime?.selectVisualOffsetAt?.(point);
    if (!selection) {
      this.movementDebugPanel?.setVisualOffsetEditorState?.(null);
      this.renderVisualOffsetDebug();
      return;
    }
    this.visualOffsetDrag = { startPoint: point, startOffset: { ...selection.offset } };
    this.movementDebugPanel?.setVisualOffsetEditorState?.(selection);
    this.renderVisualOffsetDebug();
  }

  continueVisualOffsetEditPointer(pointer) {
    if (!this.visualOffsetEditEnabled || !this.visualOffsetDrag || !pointer.isDown) return;
    const point = { x: Math.round(Number(pointer.worldX ?? pointer.x)), y: Math.round(Number(pointer.worldY ?? pointer.y)) };
    const selection = this.movementDebugPanel?.authoringRuntime?.setVisualOffset?.({
      x: this.visualOffsetDrag.startOffset.x + point.x - this.visualOffsetDrag.startPoint.x,
      y: this.visualOffsetDrag.startOffset.y + point.y - this.visualOffsetDrag.startPoint.y,
    });
    this.movementDebugPanel?.setVisualOffsetEditorState?.(selection);
    this.renderVisualOffsetDebug();
  }

  handleVisualOffsetKeyDown(event) {
    if (!this.visualOffsetEditEnabled) return;
    const delta = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    }[event?.key];
    if (!delta) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    const selection = this.movementDebugPanel?.authoringRuntime?.nudgeVisualOffset?.(delta.x, delta.y);
    this.movementDebugPanel?.setVisualOffsetEditorState?.(selection);
    this.renderVisualOffsetDebug();
  }

  renderVisualOffsetDebug() {
    const graphics = this.visualOffsetDebugGraphics;
    if (!graphics) return;
    graphics.clear();
    if (!this.visualOffsetEditEnabled) return;
    const bounds = this.movementDebugPanel?.authoringRuntime?.getVisualOffsetSelection?.()?.displayBounds;
    if (!bounds) return;
    graphics.lineStyle(1, 0x45e8ff, 0.9);
    graphics.strokeRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
  }

  updateFullscreenHud() {
    this.gameHud?.render();
  }

  isHudPoint(x, y) {
    return Boolean(this.gameHud?.isPointInHud(x, y))
      || Boolean(this.interactionHud?.isPointInHud(x, y))
      || Boolean(this.merchantRuntime?.isPointInHud?.(x, y))
      || Boolean(this.cookingRuntime?.isPointInHud?.(x, y));
  }

  startNewGame() {
    const result = this.sessionPersistence?.clear();
    if (result?.status === "error") console.warn("Session reset failed", result.diagnostic);
    this.scene.restart();
  }

  installE2EBridge() { installWorldE2EBridge(this); }
  isCoarsePointer() {
    return window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  }

  attachSceneListeners() {
    this.gameCanvasInputGuard = createGameCanvasInputGuard(this.game.canvas);
    this.onFullscreenChange = () => {
      this.syncIntegerZoom();
      this.updateFullscreenHud();
    };

    document.addEventListener("fullscreenchange", this.onFullscreenChange);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.syncIntegerZoom, this);
    this.sceneListenersAttached = true;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroySceneListeners, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.destroySceneListeners, this);
  }

  syncIntegerZoom() {
    const zoom = this.scale.getMaxZoom();
    if (this.scale.zoom !== zoom) this.scale.setZoom(zoom);
  }

  createJoystick() {
    this.mobileJoystick = createMobileJoystick(this, {
      isExcludedPoint: (x, y) => this.isHudPoint(x, y),
    });
  }

  destroySceneListeners() {
    if (!this.sceneListenersAttached) return;
    this.sceneListenersAttached = false;
    this.gameCanvasInputGuard?.destroy();
    this.gameCanvasInputGuard = null;
    document.removeEventListener("fullscreenchange", this.onFullscreenChange);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.syncIntegerZoom, this);
    this.mobileJoystick?.destroy();
    this.mobileJoystick = null;
    this.interactionRuntime?.destroy();
    this.interactionRuntime = null;
    this.destroyLocationLifecycle();
    this.worldLocationCoordinator?.destroy?.();
    this.worldLocationCoordinator = null;
    this.cameraRuntime?.destroy();
    this.cameraRuntime = null;
    this.uiVisibilityCoordinator?.destroy(); this.uiVisibilityCoordinator = null;
    this.interactionHud?.destroy();
    this.interactionHud = null;
    this.movementDebugPanel?.destroy();
    this.movementDebugPanel = null;
    if (this.onColliderEditPointerDown) this.input.off("pointerdown", this.onColliderEditPointerDown);
    if (this.onColliderEditPointerMove) this.input.off("pointermove", this.onColliderEditPointerMove);
    if (this.onColliderEditPointerUp) this.input.off("pointerup", this.onColliderEditPointerUp);
    this.onColliderEditPointerDown = null;
    this.onColliderEditPointerMove = null;
    this.onColliderEditPointerUp = null;
    if (this.onPivotEditPointerDown) this.input.off("pointerdown", this.onPivotEditPointerDown);
    if (this.onPivotEditPointerMove) this.input.off("pointermove", this.onPivotEditPointerMove);
    if (this.onPivotEditPointerUp) this.input.off("pointerup", this.onPivotEditPointerUp);
    if (this.onPivotKeyDown) this.input.keyboard.off("keydown", this.onPivotKeyDown);
    this.onPivotEditPointerDown = null;
    this.onPivotEditPointerMove = null;
    this.onPivotEditPointerUp = null;
    this.onPivotKeyDown = null;
    if (this.onVisualOffsetEditPointerDown) this.input.off("pointerdown", this.onVisualOffsetEditPointerDown);
    if (this.onVisualOffsetEditPointerMove) this.input.off("pointermove", this.onVisualOffsetEditPointerMove);
    if (this.onVisualOffsetEditPointerUp) this.input.off("pointerup", this.onVisualOffsetEditPointerUp);
    if (this.onVisualOffsetKeyDown) this.input.keyboard.off("keydown", this.onVisualOffsetKeyDown);
    this.onVisualOffsetEditPointerDown = null;
    this.onVisualOffsetEditPointerMove = null;
    this.onVisualOffsetEditPointerUp = null;
    this.onVisualOffsetKeyDown = null;
    this.visualOffsetDebugGraphics?.destroy();
    this.visualOffsetDebugGraphics = null;
    if (this.onHudToggleKey) this.input.keyboard.off("keydown-X", this.onHudToggleKey);
    this.onHudToggleKey = null;
    this.pivotDebugGraphics?.destroy();
    this.pivotDebugGraphics = null;
    this.colliderDebugGraphics?.destroy();
    this.colliderDebugGraphics = null;
    this.characterSystem?.destroy();
    this.characterSystem = null;
    this.gameHud?.destroy();
    this.gameHud = null;
    this.audioRuntime?.destroy();
    this.audioRuntime = null;
    if (window.__NESTLED_BURROW_E2E__ === this.e2eBridge) {
      delete window.__NESTLED_BURROW_E2E__;
    }
    this.e2eBridge = null;
  }

  startSleeping({ exhausted = false, bedId = null, presentationHandled = false } = {}) {
    this.sleeping = true;
    this.exhaustedSleeping = exhausted;
    this.simulationScale = this.getSleepTimeScale();
    this.timeScale = this.simulationScale;
    const player = this.characterSystem.require(this.sessionState.playerId);
    if (exhausted) {
      player.motor.movement = createMovementState({ facing: { x: 0, y: 1 } });
      player.visual.setPresentationPose({ x: player.motor.position.x, y: player.motor.position.y - 4, facing: "up", angle: -90, showSleepMarker: true });
    } else {
      const bed = this.debrisRuntime?.getBedDefinition?.(bedId) ?? BED_OBJECT;
      this.sleepingBedId = bed.id;
      player.motor.movement = createMovementState({ facing: { x: -1, y: 0 } });
      if (!presentationHandled) player.visual.setPresentationPose({ x: bed.position.x, y: bed.position.y - 1, facing: "right", angle: -90, showSleepMarker: true });
    }
    this.debrisRuntime?.setSleeping(true, this.sleepingBedId);
    this.syncLowEnergyMarker();
    this.interactionRuntime?.refresh?.();
    this.gameHud?.render?.();
  }

  wakeUp({ presentationHandled = false } = {}) {
    this.sleeping = false;
    this.exhaustedSleeping = false;
    this.simulationScale = this.playerTimeScale = 1;
    this.timeScale = 1;
    const player = this.characterSystem.require(this.sessionState.playerId);
    if (!presentationHandled) player.visual.setPresentationPose(null);
    player.motor.movement = createMovementState({ facing: { x: 0, y: 1 } });
    this.debrisRuntime?.setSleeping(false);
    this.sleepingBedId = null;
    this.syncLowEnergyMarker();
    this.interactionRuntime?.refresh?.();
    this.gameHud?.render?.();
    this.saveSession();
  }

  updateGameplayTime(deltaMs) {
    const realSeconds = Math.max(0, deltaMs) / 1000;
    this.simulationScale = this.sleeping ? this.getSleepTimeScale() : this.playerTimeScale;
    this.timeScale = this.simulationScale;
    advanceGameTime(this.sessionState, realSeconds, this.simulationScale);
    this.farmingRuntime?.advanceTo?.(this.sessionState.gameplay.worldTimeSeconds);
    const activity = this.getNeedsActivityContext();
    const needsSnapshot = this.needsRuntime.update({
      realSeconds,
      simulationScale: this.simulationScale,
      sleeping: this.sleeping,
      collapsed: this.exhaustedSleeping,
      protectedNeed: this.needsInteractionCoordinator?.getProtectedNeed?.() ?? null,
      activity,
    });
    this.needsFlow = needsSnapshot.flow;
    const activeFacility = this.facilityRuntime?.getActiveType?.();
    if ((activeFacility === "shower" && this.sessionState.gameplay.needs.lustre >= 100)
      || (activeFacility === "toilet" && this.sessionState.gameplay.needs.toilet >= 100)
      || (activeFacility === "table" && this.sessionState.gameplay.needs.satiety >= 100)) {
      this.needsInteractionCoordinator.exit();
    }
    this.syncPlayerEnergyTarget();
    this.updateDayNightLighting?.();
    this.needsFlowRuntime?.advance(needMeterValues(this.sessionState.gameplay), deltaMs);
    this.gameHud?.render?.();
    this.autosaveAccumulatorSeconds = (this.autosaveAccumulatorSeconds ?? 0) + realSeconds;
    if (this.autosaveAccumulatorSeconds >= 1) {
      this.autosaveAccumulatorSeconds = 0;
      this.saveSession();
    }
  }

  update(_time, delta) {
    this.sampleFrameActions();
    this.meleeRuntime?.handleActions?.(this.frameActions);
    const realDeltaMs = delta;
    this.needsInteractionCoordinator?.update(realDeltaMs);
    this.updateGameplayTime(realDeltaMs);
    this.cookingRuntime?.update?.(realDeltaMs);
    let worldDeltaMs = realDeltaMs * (this.simulationScale ?? 1);
    this.setNpcAnimationTimeScale(this.simulationScale ?? 1);
    while (worldDeltaMs > 0) {
      const substepMs = Math.min(50, worldDeltaMs);
      this.tavernServiceRuntime?.update(substepMs);
      this.meleeRuntime?.beforeCharacterUpdate?.(substepMs);
      this.characterSystem?.update(substepMs);
      this.meleeRuntime?.afterCharacterUpdate?.(substepMs);
      worldDeltaMs -= substepMs;
    }
    this.worldLocationCoordinator?.update?.();
    this.cameraRuntime?.update({
      presentationPosition: this.getPlayerCameraPosition(),
      speed: this.playerCharacter?.speed ?? 0,
      deltaMs: realDeltaMs,
      maxPresentationSpeed: this.meleeRuntime?.getCameraFollowSpeedLimit?.(),
    });
    this.interactionRuntime?.update({ actions: this.frameActions });
    const currentCandidate = this.interactionRuntime?.getCurrentCandidate?.() ?? null;
    this.merchantRuntime?.updateCandidate?.(currentCandidate);
    this.debrisRuntime?.updateCandidate?.(currentCandidate); this.farmingRuntime?.updateCandidate?.(currentCandidate);
    this.interactionHud?.setCooldownProgress?.(this.getInteractionCooldownProgress());
    this.updateMovementDebugStatus();
    this.renderColliderDebug();
  }

  sampleFrameActions() {
    const pointerActionId = this.meleeRuntime?.consumePointerAction?.() ?? null;
    if (this.buildMode?.isActive?.() || this.cookingRuntime?.isActive?.()) {
      this.isRunning = false;
      this.frameMeleeItem = null;
      this.frameActions = Object.freeze({ interact: false, primary: false, secondary: false });
      return;
    }
    const keyboardPressed =
      Phaser.Input.Keyboard.JustDown(this.interactKeys.SPACE);
    const shiftPressed = Phaser.Input.Keyboard.JustDown(this.runKey);
    const heldResourceInteract = this.interactKeys.SPACE.isDown && this.interactionRuntime?.getCurrentCandidate?.()?.kind === RESOURCE_INTERACTION_KIND;
    const mobilePressed = this.interactionHud?.consumeInteractPressed() ?? false;
    const mobileHeldResourceInteract = this.interactionHud?.isInteractHeld?.()
      && this.interactionRuntime?.getCurrentCandidate?.()?.kind === RESOURCE_INTERACTION_KIND;
    const interactionBlocked = this.gameHud?.isInventoryInteractionBlocked?.() ?? false;
    const actionIds = [keyboardPressed || mobilePressed ? "space" : null, pointerActionId, shiftPressed ? "shift" : null].filter(Boolean);
    this.frameMeleeItem = resolveMeleeActionItem(actionIds, (actionId) => this.gameHud?.getCombatActionItem?.(actionId));
    const shiftMeleeEquipped = isMeleeWeaponId(this.gameHud?.getCombatActionItem?.("shift")?.id);
    const runningAllowed = this.needsRuntime?.movementState?.().runningAllowed ?? true;
    const nextRunning = Boolean((this.runKey?.isDown && !shiftMeleeEquipped) || this.mobileJoystick?.isSprinting?.()) && !this.sleeping && !this.needsInteractionCoordinator?.isLocked?.() && runningAllowed; if (nextRunning !== this.isRunning && Math.hypot(...Object.values(this.getMovementVector())) > 0.1) this.audioRuntime?.playEffect?.(nextRunning ? "sprint-on" : "sprint-off"); this.isRunning = nextRunning;
    this.syncPlayerEnergyTarget();
    this.syncLowEnergyMarker();
    this.frameActions = Object.freeze({
      interact: interactionBlocked || this.suppressNextInteract ? false : (keyboardPressed || heldResourceInteract || mobilePressed || mobileHeldResourceInteract),
      primary: Boolean(this.frameMeleeItem) && !this.suppressNextInteract,
      secondary: false,
    });
    this.suppressNextInteract = false;
  }

  getHitCooldownProgress(nowMs = globalThis.performance?.now?.() ?? Date.now()) {
    const durationMs = this.gameplayTuning?.universalHitCooldownSeconds * 1000;
    if (!(durationMs > 0) || !Number.isFinite(this.lastSuccessfulHitAtMs)) return 0;
    return Math.max(0, Math.min(1, 1 - (nowMs - this.lastSuccessfulHitAtMs) / durationMs));
  }

  getInteractionCooldownProgress(nowMs = globalThis.performance?.now?.() ?? Date.now()) {
    return this.getHitCooldownProgress(nowMs);
  }

  getSleepTimeScale() {
    return this.gameplayTuning.sleepTimeScale * (this.exhaustedSleeping ? this.gameplayTuning.exhaustionSleepScaleMultiplier : 1);
  }

  getEnergyFlow() {
    const gameplay = this.sessionState?.gameplay;
    return gameplay ? this.needsFlowRuntime?.observe(needMeterValues(gameplay)).energy ?? null : null;
  }

  getNeedsHudFlow() {
    const gameplay = this.sessionState?.gameplay;
    if (!gameplay) return null;
    const { energy, ...needsFlow } = this.needsFlowRuntime?.observe(needMeterValues(gameplay)) ?? {};
    return needsFlow;
  }

  getNeedsActivityContext(nowMs = globalThis.performance?.now?.() ?? Date.now()) {
    const player = this.playerCharacter?.motor;
    const moving = this.e2eEnergyMotion?.moving ?? (player?.speed >= player?.movementConfig?.movingSpeedThreshold);
    const running = Boolean(moving && (this.e2eEnergyMotion?.running ?? this.isRunning));
    const hitWindowMs = this.gameplayTuning.universalHitCooldownSeconds * 1000;
    const resourceActive = Boolean(this.activeResourceProfileId)
      && nowMs - this.lastSuccessfulHitAtMs <= hitWindowMs;
    const resourceKind = resourceActive ? getResourceProfile(this.activeResourceProfileId).kind : null;
    const playerPosition = player?.position;
    const npcNearby = Boolean(playerPosition && NPCS.some((npc) => {
      if (!this.characterSystem?.has?.(npc.id)) return false;
      const position = this.characterSystem?.getSnapshot?.(npc.id)?.position;
      return position && Math.hypot(position.x - playerPosition.x, position.y - playerPosition.y) <= this.gameplayTuning.needs.dialogue.radius;
    }));
    return {
      facility: this.facilityRuntime?.getActiveType?.() ?? null,
      moving,
      running,
      activeResourceKind: resourceKind,
      activePhysicalTool: this.needsRuntime?.getState?.().activePhysicalTool,
      npcNearby,
      sharedRest: Boolean(npcNearby && (this.facilityRuntime?.getActiveType?.() === "table" || this.sleeping)),
      physicalAction: resourceActive,
    };
  }

  syncLowEnergyMarker() {
    const gameplay = this.sessionState?.gameplay;
    const fraction = gameplay?.maximumEnergy > 0 ? gameplay.currentEnergy / gameplay.maximumEnergy : 0;
    this.playerCharacter?.visual?.setLowEnergyMarker?.(!this.sleeping && fraction > 0 && fraction < 0.1);
  }

  getSleepingWakeInteraction() {
    const position = this.playerCharacter?.motor?.position ?? BED_OBJECT.position;
    return {
      ...BED_OBJECT,
      position: { x: position.x, y: position.y },
      radius: 24,
      priority: 100,
      requiresFacing: false,
      facingDotThreshold: -1,
      prompt: "hud:interaction.wake",
    };
  }

  tryWakeFromExhaustion() {
    if (!this.exhaustedSleeping) return { status: "ignored", mutated: false };
    this.gameHud?.showTransientMessage?.("hud:interaction.wakeFailed");
    return { status: "collapse-locked", mutated: false, transientMessageShown: true };
  }

  createDayNightRuntime() {
    this.dayNightOverlay = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 1).setOrigin(0, 0).setScrollFactor(0).setDepth(HUD_DEPTH - 1).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.updateDayNightLighting();
  }

  updateDayNightLighting() {
    this.dayNightOverlay?.setFillStyle(dayNightMultiplyColor(this.sessionState?.gameplay?.worldTimeSeconds ?? 0), 1);
  }

  setNpcAnimationTimeScale(scale) {
    for (const c of this.characterSystem?.values?.() ?? []) if (c.id !== this.sessionState.playerId && c.sprite?.anims) c.sprite.anims.timeScale = scale;
  }

  getMovementVector() {
    if (this.meleeRuntime?.isTranslationLocked?.()) return { x: 0, y: 0 };
    return this.getControllerMoveDirection();
  }

  getControllerMoveDirection() {
    if (this.pivotEditEnabled) return { x: 0, y: 0 };
    const approachDirection = this.needsInteractionCoordinator?.getMovementDirection?.();
    if (approachDirection) return approachDirection;
    if (isPlayerMovementSuppressed({
      sleeping: this.sleeping,
      facilityActive: this.facilityRuntime?.isUsing() || this.needsInteractionCoordinator?.isLocked?.(),
      dialogueActive: this.interactionRuntime?.isDialogueActive() || this.merchantRuntime?.isActive?.(),
      cookingActive: this.cookingRuntime?.isActive?.(),
    })) return { x: 0, y: 0 };
    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;
    const joystick = this.mobileJoystick?.getDirection() ?? { x: 0, y: 0 };
    return clampVectorLength({
      x: Number(right) - Number(left) + joystick.x,
      y: Number(down) - Number(up) + joystick.y,
    });
  }
}

async function bootstrap() {
  const localization = await createLocalization();
  await document.fonts?.load?.(`400 9px "${PIXELIFY_FONT_KEY}"`);
  window.__NESTLED_BURROW_LOCALIZATION__ = localization;
  new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#171724",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  disableVisibilityChange: true,
  scene: WorldScene,
  scale: {
    mode: Phaser.Scale.NONE,
    zoom: Phaser.Scale.MAX_ZOOM,
  },
  });
}

void bootstrap().catch((error) => {
  console.error("Failed to bootstrap NestledBurrow", error);
});

function migrateColliderOverrideGroups(overrides) {
  const migrated = {};
  for (const [key, value] of Object.entries(overrides ?? {})) {
    const resource = RESOURCE_OBJECTS.find((definition) => definition.id === key);
    const facility = FACILITIES.find((definition) => definition.id === key);
    const groupKey = resource
      ? `resource:${resource.profileId}`
      : facility ? `facility:${facility.facilityType}`
        : key === BED_OBJECT.id ? "furniture:bed"
          : key === TAVERN_SIGN.id ? "facility:tavern-sign" : key;
    migrated[groupKey] = value;
  }
  return migrateDirectionalWallOverrides(migrated);
}
