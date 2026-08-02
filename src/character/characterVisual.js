import { isMoving } from "./characterMovement.js";
import { quantizeCharacterFacing } from "./characterFacing.js";
import { applyFrameReference } from "./characterVisualProfiles.js";
import { worldDepthFromAnchorY } from "../build/buildWorldGeometry.js";

export class CharacterVisual {
  constructor(
    scene,
    {
      spawn,
      id = "character",
      visualProfile,
      animationPrefix = visualProfile.animationPrefix,
      frames = visualProfile.frames,
      idleFrameIndex = visualProfile.idleFrameIndex,
      facingHysteresis = visualProfile.facingHysteresis,
    },
  ) {
    this.scene = scene;
    this.id = id;
    this.visualProfile = visualProfile;
    this.animationPrefix = animationPrefix;
    this.frames = frames;
    this.idleFrameIndex = idleFrameIndex;
    this.facingHysteresis = facingHysteresis;
    this.lastFacing = "down";
    this.presentationPose = null;
    this.sleepMarker = null;
    this.sleepMarkerBase = null;
    this.lowEnergyMarker = null;
    this.lowEnergyMarkerBase = null;
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
    if (this.presentationPose) {
      this.applyPresentationPose();
      return;
    }
    this.sprite.setPosition(snapshot.position.x, snapshot.position.y);
    this.sprite.setAngle?.(0);
    this.sprite.setOrigin?.(0.5, 1);
    this.updateDepth();
    this.updateFacing(snapshot.facingDirection);
    this.updateAnimation(movementState, movementConfig);
  }

  updateDepth() {
    this.sprite.setDepth(worldDepthFromAnchorY(this.sprite.y, this.id));
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

  setPresentationPose(pose) {
    this.presentationPose = pose ? {
      x: pose.x,
      y: pose.y,
      facing: pose.facing ?? "down",
      angle: pose.angle ?? 0,
      originX: pose.originX ?? 0.5,
      originY: pose.originY ?? 0.5,
      depth: pose.depth,
      showSleepMarker: Boolean(pose.showSleepMarker),
    } : null;
    if (this.presentationPose) this.applyPresentationPose();
    else {
      this.sprite.setAngle?.(0);
      this.sprite.setOrigin?.(0.5, 1);
      this.destroySleepMarker();
    }
  }

  setLowEnergyMarker(active) {
    if (!active) return this.destroyLowEnergyMarker();
    if (!this.lowEnergyMarker && this.scene.add?.graphics) {
      this.lowEnergyMarker = this.scene.add.graphics();
      this.lowEnergyMarker.fillStyle(0xf2eadc, 0.85).fillRect(0, 0, 3, 1).fillRect(1, 1, 1, 1).fillRect(0, 2, 3, 1);
    }
    const x = this.sprite.x;
    const y = this.sprite.y - 18;
    if (!this.lowEnergyMarker || this.lowEnergyMarkerBase?.x === x && this.lowEnergyMarkerBase?.y === y) return;
    this.scene.tweens?.killTweensOf?.(this.lowEnergyMarker);
    this.lowEnergyMarkerBase = { x, y };
    this.lowEnergyMarker.setPosition(x, y).setDepth(502 + Math.round(this.sprite.y));
    this.scene.tweens?.add?.({ targets: this.lowEnergyMarker, x: { from: x, to: x - 1 }, y: { from: y, to: y - 1 }, duration: 1000, yoyo: true, repeat: -1 });
  }

  applyPresentationPose() {
    const idleFrame = this.frames[this.presentationPose.facing][this.idleFrameIndex];
    this.sprite.anims.stop();
    applyFrameReference(this.sprite, idleFrame);
    this.sprite.setOrigin?.(this.presentationPose.originX, this.presentationPose.originY);
    this.sprite.setAngle?.(this.presentationPose.angle);
    this.sprite.setPosition(this.presentationPose.x, this.presentationPose.y);
    this.sprite.setDepth(this.presentationPose.depth ?? worldDepthFromAnchorY(this.presentationPose.y, this.id, 501));
    if (this.presentationPose.showSleepMarker) this.updateSleepMarker();
    else this.destroySleepMarker();
  }

  updateSleepMarker() {
    const x = this.presentationPose.x - 1;
    const y = this.presentationPose.y - 14;
    if (!this.sleepMarker && this.scene.add?.graphics) {
      this.sleepMarker = this.scene.add.graphics();
      this.sleepMarker.fillStyle(0xf2eadc, 0.95).fillRect(0, 0, 5, 1).fillRect(3, 1, 1, 1).fillRect(2, 2, 1, 1).fillRect(1, 3, 1, 1).fillRect(0, 4, 5, 1);
    }
    if (!this.sleepMarker || this.sleepMarkerBase?.x === x && this.sleepMarkerBase?.y === y) return;
    this.scene.tweens?.killTweensOf?.(this.sleepMarker);
    this.sleepMarkerBase = { x, y };
    this.sleepMarker.setPosition(x, y).setDepth(502 + Math.round(this.presentationPose.y));
    this.scene.tweens?.add?.({ targets: this.sleepMarker, x: { from: x, to: x - 1 }, y: { from: y, to: y - 1 }, duration: 1000, yoyo: true, repeat: -1 });
  }

  destroySleepMarker() {
    this.scene.tweens?.killTweensOf?.(this.sleepMarker);
    this.sleepMarker?.destroy?.();
    this.sleepMarker = null;
    this.sleepMarkerBase = null;
  }

  destroyLowEnergyMarker() {
    this.scene.tweens?.killTweensOf?.(this.lowEnergyMarker);
    this.lowEnergyMarker?.destroy?.();
    this.lowEnergyMarker = null;
    this.lowEnergyMarkerBase = null;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.destroySleepMarker();
    this.destroyLowEnergyMarker();
    this.sprite?.destroy?.();
  }
}

export function createCharacterVisual(scene, options) {
  return new CharacterVisual(scene, options);
}
