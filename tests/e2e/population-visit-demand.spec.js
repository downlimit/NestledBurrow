import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

async function bridge(page, method, argument) {
  return page.evaluate(
    ({ method, argument }) => window.__NESTLED_BURROW_E2E__?.[method]?.(argument),
    { method, argument },
  );
}

async function bootFresh(page) {
  await page.setViewportSize({ width: 320, height: 180 });
  await page.goto("./?movementDebug=1");
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
}

async function clickLogical(page, point) {
  const canvas = await page.locator("canvas").boundingBox();
  if (!canvas) throw new Error("Game canvas is unavailable");
  await page.mouse.click(canvas.x + point.x * canvas.width / 320, canvas.y + point.y * canvas.height / 180);
}

async function openTavern(page) {
  await expect.poll(async () => {
    await bridge(page, "placePlayerNear", "tavern-open-sign");
    return (await bridge(page, "getInteractionState"))?.candidate?.entityId;
  }).toBe("tavern-open-sign");
  await bridge(page, "interact");
  await expect.poll(async () => (await bridge(page, "getTavernState")).menu?.active).toBe(true);
  await clickLogical(page, { x: 108, y: 130 });
  await expect.poll(() => bridge(page, "getTavernOpen")).toBe(true);
  await clickLogical(page, { x: 12, y: 90 });
  await expect.poll(async () => (await bridge(page, "getTavernState")).menu?.active).toBe(false);
}

async function advanceUntil(page, read, predicate, { maxMs = 35_000, stepMs = 250 } = {}) {
  for (let elapsedMs = 0; elapsedMs <= maxMs; elapsedMs += stepMs) {
    const value = await read();
    if (predicate(value)) return value;
    await bridge(page, "advanceWorldSimulation", stepMs);
  }
  const value = await read();
  expect(predicate(value)).toBe(true);
  return value;
}

const lemonadePreference = {
  cuisine: { local: 1 },
  dishClass: { hot: -1, drink: 1 },
  ingredient: { potato: -1, lemon: 1 },
};

test("inactive menu pauses opportunities; active zero-stock menu can create one persistent visitor", async ({ page }) => {
  await bootFresh(page);
  const session = await bridge(page, "getSession");
  const personId = session.gameplay.population[0].id;
  const targetWorldTimeSeconds = session.gameplay.worldTimeSeconds + 60 * 60;
  await bridge(page, "setWorldTimeSeconds", targetWorldTimeSeconds);
  await bridge(page, "setPopulationPersonDemand", {
    personId,
    satiety: 0,
    spendingCapacity: 2,
    foodPreferences: lemonadePreference,
  });
  await bridge(page, "setServingStock", { itemId: null, quantity: 0 });
  await bridge(page, "setVisitCandidatePersonId", personId);
  await bridge(page, "setVisitDecisionRoll", 0);
  await bridge(page, "setVisitOpportunityRemainingMs", 100);
  await bridge(page, "advanceWorldSimulation", 500);
  expect((await bridge(page, "getTavernState")).guest.active).toBe(false);
  expect(await bridge(page, "getLastVisitDecision")).toBeNull();
  expect((await bridge(page, "getTavernState")).service.demand.opportunityRemainingMs).toBe(100);

  await openTavern(page);
  await bridge(page, "advanceWorldSimulation", 150);
  const decision = await bridge(page, "getLastVisitDecision");
  expect(decision).toMatchObject({
    personId,
    spendingCapacity: 2,
    activeMenuItemIds: ["fried-potato-dish", "lemonade"],
    bestOfferItemId: "lemonade",
    acceptableItemIds: ["lemonade"],
    decision: "VISIT",
    reason: "visit",
  });
  expect(decision.foodMotive).toBeGreaterThan(0);
  expect(decision.roll).toBe(0);
  expect(await bridge(page, "getGuestPersonMapping")).toEqual({ "tavern-guest-1": personId });
  expect((await bridge(page, "getPopulationPerson", personId)).lastEvaluatedWorldTimeSeconds)
    .toBeGreaterThanOrEqual(targetWorldTimeSeconds);

  const signState = await advanceUntil(
    page,
    async () => (await bridge(page, "getTavernState")).guest,
    ({ state }) => state === "checking-sign" || state === "leaving",
  );
  expect(["checking-sign", "leaving"]).toContain(signState.state);
  expect(signState.reservedDish).toBe(false);

  await bridge(page, "setVisitCandidatePersonId", personId);
  expect((await bridge(page, "forceVisitOpportunity")).status).toBe("no-candidate");
  await bridge(page, "setVisitOpportunityRemainingMs", 1_000_000);
  await advanceUntil(
    page,
    async () => (await bridge(page, "getTavernState")).guest.active,
    (active) => active === false,
  );
  expect(await bridge(page, "getVisitorHistory")).toEqual({});
});

test("one refusal is not replaced and exposes the full decision breakdown", async ({ page }) => {
  await bootFresh(page);
  await openTavern(page);
  await bridge(page, "setVisitOpportunityRemainingMs", 1_000_000);
  const person = (await bridge(page, "getPopulation"))[0];
  await bridge(page, "setPopulationPersonDemand", { personId: person.id, satiety: 100 });
  await bridge(page, "setVisitCandidatePersonId", person.id);
  await bridge(page, "setVisitDecisionRoll", 0);
  const result = await bridge(page, "forceVisitOpportunity");
  expect(result.status).toBe("decision-complete");
  expect(result.guestId).toBeNull();
  expect(result.decision).toMatchObject({
    personId: person.id,
    foodMotive: 0,
    decision: "NO_VISIT",
    reason: "no-food-motive",
    roll: null,
  });
  expect((await bridge(page, "getTavernState")).guest.activeCount).toBe(0);
});

test("acceptable stock completes once, persists personId and updates visitor history", async ({ page }) => {
  await bootFresh(page);
  const person = (await bridge(page, "getPopulation"))[0];
  await bridge(page, "setPopulationPersonDemand", {
    personId: person.id,
    satiety: 0,
    spendingCapacity: 2,
    foodPreferences: lemonadePreference,
  });
  await bridge(page, "setServingStock", { itemId: "lemonade", quantity: 1 });
  await openTavern(page);
  await bridge(page, "setVisitOpportunityRemainingMs", 1_000_000);
  await bridge(page, "setVisitCandidatePersonId", person.id);
  await bridge(page, "setVisitDecisionRoll", 0);
  expect((await bridge(page, "forceVisitOpportunity")).guestId).toBe("tavern-guest-1");
  await advanceUntil(page, async () => (await bridge(page, "getCoinState")).length, (count) => count === 1);
  const history = await bridge(page, "getVisitorHistory");
  expect(history[person.id].completedVisitCount).toBe(1);
  expect(history[person.id].lastCompletedVisitWorldTimeSeconds).toBeGreaterThanOrEqual(0);
  expect(await bridge(page, "getGuestPersonMapping")).toEqual({ "tavern-guest-1": person.id });

  expect((await bridge(page, "saveSession")).status).toBe("saved");
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  expect(await bridge(page, "getGuestPersonMapping")).toEqual({ "tavern-guest-1": person.id });
  expect(await bridge(page, "getVisitorHistory")).toEqual(history);
  await bridge(page, "setVisitOpportunityRemainingMs", 1_000_000);
  await bridge(page, "advanceWorldSimulation", 2_000);
  expect((await bridge(page, "getVisitorHistory"))[person.id].completedVisitCount).toBe(1);
});
