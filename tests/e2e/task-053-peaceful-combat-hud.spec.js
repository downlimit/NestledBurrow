import { expect, test } from "@playwright/test";

async function bridge(page, method, argument) {
  return page.evaluate(({ method, argument }) => window.__NESTLED_BURROW_E2E__?.[method]?.(argument), { method, argument });
}

async function boot(page) {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  await expect(page.locator("canvas")).toHaveJSProperty("width", 640);
  await expect(page.locator("canvas")).toHaveJSProperty("height", 360);
}

async function inventoryMode(page) {
  return (await bridge(page, "getHudState")).inventoryMode;
}

async function interactionHud(page) {
  return bridge(page, "getInteractionHudState");
}

async function tapAlt(page) {
  await page.keyboard.down("Alt");
  await page.waitForTimeout(60);
  await page.keyboard.up("Alt");
}

async function canvasPoint(page, point) {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Game canvas is unavailable");
  return {
    x: box.x + point.x * box.width / 640,
    y: box.y + point.y * box.height / 360,
  };
}

async function transformedSlotPoint(page, panelState, slot) {
  return canvasPoint(page, {
    x: panelState.x + (slot.x + slot.width / 2) * panelState.scale,
    y: panelState.y + (slot.y + slot.height / 2) * panelState.scale,
  });
}

test("Alt tap preserves peaceful selection while hidden inventory shortcuts stay inactive", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Task #053 defines desktop physical Alt only");
  await boot(page);

  await expect.poll(() => inventoryMode(page)).toMatchObject({
    mode: "PEACEFUL",
    stableMode: "PEACEFUL",
    transitioning: false,
    earVisible: true,
    peaceful: { scale: 1, alpha: 1, inputEnabled: true },
    combat: { alpha: 0, inputEnabled: false },
  });
  expect((await inventoryMode(page)).combat.slots.map(({ label }) => label))
    .toEqual(["SPACE", "LMB", "RMB", "SHIFT", "1", "2", "3", "4", "5", "6"]);

  await page.keyboard.press("Digit1");
  await expect.poll(async () => (await bridge(page, "getHudState")).resources.inventory.selectedIndex).toBe(0);

  await tapAlt(page);
  await expect.poll(() => inventoryMode(page), { timeout: 1500 }).toMatchObject({
    mode: "COMBAT",
    stableMode: "COMBAT",
    transitioning: false,
    earVisible: false,
    peaceful: { scale: 0.3, alpha: 0, inputEnabled: false },
    combat: { scale: 1, alpha: 1, inputEnabled: true },
  });
  await expect.poll(() => interactionHud(page)).toMatchObject({
    suppressed: true,
    promptVisible: false,
  });
  await expect.poll(async () => (await bridge(page, "getHudState")).resources.inventory.selectedIndex).toBe(0);
  await page.keyboard.press("Digit2");
  await page.keyboard.press("KeyE");
  await page.locator("canvas").hover();
  await page.mouse.wheel(0, 120);
  expect((await bridge(page, "getHudState")).resources.inventory.selectedIndex).toBe(0);

  await tapAlt(page);
  await expect.poll(() => inventoryMode(page), { timeout: 1500 }).toMatchObject({
    mode: "PEACEFUL",
    stableMode: "PEACEFUL",
    transitioning: false,
    earVisible: true,
    peaceful: { scale: 1, alpha: 1, inputEnabled: true },
    combat: { alpha: 0 },
  });
  await expect.poll(() => interactionHud(page)).toMatchObject({ suppressed: false });
  await expect.poll(async () => (await bridge(page, "getHudState")).resources.inventory.selectedIndex).toBe(0);
  await page.mouse.wheel(0, 120);
  await expect.poll(async () => (await bridge(page, "getHudState")).resources.inventory.selectedIndex).toBe(1);
  await page.mouse.wheel(0, -120);
  await expect.poll(async () => (await bridge(page, "getHudState")).resources.inventory.selectedIndex).toBe(0);
});

