import { expect, test } from "@playwright/test";

async function boot(page, target = "./") {
  await page.goto(target);
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
}

async function bridge(page, expression, argument) {
  return page.evaluate(({ expression, argument }) => {
    const api = window.__NESTLED_BURROW_E2E__;
    const method = api?.[expression];
    if (typeof method !== "function") return undefined;
    return method(argument);
  }, { expression, argument });
}

async function pressInteract(page) {
  await page.keyboard.down("Space");
  await page.waitForTimeout(50);
  await page.keyboard.up("Space");
}

async function placeNear(page, entityId) {
  await expect.poll(async () => {
    await bridge(page, "placePlayerNear", entityId);
    return (await bridge(page, "getInteractionState"))?.candidate?.entityId;
  }).toBe(entityId);
}

async function clickLogical(page, x, y) {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Game canvas is unavailable");
  await page.mouse.click(box.x + x * box.width / 320, box.y + y * box.height / 180);
}

async function openNewGameConfirmation(page) {
  await clickLogical(page, 45, 19);
  await expect.poll(() => bridge(page, "getHudState")).toMatchObject({ optionsOpen: true });
  await clickLogical(page, 185, 87);
}

function inventoryQuantity(gameplay, itemId) {
  return (gameplay?.inventory?.slots ?? [])
    .filter((item) => item?.id === itemId)
    .reduce((total, item) => total + item.quantity, 0);
}

test("default Russian locale and saved preference survive reload", async ({ page }) => {
  await boot(page);
  await expect.poll(() => bridge(page, "getLanguage")).toBe("ru");
  await bridge(page, "setLanguage", "en");
  await page.reload();
  await boot(page);
  await expect.poll(() => bridge(page, "getLanguage")).toBe("en");
});

test("localized seed purchase persists and New Game keeps language", async ({ page }) => {
  await boot(page);
  await placeNear(page, "seed-merchant");
  await pressInteract(page);
  await expect.poll(() => bridge(page, "getMerchantState")).toMatchObject({ active: true });
  await clickLogical(page, 45, 19);
  await expect.poll(() => bridge(page, "getHudState")).toMatchObject({ optionsOpen: true });
  await expect.poll(() => bridge(page, "getMerchantState")).toMatchObject({ active: true, visible: false });
  await clickLogical(page, 45, 19);
  await expect.poll(() => bridge(page, "getMerchantState")).toMatchObject({ active: true, visible: true });
  const buyButton = (await bridge(page, "getMerchantState")).buyButton;
  await clickLogical(page, buyButton.x + buyButton.width / 2, buyButton.y + buyButton.height / 2);
  await expect.poll(async () => inventoryQuantity((await bridge(page, "getSession")).gameplay, "potato-seed")).toBe(5);
  await page.reload();
  await boot(page);
  await expect.poll(async () => inventoryQuantity((await bridge(page, "getSession")).gameplay, "potato-seed")).toBe(5);
  await page.evaluate(() => localStorage.setItem("nestledburrow.audio.v1", JSON.stringify({ schemaVersion: 1, settings: { master: 0.2, music: 0.3, effects: 0.4 } })));
  await bridge(page, "setLanguage", "ru");
  await openNewGameConfirmation(page);
  await expect.poll(() => bridge(page, "getHudState")).toMatchObject({ newGameConfirming: true });
  await clickLogical(page, 92, 95);
  await expect.poll(async () => inventoryQuantity((await bridge(page, "getSession")).gameplay, "potato-seed")).toBe(4);
  await expect.poll(() => bridge(page, "getLanguage")).toBe("ru");
  await expect.poll(() => bridge(page, "getAudioSettings")).toMatchObject({ master: 0.2, music: 0.3, effects: 0.4 });
});

