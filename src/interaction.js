function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertFiniteNumber(value, label) {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
}

function cloneJsonLike(value, label, active = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`${label} must contain only finite JSON numbers`);
    }
    return value;
  }
  if (value === undefined || typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    throw new Error(`${label} must be JSON-serializable`);
  }
  if (active.has(value)) {
    throw new Error(`${label} must not contain circular references`);
  }

  active.add(value);
  try {
    if (Array.isArray(value)) {
      const clone = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          throw new Error(`${label} must not contain sparse arrays`);
        }
        clone.push(cloneJsonLike(value[index], label, active));
      }
      return clone;
    }

    if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length > 0) {
      throw new Error(`${label} must contain only plain objects, arrays and JSON primitives`);
    }

    const clone = {};
    for (const [key, child] of Object.entries(value)) {
      Object.defineProperty(clone, key, {
        value: cloneJsonLike(child, label, active),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return clone;
  } finally {
    active.delete(value);
  }
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

function assertPlainSerializablePayload(payload) {
  if (payload === undefined) {
    return {};
  }
  if (!isPlainObject(payload)) {
    throw new Error("Interaction payload must be a plain serializable object");
  }
  return cloneJsonLike(payload, "Interaction payload");
}

export function createInteractionTarget(options) {
  const id = options?.id;
  const entityId = options?.entityId;
  const kind = options?.kind;
  const position = options?.position;
  const radius = options?.radius;
  const priority = options?.priority ?? 0;
  const requiresFacing = options?.requiresFacing ?? true;
  const facingDotThreshold = options?.facingDotThreshold ?? 0;
  const prompt = options?.prompt;
  const payload = assertPlainSerializablePayload(options?.payload);
  const availabilityDistance = options?.availabilityDistance;
  const explicitAimPosition = options?.aimPosition;
  const aimPosition = explicitAimPosition ?? position;
  const targetingMode = options?.targetingMode ?? "priority-distance";
  const targetingGroup = options?.targetingGroup ?? null;

  assertNonEmptyString(id, "Interaction target ID");
  assertNonEmptyString(entityId, "Interaction entity ID");
  assertNonEmptyString(kind, "Interaction kind");
  if (!isPlainObject(position)) {
    throw new Error("Interaction position must be a plain object");
  }
  assertFiniteNumber(position.x, "Interaction position x");
  assertFiniteNumber(position.y, "Interaction position y");
  if (!isPlainObject(aimPosition)) throw new Error("Interaction aim position must be a plain object");
  assertFiniteNumber(aimPosition.x, "Interaction aim position x");
  assertFiniteNumber(aimPosition.y, "Interaction aim position y");
  assertFiniteNumber(radius, "Interaction radius");
  if (radius <= 0) {
    throw new Error("Interaction radius must be greater than 0");
  }
  assertFiniteNumber(priority, "Interaction priority");
  if (typeof requiresFacing !== "boolean") {
    throw new Error("Interaction requiresFacing must be a boolean");
  }
  assertFiniteNumber(facingDotThreshold, "Interaction facingDotThreshold");
  if (facingDotThreshold < -1 || facingDotThreshold > 1) {
    throw new Error("Interaction facingDotThreshold must be between -1 and 1");
  }
  assertNonEmptyString(prompt, "Interaction prompt");
  if (availabilityDistance !== undefined) assertFiniteNumber(availabilityDistance, "Interaction availability distance");
  if (!["priority-distance", "facing-first"].includes(targetingMode)) throw new Error("Interaction targetingMode is invalid");
  if (targetingGroup !== null) assertNonEmptyString(targetingGroup, "Interaction targeting group");

  const target = {
    id,
    entityId,
    kind,
    position: { x: position.x, y: position.y },
    radius,
    priority,
    requiresFacing,
    facingDotThreshold,
    prompt,
    payload,
    targetingMode,
    targetingGroup,
  };
  if (explicitAimPosition !== undefined) target.aimPosition = { x: aimPosition.x, y: aimPosition.y };
  if (availabilityDistance !== undefined) target.availabilityDistance = availabilityDistance;
  return deepFreeze(target);
}

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y);
  if (length === 0) {
    return null;
  }
  return { x: vector.x / length, y: vector.y / length };
}

function facingDot(source, target) {
  const aimPosition = target.aimPosition ?? target.position;
  const direction = normalize({
    x: aimPosition.x - source.position.x,
    y: aimPosition.y - source.position.y,
  });
  const facing = normalize(source.facingDirection);
  return direction && facing ? direction.x * facing.x + direction.y * facing.y : null;
}

function isAvailable(source, target, distance, aimDot) {
  if (source.id === target.entityId || distance > target.radius) {
    return false;
  }
  const aimPosition = target.aimPosition ?? target.position;
  const aimDistance = Math.hypot(
    aimPosition.x - source.position.x,
    aimPosition.y - source.position.y,
  );
  if (!target.requiresFacing || aimDistance === 0) {
    return true;
  }
  return aimDot !== null && aimDot >= target.facingDotThreshold;
}

export function findBestInteractionTarget(sourceSnapshot, targets) {
  let best = null;
  for (const target of targets) {
    const dx = target.position.x - sourceSnapshot.position.x;
    const dy = target.position.y - sourceSnapshot.position.y;
    const distance = target.availabilityDistance ?? Math.hypot(dx, dy);
    const aimDot = facingDot(sourceSnapshot, target);
    if (!isAvailable(sourceSnapshot, target, distance, aimDot)) {
      continue;
    }

    const candidate = {
      targetId: target.id,
      entityId: target.entityId,
      kind: target.kind,
      prompt: target.prompt,
      payload: cloneJsonLike(target.payload, "Interaction payload"),
      distance,
      aimDot: aimDot ?? -1,
      targetingMode: target.targetingMode,
      targetingGroup: target.targetingGroup,
    };

    if (!best || isBetterCandidate(candidate, target.priority, best)) {
      best = { ...candidate, priority: target.priority };
    }
  }

  if (!best) {
    return null;
  }
  const { priority, aimDot, targetingMode, targetingGroup, ...snapshot } = best;
  return snapshot;
}

function isBetterCandidate(candidate, priority, best) {
  const sharedFacingGroup = candidate.targetingMode === "facing-first"
    && best.targetingMode === "facing-first"
    && candidate.targetingGroup !== null
    && candidate.targetingGroup === best.targetingGroup;
  if (sharedFacingGroup && candidate.aimDot !== best.aimDot) return candidate.aimDot > best.aimDot;
  if (priority !== best.priority) return priority > best.priority;
  if (candidate.distance !== best.distance) return candidate.distance < best.distance;
  return candidate.targetId < best.targetId;
}
