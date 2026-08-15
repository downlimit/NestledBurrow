import { GAME_HEIGHT, GAME_WIDTH } from "../world/worldConfig.js";

export const WORLD_CAMERA_ZOOM = 2;
export const UI_CAMERA_NAME = "presentation-ui";

export function displayZoomForViewport(viewportWidth, viewportHeight) {
  const fit = Math.min(
    Math.max(1, Number(viewportWidth) || GAME_WIDTH) / GAME_WIDTH,
    Math.max(1, Number(viewportHeight) || GAME_HEIGHT) / GAME_HEIGHT,
  );
  return fit >= 1 ? Math.max(1, Math.floor(fit)) : Math.max(0.1, fit);
}

export class PresentationCameraRuntime {
  constructor(scene) {
    this.scene = scene;
    this.worldCamera = scene.cameras.main;
    this.worldCamera.setZoom(WORLD_CAMERA_ZOOM);
    this.worldCamera.roundPixels = true;
    this.uiCamera = scene.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT, false, UI_CAMERA_NAME);
    this.uiCamera.setScroll(0, 0).setZoom(1);
    this.uiCamera.roundPixels = true;
    this.syncObjectLayers();
  }

  syncObjectLayers() {
    if (!this.scene || !this.uiCamera || !this.worldCamera) return;
    for (const object of this.scene.children.list) {
      const isScreenSpace = Number(object?.scrollFactorX) === 0 && Number(object?.scrollFactorY) === 0;
      object.cameraFilter &= ~(this.worldCamera.id | this.uiCamera.id);
      object.cameraFilter |= isScreenSpace ? this.worldCamera.id : this.uiCamera.id;
    }
  }

  destroy() {
    if (this.scene && this.uiCamera) this.scene.cameras.remove(this.uiCamera);
    this.uiCamera = null;
    this.worldCamera = null;
    this.scene = null;
  }
}