test("held Alt is transient, releases to its origin, and blur cannot latch loadout edit", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Task #053 defines desktop physical Alt only");
  await boot(page);

  await page.keyboard.down("Alt");
  await expect.poll(() => interactionHud(page)).toMatchObject({
    suppressed: true,
    promptVisible: false,
  });
  await expect.poll(() => inventoryMode(page), { timeout: 1000 }).toMatchObject({
    mode: "LOADOUT_EDIT",
    stableMode: "PEACEFUL",
  });
  await expect.poll(() => inventoryMode(page), { timeout: 1000 }).toMatchObject({
    mode: "LOADOUT_EDIT",
    transitioning: false,
    peaceful: { scale: 0.8, alpha: 1, inputEnabled: false },
    combat: { scale: 0.8, alpha: 1, inputEnabled: true },
    earVisible: false,
  });
  expect((await bridge(page, "getHudState")).combatLoadout.presentation.labelScreenScale).toBe(1);
  expect((await bridge(page, "getHudState")).resources.inventory.presentation.labelScreenScale).toBe(1);
  const loadout = await inventoryMode(page);
  const peacefulBottom = loadout.peaceful.y + (156 + 22) * loadout.peaceful.scale;
  const combatTop = loadout.combat.y
    + Math.min(...loadout.combat.slots.map(({ y }) => y)) * loadout.combat.scale;
  expect(peacefulBottom).toBeLessThan(combatTop);

  await page.keyboard.up("Alt");
  await expect.poll(() => inventoryMode(page), { timeout: 1000 }).toMatchObject({
    mode: "PEACEFUL",
    stableMode: "PEACEFUL",
    altDown: false,
    transitioning: false,
  });
  await expect.poll(() => interactionHud(page)).toMatchObject({ suppressed: false });

  await tapAlt(page);
  await expect.poll(() => inventoryMode(page), { timeout: 1500 }).toMatchObject({
    mode: "COMBAT",
    stableMode: "COMBAT",
    transitioning: false,
  });
  await expect.poll(() => interactionHud(page)).toMatchObject({ suppressed: true, promptVisible: false });
  await page.keyboard.down("Alt");
  await expect.poll(() => inventoryMode(page), { timeout: 1000 }).toMatchObject({
    mode: "LOADOUT_EDIT",
    stableMode: "COMBAT",
  });
  await page.keyboard.up("Alt");
  await expect.poll(() => inventoryMode(page), { timeout: 1000 }).toMatchObject({
    mode: "COMBAT",
    stableMode: "COMBAT",
    altDown: false,
    transitioning: false,
  });

  await page.keyboard.down("Alt");
  await expect.poll(() => inventoryMode(page), { timeout: 1000 }).toMatchObject({ mode: "LOADOUT_EDIT" });
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect.poll(() => inventoryMode(page)).toMatchObject({
    mode: "COMBAT",
    stableMode: "COMBAT",
    altDown: false,
    holdTriggered: false,
    transitioning: false,
  });
  await page.keyboard.up("Alt");
});

test("held Alt supports persistent drag in both directions between peaceful and combat slots", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Task #053 defines desktop physical Alt only");
  await boot(page);

  await page.keyboard.down("Alt");
  await expect.poll(() => inventoryMode(page), { timeout: 1000 }).toMatchObject({
    mode: "LOADOUT_EDIT",
    transitioning: false,
    combat: { inputEnabled: true },
  });
  let mode = await inventoryMode(page);
  let source = await transformedSlotPoint(page, mode.peaceful, { x: 201, y: 336, width: 22, height: 22 });
  let target = await transformedSlotPoint(page, mode.combat, mode.combat.slots[0]);
  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.combatLoadout.slots[0]?.id).toBe("axe");
  expect((await bridge(page, "getSession")).gameplay.inventory.slots[0]).toBeNull();
  await page.keyboard.up("Alt");
  await expect.poll(() => inventoryMode(page), { timeout: 1000 }).toMatchObject({
    mode: "COMBAT",
    stableMode: "COMBAT",
  });

  await page.reload();
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.combatLoadout.slots[0]?.id).toBe("axe");

  await page.keyboard.down("Alt");
  await expect.poll(() => inventoryMode(page), { timeout: 1000 }).toMatchObject({
    mode: "LOADOUT_EDIT",
    transitioning: false,
    combat: { inputEnabled: true },
  });
  mode = await inventoryMode(page);
  source = await transformedSlotPoint(page, mode.combat, mode.combat.slots[0]);
  target = await transformedSlotPoint(page, mode.peaceful, { x: 201, y: 336, width: 22, height: 22 });
  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.inventory.slots[0]?.id).toBe("axe");
  expect((await bridge(page, "getSession")).gameplay.combatLoadout.slots[0]).toBeNull();
  await page.keyboard.up("Alt");
  await expect.poll(() => inventoryMode(page), { timeout: 1000 }).toMatchObject({
    mode: "PEACEFUL",
    stableMode: "PEACEFUL",
  });
});

