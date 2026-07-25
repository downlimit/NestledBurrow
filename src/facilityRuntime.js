import { FACILITIES, getFacility } from "./facilityConfig.js";

export function createFacilityRuntime(scene, { worldLayout }) {
  const visuals = new Map();
  let activeFacilityId = null;
  let destroyed = false;

  for (const facility of FACILITIES) {
    if (worldLayout.isBlockedBox({
      left: facility.usePosition.x - 2,
      right: facility.usePosition.x + 2,
      top: facility.usePosition.y - 2,
      bottom: facility.usePosition.y + 2,
    })) throw new Error(`Facility ${facility.id} use position must remain walkable`);
    worldLayout.setWorldObjectCollider(facility.id, {
      left: facility.footprint.x,
      right: facility.footprint.x + facility.footprint.width,
      top: facility.footprint.y,
      bottom: facility.footprint.y + facility.footprint.height,
    });
    const graphics = scene.add.graphics()
      .setPosition(facility.footprint.x, facility.footprint.y)
      .setDepth(500 + facility.position.y);
    drawFacility(graphics, facility.facilityType);
    visuals.set(facility.id, graphics);
  }

  return {
    getInteractionDefinitions() {
      if (destroyed) return [];
      if (!activeFacilityId) return FACILITIES;
      const facility = getFacility(activeFacilityId);
      return [{ ...facility, prompt: facility.stopPrompt }];
    },
    toggle(facilityId, playerMotor) {
      const facility = getFacility(facilityId);
      if (!facility || destroyed) return { status: "unknown-facility", mutated: false };
      if (activeFacilityId === facilityId) {
        activeFacilityId = null;
        return { status: "stopped", mutated: false };
      }
      if (activeFacilityId) return { status: "busy", mutated: false };
      activeFacilityId = facilityId;
      playerMotor.position = { ...facility.usePosition };
      playerMotor.movement.velocity.x = 0;
      playerMotor.movement.velocity.y = 0;
      return { status: "started", mutated: false, facilityType: facility.facilityType };
    },
    stop() {
      const stopped = activeFacilityId;
      activeFacilityId = null;
      return stopped;
    },
    getActiveType() {
      return activeFacilityId ? getFacility(activeFacilityId)?.facilityType ?? null : null;
    },
    getActiveId() {
      return activeFacilityId;
    },
    isUsing() {
      return activeFacilityId !== null;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      activeFacilityId = null;
      for (const [id, graphics] of visuals) {
        graphics.destroy();
        worldLayout.clearWorldObjectCollider(id);
      }
      visuals.clear();
    },
  };
}

function drawFacility(graphics, type) {
  if (type === "shower") {
    graphics.fillStyle(0x8db8c7, 0.35).fillRect(1, 1, 30, 30);
    graphics.lineStyle(2, 0xc8e4e8, 1).strokeRect(2, 2, 28, 28);
    graphics.fillStyle(0x5d7f89, 1).fillRect(14, 3, 3, 8).fillRect(11, 3, 8, 3);
    return;
  }
  if (type === "toilet") {
    graphics.fillStyle(0xe9e4d8, 1).fillRect(7, 5, 18, 8).fillRoundedRect(5, 13, 22, 15, 5);
    graphics.fillStyle(0x8db8c7, 0.8).fillEllipse(16, 19, 12, 7);
    return;
  }
  graphics.fillStyle(0x71472f, 1).fillRect(2, 8, 28, 15).fillRect(4, 23, 4, 8).fillRect(24, 23, 4, 8);
  graphics.fillStyle(0xd9c18f, 1).fillEllipse(16, 12, 15, 7);
  graphics.fillStyle(0xb54f45, 1).fillCircle(16, 10, 3);
}
