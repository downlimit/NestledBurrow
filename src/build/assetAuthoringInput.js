const AUTHORING_ARROW_KEYS = Object.freeze({
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  a: "ArrowLeft",
  d: "ArrowRight",
  w: "ArrowUp",
  s: "ArrowDown",
});

export function toAuthoringArrowKey(key) {
  const source = String(key ?? "");
  return AUTHORING_ARROW_KEYS[source] ?? AUTHORING_ARROW_KEYS[source.toLowerCase()] ?? null;
}

export function createAuthoringArrowEvent(event) {
  const key = toAuthoringArrowKey(event?.key);
  if (!key) return null;
  return {
    key,
    ctrlKey: Boolean(event?.ctrlKey),
    altKey: Boolean(event?.altKey),
    shiftKey: Boolean(event?.shiftKey),
    metaKey: Boolean(event?.metaKey),
    repeat: Boolean(event?.repeat),
    preventDefault: () => event?.preventDefault?.(),
    stopPropagation: () => event?.stopPropagation?.(),
    stopImmediatePropagation: () => event?.stopImmediatePropagation?.(),
  };
}

export function authoringArrowDelta(key) {
  return {
    ArrowLeft: Object.freeze({ x: -1, y: 0 }),
    ArrowRight: Object.freeze({ x: 1, y: 0 }),
    ArrowUp: Object.freeze({ x: 0, y: -1 }),
    ArrowDown: Object.freeze({ x: 0, y: 1 }),
  }[toAuthoringArrowKey(key)] ?? null;
}
