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
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  await page.evaluate(async () => {
    const previous = window.__NESTLED_BURROW_E2E__;
    previous.newGame();
    await new Promise((resolve) => {
      const check = () => window.__NESTLED_BURROW_E2E__ !== previous ? resolve() : requestAnimationFrame(check);
      requestAnimationFrame(check);
    });
  });
}

function inventoryQuantity(session, itemId) {
  return session.gameplay.inventory.slots
    .filter((slot) => slot?.id === itemId)
    .reduce((total, slot) => total + slot.quantity, 0);
}

test("BUILD/TEST grants and persistent person inspection share canonical gameplay state", async ({ page }) => {
  await bootFresh(page);
  await bridge(page, "toggleBuildMode");
  expect(await bridge(page, "getBuildModeState")).toMatchObject({ active: true, view: "build", selectedId: null });
  expect(await bridge(page, "setBuildPanelView", "test")).toBe(true);
  expect(await bridge(page, "getBuildModeState")).toMatchObject({ active: true, view: "test", selectedId: null });

  const before = await bridge(page, "getSession");
  expect(await bridge(page, "grantSimulationTestItem", { itemId: "fried-potato-dish", quantity: 10 })).toMatchObject({
    mutated: true,
    accepted: 10,
    remaining: 0,
  });
  expect(await bridge(page, "grantSimulationTestItem", { itemId: "lemonade", quantity: 10 })).toMatchObject({
    mutated: true,
    accepted: 10,
    remaining: 0,
  });
  expect(await bridge(page, "grantSimulationTestCoins", 100)).toMatchObject({ mutated: true, value: 100 });
  const granted = await bridge(page, "getSession");
  expect(inventoryQuantity(granted, "fried-potato-dish")).toBe(inventoryQuantity(before, "fried-potato-dish") + 10);
  expect(inventoryQuantity(granted, "lemonade")).toBe(inventoryQuantity(before, "lemonade") + 10);
  expect(granted.gameplay.coins).toBe(before.gameplay.coins + 100);
  expect(await bridge(page, "getBuildModeState")).toMatchObject({ view: "test", selectedId: null });

  const personId = "person-mira";
  const guestId = await bridge(page, "forceGuestOrder", { personId, itemId: "lemonade" });
  expect(guestId).toMatch(/^tavern-guest-/u);
  const guest = (await bridge(page, "getTavernState")).guest.guests.find(({ id }) => id === guestId);
  await bridge(page, "placePlayerAt", guest.position);
  await bridge(page, "advanceWorldSimulation", 50);
  expect(await bridge(page, "forcePersonInspectionExpanded", personId)).toBe(true);

  const inspection = await bridge(page, "getPersonInspectionState");
  const persistentBefore = await bridge(page, "getPopulationPerson", personId);
  const orderBefore = await bridge(page, "getGuestOrder", guestId);
  expect(inspection).toMatchObject({ personId, displayName: "Mira", expanded: true, expandProgress: 1 });
  expect(inspection.needs.map(({ id }) => id)).toEqual(["novelty", "energy", "satiety", "toilet", "lustre", "dialogue"]);
  expect(inspection.needs.map(({ value }) => value)).toEqual([
    persistentBefore.needs.novelty,
    persistentBefore.needs.energy,
    persistentBefore.needs.satiety,
    persistentBefore.needs.toilet,
    persistentBefore.needs.lustre,
    persistentBefore.needs.dialogue,
  ]);

  const mutationSnapshot = await page.evaluate((inspectedPersonId) => {
    const e2e = window.__NESTLED_BURROW_E2E__;
    const mutation = e2e.setInspectedPersonNeed({ needId: "satiety", value: 10 });
    return {
      mutation,
      persistentPerson: e2e.getPopulationPerson(inspectedPersonId),
      worldTimeSeconds: e2e.getSession().gameplay.worldTimeSeconds,
    };
  }, personId);
  expect(mutationSnapshot.mutation).toMatchObject({
    status: "need-set",
    mutated: true,
  });
  const persistentAfter = mutationSnapshot.persistentPerson;
  expect(persistentAfter.needs.satiety).toBe(10);
  const worldTimeAfterMutation = mutationSnapshot.worldTimeSeconds;
  expect(persistentAfter.lastEvaluatedWorldTimeSeconds).toBe(worldTimeAfterMutation);
  for (const needId of ["novelty", "energy", "toilet", "lustre", "dialogue"]) {
    expect(persistentAfter.needs[needId]).toBe(persistentBefore.needs[needId]);
  }
  expect(await bridge(page, "getGuestOrder", guestId)).toEqual(orderBefore);
  expect(await bridge(page, "getBuildModeState")).toMatchObject({ view: "test", selectedId: null });

  expect((await bridge(page, "saveSession")).status).toBe("saved");
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  expect((await bridge(page, "getPopulationPerson", personId)).needs.satiety).toBe(10);
});

test("coarse-pointer inspection uses the same persistent mutation path", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "coarse-pointer contract runs on mobile");
  await bootFresh(page);
  const personId = "person-mira";
  expect(await bridge(page, "forceGuestOrder", { personId, itemId: "lemonade" })).toMatch(/^tavern-guest-/u);
  expect(await bridge(page, "forcePersonInspectionExpanded", personId)).toBe(true);
  expect(await bridge(page, "getPersonInspectionState")).toMatchObject({ personId, expanded: true, coarsePointer: true });
  expect(await bridge(page, "setInspectedPersonNeed", { needId: "satiety", value: 90 })).toMatchObject({ mutated: true });
  expect((await bridge(page, "getPopulationPerson", personId)).needs.satiety).toBe(90);
});
