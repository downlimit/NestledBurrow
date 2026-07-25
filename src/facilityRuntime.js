import { FACILITIES, getFacility } from "./facilityConfig.js";

export function createFacilityRuntime(scene, { worldLayout }) {
  const visuals = new Map();
  let activeFacilityId = null;
  let destroyed = false;
  for (const facility of FACILITIES) {
    if (worldLayout.isBlockedBox({ left: facility.usePosition.x - 2, right: facility.usePosition.x + 2, top: facility.usePosition.y - 2, bottom: facility.usePosition.y + 2 })) throw new Error(`Facility ${facility.id} use position must remain walkable`);
    const bounds = { left: facility.footprint.x, right: facility.footprint.x + facility.footprint.width, top: facility.footprint.y, bottom: facility.footprint.y + facility.footprint.height };
    worldLayout.setWorldObjectCollider(facility.id, bounds);
    const image = scene.add.image(facility.visual.x, facility.visual.y, facility.visual.key).setOrigin(0, 0).setDepth(500 + facility.visual.y + facility.visual.height);
    visuals.set(facility.id, image);
  }
  return {
    getInteractionDefinitions() { if (destroyed) return []; if (!activeFacilityId) return FACILITIES; const facility = getFacility(activeFacilityId); return [{ ...facility, prompt: facility.stopPrompt }]; },
    toggle(facilityId, playerMotor) {
      const facility = getFacility(facilityId);
      if (!facility || destroyed) return { status: "unknown-facility", mutated: false };
      if (activeFacilityId === facilityId) { activeFacilityId = null; return { status: "stopped", mutated: false }; }
      if (activeFacilityId) return { status: "busy", mutated: false };
      activeFacilityId = facilityId;
      playerMotor.movement.velocity.x = 0; playerMotor.movement.velocity.y = 0;
      return { status: "started", mutated: false, facilityType: facility.facilityType };
    },
    stop() { const stopped = activeFacilityId; activeFacilityId = null; return stopped; },
    getActiveType() { return activeFacilityId ? getFacility(activeFacilityId)?.facilityType ?? null : null; },
    getActiveId() { return activeFacilityId; },
    getPresentationPose() { return activeFacilityId ? getFacility(activeFacilityId)?.presentationPose ?? null : null; },
    isUsing() { return activeFacilityId !== null; },
    destroy() { if (destroyed) return; destroyed = true; activeFacilityId = null; for (const [id, image] of visuals) { image.destroy(); worldLayout.clearWorldObjectCollider(id); } visuals.clear(); },
  };
}
