import { expect, test } from "@playwright/test";

async function bridge(page, method, argument) {
  return page.evaluate(({ method, argument }) => window.__NESTLED_BURROW_E2E__?.[method]?.(argument), { method, argument });
}

async function boot(page) {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  await expect(page.locator("canvas")).toHaveJSProperty("width", 640);
}

async function tapAlt(page) {
  await page.keyboard.press("Alt");
}

async function enterNest(page) {
  await expect.poll(async () => {
    await bridge(page, "placePlayerNear", "village-nest-transport");
    return (await bridge(page, "getInteractionState"))?.candidate?.entityId;
  }).toBe("village-nest-transport");
  await page.keyboard.press("Space");
  await expect.poll(async () => (await bridge(page, "getLocationState")).worldId).toBe("nest");
}

test("Wild Atoll mounts common melee runtime for sword and battle axe", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "physical combat actions are covered on desktop");
  await boot(page);

  await enterNest(page);

  await expect.poll(async () => {
    await bridge(page, "placePlayerNear", "nest-atoll-entrance");
    return (await bridge(page, "getWildAtollState"))?.candidateId;
  }).toBe("enter");
  await page.keyboard.press("Space");
  await expect.poll(async () => (await bridge(page, "getLocationState")).worldId, { timeout: 2000 }).toBe("atoll");
  await expect.poll(() => bridge(page, "getMeleeState")).not.toBeNull();
  await expect.poll(() => page.locator(".authoring-mode-list label").allTextContents()).toEqual([
    "Коллайдер",
    "Пивот",
    "Оффсет визуала",
    "Обрезка визуала",
    "Точки подхода",
    "Точка взаимодействия",
    "Режим рендера",
    "Таймлайн взаимодействия",
  ]);

  await bridge(page, "addCombatInventoryItem", { itemId: "sword" });
  await bridge(page, "addCombatInventoryItem", { itemId: "battle-axe" });
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.combatLoadout.slots[1]?.id).toBe("sword");
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.combatLoadout.slots[2]?.id).toBe("battle-axe");

  await tapAlt(page);
  await expect.poll(async () => (await bridge(page, "getHudState")).inventoryMode).toMatchObject({
    mode: "COMBAT",
    stableMode: "COMBAT",
    transitioning: false,
  });

  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Game canvas is unavailable");
  const attackPoint = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  await page.mouse.click(attackPoint.x, attackPoint.y, { button: "left" });
  await expect.poll(async () => (await bridge(page, "getMeleeState"))?.weaponId).toBe("sword");

  await page.waitForTimeout(900);
  await page.mouse.click(attackPoint.x, attackPoint.y, { button: "right" });
  await expect.poll(async () => (await bridge(page, "getMeleeState"))?.weaponId).toBe("battle-axe");
});
