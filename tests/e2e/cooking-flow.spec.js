import { expect, test } from "@playwright/test";

async function bridge(page, method, argument) {
  return page.evaluate(({ method, argument }) => window.__NESTLED_BURROW_E2E__?.[method]?.(argument), { method, argument });
}

async function boot(page) {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto("./?movementDebug=1");
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
}

async function placeNear(page, id) {
  await expect.poll(async () => {
    await bridge(page, "placePlayerNear", id);
    return (await bridge(page, "getInteractionState"))?.candidate?.entityId;
  }).toBe(id);
}

async function interact(page, id) {
  await placeNear(page, id);
  await bridge(page, "interact");
}

async function clickCanvasLogical(page, x, y) {
  const canvas = await page.locator("canvas").boundingBox();
  if (!canvas) throw new Error("Game canvas is unavailable");
  await page.mouse.click(
    canvas.x + x * canvas.width / 320,
    canvas.y + y * canvas.height / 180,
  );
}

test("potatoes move through preparation, frying and the persistent serving table", async ({ page }) => {
  await boot(page);
  await page.evaluate(async () => {
    const previousBridge = window.__NESTLED_BURROW_E2E__;
    previousBridge.newGame();
    await new Promise((resolve) => {
      const check = () => {
        if (window.__NESTLED_BURROW_E2E__ && window.__NESTLED_BURROW_E2E__ !== previousBridge) resolve();
        else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
  });
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.kitchen).toEqual({
    rawPotatoes: 5,
    preparedPotatoes: 0,
    cookedDishes: 0,
    servingTableHasDish: false,
  });

  await interact(page, "home-cutting-table-01");
  await expect.poll(() => bridge(page, "getRuntimeState")).toMatchObject({ cookingActive: true });
  await expect.poll(() => bridge(page, "getCookingState")).toMatchObject({ stepType: "preparation", combo: 0 });
  await bridge(page, "alignCookingMarker");
  await clickCanvasLogical(page, 160, 100);
  await expect.poll(() => bridge(page, "getCookingState")).toMatchObject({ combo: 1, feedback: "success" });
  await bridge(page, "completeCooking");
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.kitchen).toMatchObject({
    rawPotatoes: 4,
    preparedPotatoes: 1,
  });

  await interact(page, "home-gas-stove-01");
  await expect.poll(() => bridge(page, "getCookingState")).toMatchObject({ stepType: "frying" });
  await bridge(page, "completeCooking");
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.kitchen).toMatchObject({
    preparedPotatoes: 0,
    cookedDishes: 1,
  });

  await interact(page, "home-serving-table-01");
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.kitchen).toMatchObject({
    cookedDishes: 0,
    servingTableHasDish: true,
  });

  await page.reload();
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.kitchen).toEqual({
    rawPotatoes: 4,
    preparedPotatoes: 0,
    cookedDishes: 0,
    servingTableHasDish: true,
  });

  await interact(page, "home-serving-table-01");
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.kitchen).toMatchObject({
    cookedDishes: 1,
    servingTableHasDish: false,
  });
});
