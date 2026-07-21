import { getActorProfile } from "./actorProfiles.js";
import { createCharacterMotor } from "./characterMotor.js";
import { createCharacterVisual } from "./characterVisual.js";

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
    this.motor = createCharacterMotor({
      id,
      spawn,
      controller,
      movementConfig,
      actorProfile,
      footWidth,
      footDepth,
    });
    this.visual = createCharacterVisual(scene, {
      spawn,
      actorProfile,
      animationPrefix,
      frames,
      idleFrameIndex,
      facingHysteresis,
    });
  }

  get id() { return this.motor.id; }
  get actorProfile() { return this.motor.actorProfile; }
  get movementConfig() { return this.motor.movementConfig; }
  get sprite() { return this.visual.sprite; }
  get movement() { return this.motor.movement; }
  get speed() { return this.motor.speed; }
  get lastBlockedAxes() { return this.motor.lastBlockedAxes; }
  get lastFacing() { return this.visual.lastFacing; }
  get footWidth() { return this.motor.footWidth; }
  get footDepth() { return this.motor.footDepth; }
  get frames() { return this.visual.frames; }
  get idleFrameIndex() { return this.visual.idleFrameIndex; }
  get animationPrefix() { return this.visual.animationPrefix; }
  get facingHysteresis() { return this.visual.facingHysteresis; }

  update(deltaMs, collisionEnvironment) {
    const snapshot = this.motor.update(deltaMs, collisionEnvironment);
    this.visual.update(snapshot, this.motor.movement, this.motor.movementConfig);
    return snapshot;
  }

  getSnapshot() {
    return this.motor.getSnapshot();
  }

  createControllerContext() {
    return this.motor.createControllerContext();
  }

  destroy() {
    this.visual.destroy();
  }
}
