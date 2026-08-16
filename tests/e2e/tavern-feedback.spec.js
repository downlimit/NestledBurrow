import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

async function bridge(page, method, argument) {
  return page.evaluate(
    ({ method, argument }) => window.__NESTLED_BURROW_E2E__?.[method]?.(argument),
    { method, argument },
  );
}

async function bootFresh(page) {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto("./?movementDebug=1");
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
}

async function clickLogical(page, point) {
  const canvas = await page.locator("canvas").boundingBox();
  if (!canvas) throw new Error("Game canvas is unavailable");
  await page.mouse.click(canvas.x + point.x * canvas.width / 640, canvas.y + point.y * canvas.height / 360);
}

async function openTavern(page) {
  await expect.poll(async () => {
    await bridge(page, "placePlayerNear", "tavern-open-sign");
    return (await bridge(page, "getInteractionState"))?.candidate?.entityId;
  }).toBe("tavern-open-sign");
  await bridge(page, "interact");
  await expect.poll(async () => (await bridge(page, "getTavernState")).menu?.active).toBe(true);
  await clickLogical(page, { x: 268, y: 220 });
  await expect.poll(() => bridge(page, "getTavernOpen")).toBe(true);
  await clickLogical(page, { x: 12, y: 90 });
  await expect.poll(async () => (await bridge(page, "getTavernState")).menu?.active).toBe(false);
}

const lemonadePreference = {
  cuisine: { local: 1 },
  dishClass: { hot: -1, drink: 1 },
  ingredient: { potato: -1, lemon: 1 },
};

function opinionValues(feedback) {
  return Object.fromEntries(Object.entries(feedback.venueOpinionsByPersonId).map(([personId, entry]) => [
    personId,
    {
      score: entry.score,
      completedVisitCount: entry.completedVisitCount,
      openUnservedCount: entry.openUnservedCount,
      acceptedOrderFailureCount: entry.acceptedOrderFailureCount,
    },
  ]));
}

test("forced flow spike stays physically bounded and records excess willing demand", async ({ page }) => {
  await bootFresh(page);
  await openTavern(page);
  await bridge(page, "setVisitOpportunityRemainingMs", 1_000_000);
  const population = await bridge(page, "getPopulation");
  const beforeFlow = await bridge(page, "getTavernFeedback");
  expect(await bridge(page, "setTavernFlowPressure", 1)).toMatchObject({
    mutated: true,
    flowPressure: 1,
  });
  expect(await bridge(page, "boostTavernFlowPressure", 999)).toMatchObject({
    mutated: false,
    flowPressure: 1,
  });
  const afterFlow = await bridge(page, "getTavernFeedback");
  expect(afterFlow.reputationProfile).toEqual(beforeFlow.reputationProfile);
  expect(afterFlow.venueOpinionsByPersonId).toEqual(beforeFlow.venueOpinionsByPersonId);

  for (const person of population.slice(0, 6)) {
    expect(await bridge(page, "forceGuestSpawn", person.id)).toMatch(/^tavern-guest-/);
  }
  expect((await bridge(page, "getTavernState")).guest.activeCount).toBe(6);

  const turnedAwayPerson = population[6];
  await bridge(page, "setPopulationPersonDemand", {
    personId: turnedAwayPerson.id,
    satiety: 0,
    spendingCapacity: 2,
    foodPreferences: lemonadePreference,
  });
  const result = await bridge(page, "forceVisitOpportunity", { personId: turnedAwayPerson.id, roll: 0 });
  expect(result).toMatchObject({
    status: "visitor-turned-away-cap",
    guestId: null,
    decision: {
      personId: turnedAwayPerson.id,
      decision: "VISIT",
      capacityOutcome: "open-unserved",
    },
    feedback: { outcome: "open-unserved", personId: turnedAwayPerson.id },
  });
  expect((await bridge(page, "getTavernState")).guest.activeCount).toBe(6);
  const feedback = await bridge(page, "getTavernFeedback");
  expect(feedback.outcomeCounts.openUnserved).toBe(1);
  expect(feedback.venueOpinionsByPersonId[turnedAwayPerson.id].score).toBeLessThan(0);

  expect((await bridge(page, "saveSession")).status).toBe("saved");
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  const reloaded = await bridge(page, "getTavernFeedback");
  expect(reloaded.outcomeCounts.openUnserved).toBe(1);
  expect(reloaded.flowPressure).toBe(feedback.flowPressure);
  expect(reloaded.venueOpinionsByPersonId[turnedAwayPerson.id])
    .toEqual(feedback.venueOpinionsByPersonId[turnedAwayPerson.id]);
});

test("flow pressure changes deterministic opportunity cadence without audience-profile drift", async ({ page }) => {
  await bootFresh(page);
  await openTavern(page);
  const person = (await bridge(page, "getPopulation"))[0];
  await bridge(page, "setPopulationPersonDemand", { personId: person.id, satiety: 100 });
  await bridge(page, "setGuestRandomValue", 0.5);

  await bridge(page, "setTavernFlowPressure", 0);
  await bridge(page, "setVisitCandidatePersonId", person.id);
  await bridge(page, "setVisitOpportunityRemainingMs", 0);
  await bridge(page, "advanceWorldSimulation", 1);
  const lowFlowDelay = (await bridge(page, "getTavernState")).service.demand.opportunityRemainingMs;
  const lowFlowAudience = await bridge(page, "getTavernFeedback");

  await bridge(page, "setTavernFlowPressure", 1);
  await bridge(page, "setVisitCandidatePersonId", person.id);
  await bridge(page, "setVisitOpportunityRemainingMs", 0);
  await bridge(page, "advanceWorldSimulation", 1);
  const highFlowDelay = (await bridge(page, "getTavernState")).service.demand.opportunityRemainingMs;
  const highFlowAudience = await bridge(page, "getTavernFeedback");

  expect(highFlowDelay).toBeLessThan(lowFlowDelay);
  expect(highFlowAudience.reputationProfile).toEqual(lowFlowAudience.reputationProfile);
  expect(opinionValues(highFlowAudience)).toEqual(opinionValues(lowFlowAudience));
});
