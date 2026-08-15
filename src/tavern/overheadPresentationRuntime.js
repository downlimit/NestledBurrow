import { inventoryItemAsset } from "../inventory/inventoryVisuals.js";
import { createManagedText } from "../ui/textResolution.js";
import { HUD_DEPTH } from "../ui/hud.js";
import { PRESENTATION_DENSITY } from "../ui/presentationCameraRuntime.js";
import { GAME_HEIGHT, GAME_WIDTH } from "../world/worldConfig.js";

const BASE_PATH = "assets/project/characters/overhead/";
const CROSSFADE_MS = 200;
const SCALE_TRANSITION_MS = 180;
const THOUGHT_ALTERNATION_MS = 1_200;
const PIXEL_DENSITY = 6;
const UI_ACTION_WIDTH = 22;
const UI_SATISFACTION_WIDTH = 20;
const UI_THOUGHT_WIDTH = 36;
const UI_THOUGHT_ICON_SIZE = 15;
const THOUGHT_ICON_SCREEN_OFFSET_Y = -3;
const ACTION_SCREEN_OFFSET_Y = 22;
const THOUGHT_SCREEN_OFFSET_Y = 32;
const THOUGHT_TAIL_SCREEN_OFFSET_X = 8;
const LINEAR_TEXTURE_FILTER = 0;
let canvasTextureSequence = 0;

export const OVERHEAD_THOUGHTS = Object.freeze({
  wander: "bored",
  wash: "cleanliness",
  leave: "leave",
  food: "hunger",
  rest: "low-energy",
  social: "social",
  toilet: "toilet",
  waiting: "mind-waiting",
});

export const OVERHEAD_ACTIONS = Object.freeze({
  chill: "chill",
  drink: "drink",
  eat: "eat",
  order: "order",
  paying: "paying",
  readMenu: "read-menu",
  sleep: "sleep",
  talk: "talk",
  waiting: "waiting",
  wash: "wash",
  satisfaction: "satisfaction",
});

const ASSETS = Object.freeze({
  "mind-bubble": asset("MindBubble", 3, [0, 1, 2], 900, UI_THOUGHT_WIDTH),
  bored: asset("MindBored", 1, [0], 1_200, UI_THOUGHT_ICON_SIZE),
  cleanliness: asset("MindCleanliness", 1, [0], 1_200, UI_THOUGHT_ICON_SIZE),
  leave: asset("MindLeave", 1, [0], 1_200, UI_THOUGHT_ICON_SIZE),
  hunger: asset("MindHunger", 1, [0], 1_200, UI_THOUGHT_ICON_SIZE),
  "low-energy": asset("MindLowEnergy", 1, [0], 1_200, UI_THOUGHT_ICON_SIZE),
  social: asset("MindSocial", 1, [0], 1_200, UI_THOUGHT_ICON_SIZE),
  toilet: asset("MindToilet", 1, [0], 1_200, UI_THOUGHT_ICON_SIZE),
  "mind-waiting": asset("MindWaiting", 1, [0], 1_200, UI_THOUGHT_ICON_SIZE),
  chill: asset("ActionChilling", 2, [0, 1], 1_400, UI_ACTION_WIDTH),
  drink: asset("ActionDrink", 2, [0, 1], 900, UI_ACTION_WIDTH),
  eat: asset("ActionEat", 2, [0, 1], 900, UI_ACTION_WIDTH),
  order: asset("ActionOrder", 2, [0, 1], 700, UI_ACTION_WIDTH),
  paying: asset("ActionPaying", 2, [0, 1], 700, UI_ACTION_WIDTH),
  "read-menu": asset("ActionReadMenu", 2, [0, 1], 700, UI_ACTION_WIDTH),
  sleep: asset("ActionSleep", 2, [0, 1], 1_300, UI_ACTION_WIDTH),
  talk: asset("ActionTalk", 3, [1, 0, 1, 2], 700, UI_ACTION_WIDTH),
  waiting: asset("ActionWaiting", 2, [0, 1], 1_400, UI_ACTION_WIDTH),
  wash: asset("ActionWash", 2, [0, 1], 900, UI_ACTION_WIDTH),
  satisfaction: asset("SatisfactionTiers", 5, [0], 1_200, UI_SATISFACTION_WIDTH),
});

