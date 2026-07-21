import {
  JOYSTICK,
  clampJoystickCenter,
  getJoystickState,
  isInsideJoystickActivation,
  isTouchJoystickSupported,
} from "./input.js";
import { GAME_HEIGHT, GAME_WIDTH } from "./worldConfig.js";

export class MobileJoystick {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.windowRef = options.windowRef ?? globalThis.window;
    this.documentRef = options.documentRef ?? globalThis.document;
    this.navigatorRef = options.navigatorRef ?? globalThis.navigator;
    this.canvas = options.canvas ?? scene?.game?.canvas;
    this.isExcludedPoint = options.isExcludedPoint ?? (() => false);
    this.direction = { x: 0, y: 0 };
    this.activeJoystickPointerId = null;
    this.activeDomPointerId = null;
    this.activeTouchIdentifier = null;
    this.pointerCaptured = false;
    this.center = null;
    this.destroyed = false;
    this.phaserListeners = [];
    this.domListeners = [];

    const coarsePointer = this.windowRef?.matchMedia?.("(pointer: coarse)")?.matches ?? false;
    this.enabled = isTouchJoystickSupported({
      maxTouchPoints: this.navigatorRef?.maxTouchPoints ?? 0,
      coarsePointer,
    });
    if (!this.enabled) return;

    this.base = scene.add
      .circle(0, 0, JOYSTICK.baseRadius, 0xd9c18f, 0.22)
      .setStrokeStyle(1, 0xf2eadc, 0.32)
      .setDepth(9000)
      .setScrollFactor(0)
      .setVisible(false);
    this.knob = scene.add
      .circle(0, 0, JOYSTICK.knobRadius, 0xf2eadc, 0.55)
      .setStrokeStyle(1, 0xffffff, 0.65)
      .setDepth(9001)
      .setScrollFactor(0)
      .setVisible(false);

    this.onPhaserDown = (pointer) => this.handlePhaserDown(pointer);
    this.onPhaserMove = (pointer) => this.handlePhaserMove(pointer);
    this.onPhaserUp = (pointer) => this.handlePhaserUp(pointer);
    this.onBoundaryLeave = () => {};
    this.addPhaser("pointerdown", this.onPhaserDown, this);
    this.addPhaser("pointermove", this.onPhaserMove, this);
    this.addPhaser("pointerup", this.onPhaserUp, this);
    this.addPhaser("pointerupoutside", this.onPhaserUp, this);
    this.addPhaser("gameout", this.onBoundaryLeave, this);
    this.addPhaser("pointerout", this.onBoundaryLeave, this);

