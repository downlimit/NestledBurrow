import { expect, test } from "@playwright/test";

async function bridge(page, method, argument) {
  return page.evaluate(({ method, argument }) => window.__NESTLED_BURROW_E2E__?.[method]?.(argument), { method, argument });
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
  await bridge(page, "forceGuestSpawn");
  await expect.poll(async () => (await bridge(page, "getTavernState")).guest.state, { timeout: 15_000 }).toBe("checking-sign");
  await expect.poll(async () => (await bridge(page, "getTavernState")).guest.active, { timeout: 20_000 }).toBe(false);
  expect(await bridge(page, "getCharacterSnapshot", "tavern-guest-01")).toBeNull();
});

test("open guest reserves, eats and consumes the served dish", async ({ page }) => {
  await bootFresh(page);
  await bridge(page, "setServingDish", true);
  await openTavern(page);
  await bridge(page, "forceGuestSpawn");
  await expect.poll(async () => (await bridge(page, "getTavernState")).guest.reservedDish, { timeout: 25_000 }).toBe(true);
  await expect.poll(async () => (await bridge(page, "getTavernState")).guest.state, { timeout: 25_000 }).toBe("eating");
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.kitchen.servingTableHasDish, { timeout: 10_000 }).toBe(false);
  await expect.poll(async () => (await bridge(page, "getCoinState"))[0]?.landed, { timeout: 10_000 }).toBe(true);
  const coinsBeforeCollection = (await bridge(page, "getSession")).gameplay.coins;
  const [coin] = await bridge(page, "getCoinState");
  await bridge(page, "placePlayerAt", { x: coin.x, y: coin.y });
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.coins).toBe(coinsBeforeCollection + 1);
  await expect.poll(async () => (await bridge(page, "getHudState")).resources.coinCount).toBe(coinsBeforeCollection + 1);
  await expect.poll(async () => (await bridge(page, "getTavernState")).guest.active, { timeout: 25_000 }).toBe(false);
  expect(await bridge(page, "getCharacterSnapshot", "tavern-guest-01")).toBeNull();
  expect(await page.locator("canvas").count()).toBe(1);
});
