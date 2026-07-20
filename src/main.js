import Phaser from "phaser";
import "./style.css";
import {
  JOYSTICK,
  clampVectorLength,
  getJoystickState,
  isInsideJoystickActivation,
  isTouchJoystickSupported,
} from "./input.js";
import { buildRoomLayout, ROOM_WALL_BANDS } from "./roomLayout.js";
import {
  FACING_HYSTERESIS,
  PLAYER_FOOT_DEPTH,
  PLAYER_FOOT_WIDTH,
  PLAYER_FRAMES,
  PLAYER_IDLE_FRAME_INDEX,
  PLAYER_SCALE,
  ROOM_ATLAS_PATH,
  ROOM_IMAGE_PATH,
  ROOM_SCALE,
  ROOM_TEXTURE_KEY,
  TILE_SIZE,
  WALK_FRAME_RATE,
} from "./visualConfig.js";

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const PLAYER_SPEED = 260;
const BUILD_ID = import.meta.env.VITE_BUILD_ID ?? "dev";
const ASSET_BASE_URL = `${import.meta.env.BASE_URL}assets/third-party/kenney`;

const ROOM_TILE_SIZE = TILE_SIZE * ROOM_SCALE;
const ROOM_COLUMNS = Math.floor(GAME_WIDTH / ROOM_TILE_SIZE);
const ROOM_ROWS = Math.floor(GAME_HEIGHT / ROOM_TILE_SIZE);
const ROOM_OFFSET_X = Math.floor((GAME_WIDTH - ROOM_COLUMNS * ROOM_TILE_SIZE) / 2);
const ROOM_OFFSET_Y = Math.floor((GAME_HEIGHT - ROOM_ROWS * ROOM_TILE_SIZE) / 2);

class RoomScene extends Phaser.Scene {
  constructor() {
    super("room");
  }

  preload() {
    Object.values(PLAYER_FRAMES)
      .flat()
      .forEach((frame) => {
        this.load.image(frame, `${ASSET_BASE_URL}/player/${frame}.png`);
      });

    this.load.atlas(
      ROOM_TEXTURE_KEY,
      `${ASSET_BASE_URL}/${ROOM_IMAGE_PATH}`,
      `${ASSET_BASE_URL}/${ROOM_ATLAS_PATH}`,
    );
  }

  create() {
    this.createRoom();
    this.createPlayerAnimations();
    this.createPlayer();
    this.createInput();
    this.createBuildLabel();
    this.attachSceneListeners();
    this.createJoystick();
  }

  createRoom() {
    const wallBandCount = ROOM_WALL_BANDS.length;
    const interiorLeft = ROOM_OFFSET_X + ROOM_TILE_SIZE;
    const interiorTop = ROOM_OFFSET_Y + wallBandCount * ROOM_TILE_SIZE;
    const interiorWidth = (ROOM_COLUMNS - 2) * ROOM_TILE_SIZE;
    const interiorHeight = (ROOM_ROWS - wallBandCount * 2) * ROOM_TILE_SIZE;

    this.roomBounds = new Phaser.Geom.Rectangle(
      interiorLeft,
      interiorTop,
      interiorWidth,
      interiorHeight,
    );

    const layout = buildRoomLayout(ROOM_COLUMNS, ROOM_ROWS);
    layout.forEach((row, tileY) => {
      row.forEach((frame, tileX) => {
        if (frame !== null) {
          this.addRoomTile(tileX, tileY, frame, frame === "floor" ? 0 : 10);
        }
      });
    });
  }

  addRoomTile(tileX, tileY, frame, depth) {
    return this.add
      .image(
        ROOM_OFFSET_X + tileX * ROOM_TILE_SIZE,
        ROOM_OFFSET_Y + tileY * ROOM_TILE_SIZE,
        ROOM_TEXTURE_KEY,
        frame,
      )
      .setOrigin(0, 0)
      .setScale(ROOM_SCALE)
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
    this.player = this.add
      .sprite(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        PLAYER_FRAMES.down[PLAYER_IDLE_FRAME_INDEX],
      )
      .setOrigin(0.5, 1)
      .setScale(PLAYER_SCALE)
      .setDepth(100);
  }

  createInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys("W,A,S,D");
  }

  createBuildLabel() {
    this.add
      .text(GAME_WIDTH - 12, 12, `build: ${BUILD_ID}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: "#f2eadc",
      })
      .setOrigin(1, 0)
      .setAlpha(0.55)
      .setDepth(1000);
  }

  attachSceneListeners() {
    this.onWindowBlur = () => this.resetJoystick();
    this.onVisibilityChange = () => {
      if (document.hidden) {
        this.resetJoystick();
      }
    };
    this.onNativePointerCancel = (event) => this.handleNativePointerEnd(event);
    this.onNativeLostPointerCapture = (event) => this.handleNativePointerEnd(event);
    this.onNativeTouchCancel = (event) => this.handleNativeTouchCancel(event);

    window.addEventListener("blur", this.onWindowBlur);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.sceneListenersAttached = true;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroySceneListeners, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.destroySceneListeners, this);
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
      .setStrokeStyle(3, 0xf2eadc, 0.32)
      .setDepth(900);
    this.joystickKnob = this.add
      .circle(JOYSTICK.centerX, JOYSTICK.centerY, JOYSTICK.knobRadius, 0xf2eadc, 0.55)
      .setStrokeStyle(2, 0xffffff, 0.65)
      .setDepth(901);

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
    if (this.activeJoystickPointerId !== null) {
      return;
    }

    if (!isInsideJoystickActivation(pointer.x, pointer.y)) {
      return;
    }

    this.activeJoystickPointerId = pointer.id;
    this.activeDomPointerId =
      typeof pointer.event?.pointerId === "number" ? pointer.event.pointerId : null;
    this.activeTouchIdentifier = pointer.wasTouch ? pointer.identifier : null;
    this.updateJoystick(pointer);
  }

  handleJoystickPointerMove(pointer) {
    if (pointer.id !== this.activeJoystickPointerId) {
      return;
    }

    this.updateJoystick(pointer);
  }

  handleJoystickPointerUp(pointer) {
    if (pointer.id === this.activeJoystickPointerId) {
      this.resetJoystick();
    }
  }

  handleNativePointerEnd(event) {
    if (this.activeJoystickPointerId === null || this.activeDomPointerId === null) {
      return;
    }

    if (event.pointerId === this.activeDomPointerId) {
      this.resetJoystick();
    }
  }

  handleNativeTouchCancel(event) {
    if (this.activeJoystickPointerId === null || this.activeTouchIdentifier === null) {
      return;
    }

    const activeTouchWasCanceled = Array.from(event.changedTouches ?? []).some(
      (touch) => touch.identifier === this.activeTouchIdentifier,
    );

    if (activeTouchWasCanceled) {
      this.resetJoystick();
    }
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
    if (!this.sceneListenersAttached) {
      return;
    }

    this.sceneListenersAttached = false;
    window.removeEventListener("blur", this.onWindowBlur);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
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
    const movement = this.getMovementVector();
    const limitedDirection = clampVectorLength(movement);
    this.updateLastFacing(limitedDirection);
    this.updatePlayerAnimation(limitedDirection);

    if (limitedDirection.x === 0 && limitedDirection.y === 0) {
      return;
    }

    const step = new Phaser.Math.Vector2(limitedDirection.x, limitedDirection.y).scale(
      PLAYER_SPEED * (delta / 1000),
    );

    this.player.x = Phaser.Math.Clamp(
      this.player.x + step.x,
      this.roomBounds.left + PLAYER_FOOT_WIDTH / 2,
      this.roomBounds.right - PLAYER_FOOT_WIDTH / 2,
    );
    this.player.y = Phaser.Math.Clamp(
      this.player.y + step.y,
      this.roomBounds.top + PLAYER_FOOT_DEPTH,
      this.roomBounds.bottom,
    );
  }

  getMovementVector() {
    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;

    const joystickVector = this.joystickVector ?? { x: 0, y: 0 };
    return {
      x: Number(right) - Number(left) + joystickVector.x,
      y: Number(down) - Number(up) + joystickVector.y,
    };
  }

  updateLastFacing(direction) {
    const absX = Math.abs(direction.x);
    const absY = Math.abs(direction.y);

    if (absX === 0 && absY === 0) {
      return;
    }

    if (Math.abs(absX - absY) <= FACING_HYSTERESIS) {
      return;
    }

    if (absX > absY) {
      this.lastFacing = direction.x > 0 ? "right" : "left";
      return;
    }

    this.lastFacing = direction.y > 0 ? "down" : "up";
  }

  updatePlayerAnimation(direction) {
    const moving = direction.x !== 0 || direction.y !== 0;

    if (!moving) {
      this.player.anims.stop();
      const idleFrame = PLAYER_FRAMES[this.lastFacing][PLAYER_IDLE_FRAME_INDEX];
      if (this.player.texture.key !== idleFrame) {
        this.player.setTexture(idleFrame);
      }
      return;
    }

    const animationKey = `walk-${this.lastFacing}`;
    if (this.player.anims.isPlaying && this.player.anims.currentAnim?.key === animationKey) {
      return;
    }

    this.player.anims.play(animationKey);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#201b18",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  scene: RoomScene,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
