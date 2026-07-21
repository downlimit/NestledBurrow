import Phaser from "phaser";
import "./style.css";
import {
  JOYSTICK,
  clampJoystickCenter,
  getJoystickState,
  isInsideJoystickActivation,
  isTouchJoystickSupported,
} from "./input.js";
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
import { createRuntimeMovementConfig, movementSpeed } from "./characterMovement.js";
import { createCharacter, createNpcMovementConfig } from "./character.js";
import { createPatrolController, createPlayerController } from "./controllers.js";
import { DEFAULT_MOVEMENT_CONFIG, MOVEMENT_TUNING_FIELDS } from "./movementConfig.js";
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

const BUILD_ID = import.meta.env.VITE_BUILD_ID ?? "dev";
const PLAYER_ASSET_URL = `${import.meta.env.BASE_URL}assets/third-party/kenney/player`;
const VILLAGE_ASSET_URL = `${import.meta.env.BASE_URL}${BASIC_VILLAGE_ASSET_PATH}`;
const MOVEMENT_STORAGE_KEY = "nestledBurrow.movementDebug";

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
    const debugOverrides = this.movementDebugEnabled ? this.loadMovementDebugConfig() : {};
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
    if (!this.movementDebugEnabled) return;

    const panel = document.createElement("section");
    panel.className = "movement-debug-panel";
    panel.setAttribute("aria-label", "Movement tuning");

    const title = document.createElement("strong");
    title.textContent = "Movement tuning";
    panel.append(title);

    for (const field of MOVEMENT_TUNING_FIELDS) {
      const label = document.createElement("label");
      const name = document.createElement("span");
      name.textContent = field.key;
      const input = document.createElement("input");
      input.type = "number";
      input.min = String(field.min);
      input.max = String(field.max);
      input.step = String(field.step);
      input.value = String(this.movementConfig[field.key]);
      input.dataset.field = field.key;
      input.addEventListener("input", () => {
        const value = Number(input.value);
        if (!Number.isFinite(value)) return;
        const next = createRuntimeMovementConfig({
          ...this.movementConfig,
          [field.key]: value,
        });
        Object.assign(this.movementConfig, next);
        this.syncNpcMovementConfig();
        input.value = String(this.movementConfig[field.key]);
        this.saveMovementDebugConfig();
      });
      label.append(name, input);
      panel.append(label);
    }

    const status = document.createElement("output");
    status.className = "movement-debug-status";
    panel.append(status);
    this.movementDebugStatus = status;

    const actions = document.createElement("div");
    actions.className = "movement-debug-actions";

    const reset = document.createElement("button");
    reset.type = "button";
    reset.textContent = "Reset defaults";
    reset.addEventListener("click", () => {
      Object.assign(this.movementConfig, createRuntimeMovementConfig(DEFAULT_MOVEMENT_CONFIG));
      this.syncNpcMovementConfig();
      try {
        localStorage.removeItem(MOVEMENT_STORAGE_KEY);
      } catch {
        // Debug persistence is optional.
      }
      panel.querySelectorAll("input[data-field]").forEach((input) => {
        input.value = String(this.movementConfig[input.dataset.field]);
      });
    });

    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "Copy config";
    copy.addEventListener("click", async () => {
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(JSON.stringify(this.movementConfig, null, 2));
        copy.textContent = "Copied";
      } catch {
        copy.textContent = "Copy unavailable";
      }
      window.setTimeout(() => {
        copy.textContent = "Copy config";
      }, 1200);
    });

    actions.append(reset, copy);
    panel.append(actions);
    document.body.append(panel);
    this.movementDebugPanel = panel;
    this.updateMovementDebugStatus();
  }

  loadMovementDebugConfig() {
    try {
      return JSON.parse(localStorage.getItem(MOVEMENT_STORAGE_KEY) ?? "{}");
    } catch {
      return {};
    }
  }

  saveMovementDebugConfig() {
    if (!this.movementDebugEnabled) return;
    try {
      localStorage.setItem(MOVEMENT_STORAGE_KEY, JSON.stringify(this.movementConfig));
    } catch {
      // Debug persistence is optional.
    }
  }

  updateMovementDebugStatus() {
    if (!this.movementDebugStatus) return;
    const velocity = this.playerCharacter.movement.velocity;
    this.movementDebugStatus.textContent = [
      `speed ${movementSpeed(this.playerCharacter.movement).toFixed(1)} / ${this.movementConfig.maxSpeed}`,
      `velocity ${velocity.x.toFixed(1)}, ${velocity.y.toFixed(1)}`,
      `facing ${this.playerCharacter.lastFacing}`,
    ].join("\n");
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

  isHudPointer(pointer) {
    return isPointInRect(pointer.x, pointer.y, FULLSCREEN_HIT_AREA);
  }

  attachSceneListeners() {
    this.onWindowBlur = () => this.resetJoystick();
    this.onVisibilityChange = () => {
      if (document.hidden) this.resetJoystick();
    };
    this.onNativePointerDown = (event) => this.handleNativePointerDown(event);
    this.onNativePointerMove = (event) => this.handleNativePointerMove(event);
    this.onNativePointerUp = (event) => this.handleNativePointerUp(event);
    this.onNativePointerCancel = (event) => this.handleNativePointerEnd(event);
    this.onNativeLostPointerCapture = (event) => this.handleNativeLostPointerCapture(event);
    this.onNativePointerBoundaryLeave = () => this.handleJoystickBoundaryLeave();
    this.onNativeTouchCancel = (event) => this.handleNativeTouchCancel(event);
    this.onFullscreenChange = () => {
      this.resetJoystick();
      this.syncIntegerZoom();
      this.updateFullscreenHud();
    };

    window.addEventListener("blur", this.onWindowBlur);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
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
    this.activeJoystickPointerId = null;
    this.activeDomPointerId = null;
    this.activeTouchIdentifier = null;
    this.joystickPointerCaptured = false;
    this.joystickVector = { x: 0, y: 0 };

    const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    if (!isTouchJoystickSupported({ maxTouchPoints: navigator.maxTouchPoints, coarsePointer })) {
      return;
    }

    this.joystickBase = this.add
      .circle(0, 0, JOYSTICK.baseRadius, 0xd9c18f, 0.22)
      .setStrokeStyle(1, 0xf2eadc, 0.32)
      .setDepth(9000)
      .setScrollFactor(0)
      .setVisible(false);
    this.joystickKnob = this.add
      .circle(0, 0, JOYSTICK.knobRadius, 0xf2eadc, 0.55)
      .setStrokeStyle(1, 0xffffff, 0.65)
      .setDepth(9001)
      .setScrollFactor(0)
      .setVisible(false);

    this.input.on("pointerdown", this.handleJoystickPointerDown, this);
    this.input.on("pointermove", this.handleJoystickPointerMove, this);
    this.input.on("pointerup", this.handleJoystickPointerUp, this);
    this.input.on("pointerupoutside", this.handleJoystickPointerUp, this);
    this.input.on("gameout", this.handleJoystickBoundaryLeave, this);
    this.input.on("pointerout", this.handleJoystickBoundaryLeave, this);

    const canvas = this.game.canvas;
    canvas.addEventListener("pointerdown", this.onNativePointerDown, { capture: true, passive: false });
    canvas.addEventListener("lostpointercapture", this.onNativeLostPointerCapture);
    canvas.addEventListener("pointerleave", this.onNativePointerBoundaryLeave);
    canvas.addEventListener("touchcancel", this.onNativeTouchCancel, { passive: true });
    window.addEventListener("pointermove", this.onNativePointerMove, { capture: true, passive: false });
    window.addEventListener("pointerup", this.onNativePointerUp, { capture: true, passive: false });
    window.addEventListener("pointercancel", this.onNativePointerCancel, { capture: true, passive: false });
  }

  handleJoystickPointerDown(pointer) {
    if (this.isHudPointer(pointer)) return;
    this.startJoystickPointer({
      joystickPointerId: pointer.id,
      domPointerId: typeof pointer.event?.pointerId === "number" ? pointer.event.pointerId : null,
      touchIdentifier: pointer.wasTouch ? pointer.identifier : null,
      x: pointer.x,
      y: pointer.y,
      event: pointer.event,
    });
  }

  handleNativePointerDown(event) {
    const point = this.canvasPointFromNativeEvent(event);
    this.startJoystickPointer({
      joystickPointerId: event.pointerId,
      domPointerId: event.pointerId,
      touchIdentifier: null,
      x: point.x,
      y: point.y,
      event,
    });
  }

  startJoystickPointer({ joystickPointerId, domPointerId, touchIdentifier, x, y, event }) {
    if (
      this.activeJoystickPointerId !== null ||
      this.isHudPointer({ x, y }) ||
      !isInsideJoystickActivation(x, y)
    ) {
      return;
    }
    this.activeJoystickPointerId = joystickPointerId;
    this.activeDomPointerId = domPointerId;
    this.activeTouchIdentifier = touchIdentifier;
    this.preventActivePointerDefault(event);
    this.captureJoystickPointer();
    this.joystickCenter = clampJoystickCenter(x, y);
    this.joystickBase?.setPosition(this.joystickCenter.x, this.joystickCenter.y).setVisible(true);
    this.joystickKnob?.setPosition(this.joystickCenter.x, this.joystickCenter.y).setVisible(true);
  }

  handleJoystickPointerMove(pointer) {
    if (this.activeDomPointerId !== null) return;
    if (pointer.id === this.activeJoystickPointerId) this.updateJoystick(pointer);
  }

  handleJoystickBoundaryLeave() {
    // Boundary transitions are expected while the active finger crosses canvas letterboxing.
  }

  captureJoystickPointer() {
    const canvas = this.game.canvas;
    if (this.activeDomPointerId === null || !canvas.setPointerCapture) return;
    try {
      canvas.setPointerCapture(this.activeDomPointerId);
      this.joystickPointerCaptured = true;
    } catch {
      this.joystickPointerCaptured = false;
    }
  }

  canvasPointFromNativeEvent(event) {
    const rect = this.game.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (GAME_WIDTH / rect.width),
      y: (event.clientY - rect.top) * (GAME_HEIGHT / rect.height),
    };
  }

  handleNativePointerMove(event) {
    if (!this.isActiveDomPointer(event)) return;
    this.preventActivePointerDefault(event);
    this.updateJoystick(this.canvasPointFromNativeEvent(event));
  }

  handleNativePointerUp(event) {
    this.handleNativePointerEnd(event);
  }

  handleNativeLostPointerCapture(event) {
    if (this.isActiveDomPointer(event)) this.joystickPointerCaptured = false;
  }

  handleJoystickPointerUp(pointer) {
    if (this.activeDomPointerId !== null) return;
    if (pointer.id === this.activeJoystickPointerId) this.resetJoystick();
  }

  handleNativePointerEnd(event) {
    if (!this.isActiveDomPointer(event)) return;
    this.preventActivePointerDefault(event);
    this.resetJoystick();
  }

  isActiveDomPointer(event) {
    return (
      this.activeJoystickPointerId !== null &&
      this.activeDomPointerId !== null &&
      event.pointerId === this.activeDomPointerId
    );
  }

  preventActivePointerDefault(event) {
    if (event?.cancelable) event.preventDefault();
  }

  handleNativeTouchCancel(event) {
    if (this.activeJoystickPointerId === null || this.activeTouchIdentifier === null) return;
    const canceled = Array.from(event.changedTouches ?? []).some(
      (touch) => touch.identifier === this.activeTouchIdentifier,
    );
    if (canceled) this.resetJoystick();
  }

  updateJoystick(pointer) {
    if (!this.joystickCenter) return;
    const state = getJoystickState(pointer.x, pointer.y, this.joystickCenter);
    this.joystickVector = { x: state.movementX, y: state.movementY };
    this.joystickKnob?.setPosition(state.knobX, state.knobY);
  }

  resetJoystick() {
    const capturedPointerId = this.activeDomPointerId;
    if (capturedPointerId !== null && this.joystickPointerCaptured) {
      try {
        this.game.canvas.releasePointerCapture?.(capturedPointerId);
      } catch {
        // The browser may already have released capture after pointerup/cancel/lostcapture.
      }
    }
    this.activeJoystickPointerId = null;
    this.activeDomPointerId = null;
    this.activeTouchIdentifier = null;
    this.joystickPointerCaptured = false;
    this.joystickVector = { x: 0, y: 0 };
    this.joystickCenter = null;
    this.joystickBase?.setVisible(false);
    this.joystickKnob?.setVisible(false);
  }

  destroySceneListeners() {
    if (!this.sceneListenersAttached) return;
    this.sceneListenersAttached = false;
    window.removeEventListener("blur", this.onWindowBlur);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    document.removeEventListener("fullscreenchange", this.onFullscreenChange);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.syncIntegerZoom, this);
    this.input.off("pointerdown", this.handleJoystickPointerDown, this);
    this.input.off("pointermove", this.handleJoystickPointerMove, this);
    this.input.off("pointerup", this.handleJoystickPointerUp, this);
    this.input.off("pointerupoutside", this.handleJoystickPointerUp, this);
    this.input.off("gameout", this.handleJoystickBoundaryLeave, this);
    this.input.off("pointerout", this.handleJoystickBoundaryLeave, this);
    const canvas = this.game.canvas;
    canvas.removeEventListener("pointerdown", this.onNativePointerDown, { capture: true });
    canvas.removeEventListener("lostpointercapture", this.onNativeLostPointerCapture);
    canvas.removeEventListener("pointerleave", this.onNativePointerBoundaryLeave);
    canvas.removeEventListener("touchcancel", this.onNativeTouchCancel);
    window.removeEventListener("pointermove", this.onNativePointerMove, { capture: true });
    window.removeEventListener("pointerup", this.onNativePointerUp, { capture: true });
    window.removeEventListener("pointercancel", this.onNativePointerCancel, { capture: true });
    this.resetJoystick();
    this.movementDebugPanel?.remove();
    this.movementDebugPanel = null;
    this.movementDebugStatus = null;
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
    const joystick = this.joystickVector ?? { x: 0, y: 0 };
    return {
      x: Number(right) - Number(left) + joystick.x,
      y: Number(down) - Number(up) + joystick.y,
    };
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
