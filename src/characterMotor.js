import {
  applyBlockedAxes,
  createMovementState,
  movementDelta,
  movementSpeed,
  stepCharacterMovement,
} from "./characterMovement.js";
import { moveWithCollision } from "./movement.js";
import { getActorProfile } from "./actorProfiles.js";

export class CharacterMotor {
  constructor({
    id,
    spawn,
    controller,
    movementConfig,
    actorProfile = getActorProfile("player"),
    footWidth = actorProfile.visual.footWidth,
    footDepth = actorProfile.visual.footDepth,
  }) {
    this.id = id;
    this.profileId = actorProfile.id;
    this.actorProfile = actorProfile;
    this.controller = controller;
    this.movementConfig = movementConfig;
    this.position = { x: spawn.x, y: spawn.y };
    this.movement = createMovementState();
    this.footWidth = footWidth;
    this.footDepth = footDepth;
    this.lastBlockedAxes = { x: false, y: false };
    this.speedMultiplier = 1;
  }

  get speed() {
    return movementSpeed(this.movement);
  }

  update(deltaMs, collisionEnvironment) {
    const command = this.controller.getCommand(this.createControllerContext(), deltaMs);
    this.movement = stepCharacterMovement(this.movement, command.moveDirection, deltaMs, {
      config: { ...this.movementConfig, maxSpeed: this.movementConfig.maxSpeed * this.speedMultiplier },
      aimDirection: command.aimDirection,
    });

    const moveResult = moveWithCollision(
      this.position,
      movementDelta(this.movement, deltaMs, { ...this.movementConfig, maxSpeed: this.movementConfig.maxSpeed * this.speedMultiplier }),
      collisionEnvironment,
      this.footWidth,
      this.footDepth,
    );

    this.movement = applyBlockedAxes(this.movement, moveResult.blockedAxes);
    this.lastBlockedAxes = { ...moveResult.blockedAxes };
    this.position = { ...moveResult.position };
    return this.getSnapshot();
  }

  createControllerContext() {
    return Object.freeze({
      id: this.id,
      profileId: this.profileId,
      position: { x: this.position.x, y: this.position.y },
      velocity: { x: this.movement.velocity.x, y: this.movement.velocity.y },
      facingDirection: { x: this.movement.facingDirection.x, y: this.movement.facingDirection.y },
      aimDirection: { x: this.movement.aimDirection.x, y: this.movement.aimDirection.y },
      blockedAxes: { x: this.lastBlockedAxes.x, y: this.lastBlockedAxes.y },
      speed: this.speed,
    });
  }

  getSnapshot() {
    return freezeSnapshot({
      id: this.id,
      profileId: this.profileId,
      position: { x: this.position.x, y: this.position.y },
      velocity: { x: this.movement.velocity.x, y: this.movement.velocity.y },
      facingDirection: { x: this.movement.facingDirection.x, y: this.movement.facingDirection.y },
      aimDirection: { x: this.movement.aimDirection.x, y: this.movement.aimDirection.y },
      blockedAxes: { x: this.lastBlockedAxes.x, y: this.lastBlockedAxes.y },
      speed: this.speed,
    });
  }
}

export function createCharacterMotor(options) {
  return new CharacterMotor(options);
}

function freezeSnapshot(snapshot) {
  Object.freeze(snapshot.position);
  Object.freeze(snapshot.velocity);
  Object.freeze(snapshot.facingDirection);
  Object.freeze(snapshot.aimDirection);
  Object.freeze(snapshot.blockedAxes);
  return Object.freeze(snapshot);
}
