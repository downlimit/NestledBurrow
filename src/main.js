import Phaser from "phaser";
import "@fontsource/pixelify-sans/latin.css";
import "@fontsource/pixelify-sans/cyrillic.css";
import "./style.css";
import { clampVectorLength } from "./input.js";
import { createMovementState, createRuntimeMovementConfig } from "./characterMovement.js";
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
import { advanceGameTime, applyGameplayTuning, createFreshGameSessionState, drainAwakeEnergy, hitDebris, hitRuby, refillEnergy, regenerateEnergy } from "./gameSessionState.js";
import { formatClock, nightTintAlpha } from "./gameClock.js";
import { getDialogueDefinition } from "./dialogueConfig.js";
import { INTERACTION_DEFINITIONS } from "./interactionConfig.js";
import { createInteractionRuntime } from "./interactionRuntime.js";
import { createInteractionHud } from "./interactionHud.js";
import { createGameHud } from "./gameHud.js";
import {
  completeNeighborDialogue,
  NEIGHBOR_DIALOGUE_RESOLVER_ID,
  resolveNeighborDialogueId,
} from "./neighborQuest.js";
import { createSessionPersistence } from "./sessionPersistence.js";
import { createLocalization } from "./localization/index.js";
import { PIXELIFY_FONT_KEY } from "./localization/font.js";
import { createAudioSettingsStore } from "./audioSettings.js";
import { MUSIC_KEY, getMusicUrl, PhaserAudioRuntime } from "./audioRuntime.js";
import { HUD_DEPTH } from "./hud.js";
import { createMobileJoystick } from "./mobileJoystick.js";
import { MovementDebugPanel, loadMovementDebugConfig } from "./movementDebugPanel.js";
import { BED_INTERACTION_KIND, BED_OBJECT, BED_WAKE_POSITION, BED_WAKE_TILE, DEBRIS_INTERACTION_KIND, DEBRIS_OBJECT, DEBRIS_OBJECTS, RUBY_INTERACTION_KIND, RUBY_OBJECTS } from "./debrisConfig.js";
import { createDebrisRuntime } from "./debrisRuntime.js";
import { loadGameplayDebugTuning } from "./gameplayDebugTuning.js";
import {
  CHARACTER_VISUAL_PROFILE_IDS,
  getCharacterVisualProfile,
  toPhaserFrame,
} from "./characterVisualProfiles.js";

const BUILD_ID = import.meta.env.VITE_BUILD_ID ?? "dev";
const VILLAGE_ASSET_URL = `${import.meta.env.BASE_URL}${BASIC_VILLAGE_ASSET_PATH}`;

class WorldScene extends Phaser.Scene {
  constructor() {
    super("world");
    this.localization = window.__NESTLED_BURROW_LOCALIZATION__;
  }

