import { isMoving } from "./characterMovement.js";
import { quantizeCharacterFacing } from "./characterFacing.js";
import { applyFrameReference } from "./characterVisualProfiles.js";

export class CharacterVisual {
  constructor(
    scene,
    {
      spawn,
      visualProfile,
      animationPrefix = visualProfile.animationPrefix,
      frames = visualProfile.frames,
      idleFrameIndex = visualProfile.idleFrameIndex,
      facingHysteresis = visualProfile.facingHysteresis,
    },
  ) {
    this.visualProfile = visualProfile;
    this.animationPrefix = animationPrefix;
    this.frames = frames;
    this.idleFrameIndex = idleFrameIndex;
    this.facingHysteresis = facingHysteresis;
    this.lastFacing = "down";
    this.sprite = scene.add
      .sprite(
        spawn.x,
        spawn.y,
        this.frames.down[this.idleFrameIndex].textureKey,
        this.frames.down[this.idleFrameIndex].frame,
      )
      .setOrigin(0.5, 1);
    this.updateDepth();
  }

  update(snapshot, movementState, movementConfig) {
    this.sprite.setPosition(snapshot.position.x, snapshot.position.y);
    this.updateDepth();
    this.updateFacing(snapshot.facingDirection);
    this.updateAnimation(movementState, movementConfig);
  }

  updateDepth() {
    this.sprite.setDepth(500 + Math.round(this.sprite.y));
  }

  updateFacing(direction) {
    this.lastFacing = quantizeCharacterFacing(direction, this.lastFacing, this.facingHysteresis);
  }

  updateAnimation(movementState, movementConfig) {
    if (!isMoving(movementState, movementConfig)) {
      this.sprite.anims.stop();
      const idleFrame = this.frames[this.lastFacing][this.idleFrameIndex];
      applyFrameReference(this.sprite, idleFrame);
      return;
    }

    const key = `${this.animationPrefix}-walk-${this.lastFacing}`;
    if (!this.sprite.anims.isPlaying || this.sprite.anims.currentAnim?.key !== key) {
      this.sprite.anims.play(key);
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.sprite?.destroy?.();
  }
}

export function createCharacterVisual(scene, options) {
  return new CharacterVisual(scene, options);
}
