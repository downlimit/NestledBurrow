import { expect, test } from "@playwright/test";

test.setTimeout(45_000);

async function bridge(page, method, argument) {
  return page.evaluate(({ method, argument }) => window.__NESTLED_BURROW_E2E__?.[method]?.(argument), { method, argument });
}

async function advanceUntil(page, read, predicate, { maxMs = 30_000, stepMs = 250 } = {}) {
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
  await page.evaluate(async () => {
    const previous = window.__NESTLED_BURROW_E2E__;
    previous.newGame();
    await new Promise((resolve) => {
      const check = () => window.__NESTLED_BURROW_E2E__ !== previous ? resolve() : requestAnimationFrame(check);
      requestAnimationFrame(check);
    });
  });
}

async function openTavern(page) {
  await expect.poll(async () => {
    await bridge(page, "placePlayerNear", "tavern-open-sign");
    return (await bridge(page, "getInteractionState"))?.candidate?.entityId;
  }).toBe("tavern-open-sign");
  await bridge(page, "interact");
  await expect.poll(async () => (await bridge(page, "getTavernState")).open).toBe(true);
}

test("closed guest checks the sign, pauses and leaves outside", async ({ page }) => {
  await bootFresh(page);
  expect((await bridge(page, "getTavernState")).open).toBe(false);
  const guestId = await bridge(page, "forceGuestSpawn");
  await advanceUntil(
    page,
    async () => (await bridge(page, "getTavernState")).guest.state,
    (state) => state === "checking-sign",
    { maxMs: 15_000 },
  );
  await advanceUntil(
    page,
    async () => (await bridge(page, "getTavernState")).guest.active,
    (active) => active === false,
    { maxMs: 20_000 },
  );
  expect(await bridge(page, "getCharacterSnapshot", guestId)).toBeNull();
});

test("open guest reserves, eats and consumes the served dish", async ({ page }) => {
  await bootFresh(page);
  await bridge(page, "setServingDish", true);
  await openTavern(page);
  const guestId = await bridge(page, "forceGuestSpawn");
  expect((await bridge(page, "getTavernState")).guest.reservedDish).toBe(true);
  await advanceUntil(
    page,
    async () => (await bridge(page, "getTavernState")).guest.state,
    (state) => state === "eating",
    { maxMs: 25_000 },
  );
  expect((await bridge(page, "getSession")).gameplay.kitchen.servingTables["home-serving-table-01"].quantity).toBe(0);
  await advanceUntil(
    page,
    async () => (await bridge(page, "getCoinState"))[0]?.landed,
    (landed) => landed === true,
    { maxMs: 10_000 },
  );
  const coinsBeforeCollection = (await bridge(page, "getSession")).gameplay.coins;
  const [coin] = await bridge(page, "getCoinState");
  await bridge(page, "placePlayerAt", { x: coin.x, y: coin.y });
  expect(coin.value).toBe(4);
  await bridge(page, "advanceWorldSimulation", 50);
  expect((await bridge(page, "getSession")).gameplay.coins).toBe(coinsBeforeCollection + 4);
  expect((await bridge(page, "getHudState")).resources.coinCount).toBe(coinsBeforeCollection + 4);
  await advanceUntil(
    page,
    async () => bridge(page, "getCharacterSnapshot", guestId),
    (snapshot) => snapshot === null,
    { maxMs: 25_000 },
  );
  expect(await page.locator("canvas").count()).toBe(1);
});