export function preloadOverheadAssets(scene, baseUrl = import.meta.env.BASE_URL) {
  const unique = new Map(Object.values(ASSETS).map((entry) => [entry.key, entry]));
  for (const entry of unique.values()) scene.load.image(entry.key, `${baseUrl}${entry.path}`);
}

export function createActorOverheadPresentation(scene, character) {
  ensureAssetFrames(scene);
  const thought = createChannel(scene, HUD_DEPTH - 5, "thought");
  const action = createChannel(scene, HUD_DEPTH - 4, "action");
  const progress = scene.add.graphics().setDepth(HUD_DEPTH - 3).setScrollFactor(1);
  const hoverLabel = createManagedText(scene, 0, 0, "", {
    fontSize: "8px",
    color: "#fff6cf",
    align: "center",
    backgroundColor: "rgba(36, 26, 32, 0.72)",
    stroke: "#241a20",
    strokeThickness: 2,
    padding: { x: 3, y: 2 },
  }).setDepth(HUD_DEPTH + 28).setScrollFactor(1).setVisible(false);
  let thoughtId = null;
  let actionId = null;
  let actionProgress = null;
  let orderItem = null;
  let secondaryThoughtId = null;
  let displayedThought = null;
  let thoughtAlternationElapsedMs = 0;
  let orderIconHovered = false;
  let satisfactionTier = 3;
  let destroyed = false;

  function setThought(next) {
    const nextThoughtId = next ? OVERHEAD_THOUGHTS[next] ?? next : null;
    if (orderItem) {
      const nextSecondaryThoughtId = nextThoughtId === "mind-waiting" ? null : nextThoughtId;
      if (secondaryThoughtId === nextSecondaryThoughtId) return;
      secondaryThoughtId = nextSecondaryThoughtId;
      thoughtAlternationElapsedMs = 0;
      showOrderOverlay();
      return;
    }
    secondaryThoughtId = nextThoughtId;
    orderIconHovered = false;
    hoverLabel.setVisible(false);
    thoughtId = nextThoughtId;
    displayedThought = nextThoughtId;
    setChannelOverlay(thought, thoughtId ? {
      textureKey: ASSETS[thoughtId].key,
      frame: frameName(0),
    } : null);
    setChannelDefinition(thought, thoughtId ? "mind-bubble" : null);
  }

  function setOrderItem(next) {
    if (!next?.itemId) {
      if (!orderItem) return;
      orderItem = null;
      orderIconHovered = false;
      hoverLabel.setVisible(false);
      thoughtAlternationElapsedMs = 0;
      thoughtId = secondaryThoughtId;
      displayedThought = secondaryThoughtId;
      setChannelOverlay(thought, secondaryThoughtId ? {
        textureKey: ASSETS[secondaryThoughtId].key,
        frame: frameName(0),
      } : null);
      setChannelDefinition(thought, secondaryThoughtId ? "mind-bubble" : null);
      return;
    }
    const iconAsset = inventoryItemAsset(next.itemId);
    if (thoughtId && thoughtId !== "order-item") secondaryThoughtId = thoughtId;
    orderItem = {
      itemId: next.itemId,
      label: String(next.label ?? ""),
      overlay: iconAsset ? {
        textureKey: iconAsset.textureKey,
        frame: iconAsset.frame,
      } : {
        textureKey: ASSETS["mind-waiting"].key,
        frame: frameName(0),
      },
    };
    thoughtId = "order-item";
    displayedThought = "order-item";
    thoughtAlternationElapsedMs = 0;
    orderIconHovered = false;
    hoverLabel.setText(orderItem.label).setVisible(false);
    setChannelOverlay(thought, orderItem.overlay);
    setChannelDefinition(thought, "mind-bubble");
    actionProgress = Number.isFinite(Number(next.progress)) ? clamp(Number(next.progress), 0, 1) : null;
  }

  function setAction(next, options = {}) {
    actionId = next ? OVERHEAD_ACTIONS[next] ?? next : null;
    satisfactionTier = Math.max(1, Math.min(5, Math.round(Number(options.satisfactionTier) || satisfactionTier)));
    setChannelDefinition(action, actionId, actionId === "satisfaction" ? satisfactionTier - 1 : null);
    actionProgress = Number.isFinite(Number(options.progress)) ? clamp(Number(options.progress), 0, 1) : null;
  }

  function setProgress(value) {
    actionProgress = Number.isFinite(Number(value)) ? clamp(Number(value), 0, 1) : null;
  }

  function update(deltaMs = 0) {
    if (destroyed) return;
    const delta = Math.max(0, Number(deltaMs) || 0);
    updateThoughtAlternation(delta);
    const camera = scene.cameras.main;
    const cameraZoom = Math.max(0.01, (Number(camera?.zoom) || 1) / PRESENTATION_DENSITY);
    updateChannel(thought, delta, cameraZoom);
    updateChannel(action, delta, cameraZoom);
    const worldPosition = character?.motor?.position ?? character?.position;
    if (!worldPosition) return;
    const screen = worldToUi(camera, worldPosition);
    const onscreenAlpha = screen.x >= -64 && screen.x <= GAME_WIDTH + 64
      && screen.y >= -96 && screen.y <= GAME_HEIGHT + 64 ? 1 : 0;
    const actionX = Number(worldPosition.x);
    const actionY = Number(worldPosition.y) - ACTION_SCREEN_OFFSET_Y / cameraZoom;
    const thoughtX = actionX + THOUGHT_TAIL_SCREEN_OFFSET_X / cameraZoom;
    const thoughtY = Number(worldPosition.y) - THOUGHT_SCREEN_OFFSET_Y / cameraZoom;
    placeChannel(action, actionX, actionY, { originY: 0.5 });
    placeChannel(thought, thoughtX, thoughtY, { originY: 0.58 });
    action.sprite.setAlpha(action.sprite.alpha * onscreenAlpha);
    thought.sprite.setAlpha(thought.sprite.alpha * onscreenAlpha);
    const thoughtScreenPosition = worldToUi(camera, thought.sprite);
    const iconScreenPosition = {
      x: thoughtScreenPosition.x,
      y: thoughtScreenPosition.y + THOUGHT_ICON_SCREEN_OFFSET_Y,
    };
    orderIconHovered = Boolean(orderItem && displayedThought === "order-item" && pointerWithinIcon(
      scene.input?.activePointer,
      iconScreenPosition,
      UI_THOUGHT_ICON_SIZE,
    ));
    const flipX = ["right", "up", "up-right", "down-right"].includes(
      character?.visual?.lastFacing ?? character?.lastFacing,
    );
    action.sprite.setFlipX?.(flipX);
    const labelVisible = Boolean(orderItem?.label && displayedThought === "order-item"
      && orderIconHovered && thought.visibility > 0 && onscreenAlpha);
    hoverLabel.setScale(1 / cameraZoom)
      .setPosition(thoughtX - hoverLabel.width / (2 * cameraZoom), thoughtY + 20 / cameraZoom)
      .setAlpha(0.94 * thought.visibility * onscreenAlpha)
      .setVisible(labelVisible);
    const progressX = orderItem ? thoughtX : actionX;
    const progressY = orderItem ? thoughtY : actionY;
    const progressAlpha = orderItem ? thought.visibility * onscreenAlpha : action.visibility * onscreenAlpha;
    drawProgress(progress, actionProgress, progressX, progressY, orderItem ? 20 : 13, progressAlpha, cameraZoom);
  }

  return Object.freeze({
    setThought,
    setOrderItem,
    setAction,
    setProgress,
    update,
    getState: () => ({
      thought: thoughtId,
      displayedThought,
      alternateThought: orderItem ? secondaryThoughtId : null,
      action: actionId,
      actionFrame: currentFrame(action),
      actionProgress,
      orderItemId: orderItem?.itemId ?? null,
      orderLabelVisible: Boolean(orderItem?.label && displayedThought === "order-item" && orderIconHovered),
      orderIconPosition: orderItem && displayedThought === "order-item"
        ? roundedPoint(iconScreenPositionFor(scene.cameras.main, thought.sprite)) : null,
      satisfactionTier: actionId === "satisfaction" ? satisfactionTier : null,
      flipX: Boolean(action.sprite.flipX),
      crossfading: isFading(action) || isFading(thought),
      crossfadeMode: "premultiplied-additive",
      thoughtAboveAction: false,
      actionAboveThought: true,
      uiSpace: true,
      pixelDensity: PIXEL_DENSITY,
      actionSpriteCount: 1,
      screenGeometry: {
        anchor: roundedPoint(worldToUi(scene.cameras.main, character?.motor?.position ?? character?.position)),
        thought: roundedPoint(worldToUi(scene.cameras.main, thought.sprite)),
        action: roundedPoint(worldToUi(scene.cameras.main, action.sprite)),
        icon: roundedPoint(iconScreenPositionFor(scene.cameras.main, thought.sprite)),
        thoughtWidth: Math.round(thought.sprite.displayWidth * (scene.cameras.main.zoom || 1) / PRESENTATION_DENSITY),
        actionWidth: Math.round(action.sprite.displayWidth * (scene.cameras.main.zoom || 1) / PRESENTATION_DENSITY),
        iconWidth: UI_THOUGHT_ICON_SIZE,
      },
    }),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      thought.sprite.destroy();
      action.sprite.destroy();
      progress.destroy();
      hoverLabel.destroy();
      removeCanvasTexture(scene, thought.textureKey);
      removeCanvasTexture(scene, action.textureKey);
    },
  });

  function showOrderOverlay() {
    if (!orderItem) return;
    displayedThought = "order-item";
    orderIconHovered = false;
    hoverLabel.setVisible(false);
    setChannelOverlay(thought, orderItem.overlay);
  }

  function updateThoughtAlternation(deltaMs) {
    if (!orderItem || !secondaryThoughtId) {
      if (orderItem && displayedThought !== "order-item") showOrderOverlay();
      return;
    }
    thoughtAlternationElapsedMs = (thoughtAlternationElapsedMs + deltaMs) % (THOUGHT_ALTERNATION_MS * 2);
    const nextDisplayedThought = thoughtAlternationElapsedMs < THOUGHT_ALTERNATION_MS
      ? "order-item" : secondaryThoughtId;
    if (displayedThought === nextDisplayedThought) return;
    orderIconHovered = false;
    hoverLabel.setVisible(false);
    displayedThought = nextDisplayedThought;
    setChannelOverlay(thought, nextDisplayedThought === "order-item" ? orderItem.overlay : {
      textureKey: ASSETS[secondaryThoughtId].key,
      frame: frameName(0),
    });
  }
}

