const ZERO_VECTOR = Object.freeze({ x: 0, y: 0 });
const DEFAULT_ACTIONS = Object.freeze({
  interact: false,
  primary: false,
  secondary: false,
});

export function createControllerCommand(command = {}) {
  return {
    moveDirection: sanitizeVector(command?.moveDirection, ZERO_VECTOR),
    aimDirection: command?.aimDirection == null ? null : sanitizeVector(command.aimDirection, ZERO_VECTOR),
    actions: {
      interact: Boolean(command?.actions?.interact),
      primary: Boolean(command?.actions?.primary),
      secondary: Boolean(command?.actions?.secondary),
    },
  };
}

export function idleControllerCommand() {
  return createControllerCommand({ actions: DEFAULT_ACTIONS });
}

function sanitizeVector(vector, fallback) {
  if (vector == null) return { ...fallback };
  return {
    x: Number.isFinite(vector.x) ? vector.x : fallback.x,
    y: Number.isFinite(vector.y) ? vector.y : fallback.y,
  };
}
