import { isMoving } from "./characterMovement.js";
import { getActorProfile } from "./actorProfiles.js";

export class CharacterVisual {
  constructor(
    scene,
    {
      spawn,
      actorProfile = getActorProfile("player"),
      animationPrefix = actorProfile.visual.animationPrefix,
      frames = actorProfile.visual.frames,
      idleFrameIndex = actorProfile.visual.idleFrameIndex,
      facingHysteresis = actorProfile.visual.facingHysteresis,
    },
  ) {
    this.actorProfile = actorProfile;
    this.visualProfile = actorProfile.visual;
    this.animationPrefix = animationPrefix;
    this.frames = frames;
    this.idleFrameIndex = idleFrameIndex;
    this.facingHysteresis = facingHysteresis;
    this.lastFacing = "down";
    this.sprite = scene.add
      .sprite(spawn.x, spawn.y, this.frames.down[this.idleFrameIndex])
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
    const absX = Math.abs(direction.x);
    const absY = Math.abs(direction.y);
    if ((absX === 0 && absY === 0) || Math.abs(absX - absY) <= this.facingHysteresis) return;
    this.lastFacing =
      absX > absY
        ? direction.x > 0
          ? "right"
          : "left"
        : direction.y > 0
          ? "down"
          : "up";
  }

  updateAnimation(movementState, movementConfig) {
    if (!isMoving(movementState, movementConfig)) {
      this.sprite.anims.stop();
      const idleFrame = this.frames[this.lastFacing][this.idleFrameIndex];
      if (this.sprite.texture.key !== idleFrame) this.sprite.setTexture(idleFrame);
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
