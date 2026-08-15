export function needValueFromTrackPointerX(trackX, trackWidth, pointerX) {
  const width = Number(trackWidth);
  const ratio = width > 0 ? (Number(pointerX) - Number(trackX)) / width : 0;
  return Math.round(Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0)) * 100);
}
