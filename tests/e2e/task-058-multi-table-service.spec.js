import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

async function bridge(page, method, argument) {
  return page.evaluate(
    ({ method, argument }) => window.__NESTLED_BURROW_E2E__?.[method]?.(argument),
    { method, argument },
  );
}

async function advanceUntil(page, read, predicate, { maxMs = 45_000, stepMs = 250 } = {}) {
  for (let elapsedMs = 0; elapsedMs <= maxMs; elapsedMs += stepMs) {
    const value = await read();
    if (predicate(value)) return value;
    await bridge(page, "advanceWorldSimulation", stepMs);
  }
  const value = await read();
  expect(predicate(value)).toBe(true);
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

async function placeNear(page, entityId) {
  await expect.poll(async () => {
    await bridge(page, "placePlayerNear", entityId);
    return (await bridge(page, "getInteractionState"))?.candidate?.entityId;
  }).toBe(entityId);
}

async function clickLogical(page, point) {
  const canvas = await page.locator("canvas").boundingBox();
  if (!canvas) throw new Error("Game canvas is unavailable");
  await page.mouse.click(
    canvas.x + point.x * canvas.width / 640,
    canvas.y + point.y * canvas.height / 360,
  );
}

async function addAtOpenPoint(page, facilityType, occupied = []) {
  const candidates = [
    [640, 416], [704, 416], [768, 416], [640, 448], [704, 448], [768, 448],
    [640, 480], [704, 480], [768, 480], [608, 512], [672, 512], [736, 512],
  ];
  for (const [x, y] of candidates) {
    if (occupied.some((point) => point.x === x && point.y === y)) continue;
    const facility = await bridge(page, "addFacility", { facilityType, x, y });
    if (facility) return { facility, point: { x, y } };
  }
  throw new Error(`No open test placement for ${facilityType}`);
}

test("the approached serving table owns the placed food", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop proves exact furniture targeting once");
  await bootFresh(page);
  const { facility: second } = await addAtOpenPoint(page, "serving-table");
  await bridge(page, "addInventoryItem", { itemId: "lemonade", quantity: 2 });
  const session = await bridge(page, "getSession");
  const slot = session.gameplay.inventory.slots.findIndex((item) => item?.id === "lemonade");
  await bridge(page, "selectInventorySlot", slot);
  await placeNear(page, second.id);
  await bridge(page, "interact");
  await bridge(page, "interact");

  const kitchen = (await bridge(page, "getSession")).gameplay.kitchen;
  expect(kitchen.servingTables["home-serving-table-01"]).toEqual({ itemId: null, quantity: 0, reservations: [] });
  expect(kitchen.servingTables[second.id]).toEqual({ itemId: "lemonade", quantity: 1, reservations: [] });
  const remainingLemonade = (await bridge(page, "getSession")).gameplay.inventory.slots
    .filter((item) => item?.id === "lemonade")
    .reduce((total, item) => total + item.quantity, 0);
  expect(remainingLemonade).toBe(1);
  const visuals = (await bridge(page, "getFacilityState")).servingTableVisuals;
  expect(visuals["home-serving-table-01"].visible).toBe(false);
  expect(visuals[second.id].visible).toBe(true);
});

test("two dine-in guests reserve distinct service-capable tables without dining seats", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop proves multi-guest table routing once");
  await bootFresh(page);
  const serving = await addAtOpenPoint(page, "serving-table");
  await bridge(page, "setServingStock", { itemId: "fried-potato-dish", quantity: 1 });
  await bridge(page, "setServingStock", {
    itemId: "fried-potato-dish",
    quantity: 1,
    servingTableId: serving.facility.id,
  });
  await placeNear(page, "tavern-open-sign");
  await bridge(page, "interact");
  await expect.poll(async () => (await bridge(page, "getTavernState")).menu?.active).toBe(true);
  await clickLogical(page, { x: 268, y: 220 });
  await expect.poll(() => bridge(page, "getTavernOpen")).toBe(true);
  await clickLogical(page, { x: 12, y: 90 });
  await expect.poll(async () => (await bridge(page, "getTavernState")).menu?.active).toBe(false);
  await bridge(page, "setVisitOpportunityRemainingMs", 1_000_000);
  const firstGuestId = await bridge(page, "forceGuestOrder", { itemId: "fried-potato-dish" });
  const secondGuestId = await bridge(page, "forceGuestOrder", { itemId: "fried-potato-dish" });
  expect(firstGuestId).toBe("tavern-guest-1");
  expect(secondGuestId).toBe("tavern-guest-2");
  for (const guestId of [firstGuestId, secondGuestId]) {
    await advanceUntil(
      page,
      async () => (await bridge(page, "getGuestOrder", guestId))?.order?.status,
      (status) => status === "offered",
    );
    expect(await bridge(page, "acceptGuestOrder", guestId)).toMatchObject({ status: "order-accepted", mutated: true });
  }

  await advanceUntil(
    page,
    async () => (await bridge(page, "getTavernState")).guest.guests
      .filter(({ servingTableId, diningTableId }) => servingTableId && diningTableId === null).length,
    (count) => count === 2,
  );
  const guests = (await bridge(page, "getTavernState")).guest.guests;
  expect({
    count: guests.length,
    serving: new Set(guests.map(({ servingTableId }) => servingTableId)).size,
    dining: guests.map(({ diningTableId }) => diningTableId),
  }).toEqual({ count: 2, serving: 2, dining: [null, null] });

  await advanceUntil(
    page,
    async () => (await bridge(page, "getCoinState")).length,
    (count) => count === 2,
  );
  const coins = await bridge(page, "getCoinState");
  expect(coins.map(({ value }) => value)).toEqual([4, 4]);
});
