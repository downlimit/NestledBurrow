import { BED_OBJECT, BED_WAKE_TILE } from "./debrisConfig.js";
import { PLACEMENT_CELL_SIZE, RESOURCE_OBJECTS } from "./resourceConfig.js";
import { getResourceProfile } from "./resourceDomain.js";
import { cellKey } from "./worldLayout.js";
import { drawResource } from "./resourceVisuals.js";

export function createDebrisRuntime(scene, { sessionState, worldLayout }) {
  const visuals = new Map();
  let bedGraphics = null;
  let destroyed = false;

  const stateFor = (definition) => sessionState.gameplay.resourceNodes[definition.id];
  const isPresent = (definition) => !destroyed && !stateFor(definition)?.cleared;
  const footprintKeys = (definition) => {
    const profile = getResourceProfile(definition.profileId);
    const keys = [];
    for (let y = 0; y < profile.footprint.height; y += 1) for (let x = 0; x < profile.footprint.width; x += 1) keys.push(cellKey(definition.cell.x + x, definition.cell.y + y));
    return keys;
  };
  const setBlocked = (definition, active) => {
    if (!active) return worldLayout.clearResourceCollider(definition.id);
    const profile = getResourceProfile(definition.profileId);
    const width = profile.footprint.width * PLACEMENT_CELL_SIZE;
    const height = profile.footprint.height * PLACEMENT_CELL_SIZE;
    const topInset = profile.collisionTopInset ?? 0;
    const leftInset = profile.collisionLeftInset ?? 0;
    const rightInset = profile.collisionRightInset ?? 0;
    worldLayout.setResourceCollider(definition.id, {
      left: definition.cell.x * PLACEMENT_CELL_SIZE + leftInset,
      right: definition.cell.x * PLACEMENT_CELL_SIZE + width - rightInset,
      top: definition.cell.y * PLACEMENT_CELL_SIZE + topInset,
      bottom: definition.cell.y * PLACEMENT_CELL_SIZE + height,
    });
  };

  function createVisual(definition) {
    if (!isPresent(definition) || visuals.has(definition.id)) return;
    setBlocked(definition, true);
    const profile = getResourceProfile(definition.profileId);
    const graphics = scene.add.graphics().setPosition(definition.cell.x * PLACEMENT_CELL_SIZE, definition.cell.y * PLACEMENT_CELL_SIZE).setDepth(500 + definition.position.y);
    drawResource(graphics, profile, stateFor(definition)?.progress ?? 0);
    visuals.set(definition.id, graphics);
  }

  function redraw(definition) {
    const graphics = visuals.get(definition.id);
    if (!graphics) return;
    graphics.setPosition(definition.cell.x * PLACEMENT_CELL_SIZE, definition.cell.y * PLACEMENT_CELL_SIZE);
    graphics.clear();
    drawResource(graphics, getResourceProfile(definition.profileId), stateFor(definition)?.progress ?? 0);
  }

  function hitWithFeedback(resourceId, result, onComplete = () => {}) {
    const definition = RESOURCE_OBJECTS.find((item) => item.id === resourceId);
    if (!definition) return onComplete();
    const graphics = visuals.get(resourceId);
    if (!graphics) return onComplete();
    redraw(definition);
    if (result.status === "cleared") return clearWithFeedback(resourceId, onComplete);
    const anchorX = definition.cell.x * PLACEMENT_CELL_SIZE;
    const anchorY = definition.cell.y * PLACEMENT_CELL_SIZE;
    scene.tweens.add({
      targets: graphics,
      x: { from: anchorX - 1, to: anchorX + 1 },
      duration: 60,
      yoyo: true,
      onComplete: () => { graphics.setPosition(anchorX, anchorY); onComplete(); },
    });
  }

  function clearWithFeedback(resourceId, onComplete = () => {}) {
    const definition = RESOURCE_OBJECTS.find((item) => item.id === resourceId);
    if (!definition) return onComplete();
    const graphics = visuals.get(resourceId);
    setBlocked(definition, false);
    if (!graphics) return onComplete();
    scene.tweens.add({ targets: graphics, alpha: 0, scaleY: 0.55, duration: 160, ease: "Quad.easeOut", onComplete: () => { graphics.destroy(); visuals.delete(resourceId); onComplete(); } });
  }

  function createBed() {
    if (worldLayout.isBlockedCell(BED_WAKE_TILE.x * 2, BED_WAKE_TILE.y * 2)) throw new Error("BED_WAKE_TILE must remain walkable");
    for (let y = 28; y < 30; y += 1) for (let x = 64; x < 66; x += 1) worldLayout.blocked.add(cellKey(x, y));
    bedGraphics = scene.add.graphics().setPosition(BED_OBJECT.position.x - 8, BED_OBJECT.position.y - 8).setDepth(500 + BED_OBJECT.position.y);
    drawBed(bedGraphics);
  }

  function setSleeping(_active) {}

  RESOURCE_OBJECTS.forEach(createVisual);
  createBed();

  return {
    getInteractionDefinitions() { return [...RESOURCE_OBJECTS.filter(isPresent), BED_OBJECT]; },
    isPresent(id) { const definition = RESOURCE_OBJECTS.find((item) => item.id === (id ?? RESOURCE_OBJECTS[0].id)); return definition ? isPresent(definition) : false; },
    getVisualState(id) {
      const graphics = visuals.get(id);
      return graphics ? { x: graphics.x, y: graphics.y } : null;
    },
    hitWithFeedback, clearWithFeedback, setSleeping,
    rebuild() { for (const graphics of visuals.values()) graphics.destroy(); visuals.clear(); RESOURCE_OBJECTS.forEach(createVisual); },
    destroy() { destroyed = true; for (const graphics of visuals.values()) graphics.destroy(); visuals.clear(); bedGraphics?.destroy(); for (const definition of RESOURCE_OBJECTS) setBlocked(definition, false); },
  };
}

function drawBed(graphics) {
  graphics.fillStyle(0x5c3a2a, 1).fillRect(1, 3, 14, 10).fillStyle(0x315c8a, 1).fillRect(3, 5, 11, 7).fillStyle(0xf2eadc, 1).fillRect(3, 5, 4, 3).fillStyle(0x2b1d18, 1).fillRect(1, 13, 2, 2).fillRect(13, 13, 2, 2);
}