function asset(name, frameCount, sequence, holdMs, displayWidth) {
  return Object.freeze({
    key: `overhead.${name}`,
    path: `${BASE_PATH}NestledBurrow_${name}.png`,
    frameCount,
    sequence: Object.freeze(sequence),
    holdMs,
    displayWidth,
  });
}

function ensureAssetFrames(scene) {
  for (const definition of Object.values(ASSETS)) {
    const texture = scene.textures.get(definition.key);
    const source = texture?.getSourceImage?.();
    const sourceWidth = Math.max(1, Number(source?.width) || 1);
    const sourceHeight = Math.max(1, Number(source?.height) || 1);
    for (let index = 0; index < definition.frameCount; index += 1) {
      const name = frameName(index);
      if (texture.has(name)) continue;
      const left = Math.round(index * sourceWidth / definition.frameCount);
      const right = Math.round((index + 1) * sourceWidth / definition.frameCount);
      texture.add(name, 0, left, 0, Math.max(1, right - left), sourceHeight);
    }
  }
}

function createChannel(scene, depth, name) {
  const textureKey = nextCanvasTextureKey(name);
  const canvasTexture = scene.textures.createCanvas(textureKey, PIXEL_DENSITY, PIXEL_DENSITY);
  canvasTexture.setFilter(LINEAR_TEXTURE_FILTER);
  const sprite = scene.add.image(0, 0, textureKey)
    .setDepth(depth)
    .setScrollFactor(1)
    .setVisible(false);
  return {
    scene,
    textureKey,
    canvasTexture,
    sprite,
    depth,
    definitionId: null,
    sequenceIndex: 0,
    fixedFrame: null,
    frameElapsedMs: 0,
    frameTransition: null,
    renderedVisual: null,
    visibility: 0,
    targetVisible: false,
    displayWidth: 1,
    displayHeight: 1,
    overlay: null,
  };
}

