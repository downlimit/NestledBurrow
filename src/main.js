import Phaser from "phaser";
import "./style.css";
import { clampVectorLength } from "./input.js";
import { createRuntimeMovementConfig } from "./characterMovement.js";
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
import { createGameSessionState } from "./gameSessionState.js";
import { getDialogueDefinition } from "./dialogueConfig.js";
import { INTERACTION_DEFINITIONS } from "./interactionConfig.js";
import { createInteractionRuntime } from "./interactionRuntime.js";
import { createInteractionHud } from "./interactionHud.js";
import { createGameHud } from "./gameHud.js";
import { createLocalization } from "./localization/index.js";
import { RUBIK_FONT_KEY, RUBIK_FONT_PATH } from "./localization/font.js";
import { createMobileJoystick } from "./mobileJoystick.js";
import { MovementDebugPanel, loadMovementDebugConfig } from "./movementDebugPanel.js";
import { PLAYER_WALK_FRAME_SEQUENCE } from "./visualConfig.js";

const BUILD_ID = import.meta.env.VITE_BUILD_ID ?? "dev";
const PLAYER_ASSET_URL = `${import.meta.env.BASE_URL}assets/third-party/kenney/player`;
const VILLAGE_ASSET_URL = `${import.meta.env.BASE_URL}${BASIC_VILLAGE_ASSET_PATH}`;
const FONT_ASSET_URL = `${import.meta.env.BASE_URL}${RUBIK_FONT_PATH}`;

class WorldScene extends Phaser.Scene {
  constructor() {
    super("world");
    this.localization = window.__NESTLED_BURROW_LOCALIZATION__;
  }

  preload() {
    this.load.font(RUBIK_FONT_KEY, FONT_ASSET_URL, "truetype");
    const playerTextureKeys = new Set(
      Object.values(getActorProfile(ACTOR_PROFILE_IDS.player).visual.frames).flat(),
    );
    playerTextureKeys.forEach((frame) => this.load.image(frame, `${PLAYER_ASSET_URL}/${frame}.png`));

    const sheet = { frameWidth: TILE_SIZE, frameHeight: TILE_SIZE };
    this.load.spritesheet(OUTDOOR_TEXTURE_KEY, `${VILLAGE_ASSET_URL}/${OUTDOOR_IMAGE_PATH}`, sheet);
    this.load.spritesheet(HOUSE_TEXTURE_KEY, `${VILLAGE_ASSET_URL}/${HOUSE_IMAGE_PATH}`, sheet);
    this.load.spritesheet(TREES_TEXTURE_KEY, `${VILLAGE_ASSET_URL}/${TREES_IMAGE_PATH}`, sheet);
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
    this.createSessionAndInteractionRuntime();
    this.createMovementDebugPanel();
    this.createHud();
    this.attachSceneListeners();
    this.createJoystick();
    this.syncIntegerZoom();
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
    const uniqueVisualProfiles = new Set(
      Object.values(ACTOR_PROFILE_IDS).map((id) => getActorProfile(id).visual),
    );
    for (const visual of uniqueVisualProfiles) {
      Object.entries(visual.frames).forEach(([facing, frames]) => {
        const key = `${visual.animationPrefix}-walk-${facing}`;
        if (this.anims.exists(key)) return;
        this.anims.create({
          key,
          frames: PLAYER_WALK_FRAME_SEQUENCE.map((frameIndex) => ({
            key: frames[frameIndex],
          })),
          frameRate: visual.walkFrameRate,
          repeat: -1,
        });
      });
    }
  }

  createCharacters() {
    const playerProfile = getActorProfile(ACTOR_PROFILE_IDS.player);
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
    });
    this.characterSystem.add(this.playerCharacter);
    for (const npc of NPCS) {
      const actorProfile = getActorProfile(npc.profileId);
      this.characterSystem.add(createCharacter(this, {
        id: npc.id,
        spawn: npc.spawn,
        controller: createPatrolController({
          ...npc.patrol,
          isPaused: () => this.interactionRuntime?.isEntityInActiveDialogue(npc.id) ?? false,
        }),
        movementConfig: this.createNpcRuntimeMovementConfig(actorProfile),
        actorProfile,
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
    this.interactKeys = this.input.keyboard.addKeys("E,SPACE");
    this.frameActions = Object.freeze({ interact: false, primary: false, secondary: false });
  }

  createSessionAndInteractionRuntime() {
    this.sessionState = createGameSessionState({
      currentWorldId: "village",
      playerId: "player",
      initialEntityIds: NPCS.map((npc) => npc.id),
    });
    this.interactionHud = createInteractionHud(this, {
      isCoarsePointer: () => this.isCoarsePointer(),
      localization: this.localization,
    });
    this.interactionRuntime = createInteractionRuntime({
      sessionState: this.sessionState,
      characterSystem: this.characterSystem,
      interactionDefinitions: INTERACTION_DEFINITIONS,
      getDialogueDefinition,
      presenter: this.interactionHud,
    });
  }

  createMovementDebugPanel() {
    this.movementDebugPanel = new MovementDebugPanel({
      enabled: this.movementDebugEnabled,
      movementConfig: this.movementConfig,
      onConfigChange: () => this.syncNpcMovementConfig(),
      getStatusSnapshot: () => {
        if (!this.playerCharacter) return null;
        return {
          speed: undefined,
          velocity: this.playerCharacter.movement.velocity,
          facing: this.playerCharacter.lastFacing,
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
      onLanguageChange: () => this.interactionRuntime?.refresh?.(),
    });
  }

  updateFullscreenHud() {
    this.gameHud?.render();
  }

  isHudPoint(x, y) {
    return Boolean(this.gameHud?.isPointInHud(x, y)) || Boolean(this.interactionHud?.isPointInHud(x, y));
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
  }

  update(_time, delta) {
    this.sampleFrameActions();
    this.characterSystem?.update(delta);
    this.interactionRuntime?.update({ actions: this.frameActions });
    this.updateMovementDebugStatus();
  }

  sampleFrameActions() {
    const keyboardPressed =
      Phaser.Input.Keyboard.JustDown(this.interactKeys.E) ||
      Phaser.Input.Keyboard.JustDown(this.interactKeys.SPACE);
    const mobilePressed = this.interactionHud?.consumeInteractPressed() ?? false;
    this.frameActions = Object.freeze({
      interact: keyboardPressed || mobilePressed,
      primary: false,
      secondary: false,
    });
  }

  getMovementVector() {
    if (this.interactionRuntime?.isDialogueActive()) return { x: 0, y: 0 };
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
