import { drawCoinSprite } from "./coinVisual.js";

export function createCoinRuntime(scene, {
  getPlayerPosition,
  onCollect = () => {},
  playEffect = (type) => scene.audioRuntime?.playEffect?.(type),
}) {
  const coins = new Map();
  let nextId = 0;
  let destroyed = false;

  function spawn(origin, value = 1, {
    direction = null,
    throwDistance = 28,
    throwStart = null,
  } = {}) {
    if (destroyed) return null;
    const id = `guest-coin-${++nextId}`;
    const visual = scene.add.graphics().setDepth(800 + Math.round(origin.y));
    drawCoinSprite(visual);
    const normalizedDirection = direction ? unitVector(direction) : null;
    const normalizedThrowStart = throwStart && Number.isFinite(Number(throwStart.x)) && Number.isFinite(Number(throwStart.y))
      ? { x: Number(throwStart.x), y: Number(throwStart.y) }
      : { x: Number(origin.x), y: Number(origin.y) - 2 };
    const coin = {
      id,
      value: normalizeCoinValue(value),
      visual,
      x: origin.x,
      y: origin.y - 18,
      floorY: origin.y - 1,
      velocityX: 18,
      velocityY: -44,
      landed: false,
      throw: normalizedDirection ? {
        elapsedMs: 0,
        durationMs: 320,
        startX: normalizedThrowStart.x,
        startY: normalizedThrowStart.y,
        targetX: normalizedThrowStart.x + normalizedDirection.x * throwDistance,
        targetY: normalizedThrowStart.y + normalizedDirection.y * throwDistance,
        arcHeight: 18,
      } : null,
    };
    if (coin.throw) {
      coin.x = coin.throw.startX;
      coin.y = coin.throw.startY;
      coin.floorY = coin.throw.targetY;
    }
    visual.setPosition(coin.x, coin.y);
    coins.set(id, coin);
    return id;
  }

  function update(deltaMs) {
    if (destroyed) return;
    const deltaSeconds = Math.max(0, Number(deltaMs) || 0) / 1000;
    for (const coin of coins.values()) {
      if (!coin.landed) {
        if (coin.throw) {
          coin.throw.elapsedMs += Math.max(0, Number(deltaMs) || 0);
          const t = Math.min(1, coin.throw.elapsedMs / coin.throw.durationMs);
          coin.x = lerp(coin.throw.startX, coin.throw.targetX, t);
          coin.y = lerp(coin.throw.startY, coin.throw.targetY, t) - Math.sin(Math.PI * t) * coin.throw.arcHeight;
          if (t >= 1) coin.landed = true;
        } else {
          coin.velocityY += 105 * deltaSeconds;
          coin.x += coin.velocityX * deltaSeconds;
          coin.y += coin.velocityY * deltaSeconds;
          if (coin.y >= coin.floorY) {
            coin.y = coin.floorY;
            coin.velocityX = 0;
            coin.velocityY = 0;
            coin.landed = true;
          }
        }
        coin.visual.setPosition(Math.round(coin.x), Math.round(coin.y)).setDepth(800 + Math.round(coin.y));
      }
      const player = getPlayerPosition();
      if (coin.landed && player && Math.hypot(player.x - coin.x, player.y - coin.y) <= 12) collect(coin.id);
    }
  }

  function collect(id) {
    const coin = coins.get(id);
    if (!coin) return false;
    coins.delete(id);
    coin.visual.destroy();
    playEffect("pickup");
    onCollect({ id, value: normalizeCoinValue(coin.value), position: { x: coin.x, y: coin.y } });
    return true;
  }

  return {
    spawn,
    update,
    getState: () => [...coins.values()].map((coin) => ({ id: coin.id, value: normalizeCoinValue(coin.value), x: coin.x, y: coin.y, landed: coin.landed })),
    collect,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const coin of coins.values()) coin.visual.destroy();
      coins.clear();
    },
  };
}

export function normalizeCoinValue(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
}

function unitVector(value) {
  const x = Number(value?.x) || 0;
  const y = Number(value?.y) || 0;
  const length = Math.hypot(x, y);
  return length > 0 ? { x: x / length, y: y / length } : { x: 1, y: 0 };
}

function lerp(from, to, t) {
  return from + (to - from) * t;
}