test("desktop keyboard selects and preserves diagonal runtime facing", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop keyboard smoke only");
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await boot(page, "./?movementDebug=1");

  await page.keyboard.down("KeyW");
  await page.keyboard.down("KeyD");
  await expect.poll(async () => (await bridge(page, "getCharacterSnapshot", "player")).facingDirection).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
  await expect.poll(async () => {
    const facing = (await bridge(page, "getCharacterSnapshot", "player")).facingDirection;
    return facing.x > 0 && facing.y < 0;
  }).toBe(true);
  await page.keyboard.up("KeyD");
  await page.keyboard.up("KeyW");
  await expect.poll(async () => (await bridge(page, "getCharacterSnapshot", "player")).speed).toBeCloseTo(0, 3);
  let facing = (await bridge(page, "getCharacterSnapshot", "player")).facingDirection;
  expect(facing.x).toBeGreaterThan(0); expect(facing.y).toBeLessThan(0);

  await page.keyboard.down("KeyS");
  await page.keyboard.down("KeyA");
  await expect.poll(async () => {
    const nextFacing = (await bridge(page, "getCharacterSnapshot", "player")).facingDirection;
    return nextFacing.x < 0 && nextFacing.y > 0;
  }).toBe(true);
  await page.keyboard.up("KeyA");
  await page.keyboard.up("KeyS");
  await expect.poll(async () => (await bridge(page, "getCharacterSnapshot", "player")).speed).toBeCloseTo(0, 3);
  facing = (await bridge(page, "getCharacterSnapshot", "player")).facingDirection;
  expect(facing.x).toBeLessThan(0); expect(facing.y).toBeGreaterThan(0);
  expect(pageErrors).toEqual([]);
});

test("mobile touch opens the Russian seed shop without joystick capture", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "mobile project only");
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await boot(page);
  await page.evaluate(() => localStorage.setItem("nestledburrow.audio.v1", JSON.stringify({ schemaVersion: 1, settings: { master: 0.2, music: 0.3, effects: 0.4 } })));
  await bridge(page, "setLanguage", "ru");
  await placeNear(page, "seed-merchant");
  const prompt = await bridge(page, "getInteractionHudState");
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Game canvas is unavailable");
  await page.touchscreen.tap(
    box.x + (prompt.promptRect.x + prompt.promptRect.width / 2) * box.width / 320,
    box.y + (prompt.promptRect.y + prompt.promptRect.height / 2) * box.height / 180,
  );
  await expect.poll(() => bridge(page, "getMerchantState")).toMatchObject({ active: true, visible: true });
  await expect.poll(async () => (await bridge(page, "getMerchantState")).labels.title).toMatch(/[А-ЯЁ]/);
  await expect.poll(() => bridge(page, "getLanguage")).toBe("ru");
  expect(pageErrors).toEqual([]);
});