function setChannelOverlay(channel, overlay) {
  channel.overlay = overlay;
  if (!channel.renderedVisual) return;
  if (channel.frameTransition) {
    const mix = channel.frameTransition.elapsedMs / CROSSFADE_MS;
    renderCrossfade(channel, channel.frameTransition.from, channel.frameTransition.to, mix);
  } else renderStaticVisual(channel, channel.renderedVisual);
}

function setChannelDefinition(channel, definitionId, fixedFrame = null) {
  if (!definitionId) {
    channel.targetVisible = false;
    channel.fixedFrame = null;
    channel.frameTransition = null;
    return;
  }
  if (channel.definitionId === definitionId && channel.fixedFrame === fixedFrame && channel.targetVisible) return;
  channel.definitionId = definitionId;
  channel.fixedFrame = fixedFrame;
  channel.sequenceIndex = 0;
  channel.frameElapsedMs = 0;
  channel.targetVisible = true;
  const target = visual(definitionId, currentFrame(channel));
  if (channel.renderedVisual && channel.sprite.visible) beginCrossfade(channel, channel.renderedVisual, target);
  else {
    channel.frameTransition = null;
    channel.renderedVisual = target;
    renderStaticVisual(channel, target);
  }
  channel.sprite.setVisible(true);
}

function updateChannel(channel, deltaMs, cameraZoom) {
  const direction = channel.targetVisible ? 1 : -1;
  channel.visibility = clamp(channel.visibility + direction * deltaMs / SCALE_TRANSITION_MS, 0, 1);
  if (!channel.definitionId) return;
  if (!channel.targetVisible && channel.visibility === 0) {
    channel.sprite.setVisible(false);
    channel.definitionId = null;
    channel.renderedVisual = null;
    return;
  }
  if (channel.frameTransition) updateCrossfade(channel, deltaMs);
  else {
    const definition = ASSETS[channel.definitionId];
    if (channel.fixedFrame === null && definition.sequence.length > 1) updateFlipbookFrame(channel, definition, deltaMs);
  }
  channel.sprite.setAlpha(channel.visibility);
  applyChannelDisplaySize(channel, cameraZoom);
}

