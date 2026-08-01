import assert from "node:assert/strict";
import {
  activityEnergyRate,
  canRun,
  computeNeedRates,
  consciousMovementMultiplier,
  lustreMovementMultiplier,
  physicalActionEnergyCost,
  toiletRunningSpeedMultiplier,
} from "../src/needsDomain.js";
import { createNeedsFlowRuntime, measuredNeedFlow, NEED_FLOW_NORMALIZATION } from "../src/needsFlowRuntime.js";
import { createNeedsRuntime } from "../src/needsRuntime.js";
import { createMeleeCombatState } from "../src/meleeDomain.js";
import { requestEnergyBackedMeleeAttack } from "../src/meleeRuntime.js";
import { createInteractionTimelineRuntime, INTERACTION_PHASE, INTERACTION_TIMELINE_PROFILES } from "../src/interactionTimelineRuntime.js";
import { createNeedsInteractionCoordinator } from "../src/needsInteractionCoordinator.js";
import { DEFAULT_GAMEPLAY_TUNING } from "../src/resourceConfig.js";
import {
  createToiletAccidentTimelineRuntime,
  TOILET_ACCIDENT_PHASE,
  TOILET_ACCIDENT_TIMELINE_TUNING,
} from "../src/toiletAccidentTimelineRuntime.js";