test("desktop clears a persistent resource and New Game restores gameplay only", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop keyboard debris flow only");
  await boot(page);
  await bridge(page, "setLanguage", "en");
  await page.evaluate(() => localStorage.setItem("nestledburrow.audio.v1", JSON.stringify({ schemaVersion: 1, settings: { master: 0.2, music: 0.3, effects: 0.4 } })));
  await bridge(page, "selectInventorySlot", 0);
  await placeNear(page, "fallen-log-01");
  await expect.poll(async () => (await bridge(page, "getResourceVisualState", "fallen-log-01"))?.highlighted).toBe(true);
  await page.locator("canvas").screenshot({ path: "artifacts/task-047/resource-target-outline.png" });
  await bridge(page, "selectInventorySlot", 1);
  await expect.poll(async () => (await bridge(page, "getInteractionState"))?.candidate).toBeNull();
  await expect.poll(async () => (await bridge(page, "getResourceVisualState", "fallen-log-01"))?.highlighted).toBe(false);
  await bridge(page, "interact");
  expect((await bridge(page, "getSession")).gameplay.resourceNodes["fallen-log-01"].progress).toBe(0);
  await bridge(page, "selectInventorySlot", 0);
  await expect.poll(async () => (await bridge(page, "getInteractionState"))?.candidate?.entityId).toBe("fallen-log-01");
  for (let hitCount = 1; hitCount <= 7; hitCount += 1) {
    await expect.poll(async () => (await bridge(page, "getInteractionState"))?.candidate?.prompt).toBe("hud:interaction.chop");
    await pressInteract(page);
    await expect.poll(async () => (await bridge(page, "getSession"))?.gameplay?.resourceNodes?.["fallen-log-01"]?.progress).toBeCloseTo(hitCount / 7, 6);
    await bridge(page, "expireHitCooldown");
  }
  await expect.poll(async () => {
    const session = await bridge(page, "getSession");
    return {
      maximumEnergy: session.gameplay.maximumEnergy,
      wood: inventoryQuantity(session.gameplay, "wood"),
      node: session.gameplay.resourceNodes["fallen-log-01"],
    };
  }).toMatchObject({ maximumEnergy: 100, wood: 1, node: { cleared: true, progress: 1 } });
  const clearedSession = await bridge(page, "getSession");
  expect(clearedSession.gameplay.currentEnergy).toBeGreaterThan(0);
  expect(clearedSession.gameplay.currentEnergy).toBeLessThan(97);
  await expect.poll(async () => (await bridge(page, "getDebrisState"))?.present).toBe(false);
  await expect.poll(async () => (await bridge(page, "getInteractionState"))?.candidate).toBeNull();
  await page.reload();
  await boot(page);
  await expect.poll(async () => {
    const session = await bridge(page, "getSession");
    return { wood: inventoryQuantity(session.gameplay, "wood"), node: session.gameplay.resourceNodes["fallen-log-01"] };
  }).toMatchObject({ wood: 1, node: { cleared: true } });
  await openNewGameConfirmation(page);
  await clickLogical(page, 92, 95);
  await expect.poll(async () => {
    const session = await bridge(page, "getSession");
    return {
      wood: inventoryQuantity(session.gameplay, "wood"),
      stone: inventoryQuantity(session.gameplay, "stone"),
      tools: session.gameplay.inventory.slots.slice(0, 3).map((item) => item.id),
      node: session.gameplay.resourceNodes["fallen-log-01"],
      worldItems: session.gameplay.worldItems,
    };
  }).toEqual({ wood: 0, stone: 0, tools: ["axe", "hoe", "watering-can"], node: { cleared: false, progress: 0 }, worldItems: [] });
  expect((await bridge(page, "getSession")).gameplay.currentEnergy).toBeGreaterThan(95);
  await expect.poll(() => bridge(page, "getLanguage")).toBe("en");
  await expect.poll(() => bridge(page, "getAudioSettings")).toMatchObject({ master: 0.2, music: 0.3, effects: 0.4 });
});

test("mobile touch clears a resource through prompt hit area", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "mobile debris touch flow only");
  await boot(page);
  await bridge(page, "selectInventorySlot", 0);
  await placeNear(page, "fallen-log-01");
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Game canvas is unavailable");
  for (let hitCount = 1; hitCount <= 7; hitCount += 1) {
    await expect.poll(async () => (await bridge(page, "getInteractionState"))?.candidate?.prompt).toBe("hud:interaction.chop");
    const prompt = await bridge(page, "getInteractionHudState");
    await page.touchscreen.tap(
      box.x + (prompt.promptRect.x + prompt.promptRect.width / 2) * box.width / 320,
      box.y + (prompt.promptRect.y + prompt.promptRect.height / 2) * box.height / 180,
    );
    await expect.poll(async () => (await bridge(page, "getSession"))?.gameplay?.resourceNodes?.["fallen-log-01"]?.progress).toBeCloseTo(hitCount / 7, 6);
    await bridge(page, "expireHitCooldown");
  }
  await expect.poll(async () => {
    const session = await bridge(page, "getSession");
    return { wood: inventoryQuantity(session.gameplay, "wood"), node: session.gameplay.resourceNodes["fallen-log-01"] };
  }).toMatchObject({ wood: 1, node: { cleared: true } });
  const clearedSession = await bridge(page, "getSession");
  expect(clearedSession.gameplay.currentEnergy).toBeGreaterThan(0);
  expect(clearedSession.gameplay.currentEnergy).toBeLessThan(97);
});
