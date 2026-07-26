import { createControllerCommand } from "./controllerCommand.js";

export function createGuestController() {
  let moveDirection = { x: 0, y: 0 };
  let aimDirection = { x: 0, y: 1 };
  return {
    getCommand() {
      return createControllerCommand({ moveDirection, aimDirection });
    },
    setMovement(direction) {
      moveDirection = normalize(direction);
      if (moveDirection.x !== 0 || moveDirection.y !== 0) aimDirection = { ...moveDirection };
    },
    face(direction) {
      moveDirection = { x: 0, y: 0 };
      aimDirection = normalize(direction);
    },
    stop() {
      moveDirection = { x: 0, y: 0 };
    },
  };
}

function normalize(direction) {
  const x = Number(direction?.x) || 0;
  const y = Number(direction?.y) || 0;
  const length = Math.hypot(x, y);
  return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}
