import Phaser from "phaser";
import "./style.css";
import {
  JOYSTICK,
  clampVectorLength,
  getJoystickState,
  isInsideJoystickActivation,
  isTouchJoystickSupported,
} from "./input.js";

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const PLAYER_SPEED = 260;
const BUILD_ID = import.meta.env.VITE_BUILD_ID ?? "dev";
const ASSET_BASE_URL = `${import.meta.env.BASE_URL}assets/third-party/kenney`;

const ART_SCALE = 3;
const TILE_SIZE = 16;
const ROOM_TILE_SIZE = TILE_SIZE * ART_SCALE;
const WALL_TILES = 1;
const ROOM_COLUMNS = Math.floor(GAME_WIDTH / ROOM_TILE_SIZE);
const ROOM_ROWS = Math.floor(GAME_HEIGHT / ROOM_TILE_SIZE);
const ROOM_OFFSET_X = Math.floor((GAME_WIDTH - ROOM_COLUMNS * ROOM_TILE_SIZE) / 2);
const ROOM_OFFSET_Y = Math.floor((GAME_HEIGHT - ROOM_ROWS * ROOM_TILE_SIZE) / 2);
const PLAYER_FOOT_WIDTH = 24;
const PLAYER_FOOT_DEPTH = 10;
const FACING_HYSTERESIS = 0.15;
const WALK_FRAME_RATE = 8;

const PLAYER_FRAMES = {
  down: ["tile_0267", "tile_0294", "tile_0321"],
  up: ["tile_0268", "tile_0295", "tile_0322"],
  left: ["tile_0269", "tile_0296", "tile_0323"],
  right: ["tile_0266", "tile_0293", "tile_0320"],
};

const ROOM_FRAMES = {
  floor: 494,
  top: 90,
  bottom: 147,
  left: 146,
  right: 148,
  topLeft: 89,
  topRight: 91,
  bottomLeft: 203,
  bottomRight: 205,
};

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

    this.load.spritesheet(
      "roomTiles",
      `${ASSET_BASE_URL}/room/roguelikeSheet_transparent.png`,
      {
        frameWidth: TILE_SIZE,
        frameHeight: TILE_SIZE,
        margin: 1,
        spacing: 1,
      },
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
    const interiorLeft = ROOM_OFFSET_X + WALL_TILES * ROOM_TILE_SIZE;
    const interiorTop = ROOM_OFFSET_Y + WALL_TILES * ROOM_TILE_SIZE;
    const interiorWidth = (ROOM_COLUMNS - WALL_TILES * 2) * ROOM_TILE_SIZE;
    const interiorHeight = (ROOM_ROWS - WALL_TILES * 2) * ROOM_TILE_SIZE;

    this.roomBounds = new Phaser.Geom.Rectangle(
      interiorLeft,
      interiorTop,
      interiorWidth,
      interiorHeight,
    );

    for (let y = WALL_TILES; y < ROOM_ROWS - WALL_TILES; y += 1) {
      for (let x = WALL_TILES; x < ROOM_COLUMNS - WALL_TILES; x += 1) {
        this.addRoomTile(x, y, ROOM_FRAMES.floor, 0);
      }
    }

    for (let x = WALL_TILES; x < ROOM_COLUMNS - WALL_TILES; x += 1) {
      this.addRoomTile(x, 0, ROOM_FRAMES.top, 10);
      this.addRoomTile(x, ROOM_ROWS - 1, ROOM_FRAMES.bottom, 10);
    }

    for (let y = WALL_TILES; y < ROOM_ROWS - WALL_TILES; y += 1) {
      this.addRoomTile(0, y, ROOM_FRAMES.left, 10);
      this.addRoomTile(ROOM_COLUMNS - 1, y, ROOM_FRAMES.right, 10);
    }

    this.addRoomTile(0, 0, ROOM_FRAMES.topLeft, 10);
    this.addRoomTile(ROOM_COLUMNS - 1, 0, ROOM_FRAMES.topRight, 10);
    this.addRoomTile(0, ROOM_ROWS - 1, ROOM_FRAMES.bottomLeft, 10);
    this.addRoomTile(ROOM_COLUMNS - 1, ROOM_ROWS - 1, ROOM_FRAMES.bottomRight, 10);
  }

  addRoomTile(tileX, tileY, frame, depth) {
    return this.add
      .image(
        ROOM_OFFSET_X + tileX * ROOM_TILE_SIZE,
        ROOM_OFFSET_Y + tileY * ROOM_TILE_SIZE,
        "roomTiles",
        frame,
      )
      .setOrigin(0, 0)
      .setScale(ART_SCALE)
      .setDepth(depth);
  }

  createPlayerAnimations() {
    Object.entries(PLAYER_FRAMES).forEach(([facing, frames]) => {
      this.anims.create({
        key: `idle-${facing}`,
        frames: [{ key: frames[1] }],
      });
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
      .sprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, PLAYER_FRAMES.down[1])
      .setOrigin(0.5, 1)
      .setScale(ART_SCALE)
      .setDepth(100);
    this.player.anims.play("idle-down");
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
    const animationKey = `${moving ? "walk" : "idle"}-${this.lastFacing}`;

    if (this.player.anims.currentAnim?.key === animationKey) {
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
