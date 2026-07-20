import Phaser from "phaser";
import "./style.css";
import {
  JOYSTICK,
  clampVectorLength,
  getJoystickState,
  isInsideJoystickActivation,
  isTouchJoystickSupported,
} from "./input.js";
import { moveWithCollision } from "./movement.js";
import {
  BASIC_VILLAGE_ASSET_PATH,
  GAME_HEIGHT,
  GAME_WIDTH,
  HOUSE_IMAGE_PATH,
  HOUSE_TEXTURE_KEY,
  OUTDOOR_IMAGE_PATH,
  OUTDOOR_TEXTURE_KEY,
  PLAYER_SPEED,
  TILE_SIZE,
  TREES_IMAGE_PATH,
  TREES_TEXTURE_KEY,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./worldConfig.js";
import { createWorldLayout } from "./worldLayout.js";
import {
  FACING_HYSTERESIS,
  PLAYER_FOOT_DEPTH,
  PLAYER_FOOT_WIDTH,
  PLAYER_FRAMES,
  PLAYER_IDLE_FRAME_INDEX,
  WALK_FRAME_RATE,
} from "./visualConfig.js";

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
    this.worldLayout = createWorldLayout();
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.renderWorld();
    this.createPlayerAnimations();
    this.createPlayer();
    this.createInput();
    this.createBuildLabel();
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

  createPlayerAnimations() {
    Object.entries(PLAYER_FRAMES).forEach(([facing, frames]) => {
      this.anims.create({
        key: `walk-${facing}`,
        frames: frames.map((key) => ({ key })),
        frameRate: WALK_FRAME_RATE,
        repeat: -1,
      });
    });
  }

  createPlayer() {
    this.lastFacing = "down";
    const spawn = this.worldLayout.spawn;
    this.player = this.add
      .sprite(spawn.x, spawn.y, PLAYER_FRAMES.down[PLAYER_IDLE_FRAME_INDEX])
      .setOrigin(0.5, 1);
    this.updatePlayerDepth();
    this.cameras.main.startFollow(this.player, true, 1, 1);
  }

  createInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys("W,A,S,D");
  }

  createBuildLabel() {
    this.add
      .text(GAME_WIDTH - 4, 4, `build: ${BUILD_ID}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "7px",
        color: "#f2eadc",
      })
      .setOrigin(1, 0)
      .setAlpha(0.7)
      .setDepth(10000)
      .setScrollFactor(0);
  }

  attachSceneListeners() {
    this.onWindowBlur = () => this.resetJoystick();
    this.onVisibilityChange = () => {
      if (document.hidden) this.resetJoystick();
    };
    this.onNativePointerCancel = (event) => this.handleNativePointerEnd(event);
    this.onNativeLostPointerCapture = (event) => this.handleNativePointerEnd(event);
    this.onNativeTouchCancel = (event) => this.handleNativeTouchCancel(event);

    window.addEventListener("blur", this.onWindowBlur);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
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
    this.activeJoystickPointerId = null;
    this.activeDomPointerId = null;
    this.activeTouchIdentifier = null;
    this.joystickVector = { x: 0, y: 0 };

    const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    if (!isTouchJoystickSupported({ maxTouchPoints: navigator.maxTouchPoints, coarsePointer })) {
      return;
    }

    this.joystickBase = this.add
      .circle(JOYSTICK.centerX, JOYSTICK.centerY, JOYSTICK.baseRadius, 0xd9c18f, 0.22)
      .setStrokeStyle(1, 0xf2eadc, 0.32)
      .setDepth(9000)
      .setScrollFactor(0);
    this.joystickKnob = this.add
      .circle(JOYSTICK.centerX, JOYSTICK.centerY, JOYSTICK.knobRadius, 0xf2eadc, 0.55)
      .setStrokeStyle(1, 0xffffff, 0.65)
      .setDepth(9001)
      .setScrollFactor(0);

    this.input.on("pointerdown", this.handleJoystickPointerDown, this);
    this.input.on("pointermove", this.handleJoystickPointerMove, this);
    this.input.on("pointerup", this.handleJoystickPointerUp, this);
    this.input.on("pointerupoutside", this.handleJoystickPointerUp, this);
    this.input.on("gameout", this.resetJoystick, this);

    const canvas = this.game.canvas;
    canvas.addEventListener("pointercancel", this.onNativePointerCancel);
    canvas.addEventListener("lostpointercapture", this.onNativeLostPointerCapture);
    canvas.addEventListener("touchcancel", this.onNativeTouchCancel, { passive: true });
  }

  handleJoystickPointerDown(pointer) {
    if (this.activeJoystickPointerId !== null || !isInsideJoystickActivation(pointer.x, pointer.y)) {
      return;
    }
    this.activeJoystickPointerId = pointer.id;
    this.activeDomPointerId =
      typeof pointer.event?.pointerId === "number" ? pointer.event.pointerId : null;
    this.activeTouchIdentifier = pointer.wasTouch ? pointer.identifier : null;
    this.updateJoystick(pointer);
  }

  handleJoystickPointerMove(pointer) {
    if (pointer.id === this.activeJoystickPointerId) this.updateJoystick(pointer);
  }

  handleJoystickPointerUp(pointer) {
    if (pointer.id === this.activeJoystickPointerId) this.resetJoystick();
  }

  handleNativePointerEnd(event) {
    if (
      this.activeJoystickPointerId !== null &&
      this.activeDomPointerId !== null &&
      event.pointerId === this.activeDomPointerId
    ) {
      this.resetJoystick();
    }
  }

  handleNativeTouchCancel(event) {
    if (this.activeJoystickPointerId === null || this.activeTouchIdentifier === null) return;
    const canceled = Array.from(event.changedTouches ?? []).some(
      (touch) => touch.identifier === this.activeTouchIdentifier,
    );
    if (canceled) this.resetJoystick();
  }

  updateJoystick(pointer) {
    const state = getJoystickState(pointer.x, pointer.y);
    this.joystickVector = { x: state.movementX, y: state.movementY };
    this.joystickKnob?.setPosition(state.knobX, state.knobY);
  }

  resetJoystick() {
    this.activeJoystickPointerId = null;
    this.activeDomPointerId = null;
    this.activeTouchIdentifier = null;
    this.joystickVector = { x: 0, y: 0 };
    this.joystickKnob?.setPosition(JOYSTICK.centerX, JOYSTICK.centerY);
  }

  destroySceneListeners() {
    if (!this.sceneListenersAttached) return;
    this.sceneListenersAttached = false;
    window.removeEventListener("blur", this.onWindowBlur);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.syncIntegerZoom, this);
    this.input.off("pointerdown", this.handleJoystickPointerDown, this);
    this.input.off("pointermove", this.handleJoystickPointerMove, this);
    this.input.off("pointerup", this.handleJoystickPointerUp, this);
    this.input.off("pointerupoutside", this.handleJoystickPointerUp, this);
    this.input.off("gameout", this.resetJoystick, this);
    const canvas = this.game.canvas;
    canvas.removeEventListener("pointercancel", this.onNativePointerCancel);
    canvas.removeEventListener("lostpointercapture", this.onNativeLostPointerCapture);
    canvas.removeEventListener("touchcancel", this.onNativeTouchCancel);
    this.resetJoystick();
  }

  update(_time, delta) {
    const direction = clampVectorLength(this.getMovementVector());
    this.updateLastFacing(direction);
    this.updatePlayerAnimation(direction);

    const next = moveWithCollision(
      { x: this.player.x, y: this.player.y },
      {
        x: direction.x * PLAYER_SPEED * (delta / 1000),
        y: direction.y * PLAYER_SPEED * (delta / 1000),
      },
      this.worldLayout,
      PLAYER_FOOT_WIDTH,
      PLAYER_FOOT_DEPTH,
    );

    this.player.setPosition(next.x, next.y);
    this.updatePlayerDepth();
  }

  updatePlayerDepth() {
    this.player.setDepth(500 + Math.round(this.player.y));
  }

  getMovementVector() {
    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;
    const joystick = this.joystickVector ?? { x: 0, y: 0 };
    return {
      x: Number(right) - Number(left) + joystick.x,
      y: Number(down) - Number(up) + joystick.y,
    };
  }

  updateLastFacing(direction) {
    const absX = Math.abs(direction.x);
    const absY = Math.abs(direction.y);
    if ((absX === 0 && absY === 0) || Math.abs(absX - absY) <= FACING_HYSTERESIS) return;
    this.lastFacing =
      absX > absY
        ? direction.x > 0
          ? "right"
          : "left"
        : direction.y > 0
          ? "down"
          : "up";
  }

  updatePlayerAnimation(direction) {
    const moving = direction.x !== 0 || direction.y !== 0;
    if (!moving) {
      this.player.anims.stop();
      const idleFrame = PLAYER_FRAMES[this.lastFacing][PLAYER_IDLE_FRAME_INDEX];
      if (this.player.texture.key !== idleFrame) this.player.setTexture(idleFrame);
      return;
    }
    const key = `walk-${this.lastFacing}`;
    if (!this.player.anims.isPlaying || this.player.anims.currentAnim?.key !== key) {
      this.player.anims.play(key);
    }
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
