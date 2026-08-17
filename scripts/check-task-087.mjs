import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SELLABLE_ITEM_IDS } from "../src/tavern/cookingDomain.js";
import {
  createDefaultVenueOffer,
  isVenueOfferItemActive,
  normalizeVenueOffer,
  setVenueOfferItemActive,
  toggleVenueOfferItem,
} from "../src/tavern/venueOfferDomain.js";
import {
  createFreshGameSessionState,
  normalizeGameSessionState,
  SESSION_STATE_VERSION,
} from "../src/session/gameSessionState.js";
import {
  deserializeSessionEnvelope,
  SAVE_SCHEMA_VERSION,
  serializeSessionEnvelope,
} from "../src/session/sessionPersistence.js";
import {
  clampVenueMenuScrollIndex,
  VENUE_MENU_VISIBLE_ROW_COUNT,
  venueMenuMaxScrollIndex,
  venueMenuVisibleRows,
} from "../src/tavern/venueMenuRuntime.js";

const clone = (value) => JSON.parse(JSON.stringify(value));

assert.equal(SESSION_STATE_VERSION, 19);
assert.equal(SAVE_SCHEMA_VERSION, 19);
assert.deepEqual(SELLABLE_ITEM_IDS, ["fried-potato-dish", "lemonade"]);
assert.deepEqual(createDefaultVenueOffer(), { foodItemIds: [...SELLABLE_ITEM_IDS] });
assert.deepEqual(
  normalizeVenueOffer({ foodItemIds: ["lemonade", "unknown", "lemonade", "fried-potato-dish"] }),
  { foodItemIds: [...SELLABLE_ITEM_IDS] },
  "normalization uses canonical order, deduplicates and drops unknown IDs",
);
assert.deepEqual(normalizeVenueOffer({ foodItemIds: [] }), { foodItemIds: [] }, "an empty offer is valid");
assert.deepEqual(normalizeVenueOffer({ foodItemIds: "corrupted" }), createDefaultVenueOffer());

const mutableOffer = createDefaultVenueOffer();
assert.equal(setVenueOfferItemActive(mutableOffer, "fried-potato-dish", false).mutated, true);
assert.deepEqual(mutableOffer.foodItemIds, ["lemonade"]);
assert.equal(isVenueOfferItemActive(mutableOffer, "fried-potato-dish"), false);
assert.equal(toggleVenueOfferItem(mutableOffer, "fried-potato-dish").mutated, true);
assert.deepEqual(mutableOffer.foodItemIds, [...SELLABLE_ITEM_IDS]);
assert.equal(setVenueOfferItemActive(mutableOffer, "unknown", true).status, "unknown-item");

const overflowItemIds = Array.from({ length: 8 }, (_, index) => `dish-${index + 1}`);
assert.equal(VENUE_MENU_VISIBLE_ROW_COUNT, 2);
assert.equal(venueMenuMaxScrollIndex(overflowItemIds.length), 6);
assert.equal(clampVenueMenuScrollIndex(99, overflowItemIds.length), 6);
assert.equal(clampVenueMenuScrollIndex(-4, overflowItemIds.length), 0);
assert.deepEqual(
  venueMenuVisibleRows(overflowItemIds, 3).map(({ itemId, itemIndex, slot }) => ({ itemId, itemIndex, slot })),
  [
    { itemId: "dish-4", itemIndex: 3, slot: 0 },
    { itemId: "dish-5", itemIndex: 4, slot: 1 },
  ],
  "an overflow menu renders one bounded two-row window at the requested scroll index",
);

const fresh = createFreshGameSessionState();
assert.deepEqual(fresh.gameplay.venueOffer, createDefaultVenueOffer());
const populationBaseline = clone(fresh.gameplay.population);
setVenueOfferItemActive(fresh.gameplay.venueOffer, "fried-potato-dish", false);
const reloaded = deserializeSessionEnvelope(serializeSessionEnvelope(fresh));
assert.equal(reloaded.status, "loaded");
assert.deepEqual(reloaded.state.gameplay.venueOffer, { foodItemIds: ["lemonade"] });
assert.deepEqual(reloaded.state.gameplay.population, populationBaseline);

