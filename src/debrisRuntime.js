import { BED_OBJECT, BED_WAKE_TILE, DEBRIS_OBJECTS, RUBY_OBJECTS } from "./debrisConfig.js";
import { TILE_SIZE } from "./worldConfig.js";
import { cellKey } from "./worldLayout.js";
import { drawLog, drawRuby } from "./resourceVisuals.js";

export function createDebrisRuntime(scene, { sessionState, worldLayout }) {
  const visuals = new Map();
  let bedGraphics = null;
  let sleepGraphics = null;
  let destroyed = false;

  function stateFor(definition) { return definition.kind === "mine-ruby" ? sessionState.gameplay.rubyNodes[definition.id] : sessionState.gameplay.debris[definition.id]; }
  function isPresent(definition) { return !destroyed && !stateFor(definition)?.cleared; }
  function key(definition) { return cellKey(definition.tile.x, definition.tile.y); }

  function createVisual(definition) {
    if (!isPresent(definition) || visuals.has(definition.id)) return;
    worldLayout.blocked.add(key(definition));
    const graphics = scene.add.graphics().setPosition(definition.tile.x * TILE_SIZE, definition.tile.y * TILE_SIZE).setDepth(500 + (definition.tile.y + 1) * TILE_SIZE);
    if (definition.kind === "mine-ruby") drawRuby(graphics, stateFor(definition)?.remainingHits ?? 5); else drawLog(graphics, stateFor(definition)?.remainingHits ?? 5);
    visuals.set(definition.id, graphics);
  }

  function redraw(definition) {
    const graphics = visuals.get(definition.id);
    if (!graphics) return;
    graphics.clear();
    if (definition.kind === "mine-ruby") drawRuby(graphics, stateFor(definition)?.remainingHits ?? 5); else drawLog(graphics, stateFor(definition)?.remainingHits ?? 5);
  }

  function hitWithFeedback(debrisId, result, onComplete = () => {}) {
    const definition = [...DEBRIS_OBJECTS, ...RUBY_OBJECTS].find((item) => item.id === debrisId);
    if (!definition) return onComplete();
    const graphics = visuals.get(debrisId);
    if (!graphics) return onComplete();
    redraw(definition);
    scene.tweens.add({ targets: graphics, x: { from: graphics.x - 2, to: graphics.x + 2 }, scaleY: 0.85, duration: 70, yoyo: true, repeat: 1, onComplete });
    if (result.status === "cleared") clearWithFeedback(debrisId, onComplete);
  }

  function clearWithFeedback(debrisId, onComplete = () => {}) {
    const definition = [...DEBRIS_OBJECTS, ...RUBY_OBJECTS].find((item) => item.id === debrisId);
    if (!definition) return onComplete();
    const graphics = visuals.get(debrisId);
    worldLayout.blocked.delete(key(definition));
    if (!graphics) return onComplete();
    scene.tweens.add({ targets: graphics, alpha: 0, scaleY: 0.55, duration: 160, ease: "Quad.easeOut", onComplete: () => { graphics.destroy(); visuals.delete(debrisId); onComplete(); } });
  }

  function createBed() {
    if (worldLayout.blocked.has(cellKey(BED_WAKE_TILE.x, BED_WAKE_TILE.y))) throw new Error("BED_WAKE_TILE must remain walkable");
    worldLayout.blocked.add(key(BED_OBJECT));
    bedGraphics = scene.add.graphics().setPosition(BED_OBJECT.tile.x * TILE_SIZE, BED_OBJECT.tile.y * TILE_SIZE).setDepth(500 + (BED_OBJECT.tile.y + 1) * TILE_SIZE);
    drawBed(bedGraphics);
  }

  function setSleeping(active) {
    if (active && !sleepGraphics) {
      sleepGraphics = scene.add.graphics().setDepth(900).setScrollFactor(0);
      sleepGraphics.fillStyle(0x1b2945, 0.8).fillRect(226, 36, 76, 22).lineStyle(1, 0xf2eadc, 0.9).strokeRect(226.5, 36.5, 75, 21).fillStyle(0xf2eadc, 1).fillRect(236, 43, 6, 6).fillRect(248, 41, 6, 6).fillRect(260, 39, 6, 6);
    } else if (!active && sleepGraphics) { sleepGraphics.destroy(); sleepGraphics = null; }
  }

  DEBRIS_OBJECTS.forEach(createVisual);
  RUBY_OBJECTS.forEach(createVisual);
  createBed();

  return {
    getInteractionDefinitions() { return [...DEBRIS_OBJECTS.filter(isPresent), ...RUBY_OBJECTS.filter(isPresent), BED_OBJECT]; },
    isPresent(id) { const definition = [...DEBRIS_OBJECTS, ...RUBY_OBJECTS].find((item) => item.id === (id ?? DEBRIS_OBJECTS[0].id)); return definition ? isPresent(definition) : false; },
    hitWithFeedback,
    clearWithFeedback,
    setSleeping,
    destroy() { destroyed = true; for (const graphics of visuals.values()) graphics.destroy(); visuals.clear(); bedGraphics?.destroy(); sleepGraphics?.destroy(); worldLayout.blocked.delete(key(BED_OBJECT)); for (const d of [...DEBRIS_OBJECTS, ...RUBY_OBJECTS]) worldLayout.blocked.delete(key(d)); },
  };
}

function drawBed(graphics) {
  graphics.fillStyle(0x5c3a2a, 1).fillRect(1, 3, 14, 10).fillStyle(0x315c8a, 1).fillRect(3, 5, 11, 7).fillStyle(0xf2eadc, 1).fillRect(3, 5, 4, 3).fillStyle(0x2b1d18, 1).fillRect(1, 13, 2, 2).fillRect(13, 13, 2, 2);
}
