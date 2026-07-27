import { MovementDebugPanel } from "./movementDebugPanel.js";

const retryDelayMs = 50;
const originalResolveWorldScene = MovementDebugPanel.prototype.resolveWorldScene;
const originalAttachSceneRuntime = MovementDebugPanel.prototype.attachSceneRuntime;
const originalPersistStartingLayout = MovementDebugPanel.prototype.persistStartingLayout;
const originalApplyColliderDraftToProject = MovementDebugPanel.prototype.applyColliderDraftToProject;

function delay(milliseconds) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
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

  const promise = Promise.resolve(originalAttachSceneRuntime.call(this))
    .then(() => this.authoringRuntime)
    .finally(() => {
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
