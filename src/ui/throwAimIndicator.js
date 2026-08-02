import { worldDepthFromAnchorY } from "../build/buildWorldGeometry.js";
import { throwDirectionTowardPoint, throwOriginFromPlayer } from "../inventory/worldThrowDirection.js";

export const THROW_AIM_SIZE = 8;
export const THROW_AIM_RADIUS = 12;

export function throwAimPose(player, target, fallbackFacing = "down", radius = THROW_AIM_RADIUS) {
  const pivot = throwOriginFromPlayer(player);
  const direction = throwDirectionTowardPoint(pivot, target, fallbackFacing);
  return {
    x: Math.round(pivot.x + direction.x * radius),
    y: Math.round(pivot.y + direction.y * radius),
    rotation: Math.atan2(direction.y, direction.x),
    direction,
    pivot,
  };
}

export function throwAimPixels(direction, size = THROW_AIM_SIZE) {
  const half = size / 2;
  const outer = [];
  const keys = new Set();
  for (let y = -half; y < half; y += 1) {
    for (let x = -half; x < half; x += 1) {
      const centerX = x + 0.5;
      const centerY = y + 0.5;
      const axial = centerX * direction.x + centerY * direction.y;
      const lateral = Math.abs(-centerX * direction.y + centerY * direction.x);
      if (axial < -half || axial > half || lateral > Math.max(0.5, (half - axial) * 0.5)) continue;
      outer.push({ x, y });
      keys.add(`${x},${y}`);
    }
  }
  return outer.map((pixel) => ({
    ...pixel,
    inner: [
      `${pixel.x - 1},${pixel.y}`,
      `${pixel.x + 1},${pixel.y}`,
      `${pixel.x},${pixel.y - 1}`,
      `${pixel.x},${pixel.y + 1}`,
    ].every((key) => keys.has(key)),
  }));
}

export function createThrowAimIndicator(scene, {
  getPlayerCharacter = () => scene.playerCharacter ?? null,
} = {}) {
  const graphics = scene.add.graphics().setVisible(false);

  let target = null;
  let lastPose = null;

  function update() {
    if (!target) return;
    const character = getPlayerCharacter?.();
    const sprite = character?.sprite;
    if (!sprite) {
      hide();
      return;
    }
    const pose = throwAimPose(sprite, target, character.lastFacing);
    const pixels = throwAimPixels(pose.direction);
    graphics.clear().fillStyle(0x2f2327, 1);
    pixels.forEach(({ x, y }) => graphics.fillRect(x, y, 1, 1));
    graphics.fillStyle(0xfff3a6, 1);
    pixels.filter(({ inner }) => inner).forEach(({ x, y }) => graphics.fillRect(x, y, 1, 1));
    lastPose = pose;
    graphics
      .setPosition(pose.x, pose.y)
      .setRotation(0)
      .setDepth(worldDepthFromAnchorY(sprite.y, "throw-aim", 499))
      .setVisible(true);
  }

  function show(nextTarget) {
    if (!nextTarget) {
      hide();
      return;
    }
    target = { x: Number(nextTarget.x), y: Number(nextTarget.y) };
    update();
  }

  function hide() {
    target = null;
    lastPose = null;
    graphics.setVisible(false);
  }

  scene.events.on("update", update);

  return {
    show,
    hide,
    getState: () => ({
      visible: graphics.visible,
      x: graphics.x,
      y: graphics.y,
      rotation: lastPose?.rotation ?? 0,
      pivot: lastPose?.pivot ?? null,
      size: THROW_AIM_SIZE,
      radius: THROW_AIM_RADIUS,
      target,
    }),
    destroy() {
      hide();
      scene.events.off("update", update);
      graphics.destroy();
    },
  };
}