const tuning = DEFAULT_GAMEPLAY_TUNING.needs;
const close = (actual, expected, message) => assert(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} !== ${expected}`);
const freshState = ({ energy = 100, needs = {} } = {}) => ({
  gameplay: { currentEnergy: energy, maximumEnergy: 100, needs: { novelty: 100, satiety: 100, toilet: 100, lustre: 100, dialogue: 100, ...needs } },
});
assert.deepEqual(INTERACTION_TIMELINE_PROFILES, {
  shower: { protectedNeed: "lustre", enterMs: 700, exitMs: 900, emergencyMs: 400 },
  toilet: { protectedNeed: "toilet", enterMs: 500, exitMs: 600, emergencyMs: 300 },
  table: { protectedNeed: "satiety", enterMs: 500, exitMs: 650, emergencyMs: 300 },
  bed: { protectedNeed: "energy", enterMs: 1000, exitMs: 1200, emergencyMs: 500 },
});

const normalDay = 10 * activityEnergyRate("ordinary") + 6 * activityEnergyRate("walking")
  + activityEnergyRate("running") + 40 * physicalActionEnergyCost(0.2);
close(normalDay, 99, "canonical normal day spends 99 E");
const heavyDay = 7 * activityEnergyRate("ordinary") + 7 * activityEnergyRate("walking")
  + 2 * activityEnergyRate("running") + 50 * physicalActionEnergyCost(0.25);
close(heavyDay, 102, "canonical heavy day spends 102 E");
close(activityEnergyRate("ordinary", 0), 5, "hunger leaves the wakefulness base unchanged");
close(activityEnergyRate("walking", 0), 5.75, "hungry walking rate");
close(activityEnergyRate("running", 0), 9.5, "hungry running rate");
close(physicalActionEnergyCost(1, { satiety: 0, novelty: 100 }), 1.5, "hungry physical action multiplier");
assert.deepEqual(measuredNeedFlow(0, NEED_FLOW_NORMALIZATION.energy), { direction: null, arrows: 0, ratePerSecond: 0 });
assert(Object.isFrozen(NEED_FLOW_NORMALIZATION), "flow normalization has one immutable owner");
for (const [id, normalization] of Object.entries(NEED_FLOW_NORMALIZATION)) {
  assert(Object.isFrozen(normalization) && Object.isFrozen(normalization.down) && Object.isFrozen(normalization.up), `${id} normalization is deeply immutable`);
  for (const [direction, sign] of [["down", -1], ["up", 1]]) {
    const range = normalization[direction];
    assert.equal(measuredNeedFlow(sign * range.zeroBelowPerSecond * 0.5, normalization).arrows, 0, `${id} ${direction} hides extremely weak flow`);
    assert.equal(measuredNeedFlow(sign * range.weakRatePerSecond, normalization).arrows, 1, `${id} ${direction} weak scenario uses one arrow`);
    assert.equal(measuredNeedFlow(sign * (range.weakRatePerSecond + range.maximumRatePerSecond) / 2, normalization).arrows, 2, `${id} ${direction} intermediate scenario uses two arrows`);
    assert.equal(measuredNeedFlow(sign * range.maximumRatePerSecond, normalization).arrows, 3, `${id} ${direction} maximum scenario uses three arrows`);
  }
}
assert.equal(measuredNeedFlow(-5 / 60, NEED_FLOW_NORMALIZATION.energy).arrows, 1, "ordinary measured E drain uses one arrow");
assert.equal(measuredNeedFlow(-(0.2 / 0.66 + 5 / 60), NEED_FLOW_NORMALIZATION.energy).arrows, 2, "axe work is stronger than running by actual E loss");
assert.equal(measuredNeedFlow(-8 / 60, NEED_FLOW_NORMALIZATION.energy).arrows, 2, "running is an intermediate E drain");
const measuredFlow = createNeedsFlowRuntime({ initialValues: { novelty: 100, energy: 100, satiety: 100, toilet: 100, lustre: 100, dialogue: 100 } });
let measuredSnapshot = measuredFlow.observe({ novelty: 90, energy: 99.8, satiety: 100, toilet: 100, lustre: 100, dialogue: 100 });
assert.equal(measuredSnapshot.energy.arrows, 2, "actual axe-sized E jump is stronger than running without an action label");
assert.equal(measuredSnapshot.novelty.arrows, 3, "actual discrete N jump uses the same measured-flow system");
measuredSnapshot = measuredFlow.advance({ novelty: 90, energy: 99.8 - 5 * 0.7 / 60, satiety: 100, toilet: 100, lustre: 100, dialogue: 100 }, 700);
assert.equal(measuredSnapshot.energy.arrows, 1, "expired discrete E jump leaves measured ordinary drain");
assert.equal(measuredSnapshot.novelty.arrows, 0, "unchanged meter returns to zero arrows");
const earlyMeasuredFlow = createNeedsFlowRuntime({ initialValues: { energy: 100 } });
earlyMeasuredFlow.advance({ energy: 100 }, 100);
assert.equal(earlyMeasuredFlow.observe({ energy: 99.8 }).energy.arrows, 2, "a discrete cost keeps the same tier during the first measurement window");
const idleValues = { novelty: 100, energy: 100, satiety: 100, toilet: 100, lustre: 100, dialogue: 100 };
const idleMeasuredFlow = createNeedsFlowRuntime({ initialValues: idleValues });
for (let frame = 0; frame < 80; frame += 1) {
  const deltaMs = frame % 2 === 0 ? 16 : 17;
  idleValues.novelty -= 1 / 60 * deltaMs / 1000;
  idleValues.energy -= 5 / 60 * deltaMs / 1000;
  idleValues.satiety -= 7 / 60 * deltaMs / 1000;
  idleValues.toilet -= 6 / 60 * deltaMs / 1000;
  idleValues.lustre -= 1 / 60 * deltaMs / 1000;
  idleValues.dialogue -= 2 / 60 * deltaMs / 1000;
  idleMeasuredFlow.advance(idleValues, deltaMs);
}
assert(Object.values(idleMeasuredFlow.getState()).every(({ direction, arrows }) => direction === "down" && arrows === 1), "ordinary idle shows one down arrow on every changing need regardless of frame boundaries");
for (const [activity, expected] of [
  [{}, -1], [{ running: true }, -2], [{ activePhysicalTool: "watering" }, -1.5],
  [{ activePhysicalTool: "axe" }, -3], [{ activePhysicalTool: "hoe" }, -3], [{ activePhysicalTool: "pickaxe" }, -4],
]) close(computeNeedRates({ ...activity, needs: freshState().gameplay.needs }, tuning).lustre, expected, `lustre activity rate ${expected}`);
close(computeNeedRates({ running: true, activePhysicalTool: "axe", needs: freshState().gameplay.needs }, tuning).lustre, -3, "resource work has priority over running");

const axeState = freshState();
const axeRuntime = createNeedsRuntime({ sessionState: axeState, tuning });
for (let index = 0; index < 7; index += 1) axeRuntime.recordPhysicalAction("axe");
close(100 - axeState.gameplay.currentEnergy, 1.4, "seven axe hits add exactly 1.4 E");
assert.equal(axeRuntime.getPhysicalActionCost("pickaxe"), 0.3);
assert.equal(axeRuntime.getPhysicalActionCost("hoe"), 0.15);
assert.equal(axeRuntime.getPhysicalActionCost("watering"), 0.1);
assert.equal(axeRuntime.getPhysicalActionCost("sword"), 0.75);
assert.equal(axeRuntime.getPhysicalActionCost("battle-axe"), 0.1);
close(physicalActionEnergyCost(0.3, { satiety: 100, toilet: 25, novelty: 100 }), 0.375, "urgent T raises pickaxe cost by twenty-five percent");
close(physicalActionEnergyCost(0.2, { satiety: 0, toilet: 25, novelty: 0 }, { repeatedLabour: true }), 0.4875, "hunger, T and N physical-action multipliers compose");
assert.equal(canRun({ energy: 19.999, toilet: 100 }), false, "E below 20 blocks running");
assert.equal(canRun({ energy: 20, toilet: 100 }), true);
assert.equal(canRun({ energy: 20, toilet: 0 }), true, "T pressure never blocks running");
close(toiletRunningSpeedMultiplier(25), 1.15, "T at the urgent threshold speeds running by fifteen percent");
close(toiletRunningSpeedMultiplier(0), 1.15, "T at zero still speeds running until the accident resolves");
close(toiletRunningSpeedMultiplier(25.001), 1, "T above the urgent threshold leaves running unchanged");
close(consciousMovementMultiplier({ energy: 100, toilet: 0, lustre: 100 }), 1, "T pressure never changes walking speed");
close(lustreMovementMultiplier(33), 1, "L pressure starts below 33");
close(lustreMovementMultiplier(16.5), 0.75, "L speed penalty interpolates smoothly");
close(lustreMovementMultiplier(0), 0.5, "L at zero halves movement speed");
close(computeNeedRates({ needs: { ...freshState().gameplay.needs, lustre: 33 } }, tuning).novelty, -1, "L at 33 leaves N drain unchanged");
close(computeNeedRates({ needs: { ...freshState().gameplay.needs, lustre: 0 } }, tuning).novelty, -1.5, "L at zero raises N drain to one and a half times");
close(consciousMovementMultiplier({ energy: 1, toilet: 1, lustre: 0 }), 0.5, "E/L compose with the conscious floor");
const urgentMovement = createNeedsRuntime({ sessionState: freshState({ needs: { toilet: 25 } }), tuning }).movementState();
assert.deepEqual(urgentMovement, { multiplier: 1, runningAllowed: true, runningSpeedMultiplier: 1.15 }, "runtime exposes T urgency only as a running-speed multiplier");

const meleeEnergyState = freshState({ energy: 2 });
const meleeNeeds = createNeedsRuntime({ sessionState: meleeEnergyState, tuning });
const meleeState = createMeleeCombatState();
const spendMelee = (weaponId) => requestEnergyBackedMeleeAttack(
  meleeState,
  weaponId,
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { canPerformPhysicalAction: meleeNeeds.canPerformPhysicalAction, recordPhysicalAction: meleeNeeds.recordPhysicalAction },
);
assert.equal(spendMelee("sword").energyCost, 0.75, "accepted sword attack spends its configured cost");
close(meleeEnergyState.gameplay.currentEnergy, 1.25, "sword attack mutates E even before finding a target");
assert.equal(spendMelee("sword").status, "buffered");
close(meleeEnergyState.gameplay.currentEnergy, 0.5, "buffered combo attack spends once when accepted");
assert.equal(spendMelee("sword").status, "insufficient-energy");
close(meleeEnergyState.gameplay.currentEnergy, 0.5, "unaffordable attack does not spend E");
const deniedMeleeState = createMeleeCombatState();
assert.deepEqual(requestEnergyBackedMeleeAttack(deniedMeleeState, "battle-axe", { x: 1, y: 0 }, { x: 0, y: 1 }, {
  canPerformPhysicalAction: () => ({ allowed: false, cost: 0.1 }),
}), { status: "insufficient-energy", accepted: false, cost: 0.1 });
assert.equal(deniedMeleeState.phase, "idle", "unaffordable melee never starts");

let collapses = 0;
let wakes = 0;
const collapseState = freshState({ energy: 0 });
const collapseRuntime = createNeedsRuntime({ sessionState: collapseState, tuning, onCollapse: () => { collapses += 1; }, onWake: ({ collapsed }) => { if (collapsed) wakes += 1; } });
collapseRuntime.update({ realSeconds: 0, activity: {} });
assert.equal(collapses, 1, "E=0 produces one collapse entry");
collapseRuntime.update({ realSeconds: 119, sleeping: true, collapsed: true, activity: {} });
assert.equal(wakes, 0, "collapse cannot wake before two game hours");
collapseRuntime.update({ realSeconds: 1, sleeping: true, collapsed: true, activity: {} });
assert.equal(wakes, 1, "collapse wakes once after time and energy conditions");
assert(collapseState.gameplay.currentEnergy >= 25);
assert(collapseState.gameplay.needs.satiety < 100 && collapseState.gameplay.needs.toilet < 100, "other needs advance during collapse");

const privateState = freshState({ needs: { toilet: 0 } });
const privateReady = [];
const privateEvents = [];
const privateRuntime = createNeedsRuntime({
  sessionState: privateState,
  tuning,
  onToiletAccidentReady: (event) => privateReady.push(event),
  onToiletAccident: (event) => privateEvents.push(event),
});
privateRuntime.update({ realSeconds: 9.999, activity: { npcNearby: false } });
assert.equal(privateReady.length, 0, "T=0 waits ten game minutes");
privateRuntime.update({ realSeconds: 0.001, activity: { npcNearby: false } });
assert.equal(privateReady.length, 1, "ten game minutes at T=0 starts one accident timeline");
privateRuntime.update({ realSeconds: 10, activity: { npcNearby: false } });
assert.equal(privateReady.length, 1, "pending accident never retriggers from more elapsed time");
const beforePrivateConsequence = { ...privateState.gameplay.needs };
const privateAccident = privateRuntime.beginToiletAccident(privateReady[0]);
assert.equal(privateAccident.event.localPuddle, true, "puddle domain output exists without rendering art");
assert.equal(privateState.gameplay.needs.toilet, 0, "T stays zero when the puddle milestone begins");
assert.equal(privateState.gameplay.needs.lustre, beforePrivateConsequence.lustre, "L stays unchanged until recovery advances");
assert.equal(privateEvents.length, 1, "accident consequences fire once at the puddle milestone");
privateRuntime.advanceToiletAccidentRecovery(0.5);
close(privateState.gameplay.needs.toilet, 35, "T restores linearly during the second timeline");
close(privateState.gameplay.needs.lustre, beforePrivateConsequence.lustre - 22.5, "L falls in parallel with T recovery");
privateRuntime.advanceToiletAccidentRecovery(1);
close(privateState.gameplay.needs.toilet, 70, "T reaches 70 only at recovery completion");
close(privateState.gameplay.needs.lustre, beforePrivateConsequence.lustre - 45, "L reaches its full loss only at recovery completion");
const witnessedState = freshState({ needs: { toilet: 0 } });
let witnessedReady = null;
const witnessedRuntime = createNeedsRuntime({ sessionState: witnessedState, tuning, onToiletAccidentReady: (event) => { witnessedReady = event; } });
witnessedRuntime.update({ realSeconds: 10, activity: { npcNearby: true } });
const dialogueBeforeWitnessedConsequence = witnessedState.gameplay.needs.dialogue;
witnessedRuntime.beginToiletAccident(witnessedReady);
close(witnessedState.gameplay.needs.dialogue, dialogueBeforeWitnessedConsequence - 15, "witnessed accident applies D consequence once");

let accidentPose = null;
const puddleOutputs = [];
const recoveryProgress = [];
let accidentCompletions = 0;
const accidentTimeline = createToiletAccidentTimelineRuntime({
  tuning: TOILET_ACCIDENT_TIMELINE_TUNING,
  getBasePose: () => ({ x: 10, y: 20, facing: "left" }),
  setPresentationPose: (pose) => { accidentPose = pose; },
  onPuddle: (event) => puddleOutputs.push(event),
  onRecoveryProgress: (progress) => recoveryProgress.push(progress),
  onComplete: () => { accidentCompletions += 1; },
});
accidentTimeline.begin({ witnessed: false });
assert.equal(accidentTimeline.getState().remainingMs, 4250, "accident locks for three 750 ms shakes plus two seconds");
accidentTimeline.update(750);
assert.equal(accidentTimeline.getState().shakeIndex, 2, "second shake starts after 0.75 seconds");
accidentTimeline.update(750);
assert.equal(accidentTimeline.getState().shakeIndex, 3, "third shake starts after another 0.75 seconds");
accidentTimeline.update(750);
assert.equal(accidentTimeline.getState().phase, TOILET_ACCIDENT_PHASE.recovery);
assert.equal(puddleOutputs.length, 1);
assert.equal(puddleOutputs[0].localPuddle, true);
assert.equal(recoveryProgress.at(-1), 0);
accidentTimeline.update(1000);
close(accidentTimeline.getState().recoveryProgress, 0.5, "recovery timeline reaches its midpoint after one second");
assert.notEqual(accidentPose, null);
accidentTimeline.update(999);
assert.equal(accidentTimeline.isLocked(), true, "accident cannot be skipped before recovery finishes");
accidentTimeline.update(1);
assert.equal(accidentTimeline.isLocked(), false);
assert.equal(accidentPose, null);
assert.equal(accidentCompletions, 1);

const repetitionState = freshState({ needs: { novelty: 0 } });
const repetitionRuntime = createNeedsRuntime({ sessionState: repetitionState, tuning });
for (let index = 0; index < 3; index += 1) close(repetitionRuntime.recordPhysicalAction("axe").cost, 0.2, "first three labour actions use base cost");
close(repetitionRuntime.recordPhysicalAction("axe").cost, 0.26, "fourth repeated labour action uses N pressure");
repetitionRuntime.update({ realSeconds: 0, activity: { moving: true } });
close(repetitionRuntime.recordPhysicalAction("axe").cost, 0.2, "activity change resets repetition");

const soloState = freshState({ energy: 50, needs: { dialogue: 0 } });
createNeedsRuntime({ sessionState: soloState, tuning }).update({ realSeconds: 60, sleeping: true, activity: {} });
close(soloState.gameplay.currentEnergy, 60.5, "low D reduces solo-rest E recovery");
const sharedState = freshState({ energy: 50, needs: { dialogue: 0 } });
createNeedsRuntime({ sessionState: sharedState, tuning }).update({ realSeconds: 60, sleeping: true, activity: { npcNearby: true, sharedRest: true } });
close(sharedState.gameplay.currentEnergy, 64, "shared rest removes the solo D penalty");
assert.equal(sharedState.gameplay.needs.dialogue, 6, "shared rest restores D");

for (const [profileId, needId] of [["shower", "lustre"], ["toilet", "toilet"], ["table", "satiety"], ["bed", "energy"]]) {
  const motor = { x: 10, y: 20 };
  let pose = { ...motor };
  let activations = 0;
  let deactivations = 0;
  const timeline = createInteractionTimelineRuntime({ getPresentationPosition: () => pose, getMotorPosition: () => motor, setPresentationPose: (next) => { pose = next ?? { ...motor }; } });
  const started = timeline.begin({ profileId, targetPose: { x: 30, y: 40, facing: "right" }, onActivate: () => { activations += 1; }, onDeactivate: () => { deactivations += 1; } });
  assert.equal(started.protectedNeed, needId);
  assert.equal(timeline.requestExit("normal").status, "transition-locked", "normal commands do not interrupt enter");
  const protectedState = freshState({ energy: needId === "energy" ? 0.01 : 100, needs: { [needId]: 0.01 } });
  const protectedRuntime = createNeedsRuntime({ sessionState: protectedState, tuning });
  protectedRuntime.update({ realSeconds: 1, protectedNeed: needId, activity: {} });
  close(needId === "energy" ? protectedState.gameplay.currentEnergy : protectedState.gameplay.needs[needId], 0.01, `${profileId} protects ${needId} during enter`);
  timeline.update(INTERACTION_TIMELINE_PROFILES[profileId].enterMs);
  assert.equal(timeline.getState().phase, INTERACTION_PHASE.active);
  assert.equal(activations, 1, "effect starts only after enter");
  timeline.requestExit("normal");
  assert.equal(deactivations, 1, "effect stops at start of exit");
  assert.equal(timeline.getProtectedNeed(), needId, "protection remains during exit");
  timeline.update(INTERACTION_TIMELINE_PROFILES[profileId].exitMs);
  assert.equal(timeline.getState().phase, INTERACTION_PHASE.free);
  assert.deepEqual(motor, { x: 10, y: 20 }, "presentation transitions never mutate motor");
}

let emergencyPose = { x: 0, y: 0 };
const emergencyTimeline = createInteractionTimelineRuntime({ getPresentationPosition: () => emergencyPose, getMotorPosition: () => ({ x: 0, y: 0 }), setPresentationPose: (pose) => { emergencyPose = pose ?? { x: 0, y: 0 }; } });
emergencyTimeline.begin({ profileId: "bed", targetPose: { x: 10, y: 10 } });
emergencyTimeline.update(200);
emergencyTimeline.requestExit("urgent");
close(emergencyTimeline.getState().remainingMs, 480, "urgent reduces the remaining enter transition to 60%");
emergencyTimeline.requestExit("emergency");
assert.equal(emergencyTimeline.getState().remainingMs, INTERACTION_TIMELINE_PROFILES.bed.emergencyMs);
emergencyTimeline.update(INTERACTION_TIMELINE_PROFILES.bed.emergencyMs);
assert.equal(emergencyTimeline.getState().phase, INTERACTION_PHASE.free, "emergency reaches safe free state");
assert.equal(createInteractionTimelineRuntime().getState().phase, INTERACTION_PHASE.free, "transient timeline is never restored from save");

const approachPlayer = {
  sprite: { x: 8, y: 8 },
  motor: { position: { x: 8, y: 8 }, movement: { velocity: { x: 0, y: 0 } }, lastBlockedAxes: {} },
  visual: { setPresentationPose(pose) { this.pose = pose; } },
};
let activeFacility = null;
const approachCoordinator = createNeedsInteractionCoordinator({
  getPlayer: () => approachPlayer,
  facilityRuntime: {
    getDefinition: () => ({ id: "table", facilityType: "table", position: { x: 32, y: 8 } }),
    getPresentationPose: () => null,
    toggle: () => { activeFacility = "table"; return { status: "started" }; },
    stop: () => { activeFacility = null; },
  },
  debrisRuntime: { getBedDefinition: () => null },
  startSleep: () => {}, stopSleep: () => {},
});
approachCoordinator.useFacility("table", { approachPoint: { x: 24, y: 8 }, approachPath: [{ x: 24, y: 8 }] });
assert.equal(approachCoordinator.getState().phase, "approach");
assert.deepEqual(approachCoordinator.getMovementDirection(), { x: 0, y: 0 });
approachCoordinator.update(16);
assert.deepEqual(approachCoordinator.getMovementDirection(), { x: 1, y: 0 });
approachPlayer.motor.position = { x: 24, y: 8 };
approachPlayer.sprite = { x: 24, y: 8 };
approachCoordinator.update(16);
assert.equal(approachCoordinator.getState().phase, "enter");
approachCoordinator.update(500);
assert.equal(activeFacility, "table");
assert.deepEqual({ x: approachPlayer.visual.pose.x, y: approachPlayer.visual.pose.y }, { x: 24, y: 8 }, "table activation stays at the chosen surrounding point");
approachCoordinator.exit();
approachCoordinator.update(650);
assert.deepEqual(approachPlayer.motor.position, { x: 24, y: 8 }, "activity exit leaves motor at the chosen approach point");
approachPlayer.motor.movement.velocity = { x: 4, y: -2 };
assert.equal(approachCoordinator.beginToiletAccident({ witnessed: false }).status, "started");
assert.deepEqual(approachPlayer.motor.movement.velocity, { x: 0, y: 0 }, "toilet accident stops the motor at its safe point");
assert.equal(approachCoordinator.getProtectedNeed(), "toilet");
assert.equal(approachCoordinator.exit("emergency").status, "transition-locked", "toilet accident ignores every exit priority");
approachCoordinator.update(4249);
assert.equal(approachCoordinator.isLocked(), true);
approachCoordinator.update(1);
assert.equal(approachCoordinator.isLocked(), false, "control returns only after the complete accident timeline");
assert.deepEqual(approachPlayer.motor.position, { x: 24, y: 8 }, "accident presentation never moves the motor");

const debugState = freshState();
const debugRuntime = createNeedsRuntime({ sessionState: debugState, tuning });
debugRuntime.setDebugPreset("hungry");
assert.equal(debugState.gameplay.needs.satiety, 0);
assert.equal(debugRuntime.shouldSuppressPersistence(), true, "debug preset is runtime-only");
debugRuntime.clearDebugPreset();
assert.equal(debugState.gameplay.needs.satiety, 100);
assert.equal(debugRuntime.shouldSuppressPersistence(), false);
console.log("Task #061 checks passed: needs day, physical L, protected transitions, collapse, T accident, movement, recovery and debug isolation");
