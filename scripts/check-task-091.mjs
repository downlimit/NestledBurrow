import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  advanceLiveGuestNeeds,
  applyGuestNeedResolution,
  arbitrateGuestIntent,
  computeVisitSatisfactionTier,
  GUEST_INTENTS,
  menuReadingDurationMs,
  shouldDrinkTakeout,
  shouldInterruptOrder,
} from "../src/tavern/guestIntentDomain.js";
import { createStage1Population, setPopulationPersonNeed } from "../src/character/populationDomain.js";
import { normalizeTavernServiceState } from "../src/tavern/tavernServiceDomain.js";

const population = createStage1Population(100);
const person = population[0];
const sameReference = person;
const before = person.needs.satiety;
advanceLiveGuestNeeds(person, 1_000, { moving: true, worldTimeSeconds: 101 });
assert.equal(person, sameReference, "live advancement mutates the canonical persistent person");
assert(person.needs.satiety < before);
assert.equal(person.lastEvaluatedWorldTimeSeconds, 101);

const intentByNeed = {
  novelty: GUEST_INTENTS.wander,
  energy: GUEST_INTENTS.rest,
  satiety: GUEST_INTENTS.food,
  toilet: GUEST_INTENTS.toilet,
  lustre: GUEST_INTENTS.wash,
  dialogue: GUEST_INTENTS.social,
};
for (const [needId, expectedIntent] of Object.entries(intentByNeed)) {
  for (const id of Object.keys(person.needs)) setPopulationPersonNeed(population, person.id, id, 100, 102);
  const result = setPopulationPersonNeed(population, person.id, needId, 5, 102);
  const livePerson = population.find(({ id }) => id === person.id);
  assert.equal(result.person, livePerson, `inspector keeps the same ${needId} person binding`);
  const intent = arbitrateGuestIntent(livePerson);
  assert.equal(intent.intent, expectedIntent, `${needId} pressure maps to ${expectedIntent}`);
  if (needId !== "satiety") assert.equal(shouldInterruptOrder(intent, "accepted"), true);
}

const hysteresisPerson = population[0];
hysteresisPerson.needs = { novelty: 30, energy: 29, satiety: 100, toilet: 100, lustre: 100, dialogue: 100 };
assert.equal(arbitrateGuestIntent(hysteresisPerson, GUEST_INTENTS.wander).intent, GUEST_INTENTS.wander);
applyGuestNeedResolution(hysteresisPerson, GUEST_INTENTS.wander, 50);
assert.equal(arbitrateGuestIntent(hysteresisPerson, GUEST_INTENTS.wander).intent, GUEST_INTENTS.rest);
assert.equal(menuReadingDurationMs(1), 2_500);
assert.equal(menuReadingDurationMs(0), 6_000);
assert.equal(shouldDrinkTakeout({ needs: { novelty: 100, energy: 100, satiety: 5, toilet: 100, lustre: 100, dialogue: 100 } }), true);
assert.equal(shouldDrinkTakeout({ needs: { novelty: 5, energy: 100, satiety: 5, toilet: 100, lustre: 100, dialogue: 100 } }), false);
assert.equal(computeVisitSatisfactionTier({ fulfillmentElapsedMs: 10_000 }), 4);
assert.equal(computeVisitSatisfactionTier({ failed: true }), 1);

const persisted = normalizeTavernServiceState({
  nextGuestId: 1,
  guests: [{
    id: "tavern-guest-1",
    personId: population[0].id,
    state: "accepted-order",
    stateElapsedMs: 20,
    position: { x: 10, y: 20 },
    order: { itemId: "fried-potato-dish", status: "accepted", statusElapsedMs: 42_000 },
    servingTableId: "home-serving-table-01",
    diningTableId: "legacy-dining-table",
    menuStarted: true,
    menuElapsedMs: 2_500,
    menuDurationMs: 2_500,
    menuComplete: true,
  }],
}, { population });
assert.equal(persisted.guests.length, 1);
assert.equal(persisted.guests[0].personId, population[0].id);
assert.equal(persisted.guests[0].order.statusElapsedMs, 42_000);
assert.equal(persisted.guests[0].servingTableId, "home-serving-table-01");
assert.equal(Object.hasOwn(persisted.guests[0], "diningTableId"), false);

