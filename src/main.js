import Phaser from "phaser";
import "./style.css";
import { clampVectorLength } from "./input.js";
import { isFullscreenActive, isFullscreenSupported, toggleFullscreen } from "./fullscreen.js";
import {
  BUILD_LABEL,
  FULLSCREEN_HIT_AREA,
  compactBuildLabel,
  drawBitmapText,
  drawFullscreenIcon,
  isPointInRect,
  measureBitmapText,
  renderFullscreenIcon,
} from "./hud.js";
import { createRuntimeMovementConfig } from "./characterMovement.js";
import { createCharacter, createNpcMovementConfig } from "./character.js";
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
import {
  PLAYER_FRAMES,
  WALK_FRAME_RATE,
} from "./visualConfig.js";
import { createMobileJoystick } from "./mobileJoystick.js";
import { MovementDebugPanel, loadMovementDebugConfig } from "./movementDebugPanel.js";

const BUILD_ID = import.meta.env.VITE_BUILD_ID ?? "dev";
const PLAYER_ASSET_URL = `${import.meta.env.BASE_URL}assets/third-party/kenney/player`;
const VILLAGE_ASSET_URL = `${import.meta.env.BASE_URL}${BASIC_VILLAGE_ASSET_PATH}`;

class WorldScene extends Phaser.Scene {
  constructor() {
    super("world");
  }

  preload() {
    Object.values(PLAYER_FRAMES)
      .flat()
      .forEach((frame) => this.load.image(frame, `${PLAYER_ASSET_URL}/${frame}.png`));

    const sheet = { frameWidth: TILE_SIZE, frameHeight: TILE_SIZE };
    this.load.spritesheet(OUTDOOR_TEXTURE_KEY, `${VILLAGE_ASSET_URL}/${OUTDOOR_IMAGE_PATH}`, sheet);
    this.load.spritesheet(HOUSE_TEXTURE_KEY, `${VILLAGE_ASSET_URL}/${HOUSE_IMAGE_PATH}`, sheet);
    this.load.spritesheet(TREES_TEXTURE_KEY, `${VILLAGE_ASSET_URL}/${TREES_IMAGE_PATH}`, sheet);
  }

  create() {
    this.movementDebugEnabled =
      new URLSearchParams(window.location.search).get("movementDebug") === "1";
    this.worldLayout = createWorldLayout();
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.renderWorld();
    this.createCharacterAnimations();
    this.createInput();
    this.createCharacters();
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
    Object.entries(PLAYER_FRAMES).forEach(([facing, frames]) => {
      this.anims.create({
        key: `character-walk-${facing}`,
        frames: frames.map((key) => ({ key })),
        frameRate: WALK_FRAME_RATE,
        repeat: -1,
      });
    });
  }

  createCharacters() {
    const debugOverrides = loadMovementDebugConfig({ enabled: this.movementDebugEnabled });
    this.movementConfig = createRuntimeMovementConfig(debugOverrides);
    this.npcMovementConfig = createNpcMovementConfig(this.movementConfig);
    this.playerCharacter = createCharacter(this, {
      id: "player",
      spawn: this.worldLayout.spawn,
      controller: createPlayerController({ getInputDirection: () => this.getMovementVector() }),
      movementConfig: this.movementConfig,
    });
    this.player = this.playerCharacter.sprite;
    this.characters = [
      this.playerCharacter,
      ...NPCS.map((npc) =>
        createCharacter(this, {
          id: npc.id,
          spawn: npc.spawn,
          controller: createPatrolController(npc.patrol),
          movementConfig: this.npcMovementConfig,
        }),
      ),
    ];
    this.cameras.main.startFollow(this.player, true, 1, 1);
  }

  syncNpcMovementConfig() {
    if (!this.npcMovementConfig) return;
    Object.assign(this.npcMovementConfig, createNpcMovementConfig(this.movementConfig));
  }

  createInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys("W,A,S,D");
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
    const label = compactBuildLabel(BUILD_ID);
    const labelWidth = measureBitmapText(label);
    drawBitmapText(this, BUILD_LABEL.x - labelWidth, BUILD_LABEL.y, label);

    if (!isFullscreenSupported(this.gameContainer)) return;

    this.fullscreenHud = drawFullscreenIcon(
      this,
      isFullscreenActive(document, this.gameContainer),
    );
    this.fullscreenHud.hit.on("pointerdown", (pointer, _localX, _localY, event) => {
      event?.stopPropagation?.();
      pointer.event?.stopPropagation?.();
      void toggleFullscreen({ documentRef: document, element: this.gameContainer }).then(() => {
        this.updateFullscreenHud();
        this.syncIntegerZoom();
      });
    });
  }

  updateFullscreenHud() {
    if (!this.fullscreenHud) return;
    renderFullscreenIcon(
      this.fullscreenHud.graphics,
      isFullscreenActive(document, this.gameContainer),
    );
  }

  isHudPoint(x, y) {
    return isPointInRect(x, y, FULLSCREEN_HIT_AREA);
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
    this.movementDebugPanel?.destroy();
    this.movementDebugPanel = null;
    this.fullscreenHud?.hit.destroy();
    this.fullscreenHud?.graphics.destroy();
    this.fullscreenHud = null;
  }

  update(_time, delta) {
    this.characters.forEach((character) => character.update(delta, this.worldLayout));
    this.updateMovementDebugStatus();
  }

  getMovementVector() {
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
