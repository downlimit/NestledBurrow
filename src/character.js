import { getActorProfile } from "./actorProfiles.js";
import { CHARACTER_VISUAL_PROFILE_IDS, getCharacterVisualProfile } from "./characterVisualProfiles.js";
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
      visualProfile = actorProfile.visual ?? getCharacterVisualProfile(CHARACTER_VISUAL_PROFILE_IDS.player),
      animationPrefix = visualProfile.animationPrefix,
      frames = visualProfile.frames,
      idleFrameIndex = visualProfile.idleFrameIndex,
      footWidth = visualProfile.footWidth,
      footDepth = visualProfile.footDepth,
      facingHysteresis = visualProfile.facingHysteresis,
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
      visualProfile,
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