const guestSource = readFileSync("src/tavern/guestRuntime.js", "utf8");
const serviceSource = readFileSync("src/tavern/tavernServiceRuntime.js", "utf8");
const facilitySource = readFileSync("src/facilities/facilityConfig.js", "utf8");
const overheadSource = readFileSync("src/tavern/overheadPresentationRuntime.js", "utf8");
const presentationSource = readFileSync("src/ui/presentationCameraRuntime.js", "utf8");
const styleSource = readFileSync("src/style.css", "utf8");
for (const contract of ["advanceLiveGuestNeeds", "maybeInterruptOrder", "resumeOrderFlow", "servedItemOnTable", "showSatisfaction", "GUEST_TALK_INTERACTION_KIND"]) {
  assert(guestSource.includes(contract), `guest runtime exposes ${contract}`);
}
assert(!serviceSource.includes("diningTableByGuest"));
assert(!serviceSource.includes("reserveSeat"));
assert(serviceSource.includes("serviceCapableDefinitions"));
assert(facilitySource.includes('capabilities: Object.freeze(type === "serving-table" ? ["guest-service"] : [])'));
assert(facilitySource.includes("NestledBurrow_Sink.png"));
for (const visualContract of ["CROSSFADE_MS = 200", "SCALE_TRANSITION_MS = 180", "THOUGHT_ALTERNATION_MS = 1_200", "PIXEL_DENSITY = 6", "LINEAR_TEXTURE_FILTER = 0", "setFilter(LINEAR_TEXTURE_FILTER)", "UI_ACTION_WIDTH = 22", "UI_SATISFACTION_WIDTH = 20", "UI_THOUGHT_WIDTH = 36", "UI_THOUGHT_ICON_SIZE = 15", "THOUGHT_ICON_SCREEN_OFFSET_Y = -3", "ACTION_SCREEN_OFFSET_Y = 22", "THOUGHT_SCREEN_OFFSET_Y = 32", "THOUGHT_TAIL_SCREEN_OFFSET_X = 8", 'imageSmoothingQuality = "high"', "HUD_DEPTH - 5", "HUD_DEPTH - 4", "HUD_DEPTH - 3", "displayedThought", "alternateThought", "updateThoughtAlternation", "[1, 0, 1, 2]", "frameCount, sequence", "thoughtAboveAction: false", "actionAboveThought: true", "setFlipX", "createCanvas", "setScrollFactor(1)", "setSizeToFrame", "updateDisplayOrigin", "actionSpriteCount: 1", "worldToUi", "screenGeometry", "pointerWithinIcon", "drawChannelOverlay", '"lighter"', 'crossfadeMode: "premultiplied-additive"']) {
  assert(overheadSource.includes(visualContract), `overhead presentation keeps ${visualContract}`);
}
assert(!overheadSource.includes("setCrop"), "flipbooks render a frame into one UI canvas instead of moving crop windows");
assert(!overheadSource.includes("frameTransitionAlpha"), "frame crossfade never fades the sole sprite through zero alpha");
assert(!overheadSource.includes("document.") && !overheadSource.includes("overhead-ui-canvas"), "overhead visuals stay inside the single Phaser renderer");
assert(presentationSource.includes("PRESENTATION_DENSITY = 3"), "the shared framebuffer provides three physical samples per logical pixel");
assert(presentationSource.includes("setOrigin(0, 0).setScroll(0, 0).setZoom(PRESENTATION_DENSITY)"), "high-density UI retains the logical top-left origin for rendering and input");
assert(styleSource.includes("#game:fullscreen") && styleSource.includes("background: #000"), "fullscreen ultrawide side curtains stay black");
const feedbackSource = readFileSync("src/tavern/guestFeedback.js", "utf8");
assert(!feedbackSource.includes('":D"') && !feedbackSource.includes('":("'), "guest feedback contains no ASCII faces");
assert(feedbackSource.includes('state === "open-reaction" ? 3'), "open-tavern reaction uses satisfaction tier 3");
assert(feedbackSource.includes("overhead.setOrderItem({ itemId, label: itemLabel, progress })"), "waiting guest shows the exact ordered item");
assert(feedbackSource.includes("preservesPendingOrder"), "need actions preserve the ordered dish for thought alternation");

const expectedHashes = {
  "public/assets/project/facilities/NestledBurrow_Sink.png": "3dac0fc0c8417e576dd522311c471c2023b5255c444fafd57d2db7ed005b46b8",
  "public/assets/project/characters/overhead/NestledBurrow_MindBubble.png": "863c51c8d30a12850f06c659b75c61ef98acdc77eb3d1d71dc4411c5321b7daa",
  "public/assets/project/characters/overhead/NestledBurrow_ActionTalk.png": "02df684f1be9a5529743fa6489f7da3a9f2028c68b177157963b0ea5e5ccff95",
  "public/assets/project/characters/overhead/NestledBurrow_SatisfactionTiers.png": "812eebe32a4902fa2576bbe6dfe3d96beaf462692654bf559ebb50f58d5034f3",
};
for (const [path, expected] of Object.entries(expectedHashes)) {
  assert.equal(createHash("sha256").update(readFileSync(path)).digest("hex"), expected, `${path} is immutable`);
}

console.log("Task #091 live guest needs, service-place and overhead contracts OK");
