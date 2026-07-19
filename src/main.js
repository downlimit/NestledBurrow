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
const WALL_SIZE = 24;
const PLAYER_SIZE = 32;
const PLAYER_SPEED = 260;
const BUILD_ID = import.meta.env.VITE_BUILD_ID ?? "dev";

class RoomScene extends Phaser.Scene {
  constructor() {
    super("room");
  }

  create() {
    this.roomBounds = new Phaser.Geom.Rectangle(
      WALL_SIZE,
      WALL_SIZE,
      GAME_WIDTH - WALL_SIZE * 2,
      GAME_HEIGHT - WALL_SIZE * 2,
    );

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x25211d);
    this.add.rectangle(GAME_WIDTH / 2, WALL_SIZE / 2, GAME_WIDTH, WALL_SIZE, 0x6d5f4b);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - WALL_SIZE / 2, GAME_WIDTH, WALL_SIZE, 0x4f6a57);
    this.add.rectangle(WALL_SIZE / 2, GAME_HEIGHT / 2, WALL_SIZE, GAME_HEIGHT, 0x5f4c6b);
    this.add.rectangle(GAME_WIDTH - WALL_SIZE / 2, GAME_HEIGHT / 2, WALL_SIZE, GAME_HEIGHT, 0x6a4f4a);

    this.player = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      PLAYER_SIZE,
      PLAYER_SIZE,
      0xd9c18f,
    );

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys("W,A,S,D");

    this.add
      .text(GAME_WIDTH - 12, 12, `build: ${BUILD_ID}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: "#f2eadc",
      })
      .setOrigin(1, 0)
      .setAlpha(0.55)
      .setDepth(1000);

    this.onWindowBlur = () => this.resetJoystick();
    this.onVisibilityChange = () => {
      if (document.hidden) {
        this.resetJoystick();
      }
    };
    this.onNativePointerCancel = (event) => this.handleNativePointerEnd(event);
    this.onNativeLostPointerCapture = (event) => this.handleNativePointerEnd(event);
    this.onNativeTouchCancel = (event) => this.handleNativeTouchCancel(event);

    this.createJoystick();

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
    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;

    const keyboardVector = {
      x: Number(right) - Number(left),
      y: Number(down) - Number(up),
    };
    const joystickVector = this.joystickVector ?? { x: 0, y: 0 };
    const direction = new Phaser.Math.Vector2(
      keyboardVector.x + joystickVector.x,
      keyboardVector.y + joystickVector.y,
    );
    const limitedDirection = clampVectorLength(direction);

    if (limitedDirection.x === 0 && limitedDirection.y === 0) {
      return;
    }

    direction.set(limitedDirection.x, limitedDirection.y).scale(PLAYER_SPEED * (delta / 1000));

    this.player.x = Phaser.Math.Clamp(
      this.player.x + direction.x,
      this.roomBounds.left + PLAYER_SIZE / 2,
      this.roomBounds.right - PLAYER_SIZE / 2,
    );
    this.player.y = Phaser.Math.Clamp(
      this.player.y + direction.y,
      this.roomBounds.top + PLAYER_SIZE / 2,
      this.roomBounds.bottom - PLAYER_SIZE / 2,
    );
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#201b18",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scene: RoomScene,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});