function updateFlipbookFrame(channel, definition, deltaMs) {
  channel.frameElapsedMs += deltaMs;
  if (channel.frameElapsedMs < definition.holdMs) return;
  channel.frameElapsedMs %= definition.holdMs;
  const targetSequenceIndex = (channel.sequenceIndex + 1) % definition.sequence.length;
  const from = visual(channel.definitionId, definition.sequence[channel.sequenceIndex] ?? 0);
  const to = visual(channel.definitionId, definition.sequence[targetSequenceIndex] ?? 0);
  channel.sequenceIndex = targetSequenceIndex;
  beginCrossfade(channel, from, to);
}

function beginCrossfade(channel, from, to) {
  if (sameVisual(from, to)) {
    channel.renderedVisual = to;
    renderStaticVisual(channel, to);
    return;
  }
  channel.frameTransition = { elapsedMs: 0, from, to };
  renderCrossfade(channel, from, to, 0);
}

function updateCrossfade(channel, deltaMs) {
  const transition = channel.frameTransition;
  transition.elapsedMs = Math.min(CROSSFADE_MS, transition.elapsedMs + deltaMs);
  const mix = transition.elapsedMs / CROSSFADE_MS;
  renderCrossfade(channel, transition.from, transition.to, mix);
  if (transition.elapsedMs < CROSSFADE_MS) return;
  channel.renderedVisual = transition.to;
  channel.frameTransition = null;
  renderStaticVisual(channel, channel.renderedVisual);
}

