import { expect, test } from "@playwright/test";

async function bridge(page, method, argument) {
  return page.evaluate(({ method, argument }) => window.__NESTLED_BURROW_E2E__?.[method]?.(argument), { method, argument });
}

async function boot(page) {
  await page.setViewportSize({ width: 320, height: 180 });
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  await expect(page.locator("canvas")).toHaveJSProperty("width", 320);
}

async function tapAlt(page) {
  await page.keyboard.down("Alt");
  await page.waitForTimeout(60);
  await page.keyboard.up("Alt");
}

async function enterNest(page) {
  await bridge(page, "placePlayerAt", {
    x: 504,
    y: 200,
    facing: { x: 0, y: -1 },
  });
  await expect.poll(async () => (await bridge(page, "getInteractionState"))?.candidate?.entityId).toBe("village-nest-transport");
  await page.keyboard.press("Space");
  await expect.poll(async () => (await bridge(page, "getLocationState")).worldId).toBe("nest");
}

test("Wild Atoll mounts common melee runtime for sword and battle axe", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "physical combat actions are covered on desktop");
  await boot(page);

  await enterNest(page);

  await bridge(page, "placePlayerAt", {
    x: 11 * 16,
    y: 7 * 16,
    facing: { x: 0, y: -1 },
  });
  await page.waitForTimeout(120);
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
