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
import { createPatrolController, createPlayerController } from "./controllers.js";
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
import { createManagedText } from "./textResolution.js";
import { createAudioSettingsStore } from "./audioSettings.js";
import { PhaserAudioRuntime, preloadMusicPlaylist } from "./audioRuntime.js";
import { HUD_DEPTH } from "./hud.js";
import { createMobileJoystick } from "./mobileJoystick.js";
import { MovementDebugPanel, loadMovementDebugConfig } from "./movementDebugPanel.js";
import { loadColliderDebugOverrides, saveColliderDebugOverrides } from "./colliderDebugOverrides.js";
import { getColliderResizeEdges, resizeColliderDraft } from "./colliderResize.js";
import { createBuildModeRuntime } from "./buildModeRuntime.js";
import {
  BUILD_CARPET_FRAME_BY_MASK,
  BUILD_SURFACE_CUSTOM_MASKS,
  BUILD_SURFACE_FRAME_BY_MASK,
  getBuildWallColumnOffset,
  getBuildWallColumnDepthOffset,
  getBuildVerticalWallOffset,
  getBuildVerticalWallFrame,
  getBuildWallFrames,
} from "./buildAssetCatalog.js";
import { BED_INTERACTION_KIND, BED_OBJECT, BED_WAKE_TILE } from "./debrisConfig.js";
import { DEFAULT_RESOURCE_ID, RESOURCE_INTERACTION_KIND, RESOURCE_OBJECTS } from "./resourceConfig.js";
import { getResourceProfile } from "./resourceDomain.js";
import { createDebrisRuntime } from "./debrisRuntime.js";
import { FACILITY_INTERACTION_KIND, FACILITIES, PLATED_DISH_ASSET, preloadFacilityAssets } from "./facilityConfig.js";
import { createFacilityRuntime } from "./facilityRuntime.js";
import { drawBed } from "./debrisRuntime.js";
import { drawFacility } from "./facilityPreviewVisuals.js";
import { applyNeedsUpdate } from "./needsDomain.js";
import { loadGameplayDebugTuning } from "./gameplayDebugTuning.js";
import { CameraFollowRuntime } from "./cameraFollowRuntime.js";
import { COOKING_STEP_TYPES, toggleServingDish } from "./cookingDomain.js";
import { createCookingRuntime } from "./cookingRuntime.js";
import { createCoinRuntime } from "./coinRuntime.js";
import { createGuestController } from "./guestController.js";
import { GUEST_CONFIG, TAVERN_SIGN, TAVERN_SIGN_ASSET, TAVERN_SIGN_KIND } from "./guestConfig.js";
import { createGuestRuntime } from "./guestRuntime.js";
import { createTavernSignRuntime } from "./tavernSignRuntime.js";
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
    this.colliderOverrides = migrateColliderOverrideGroups(loadColliderDebugOverrides(window.localStorage));
    saveColliderDebugOverrides(this.colliderOverrides, window.localStorage);
    for (const [id, offsets] of Object.entries(this.colliderOverrides)) {
      this.worldLayout.setColliderOverride(id, offsets);
    }
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
    this.createTavernRuntime();
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
    this.createCookingRuntime();
    this.attachSceneListeners();
    this.createJoystick();
    this.createBuildMode();
    this.syncIntegerZoom();
    this.installE2EBridge();
  }

  renderWorld() {
    this.groundSprites = new Map();
    this.worldLayout.groundTiles.forEach((tile) => {
      const sprite = this.addTile(tile, OUTDOOR_TEXTURE_KEY, 0);
      this.groundSprites.set(this.buildCellKey({ x: tile.x * TILE_SIZE, y: tile.y * TILE_SIZE }), { sprite, tile });
    });
    this.floorSprites = new Map();
    this.worldLayout.houseFloorTiles.forEach((tile) => {
      const sprite = this.addTile(tile, HOUSE_TEXTURE_KEY, 20);
      this.floorSprites.set(this.buildCellKey({ x: tile.x * TILE_SIZE, y: tile.y * TILE_SIZE }), { sprite, tile });
    });
    this.wallSprites = new Map();
    this.worldLayout.houseWallTiles.forEach((tile) => {
      this.wallSprites.set(tile.id, this.createCanonicalWallEntry(tile));
    });
    this.worldLayout.decorationTiles.forEach((tile) =>
      this.addTile(tile, TREES_TEXTURE_KEY, tile.depth),
    );
  }

  addTile(tile, textureKey, depth) {
    return this.add
      .image(tile.worldX ?? tile.x * TILE_SIZE, tile.worldY ?? tile.y * TILE_SIZE, textureKey, tile.frame)
      .setOrigin(0, 0)
      .setDepth(depth);
  }

  createCanonicalWallEntry(tile) {
    const depth = 500 + (tile.worldY ?? tile.y * TILE_SIZE) + TILE_SIZE;
    const extraSprites = (tile.supplements ?? []).map((supplement) => this.add
      .image(supplement.worldX, supplement.worldY, HOUSE_TEXTURE_KEY, supplement.frame)
      .setOrigin(0, 0)
      .setCrop(supplement.cropX, 0, supplement.cropWidth, TILE_SIZE)
      .setDepth(depth));
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
        ...(this.tavernSignRuntime?.getInteractionDefinitions?.() ?? []),
        ...(this.sleeping && !this.exhaustedSleeping ? [this.getSleepingWakeInteraction()] : []),
        ...(this.exhaustedSleeping ? [this.getExhaustionWakeInteraction()] : []),
      ],
      isInteractionAllowed: (definition) => !this.cookingRuntime?.isActive?.()
        && !(this.facilityRuntime?.getDefinition?.(definition.payload?.facilityId)?.facilityType === "serving-table"
          && this.guestRuntime?.isDishReserved?.())
        && (!this.facilityRuntime?.isUsing()
          || (definition.kind === FACILITY_INTERACTION_KIND && definition.id === this.facilityRuntime.getActiveId())),
      runWorldObjectInteraction: (candidate) => this.runWorldObjectInteraction(candidate),
      presenter: this.interactionHud,
    });
  }

  createDebrisRuntime() {
    this.debrisRuntime = createDebrisRuntime(this, { sessionState: this.sessionState, worldLayout: this.worldLayout });
  }

  createFacilityRuntime() {
    this.facilityRuntime = createFacilityRuntime(this, {
      worldLayout: this.worldLayout,
      getKitchenState: () => this.sessionState?.gameplay?.kitchen,
      isServingDishReserved: () => this.guestRuntime?.isDishReserved?.() ?? false,
    });
  }

  createTavernRuntime() {
    this.coinRuntime = createCoinRuntime(this, {
      getPlayerPosition: () => this.playerCharacter?.motor?.position,
      onCollect: () => {
        this.sessionState.gameplay.coins += 1;
        this.gameHud?.render?.();
        this.saveSession();
      },
    });
    this.tavernSignRuntime = createTavernSignRuntime(this, {
      getTavernOpen: () => this.sessionState?.gameplay?.tavernOpen,
      worldLayout: this.worldLayout,
    });
    const actorProfile = getActorProfile(GUEST_CONFIG.profileId);
    const visualProfile = getCharacterVisualProfile(GUEST_CONFIG.visualProfileId);
    this.guestRuntime = createGuestRuntime({
      config: { ...GUEST_CONFIG, createController: createGuestController },
      worldLayout: this.worldLayout,
      createGuest: (controller) => {
        const character = createCharacter(this, {
          id: GUEST_CONFIG.id,
          spawn: GUEST_CONFIG.points.spawn,
          controller,
          movementConfig: this.createNpcRuntimeMovementConfig(actorProfile),
          actorProfile,
          visualProfile,
        });
        character.sprite.setTint?.(GUEST_CONFIG.tint);
        return this.characterSystem.add(character);
      },
      removeGuest: (id) => this.characterSystem.remove(id),
      getTavernOpen: () => this.sessionState.gameplay.tavernOpen,
      getKitchenState: () => this.sessionState.gameplay.kitchen,
      getServicePoint: () => this.facilityRuntime?.getDefinitionByType?.("serving-table")?.usePosition
        ?? GUEST_CONFIG.points.insideDoor,
      getSeatPoint: () => this.facilityRuntime?.getDefinitionByType?.("table")?.usePosition
        ?? this.facilityRuntime?.getDefinitionByType?.("serving-table")?.usePosition
        ?? GUEST_CONFIG.points.insideDoor,
      onReservationChange: () => {
        this.facilityRuntime?.syncKitchenVisuals?.();
        this.interactionRuntime?.refresh?.();
      },
      onDishConsumed: ({ position }) => {
        this.facilityRuntime?.syncKitchenVisuals?.();
        this.coinRuntime?.spawn?.(position);
        this.gameHud?.render?.();
        this.saveSession();
      },
      createFeedback: (character) => this.createGuestFeedback(character),
    });
  }

  createGuestFeedback(character) {
    const marker = this.add.graphics().setDepth(900);
    const reactionStyle = {
      fontSize: "7px",
      color: "#f7e7a1",
    };
    const reaction = createManagedText(this, 0, 0, "", reactionStyle).setDepth(902).setVisible(false);
    const reactionOutline = [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([x, y]) => ({
      x, y,
      visual: createManagedText(this, 0, 0, "", { ...reactionStyle, color: "#100b0e" })
        .setDepth(901)
        .setAlpha(0.72)
        .setVisible(false),
    }));
    const thumb = this.add.graphics().setDepth(902).setVisible(false);
    drawPixelThumb(thumb);
    const carriedDish = this.add.image(0, 0, PLATED_DISH_ASSET.key)
      .setScale(1, 0.5)
      .setDepth(901)
      .setVisible(false);
    let state = "";
    return {
      set: (next) => {
        state = next;
        const reactionText = state === "checking" ? "..."
          : state === "open-reaction" ? ":D"
            : state === "closed-reaction" ? ":("
              : state === "empty-reaction" ? ">:[" : "";
        const color = ["closed-reaction", "empty-reaction"].includes(state) ? "#ef8b78" : "#f7e7a1";
        reaction.setText(reactionText).setStyle({ color }).setVisible(Boolean(reactionText));
        for (const outline of reactionOutline) outline.visual.setText(reactionText).setVisible(Boolean(reactionText));
        thumb.setVisible(state === "meal-complete");
        carriedDish.setVisible(["carrying", "eating"].includes(state));
      },
      update: () => {
        const position = character.motor.position;
        const anchorX = Math.round(position.x);
        const anchorY = Math.round(position.y - 25);
        const reactionX = anchorX - Math.floor(reaction.width / 2);
        const reactionY = anchorY - reaction.height;
        reaction.setPosition(reactionX, reactionY).setDepth(902 + Math.round(position.y));
        for (const outline of reactionOutline) outline.visual
          .setPosition(reactionX + outline.x, reactionY + outline.y)
          .setDepth(901 + Math.round(position.y));
        thumb.setPosition(anchorX - 4, anchorY - 8).setDepth(902 + Math.round(position.y));
        carriedDish.setPosition(anchorX, Math.round(position.y - 19)).setDepth(901 + Math.round(position.y));
        marker.clear();
        if (["waiting", "eating"].includes(state)) {
          const color = state === "waiting" ? 0xf3c969 : state === "eating" ? 0x8bd17c : 0xe7e1c5;
          marker.fillStyle(color, 1).fillRect(position.x - 2, position.y - 23, 4, 2);
          if (state === "waiting") marker.fillRect(position.x + 3, position.y - 23, 1, 1);
        }
      },
      destroy: () => {
        marker.destroy();
        reaction.destroy();
        for (const outline of reactionOutline) outline.visual.destroy();
        thumb.destroy();
        carriedDish.destroy();
      },
    };
  }

  runWorldObjectInteraction(candidate) {
    if (candidate.kind === TAVERN_SIGN_KIND) {
      this.sessionState.gameplay.tavernOpen = !this.sessionState.gameplay.tavernOpen;
      this.tavernSignRuntime?.sync?.();
      this.interactionRuntime?.refresh?.();
      this.suppressNextInteract = true;
      return { status: this.sessionState.gameplay.tavernOpen ? "opened" : "closed", mutated: true };
    }
    if (candidate.kind === FACILITY_INTERACTION_KIND) {
      const facility = this.facilityRuntime.getDefinition(candidate.payload.facilityId);
      if (facility?.facilityType === "cutting-table" || facility?.facilityType === "gas-stove") {
        const stepType = facility.facilityType === "cutting-table"
          ? COOKING_STEP_TYPES.preparation
          : COOKING_STEP_TYPES.frying;
        const result = this.cookingRuntime.start(stepType);
        this.suppressNextInteract = true;
        this.interactionRuntime?.refresh?.();
        return result;
      }
      if (facility?.facilityType === "serving-table") {
        const result = toggleServingDish(this.sessionState.gameplay.kitchen);
        if (result.mutated) {
          this.facilityRuntime.syncKitchenVisuals();
          this.gameHud?.render?.();
          this.saveSession();
        }
        this.suppressNextInteract = true;
        this.interactionRuntime?.refresh?.();
        return result;
      }
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
      else this.startSleeping({ bedId: candidate.payload.bedId });
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
      onAddCookedDish: () => {
        this.sessionState.gameplay.kitchen.cookedDishes += 1;
        this.gameHud?.render?.();
        this.interactionRuntime?.refresh?.();
        this.saveSession();
      },
      onColliderVisibilityChange: (visible) => this.setColliderDebugVisible(visible),
      onColliderEditModeChange: (active) => this.setColliderEditMode(active),
      onColliderDraftConfirm: () => this.confirmColliderDraft(),
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
    if (this.colliderEditEnabled) this.setColliderDebugVisible(true);
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
    this.worldLayout.setColliderOverride(selection.groupKey, offsets);
    saveColliderDebugOverrides(this.colliderOverrides, window.localStorage);
    this.colliderEditSelection.draft = { ...this.worldLayout.getWorldObjectColliders().find(({ id }) => id === selection.id)?.rect };
    this.syncColliderEditorPanel();
    this.renderColliderDebug();
    return { status: "saved", id: selection.id };
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
    graphics.lineStyle(1, 0xff4f63, 0.95);
    for (const box of [...this.worldLayout.wallColliders, ...this.worldLayout.objectColliders]) {
      graphics.strokeRect(box.left, box.top, box.right - box.left, box.bottom - box.top);
    }
    graphics.lineStyle(1, 0x54d8ff, 0.95);
    for (const character of this.characterSystem?.values?.() ?? []) {
      const box = getFootBox(character.motor.position, character.footWidth, character.footDepth);
      graphics.strokeRect(box.left, box.top, box.right - box.left, box.bottom - box.top);
    }
    const draft = this.colliderEditSelection?.draft;
    if (draft) {
      graphics.lineStyle(1, 0x62ff91, 1);
      graphics.strokeRect(draft.left, draft.top, draft.right - draft.left, draft.bottom - draft.top);
      graphics.fillStyle(0x62ff91, 1);
      for (const [x, y] of [
        [draft.left, draft.top], [(draft.left + draft.right) / 2, draft.top], [draft.right, draft.top],
        [draft.left, (draft.top + draft.bottom) / 2], [draft.right, (draft.top + draft.bottom) / 2],
        [draft.left, draft.bottom], [(draft.left + draft.right) / 2, draft.bottom], [draft.right, draft.bottom],
      ]) {
        graphics.fillRect(x - 1, y - 1, 3, 3);
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
      getGameplayState: () => ({ ...this.sessionState?.gameplay, clock: formatClock(this.sessionState.gameplay.worldTimeSeconds, this.localization.getLanguage()), sleeping: this.sleeping, energyFlow: this.getEnergyFlow(), needsFlow: this.needsFlow }),
      onLanguageChange: () => this.interactionRuntime?.refresh?.(),
      onOptionsChange: (active) => this.cookingRuntime?.setInputSuppressed?.(active),
      onConfirmationChange: (active) => {
        this.interactionHud?.setSuppressed?.(active);
        this.cookingRuntime?.setInputSuppressed?.(active);
        if (!active) this.interactionRuntime?.refresh?.();
      },
      onNewGame: () => this.startNewGame(),
    });
  }

  createCookingRuntime() {
    this.cookingRuntime = createCookingRuntime(this, {
      sessionState: this.sessionState,
      localization: this.localization,
      onActiveChange: (active) => {
        this.gameHud?.setGameplayOverlayActive?.(active);
        this.interactionHud?.setSuppressed?.(active);
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
  }

  createBuildMode() {
    this.buildPlacedObjects = new Map();
    this.buildWallEdges = new Map();
    this.buildWallNodes = new Map();
    this.buildWallJunctions = new Map();
    this.buildGroundCells = new Map();
    this.buildSurfaceVisuals = new Map();
    this.buildFloorCells = new Map();
    this.buildCarpetCells = new Map();
    this.buildCarpetVisuals = new Map();
    this.buildPreviewObjects = [];
    this.buildDemolitionHighlight = null;
    this.buildUndoStack = [];
    this.activeBuildAction = null;
    this.canonicalPathCells = new Map(
      [...this.groundSprites].filter(([, entry]) => this.isPathFrame(entry.tile.frame)),
    );
    const canonicalWallPoints = this.worldLayout.wallEdges.map((edge) => ({
      x: edge.x,
      y: edge.y,
      orientation: edge.side === "top" || edge.side === "bottom" ? "horizontal" : "vertical",
      edgeId: edge.id,
    }));
    for (const point of canonicalWallPoints) {
      this.buildWallEdges.set(this.buildWallEdgeKey(point), point.edgeId);
    }
    for (const point of canonicalWallPoints) this.refreshBuildWallJunctions(point);
    this.ensureBuildSurfaceTextures();
    this.nextBuildObjectId = 0;
    this.buildMode = createBuildModeRuntime(this, {
      localization: this.localization,
      worldBounds: this.worldLayout.bounds,
      onPlace: (item, point, context) => this.applyBuildPlacement(item, point, context),
      onDemolish: (point, onlyType) => this.applyBuildDemolition(point, onlyType),
      onMoveStart: (point) => {
        const target = this.getBuildMoveTarget(point);
        return target ? { status: "picked", target } : { status: "ignored" };
      },
      onMove: (target, point) => this.applyBuildMove(target, point),
      onMovePreview: (target, point) => this.renderBuildMovePreview(target, point),
      onMoveHover: (point) => this.renderBuildMoveHover(point),
      onPreview: (item, points) => this.renderBuildPreview(item, points),
      onPreviewClear: () => this.clearBuildPreview(),
      onDemolitionPreview: (point) => this.renderBuildDemolitionHighlight(point),
      onActionBegin: () => this.beginBuildAction(),
      onActionEnd: () => this.endBuildAction(),
      onUndo: () => this.undoBuildAction(),
      isActivationAllowed: () => !this.cookingRuntime?.isActive?.(),
      onModeChange: (active) => {
        this.gameHud?.setSuppressed?.(active);
        this.interactionHud?.setSuppressed?.(active);
        this.movementDebugPanel?.setSuppressed?.(active);
        this.mobileJoystick?.reset?.();
        if (!active) this.interactionRuntime?.refresh?.();
      },
    });
  }

  beginBuildAction() {
    this.activeBuildAction = [];
  }

  recordBuildUndo(undo) {
    if (typeof undo === "function" && this.activeBuildAction) this.activeBuildAction.push(undo);
  }

  endBuildAction() {
    if (this.activeBuildAction?.length) {
      this.buildUndoStack.push(this.activeBuildAction);
      if (this.buildUndoStack.length > 100) this.buildUndoStack.shift();
    }
    this.activeBuildAction = null;
  }

  applyBuildPlacement(item, point, context) {
    const result = this.placeBuildAsset(item, point, context);
    if (result?.undo) {
      this.recordBuildUndo(result.undo);
    } else if (result?.status === "placed" && result.id) {
      if (item.placement === "facility") {
        this.recordBuildUndo(() => this.facilityRuntime?.remove?.(result.id));
      } else if (item.placement === "bed") {
        this.recordBuildUndo(() => this.debrisRuntime?.removeBed?.(result.id));
      } else {
        this.recordBuildUndo(() => this.removeBuildPlacedObjectById(result.id));
      }
    }
    return result;
  }

  applyBuildDemolition(point, onlyType) {
    const result = this.demolishBuildObject(point, onlyType);
    this.recordBuildUndo(result?.undo);
    return result;
  }

  getBuildMoveTarget(point) {
    const hitPoint = { x: Number(point.rawX ?? point.x), y: Number(point.rawY ?? point.y) };
    const facility = this.facilityRuntime?.getDefinitionAt?.(hitPoint);
    if (facility) return { kind: "facility", definition: facility };
    const bed = this.debrisRuntime?.getBedDefinitionAt?.(hitPoint);
    return bed ? { kind: "bed", definition: bed } : null;
  }

  applyBuildMove(target, point) {
    if (!target?.definition) return { status: "ignored" };
    const result = target.kind === "facility"
      ? this.facilityRuntime?.move?.(target.definition.id, point)
      : target.kind === "bed" ? this.debrisRuntime?.moveBed?.(target.definition.id, point) : null;
    if (!result) return { status: "blocked" };
    this.recordBuildUndo(() => {
      if (target.kind === "facility") this.facilityRuntime?.replace?.(result.previous);
      else this.debrisRuntime?.replaceBed?.(result.previous);
      this.facilityRuntime?.syncKitchenVisuals?.();
      this.interactionRuntime?.refresh?.();
    });
    this.facilityRuntime?.syncKitchenVisuals?.();
    this.interactionRuntime?.refresh?.();
    return { status: "moved" };
  }

  renderBuildMovePreview(target, point) {
    this.clearBuildPreview();
    if (!target?.definition) return;
    const graphics = this.add.graphics().setPosition(point.x, point.y).setDepth(8988).setAlpha(0.58);
    if (target.kind === "bed") drawBed(graphics, 0x7dff9a);
    else drawFacility(graphics, target.definition.facilityType, 0x7dff9a);
    this.buildPreviewObjects.push(graphics);
  }

  renderBuildMoveHover(point) {
    this.clearBuildPreview();
    const hitPoint = { x: Number(point.rawX ?? point.x), y: Number(point.rawY ?? point.y) };
    const target = this.facilityRuntime?.getMoveTargetAt?.(hitPoint)
      ?? this.debrisRuntime?.getBedDemolitionTargetAt?.(hitPoint);
    if (!target) return;
    const targets = target.targets.map((object) => ({ target: object, alpha: object.alpha ?? 1 }));
    for (const { target: object } of targets) {
      object.setTint?.(0x68ff8c);
      object.setAlpha?.(0.82);
    }
    this.buildDemolitionHighlight = { targets, overlay: null };
  }

  undoBuildAction() {
    const action = this.buildUndoStack.pop();
    if (!action) return { status: "empty" };
    this.clearBuildPreview();
    for (const undo of [...action].reverse()) undo();
    this.interactionRuntime?.refresh?.();
    return { status: "undone" };
  }

  clearBuildPreview() {
    for (const object of this.buildPreviewObjects) object.destroy();
    this.buildPreviewObjects = [];
    if (!this.buildDemolitionHighlight) return;
    for (const { target, alpha } of this.buildDemolitionHighlight.targets) {
      target.clearTint?.();
      target.setAlpha?.(alpha);
    }
    this.buildDemolitionHighlight.overlay?.destroy();
    this.buildDemolitionHighlight = null;
  }

  addBuildPreviewImage(x, y, textureKey, frame, depth = 8988) {
    const sprite = this.add.image(x, y, textureKey, frame)
      .setOrigin(0)
      .setDepth(depth)
      .setAlpha(0.52);
    this.buildPreviewObjects.push(sprite);
    return sprite;
  }

  renderBuildPreview(item, points) {
    this.clearBuildPreview();
    if (!item || !points?.length) return;
    const uniquePoints = [...new Map(points.map((point) => [this.buildCellKey(point), point])).values()];
    if (item.placement === "wall") {
      this.renderBuildWallPreview(uniquePoints);
      return;
    }
    if (item.placement === "carpet") {
      this.renderBuildCarpetPreview(uniquePoints);
      return;
    }
    if (item.placement === "tile") {
      for (const point of uniquePoints) {
        for (const offset of [
          [-TILE_SIZE, -TILE_SIZE],
          [0, -TILE_SIZE],
          [-TILE_SIZE, 0],
          [0, 0],
        ]) {
          this.addBuildPreviewImage(point.x + offset[0], point.y + offset[1], item.textureKey, item.frame);
        }
      }
      return;
    }
    if (item.placement === "bed" || item.placement === "facility") {
      for (const point of uniquePoints) {
        const graphics = this.add.graphics().setPosition(point.x, point.y).setDepth(8988).setAlpha(0.52);
        if (item.placement === "bed") drawBed(graphics);
        else drawFacility(graphics, item.facilityType);
        this.buildPreviewObjects.push(graphics);
      }
      return;
    }
    for (const point of uniquePoints) {
      if (item.placement === "tree") {
        for (let row = 0; row < 4; row += 1) {
          for (let column = 0; column < 3; column += 1) {
            this.addBuildPreviewImage(
              point.x + column * TILE_SIZE,
              point.y + row * TILE_SIZE,
              item.textureKey,
              row * 9 + column,
            );
          }
        }
      } else if (item.textureKey) {
        this.addBuildPreviewImage(point.x, point.y, item.textureKey, item.frame);
      }
    }
  }

  renderBuildWallPreview(points) {
    if (points.length === 1) {
      this.addBuildPreviewImage(
        points[0].x - TILE_SIZE / 2,
        points[0].y - TILE_SIZE,
        HOUSE_TEXTURE_KEY,
        HOUSE_FRAMES.sideLeft,
      );
      return;
    }
    const horizontal = points.every((point) => point.y === points[0].y);
    const ordered = [...points].sort((a, b) => horizontal ? a.x - b.x : a.y - b.y);
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const first = ordered[index];
      const second = ordered[index + 1];
      if (horizontal) {
        this.addBuildPreviewImage(first.x, first.y - TILE_SIZE, HOUSE_TEXTURE_KEY, HOUSE_FRAMES.bottom);
      } else {
        this.addBuildPreviewImage(
          first.x - TILE_SIZE / 2,
          Math.min(first.y, second.y) + getBuildVerticalWallOffset(),
          HOUSE_TEXTURE_KEY,
          HOUSE_FRAMES.wallRightCap,
        );
      }
    }
    if (!horizontal) {
      const top = ordered[0];
      const bottom = ordered.at(-1);
      const topIncidents = this.getBuildWallIncidents(top);
      const bottomIncidents = this.getBuildWallIncidents(bottom);
      if (!topIncidents.north && !topIncidents.east && !topIncidents.west) {
        this.addBuildPreviewImage(
          top.x - TILE_SIZE / 2,
          top.y - TILE_SIZE,
          HOUSE_TEXTURE_KEY,
          HOUSE_FRAMES.sideLeft,
          8987,
        );
      }
      if (!bottomIncidents.south && !bottomIncidents.east && !bottomIncidents.west) {
        this.addBuildPreviewImage(
          bottom.x - TILE_SIZE / 2,
          bottom.y - TILE_SIZE,
          HOUSE_TEXTURE_KEY,
          HOUSE_FRAMES.sideLeft,
          8989,
        );
      }
      return;
    }
    const left = ordered[0];
    const right = ordered.at(-1);
    if (!this.hasBuildWallVertex(left)) {
      this.addBuildPreviewImage(left.x - TILE_SIZE / 2, left.y - TILE_SIZE, HOUSE_TEXTURE_KEY, HOUSE_FRAMES.bottomLeft);
    }
    if (!this.hasBuildWallVertex(right)) {
      this.addBuildPreviewImage(right.x - TILE_SIZE / 2, right.y - TILE_SIZE, HOUSE_TEXTURE_KEY, HOUSE_FRAMES.bottomRight);
    }
  }

  renderBuildCarpetPreview(points) {
    const occupied = new Set(this.buildCarpetCells.keys());
    for (const point of points) occupied.add(this.buildCellKey(point));
    const visualTiles = new Map();
    for (const point of points) {
      for (const tile of [
        { x: point.x - TILE_SIZE, y: point.y - TILE_SIZE },
        { x: point.x, y: point.y - TILE_SIZE },
        { x: point.x - TILE_SIZE, y: point.y },
        { x: point.x, y: point.y },
      ]) visualTiles.set(this.buildCellKey(tile), tile);
    }
    for (const tile of visualTiles.values()) {
      const samples = [
        [1, tile.x, tile.y],
        [2, tile.x + TILE_SIZE, tile.y],
        [4, tile.x, tile.y + TILE_SIZE],
        [8, tile.x + TILE_SIZE, tile.y + TILE_SIZE],
      ];
      const mask = samples.reduce((value, [bit, x, y]) => (
        occupied.has(this.buildCellKey({ x, y })) ? value | bit : value
      ), 0);
      if (mask) this.addBuildPreviewImage(tile.x, tile.y, HOUSE_TEXTURE_KEY, BUILD_CARPET_FRAME_BY_MASK[mask]);
    }
  }

  renderBuildDemolitionHighlight(point) {
    this.clearBuildPreview();
    const target = this.getBuildDemolitionPreviewTarget(point);
    if (!target) return;
    const targets = target.targets.map((object) => ({ target: object, alpha: object.alpha ?? 1 }));
    let tintable = false;
    for (const { target: object } of targets) {
      if (object.setTint) {
        object.setTint(0xff6b72);
        tintable = true;
      }
      object.setAlpha?.(0.78);
    }
    let overlay = null;
    if (!tintable && (target.kind === "facility" || target.kind === "bed")) {
      overlay = this.add.graphics()
        .setPosition(target.bounds.left, target.bounds.top)
        .setDepth(8989)
        .setAlpha(0.68);
      if (target.kind === "bed") drawBed(overlay, 0xff5b66);
      else drawFacility(overlay, target.facilityType, 0xff5b66);
    }
    this.buildDemolitionHighlight = { targets, overlay };
  }

  getBuildDemolitionPreviewTarget(point) {
    const hitPoint = {
      x: Number(point.rawX ?? point.x),
      y: Number(point.rawY ?? point.y),
    };
    const facility = this.facilityRuntime?.getDemolitionTargetAt?.(hitPoint);
    if (facility) return facility;
    const bed = this.debrisRuntime?.getBedDemolitionTargetAt?.(hitPoint);
    if (bed) return bed;
    const placed = [...this.buildPlacedObjects.values()]
      .reverse()
      .find((object) => this.isPointInWorldBounds(hitPoint, object.bounds));
    if (placed) return { targets: placed.sprites, bounds: placed.bounds };
    const floor = this.floorSprites.get(this.buildCellKey({ x: point.x, y: point.y }));
    if (floor) {
      return {
        targets: [floor.sprite],
        bounds: { left: point.x, right: point.x + TILE_SIZE, top: point.y, bottom: point.y + TILE_SIZE },
      };
    }
    const wall = [...this.wallSprites.values()]
      .reverse()
      .find(({ tile }) => this.isPointInWorldBounds(hitPoint, {
        left: tile.worldX,
        right: tile.worldX + TILE_SIZE,
        top: tile.worldY,
        bottom: tile.worldY + TILE_SIZE,
      }));
    return wall
      ? {
        targets: [wall.sprite, ...wall.extraSprites],
        bounds: {
          left: wall.tile.worldX,
          right: wall.tile.worldX + TILE_SIZE,
          top: wall.tile.worldY,
          bottom: wall.tile.worldY + TILE_SIZE,
        },
      }
      : null;
  }

  placeBuildAsset(item, point, context = {}) {
    if (item.placement === "facility") {
      const definition = this.facilityRuntime?.add?.(item.facilityType, point);
      this.interactionRuntime?.refresh?.();
      return { status: definition ? "placed" : "blocked", id: definition?.id };
    }
    if (item.placement === "bed") {
      const definition = this.debrisRuntime?.addBed?.(point);
      this.interactionRuntime?.refresh?.();
      return { status: definition ? "placed" : "blocked", id: definition?.id };
    }
    if (item.placement === "wall") return this.placeBuildWall(item, point, context);
    if (item.placement === "tile") return this.placeBuildGround(item, point);
    if (item.placement === "floor") return this.placeBuildFloor(item, point);
    if (item.placement === "carpet") return this.placeBuildCarpet(item, point);

    const id = `editor-world-${++this.nextBuildObjectId}`;
    const sprites = [];
    let bounds = { left: point.x, right: point.x + TILE_SIZE, top: point.y, bottom: point.y + TILE_SIZE };
    let collider = null;
    if (item.placement === "tree") {
      for (let row = 0; row < 4; row += 1) {
        for (let column = 0; column < 3; column += 1) {
          sprites.push(this.add.image(
            point.x + column * TILE_SIZE,
            point.y + row * TILE_SIZE,
            item.textureKey,
            row * 9 + column,
          ).setOrigin(0).setDepth(500 + point.y + 4 * TILE_SIZE));
        }
      }
      bounds = { left: point.x, right: point.x + 3 * TILE_SIZE, top: point.y, bottom: point.y + 4 * TILE_SIZE };
      collider = { left: point.x + TILE_SIZE, right: point.x + 2 * TILE_SIZE, top: point.y + 3 * TILE_SIZE, bottom: point.y + 4 * TILE_SIZE };
    } else {
      sprites.push(this.add.image(point.x, point.y, item.textureKey, item.frame).setOrigin(0).setDepth(1));
    }
    if (collider && this.worldLayout.isBlockedBox(collider)) {
      for (const sprite of sprites) sprite.destroy();
      return { status: "blocked" };
    }
    const colliderGroup = collider ? `build:${item.placement ?? item.id}` : null;
    if (collider) this.worldLayout.setWorldObjectCollider(id, collider, colliderGroup);
    this.buildPlacedObjects.set(id, {
      id,
      kind: item.placement ?? "placed",
      item: { ...item },
      point: { ...point },
      sprites,
      bounds,
      collider: Boolean(collider),
      colliderBounds: collider ? { ...collider } : null,
      colliderGroup,
    });
    return { status: "placed", id };
  }

  placeBuildFloor(item, point) {
    const cell = this.buildCellKey(point);
    if (this.buildFloorCells.has(cell)) return { status: "blocked" };
    const id = `editor-floor-${++this.nextBuildObjectId}`;
    const bounds = { left: point.x, right: point.x + TILE_SIZE, top: point.y, bottom: point.y + TILE_SIZE };
    const sprite = this.add.image(point.x, point.y, item.textureKey, item.frame).setOrigin(0).setDepth(20);
    this.buildPlacedObjects.set(id, {
      id,
      kind: "floor",
      item: { ...item },
      point: { ...point },
      sprites: [sprite],
      bounds,
      collider: false,
    });
    this.buildFloorCells.set(cell, id);
    return { status: "placed", id };
  }

  placeBuildCarpet(item, point) {
    const cell = this.buildCellKey(point);
    if (this.buildCarpetCells.has(cell)) return { status: "blocked" };
    const id = `editor-carpet-${++this.nextBuildObjectId}`;
    this.buildPlacedObjects.set(id, {
      id,
      kind: "carpet",
      item: { ...item },
      point: { ...point },
      sprites: [],
      bounds: {
        left: point.x - TILE_SIZE / 2,
        right: point.x + TILE_SIZE / 2,
        top: point.y - TILE_SIZE / 2,
        bottom: point.y + TILE_SIZE / 2,
      },
      collider: false,
    });
    this.buildCarpetCells.set(cell, id);
    this.refreshBuildCarpet(point);
    return { status: "placed", id };
  }

  placeBuildGround(item, point) {
    const cell = this.buildCellKey(point);
    const previousId = this.buildGroundCells.get(cell);
    const previous = previousId ? this.buildPlacedObjects.get(previousId) : null;
    if (previous) {
      this.buildPlacedObjects.delete(previous.id);
      this.buildGroundCells.delete(cell);
    }
    const id = `editor-ground-${++this.nextBuildObjectId}`;
    const bounds = {
      left: point.x - TILE_SIZE / 2,
      right: point.x + TILE_SIZE / 2,
      top: point.y - TILE_SIZE / 2,
      bottom: point.y + TILE_SIZE / 2,
    };
    this.buildPlacedObjects.set(id, {
      id,
      kind: "ground",
      item: { ...item },
      material: item.id,
      point: { ...point },
      sprites: [],
      bounds,
      collider: false,
    });
    this.buildGroundCells.set(cell, id);
    this.refreshBuildSurface(point);
    return {
      status: "placed",
      id,
      undo: () => {
        this.removeBuildPlacedObjectById(id);
        if (previous) this.restoreBuildPlacedObject(previous);
      },
    };
  }

  placeBuildWall(item, point, context = {}) {
    if (context.gesture === "drag" && context.previousPoint) {
      const edge = this.getBuildWallEdgeBetweenVertices(context.previousPoint, point);
      if (!edge || this.buildWallEdges.has(this.buildWallEdgeKey(edge))) return { status: "exists" };
      const { collider, placementProbe } = this.getBuildWallEdgeGeometry(edge);
      if (this.worldLayout.isBlockedBox(placementProbe) || this.doesPlayerOverlapBox(collider)) {
        return { status: "blocked" };
      }
      const id = this.addBuildWallEdge(item, edge);
      if (!id) return { status: "exists" };
      for (const vertex of this.getBuildWallVertices(edge)) {
        this.refreshBuildWallJunction(vertex);
        this.refreshBuildWallEdgesAtVertex(vertex);
      }
      return { status: "placed", id };
    }

    const key = this.buildCellKey(point);
    if (this.buildWallNodes.has(key)) return { status: "exists" };
    const nodeCollider = {
      left: point.x - 2,
      right: point.x + 2,
      top: point.y - 2,
      bottom: point.y + 2,
    };
    const overlapsExistingWall = this.hasBuildWallVertex(point);
    if ((!overlapsExistingWall && this.worldLayout.isBlockedBox(nodeCollider))
      || this.doesPlayerOverlapBox(nodeCollider)) {
      return { status: "blocked" };
    }
    const id = `editor-wall-node-${++this.nextBuildObjectId}`;
    this.worldLayout.setWorldObjectCollider(id, nodeCollider, "build:wall-node");
    this.buildPlacedObjects.set(id, {
      id,
      kind: "wall-node",
      item: { ...item },
      point: { x: point.x, y: point.y },
      sprites: [],
      bounds: {
        left: point.x - TILE_SIZE / 2,
        right: point.x + TILE_SIZE / 2,
        top: point.y - TILE_SIZE,
        bottom: point.y,
      },
      collider: true,
      colliderBounds: nodeCollider,
      colliderGroup: "build:wall-node",
      textureKey: item.textureKey,
    });
    this.buildWallNodes.set(key, id);
    this.refreshBuildWallJunction(point);
    this.refreshBuildWallEdgesAtVertex(point);
    return { status: "placed", id };
  }

  getBuildWallEdgeBetweenVertices(first, second) {
    if (first.x === second.x && Math.abs(first.y - second.y) === TILE_SIZE) {
      return { x: first.x, y: Math.min(first.y, second.y), orientation: "vertical" };
    }
    if (first.y === second.y && Math.abs(first.x - second.x) === TILE_SIZE) {
      return { x: Math.min(first.x, second.x), y: first.y, orientation: "horizontal" };
    }
    return null;
  }

  addBuildWallEdge(item, point) {
    const edge = this.buildWallEdgeKey(point);
    if (this.buildWallEdges.has(edge)) return null;
    const { bounds, collider } = this.getBuildWallEdgeGeometry(point);
    const id = `editor-wall-${++this.nextBuildObjectId}`;
    this.worldLayout.setWorldObjectCollider(id, collider, "build:wall");
    this.buildPlacedObjects.set(id, {
      id,
      kind: "wall",
      item: { ...item },
      point: { ...point },
      sprites: [],
      bounds,
      collider: true,
      colliderBounds: collider,
      colliderGroup: "build:wall",
      textureKey: item.textureKey,
    });
    this.buildWallEdges.set(edge, id);
    this.refreshBuildWallEdgeVisual(point);
    return id;
  }

  getBuildWallEdgeFrames(point) {
    if (point.orientation === "vertical") {
      const top = this.getBuildWallIncidents({ x: point.x, y: point.y });
      const bottom = this.getBuildWallIncidents({ x: point.x, y: point.y + TILE_SIZE });
      const joinsEast = top.east || bottom.east;
      const joinsWest = top.west || bottom.west;
      return [getBuildVerticalWallFrame({ joinsEast, joinsWest })];
    }
    const left = this.getBuildWallIncidents({ x: point.x, y: point.y });
    const right = this.getBuildWallIncidents({ x: point.x + TILE_SIZE, y: point.y });
    const leftCap = !left.west;
    const rightCap = !right.east;
    const frames = [HOUSE_FRAMES.bottom];
    if (leftCap) frames.push(HOUSE_FRAMES.bottomLeft);
    if (rightCap) frames.push(HOUSE_FRAMES.bottomRight);
    return frames;
  }

  createBuildWallEdgeSprites(point, textureKey, frames) {
    const vertical = point.orientation === "vertical";
    return frames.map((frame) => this.add.image(
      vertical
        ? point.x - TILE_SIZE / 2
        : frame === HOUSE_FRAMES.bottomLeft
          ? point.x - TILE_SIZE / 2
          : frame === HOUSE_FRAMES.bottomRight
            ? point.x + TILE_SIZE / 2
            : point.x,
      vertical ? point.y + getBuildVerticalWallOffset() : point.y - TILE_SIZE,
      textureKey,
      frame,
    )
      .setOrigin(0)
      .setDepth(500 + point.y + (vertical ? TILE_SIZE : 0)));
  }

  refreshBuildWallEdgeVisual(point) {
    const id = this.buildWallEdges.get(this.buildWallEdgeKey(point));
    if (!id) return;
    const frames = this.getBuildWallEdgeFrames(point);
    const placed = this.buildPlacedObjects.get(id);
    if (placed) {
      for (const sprite of placed.sprites) sprite.destroy();
      placed.sprites = this.createBuildWallEdgeSprites(point, placed.textureKey, frames);
      return;
    }
    const canonical = [...this.wallSprites.values()]
      .find((entry) => entry.tile.edgeIds.includes(id));
    if (!canonical) return;
    canonical.sprite.destroy();
    for (const sprite of canonical.extraSprites) sprite.destroy();
    const sprites = this.createBuildWallEdgeSprites(point, HOUSE_TEXTURE_KEY, frames);
    canonical.sprite = sprites[0];
    canonical.extraSprites = sprites.slice(1);
  }

  refreshBuildWallEdgesAtVertex(vertex) {
    for (const edge of [
      { x: vertex.x - TILE_SIZE, y: vertex.y, orientation: "horizontal" },
      { x: vertex.x, y: vertex.y, orientation: "horizontal" },
    ]) {
      this.refreshBuildWallEdgeVisual(edge);
    }
  }

  getBuildWallEdgeGeometry(point) {
    const vertical = point.orientation === "vertical";
    const bounds = vertical
      ? { left: point.x - TILE_SIZE, right: point.x + TILE_SIZE, top: point.y, bottom: point.y + TILE_SIZE }
      : { left: point.x - TILE_SIZE / 2, right: point.x + TILE_SIZE * 1.5, top: point.y - TILE_SIZE, bottom: point.y };
    const collider = vertical
      ? { left: point.x - 2, right: point.x + 2, top: point.y, bottom: point.y + TILE_SIZE }
      : { left: point.x, right: point.x + TILE_SIZE, top: point.y - 2, bottom: point.y + 2 };
    const placementProbe = vertical
      ? { ...collider, top: collider.top + 2, bottom: collider.bottom - 2 }
      : { ...collider, left: collider.left + 2, right: collider.right - 2 };
    return { vertical, bounds, collider, placementProbe };
  }

  getAdjacentBuildWallEdges(point) {
    return [
      {
        neighbor: { x: point.x, y: point.y - TILE_SIZE },
        edge: { x: point.x, y: point.y - TILE_SIZE, orientation: "vertical" },
      },
      {
        neighbor: { x: point.x + TILE_SIZE, y: point.y },
        edge: { x: point.x, y: point.y, orientation: "horizontal" },
      },
      {
        neighbor: { x: point.x, y: point.y + TILE_SIZE },
        edge: { x: point.x, y: point.y, orientation: "vertical" },
      },
      {
        neighbor: { x: point.x - TILE_SIZE, y: point.y },
        edge: { x: point.x - TILE_SIZE, y: point.y, orientation: "horizontal" },
      },
    ];
  }

  hasBuildWallVertex(point) {
    if (this.buildWallNodes.has(this.buildCellKey(point))) return true;
    return Object.values(this.getBuildWallIncidents(point)).some(Boolean);
  }

  doesPlayerOverlapBox(box) {
    const player = this.characterSystem?.require?.(this.sessionState.playerId);
    if (!player) return false;
    const foot = getFootBox(player.motor.position, player.motor.footWidth, player.motor.footDepth);
    return foot.left < box.right
      && foot.right > box.left
      && foot.top < box.bottom
      && foot.bottom > box.top;
  }

  refreshBuildWallJunctions(edge) {
    for (const vertex of this.getBuildWallVertices(edge)) this.refreshBuildWallJunction(vertex);
  }

  refreshBuildWallJunction(vertex) {
    const key = this.buildCellKey(vertex);
    const previous = this.buildWallJunctions.get(key);
    if (previous) {
      for (const sprite of previous) sprite.destroy();
      this.buildWallJunctions.delete(key);
    }
    const incidents = this.getBuildWallIncidents(vertex);
    const explicit = this.buildWallNodes.has(key);
    const frames = getBuildWallFrames({ ...incidents, explicit });
    if (!frames.length) return;
    const verticalTerminus = incidents.north !== incidents.south && !incidents.east && !incidents.west;
    const depth = 500 + vertex.y + getBuildWallColumnDepthOffset({
      verticalTerminus,
      explicit,
      isBottom: incidents.north,
    });
    const spriteY = vertex.y + getBuildWallColumnOffset({ verticalTerminus, explicit });
    const sprites = frames.map((frame) => this.add.image(
      vertex.x - TILE_SIZE / 2,
      spriteY,
      HOUSE_TEXTURE_KEY,
      frame,
    ).setOrigin(0).setDepth(depth));
    this.buildWallJunctions.set(key, sprites);
  }

  getBuildWallVertices(edge) {
    return edge.orientation === "vertical"
      ? [{ x: edge.x, y: edge.y }, { x: edge.x, y: edge.y + TILE_SIZE }]
      : [{ x: edge.x, y: edge.y }, { x: edge.x + TILE_SIZE, y: edge.y }];
  }

  getBuildWallIncidents(vertex) {
    const has = (orientation, x, y) => this.buildWallEdges.has(`${orientation}:${x},${y}`);
    return {
      north: has("vertical", vertex.x, vertex.y - TILE_SIZE),
      east: has("horizontal", vertex.x, vertex.y),
      south: has("vertical", vertex.x, vertex.y),
      west: has("horizontal", vertex.x - TILE_SIZE, vertex.y),
    };
  }

  buildWallEdgeKey(edge) {
    return `${edge.orientation}:${edge.x},${edge.y}`;
  }

  refreshBuildCarpet(point) {
    const visualTiles = [
      { x: point.x - TILE_SIZE, y: point.y - TILE_SIZE },
      { x: point.x, y: point.y - TILE_SIZE },
      { x: point.x - TILE_SIZE, y: point.y },
      { x: point.x, y: point.y },
    ];
    for (const tile of visualTiles) {
      const key = this.buildCellKey(tile);
      this.buildCarpetVisuals.get(key)?.destroy();
      this.buildCarpetVisuals.delete(key);
      const mask = this.getBuildCarpetMask(tile);
      if (!mask) continue;
      const sprite = this.add.image(
        tile.x,
        tile.y,
        HOUSE_TEXTURE_KEY,
        BUILD_CARPET_FRAME_BY_MASK[mask],
      ).setOrigin(0).setDepth(25);
      this.buildCarpetVisuals.set(key, sprite);
    }
  }

  getBuildCarpetMask(tile) {
    return [
      { bit: 1, x: tile.x, y: tile.y },
      { bit: 2, x: tile.x + TILE_SIZE, y: tile.y },
      { bit: 4, x: tile.x, y: tile.y + TILE_SIZE },
      { bit: 8, x: tile.x + TILE_SIZE, y: tile.y + TILE_SIZE },
    ].reduce((mask, sample) => (
      this.buildCarpetCells.has(this.buildCellKey(sample)) ? mask | sample.bit : mask
    ), 0);
  }

  refreshBuildSurface(point) {
    const visualTiles = [
      { x: point.x - TILE_SIZE, y: point.y - TILE_SIZE },
      { x: point.x, y: point.y - TILE_SIZE },
      { x: point.x - TILE_SIZE, y: point.y },
      { x: point.x, y: point.y },
    ];
    for (const tile of visualTiles) {
      const key = this.buildCellKey(tile);
      this.buildSurfaceVisuals.get(key)?.destroy();
      const mask = this.getBuildSurfaceMask(tile);
      const customKey = `build-surface-mask-${mask}`;
      const sprite = BUILD_SURFACE_CUSTOM_MASKS.includes(mask)
        ? this.add.image(tile.x, tile.y, customKey)
        : this.add.image(tile.x, tile.y, OUTDOOR_TEXTURE_KEY, BUILD_SURFACE_FRAME_BY_MASK[mask]);
      sprite.setOrigin(0).setDepth(1);
      this.buildSurfaceVisuals.set(key, sprite);
    }
  }

  getBuildSurfaceMask(tile) {
    return [
      { bit: 1, x: tile.x, y: tile.y },
      { bit: 2, x: tile.x + TILE_SIZE, y: tile.y },
      { bit: 4, x: tile.x, y: tile.y + TILE_SIZE },
      { bit: 8, x: tile.x + TILE_SIZE, y: tile.y + TILE_SIZE },
    ].reduce((mask, sample) => (
      this.getBuildSurfaceMaterial(sample) === "path" ? mask | sample.bit : mask
    ), 0);
  }

  getBuildSurfaceMaterial(point) {
    const cell = this.buildCellKey(point);
    const buildId = this.buildGroundCells.get(cell);
    if (buildId) return this.buildPlacedObjects.get(buildId)?.material ?? "grass";
    return this.canonicalPathCells.has(cell) ? "path" : "grass";
  }

  ensureBuildSurfaceTextures() {
    const source = this.textures.get(OUTDOOR_TEXTURE_KEY).getSourceImage();
    const sourceColumns = Math.floor(source.width / TILE_SIZE);
    const drawFrame = (context, frame, cropX = 0, cropY = 0, size = TILE_SIZE) => {
      const sourceX = (frame % sourceColumns) * TILE_SIZE + cropX;
      const sourceY = Math.floor(frame / sourceColumns) * TILE_SIZE + cropY;
      context.drawImage(source, sourceX, sourceY, size, size, cropX, cropY, size, size);
    };
    const framePixels = (frame) => {
      const canvas = document.createElement("canvas");
      canvas.width = TILE_SIZE;
      canvas.height = TILE_SIZE;
      const context = canvas.getContext("2d");
      const sourceX = (frame % sourceColumns) * TILE_SIZE;
      const sourceY = Math.floor(frame / sourceColumns) * TILE_SIZE;
      context.drawImage(source, sourceX, sourceY, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
      return context.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
    };
    const grassPixels = framePixels(OUTDOOR_FRAMES.grass);
    const half = TILE_SIZE / 2;
    const fringe = TILE_SIZE / 4;
    const diagonalPathCorners = {
      6: [
        { frame: OUTDOOR_FRAMES.pathBottom[0], x: half, y: 0 },
        { frame: OUTDOOR_FRAMES.pathTop[2], x: 0, y: half },
      ],
      9: [
        { frame: OUTDOOR_FRAMES.pathBottom[2], x: 0, y: 0 },
        { frame: OUTDOOR_FRAMES.pathTop[0], x: half, y: half },
      ],
    };
    const applyCorner = (output, corner) => {
      const pixels = framePixels(corner.frame);
      const east = corner.x === half;
      const south = corner.y === half;
      for (let y = 0; y < TILE_SIZE; y += 1) {
        for (let x = 0; x < TILE_SIZE; x += 1) {
          const inCoreX = east ? x >= half : x < half;
          const inCoreY = south ? y >= half : y < half;
          const inFringeX = east ? x >= half - fringe : x < half + fringe;
          const inFringeY = south ? y >= half - fringe : y < half + fringe;
          const index = (y * TILE_SIZE + x) * 4;
          const difference = Math.abs(pixels.data[index] - grassPixels.data[index])
            + Math.abs(pixels.data[index + 1] - grassPixels.data[index + 1])
            + Math.abs(pixels.data[index + 2] - grassPixels.data[index + 2]);
          if ((inCoreX && inCoreY) || (inFringeX && inFringeY && difference > 18)) {
            output.data[index] = pixels.data[index];
            output.data[index + 1] = pixels.data[index + 1];
            output.data[index + 2] = pixels.data[index + 2];
            output.data[index + 3] = pixels.data[index + 3];
          }
        }
      }
    };
    for (const mask of BUILD_SURFACE_CUSTOM_MASKS) {
      const key = `build-surface-mask-${mask}`;
      if (this.textures.exists(key)) continue;
      const texture = this.textures.createCanvas(key, TILE_SIZE, TILE_SIZE);
      const context = texture.getContext();
      context.imageSmoothingEnabled = false;
      drawFrame(context, OUTDOOR_FRAMES.grass);
      const output = context.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
      for (const corner of diagonalPathCorners[mask]) {
        applyCorner(output, corner);
      }
      context.putImageData(output, 0, 0);
      texture.refresh();
    }
  }

  isPathFrame(frame) {
    return [
      ...OUTDOOR_FRAMES.pathTop,
      ...OUTDOOR_FRAMES.pathMiddle,
      ...OUTDOOR_FRAMES.pathBottom,
    ].includes(frame);
  }

  buildCellKey(point) {
    return `${point.x},${point.y}`;
  }

  removeBuildPlacedObjectById(id) {
    const placed = this.buildPlacedObjects.get(id);
    if (!placed) return null;
    for (const sprite of placed.sprites) sprite.destroy();
    if (placed.collider) this.worldLayout.clearWorldObjectCollider(placed.id);
    this.buildPlacedObjects.delete(placed.id);
    if (placed.kind === "wall") {
      this.buildWallEdges.delete(this.buildWallEdgeKey(placed.point));
      this.refreshBuildWallJunctions(placed.point);
      for (const vertex of this.getBuildWallVertices(placed.point)) {
        this.refreshBuildWallEdgesAtVertex(vertex);
      }
    }
    if (placed.kind === "wall-node") {
      this.buildWallNodes.delete(this.buildCellKey(placed.point));
      this.refreshBuildWallJunction(placed.point);
    }
    if (placed.kind === "ground") {
      this.buildGroundCells.delete(this.buildCellKey(placed.point));
      this.refreshBuildSurface(placed.point);
    }
    if (placed.kind === "carpet") {
      this.buildCarpetCells.delete(this.buildCellKey(placed.point));
      this.refreshBuildCarpet(placed.point);
    }
    if (placed.kind === "floor") this.buildFloorCells.delete(this.buildCellKey(placed.point));
    return placed;
  }

  restoreBuildPlacedObject(placed) {
    if (!placed || this.buildPlacedObjects.has(placed.id)) return false;
    const restored = { ...placed, sprites: [] };
    this.buildPlacedObjects.set(restored.id, restored);
    if (restored.collider && restored.colliderBounds) {
      this.worldLayout.setWorldObjectCollider(restored.id, restored.colliderBounds, restored.colliderGroup ?? restored.id);
    }
    if (restored.kind === "wall") {
      this.buildWallEdges.set(this.buildWallEdgeKey(restored.point), restored.id);
      this.refreshBuildWallEdgeVisual(restored.point);
      this.refreshBuildWallJunctions(restored.point);
      for (const vertex of this.getBuildWallVertices(restored.point)) {
        this.refreshBuildWallEdgesAtVertex(vertex);
      }
      return true;
    }
    if (restored.kind === "wall-node") {
      this.buildWallNodes.set(this.buildCellKey(restored.point), restored.id);
      this.refreshBuildWallJunction(restored.point);
      this.refreshBuildWallEdgesAtVertex(restored.point);
      return true;
    }
    if (restored.kind === "ground") {
      this.buildGroundCells.set(this.buildCellKey(restored.point), restored.id);
      this.refreshBuildSurface(restored.point);
      return true;
    }
    if (restored.kind === "carpet") {
      this.buildCarpetCells.set(this.buildCellKey(restored.point), restored.id);
      this.refreshBuildCarpet(restored.point);
      return true;
    }
    if (restored.kind === "floor") {
      const sprite = this.add.image(
        restored.point.x,
        restored.point.y,
        restored.item.textureKey,
        restored.item.frame,
      ).setOrigin(0).setDepth(20);
      restored.sprites = [sprite];
      this.buildFloorCells.set(this.buildCellKey(restored.point), restored.id);
      return true;
    }
    if (restored.kind === "tree") {
      for (let row = 0; row < 4; row += 1) {
        for (let column = 0; column < 3; column += 1) {
          restored.sprites.push(this.add.image(
            restored.point.x + column * TILE_SIZE,
            restored.point.y + row * TILE_SIZE,
            restored.item.textureKey,
            row * 9 + column,
          ).setOrigin(0).setDepth(500 + restored.point.y + 4 * TILE_SIZE));
        }
      }
      return true;
    }
    restored.sprites = [this.add.image(
      restored.point.x,
      restored.point.y,
      restored.item.textureKey,
      restored.item.frame,
    ).setOrigin(0).setDepth(1)];
    return true;
  }

  demolishBuildObject(point, onlyType = null) {
    const hitPoint = {
      x: Number(point.rawX ?? point.x),
      y: Number(point.rawY ?? point.y),
    };
    const facility = (!onlyType || onlyType === "facility")
      ? this.facilityRuntime?.getDefinitionAt?.(hitPoint)
      : null;
    if (facility && this.facilityRuntime?.remove?.(facility.id)) {
      this.interactionRuntime?.refresh?.();
      return {
        status: "removed",
        type: "facility",
        undo: () => this.facilityRuntime?.restore?.(facility),
      };
    }
    const bed = (!onlyType || onlyType === "bed")
      ? this.debrisRuntime?.getBedDefinitionAt?.(hitPoint)
      : null;
    if (bed && this.debrisRuntime?.removeBed?.(bed.id)) {
      this.interactionRuntime?.refresh?.();
      return {
        status: "removed",
        type: "bed",
        undo: () => this.debrisRuntime?.restoreBed?.(bed),
      };
    }
    const placed = [...this.buildPlacedObjects.values()]
      .reverse()
      .find((object) => (
        (!onlyType || onlyType === this.getBuildObjectDemolitionType(object))
        && this.isPointInWorldBounds(hitPoint, object.bounds)
      ));
    if (placed) {
      const removed = this.removeBuildPlacedObjectById(placed.id);
      return {
        status: "removed",
        type: this.getBuildObjectDemolitionType(placed),
        undo: () => this.restoreBuildPlacedObject(removed),
      };
    }
    const floorCell = this.buildCellKey({ x: point.x, y: point.y });
    const floor = this.floorSprites.get(floorCell);
    if ((!onlyType || onlyType === "floor") && floor) {
      floor.sprite.destroy();
      this.floorSprites.delete(floorCell);
      return {
        status: "removed",
        type: "floor",
        undo: () => {
          if (this.floorSprites.has(floorCell)) return;
          const sprite = this.addTile(floor.tile, HOUSE_TEXTURE_KEY, 20);
          this.floorSprites.set(floorCell, { sprite, tile: floor.tile });
        },
      };
    }
    const wall = [...this.wallSprites.values()]
      .reverse()
      .find(({ tile }) => this.isPointInWorldBounds(hitPoint, {
        left: tile.worldX,
        right: tile.worldX + TILE_SIZE,
        top: tile.worldY,
        bottom: tile.worldY + TILE_SIZE,
      }));
    if (onlyType && onlyType !== "wall") return { status: "empty" };
    if (!wall) return { status: "empty" };
    const edgeIds = new Set(wall.tile.edgeIds);
    const removedEntries = [];
    for (const [id, entry] of [...this.wallSprites]) {
      if (!entry.tile.edgeIds.some((edgeId) => edgeIds.has(edgeId))) continue;
      entry.sprite.destroy();
      for (const sprite of entry.extraSprites) sprite.destroy();
      this.wallSprites.delete(id);
      removedEntries.push({ id, tile: entry.tile });
      for (const edgeId of entry.tile.edgeIds) edgeIds.add(edgeId);
    }
    const removedPoints = this.worldLayout.wallEdges
      .filter((edge) => edgeIds.has(edge.id))
      .map((edge) => ({
        x: edge.x,
        y: edge.y,
        orientation: edge.side === "top" || edge.side === "bottom" ? "horizontal" : "vertical",
        edgeId: edge.id,
      }));
    for (const removedPoint of removedPoints) {
      this.buildWallEdges.delete(this.buildWallEdgeKey(removedPoint));
    }
    this.worldLayout.removeWallEdges([...edgeIds]);
    for (const removedPoint of removedPoints) {
      this.refreshBuildWallJunctions(removedPoint);
      for (const vertex of this.getBuildWallVertices(removedPoint)) {
        this.refreshBuildWallEdgesAtVertex(vertex);
      }
    }
    return {
      status: "removed",
      type: "wall",
      undo: () => {
        this.worldLayout.restoreWallEdges([...edgeIds]);
        for (const { id, tile } of removedEntries) {
          if (!this.wallSprites.has(id)) this.wallSprites.set(id, this.createCanonicalWallEntry(tile));
        }
        for (const removedPoint of removedPoints) {
          this.buildWallEdges.set(this.buildWallEdgeKey(removedPoint), removedPoint.edgeId);
          this.refreshBuildWallJunctions(removedPoint);
        }
      },
    };
  }

  getBuildObjectDemolitionType(object) {
    if (object.kind === "wall-node") return "wall";
    if (["wall", "ground", "floor", "carpet"].includes(object.kind)) return object.kind;
    if (object.kind === "tree") return "tree";
    return "placed";
  }

  isPointInWorldBounds(point, bounds) {
    return point.x >= bounds.left
      && point.x < bounds.right
      && point.y >= bounds.top
      && point.y < bounds.bottom;
  }

  updateFullscreenHud() {
    this.gameHud?.render();
  }

  isHudPoint(x, y) {
    return Boolean(this.gameHud?.isPointInHud(x, y))
      || Boolean(this.interactionHud?.isPointInHud(x, y))
      || Boolean(this.cookingRuntime?.isPointInHud?.(x, y));
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
        const facility = this.facilityRuntime?.getDefinition?.(entityId);
        const bed = this.debrisRuntime?.getBedDefinition?.(entityId);
        const sign = entityId === TAVERN_SIGN.id ? { position: TAVERN_SIGN.interactionPosition } : null;
        const target = resource ? { position: resource.position } : bed ? { position: bed.position } : facility ? { position: facility.position } : sign ?? this.characterSystem.getSnapshot(entityId);
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
      getBuildModeState: () => this.buildMode?.getState?.() ?? null,
      toggleBuildMode: () => this.buildMode?.toggle?.(),
      getHudState: () => ({ newGameConfirming: this.gameHud?.isConfirming?.() ?? false, resources: this.gameHud?.getResourceState?.(), ...this.gameHud?.getLayoutState?.() }),
      isHudPoint: ({ x, y }) => this.isHudPoint(x, y),
      getAudioSettings: () => this.audioSettings?.getSettings(),
      setAudioChannel: ({ channel, value }) => this.audioSettings?.setChannel?.(channel, value),
      getAudioEffectState: () => ({ lastEffectType: this.audioRuntime?.lastEffectType ?? null, playCount: this.audioRuntime?.effectPlayCount ?? 0 }),
      interact: () => { this.frameActions = Object.freeze({ interact: true, primary: false, secondary: false }); this.interactionRuntime?.update({ actions: this.frameActions }); },
      expireHitCooldown: () => { this.lastSuccessfulHitAtMs = Number.NEGATIVE_INFINITY; },
      getDebrisState: () => ({ present: this.debrisRuntime?.isPresent?.() ?? false, definition: RESOURCE_OBJECTS.find((item) => item.id === DEFAULT_RESOURCE_ID), definitions: RESOURCE_OBJECTS, bed: this.debrisRuntime?.getBedDefinition?.() ?? null, beds: this.debrisRuntime?.getBedDefinitions?.() ?? [], wakeTile: BED_WAKE_TILE }),
      getFacilityState: () => ({ definitions: this.facilityRuntime?.getDefinitions?.() ?? FACILITIES, activeId: this.facilityRuntime?.getActiveId?.() ?? null }),
      getCookingState: () => this.cookingRuntime?.getState?.() ?? null,
      getTavernState: () => ({ open: this.sessionState.gameplay.tavernOpen, sign: this.tavernSignRuntime?.getState?.(), guest: this.guestRuntime?.getState?.() }),
      getCoinState: () => this.coinRuntime?.getState?.() ?? [],
      forceGuestSpawn: () => this.guestRuntime?.forceSpawn?.(),
      setServingDish: (present) => { this.sessionState.gameplay.kitchen.servingTableHasDish = Boolean(present); this.facilityRuntime?.syncKitchenVisuals?.(); },
      attemptCooking: () => this.cookingRuntime?.attempt?.(),
      completeCooking: () => this.cookingRuntime?.completeForTest?.(),
      alignCookingMarker: () => this.cookingRuntime?.alignMarkerForTest?.(),
      newGame: () => this.startNewGame(),
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
      getRuntimeState: () => ({ sleeping: this.sleeping, exhaustedSleeping: this.exhaustedSleeping, cookingActive: this.cookingRuntime?.isActive?.() ?? false, timeScale: this.simulationScale }),
      setWorldTimeSeconds: (value) => { this.sessionState.gameplay.worldTimeSeconds = Math.max(0, Number(value) || 0); this.updateDayNightLighting(); this.gameHud?.render(); },
      getClockText: () => formatClock(this.sessionState.gameplay.worldTimeSeconds, this.localization.getLanguage()),
      getDayNightState: () => ({ color: dayNightMultiplyColor(this.sessionState.gameplay.worldTimeSeconds), worldTimeSeconds: this.sessionState.gameplay.worldTimeSeconds }),
      getResourceState: () => JSON.parse(JSON.stringify(this.sessionState.gameplay)),
      getResourceNodeState: (id) => JSON.parse(JSON.stringify(this.sessionState.gameplay.resourceNodes[id])),
      getResourceVisualState: (id) => this.debrisRuntime?.getVisualState?.(id) ?? null,
      getResourceCollider: (id) => this.worldLayout?.getResourceCollider?.(id) ?? null,
      getCharacterSnapshot: (id) => this.characterSystem.has(id) ? this.characterSystem.getSnapshot(id) : null,
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
    this.buildMode?.destroy();
    this.buildMode = null;
    for (const object of this.buildPlacedObjects?.values?.() ?? []) {
      for (const sprite of object.sprites) sprite.destroy();
      if (object.collider) this.worldLayout?.clearWorldObjectCollider?.(object.id);
    }
    this.buildPlacedObjects?.clear?.();
    for (const sprite of this.buildSurfaceVisuals?.values?.() ?? []) sprite.destroy();
    this.buildSurfaceVisuals?.clear?.();
    for (const sprites of this.buildWallJunctions?.values?.() ?? []) for (const sprite of sprites) sprite.destroy();
    this.buildWallJunctions?.clear?.();
    this.cameraRuntime?.destroy();
    this.cameraRuntime = null;
    this.debrisRuntime?.destroy();
    this.debrisRuntime = null;
    this.facilityRuntime?.destroy();
    this.facilityRuntime = null;
    this.guestRuntime?.destroy();
    this.guestRuntime = null;
    this.coinRuntime?.destroy();
    this.coinRuntime = null;
    this.tavernSignRuntime?.destroy();
    this.tavernSignRuntime = null;
    this.cookingRuntime?.destroy();
    this.cookingRuntime = null;
    this.interactionRuntime?.destroy();
    this.interactionRuntime = null;
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

  startSleeping({ exhausted = false, bedId = null } = {}) {
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
      const bed = this.debrisRuntime?.getBedDefinition?.(bedId) ?? BED_OBJECT;
      this.sleepingBedId = bed.id;
      player.motor.movement = createMovementState({ facing: { x: -1, y: 0 } });
      player.visual.setPresentationPose({ x: bed.position.x, y: bed.position.y - 1, facing: "right", angle: -90, showSleepMarker: true });
    }
    this.debrisRuntime?.setSleeping(true, this.sleepingBedId);
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
    this.sleepingBedId = null;
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
    this.cookingRuntime?.update?.(realDeltaMs);
    let worldDeltaMs = realDeltaMs * (this.simulationScale ?? 1);
    this.setNpcAnimationTimeScale(this.simulationScale ?? 1);
    while (worldDeltaMs > 0) {
      const substepMs = Math.min(50, worldDeltaMs);
      this.guestRuntime?.update(substepMs);
      this.characterSystem?.update(substepMs);
      this.coinRuntime?.update(substepMs);
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
    this.renderColliderDebug();
  }

  sampleFrameActions() {
    if (this.buildMode?.isActive?.() || this.cookingRuntime?.isActive?.()) {
      this.isRunning = false;
      this.frameActions = Object.freeze({ interact: false, primary: false, secondary: false });
      return;
    }
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
    if (isPlayerMovementSuppressed({
      sleeping: this.sleeping,
      facilityActive: this.facilityRuntime?.isUsing(),
      dialogueActive: this.interactionRuntime?.isDialogueActive(),
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
  return migrated;
}

function drawPixelThumb(graphics) {
  const pattern = ["0011000", "0011000", "0011111", "1111111", "1111111", "0111110", "0011100"];
  const pixels = new Set();
  pattern.forEach((row, y) => [...row].forEach((value, x) => { if (value === "1") pixels.add(`${x},${y}`); }));
  graphics.fillStyle(0x100b0e, 0.72);
  for (const key of pixels) {
    const [x, y] = key.split(",").map(Number);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      if (!pixels.has(`${x + dx},${y + dy}`)) graphics.fillRect(x + dx, y + dy, 1, 1);
    }
  }
  graphics.fillStyle(0xf7e7a1, 1);
  for (const key of pixels) {
    const [x, y] = key.split(",").map(Number);
    graphics.fillRect(x, y, 1, 1);
  }
}