function renderStaticVisual(channel, entry) {
  const metrics = visualMetrics(channel.scene, entry);
  resizeChannelCanvas(channel, metrics.displayWidth, metrics.displayHeight);
  const context = channel.canvasTexture.context;
  context.clearRect(0, 0, channel.canvasTexture.width, channel.canvasTexture.height);
  drawVisual(channel.scene, context, entry, metrics, channel.displayWidth, channel.displayHeight, 1, "source-over");
  drawChannelOverlay(channel, context);
  channel.canvasTexture.refresh();
  applyChannelDisplaySize(channel);
}

function renderCrossfade(channel, from, to, mix) {
  const fromMetrics = visualMetrics(channel.scene, from);
  const toMetrics = visualMetrics(channel.scene, to);
  const displayWidth = Math.max(fromMetrics.displayWidth, toMetrics.displayWidth);
  const displayHeight = Math.max(fromMetrics.displayHeight, toMetrics.displayHeight);
  resizeChannelCanvas(channel, displayWidth, displayHeight);
  const context = channel.canvasTexture.context;
  context.clearRect(0, 0, channel.canvasTexture.width, channel.canvasTexture.height);
  drawVisual(channel.scene, context, from, fromMetrics, displayWidth, displayHeight, 1 - mix, "source-over");
  drawVisual(channel.scene, context, to, toMetrics, displayWidth, displayHeight, mix, "lighter");
  drawChannelOverlay(channel, context);
  channel.canvasTexture.refresh();
  applyChannelDisplaySize(channel);
}

function applyChannelDisplaySize(channel, requestedZoom = null) {
  const fallbackZoom = (Number(channel.scene.cameras.main?.zoom) || 1) / PRESENTATION_DENSITY;
  const cameraZoom = Math.max(0.01, Number(requestedZoom ?? fallbackZoom) || 1);
  const transitionScale = 0.76 + 0.24 * channel.visibility;
  channel.sprite.setDisplaySize(
    channel.displayWidth * transitionScale / cameraZoom,
    channel.displayHeight * transitionScale / cameraZoom,
  );
}

function resizeChannelCanvas(channel, displayWidth, displayHeight) {
  channel.displayWidth = displayWidth;
  channel.displayHeight = displayHeight;
  const width = Math.max(1, Math.ceil(displayWidth * PIXEL_DENSITY));
  const height = Math.max(1, Math.ceil(displayHeight * PIXEL_DENSITY));
  if (channel.canvasTexture.width !== width || channel.canvasTexture.height !== height) {
    channel.canvasTexture.setSize(width, height);
    channel.sprite.setSizeToFrame?.().updateDisplayOrigin?.();
  }
}

function drawVisual(scene, context, entry, metrics, canvasWidth, canvasHeight, alpha, compositeOperation) {
  const x = (canvasWidth - metrics.displayWidth) * PIXEL_DENSITY / 2;
  const y = (canvasHeight - metrics.displayHeight) * PIXEL_DENSITY / 2;
  drawTextureFrame(
    scene,
    context,
    ASSETS[entry.definitionId].key,
    frameName(entry.frame),
    x,
    y,
    metrics.displayWidth * PIXEL_DENSITY,
    metrics.displayHeight * PIXEL_DENSITY,
    alpha,
    compositeOperation,
  );
}

function drawChannelOverlay(channel, context) {
  if (!channel.overlay) return;
  const size = UI_THOUGHT_ICON_SIZE * PIXEL_DENSITY;
  const x = (channel.canvasTexture.width - size) / 2;
  const y = (channel.canvasTexture.height - size) / 2 + THOUGHT_ICON_SCREEN_OFFSET_Y * PIXEL_DENSITY;
  drawTextureFrame(
    channel.scene,
    context,
    channel.overlay.textureKey,
    channel.overlay.frame,
    x,
    y,
    size,
    size,
    1,
    "source-over",
  );
}

