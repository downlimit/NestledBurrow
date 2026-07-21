export const PATROL_MODE_LOOP = "loop";
export const PATROL_MODE_PING_PONG = "ping-pong";

export const WAYPOINT_TOLERANCE = 4;
export const BLOCKED_WAYPOINT_ADVANCE_MS = 450;
const BLOCKED_SPEED_THRESHOLD = 1;
const IDLE_DIRECTION = Object.freeze({ x: 0, y: 0 });

export function createPlayerController({ getInputDirection }) {
  return {
    kind: "player",
    getDirection() {
      return getInputDirection();
    },
  };
}

export function createPatrolController({ waypoints, mode, tolerance = WAYPOINT_TOLERANCE }) {
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    throw new Error("Patrol routes need at least two waypoints");
  }
  if (![PATROL_MODE_LOOP, PATROL_MODE_PING_PONG].includes(mode)) {
    throw new Error(`Unknown patrol mode: ${mode}`);
  }

  let index = 1;
  let direction = 1;
  let blockedMs = 0;

  return {
    kind: "patrol",
    mode,
    get currentWaypointIndex() {
      return index;
    },
    getDirection(position, character, deltaMs) {
      const waypoint = waypoints[index];
      const dx = waypoint.x - position.x;
      const dy = waypoint.y - position.y;
      const distance = Math.hypot(dx, dy);
      const blocked = Boolean(character?.lastBlockedAxes?.x || character?.lastBlockedAxes?.y);
      const speed = character?.speed ?? 0;
      blockedMs = blocked && speed <= BLOCKED_SPEED_THRESHOLD ? blockedMs + deltaMs : 0;

      if (distance <= tolerance || blockedMs >= BLOCKED_WAYPOINT_ADVANCE_MS) {
        advanceWaypoint();
        blockedMs = 0;
      }

      const next = waypoints[index];
      const nextDx = next.x - position.x;
      const nextDy = next.y - position.y;
      const nextDistance = Math.hypot(nextDx, nextDy);
      if (nextDistance <= tolerance) return IDLE_DIRECTION;
      return { x: nextDx / nextDistance, y: nextDy / nextDistance };
    },
    advanceForTest: advanceWaypoint,
  };

  function advanceWaypoint() {
    if (mode === PATROL_MODE_LOOP) {
      index = (index + 1) % waypoints.length;
      return;
    }

    if (index === waypoints.length - 1) direction = -1;
    else if (index === 0) direction = 1;
    index += direction;
  }
}
