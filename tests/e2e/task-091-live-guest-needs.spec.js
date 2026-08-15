import { expect, test } from "@playwright/test";

test.setTimeout(90_000);

const NEED_INTENTS = Object.freeze([
  ["novelty", "wander", "bored"],
  ["energy", "rest", "low-energy"],
  ["satiety", "food", "hunger"],
  ["toilet", "toilet", "toilet"],
  ["lustre", "wash", "cleanliness"],
  ["dialogue", "social", "social"],
]);

async function bridge(page, method, argument) {
  return page.evaluate(
    ({ method, argument }) => window.__NESTLED_BURROW_E2E__?.[method]?.(argument),
    { method, argument },
  );
}

async function advanceUntil(page, read, predicate, { maxMs = 50_000, stepMs = 250 } = {}) {
  for (let elapsedMs = 0; elapsedMs <= maxMs; elapsedMs += stepMs) {
    const value = await read();
    if (predicate(value)) return value;
    await bridge(page, "advanceWorldSimulation", stepMs);
  }
  const value = await read();
  expect(predicate(value), JSON.stringify(value, null, 2)).toBe(true);
  return value;
}

async function bootFresh(page) {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto("./?movementDebug=1");
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
}

async function openTavern(page) {
  await expect.poll(async () => {
    await bridge(page, "placePlayerNear", "tavern-open-sign");
    return (await bridge(page, "getInteractionState"))?.candidate?.entityId;
  }).toBe("tavern-open-sign");
  await bridge(page, "interact");
  await expect.poll(async () => (await bridge(page, "getTavernState")).menu?.active).toBe(true);
  const canvas = await page.locator("canvas").boundingBox();
  if (!canvas) throw new Error("Game canvas is unavailable");
  await bridge(page, "setVisitOpportunityRemainingMs", 1_000_000);
  await page.mouse.click(canvas.x + 268 * canvas.width / 640, canvas.y + 220 * canvas.height / 360);
  await expect.poll(() => bridge(page, "getTavernOpen")).toBe(true);
  await page.mouse.click(canvas.x + 12 * canvas.width / 640, canvas.y + 90 * canvas.height / 360);
  await expect.poll(async () => (await bridge(page, "getTavernState")).menu?.active).toBe(false);
}

async function addServiceTables(page, count) {
  const candidates = [
    [352, 224], [400, 224], [448, 224], [352, 256], [400, 256], [448, 256],
    [352, 288], [400, 288], [448, 288], [640, 416], [704, 416], [640, 448],
  ];
  const ids = [];
  for (const [x, y] of candidates) {
    if (ids.length >= count) break;
    const facility = await bridge(page, "addFacility", { facilityType: "serving-table", x, y });
    if (facility) ids.push(facility.id);
  }
  expect(ids).toHaveLength(count);
  return ids;
}

function findGuest(state, guestId) {
  return state.guest.guests.find(({ id }) => id === guestId);
}

