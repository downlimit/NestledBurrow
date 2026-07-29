import { drawCoinSprite } from "./coinVisual.js";

export function createCoinRuntime(scene, {
  getPlayerPosition,
  onCollect = () => {},
  playEffect = (type) => scene.audioRuntime?.playEffect?.(type),
}) {
  const coins = new Map();
  let nextId = 0;
  let destroyed = false;

  function spawn(origin) {
    if (destroyed) return null;
    const id = `guest-coin-${++nextId}`;
    const visual = scene.add.graphics().setDepth(800 + Math.round(origin.y));
    drawCoinSprite(visual);
    const coin = {
      id,
      visual,
      x: origin.x,
      y: origin.y - 18,
      floorY: origin.y - 1,
      velocityX: 18,
      velocityY: -44,
      landed: false,
    };
    visual.setPosition(coin.x, coin.y);
    coins.set(id, coin);
    return id;
  }

  function update(deltaMs) {
    if (destroyed) return;
    const deltaSeconds = Math.max(0, Number(deltaMs) || 0) / 1000;
    for (const coin of coins.values()) {
      if (!coin.landed) {
        coin.velocityY += 105 * deltaSeconds;
        coin.x += coin.velocityX * deltaSeconds;
        coin.y += coin.velocityY * deltaSeconds;
        if (coin.y >= coin.floorY) {
          coin.y = coin.floorY;
          coin.velocityX = 0;
          coin.velocityY = 0;
          coin.landed = true;
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
    onCollect({ id, position: { x: coin.x, y: coin.y } });
    return true;
  }

  return {
    spawn,
    update,
    getState: () => [...coins.values()].map((coin) => ({ id: coin.id, x: coin.x, y: coin.y, landed: coin.landed })),
    collect,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const coin of coins.values()) coin.visual.destroy();
      coins.clear();
    },
  };
}