function drawTextureFrame(scene, context, textureKey, frameNameOrIndex, x, y, width, height, alpha, compositeOperation) {
  const texture = scene.textures.get(textureKey);
  const frame = texture?.get?.(frameNameOrIndex);
  const source = texture?.getSourceImage?.();
  if (!frame || !source) return;
  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.globalAlpha = clamp(alpha, 0, 1);
  context.globalCompositeOperation = compositeOperation;
  context.drawImage(
    source,
    frame.cutX,
    frame.cutY,
    frame.cutWidth,
    frame.cutHeight,
    Math.round(x),
    Math.round(y),
    Math.max(1, Math.round(width)),
    Math.max(1, Math.round(height)),
  );
  context.restore();
}

function visualMetrics(scene, entry) {
  const definition = ASSETS[entry.definitionId];
  const frame = scene.textures.get(definition.key).get(frameName(entry.frame));
  const sourceWidth = Math.max(1, Number(frame?.cutWidth) || 1);
  const sourceHeight = Math.max(1, Number(frame?.cutHeight) || 1);
  return {
    displayWidth: definition.displayWidth,
    displayHeight: definition.displayWidth * sourceHeight / sourceWidth,
  };
}

function currentFrame(channel) {
  if (!channel.definitionId) return 0;
  if (channel.fixedFrame !== null) return channel.fixedFrame;
  return ASSETS[channel.definitionId].sequence[channel.sequenceIndex] ?? 0;
}

function visual(definitionId, frame) {
  return { definitionId, frame };
}

function sameVisual(left, right) {
  return left?.definitionId === right?.definitionId && left?.frame === right?.frame;
}

function placeChannel(channel, x, y, { originY = 0.5 } = {}) {
  channel.sprite.setPosition(x, y).setDepth(channel.depth).setOrigin(0.5, originY);
}

function worldToUi(camera, position) {
  const view = camera?.worldView ?? { x: 0, y: 0 };
  const zoom = Math.max(0.01, Number(camera?.zoom) || 1);
  return {
    x: (Number(camera?.x || 0) + (Number(position.x) - Number(view.x || 0)) * zoom) / PRESENTATION_DENSITY,
    y: (Number(camera?.y || 0) + (Number(position.y) - Number(view.y || 0)) * zoom) / PRESENTATION_DENSITY,
  };
}

function drawProgress(graphics, value, x, y, radius, alpha, cameraZoom = 1) {
  graphics.clear();
  if (value === null || alpha <= 0) return;
  const inverseZoom = 1 / Math.max(0.01, cameraZoom);
  graphics.lineStyle(3 * inverseZoom, 0x241a20, 0.82 * alpha)
    .arc(x, y, radius * inverseZoom, -Math.PI / 2, Math.PI * 1.5, false);
  graphics.lineStyle(2 * inverseZoom, 0xf6d365, alpha)
    .arc(x, y, radius * inverseZoom, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * value, false);
}

function roundedPoint(position) {
  return position ? { x: Math.round(position.x), y: Math.round(position.y) } : null;
}

function iconScreenPositionFor(camera, thoughtSprite) {
  const position = worldToUi(camera, thoughtSprite);
  return { x: position.x, y: position.y + THOUGHT_ICON_SCREEN_OFFSET_Y };
}

function pointerWithinIcon(pointer, position, size) {
  if (!pointer || !position) return false;
  const halfSize = size / 2;
  return Math.abs(Number(pointer.x) / PRESENTATION_DENSITY - position.x) <= halfSize
    && Math.abs(Number(pointer.y) / PRESENTATION_DENSITY - position.y) <= halfSize;
}

function frameName(frame) {
  return `nb-frame-${Math.max(0, Number(frame) || 0)}`;
}

function isFading(channel) {
  return Boolean(channel.frameTransition) || (channel.visibility > 0 && channel.visibility < 1);
}

function nextCanvasTextureKey(name) {
  canvasTextureSequence += 1;
  return `overhead.ui.${name}.${canvasTextureSequence}`;
}

function removeCanvasTexture(scene, textureKey) {
  if (scene.textures.exists(textureKey)) scene.textures.remove(textureKey);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