test("combat loadout items can be dropped into the world and combat pickup uses number slots", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Task #053 defines desktop physical Alt only");
  await boot(page);

  await page.keyboard.down("Alt");
  await expect.poll(() => inventoryMode(page), { timeout: 1000 }).toMatchObject({ mode: "LOADOUT_EDIT", transitioning: false });
  let mode = await inventoryMode(page);
  let source = await transformedSlotPoint(page, mode.peaceful, { x: 201, y: 336, width: 22, height: 22 });
  let target = await transformedSlotPoint(page, mode.combat, mode.combat.slots[0]);
  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up("Alt");
  await expect.poll(() => inventoryMode(page), { timeout: 1000 }).toMatchObject({
    mode: "COMBAT",
    stableMode: "COMBAT",
    transitioning: false,
    combat: { inputEnabled: true },
  });

  mode = await inventoryMode(page);
  source = await transformedSlotPoint(page, mode.combat, mode.combat.slots[0]);
  await page.mouse.click(source.x, source.y);
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.combatLoadout.slots[0]?.id).toBe("axe");
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.worldItems.some((item) => item.item.id === "axe")).toBe(false);
  target = await canvasPoint(page, { x: 160, y: 80 });
  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await expect.poll(async () => (await bridge(page, "getHudState")).loadoutDrag).toMatchObject({
    enabled: true,
    dragging: false,
    source: { panel: "combat", index: 0 },
  });
  await page.mouse.move(target.x, target.y, { steps: 4 });
  await expect.poll(async () => (await bridge(page, "getHudState")).loadoutDrag).toMatchObject({ dragging: true });
  await expect.poll(async () => (await bridge(page, "getHudState")).resources.throwAim).toMatchObject({ visible: true });
  await page.mouse.up();
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.worldItems.some((item) => item.item.id === "axe")).toBe(true);
  expect((await bridge(page, "getSession")).gameplay.combatLoadout.slots[0]).toBeNull();
  await expect.poll(() => inventoryMode(page), { timeout: 1000 }).toMatchObject({ mode: "COMBAT", stableMode: "COMBAT" });

  await page.waitForTimeout(500);
  const dropped = (await bridge(page, "getSession")).gameplay.worldItems.find((item) => item.item.id === "axe");
  await bridge(page, "placePlayerAt", { x: dropped.x, y: dropped.y, facing: { x: 0, y: 1 } });
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.worldItems.some((item) => item.item.id === "axe")).toBe(false);
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.combatLoadout.slots[4]?.id).toBe("axe");
});

test("options and build mode suppress Alt without changing the stable mode", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Task #053 defines desktop physical Alt only");
  await boot(page);
  const optionsPoint = await canvasPoint(page, { x: 45, y: 19 });

  await page.mouse.click(optionsPoint.x, optionsPoint.y);
  await expect.poll(() => bridge(page, "getHudState")).toMatchObject({ optionsOpen: true });
  await tapAlt(page);
  await page.waitForTimeout(250);
  expect(await inventoryMode(page)).toMatchObject({
    mode: "PEACEFUL",
    stableMode: "PEACEFUL",
    suppressed: true,
    altDown: false,
  });

  await page.mouse.click(optionsPoint.x, optionsPoint.y);
  await expect.poll(() => bridge(page, "getHudState")).toMatchObject({ optionsOpen: false });
  await bridge(page, "toggleBuildMode");
  await expect.poll(() => inventoryMode(page)).toMatchObject({ suppressed: true, stableMode: "PEACEFUL" });
  await tapAlt(page);
  await page.waitForTimeout(250);
  expect(await inventoryMode(page)).toMatchObject({ mode: "PEACEFUL", stableMode: "PEACEFUL" });
  await bridge(page, "toggleBuildMode");
  await expect.poll(() => inventoryMode(page)).toMatchObject({ suppressed: false, stableMode: "PEACEFUL" });
});

test("new game reloads one clean runtime without touching destroyed inventory zones", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Task #053 lifecycle regression is covered on desktop");
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await boot(page);
  await page.evaluate(() => {
    window.__NESTLED_BURROW_E2E__.__task053PreviousBridge = true;
  });

  for (const point of [
    { x: 45, y: 19 },
    { x: 185, y: 87 },
    { x: 92, y: 95 },
  ]) {
    const target = await canvasPoint(page, point);
    await page.mouse.click(target.x, target.y);
  }

  await page.waitForFunction(
    () => Boolean(window.__NESTLED_BURROW_E2E__)
      && !window.__NESTLED_BURROW_E2E__.__task053PreviousBridge,
    null,
    { timeout: 3_000 },
  );
  await expect.poll(() => inventoryMode(page), { timeout: 1500 }).toMatchObject({
    mode: "PEACEFUL",
    stableMode: "PEACEFUL",
    transitioning: false,
    peaceful: { inputEnabled: true },
  });
  expect(pageErrors).toEqual([]);
});
