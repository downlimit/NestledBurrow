import {
  applyBlockedAxes,
  createMovementState,
  isMoving,
  movementDelta,
  movementSpeed,
  stepCharacterMovement,
} from "./characterMovement.js";
import { moveWithCollision } from "./movement.js";
import { getActorProfile } from "./actorProfiles.js";

export function createCharacter(scene, options) {
  return new Character(scene, options);
}

export class Character {
  constructor(
    scene,
    {
      id,
      spawn,
      controller,
      movementConfig,
      actorProfile = getActorProfile("player"),
      animationPrefix = actorProfile.visual.animationPrefix,
      frames = actorProfile.visual.frames,
      idleFrameIndex = actorProfile.visual.idleFrameIndex,
      footWidth = actorProfile.visual.footWidth,
      footDepth = actorProfile.visual.footDepth,
      facingHysteresis = actorProfile.visual.facingHysteresis,
    },
  ) {
    this.id = id;
    this.controller = controller;
    this.actorProfile = actorProfile;
    this.movementConfig = movementConfig;
    this.animationPrefix = animationPrefix;
    this.frames = frames;
    this.idleFrameIndex = idleFrameIndex;
    this.footWidth = footWidth;
    this.footDepth = footDepth;
    this.facingHysteresis = facingHysteresis;
    this.lastFacing = "down";
    this.movement = createMovementState();
    this.lastBlockedAxes = { x: false, y: false };
    this.sprite = scene.add
      .sprite(spawn.x, spawn.y, this.frames.down[this.idleFrameIndex])
      .setOrigin(0.5, 1);
    this.updateDepth();
  }

  get speed() {
    return movementSpeed(this.movement);
  }

  update(deltaMs, layout) {
    const command = this.controller.getCommand(this.createControllerContext(), deltaMs);
    this.movement = stepCharacterMovement(this.movement, command.moveDirection, deltaMs, {
      config: this.movementConfig,
      aimDirection: command.aimDirection,
    });

    const moveResult = moveWithCollision(
      { x: this.sprite.x, y: this.sprite.y },
      movementDelta(this.movement, deltaMs, this.movementConfig),
      layout,
      this.footWidth,
      this.footDepth,
    );

    this.movement = applyBlockedAxes(this.movement, moveResult.blockedAxes);
    this.lastBlockedAxes = moveResult.blockedAxes;
    this.sprite.setPosition(moveResult.position.x, moveResult.position.y);
    this.updateDepth();
    this.updateFacing(this.movement.facingDirection);
    this.updateAnimation();
  }

  createControllerContext() {
    return Object.freeze({
      id: this.id,
      position: { x: this.sprite.x, y: this.sprite.y },
      velocity: { ...this.movement.velocity },
      facingDirection: { ...this.movement.facingDirection },
      aimDirection: { ...this.movement.aimDirection },
      blockedAxes: { ...this.lastBlockedAxes },
      speed: this.speed,
    });
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

  updateAnimation() {
    if (!isMoving(this.movement, this.movementConfig)) {
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
}
