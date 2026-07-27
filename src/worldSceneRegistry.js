let currentWorldScene = null;

export function setCurrentWorldScene(scene) {
  currentWorldScene = scene ?? null;
  return currentWorldScene;
}

export function getCurrentWorldScene() {
  return currentWorldScene;
}

export function clearCurrentWorldScene(scene) {
  if (!scene || currentWorldScene === scene) currentWorldScene = null;
}
