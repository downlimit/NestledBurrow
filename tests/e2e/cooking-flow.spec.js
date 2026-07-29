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
  expect(await bridge(page, "addInventoryItem", { itemId: "potato", quantity: 3 })).toMatchObject({ mutated: true });
  expect(await bridge(page, "addInventoryItem", { itemId: "wood", quantity: 10 })).toMatchObject({ mutated: true });
  expect(await bridge(page, "addInventoryItem", { itemId: "stone", quantity: 8 })).toMatchObject({ mutated: true });
  await bridge(page, "setCoins", 10);
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.kitchen).toEqual({
    starterLemons: 6,
    stoveRepaired: false,
    servingTable: { itemId: null, quantity: 0, reservations: [] },
  });
  await expect.poll(async () => (await bridge(page, "getHudState")).resources.inventory.slots.find((item) => item?.id === "potato")?.quantity).toBe(3);

  await interact(page, "home-cutting-table-01");
  await expect.poll(() => bridge(page, "getRuntimeState")).toMatchObject({ cookingActive: true });
  await expect.poll(() => bridge(page, "getCookingState")).toMatchObject({ stepType: "preparation", combo: 0 });
  await bridge(page, "missCookingMarker");
  await bridge(page, "attemptCooking");
  await expect.poll(() => bridge(page, "getCookingState")).toMatchObject({ combo: 0, feedback: "miss" });
  await expect.poll(async () => (await bridge(page, "getAudioEffectState")).lastEffectType).toBe("cooking-miss");
  await bridge(page, "alignCookingMarker");
  await bridge(page, "attemptCooking");
  await expect.poll(() => bridge(page, "getCookingState")).toMatchObject({ combo: 1, feedback: "success" });
  await expect.poll(async () => (await bridge(page, "getAudioEffectState")).lastEffectType).toBe("cooking-success");
  await bridge(page, "completeCooking");
  await expect.poll(async () => (await bridge(page, "getHudState")).resources.inventory.slots
    .find((item) => item?.id === "sliced-potato")?.quantity).toBe(1);
  await expect.poll(async () => (await bridge(page, "getHudState")).resources.inventory.slots.find((item) => item?.id === "potato")?.quantity).toBe(2);

  await interact(page, "home-gas-stove-01");
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.kitchen.stoveRepaired).toBe(true);
  await expect.poll(() => bridge(page, "getRuntimeState")).toMatchObject({ cookingActive: false });
  await interact(page, "home-gas-stove-01");
  await expect.poll(() => bridge(page, "getCookingState")).toMatchObject({ stepType: "frying" });
  await bridge(page, "completeCooking");
  await expect.poll(async () => (await bridge(page, "getHudState")).resources.inventory.slots
    .find((item) => item?.id === "fried-potato-dish")?.quantity).toBe(1);

  const dishSlot = (await bridge(page, "getSession")).gameplay.inventory.slots
    .findIndex((item) => item?.id === "fried-potato-dish");
  await bridge(page, "selectInventorySlot", dishSlot);
  await interact(page, "home-serving-table-01");
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.kitchen).toMatchObject({
    servingTable: { itemId: "fried-potato-dish", quantity: 1, reservations: [] },
  });
  await expect.poll(async () => (await bridge(page, "getAudioEffectState")).lastEffectType).toBe("dish-serve");

  await page.reload();
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.kitchen).toEqual({
    starterLemons: 6,
    stoveRepaired: true,
    servingTable: { itemId: "fried-potato-dish", quantity: 1, reservations: [] },
  });
  await expect.poll(async () => (await bridge(page, "getHudState")).resources.inventory.slots.find((item) => item?.id === "potato")?.quantity).toBe(2);

  await interact(page, "home-serving-table-01");
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.kitchen).toMatchObject({
    servingTable: { itemId: null, quantity: 0, reservations: [] },
  });
  await expect.poll(async () => (await bridge(page, "getHudState")).resources.inventory.slots
    .find((item) => item?.id === "fried-potato-dish")?.quantity).toBe(1);
  await expect.poll(async () => (await bridge(page, "getAudioEffectState")).lastEffectType).toBe("dish-take");
});