    this.onNativeDown = (event) => this.handleNativeDown(event);
    this.onNativeMove = (event) => this.handleNativeMove(event);
    this.onNativeUp = (event) => this.handleNativeEnd(event);
    this.onNativeCancel = (event) => this.handleNativeEnd(event);
    this.onLostCapture = (event) => this.handleLostPointerCapture(event);
    this.onTouchCancel = (event) => this.handleTouchCancel(event);
    this.onBlur = () => this.reset();
    this.onVisibility = () => {
      if (this.documentRef?.hidden) this.reset();
    };
    this.onFullscreen = () => this.reset();
    this.addDom(this.canvas, "pointerdown", this.onNativeDown, { capture: true, passive: false });
    this.addDom(this.canvas, "lostpointercapture", this.onLostCapture);
    this.addDom(this.canvas, "pointerleave", this.onBoundaryLeave);
    this.addDom(this.canvas, "touchcancel", this.onTouchCancel, { passive: true });
    this.addDom(this.windowRef, "pointermove", this.onNativeMove, { capture: true, passive: false });
    this.addDom(this.windowRef, "pointerup", this.onNativeUp, { capture: true, passive: false });
    this.addDom(this.windowRef, "pointercancel", this.onNativeCancel, { capture: true, passive: false });
    this.addDom(this.windowRef, "blur", this.onBlur);
    this.addDom(this.documentRef, "visibilitychange", this.onVisibility);
    this.addDom(this.documentRef, "fullscreenchange", this.onFullscreen);
  }

  getDirection() {
    return { x: this.direction.x, y: this.direction.y };
  }

  addPhaser(event, fn, context) {
    this.scene.input.on(event, fn, context);
    this.phaserListeners.push([event, fn, context]);
  }

  addDom(target, type, fn, options) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, fn, options);
    this.domListeners.push([target, type, fn, options]);
  }

  handlePhaserDown(pointer) {
    this.start({
      joystickPointerId: pointer.id,
      domPointerId: typeof pointer.event?.pointerId === "number" ? pointer.event.pointerId : null,
      touchIdentifier: pointer.wasTouch ? pointer.identifier : null,
      x: pointer.x,
      y: pointer.y,
      event: pointer.event,
    });
  }

  handleNativeDown(event) {
    const point = this.canvasPointFromNativeEvent(event);
    this.start({
      joystickPointerId: event.pointerId,
      domPointerId: event.pointerId,
      touchIdentifier: null,
      x: point.x,
      y: point.y,
      event,
    });
  }

  start({ joystickPointerId, domPointerId, touchIdentifier, x, y, event }) {
    if (
      this.activeJoystickPointerId !== null ||
      this.isExcludedPoint(x, y) ||
      !isInsideJoystickActivation(x, y)
    ) {
      return;
    }
    this.activeJoystickPointerId = joystickPointerId;
    this.activeDomPointerId = domPointerId;
    this.activeTouchIdentifier = touchIdentifier;
    this.preventDefault(event);
    this.capturePointer();
    this.center = clampJoystickCenter(x, y);
    this.direction = { x: 0, y: 0 };
    this.base?.setPosition(this.center.x, this.center.y).setVisible(true);
    this.knob?.setPosition(this.center.x, this.center.y).setVisible(true);
  }

  handlePhaserMove(pointer) {
    if (this.activeDomPointerId !== null) return;
    if (pointer.id === this.activeJoystickPointerId) this.update(pointer);
  }

  handlePhaserUp(pointer) {
    if (this.activeDomPointerId !== null) return;
    if (pointer.id === this.activeJoystickPointerId) this.reset();
  }

  handleNativeMove(event) {
    if (!this.isActiveDomPointer(event)) return;
    this.preventDefault(event);
    this.update(this.canvasPointFromNativeEvent(event));
  }

  handleNativeEnd(event) {
    if (!this.isActiveDomPointer(event)) return;
    this.preventDefault(event);
    this.reset();
  }

  handleLostPointerCapture(event) {
    if (this.isActiveDomPointer(event)) this.pointerCaptured = false;
  }

  handleTouchCancel(event) {
    if (this.activeJoystickPointerId === null || this.activeTouchIdentifier === null) return;
    const canceled = Array.from(event.changedTouches ?? []).some(
      (touch) => touch.identifier === this.activeTouchIdentifier,
    );
    if (canceled) this.reset();
  }

  isActiveDomPointer(event) {
    return (
      this.activeJoystickPointerId !== null &&
      this.activeDomPointerId !== null &&
      event.pointerId === this.activeDomPointerId
    );
  }

  preventDefault(event) {
    if (event?.cancelable) event.preventDefault();
  }

  capturePointer() {
    if (this.activeDomPointerId === null || !this.canvas?.setPointerCapture) return;
    try {
      this.canvas.setPointerCapture(this.activeDomPointerId);
      this.pointerCaptured = true;
    } catch {
      this.pointerCaptured = false;
    }
  }

  canvasPointFromNativeEvent(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (GAME_WIDTH / rect.width),
      y: (event.clientY - rect.top) * (GAME_HEIGHT / rect.height),
    };
  }

  update(pointer) {
    if (!this.center) return;
    const state = getJoystickState(pointer.x, pointer.y, this.center);
    this.direction = { x: state.movementX, y: state.movementY };
    this.knob?.setPosition(state.knobX, state.knobY);
  }

  reset() {
    const capturedPointerId = this.activeDomPointerId;
    if (capturedPointerId !== null && this.pointerCaptured) {
      try {
        this.canvas?.releasePointerCapture?.(capturedPointerId);
      } catch {
        // The browser may already have released capture.
      }
    }
    this.activeJoystickPointerId = null;
    this.activeDomPointerId = null;
    this.activeTouchIdentifier = null;
    this.pointerCaptured = false;
    this.direction = { x: 0, y: 0 };
    this.center = null;
    this.base?.setVisible(false);
    this.knob?.setVisible(false);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const [event, fn, context] of this.phaserListeners) {
      this.scene.input.off(event, fn, context);
    }
    for (const [target, type, fn, options] of this.domListeners) {
      target.removeEventListener(type, fn, options);
    }
    this.phaserListeners = [];
    this.domListeners = [];
    this.reset();
    this.base?.destroy();
    this.knob?.destroy();
    this.base = null;
    this.knob = null;
  }
}

export function createMobileJoystick(scene, options) {
  return new MobileJoystick(scene, options);
}
