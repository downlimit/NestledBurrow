import {
  applyBlockedAxes,
  createMovementState,
  isMoving,
  movementDelta,
  movementSpeed,
  stepCharacterMovement,
} from "./characterMovement.js";
import { moveWithCollision } from "./movement.js";
import {
  FACING_HYSTERESIS,
  PLAYER_FOOT_DEPTH,
  PLAYER_FOOT_WIDTH,
  PLAYER_FRAMES,
  PLAYER_IDLE_FRAME_INDEX,
} from "./visualConfig.js";

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
      animationPrefix = "character",
      frames = PLAYER_FRAMES,
      idleFrameIndex = PLAYER_IDLE_FRAME_INDEX,
      footWidth = PLAYER_FOOT_WIDTH,
      footDepth = PLAYER_FOOT_DEPTH,
    },
  ) {
    this.id = id;
    this.controller = controller;
    this.movementConfig = movementConfig;
    this.animationPrefix = animationPrefix;
    this.frames = frames;
    this.idleFrameIndex = idleFrameIndex;
    this.footWidth = footWidth;
    this.footDepth = footDepth;
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
    const direction = this.controller.getDirection(
      { x: this.sprite.x, y: this.sprite.y },
      this,
      deltaMs,
    );
    this.movement = stepCharacterMovement(this.movement, direction, deltaMs, {
      config: this.movementConfig,
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

  updateDepth() {
    this.sprite.setDepth(500 + Math.round(this.sprite.y));
  }

  updateFacing(direction) {
    const absX = Math.abs(direction.x);
    const absY = Math.abs(direction.y);
    if ((absX === 0 && absY === 0) || Math.abs(absX - absY) <= FACING_HYSTERESIS) return;
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

export function createNpcMovementConfig(playerConfig) {
  return {
    ...playerConfig,
    acceleration: playerConfig.acceleration / 2,
    brakingDeceleration: playerConfig.brakingDeceleration / 2,
    reverseAcceleration: playerConfig.reverseAcceleration / 2,
    turnDeceleration: playerConfig.turnDeceleration / 2,
  };
}
