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

test("desktop clears persistent debris and New Game restores gameplay only", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop keyboard debris flow only");
  await boot(page);
  await bridge(page, "setLanguage", "en");
  await page.evaluate(() => localStorage.setItem("nestledburrow.audio.v1", JSON.stringify({ schemaVersion: 1, settings: { master: 0.2, music: 0.3, effects: 0.4 } })));
  await placeNear(page, "fallen-log-01");
  for (let remainingHits = 4; remainingHits >= 0; remainingHits -= 1) {
    await expect.poll(async () => (await bridge(page, "getInteractionState"))?.candidate?.prompt).toBe("hud:interaction.chop");
    await pressInteract(page);
    await expect.poll(async () => (await bridge(page, "getSession"))?.gameplay?.debris?.["fallen-log-01"]?.remainingHits).toBe(remainingHits);
  }
  await expect.poll(() => bridge(page, "getSession")).toMatchObject({ gameplay: { currentEnergy: 80, maximumEnergy: 100, wood: 1, debris: { "fallen-log-01": { cleared: true } } } });
  await expect.poll(async () => (await bridge(page, "getDebrisState"))?.present).toBe(false);
  await expect.poll(async () => (await bridge(page, "getInteractionState"))?.candidate).toBeNull();
  await page.reload();
  await boot(page);
  await expect.poll(() => bridge(page, "getSession")).toMatchObject({ gameplay: { currentEnergy: 80, wood: 1, debris: { "fallen-log-01": { cleared: true } } } });
  await clickLogical(page, 24, 18);
  await clickLogical(page, 92, 111);
  await expect.poll(() => bridge(page, "getSession")).toMatchObject({ gameplay: { currentEnergy: 100, maximumEnergy: 100, wood: 0, debris: { "fallen-log-01": { cleared: false } } } });
  await expect.poll(() => bridge(page, "getLanguage")).toBe("en");
  await expect.poll(() => bridge(page, "getAudioSettings")).toMatchObject({ master: 0.2, music: 0.3, effects: 0.4 });
});

test("mobile touch clears debris through prompt hit area", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "mobile debris touch flow only");
  await boot(page);
  await placeNear(page, "fallen-log-01");
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Game canvas is unavailable");
  for (let remainingHits = 4; remainingHits >= 0; remainingHits -= 1) {
    await expect.poll(async () => (await bridge(page, "getInteractionState"))?.candidate?.prompt).toBe("hud:interaction.chop");
    await page.touchscreen.tap(box.x + 280 * box.width / 320, box.y + 158 * box.height / 180);
    await expect.poll(async () => (await bridge(page, "getSession"))?.gameplay?.debris?.["fallen-log-01"]?.remainingHits).toBe(remainingHits);
  }
  await expect.poll(() => bridge(page, "getSession")).toMatchObject({ gameplay: { currentEnergy: 80, wood: 1, debris: { "fallen-log-01": { cleared: true } } } });
});
