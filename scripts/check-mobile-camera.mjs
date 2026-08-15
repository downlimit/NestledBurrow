import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CAMERA_FOLLOW_PIXEL_STEP,
  CameraFollowRuntime,
  cameraFollowStep,
  normalizeCameraTuning,
} from "../src/character/cameraFollowRuntime.js";
import { JOYSTICK, clampJoystickCenter } from "../src/controls/input.js";
import { GAME_HEIGHT, GAME_WIDTH } from "../src/world/worldConfig.js";

assert.equal(JOYSTICK.sprintRadius, 54.45, "mobile sprint threshold is enlarged by a further 10 percent to 54.45 logical pixels");
assert.deepEqual(clampJoystickCenter(0, 0), { x: 0, y: 0 });
assert.deepEqual(clampJoystickCenter(GAME_WIDTH, GAME_HEIGHT), { x: GAME_WIDTH, y: GAME_HEIGHT });

assert.deepEqual(normalizeCameraTuning({ backPointFollowRate: -1, cameraLeadTransitionSeconds: 99 }), {
  backPointFollowRate: 0.1,
  cameraLeadTransitionSeconds: 10,
});

const initial = {
  back: { x: 0, y: 0 },
  front: { x: 0, y: 0 },
  target: { x: 0, y: 0 },
  progress: 0,
  moving: false,
};
const oneStep = cameraFollowStep(initial, {
  presentationPosition: { x: 100, y: 0 },
  speed: 10,
  movingSpeedThreshold: 2,
  deltaSeconds: 0.1,
});
let tenSteps = initial;
for (let index = 0; index < 10; index += 1) {
  tenSteps = cameraFollowStep(tenSteps, {
    presentationPosition: { x: 100, y: 0 },
    speed: 0,
    movingSpeedThreshold: 2,
    deltaSeconds: 0.01,
  });
}
assert(Math.abs(oneStep.back.x - tenSteps.back.x) < 1e-9, "B interpolation is frame-rate independent");
assert(oneStep.front.x > 100, "F mirrors B beyond the presentation point");
assert(oneStep.progress > 0 && oneStep.progress < 1, "movement begins a gradual B-to-F transition");
assert(oneStep.target.x < oneStep.front.x, "camera starts closer to B than F");

const cameraTarget = {
  x: null,
  y: null,
  setPosition(x, y) { this.x = x; this.y = y; return this; },
  destroy() {},
};
const camera = { roundPixels: false, startFollow() {}, stopFollow() {} };
const cameraRuntime = new CameraFollowRuntime({
  add: { zone() { return cameraTarget; } },
  cameras: { main: camera },
}, {
  presentationPosition: { x: 10.4, y: 20.6 },
  movingSpeedThreshold: 2,
});
assert.equal(camera.roundPixels, true, "active camera rounds scroll for crisp world visuals");
assert.equal(CAMERA_FOLLOW_PIXEL_STEP, 1 / 6, "camera uses one backing pixel as its movement step");
assert(Math.abs(cameraTarget.x - 10.4) <= CAMERA_FOLLOW_PIXEL_STEP / 2, "camera keeps the closest dense-pixel x at reset");
assert(Math.abs(cameraTarget.y - 20.6) <= CAMERA_FOLLOW_PIXEL_STEP / 2, "camera keeps the closest dense-pixel y at reset");
cameraRuntime.update({ presentationPosition: { x: 11.6, y: 21.6 }, speed: 0, deltaMs: 16 });
const targetXInPixels = cameraTarget.x / CAMERA_FOLLOW_PIXEL_STEP;
const targetYInPixels = cameraTarget.y / CAMERA_FOLLOW_PIXEL_STEP;
assert(
  Math.abs(targetXInPixels - Math.round(targetXInPixels)) < 1e-9
    && Math.abs(targetYInPixels - Math.round(targetYInPixels)) < 1e-9,
  "camera follow target remains aligned to backing pixels while moving",
);
cameraRuntime.destroy();
const interactionHud = readFileSync("src/ui/interactionHud.js", "utf8");
const main = readFileSync("src/main.js", "utf8");
const characterVisual = readFileSync("src/character/characterVisual.js", "utf8");
const gameHud = readFileSync("src/ui/gameHud.js", "utf8");
assert(interactionHud.includes("isInteractHeld()"), "mobile interaction exposes held state");
assert(main.includes("mobileHeldResourceInteract") && main.includes("RESOURCE_INTERACTION_KIND"), "held mobile interaction repeats only repeatable resources");
assert(main.includes("(this.runKey?.isDown && !shiftMeleeEquipped) || this.mobileJoystick?.isSprinting?.()"), "keyboard and mobile sprint share one running state while Shift can own a combat action");
assert(main.includes("presentationPosition: this.getPlayerCameraPosition()"), "camera uses the interaction-safe focus position");
assert(main.includes("(this.needsInteractionCoordinator?.isLocked?.() || this.sleeping) && motorPosition"), "long-use transitions and sleep keep the camera anchored to the unchanged motor position");
assert(characterVisual.includes("setPresentationPose(pose)") && !characterVisual.includes("sleepingPose"), "facility and sleep use a general visual presentation boundary");
assert(gameHud.includes("pinnedNeedId") && gameHud.includes("isCoarsePointer()"), "coarse pointer can pin needs tooltips");

console.log("mobile input and camera checks passed");
