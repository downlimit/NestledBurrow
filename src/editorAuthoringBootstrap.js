import { MovementDebugPanel } from "./movementDebugPanel.js";

const retryDelayMs = 50;
const originalResolveWorldScene = MovementDebugPanel.prototype.resolveWorldScene;
const originalAttachSceneRuntime = MovementDebugPanel.prototype.attachSceneRuntime;
const originalPersistStartingLayout = MovementDebugPanel.prototype.persistStartingLayout;
const originalApplyColliderDraftToProject = MovementDebugPanel.prototype.applyColliderDraftToProject;

function delay(milliseconds) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

function isAuthoringSceneReady(scene) {
  return Boolean(
    scene?.buildMode
      && scene?.buildPlacedObjects
      && scene?.facilityRuntime
      && scene?.debrisRuntime
      && scene?.worldLayout,
  );
}

async function waitForAuthoringScene(panel) {
  const scene = await panel.resolveWorldScene();
  while (!panel.destroyed && scene && !isAuthoringSceneReady(scene)) {
    await delay(retryDelayMs);
  }
  return panel.destroyed ? null : scene;
}

MovementDebugPanel.prototype.resolveWorldScene = async function resolveWorldSceneWithRetry() {
  while (!this.destroyed) {
    const scene = await originalResolveWorldScene.call(this);
    if (scene) return scene;
    await delay(retryDelayMs);
  }
  return null;
};

MovementDebugPanel.prototype.attachSceneRuntime = function attachSceneRuntimeOnce() {
  if (this.destroyed || this.authoringRuntime) return Promise.resolve(this.authoringRuntime);
  if (this.authoringRuntimeAttachPromise) return this.authoringRuntimeAttachPromise;

  const promise = (async () => {
    const scene = await waitForAuthoringScene(this);
    if (!scene || this.destroyed) return null;

    await originalAttachSceneRuntime.call(this);
    if (!this.authoringRuntime || this.destroyed) return this.authoringRuntime;

    // The original panel defers restoration to a future update event. That is
    // fragile during scene.restart(): the listener can be attached to the old
    // lifecycle and the browser-authored layout is then skipped. Restore only
    // after build/facility runtimes are ready, and do it synchronously here.
    if (this.startingLayoutRestoreListener) {
      scene.events?.off?.("update", this.startingLayoutRestoreListener);
      this.startingLayoutRestoreListener = null;
    }

    try {
      const layout = this.authoringRuntime.restoreStartingLayout?.();
      this.setAuthoringStatus(
        layout
          ? "Стартовая расстановка загружена из браузера/проекта"
          : "Стартовая расстановка: базовая",
      );
    } catch (error) {
      console.warn("Starting layout restore failed", error);
      this.setAuthoringStatus("Ошибка загрузки стартовой расстановки", true);
    }

    return this.authoringRuntime;
  })().finally(() => {
    if (this.authoringRuntimeAttachPromise === promise) this.authoringRuntimeAttachPromise = null;
  });

  this.authoringRuntimeAttachPromise = promise;
  return promise;
};

MovementDebugPanel.prototype.persistStartingLayout = async function persistStartingLayoutAfterAttach() {
  if (!this.authoringRuntime) await this.attachSceneRuntime();
  return originalPersistStartingLayout.call(this);
};

MovementDebugPanel.prototype.applyColliderDraftToProject = async function applyColliderDraftAfterAttach() {
  if (!this.authoringRuntime) await this.attachSceneRuntime();
  return originalApplyColliderDraftToProject.call(this);
};