  preload() {
    this.load.audio(MUSIC_KEY, getMusicUrl(import.meta.env.BASE_URL));
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
    this.movementDebugEnabled =
      new URLSearchParams(window.location.search).get("movementDebug") === "1";
    this.worldLayout = createWorldLayout();
    this.characterSystem = createCharacterSystem({ collisionEnvironment: this.worldLayout });
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.renderWorld();
    this.createCharacterAnimations();
    this.createInput();
    this.createCharacters();
    this.createAudio();
    this.createGameplayTuning();
    this.createSessionAndInteractionRuntime();
    this.createDebrisRuntime();
    this.sleeping = false;
    this.simulationScale = 1;
    this.timeScale = 1;
    this.awakeDrainAccumulatorSeconds = 0;
    this.autosaveAccumulatorSeconds = 0;
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
    this.cameras.main.startFollow(this.player, true, 1, 1);
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
      getStaticInteractionDefinitions: () => this.debrisRuntime?.getInteractionDefinitions?.() ?? [],
      runWorldObjectInteraction: (candidate) => this.runWorldObjectInteraction(candidate),
      presenter: this.interactionHud,
    });
  }

  createDebrisRuntime() {
    this.debrisRuntime = createDebrisRuntime(this, { sessionState: this.sessionState, worldLayout: this.worldLayout });
  }

  runWorldObjectInteraction(candidate) {
    if (candidate.kind === BED_INTERACTION_KIND) {
      if (this.sleeping) this.wakeUp();
      else this.startSleeping();
      this.suppressNextInteract = true;
      return { status: this.sleeping ? "sleeping" : "awake", mutated: false };
    }
    if (candidate.kind === RUBY_INTERACTION_KIND) {
      const result = hitRuby(this.sessionState, candidate.payload.rubyId, { energyPerHit: this.gameplayTuning.energyPerHit });
      if (result.mutated) {
        this.gameHud?.render?.();
        this.debrisRuntime?.hitWithFeedback?.(candidate.payload.rubyId, result, () => this.interactionRuntime?.refresh?.());
        this.saveSession();
      }
      return result;
    }
    if (candidate.kind !== DEBRIS_INTERACTION_KIND) return { status: "ignored" };
    const result = hitDebris(this.sessionState, candidate.payload.debrisId, {
      energyPerHit: this.gameplayTuning.energyPerHit,
      woodReward: this.gameplayTuning.woodReward,
      maxHits: this.gameplayTuning.hitsPerLog,
    });
    if (result.mutated) {
      this.gameHud?.render?.();
      this.debrisRuntime?.hitWithFeedback?.(candidate.payload.debrisId, result, () => this.interactionRuntime?.refresh?.());
      this.saveSession();
    }
    return result;
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
      onGameplayTuningChange: (tuning) => { applyGameplayTuning(this.sessionState, tuning); this.gameHud?.render?.(); },
      onRefillEnergy: () => { refillEnergy(this.sessionState); this.gameHud?.render?.(); this.saveSession(); },
      getStatusSnapshot: () => {
        if (!this.playerCharacter) return null;
        return {
          speed: undefined,
          velocity: this.playerCharacter.movement.velocity,
          facing: this.playerCharacter.lastFacing,
          energy: this.sessionState?.gameplay?.currentEnergy,
          timeScale: this.simulationScale,
          worldTimeSeconds: this.sessionState?.gameplay?.worldTimeSeconds,
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
      getGameplayState: () => ({ ...this.sessionState?.gameplay, clock: formatClock(this.sessionState.gameplay.worldTimeSeconds, this.localization.getLanguage()), sleeping: this.sleeping }),
      onLanguageChange: () => this.interactionRuntime?.refresh?.(),
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
        const debris = DEBRIS_OBJECTS.find((item) => item.id === entityId);
        const target = debris ? { position: debris.position } : entityId === BED_OBJECT.id ? { position: BED_OBJECT.position } : this.characterSystem.getSnapshot(entityId);
        const player = this.characterSystem.require(this.sessionState.playerId);
        player.motor.position = { x: target.position.x - 12, y: target.position.y };
        player.motor.movement = createMovementState({ facing: { x: 1, y: 0 } });
      },
      getInteractionState: () => ({
        candidate: this.interactionRuntime?.getCurrentCandidate() ?? null,
        dialogueActive: this.interactionRuntime?.isDialogueActive() ?? false,
        dialogue: { ...this.sessionState.dialogue },
      }),
      getHudState: () => ({ newGameConfirming: this.gameHud?.isConfirming?.() ?? false, ...this.gameHud?.getLayoutState?.() }),
      getAudioSettings: () => this.audioSettings?.getSettings(),
      interact: () => { this.frameActions = Object.freeze({ interact: true, primary: false, secondary: false }); this.interactionRuntime?.update({ actions: this.frameActions }); },
      getDebrisState: () => ({ present: this.debrisRuntime?.isPresent?.() ?? false, definition: DEBRIS_OBJECT, definitions: DEBRIS_OBJECTS, rubies: RUBY_OBJECTS, bed: BED_OBJECT, wakeTile: BED_WAKE_TILE }),
      setEnergy: (value) => { this.sessionState.gameplay.currentEnergy = Math.max(0, Math.min(this.sessionState.gameplay.maximumEnergy, Number(value) || 0)); this.gameHud?.render(); },
      getRuntimeState: () => ({ sleeping: this.sleeping, timeScale: this.simulationScale }),
      setWorldTimeSeconds: (value) => { this.sessionState.gameplay.worldTimeSeconds = Math.max(0, Number(value) || 0); this.updateDayNightLighting(); this.gameHud?.render(); },
      getClockText: () => formatClock(this.sessionState.gameplay.worldTimeSeconds, this.localization.getLanguage()),
      getDayNightState: () => ({ alpha: nightTintAlpha(this.sessionState.gameplay.worldTimeSeconds, this.gameplayTuning.nightTintStrength), worldTimeSeconds: this.sessionState.gameplay.worldTimeSeconds }),
      getResourceState: () => JSON.parse(JSON.stringify(this.sessionState.gameplay)),
      getRubyNodeState: (id) => JSON.parse(JSON.stringify(this.sessionState.gameplay.rubyNodes[id])),
      getCharacterSnapshot: (id) => this.characterSystem.getSnapshot(id),
      wakeUp: () => this.wakeUp(),
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
    this.debrisRuntime?.destroy();
    this.debrisRuntime = null;
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

  startSleeping() {
    this.sleeping = true;
    this.simulationScale = this.gameplayTuning.sleepTimeScale;
    this.timeScale = this.simulationScale;
    this.awakeDrainAccumulatorSeconds = 0;
    const player = this.characterSystem.require(this.sessionState.playerId);
    player.motor.position = { ...BED_WAKE_POSITION };
    player.motor.movement = createMovementState({ facing: { x: -1, y: 0 } });
    this.debrisRuntime?.setSleeping(true);
    this.gameHud?.render?.();
  }

  wakeUp() {
    this.sleeping = false;
    this.simulationScale = 1;
    this.timeScale = 1;
    this.awakeDrainAccumulatorSeconds = 0;
    const player = this.characterSystem.require(this.sessionState.playerId);
    player.motor.position = { ...BED_WAKE_POSITION };
    player.motor.movement = createMovementState({ facing: { x: 0, y: 1 } });
    this.debrisRuntime?.setSleeping(false);
    this.interactionRuntime?.refresh?.();
    this.gameHud?.render?.();
    this.saveSession();
  }

  updateGameplayTime(deltaMs) {
    const realSeconds = Math.max(0, deltaMs) / 1000;
    this.simulationScale = this.sleeping ? this.gameplayTuning.sleepTimeScale : 1;
    this.timeScale = this.simulationScale;
    advanceGameTime(this.sessionState, realSeconds, this.simulationScale);
    if (this.sleeping) {
      regenerateEnergy(this.sessionState, { amount: this.gameplayTuning.sleepEnergyRegenPerSecond * realSeconds });
      if (this.sessionState.gameplay.currentEnergy >= this.sessionState.gameplay.maximumEnergy) this.wakeUp();
    } else {
      this.awakeDrainAccumulatorSeconds += realSeconds;
      while (this.awakeDrainAccumulatorSeconds >= this.gameplayTuning.awakeDrainIntervalSeconds) {
        this.awakeDrainAccumulatorSeconds -= this.gameplayTuning.awakeDrainIntervalSeconds;
        drainAwakeEnergy(this.sessionState, { amount: this.gameplayTuning.awakeDrainAmount });
      }
    }
    if (this.playerCharacter) {
      const multiplier = this.sessionState.gameplay.currentEnergy <= 0 ? this.gameplayTuning.exhaustedMovementMultiplier : 1;
      this.playerCharacter.motor.speedMultiplier = multiplier;
    }
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
    const worldDeltaMs = realDeltaMs * (this.simulationScale ?? 1);
    this.setNpcAnimationTimeScale(this.simulationScale ?? 1);
    this.characterSystem?.update(worldDeltaMs);
    this.interactionRuntime?.update({ actions: this.frameActions });
    this.updateMovementDebugStatus();
  }

  sampleFrameActions() {
    const keyboardPressed =
      Phaser.Input.Keyboard.JustDown(this.interactKeys.SPACE);
    const mobilePressed = this.interactionHud?.consumeInteractPressed() ?? false;
    this.frameActions = Object.freeze({
      interact: this.suppressNextInteract ? false : (keyboardPressed || mobilePressed),
      primary: false,
      secondary: false,
    });
    this.suppressNextInteract = false;
  }

  createDayNightRuntime() {
    this.dayNightOverlay = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xA8C4E6, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(HUD_DEPTH - 1).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.updateDayNightLighting();
  }

  updateDayNightLighting() {
    this.dayNightOverlay?.setAlpha(nightTintAlpha(this.sessionState?.gameplay?.worldTimeSeconds ?? 0, this.gameplayTuning?.nightTintStrength));
  }

  setNpcAnimationTimeScale(scale) {
    for (const c of this.characterSystem?.values?.() ?? []) if (c.id !== this.sessionState.playerId && c.sprite?.anims) c.sprite.anims.timeScale = scale;
  }

  getMovementVector() {
    if (this.sleeping || this.interactionRuntime?.isDialogueActive()) return { x: 0, y: 0 };
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
