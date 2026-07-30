export function aggregateTransientNumber(active, {
  key,
  amount,
  nowMs,
  ...metadata
}, durationMs) {
  const previous = active.get(key);
  const timestamp = Number(nowMs) || 0;
  const next = {
    ...metadata,
    key,
    amount: (previous?.amount ?? 0) + Math.max(1, Math.floor(Number(amount) || 1)),
    startedAtMs: timestamp,
    expiresAtMs: timestamp + durationMs,
  };
  active.set(key, next);
  return next;
}

export function restartTransientNumberTween(scene, {
  text,
  start,
  end,
  holdMs,
  dropMs,
  onComplete,
}) {
  scene.tweens.killTweensOf(text);
  text.setPosition(Math.round(start.x), Math.round(start.y)).setAlpha(1).setVisible(true);
  scene.tweens.add({
    targets: text,
    x: Math.round(end.x),
    y: Math.round(end.y),
    alpha: 0,
    delay: holdMs,
    duration: dropMs,
    ease: "Linear",
    onComplete,
  });
  return text;
}
