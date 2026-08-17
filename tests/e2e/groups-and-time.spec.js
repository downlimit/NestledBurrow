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
  await bridge(page, "setVisitOpportunityRemainingMs", 1_000_000);
}

const lemonadePreferences = {
  cuisine: { local: 1 },
  dishClass: { hot: -1, drink: 1 },
  ingredient: { potato: -1, lemon: 1 },
};
const potatoPreferences = {
  cuisine: { local: 1 },
  dishClass: { hot: 1, drink: -1 },
  ingredient: { potato: 1, lemon: -1 },
};

test("same random input exposes time-sensitive candidate weights and stable saved social profiles", async ({ page }) => {
  await bootFresh(page);
  await bridge(page, "setWorldTimeSeconds", 8 * 60 * 60);
  const population = await bridge(page, "getPopulation");
  const socialProfiles = Object.fromEntries(population.map((person) => [person.id, {
    relatedPersonIds: person.relatedPersonIds,
    preferredVisitPeriods: person.preferredVisitPeriods,
  }]));
  for (const person of population) {
    await bridge(page, "setPopulationPersonDemand", { personId: person.id, satiety: 100 });
  }
  await openTavern(page);
  await bridge(page, "setGuestRandomValue", 0.35);
  await bridge(page, "forceVisitOpportunity");
  const morning = await bridge(page, "getLastVisitGroup");
  expect(morning.period).toBe("morning");
  expect(morning.primaryCandidate.personId).toMatch(/^person-/);
  expect(morning.candidateWeights.find(({ personId }) => personId === "person-mira")).toMatchObject({
    preferredTime: true,
    timeFactor: 1,
  });

  await bridge(page, "setWorldTimeSeconds", 20 * 60 * 60);
  for (const person of population) {
    await bridge(page, "setPopulationPersonDemand", { personId: person.id, satiety: 100 });
  }
  await bridge(page, "setGuestRandomValue", 0.35);
  await bridge(page, "forceVisitOpportunity");
  const evening = await bridge(page, "getLastVisitGroup");
  const eveningMira = evening.candidateWeights.find(({ personId }) => personId === "person-mira");
  expect(evening.period).toBe("evening");
  expect(eveningMira).toMatchObject({ preferredTime: false, timeFactor: 0.2 });
  expect(eveningMira.timeFactor).toBeLessThan(
    morning.candidateWeights.find(({ personId }) => personId === "person-mira").timeFactor,
  );
  expect(eveningMira.reputationFactor).toBe(
    morning.candidateWeights.find(({ personId }) => personId === "person-mira").reputationFactor,
  );

  expect((await bridge(page, "saveSession")).status).toBe("saved");
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  const reloaded = await bridge(page, "getPopulation");
  expect(Object.fromEntries(reloaded.map((person) => [person.id, {
    relatedPersonIds: person.relatedPersonIds,
    preferredVisitPeriods: person.preferredVisitPeriods,
  }]))).toEqual(socialProfiles);
});

test("related on-time people decide independently and materialize with exact personal orders", async ({ page }) => {
  await bootFresh(page);
  await bridge(page, "setWorldTimeSeconds", 8 * 60 * 60);
  await openTavern(page);
  const leadId = "person-ilya";
  const lemonadeId = "person-mira";
  const refusingId = "person-rowan";
  await bridge(page, "setPopulationPersonDemand", {
    personId: leadId,
    satiety: 0,
    spendingCapacity: 4,
    foodPreferences: potatoPreferences,
  });
  await bridge(page, "setPopulationPersonDemand", {
    personId: lemonadeId,
    satiety: 0,
    spendingCapacity: 2,
    foodPreferences: lemonadePreferences,
  });
  await bridge(page, "setPopulationPersonDemand", { personId: refusingId, satiety: 100 });

  const result = await bridge(page, "forceVisitOpportunity", {
    personId: leadId,
    includeGroup: true,
    rollsByPersonId: { [leadId]: 0, [lemonadeId]: 0, [refusingId]: 0 },
  });
  expect(result.status).toBe("group-visit-started");
  expect(result.visitGroup).toMatchObject({
    period: "morning",
    relatedCandidatePersonIds: [lemonadeId, refusingId],
    agreedPersonIds: [leadId, lemonadeId],
    materializedPersonIds: [leadId, lemonadeId],
  });
  expect(result.visitGroup.decisions.find(({ personId }) => personId === refusingId).decision)
    .toMatchObject({ decision: "NO_VISIT", reason: "no-food-motive" });
  expect(result.visitGroup.decisions.find(({ personId }) => personId === leadId).decision.bestOfferItemId)
    .toBe("fried-potato-dish");
  expect(result.visitGroup.decisions.find(({ personId }) => personId === lemonadeId).decision.bestOfferItemId)
    .toBe("lemonade");

  const guests = (await bridge(page, "getTavernState")).guest.guests;
  expect(guests).toHaveLength(2);
  expect(Object.fromEntries(guests.map((guest) => [guest.personId, guest.order.itemId]))).toEqual({
    [leadId]: "fried-potato-dish",
    [lemonadeId]: "lemonade",
  });
  expect(new Set(guests.map(({ id }) => id)).size).toBe(2);
  expect(new Set(guests.map(({ personId }) => personId)).size).toBe(2);
});

test("an agreeing group records person-specific open-unserved without partial spawn at the cap", async ({ page }) => {
  await bootFresh(page);
  await bridge(page, "setWorldTimeSeconds", 8 * 60 * 60);
  await openTavern(page);
  const population = await bridge(page, "getPopulation");
  const leadId = "person-ilya";
  const companionId = "person-mira";
  const refusingId = "person-rowan";
  const excluded = new Set([leadId, companionId, refusingId]);
  for (const person of population.filter(({ id }) => !excluded.has(id)).slice(0, 5)) {
    expect(await bridge(page, "forceGuestSpawn", person.id)).toMatch(/^tavern-guest-/);
  }
  expect((await bridge(page, "getTavernState")).guest.activeCount).toBe(5);
  for (const personId of [leadId, companionId]) {
    await bridge(page, "setPopulationPersonDemand", {
      personId,
      satiety: 0,
      spendingCapacity: 2,
      foodPreferences: lemonadePreferences,
    });
  }
  await bridge(page, "setPopulationPersonDemand", { personId: refusingId, satiety: 100 });

  const result = await bridge(page, "forceVisitOpportunity", {
    personId: leadId,
    includeGroup: true,
    rollsByPersonId: { [leadId]: 0, [companionId]: 0, [refusingId]: 0 },
  });
  expect(result).toMatchObject({
    status: "group-turned-away-cap",
    guestId: null,
    guestIds: [],
    visitGroup: {
      agreedPersonIds: [leadId, companionId],
      materializedPersonIds: [],
    },
  });
  expect((await bridge(page, "getTavernState")).guest.activeCount).toBe(5);
  const mapping = await bridge(page, "getGuestPersonMapping");
  expect(Object.values(mapping)).not.toContain(leadId);
  expect(Object.values(mapping)).not.toContain(companionId);
  const feedback = await bridge(page, "getTavernFeedback");
  expect(feedback.outcomeCounts.openUnserved).toBe(2);
  expect(feedback.venueOpinionsByPersonId[leadId].openUnservedCount).toBe(1);
  expect(feedback.venueOpinionsByPersonId[companionId].openUnservedCount).toBe(1);
  expect(feedback.venueOpinionsByPersonId[refusingId].openUnservedCount).toBe(0);
});