test("four persistent guests arbitrate live needs, resume service, preserve table food and pay", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop proves the 640x360 multi-guest visit once");
  await bootFresh(page);
  await addServiceTables(page, 3);
  await openTavern(page);

  const population = await bridge(page, "getPopulation");
  const personIds = population.slice(0, 4).map(({ id }) => id);
  const guestIds = [];
  for (const personId of personIds) {
    guestIds.push(await bridge(page, "forceGuestOrder", { personId, itemId: "fried-potato-dish" }));
    await bridge(page, "advanceWorldSimulation", 1_000);
  }
  expect(guestIds.every((guestId) => typeof guestId === "string")).toBe(true);
  expect(new Set(guestIds).size).toBe(4);

  await advanceUntil(
    page,
    async () => findGuest(await bridge(page, "getTavernState"), guestIds[0]),
    (guest) => guest?.order.status === "offered",
  );
  let tavern = await bridge(page, "getTavernState");
  const offeredOverhead = findGuest(tavern, guestIds[0]).overhead;
  expect(offeredOverhead.action).toBe("order");
  expect(offeredOverhead.screenGeometry.action.x).toBe(offeredOverhead.screenGeometry.anchor.x);
  expect(offeredOverhead.screenGeometry.anchor.y - offeredOverhead.screenGeometry.action.y).toBe(22);
  expect(offeredOverhead.screenGeometry.actionWidth).toBeLessThanOrEqual(22);

  const inspectedPersonId = personIds[0];
  const inspectedGuestId = guestIds[0];
  expect(await bridge(page, "forcePersonInspectionExpanded", inspectedPersonId)).toBe(true);
  const inspection = await bridge(page, "getPersonInspectionState");
  expect(Math.round(inspection.cardRect.x + inspection.cardRect.width / 2)).toBe(
    offeredOverhead.screenGeometry.anchor.x,
  );
  expect(offeredOverhead.screenGeometry.anchor.y - (inspection.cardRect.y + inspection.cardRect.height)).toBe(36);
  for (const [needId] of NEED_INTENTS) {
    await bridge(page, "setInspectedPersonNeed", { needId, value: 100 });
  }
  await bridge(page, "advanceWorldSimulation", 100);
  for (const [needId, intent, thought] of NEED_INTENTS) {
    expect(await bridge(page, "setInspectedPersonNeed", { needId, value: 5 })).toMatchObject({ mutated: true });
    await bridge(page, "advanceWorldSimulation", 100);
    tavern = await bridge(page, "getTavernState");
    const guest = findGuest(tavern, inspectedGuestId);
    expect(guest.personId).toBe(inspectedPersonId);
    expect(guest.intent).toBe(intent);
    expect(guest.overhead).toMatchObject({
      thought,
      action: "order",
      thoughtAboveAction: false,
      actionAboveThought: true,
      uiSpace: true,
      actionSpriteCount: 1,
    });
    expect((await bridge(page, "getPopulationPerson", inspectedPersonId)).needs[needId]).toBeLessThanOrEqual(6);
    await bridge(page, "setInspectedPersonNeed", { needId, value: 100 });
    await bridge(page, "advanceWorldSimulation", 100);
  }

  for (const guestId of guestIds) {
    let lastGuest = null;
    await advanceUntil(
      page,
      async () => {
        const state = await bridge(page, "getTavernState");
        const guest = findGuest(state, guestId);
        if (guest) lastGuest = guest;
        return { guestId, guest, lastGuest, servicePlaces: state.service.servicePlaces };
      },
      ({ guest }) => guest?.order.status === "offered",
    );
    expect(findGuest(await bridge(page, "getTavernState"), guestId).overhead.action).toBe("order");
    expect(await bridge(page, "acceptGuestOrder", guestId)).toMatchObject({ status: "order-accepted", mutated: true });
  }
  await bridge(page, "advanceWorldSimulation", 250);
  tavern = await bridge(page, "getTavernState");
  const claimedTables = tavern.guest.guests.map(({ servingTableId }) => servingTableId);
  expect(tavern.guest.activeCount).toBe(4);
  expect(claimedTables.every(Boolean)).toBe(true);
  expect(new Set(claimedTables).size).toBe(4);
  expect(tavern.guest.guests.every(({ diningTableId }) => diningTableId === null)).toBe(true);
  for (const { order, overhead } of tavern.guest.guests) {
    expect(order.status).toBe("accepted");
    expect(overhead).toMatchObject({
      action: null,
      thought: "order-item",
      orderItemId: "fried-potato-dish",
      pixelDensity: 6,
      crossfadeMode: "premultiplied-additive",
    });
    expect(overhead.actionProgress).toBeGreaterThanOrEqual(0);
    expect(overhead.orderLabelVisible).toBe(false);
  }
  const waitingOverhead = findGuest(tavern, inspectedGuestId).overhead;
  expect(waitingOverhead.screenGeometry).toMatchObject({
    thoughtWidth: 36,
    iconWidth: 15,
  });
  expect(waitingOverhead.screenGeometry.thought.x - waitingOverhead.screenGeometry.anchor.x).toBe(8);
  expect(waitingOverhead.screenGeometry.icon.x - waitingOverhead.screenGeometry.anchor.x).toBe(8);
  expect(waitingOverhead.screenGeometry.icon.y - waitingOverhead.screenGeometry.thought.y).toBe(-3);
  expect(waitingOverhead.screenGeometry.action.x).toBe(waitingOverhead.screenGeometry.anchor.x);
  expect(waitingOverhead.screenGeometry.anchor.y - waitingOverhead.screenGeometry.thought.y).toBe(32);
  expect(waitingOverhead.screenGeometry.anchor.y - waitingOverhead.screenGeometry.action.y).toBe(22);
  const gameCanvas = page.locator("#game > canvas");
  await expect(gameCanvas).toHaveCount(1);
  await bridge(page, "inspectPopulationPerson", null);
  await bridge(page, "advanceWorldSimulation", 20);
  const canvasBounds = await gameCanvas.boundingBox();
  if (!canvasBounds || !waitingOverhead.orderIconPosition) throw new Error("Order icon is unavailable");
  const originalWorldTime = (await bridge(page, "getDayNightState")).worldTimeSeconds;
  await bridge(page, "setWorldTimeSeconds", 12 * 60 * 60);
  await bridge(page, "advanceWorldSimulation", 20);
  const dayColor = (await bridge(page, "getDayNightState")).color;
  await bridge(page, "setWorldTimeSeconds", 23 * 60 * 60);
  await bridge(page, "advanceWorldSimulation", 20);
  const nightColor = (await bridge(page, "getDayNightState")).color;
  expect(dayColor).not.toBe(nightColor);
  await bridge(page, "setWorldTimeSeconds", originalWorldTime);
  await bridge(page, "advanceWorldSimulation", 20);
  await page.mouse.move(
    canvasBounds.x + waitingOverhead.orderIconPosition.x * canvasBounds.width / 640,
    canvasBounds.y + waitingOverhead.orderIconPosition.y * canvasBounds.height / 360,
  );
  await expect.poll(async () => (
    findGuest(await bridge(page, "getTavernState"), inspectedGuestId).overhead.orderLabelVisible
  )).toBe(true);
  await page.mouse.move(1, 1);
  await expect.poll(async () => (
    findGuest(await bridge(page, "getTavernState"), inspectedGuestId).overhead.orderLabelVisible
  )).toBe(false);

  expect(await bridge(page, "forcePersonInspectionExpanded", inspectedPersonId)).toBe(true);
  for (const [needId] of NEED_INTENTS) {
    await bridge(page, "setInspectedPersonNeed", { needId, value: 100 });
  }
  await bridge(page, "setInspectedPersonNeed", { needId: "novelty", value: 5 });
  await bridge(page, "advanceWorldSimulation", 100);
  let alternatingOverhead = findGuest(await bridge(page, "getTavernState"), inspectedGuestId).overhead;
  expect(alternatingOverhead).toMatchObject({
    thought: "order-item",
    displayedThought: "order-item",
    alternateThought: "bored",
    orderItemId: "fried-potato-dish",
  });
  alternatingOverhead = await advanceUntil(
    page,
    async () => findGuest(await bridge(page, "getTavernState"), inspectedGuestId).overhead,
    (overhead) => overhead?.displayedThought === "bored",
    { maxMs: 2_500, stepMs: 100 },
  );
  expect(alternatingOverhead).toMatchObject({
    thought: "order-item",
    displayedThought: "bored",
    alternateThought: "bored",
    orderItemId: "fried-potato-dish",
  });
  alternatingOverhead = await advanceUntil(
    page,
    async () => findGuest(await bridge(page, "getTavernState"), inspectedGuestId).overhead,
    (overhead) => overhead?.displayedThought === "order-item",
    { maxMs: 2_500, stepMs: 100 },
  );
  expect(alternatingOverhead).toMatchObject({
    thought: "order-item",
    displayedThought: "order-item",
    alternateThought: "bored",
    orderItemId: "fried-potato-dish",
  });
  await bridge(page, "setInspectedPersonNeed", { needId: "novelty", value: 100 });

  const bindingsBeforeReload = await bridge(page, "getGuestPersonMapping");
  expect((await bridge(page, "saveSession")).status).toBe("saved");
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  expect(await bridge(page, "getGuestPersonMapping")).toEqual(bindingsBeforeReload);
  expect((await bridge(page, "getTavernState")).guest.activeCount).toBe(4);

  const restored = findGuest(await bridge(page, "getTavernState"), inspectedGuestId);
  expect(restored.order.status).toBe("accepted");
  expect(restored.personId).toBe(inspectedPersonId);
  expect(await bridge(page, "forcePersonInspectionExpanded", inspectedPersonId)).toBe(true);
  expect(await bridge(page, "setInspectedPersonNeed", { needId: "toilet", value: 5 })).toMatchObject({ mutated: true });
  await advanceUntil(
    page,
    async () => findGuest(await bridge(page, "getTavernState"), inspectedGuestId),
    (guest) => ["approaching-need", "resolving-need"].includes(guest?.state) && guest.intent === "toilet",
  );

  const tableId = restored.servingTableId;
  await bridge(page, "setServingStock", { itemId: "fried-potato-dish", quantity: 1, servingTableId: tableId });
  await bridge(page, "advanceWorldSimulation", 250);
  tavern = await bridge(page, "getTavernState");
  let guest = findGuest(tavern, inspectedGuestId);
  expect(guest.order.status).toBe("reserved");
  expect(guest.reservedDish).toBe(true);
  expect((await bridge(page, "getSession")).gameplay.kitchen.servingTables[tableId].quantity).toBe(1);
  expect((await bridge(page, "getFacilityState")).servingTableVisuals[tableId].visible).toBe(true);

  await advanceUntil(
    page,
    async () => findGuest(await bridge(page, "getTavernState"), inspectedGuestId),
    (candidate) => candidate?.state === "eating",
  );
  guest = findGuest(await bridge(page, "getTavernState"), inspectedGuestId);
  expect(guest.order.status).toBe("served");
  expect(guest.servedItemOnTable).toBe(true);
  expect(guest.overhead.action).toBe("eat");
  expect((await bridge(page, "getSession")).gameplay.kitchen.servingTables[tableId].quantity).toBe(1);

  await advanceUntil(
    page,
    async () => findGuest(await bridge(page, "getTavernState"), inspectedGuestId),
    (candidate) => candidate?.state === "satisfaction",
    { maxMs: 12_000 },
  );
  guest = findGuest(await bridge(page, "getTavernState"), inspectedGuestId);
  expect(guest.servedItemOnTable).toBe(false);
  expect(guest.overhead.action).toBe("satisfaction");
  expect(guest.overhead.satisfactionTier).toBeGreaterThanOrEqual(1);
  expect(guest.overhead.satisfactionTier).toBeLessThanOrEqual(5);
  expect(guest.overhead.screenGeometry.action.x).toBe(guest.overhead.screenGeometry.anchor.x);
  expect(guest.overhead.screenGeometry.anchor.y - guest.overhead.screenGeometry.action.y).toBe(22);
  expect(guest.overhead.screenGeometry.actionWidth).toBeLessThanOrEqual(22);
  guest = await advanceUntil(
    page,
    async () => findGuest(await bridge(page, "getTavernState"), inspectedGuestId),
    (candidate) => candidate?.overhead?.screenGeometry?.actionWidth <= 20,
    { maxMs: 1_000, stepMs: 50 },
  );
  expect(guest.overhead.screenGeometry.actionWidth).toBeLessThanOrEqual(20);
  expect((await bridge(page, "getSession")).gameplay.kitchen.servingTables[tableId].quantity).toBe(0);

  await advanceUntil(
    page,
    async () => findGuest(await bridge(page, "getTavernState"), inspectedGuestId)?.state,
    (state) => state === "paying",
    { maxMs: 3_000 },
  );
  expect((await bridge(page, "getCoinState")).length).toBe(0);
  expect(findGuest(await bridge(page, "getTavernState"), inspectedGuestId).overhead.action).toBe("paying");
  await advanceUntil(
    page,
    async () => (await bridge(page, "getCoinState")).length,
    (count) => count === 1,
    { maxMs: 3_000 },
  );
});
