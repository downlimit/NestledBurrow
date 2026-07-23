import { DEBRIS_OBJECT } from "./debrisConfig.js";
import { TILE_SIZE } from "./worldConfig.js";

export function createDebrisRuntime(scene, { sessionState, worldLayout }) {
  let graphics = null;
  let destroyed = false;
  const debrisId = DEBRIS_OBJECT.id;
  const cellKey = `${DEBRIS_OBJECT.tile.x},${DEBRIS_OBJECT.tile.y}`;

  function isPresent() {
    return !destroyed && !sessionState.gameplay.debris[debrisId]?.cleared;
  }

  function createVisual() {
    if (!isPresent() || graphics) return;
    worldLayout.blocked.add(cellKey);
    graphics = scene.add.graphics().setDepth(500 + (DEBRIS_OBJECT.tile.y + 1) * TILE_SIZE);
    drawLog(graphics, DEBRIS_OBJECT.tile.x * TILE_SIZE, DEBRIS_OBJECT.tile.y * TILE_SIZE);
  }

  function clearWithFeedback(onComplete = () => {}) {
    if (!graphics) {
      worldLayout.blocked.delete(cellKey);
      onComplete();
      return;
    }
    worldLayout.blocked.delete(cellKey);
    scene.tweens.add({
      targets: graphics,
      x: { from: -1, to: 1 },
      alpha: 0,
      scaleY: 0.65,
      duration: 140,
      yoyo: false,
      ease: "Quad.easeOut",
      onComplete: () => {
        graphics?.destroy();
        graphics = null;
        onComplete();
      },
    });
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    worldLayout.blocked.delete(cellKey);
    graphics?.destroy();
    graphics = null;
  }

  createVisual();

  return {
    getInteractionDefinitions() { return isPresent() ? [DEBRIS_OBJECT] : []; },
    isPresent,
    clearWithFeedback,
    destroy,
  };
}

function drawLog(graphics, x, y) {
  graphics.fillStyle(0x3d2517, 1).fillRect(x + 2, y + 6, 12, 5);
  graphics.fillStyle(0x6f3f22, 1).fillRect(x + 3, y + 5, 10, 2).fillRect(x + 3, y + 10, 10, 2);
  graphics.fillStyle(0x9b6337, 1).fillRect(x + 2, y + 6, 2, 5).fillRect(x + 12, y + 6, 2, 5);
  graphics.fillStyle(0xd49a55, 1).fillRect(x + 3, y + 7, 1, 2).fillRect(x + 12, y + 7, 1, 2);
  graphics.fillStyle(0x2f6b2f, 1).fillRect(x + 6, y + 3, 2, 3).fillRect(x + 9, y + 11, 2, 2);
}
