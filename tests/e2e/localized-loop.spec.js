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

test("default Russian locale and saved preference survive reload", async ({ page }) => {
  await boot(page);
  await expect.poll(() => bridge(page, "getLanguage")).toBe("ru");
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
  await page.evaluate(() => localStorage.setItem("nestledburrow.audio.v1", JSON.stringify({ schemaVersion: 1, settings: { master: 0.2, music: 0.3, effects: 0.4 } })));
  await bridge(page, "setLanguage", "ru");
  await clickLogical(page, 24, 18);
  await expect.poll(() => bridge(page, "getHudState")).toMatchObject({ newGameConfirming: true });
  await clickLogical(page, 92, 111);
  await expect.poll(() => bridge(page, "getSession")).toMatchObject({ flags: {} });
  await expect.poll(() => bridge(page, "getLanguage")).toBe("ru");
  await expect.poll(() => bridge(page, "getAudioSettings")).toMatchObject({ master: 0.2, music: 0.3, effects: 0.4 });
});

test("desktop keyboard selects and preserves diagonal runtime facing", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop keyboard smoke only");
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await boot(page, "./?movementDebug=1");
  const status = page.locator(".movement-debug-status");

  await page.keyboard.down("KeyW");
  await page.keyboard.down("KeyD");
  await expect(status).toContainText("facing up-right");
  await page.keyboard.up("KeyD");
  await page.keyboard.up("KeyW");
  await expect(status).toContainText("speed 0.0");
  await expect(status).toContainText("facing up-right");

  await page.keyboard.down("KeyS");
  await page.keyboard.down("KeyA");
  await expect(status).toContainText("facing down-left");
  await page.keyboard.up("KeyA");
  await page.keyboard.up("KeyS");
  await expect(status).toContainText("speed 0.0");
  await expect(status).toContainText("facing down-left");
  expect(pageErrors).toEqual([]);
});

test("mobile touch starts a Russian dialogue without joystick capture", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "mobile project only");
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await boot(page);
  await page.evaluate(() => localStorage.setItem("nestledburrow.audio.v1", JSON.stringify({ schemaVersion: 1, settings: { master: 0.2, music: 0.3, effects: 0.4 } })));
  await bridge(page, "setLanguage", "ru");
  await placeNear(page, "home-npc");
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Game canvas is unavailable");
  await page.touchscreen.tap(box.x + 280 * box.width / 320, box.y + 158 * box.height / 180);
  await expect.poll(async () => (await bridge(page, "getInteractionState"))?.dialogueActive ?? false).toBe(true);
  await expect.poll(() => bridge(page, "getLanguage")).toBe("ru");
  expect(pageErrors).toEqual([]);
});

test("persistent debris clearing slice survives reload and New Game", async ({ page }, testInfo) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await boot(page, "./?movementDebug=1");
  await page.evaluate(() => {
    localStorage.setItem("nestledburrow.audio.v1", JSON.stringify({ schemaVersion: 1, settings: { master: 0.2, music: 0.3, effects: 0.4 } }));
  });
  await bridge(page, "setLanguage", "en");
  await bridge(page, "placePlayerNear", "fallen-log-001");
  await expect.poll(async () => (await bridge(page, "getInteractionState"))?.candidate).toMatchObject({ entityId: "fallen-log-001", prompt: "hud:interaction.clearDebris" });

  if (testInfo.project.name.startsWith("mobile")) {
    const box = await page.locator("canvas").boundingBox();
    if (!box) throw new Error("Game canvas is unavailable");
    await page.touchscreen.tap(box.x + 280 * box.width / 320, box.y + 158 * box.height / 180);
  } else {
    await pressInteract(page);
  }

  await expect.poll(() => bridge(page, "getSession")).toMatchObject({ gameplay: { energy: { current: 80, max: 100 }, resources: { wood: 1 }, debris: { "fallen-log-001": { cleared: true } } } });
  await expect.poll(() => bridge(page, "getDebrisState")).toMatchObject({ exists: false, blocked: false });
  await expect.poll(async () => (await bridge(page, "getInteractionState"))?.candidate).toBe(null);

  await page.reload();
  await boot(page, "./?movementDebug=1");
  await expect.poll(() => bridge(page, "getSession")).toMatchObject({ gameplay: { energy: { current: 80, max: 100 }, resources: { wood: 1 }, debris: { "fallen-log-001": { cleared: true } } } });
  await expect.poll(() => bridge(page, "getDebrisState")).toMatchObject({ exists: false, blocked: false });

  await clickLogical(page, 24, 18);
  await expect.poll(() => bridge(page, "getHudState")).toMatchObject({ newGameConfirming: true });
  await clickLogical(page, 92, 111);
  await expect.poll(() => bridge(page, "getSession")).toMatchObject({ gameplay: { energy: { current: 100, max: 100 }, resources: { wood: 0 }, debris: { "fallen-log-001": { cleared: false } } } });
  await expect.poll(() => bridge(page, "getDebrisState")).toMatchObject({ exists: true, objectAlive: true, blocked: true });
  await expect.poll(() => bridge(page, "getLanguage")).toBe("en");
  await expect.poll(() => bridge(page, "getAudioSettings")).toMatchObject({ master: 0.2, music: 0.3, effects: 0.4 });
  expect(pageErrors).toEqual([]);
});
