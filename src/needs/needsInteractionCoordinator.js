import { createInteractionTimelineRuntime, INTERACTION_PHASE } from "./interactionTimelineRuntime.js";
import { createToiletAccidentTimelineRuntime } from "./toiletAccidentTimelineRuntime.js";

const APPROACH_PHASE = "approach";
const ARRIVAL_RADIUS = 1.5;
const BLOCKED_CANCEL_MS = 800;

export function createNeedsInteractionCoordinator({
  facilityRuntime,
  debrisRuntime,
  getPlayer,
  startSleep,
  stopSleep,
  isSleeping = () => false,
  toiletAccidentTuning,
  onToiletAccident = () => {},
  onToiletAccidentRecovery = () => {},
  refresh = () => {},
} = {}) {
  let approach = null;
  let pendingCollapse = false;
  let pendingToiletAccident = null;
  const timeline = createInteractionTimelineRuntime({
    getPresentationPosition: () => ({ x: getPlayer().sprite.x, y: getPlayer().sprite.y, originX: getPlayer().sprite.originX, originY: getPlayer().sprite.originY }),
    getMotorPosition: () => getPlayer().motor.position,
    setPresentationPose: (pose) => getPlayer().visual.setPresentationPose(pose),
  });
  const accidentTimeline = createToiletAccidentTimelineRuntime({
    tuning: toiletAccidentTuning,
    getBasePose: () => ({
      ...getPlayer().motor.position,
      facing: getPlayer().visual.lastFacing ?? "down",
      originX: 0.5,
      originY: 1,
    }),
    setPresentationPose: (pose) => getPlayer().visual.setPresentationPose(pose),
    onPuddle: (event) => onToiletAccident(event),
    onRecoveryProgress: (progress) => onToiletAccidentRecovery(progress),
    onComplete: completeAccidentTransition,
  });

  function useFacility(facilityId, interaction = {}) {
    const current = getState();
    if (current.metadata?.kind === "facility" && current.metadata.id === facilityId) return exit("normal");
    const facility = facilityRuntime.getDefinition(facilityId);
    if (!facility || !["shower", "toilet", "table"].includes(facility.facilityType)) return { status: "ignored", mutated: false };
    return beginApproach(interaction, {
      profileId: facility.facilityType,
      metadata: { kind: "facility", id: facilityId },
      targetPose: () => facility.facilityType === "table"
        ? facePoint(getPlayer().motor.position, facility.position)
        : facilityRuntime.getPresentationPose(facilityId),
      onActivate: () => {
        const activation = facilityRuntime.toggle(facilityId, getPlayer().motor);
        if (activation.status !== "started") timeline.requestExit("emergency");
      },
      onDeactivate: () => facilityRuntime.stop(),
    });
  }

  function useBed(bedId, interaction = {}) {
    const current = getState();
    if (current.metadata?.kind === "bed") return exit("normal");
    const bed = debrisRuntime.getBedDefinition(bedId);
    if (!bed) return { status: "unknown-bed", mutated: false };
    return beginApproach(interaction, {
      profileId: "bed",
      metadata: { kind: "bed", id: bed.id },
      targetPose: () => ({ x: bed.position.x, y: bed.position.y - 1, facing: "right", angle: -90, showSleepMarker: true }),
      onActivate: () => startSleep({ bedId: bed.id, presentationHandled: true }),
      onDeactivate: () => stopSleep({ presentationHandled: true }),
    });
  }

  function beginApproach(interaction, timelineOptions) {
    if (isLocked()) return { status: "busy", mutated: false };
    const point = interaction.approachPoint ?? getPlayer().motor.position;
    const path = Array.isArray(interaction.approachPath) && interaction.approachPath.length > 0
      ? interaction.approachPath.map((entry) => ({ x: Number(entry.x), y: Number(entry.y) }))
      : [{ x: Number(point.x), y: Number(point.y) }];
    approach = {
      path,
      waypointIndex: 0,
      point: { ...path.at(-1) },
      timelineOptions,
      movementDirection: { x: 0, y: 0 },
      previousPosition: { ...getPlayer().motor.position },
      lastDistance: Number.POSITIVE_INFINITY,
      blockedMs: 0,
    };
    stopMotor();
    refresh();
    return { status: "approaching", mutated: false, phase: APPROACH_PHASE, approachPoint: { ...approach.point } };
  }

  function update(deltaMs) {
    if (accidentTimeline.isLocked()) {
      const state = accidentTimeline.update(deltaMs);
      if (!accidentTimeline.isLocked() && pendingCollapse) {
        pendingCollapse = false;
        startSleep({ exhausted: true });
      }
      return state;
    }
    if (!approach) {
      timeline.update(deltaMs);
      tryStartPendingToiletAccident();
      return getState();
    }
    const waypoint = approach.path[approach.waypointIndex];
    const position = getPlayer().motor.position;
    const dx = waypoint.x - position.x;
    const dy = waypoint.y - position.y;
    const distance = Math.hypot(dx, dy);
    if (arrivedAtWaypoint(approach.previousPosition, position, waypoint)) {
      getPlayer().motor.position = { ...waypoint };
      approach.waypointIndex += 1;
      approach.blockedMs = 0;
      approach.lastDistance = Number.POSITIVE_INFINITY;
      approach.previousPosition = { ...waypoint };
      if (approach.waypointIndex >= approach.path.length) startTimelineAfterApproach();
      return getState();
    }
    approach.movementDirection = { x: dx / distance, y: dy / distance };
    const madeProgress = distance < approach.lastDistance - 0.05;
    approach.blockedMs = !madeProgress ? approach.blockedMs + Math.max(0, Number(deltaMs) || 0) : 0;
    approach.lastDistance = distance;
    approach.previousPosition = { ...position };
    if (approach.blockedMs >= BLOCKED_CANCEL_MS) cancelApproach();
    return getState();
  }

  function startTimelineAfterApproach() {
    const options = approach.timelineOptions;
    approach = null;
    stopMotor();
    timeline.begin({
      ...options,
      targetPose: options.targetPose(),
      onComplete: completeTransition,
    });
    refresh();
  }

  function collapse() {
    if (accidentTimeline.isLocked() || pendingToiletAccident) {
      pendingCollapse = true;
      return { status: "collapse-pending", mutated: false };
    }
    if (approach) {
      cancelApproach();
      return startSleep({ exhausted: true });
    }
    if (!timeline.isLocked()) return startSleep({ exhausted: true });
    if (pendingCollapse) return { status: "collapse-pending", mutated: false };
    pendingCollapse = true;
    timeline.requestExit("emergency");
    return { status: "emergency-exit", mutated: false };
  }

  function wake() {
    const state = timeline.getState();
    if (state.metadata?.kind === "bed" && state.phase === INTERACTION_PHASE.active) return exit("normal");
    return stopSleep();
  }

  function exit(priority = "normal") {
    if (accidentTimeline.isLocked() || pendingToiletAccident) return { status: "transition-locked", mutated: false, phase: getState().phase };
    if (!approach) {
      const result = timeline.requestExit(priority);
      refresh();
      return result;
    }
    if (priority !== "emergency") return { status: "approach-locked", mutated: false };
    cancelApproach();
    return { status: "approach-cancelled", mutated: false };
  }

  function cancelApproach() {
    approach = null;
    stopMotor();
    refresh();
  }

  function completeTransition() {
    refresh();
    if (tryStartPendingToiletAccident()) return;
    if (!pendingCollapse) return;
    pendingCollapse = false;
    startSleep({ exhausted: true });
  }

  function beginToiletAccident(event = {}) {
    if (accidentTimeline.isLocked() || pendingToiletAccident) return { status: "already-pending", mutated: false };
    pendingToiletAccident = { witnessed: Boolean(event.witnessed) };
    stopMotor();
    if (approach) cancelApproach();
    if (timeline.isLocked()) {
      timeline.requestExit("emergency");
      refresh();
      return { status: "waiting-for-safe-exit", mutated: false };
    }
    return tryStartPendingToiletAccident()
      ? { status: "started", mutated: false }
      : { status: "waiting-for-wake", mutated: false };
  }

  function tryStartPendingToiletAccident() {
    if (!pendingToiletAccident || approach || timeline.isLocked() || accidentTimeline.isLocked() || isSleeping()) return false;
    const event = pendingToiletAccident;
    pendingToiletAccident = null;
    stopMotor();
    accidentTimeline.begin(event);
    refresh();
    return true;
  }

  function completeAccidentTransition() {
    refresh();
  }

  function stopMotor() {
    const movement = getPlayer().motor.movement;
    movement.velocity.x = 0;
    movement.velocity.y = 0;
  }

  function getState() {
    if (accidentTimeline.isLocked()) return accidentTimeline.getState();
    if (pendingToiletAccident) return Object.freeze({
      phase: "toilet-accident-pending",
      profileId: "toilet-accident",
      protectedNeed: "toilet",
      metadata: null,
      effectActive: false,
      remainingMs: 0,
    });
    if (!approach) return timeline.getState();
    return Object.freeze({
      phase: APPROACH_PHASE,
      profileId: approach.timelineOptions.profileId,
      protectedNeed: null,
      metadata: approach.timelineOptions.metadata,
      effectActive: false,
      remainingMs: 0,
      approachPoint: Object.freeze({ ...approach.point }),
    });
  }

  function isLocked() {
    return Boolean(approach) || timeline.isLocked() || accidentTimeline.isLocked() || Boolean(pendingToiletAccident);
  }

  return Object.freeze({
    useFacility,
    useBed,
    collapse,
    beginToiletAccident,
    wake,
    update,
    exit,
    getState,
    getProtectedNeed: () => accidentTimeline.isLocked() || pendingToiletAccident ? "toilet" : approach ? null : timeline.getProtectedNeed(),
    getMovementDirection: () => approach ? { ...approach.movementDirection } : null,
    getApproachPoint: () => approach ? { ...approach.point } : null,
    isLocked,
    allowsInteraction(definition) {
      const state = getState();
      return state.phase === INTERACTION_PHASE.free
        || state.phase === INTERACTION_PHASE.active && definition?.id === state.metadata?.id;
    },
  });
}

function arrivedAtWaypoint(previous, current, waypoint) {
  if (Math.hypot(waypoint.x - current.x, waypoint.y - current.y) <= ARRIVAL_RADIUS) return true;
  const dx = current.x - previous.x;
  const dy = current.y - previous.y;
  const segmentLengthSquared = dx * dx + dy * dy;
  if (segmentLengthSquared === 0) return false;
  const fraction = Math.min(1, Math.max(0, (
    (waypoint.x - previous.x) * dx + (waypoint.y - previous.y) * dy
  ) / segmentLengthSquared));
  const closest = { x: previous.x + dx * fraction, y: previous.y + dy * fraction };
  return Math.hypot(waypoint.x - closest.x, waypoint.y - closest.y) <= ARRIVAL_RADIUS;
}

function facePoint(origin, target) {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  return { ...origin, facing: Math.abs(dx) >= Math.abs(dy) ? dx >= 0 ? "right" : "left" : dy >= 0 ? "down" : "up", angle: 0, originX: 0.5, originY: 1 };
}