const v13State = clone(createFreshGameSessionState());
v13State.version = 13;
delete v13State.gameplay.venueOffer;
const v13Gameplay = clone(v13State.gameplay);
const migrated = deserializeSessionEnvelope(JSON.stringify({ schemaVersion: 13, state: v13State }));
assert.equal(migrated.status, "loaded");
assert.equal(migrated.schemaVersion, 19);
assert.equal(migrated.state.version, 19);
assert.deepEqual(migrated.state.gameplay.venueOffer, createDefaultVenueOffer());
const migratedGameplay = clone(migrated.state.gameplay);
delete migratedGameplay.venueOffer;
assert.deepEqual(migratedGameplay, v13Gameplay, "v13 migration changes only the venue offer and schema version");

const corrupted = clone(createFreshGameSessionState());
corrupted.gameplay.venueOffer = {
  foodItemIds: ["lemonade", "unknown-item", "lemonade", "fried-potato-dish"],
  quantities: { lemonade: 99 },
  prices: { lemonade: 1 },
};
const recovered = normalizeGameSessionState(corrupted);
assert.deepEqual(recovered.gameplay.venueOffer, { foodItemIds: [...SELLABLE_ITEM_IDS] });
assert.deepEqual(recovered.gameplay.population, corrupted.gameplay.population);

const serviceSource = readFileSync("src/tavern/tavernServiceRuntime.js", "utf8");
const guestSource = readFileSync("src/tavern/guestRuntime.js", "utf8");
for (const exactOrderContract of [
  "guestRuntime.spawnVisitGroup", "orderItemId: decision.bestOfferItemId",
  "acceptableItemIds: decision.acceptableItemIds", "options: { offerFit: decision.bestOfferFit }",
]) assert(serviceSource.includes(exactOrderContract), `visit materialization keeps ${exactOrderContract}`);
assert(serviceSource.includes("isOrderItemActive: (itemId) => isVenueOfferItemActive(sessionState.gameplay.venueOffer, itemId)"));
assert(guestSource.includes("isOrderItemActive(visit.order.itemId)"));
const coordinatorSource = readFileSync("src/interaction/worldInteractionCoordinator.js", "utf8");
assert(coordinatorSource.includes("venueMenuRuntime?.handleSignInteraction"));
assert(!coordinatorSource.includes("gameplay.venueOffer") && !coordinatorSource.includes("foodItemIds"));
const mainSource = readFileSync("src/main.js", "utf8");
assert(!mainSource.includes("gameplay.venueOffer") && !mainSource.includes("foodItemIds"));
const bridgeSource = readFileSync("src/devtools/e2eBridge.js", "utf8");
for (const method of ["getVenueOffer", "setVenueOfferItemActive", "toggleVenueOfferItem", "getTavernOpen"]) {
  assert(bridgeSource.includes(`${method}:`), `E2E bridge exposes ${method}`);
}
const menuSource = readFileSync("src/tavern/venueMenuRuntime.js", "utf8");
assert(menuSource.includes("hud:venueMenu.title"));
assert(menuSource.includes("hud:venueMenu.active") && menuSource.includes("hud:venueMenu.inactive"));
assert(menuSource.includes("hud:venueMenu.closeHint") && menuSource.includes('keyboard.on("keydown-SPACE"'));
assert(menuSource.includes('scene.input.on("wheel"') && menuSource.includes('scene.input.on("pointermove"'));
assert(menuSource.includes("toggleTavernActive") && menuSource.includes("sessionState.gameplay.tavernOpen = next"));
assert(!menuSource.includes("hud:venueMenu.open") && !menuSource.includes("VENUE_MENU_OPEN_AREA"));
const locationSource = readFileSync("src/world/worldLocationRuntime.js", "utf8");
assert(locationSource.includes("if (!active) this.callbacks.suppressNextInteract?.()"));
const signSource = readFileSync("src/tavern/tavernSignRuntime.js", "utf8");
assert(signSource.includes('prompt: "hud:interaction.manageTavern"'));
assert(!signSource.includes('prompt: getTavernOpen() ?'));

console.log("Task #087 contracts OK");
