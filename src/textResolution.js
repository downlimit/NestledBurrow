const managedTextByScene = new WeakMap();
const sceneListeners = new WeakMap();

export function getIntegerTextResolution(scene) {
  const scale = scene?.scale;
  const zoom = Number(scale?.zoom ?? scale?.displayScale?.x ?? 1);
  return Math.max(1, Math.trunc(Number.isFinite(zoom) ? zoom : 1));
}

export function createManagedText(scene, x, y, text, style = {}) {
  installTextResolutionRefresh(scene);
  const textObject = scene.add.text(Math.trunc(x), Math.trunc(y), text, withTextResolution(scene, style));
  registerManagedText(scene, textObject);
  return refreshTextResolution(textObject, scene);
}

export function setManagedTextStyle(textObject, scene, style) {
  textObject.setStyle(withTextResolution(scene, style));
  return refreshTextResolution(textObject, scene);
}

export function refreshTextResolution(textObject, scene = textObject?.scene) {
  const resolution = getIntegerTextResolution(scene);
  if (typeof textObject?.setResolution === "function") textObject.setResolution(resolution);
  else if (textObject) textObject.resolution = resolution;
  textObject?.updateText?.();
  return textObject;
}

export function refreshSceneTextResolution(scene) {
  for (const textObject of managedTextByScene.get(scene) ?? []) refreshTextResolution(textObject, scene);
}

export function withTextResolution(scene, style = {}) {
  return { ...style, resolution: getIntegerTextResolution(scene) };
}

function registerManagedText(scene, textObject) {
  if (!managedTextByScene.has(scene)) managedTextByScene.set(scene, new Set());
  managedTextByScene.get(scene).add(textObject);
  textObject.once?.("destroy", () => managedTextByScene.get(scene)?.delete(textObject));
}

function installTextResolutionRefresh(scene) {
  if (!scene || sceneListeners.has(scene)) return;
  const refresh = () => refreshSceneTextResolution(scene);
  scene.scale?.on?.("resize", refresh);
  globalThis.document?.addEventListener?.("fullscreenchange", refresh);
  scene.events?.once?.("shutdown", () => cleanup(scene, refresh));
  scene.events?.once?.("destroy", () => cleanup(scene, refresh));
  sceneListeners.set(scene, refresh);
}

function cleanup(scene, refresh) {
  scene.scale?.off?.("resize", refresh);
  globalThis.document?.removeEventListener?.("fullscreenchange", refresh);
  sceneListeners.delete(scene);
  managedTextByScene.delete(scene);
}
