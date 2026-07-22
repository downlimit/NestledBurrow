import { expect, test } from "@playwright/test";

async function boot(page) {
  await page.goto("./");
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
  await page.keyboard.down("KeyE");
  await page.waitForTimeout(50);
  await page.keyboard.up("KeyE");
}

async function placeNear(page, entityId) {
  await bridge(page, "placePlayerNear", entityId);
  await expect.poll(async () => (await bridge(page, "getInteractionState"))?.candidate?.entityId).toBe(entityId);
}

async function completeDialogue(page, entityId) {
  await placeNear(page, entityId);
  await pressInteract(page);
  await expect.poll(async () => (await bridge(page, "getInteractionState"))?.dialogueActive ?? false).toBe(true);
  while ((await bridge(page, "getInteractionState"))?.dialogueActive) {
    await pressInteract(page);
  }
}

async function clickLogical(page, x, y) {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Game canvas is unavailable");
  await page.mouse.click(box.x + x * box.width / 320, box.y + y * box.height / 180);
}

test("locale detection and saved preference survive reload", async ({ page }, testInfo) => {
  await boot(page);
  const expected = testInfo.project.name.startsWith("mobile") ? "ru" : "en";
  await expect.poll(() => bridge(page, "getLanguage")).toBe(expected);
  await bridge(page, "setLanguage", "en");
  await page.reload();
  await boot(page);
  await expect.poll(() => bridge(page, "getLanguage")).toBe("en");
});

test("localized quest progress persists and New Game keeps language", async ({ page }) => {
  await boot(page);
  await completeDialogue(page, "home-npc");
  await expect.poll(() => bridge(page, "getSession")).toMatchObject({ flags: { "neighborQuest.started": true } });
  await completeDialogue(page, "street-npc");
  await completeDialogue(page, "home-npc");
  await expect.poll(() => bridge(page, "getSession")).toMatchObject({ flags: {
    "neighborQuest.started": true,
    "neighborQuest.streetAnswered": true,
    "neighborQuest.completed": true,
  } });
  await page.reload();
  await boot(page);
  await expect.poll(() => bridge(page, "getSession")).toMatchObject({ flags: { "neighborQuest.completed": true } });
  await bridge(page, "setLanguage", "ru");
  await clickLogical(page, 24, 18);
  await expect.poll(() => bridge(page, "getHudState")).toMatchObject({ newGameConfirming: true });
  await clickLogical(page, 92, 111);
  await expect.poll(() => bridge(page, "getSession")).toMatchObject({ flags: {} });
  await expect.poll(() => bridge(page, "getLanguage")).toBe("ru");
});

test("mobile touch starts a Russian dialogue without joystick capture", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "mobile project only");
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await boot(page);
  await bridge(page, "setLanguage", "ru");
  await placeNear(page, "home-npc");
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Game canvas is unavailable");
  await page.touchscreen.tap(box.x + 280 * box.width / 320, box.y + 158 * box.height / 180);
  await expect.poll(async () => (await bridge(page, "getInteractionState"))?.dialogueActive ?? false).toBe(true);
  await expect.poll(() => bridge(page, "getLanguage")).toBe("ru");
  expect(pageErrors).toEqual([]);
});
