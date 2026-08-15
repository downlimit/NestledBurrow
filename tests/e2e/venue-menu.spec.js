import { expect, test } from "@playwright/test";

test.setTimeout(45_000);

async function bridge(page, method, argument) {
  return page.evaluate(
    ({ method, argument }) => window.__NESTLED_BURROW_E2E__?.[method]?.(argument),
    { method, argument },
  );
}

async function advanceUntil(page, read, predicate, { maxMs = 30_000, stepMs = 250 } = {}) {
  for (let elapsedMs = 0; elapsedMs <= maxMs; elapsedMs += stepMs) {
    const value = await read();
    if (predicate(value)) return value;
    await bridge(page, "advanceWorldSimulation", stepMs);
  }
  const value = await read();
  expect(predicate(value), `last observed value: ${JSON.stringify(value)}`).toBe(true);
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

async function clickLogical(page, point) {
  const canvas = await page.locator("canvas").boundingBox();
  if (!canvas) throw new Error("Game canvas is unavailable");
  await page.mouse.click(
    canvas.x + point.x * canvas.width / 640,
    canvas.y + point.y * canvas.height / 360,
  );
}

async function placeNearSign(page) {
  await expect.poll(async () => {
    await bridge(page, "placePlayerNear", "tavern-open-sign");
    return (await bridge(page, "getInteractionState"))?.candidate?.entityId;
  }).toBe("tavern-open-sign");
}

async function openMenu(page) {
  await placeNearSign(page);
  await bridge(page, "interact");
  await expect.poll(async () => (await bridge(page, "getTavernState")).menu?.active).toBe(true);
}

async function openTavern(page) {
  await openMenu(page);
  await clickLogical(page, { x: 268, y: 220 });
  await expect.poll(() => bridge(page, "getTavernOpen")).toBe(true);
  await expect.poll(async () => (await bridge(page, "getTavernState")).menu?.active).toBe(true);
  await clickLogical(page, { x: 12, y: 90 });
  await expect.poll(async () => (await bridge(page, "getTavernState")).menu?.active).toBe(false);
}

test("one sign panel edits the offer and switches menu activity without closing", async ({ page }) => {
  await bootFresh(page);
  await bridge(page, "setLanguage", "ru");
  expect(await bridge(page, "getVenueOffer")).toEqual({
    foodItemIds: ["fried-potato-dish", "lemonade"],
  });

  await openMenu(page);
  expect(await bridge(page, "getTavernOpen")).toBe(false);
  await clickLogical(page, { x: 320, y: 154 });
  expect(await bridge(page, "getVenueOffer")).toEqual({ foodItemIds: ["lemonade"] });
  await clickLogical(page, { x: 12, y: 90 });
  await expect.poll(async () => (await bridge(page, "getTavernState")).menu?.active).toBe(false);
  expect(await bridge(page, "getTavernOpen")).toBe(false);

  await page.reload();
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  expect(await bridge(page, "getVenueOffer")).toEqual({ foodItemIds: ["lemonade"] });

  await bridge(page, "setLanguage", "en");
  await openMenu(page);
  await clickLogical(page, { x: 268, y: 220 });
  await expect.poll(() => bridge(page, "getTavernOpen")).toBe(true);
  expect((await bridge(page, "getTavernState")).menu.active).toBe(true);
  expect(await bridge(page, "setVenueOfferItemActive", { itemId: "fried-potato-dish", active: true })).toMatchObject({
    status: "locked-open",
    mutated: false,
  });
  expect(await bridge(page, "getVenueOffer")).toEqual({ foodItemIds: ["lemonade"] });

  await page.keyboard.press("Space");
  await expect.poll(async () => (await bridge(page, "getTavernState")).menu?.active).toBe(false);
  await page.waitForTimeout(100);
  expect((await bridge(page, "getTavernState")).menu.active).toBe(false);
  expect(await bridge(page, "getTavernOpen")).toBe(true);

  await openMenu(page);
  expect(await bridge(page, "getTavernOpen")).toBe(true);
  await clickLogical(page, { x: 268, y: 220 });
  await expect.poll(() => bridge(page, "getTavernOpen")).toBe(false);
  expect((await bridge(page, "getTavernState")).menu.active).toBe(true);
  await clickLogical(page, { x: 320, y: 154 });
  expect(await bridge(page, "getVenueOffer")).toEqual({
    foodItemIds: ["fried-potato-dish", "lemonade"],
  });
  await clickLogical(page, { x: 268, y: 220 });
  await expect.poll(() => bridge(page, "getTavernOpen")).toBe(true);
  expect((await bridge(page, "getTavernState")).menu.active).toBe(true);
  await clickLogical(page, { x: 12, y: 90 });
  expect(await bridge(page, "getTavernOpen")).toBe(true);
  await expect.poll(async () => (await bridge(page, "getTavernState")).menu?.active).toBe(false);
});

test("live service never reserves stocked food outside the accepted offer", async ({ page }) => {
  await bootFresh(page);
  await bridge(page, "setServingStock", { itemId: "fried-potato-dish", quantity: 1 });
  await bridge(page, "setVenueOfferItemActive", { itemId: "fried-potato-dish", active: false });
  await openTavern(page);
  await bridge(page, "setVisitOpportunityRemainingMs", 1_000_000);
  expect(await bridge(page, "forceGuestSpawn")).toBe("tavern-guest-1");
  await advanceUntil(
    page,
    async () => (await bridge(page, "getTavernState")).guest.active,
    (active) => active === false,
    { maxMs: 60_000 },
  );
  expect((await bridge(page, "getSession")).gameplay.kitchen.servingTables["home-serving-table-01"].reservations).toEqual([]);

  await openMenu(page);
  await clickLogical(page, { x: 268, y: 220 });
  await expect.poll(() => bridge(page, "getTavernOpen")).toBe(false);
  expect((await bridge(page, "getTavernState")).menu.active).toBe(true);
  await bridge(page, "setVenueOfferItemActive", { itemId: "fried-potato-dish", active: true });
  await clickLogical(page, { x: 268, y: 220 });
  await expect.poll(() => bridge(page, "getTavernOpen")).toBe(true);
  await clickLogical(page, { x: 12, y: 90 });
  await expect.poll(async () => (await bridge(page, "getTavernState")).menu?.active).toBe(false);
  const secondGuestId = await bridge(page, "forceGuestSpawn");
  expect(secondGuestId).toBe("tavern-guest-2");
  await advanceUntil(
    page,
    async () => (await bridge(page, "getGuestOrder", secondGuestId))?.order?.status,
    (status) => status === "offered",
    { maxMs: 60_000 },
  );
  expect(await bridge(page, "acceptGuestOrder", secondGuestId)).toMatchObject({
    status: "order-accepted",
    mutated: true,
  });
  await advanceUntil(
    page,
    async () => (await bridge(page, "getTavernState")).guest.guests[0]?.reservedDish,
    Boolean,
  );
  expect((await bridge(page, "getTavernState")).guest.guests[0]).toMatchObject({ itemId: "fried-potato-dish" });
});
