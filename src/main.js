import Phaser from "phaser";
import "@fontsource/pixelify-sans/latin.css";
import "@fontsource/pixelify-sans/cyrillic.css";
import "./style.css";
import { clampVectorLength } from "./input.js";
import { createMovementState, createRuntimeMovementConfig, energyTargetSpeedMultiplier } from "./characterMovement.js";
import {
  ACTOR_PROFILE_IDS,
  createDebugMovementConfigFromPolicy,
  getActorProfile,
} from "./actorProfiles.js";
import { createCharacter } from "./character.js";
import { createCharacterSystem } from "./characterSystem.js";
import { createPatrolController, createPlayerController } from "./controllers.js";
import {
  BASIC_VILLAGE_ASSET_PATH,
  GAME_HEIGHT,
  GAME_WIDTH,
  HOUSE_IMAGE_PATH,
  HOUSE_TEXTURE_KEY,
  OUTDOOR_IMAGE_PATH,
  OUTDOOR_TEXTURE_KEY,
  TILE_SIZE,
  TREES_IMAGE_PATH,
  TREES_TEXTURE_KEY,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./worldConfig.js";
import { createWorldLayout } from "./worldLayout.js";
import { NPCS } from "./npcConfig.js";
import { advanceGameTime, applyGameplayTuning, createFreshGameSessionState, drainAwakeEnergy, hitResourceNode, refillEnergy, regenerateEnergy, resetBalanceRun } from "./gameSessionState.js";
import { dayNightMultiplyColor, formatClock } from "./gameClock.js";
import { getDialogueDefinition } from "./dialogueConfig.js";
import { INTERACTION_DEFINITIONS } from "./interactionConfig.js";
import { createInteractionRuntime } from "./interactionRuntime.js";
import { createInteractionHud } from "./interactionHud.js";
import { createGameHud, shouldShakeEnergyAfterInteraction } from "./gameHud.js";
import {
  completeNeighborDialogue,
  NEIGHBOR_DIALOGUE_RESOLVER_ID,
  resolveNeighborDialogueId,
} from "./neighborQuest.js";
import { createSessionPersistence } from "./sessionPersistence.js";
import { createLocalization } from "./localization/index.js";
import { PIXELIFY_FONT_KEY } from "./localization/font.js";
import { createAudioSettingsStore } from "./audioSettings.js";
import { PhaserAudioRuntime, preloadMusicPlaylist } from "./audioRuntime.js";
import { HUD_DEPTH } from "./hud.js";
import { createMobileJoystick } from "./mobileJoystick.js";
import { MovementDebugPanel, loadMovementDebugConfig } from "./movementDebugPanel.js";
import { BED_INTERACTION_KIND, BED_OBJECT, BED_WAKE_POSITION, BED_WAKE_TILE } from "./debrisConfig.js";
import { DEFAULT_RESOURCE_ID, RESOURCE_INTERACTION_KIND, RESOURCE_OBJECTS } from "./resourceConfig.js";
import { getResourceProfile } from "./resourceDomain.js";
import { createDebrisRuntime } from "./debrisRuntime.js";
import { FACILITY_INTERACTION_KIND, FACILITIES, getFacility, preloadFacilityAssets } from "./facilityConfig.js";
import { createFacilityRuntime } from "./facilityRuntime.js";
import { applyNeedsUpdate } from "./needsDomain.js";
import { loadGameplayDebugTuning } from "./gameplayDebugTuning.js";
import { CameraFollowRuntime } from "./cameraFollowRuntime.js";
import {
  CHARACTER_VISUAL_PROFILE_IDS,
  getCharacterVisualProfile,
  toPhaserFrame,
} from "./characterVisualProfiles.js";

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
      ...NPCS.map((npc) => [npc.visualProfileId, getCharacterVisualProfile(npc.visualProfileId)]),
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
    this.worldLayout = createWorldLayout();
    this.characterSystem = createCharacterSystem({ collisionEnvironment: this.worldLayout });
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.renderWorld();
    this.createCharacterAnimations();
    this.createInput();
    this.createCharacters();
    this.createAudio();
    this.createGameplayTuning();
    this.createCameraRuntime();
    this.createSessionAndInteractionRuntime();
    this.createDebrisRuntime();
    this.createFacilityRuntime();
    this.sleeping = false;
    this.exhaustedSleeping = false;
    this.isRunning = false;
    this.simulationScale = 1;
    this.timeScale = 1;
    this.autosaveAccumulatorSeconds = 0;
    this.lastSuccessfulHitAtMs = Number.NEGATIVE_INFINITY;
    this.lastWakeAttemptAtMs = Number.NEGATIVE_INFINITY;
    this.createMovementDebugPanel();
    this.createDayNightRuntime();
    this.createHud();
    this.attachSceneListeners();
    this.createJoystick();
    this.syncIntegerZoom();
    this.installE2EBridge();
  }

  renderWorld() {
    this.worldLayout.groundTiles.forEach((tile) => this.addTile(tile, OUTDOOR_TEXTURE_KEY, 0));
    this.worldLayout.houseFloorTiles.forEach((tile) => this.addTile(tile, HOUSE_TEXTURE_KEY, 20));
    this.worldLayout.houseWallTiles.forEach((tile) =>
      this.addTile(tile, HOUSE_TEXTURE_KEY, 400 + tile.y * TILE_SIZE),
    );
    this.worldLayout.decorationTiles.forEach((tile) =>
      this.addTile(tile, TREES_TEXTURE_KEY, tile.depth),
    );
  }

  addTile(tile, textureKey, depth) {
    return this.add
      .image(tile.x * TILE_SIZE, tile.y * TILE_SIZE, textureKey, tile.frame)
      .setOrigin(0, 0)
      .setDepth(depth);
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
        getActions: () => this.frameActions,
      }),
      movementConfig: this.movementConfig,
      actorProfile: playerProfile,
      visualProfile: playerVisualProfile,
    });
    this.characterSystem.add(this.playerCharacter);
    for (const npc of NPCS) {
      const actorProfile = getActorProfile(npc.profileId);
      const visualProfile = getCharacterVisualProfile(npc.visualProfileId);
      this.characterSystem.add(createCharacter(this, {
        id: npc.id,
        spawn: npc.spawn,
        controller: createPatrolController({
          ...npc.patrol,
          isPaused: () => this.interactionRuntime?.isEntityInActiveDialogue(npc.id) ?? false,
        }),
        movementConfig: this.createNpcRuntimeMovementConfig(actorProfile),
        actorProfile,
        visualProfile,
      }));
    }
    this.player = this.characterSystem.require("player").sprite;
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

  createCameraRuntime() {
    this.cameraRuntime = new CameraFollowRuntime(this, {
      presentationPosition: this.getPlayerPresentationPosition(),
      tuning: this.gameplayTuning,
      movingSpeedThreshold: this.movementConfig.movingSpeedThreshold,
    });
  }

  createSessionAndInteractionRuntime() {
    this.sessionPersistence = this.createPersistence();
    const loaded = this.sessionPersistence?.load();
    this.sessionState = loaded?.state ?? createFreshGameSessionState({
      currentWorldId: "village",
      playerId: "player",
      initialEntityIds: NPCS.map((npc) => npc.id),
    });
    if (loaded?.diagnostic) {
      console.warn("Recovered NestledBurrow session", loaded.diagnostic);
    }
    this.interactionHud = createInteractionHud(this, {
      isCoarsePointer: () => this.isCoarsePointer(),
      localization: this.localization,
    });
    applyGameplayTuning(this.sessionState, this.gameplayTuning);
    this.syncPlayerEnergyTarget();
    this.interactionRuntime = createInteractionRuntime({
      sessionState: this.sessionState,
      characterSystem: this.characterSystem,
      interactionDefinitions: INTERACTION_DEFINITIONS,
      getDialogueDefinition,
      resolveDialogueId: (resolverId, state, entityId) => {
        if (resolverId !== NEIGHBOR_DIALOGUE_RESOLVER_ID) {
          throw new Error(`Unknown dialogue resolver ID: ${resolverId}`);
        }
        return resolveNeighborDialogueId(state, entityId);
      },
      completeDialogue: completeNeighborDialogue,
      onPersistentMutation: () => { this.gameHud?.render?.(); this.saveSession(); },
      getStaticInteractionDefinitions: () => [
        ...(this.debrisRuntime?.getInteractionDefinitions?.() ?? []),
        ...(this.facilityRuntime?.getInteractionDefinitions?.() ?? []),
        ...(this.exhaustedSleeping ? [this.getExhaustionWakeInteraction()] : []),
      ],
      isInteractionAllowed: (definition) => !this.facilityRuntime?.isUsing()
        || (definition.kind === FACILITY_INTERACTION_KIND && definition.id === this.facilityRuntime.getActiveId()),
      runWorldObjectInteraction: (candidate) => this.runWorldObjectInteraction(candidate),
      presenter: this.interactionHud,
    });
  }

  createDebrisRuntime() {
    this.debrisRuntime = createDebrisRuntime(this, { sessionState: this.sessionState, worldLayout: this.worldLayout });
  }

  createFacilityRuntime() {
    this.facilityRuntime = createFacilityRuntime(this, { worldLayout: this.worldLayout });
  }

  runWorldObjectInteraction(candidate) {
    if (candidate.kind === FACILITY_INTERACTION_KIND) {
      const player = this.characterSystem.require(this.sessionState.playerId);
      const result = this.facilityRuntime.toggle(candidate.payload.facilityId, player.motor);
      this.syncFacilityPresentationPose();
      this.suppressNextInteract = true;
      this.interactionRuntime?.refresh?.();
      return result;
    }
    if (this.facilityRuntime?.isUsing()) return { status: "busy", mutated: false };
    if (candidate.kind === BED_INTERACTION_KIND) {
      if (this.sleeping) this.wakeUp();
      else this.startSleeping();
      this.suppressNextInteract = true;
      return { status: this.sleeping ? "sleeping" : "awake", mutated: false };
    }
    if (candidate.kind === "wake-exhausted") return this.tryWakeFromExhaustion(this.e2eWakeRandom ?? Math.random);
    if (candidate.kind !== RESOURCE_INTERACTION_KIND) return { status: "ignored" };
    const nowMs = globalThis.performance?.now?.() ?? Date.now();
    if (nowMs - this.lastSuccessfulHitAtMs < this.gameplayTuning.universalHitCooldownSeconds * 1000) return { status: "cooldown", mutated: false };
    const definition = RESOURCE_OBJECTS.find((item) => item.id === candidate.payload.resourceId);
    if (!definition) return { status: "unknown-resource", mutated: false };
    const profile = getResourceProfile(definition.profileId);
    const energyBefore = this.sessionState.gameplay.currentEnergy;
    const result = hitResourceNode(this.sessionState, definition.id, {
      action: profile.preferredAction,
      damage: this.gameplayTuning.axeDamage,
      energyPerHit: this.gameplayTuning.energyPerHit,
      tuning: this.gameplayTuning,
    });
    if (result.mutated) {
      this.lastSuccessfulHitAtMs = nowMs;
      this.activeResourceProfileId = profile.id;
      this.interactionHud?.triggerCooldownFeedback?.();
      this.gameHud?.render?.();
      this.applySuccessfulHitFeedback(profile.sfx, energyBefore);
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
    if ((this.facilityRuntime?.isUsing?.() || this.sleeping) && motorPosition) {
      return { x: Number(motorPosition.x), y: Number(motorPosition.y) };
    }
    return this.getPlayerPresentationPosition();
  }

  syncFacilityPresentationPose() {
    if (!this.playerCharacter?.visual || this.sleeping) return;
    this.playerCharacter.visual.setPresentationPose(this.facilityRuntime?.getPresentationPose?.() ?? null);
  }

  syncPlayerEnergyTarget() {
    if (!this.playerCharacter?.motor || !this.sessionState?.gameplay) return;
    this.playerCharacter.motor.targetSpeedMultiplier = energyTargetSpeedMultiplier(
      this.sessionState.gameplay.currentEnergy,
      this.sessionState.gameplay.maximumEnergy,
      this.gameplayTuning.minimumFatigueSpeedMultiplier,
    );
    this.playerCharacter.motor.runSpeedMultiplier = this.isRunning ? this.gameplayTuning.runSpeedMultiplier : 1;
  }

  createPersistence() {
    try {
      return createSessionPersistence({ storage: window.localStorage });
    } catch (error) {
      console.warn("Session persistence unavailable", error);
      return null;
    }
  }

  saveSession() {
    const result = this.sessionPersistence?.save(this.sessionState);
    if (result?.status === "error") console.warn("Session save failed", result.diagnostic);
    return result;
  }

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
      onRefillEnergy: () => { refillEnergy(this.sessionState); this.syncPlayerEnergyTarget(); this.gameHud?.render?.(); this.saveSession(); },
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
  }

  updateMovementDebugStatus() {
    this.movementDebugPanel?.updateStatus();
  }

  createHud() {
    this.gameContainer = document.getElementById("game");
    this.gameHud = createGameHud(this, {
      buildId: BUILD_ID,
      localization: this.localization,
      gameContainer: this.gameContainer,
      audioSettings: this.audioSettings,
      isCoarsePointer: () => this.isCoarsePointer(),
      getGameplayState: () => ({ ...this.sessionState?.gameplay, clock: formatClock(this.sessionState.gameplay.worldTimeSeconds, this.localization.getLanguage()), sleeping: this.sleeping, energyFlow: this.getEnergyFlow(), needsFlow: this.needsFlow }),
      onLanguageChange: () => this.interactionRuntime?.refresh?.(),
      onConfirmationChange: (active) => {
        this.interactionHud?.setSuppressed?.(active);
        if (!active) this.interactionRuntime?.refresh?.();
      },
      onNewGame: () => this.startNewGame(),
    });
  }

  updateFullscreenHud() {
    this.gameHud?.render();
  }

  isHudPoint(x, y) {
    return Boolean(this.gameHud?.isPointInHud(x, y)) || Boolean(this.interactionHud?.isPointInHud(x, y));
  }

  startNewGame() {
    const result = this.sessionPersistence?.clear();
    if (result?.status === "error") console.warn("Session reset failed", result.diagnostic);
    this.scene.restart();
  }

  installE2EBridge() {
    if (!import.meta.env.VITE_E2E) return;
    const bridge = {
      getSession: () => JSON.parse(JSON.stringify(this.sessionState)),
      getLanguage: () => this.localization.getLanguage(),
      setLanguage: async (language) => {
        await this.localization.changeLanguage(language);
        this.gameHud?.render();
        this.interactionRuntime?.refresh();
      },
      placePlayerNear: (entityId) => {
        const resource = RESOURCE_OBJECTS.find((item) => item.id === entityId);
        const facility = getFacility(entityId);
        const target = resource ? { position: resource.position } : entityId === BED_OBJECT.id ? { position: BED_OBJECT.position } : facility ? { position: facility.position } : this.characterSystem.getSnapshot(entityId);
        const player = this.characterSystem.require(this.sessionState.playerId);
        player.motor.position = { x: target.position.x - 12, y: target.position.y };
        player.motor.movement = createMovementState({ facing: { x: 1, y: 0 } });
        player.visual.setPresentationPose(null);
        this.cameraRuntime?.reset(player.motor.position);
        this.interactionRuntime?.refresh?.();
      },
      placePlayerAt: ({ x, y, facing = { x: 0, y: -1 } }) => {
        const player = this.characterSystem.require(this.sessionState.playerId);
        player.motor.position = { x: Number(x), y: Number(y) };
        player.motor.movement = createMovementState({ facing });
        player.visual.setPresentationPose(null);
        this.cameraRuntime?.reset(player.motor.position);
        this.interactionRuntime?.refresh?.();
      },
      getInteractionState: () => ({
        candidate: this.interactionRuntime?.getCurrentCandidate() ?? null,
        dialogueActive: this.interactionRuntime?.isDialogueActive() ?? false,
        dialogue: { ...this.sessionState.dialogue },
      }),
      getInteractionHudState: () => this.interactionHud?.getPresentationState?.(),
      getHudState: () => ({ newGameConfirming: this.gameHud?.isConfirming?.() ?? false, resources: this.gameHud?.getResourceState?.(), ...this.gameHud?.getLayoutState?.() }),
      isHudPoint: ({ x, y }) => this.isHudPoint(x, y),
      getAudioSettings: () => this.audioSettings?.getSettings(),
      setAudioChannel: ({ channel, value }) => this.audioSettings?.setChannel?.(channel, value),
      getAudioEffectState: () => ({ lastEffectType: this.audioRuntime?.lastEffectType ?? null, playCount: this.audioRuntime?.effectPlayCount ?? 0 }),
      interact: () => { this.frameActions = Object.freeze({ interact: true, primary: false, secondary: false }); this.interactionRuntime?.update({ actions: this.frameActions }); },
      expireHitCooldown: () => { this.lastSuccessfulHitAtMs = Number.NEGATIVE_INFINITY; },
      getDebrisState: () => ({ present: this.debrisRuntime?.isPresent?.() ?? false, definition: RESOURCE_OBJECTS.find((item) => item.id === DEFAULT_RESOURCE_ID), definitions: RESOURCE_OBJECTS, bed: BED_OBJECT, wakeTile: BED_WAKE_TILE }),
      getFacilityState: () => ({ definitions: FACILITIES, activeId: this.facilityRuntime?.getActiveId?.() ?? null }),
      getNeedsState: () => ({ values: JSON.parse(JSON.stringify(this.sessionState.gameplay.needs)), flow: JSON.parse(JSON.stringify(this.needsFlow ?? {})), activity: this.getNeedsActivityContext() }),
      setNeeds: (values) => {
        for (const [id, value] of Object.entries(values ?? {})) {
          if (!(id in this.sessionState.gameplay.needs)) continue;
          this.sessionState.gameplay.needs[id] = Math.min(100, Math.max(0, Number(value) || 0));
        }
        this.gameHud?.render?.();
      },
      setEnergy: (value) => { this.sessionState.gameplay.currentEnergy = Math.max(0, Math.min(this.sessionState.gameplay.maximumEnergy, Number(value) || 0)); this.syncPlayerEnergyTarget(); this.gameHud?.render(); },
      setEnergyState: ({ current, maximum }) => { this.sessionState.gameplay.maximumEnergy = Math.max(1, Number(maximum) || 1); this.sessionState.gameplay.currentEnergy = Math.max(0, Math.min(this.sessionState.gameplay.maximumEnergy, Number(current) || 0)); this.syncPlayerEnergyTarget(); this.gameHud?.render(); },
      setPlayerMotion: ({ moving = false, running = false } = {}) => {
        const player = this.characterSystem.require(this.sessionState.playerId);
        player.motor.movement = createMovementState({ facing: { x: 1, y: 0 } });
        player.motor.movement.velocity.x = moving ? player.motor.movementConfig.movingSpeedThreshold : 0;
        this.e2eEnergyMotion = { moving: Boolean(moving), running: Boolean(running) };
        this.isRunning = Boolean(running);
      },
      advanceGameplayTime: (milliseconds) => this.updateGameplayTime(Math.max(0, Number(milliseconds) || 0)),
      getRuntimeState: () => ({ sleeping: this.sleeping, exhaustedSleeping: this.exhaustedSleeping, timeScale: this.simulationScale }),
      setWorldTimeSeconds: (value) => { this.sessionState.gameplay.worldTimeSeconds = Math.max(0, Number(value) || 0); this.updateDayNightLighting(); this.gameHud?.render(); },
      getClockText: () => formatClock(this.sessionState.gameplay.worldTimeSeconds, this.localization.getLanguage()),
      getDayNightState: () => ({ color: dayNightMultiplyColor(this.sessionState.gameplay.worldTimeSeconds), worldTimeSeconds: this.sessionState.gameplay.worldTimeSeconds }),
      getResourceState: () => JSON.parse(JSON.stringify(this.sessionState.gameplay)),
      getResourceNodeState: (id) => JSON.parse(JSON.stringify(this.sessionState.gameplay.resourceNodes[id])),
      getResourceVisualState: (id) => this.debrisRuntime?.getVisualState?.(id) ?? null,
      getResourceCollider: (id) => this.worldLayout?.getResourceCollider?.(id) ?? null,
      getCharacterSnapshot: (id) => this.characterSystem.getSnapshot(id),
      getPlayerMovementState: () => ({ targetMultiplier: this.playerCharacter?.motor?.targetSpeedMultiplier, effectiveMultiplier: this.playerCharacter?.motor?.effectiveSpeedMultiplier, runSpeedMultiplier: this.playerCharacter?.motor?.runSpeedMultiplier }),
      getPlayerVisualState: () => {
        const sprite = this.playerCharacter?.sprite;
        return sprite ? { x: sprite.x, y: sprite.y, angle: sprite.angle, textureKey: sprite.texture?.key } : null;
      },
      getCameraState: () => this.cameraRuntime?.getState?.() ?? null,
      getLowEnergyMarkerState: () => {
        const visual = this.playerCharacter?.visual;
        const marker = visual?.lowEnergyMarker;
        return marker ? { x: marker.x, y: marker.y, playerX: visual.sprite.x, playerY: visual.sprite.y } : null;
      },
      setWakeRandomValue: (value) => { this.e2eWakeRandom = () => Number(value); },
      wakeUp: () => this.wakeUp(),
      tryWakeFromExhaustion: () => this.tryWakeFromExhaustion(() => 0),
    };
    this.e2eBridge = bridge;
    window.__NESTLED_BURROW_E2E__ = bridge;
  }

  isCoarsePointer() {
    return window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  }

  attachSceneListeners() {
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
    document.removeEventListener("fullscreenchange", this.onFullscreenChange);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.syncIntegerZoom, this);
    this.mobileJoystick?.destroy();
    this.mobileJoystick = null;
    this.cameraRuntime?.destroy();
    this.cameraRuntime = null;
    this.debrisRuntime?.destroy();
    this.debrisRuntime = null;
    this.facilityRuntime?.destroy();
    this.facilityRuntime = null;
    this.interactionRuntime?.destroy();
    this.interactionRuntime = null;
    this.interactionHud?.destroy();
    this.interactionHud = null;
    this.movementDebugPanel?.destroy();
    this.movementDebugPanel = null;
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

  startSleeping({ exhausted = false } = {}) {
    this.sleeping = true;
    this.exhaustedSleeping = exhausted;
    this.simulationScale = this.getSleepTimeScale();
    this.timeScale = this.simulationScale;
    const player = this.characterSystem.require(this.sessionState.playerId);
    this.sleepOrigin = { ...player.motor.position };
    if (exhausted) {
      player.motor.movement = createMovementState({ facing: { x: 0, y: 1 } });
      player.visual.setPresentationPose({ x: player.motor.position.x, y: player.motor.position.y - 4, facing: "up", angle: -90, showSleepMarker: true });
    } else {
      player.motor.movement = createMovementState({ facing: { x: -1, y: 0 } });
      player.visual.setPresentationPose({ x: BED_OBJECT.position.x, y: BED_OBJECT.position.y - 1, facing: "right", angle: -90, showSleepMarker: true });
    }
    this.debrisRuntime?.setSleeping(true);
    this.syncLowEnergyMarker();
    this.interactionRuntime?.refresh?.();
    this.gameHud?.render?.();
  }

  wakeUp() {
    const wasExhausted = this.exhaustedSleeping;
    this.sleeping = false;
    this.exhaustedSleeping = false;
    this.simulationScale = 1;
    this.timeScale = 1;
    const player = this.characterSystem.require(this.sessionState.playerId);
    player.visual.setPresentationPose(null);
    if (!wasExhausted && this.sleepOrigin) player.motor.position = { ...this.sleepOrigin };
    this.sleepOrigin = null;
    player.motor.movement = createMovementState({ facing: { x: 0, y: 1 } });
    this.debrisRuntime?.setSleeping(false);
    this.syncLowEnergyMarker();
    this.interactionRuntime?.refresh?.();
    this.gameHud?.render?.();
    this.saveSession();
  }

  updateGameplayTime(deltaMs) {
    const realSeconds = Math.max(0, deltaMs) / 1000;
    this.simulationScale = this.sleeping ? this.getSleepTimeScale() : 1;
    this.timeScale = this.simulationScale;
    advanceGameTime(this.sessionState, realSeconds, this.simulationScale);
    const activity = this.getNeedsActivityContext();
    this.needsFlow = applyNeedsUpdate(this.sessionState.gameplay.needs, realSeconds, activity, this.gameplayTuning.needs);
    const activeFacility = this.facilityRuntime?.getActiveType?.();
    if ((activeFacility === "shower" && this.sessionState.gameplay.needs.lustre >= 100)
      || (activeFacility === "toilet" && this.sessionState.gameplay.needs.toilet >= 100)
      || (activeFacility === "table" && this.sessionState.gameplay.needs.satiety >= 100)) {
      this.facilityRuntime.stop();
      this.syncFacilityPresentationPose();
      this.interactionRuntime?.refresh?.();
    }
    if (this.sleeping) {
      const gameHours = realSeconds * this.simulationScale * (86400 / this.gameplayTuning.realSecondsPerGameDay) / 3600;
      regenerateEnergy(this.sessionState, { amount: this.getSleepEnergyPerGameHour() * gameHours });
      if (this.sessionState.gameplay.currentEnergy >= this.sessionState.gameplay.maximumEnergy) this.wakeUp();
    } else {
      if (this.sessionState.gameplay.currentEnergy <= 0) {
        this.startSleeping({ exhausted: true });
      } else {
        const flow = this.getEnergyFlow();
        if (flow.direction === "up") {
          regenerateEnergy(this.sessionState, { amount: this.gameplayTuning.lowEnergyIdleRegenPerSecond * realSeconds });
        } else drainAwakeEnergy(this.sessionState, { amount: this.getAwakeDrainAmount(flow) * realSeconds });
        if (this.sessionState.gameplay.currentEnergy <= 0) this.startSleeping({ exhausted: true });
      }
    }
    this.syncPlayerEnergyTarget();
    this.updateDayNightLighting?.();
    this.gameHud?.render?.();
    this.autosaveAccumulatorSeconds = (this.autosaveAccumulatorSeconds ?? 0) + realSeconds;
    if (this.autosaveAccumulatorSeconds >= 1) {
      this.autosaveAccumulatorSeconds = 0;
      this.saveSession();
    }
  }

  update(_time, delta) {
    this.sampleFrameActions();
    const realDeltaMs = delta;
    this.updateGameplayTime(realDeltaMs);
    let worldDeltaMs = realDeltaMs * (this.simulationScale ?? 1);
    this.setNpcAnimationTimeScale(this.simulationScale ?? 1);
    while (worldDeltaMs > 0) {
      const substepMs = Math.min(50, worldDeltaMs);
      this.characterSystem?.update(substepMs);
      worldDeltaMs -= substepMs;
    }
    this.syncFacilityPresentationPose();
    this.cameraRuntime?.update({
      presentationPosition: this.getPlayerCameraPosition(),
      speed: this.playerCharacter?.speed ?? 0,
      deltaMs: realDeltaMs,
    });
    this.interactionRuntime?.update({ actions: this.frameActions });
    this.interactionHud?.setCooldownProgress?.(this.getInteractionCooldownProgress());
    this.updateMovementDebugStatus();
  }

  sampleFrameActions() {
    this.isRunning = Boolean(this.runKey?.isDown || this.mobileJoystick?.isSprinting?.()) && !this.sleeping;
    this.syncPlayerEnergyTarget();
    this.syncLowEnergyMarker();
    const keyboardPressed =
      Phaser.Input.Keyboard.JustDown(this.interactKeys.SPACE);
    const heldResourceInteract = this.interactKeys.SPACE.isDown && this.interactionRuntime?.getCurrentCandidate?.()?.kind === RESOURCE_INTERACTION_KIND;
    const mobilePressed = this.interactionHud?.consumeInteractPressed() ?? false;
    const mobileHeldResourceInteract = this.interactionHud?.isInteractHeld?.()
      && this.interactionRuntime?.getCurrentCandidate?.()?.kind === RESOURCE_INTERACTION_KIND;
    this.frameActions = Object.freeze({
      interact: this.suppressNextInteract ? false : (keyboardPressed || heldResourceInteract || mobilePressed || mobileHeldResourceInteract),
      primary: false,
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
    if (this.exhaustedSleeping) {
      const durationMs = this.gameplayTuning.exhaustionWakeCooldownSeconds * 1000;
      if (!(durationMs > 0) || !Number.isFinite(this.lastWakeAttemptAtMs)) return 0;
      return Math.max(0, Math.min(1, 1 - (nowMs - this.lastWakeAttemptAtMs) / durationMs));
    }
    return this.getHitCooldownProgress(nowMs);
  }

  getSleepTimeScale() {
    return this.gameplayTuning.sleepTimeScale * (this.exhaustedSleeping ? this.gameplayTuning.exhaustionSleepScaleMultiplier : 1);
  }

  getSleepEnergyPerGameHour() {
    return this.gameplayTuning.sleepEnergyPerGameHour / (this.exhaustedSleeping ? 6 : 1);
  }

  getEnergyFlow() {
    const gameplay = this.sessionState?.gameplay;
    const player = this.playerCharacter?.motor;
    if (!gameplay || !player) return null;
    if (this.sleeping) return { direction: "up", arrows: 1 };
    const isMoving = this.e2eEnergyMotion?.moving ?? (player.speed >= player.movementConfig.movingSpeedThreshold);
    const fraction = gameplay.maximumEnergy > 0 ? gameplay.currentEnergy / gameplay.maximumEnergy : 0;
    if (!isMoving && fraction < 0.15) return { direction: "up", arrows: 1 };
    if (!isMoving) return { direction: "down", arrows: 1 };
    return { direction: "down", arrows: (this.e2eEnergyMotion?.running ?? this.isRunning) ? 3 : 2 };
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
      const position = this.characterSystem?.getSnapshot?.(npc.id)?.position;
      return position && Math.hypot(position.x - playerPosition.x, position.y - playerPosition.y) <= this.gameplayTuning.needs.dialogue.radius;
    }));
    return {
      facility: this.facilityRuntime?.getActiveType?.() ?? null,
      running,
      activeResourceKind: resourceKind,
      npcNearby,
    };
  }

  syncLowEnergyMarker() {
    const gameplay = this.sessionState?.gameplay;
    const fraction = gameplay?.maximumEnergy > 0 ? gameplay.currentEnergy / gameplay.maximumEnergy : 0;
    this.playerCharacter?.visual?.setLowEnergyMarker?.(!this.sleeping && fraction > 0 && fraction < 0.1);
  }

  getAwakeDrainAmount(flow = this.getEnergyFlow()) {
    if (flow?.arrows >= 3) return this.gameplayTuning.awakeRunDrainAmount;
    if (flow?.arrows === 2) return this.gameplayTuning.awakeWalkDrainAmount;
    return this.gameplayTuning.awakeDrainAmount;
  }

  getExhaustionWakeInteraction() {
    const position = this.playerCharacter?.motor?.position ?? { x: 0, y: 0 };
    return {
      id: "wake-exhausted-player", entityId: "wake-exhausted-player", roomId: "world", kind: "wake-exhausted",
      position: { x: position.x, y: position.y }, radius: 24, priority: 100, requiresFacing: false, facingDotThreshold: -1,
      prompt: "hud:interaction.wake", payload: {},
    };
  }

  getWakeProbability() {
    const gameplay = this.sessionState.gameplay;
    const fraction = gameplay.maximumEnergy > 0 ? gameplay.currentEnergy / gameplay.maximumEnergy : 0;
    if (fraction < 0.05) return 0.1;
    if (fraction < 0.1) return 0.66;
    return fraction > 0.25 ? 1 : 0.66;
  }

  tryWakeFromExhaustion(random = Math.random) {
    if (!this.exhaustedSleeping) return { status: "ignored", mutated: false };
    const nowMs = globalThis.performance?.now?.() ?? Date.now();
    if (nowMs - this.lastWakeAttemptAtMs < this.gameplayTuning.exhaustionWakeCooldownSeconds * 1000) return { status: "cooldown", mutated: false };
    this.lastWakeAttemptAtMs = nowMs;
    if (random() < this.getWakeProbability()) {
      this.wakeUp();
      return { status: "awake", mutated: true };
    }
    return { status: "wake-failed", mutated: false };
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
    if (this.sleeping || this.facilityRuntime?.isUsing() || this.interactionRuntime?.isDialogueActive()) return { x: 0, y: 0 };
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
