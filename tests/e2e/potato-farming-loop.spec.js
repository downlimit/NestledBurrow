import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const EVIDENCE_DIR = "artifacts/task-047";
const FARM_CELL = { x: 400, y: 496 };
const WELL_CELL = { x: 448, y: 496 };

async function bridge(page, method, argument) {
  return page.evaluate(
    ({ method, argument }) => window.__NESTLED_BURROW_E2E__?.[method]?.(argument),
    { method, argument },
  );
}

async function boot(page) {
  await page.setViewportSize({ width: 320, height: 180 });
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
}

async function pressInteract(page) {
  await page.keyboard.down("Space");
  await page.waitForTimeout(50);
  await page.keyboard.up("Space");
  await page.waitForTimeout(80);
}

async function clickLogical(page, point) {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Game canvas is unavailable");
  await page.mouse.click(
    box.x + point.x * box.width / 320,
    box.y + point.y * box.height / 180,
  );
}

async function placeNear(page, entityId) {
  await expect.poll(async () => {
    await bridge(page, "placePlayerNear", entityId);
    return (await bridge(page, "getInteractionState"))?.candidate?.entityId;
  }).toBe(entityId);
}

async function faceFarmCell(page) {
  await bridge(page, "placePlayerAt", {
    x: FARM_CELL.x - 8,
    y: FARM_CELL.y + 12,
    facing: { x: 1, y: 0 },
  });
  const selectedItem = (await bridge(page, "getFarmingState")).selectedItem;
  await page.keyboard.down("KeyD");
  if (["hoe", "axe", "water-bucket"].includes(selectedItem)) {
    await expect.poll(async () => (await bridge(page, "getFarmingState")).hoeAimDirection).toEqual({ x: 1, y: 0 });
  } else {
    await expect.poll(async () => (await bridge(page, "getFarmingState")).targetCell).toEqual(FARM_CELL);
  }
  await page.keyboard.up("KeyD");
}

function inventoryQuantity(session, itemId) {
  return session.gameplay.inventory.slots
    .filter((item) => item?.id === itemId)
    .reduce((sum, item) => sum + item.quantity, 0);
}

test("time controls pause and accelerate the farming clock", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop proves the clock controls once");
  await boot(page);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await boot(page);

  const hud = await bridge(page, "getHudState");
  expect(hud.timeControlsVisible).toBe(true);
  expect(hud.areas.timeControls).toHaveLength(4);
  await bridge(page, "setCoins", 27);
  await expect.poll(async () => (await bridge(page, "getHudState")).resources).toMatchObject({
    coinCount: 27,
    coinText: "27",
  });
  const clickControl = async (index) => {
    const rect = (await bridge(page, "getHudState")).areas.timeControls[index];
    await clickLogical(page, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
  };

  await clickControl(0);
  await expect.poll(async () => (await bridge(page, "getRuntimeState")).timeScale).toBe(0);
  const pausedAt = (await bridge(page, "getSession")).gameplay.worldTimeSeconds;
  await page.waitForTimeout(220);
  expect((await bridge(page, "getSession")).gameplay.worldTimeSeconds).toBe(pausedAt);

  const options = hud.areas.options;
  await clickLogical(page, { x: options.x + options.width / 2, y: options.y + options.height / 2 });
  await expect.poll(async () => (await bridge(page, "getHudState")).timeControlsVisible).toBe(false);
  await clickLogical(page, { x: options.x + options.width / 2, y: options.y + options.height / 2 });

  await clickControl(3);
  await expect.poll(async () => bridge(page, "getRuntimeState")).toMatchObject({
    timeScale: 16,
    selectedTimeScale: 16,
  });
  await expect.poll(async () => (await bridge(page, "getAudioEffectState")).lastEffectType).toBe("time-speed-up");
  const acceleratedAt = (await bridge(page, "getSession")).gameplay.worldTimeSeconds;
  await page.waitForTimeout(250);
  expect((await bridge(page, "getSession")).gameplay.worldTimeSeconds - acceleratedAt).toBeGreaterThan(120);

  await clickControl(1);
  await expect.poll(async () => bridge(page, "getRuntimeState")).toMatchObject({
    timeScale: 1,
    selectedTimeScale: 1,
  });
  await expect.poll(async () => (await bridge(page, "getAudioEffectState")).lastEffectType).toBe("time-speed-normal");
});

test("complete potato loop purchases, grows, refills, harvests separate drops and persists", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop captures the integrated farming route once");
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await boot(page);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await boot(page);

  await bridge(page, "setLanguage", "en");
  await placeNear(page, "seed-merchant");
  await pressInteract(page);
  await expect.poll(() => bridge(page, "getMerchantState")).toMatchObject({
    active: true,
    visible: true,
    labels: { title: "SEED MERCHANT" },
  });
  const merchantLayout = await bridge(page, "getMerchantState");
  expect(merchantLayout.panel.y).toBeGreaterThanOrEqual(34);
  expect(merchantLayout.panel.y + merchantLayout.panel.height).toBeLessThan(156);
  expect(merchantLayout.panel.x + merchantLayout.panel.width).toBeLessThanOrEqual(242);
  await pressInteract(page);
  await expect.poll(async () => (await bridge(page, "getMerchantState")).active).toBe(false);
  await expect.poll(async () => (await bridge(page, "getAudioEffectState")).lastEffectType).toBe("menu-close");
  await pressInteract(page);
  await expect.poll(async () => (await bridge(page, "getMerchantState")).active).toBe(true);
  await expect.poll(async () => (await bridge(page, "getAudioEffectState")).lastEffectType).toBe("menu-open");
  await bridge(page, "setLanguage", "ru");
  await expect.poll(async () => (await bridge(page, "getMerchantState")).labels.title).toMatch(/[А-ЯЁ]/);
  await bridge(page, "setLanguage", "en");
  const coinsBefore = (await bridge(page, "getSession")).gameplay.coins;
  const buyButton = (await bridge(page, "getMerchantState")).buyButton;
  await clickLogical(page, { x: buyButton.x + buyButton.width / 2, y: buyButton.y + buyButton.height / 2 });
  await expect.poll(async () => inventoryQuantity(await bridge(page, "getSession"), "potato-seed")).toBe(5);
  expect((await bridge(page, "getSession")).gameplay.coins).toBe(coinsBefore - 1);
  await expect.poll(async () => (await bridge(page, "getAudioEffectState")).lastEffectType).toBe("purchase");

  const well = await bridge(page, "placeWell", WELL_CELL);
  expect(well).toMatchObject({ status: "placed" });
  await bridge(page, "selectInventorySlot", 2);
  await faceFarmCell(page);
  await expect.poll(async () => (await bridge(page, "getInteractionState"))?.candidate?.kind).toBe("farm-till");
  await expect.poll(async () => (await bridge(page, "getFarmingState")).highlightMode).toBe("hoe-valid");
  const rightFacingTarget = (await bridge(page, "getFarmingState")).targetCell;
  expect(rightFacingTarget).toEqual(FARM_CELL);
  await bridge(page, "placePlayerAt", {
    x: FARM_CELL.x + 1,
    y: FARM_CELL.y + 12,
    facing: { x: 1, y: 0 },
  });
  expect((await bridge(page, "getFarmingState")).targetCell).toEqual(rightFacingTarget);
  await bridge(page, "placePlayerAt", {
    x: FARM_CELL.x + 4,
    y: FARM_CELL.y + 12,
    facing: { x: 1, y: 0 },
  });
  expect((await bridge(page, "getFarmingState")).targetCell).toEqual({
    x: FARM_CELL.x + 16,
    y: FARM_CELL.y,
  });
  await faceFarmCell(page);
  await page.keyboard.down("KeyA");
  await expect.poll(async () => (await bridge(page, "getFarmingState")).hoeAimDirection).toEqual({ x: -1, y: 0 });
  const leftFacingTarget = (await bridge(page, "getFarmingState")).targetCell;
  expect(leftFacingTarget).toEqual({ x: FARM_CELL.x - 32, y: FARM_CELL.y });
  await page.keyboard.up("KeyA");
  await page.keyboard.down("KeyW");
  await expect.poll(async () => (await bridge(page, "getFarmingState")).hoeAimDirection).toEqual({ x: 0, y: -1 });
  await page.keyboard.up("KeyW");
  await page.waitForTimeout(120);
  expect((await bridge(page, "getFarmingState")).hoeAimDirection).toEqual({ x: 0, y: -1 });
  await page.keyboard.down("KeyS");
  await expect.poll(async () => (await bridge(page, "getFarmingState")).hoeAimDirection).toEqual({ x: 0, y: 1 });
  await page.keyboard.up("KeyS");
  await page.keyboard.down("KeyW");
  await expect.poll(async () => (await bridge(page, "getFarmingState")).hoeAimDirection).toEqual({ x: 0, y: -1 });
  await page.keyboard.down("KeyA");
  await expect.poll(async () => (await bridge(page, "getFarmingState")).hoeAimDirection).toEqual({ x: 0, y: -1 });
  const diagonalTarget = (await bridge(page, "getFarmingState")).targetCell;
  await page.waitForTimeout(120);
  expect((await bridge(page, "getFarmingState")).hoeAimDirection).toEqual({ x: 0, y: -1 });
  await page.keyboard.up("KeyW");
  await expect.poll(async () => (await bridge(page, "getFarmingState")).hoeAimDirection).toEqual({ x: -1, y: 0 });
  await page.keyboard.up("KeyA");
  expect(rightFacingTarget).not.toEqual(diagonalTarget);
  await faceFarmCell(page);
  await expect.poll(async () => (await bridge(page, "getInteractionState"))?.candidate?.kind).toBe("farm-till");
  const prompt = await bridge(page, "getInteractionHudState");
  expect(prompt.promptRect).toMatchObject({ height: 18 });
  expect(prompt.promptRect.y + prompt.promptRect.height).toBeLessThan(156);
  await pressInteract(page);
  await expect.poll(async () => (await bridge(page, "getFarmingState")).farm.soilCells).toHaveLength(1);

  const seedSlot = (await bridge(page, "getSession")).gameplay.inventory.slots
    .findIndex((item) => item?.id === "potato-seed");
  await bridge(page, "selectInventorySlot", seedSlot);
  await faceFarmCell(page);
  await expect.poll(async () => (await bridge(page, "getInteractionState"))?.candidate?.kind).toBe("farm-plant");
  await expect.poll(async () => (await bridge(page, "getFarmingState")).highlightMode).toBe("potato-seed-valid");
  await pressInteract(page);
  await expect.poll(async () => (await bridge(page, "getFarmingState")).farm.soilCells[0].crop?.type).toBe("potato");

  await bridge(page, "selectInventorySlot", 3);
  await bridge(page, "placePlayerAt", { x: 430, y: 504, facing: { x: 1, y: 0 } });
  await expect.poll(async () => (await bridge(page, "getInteractionState"))?.candidate?.kind).toBe("farm-refill-water-bucket");
  await pressInteract(page);
  await expect.poll(async () => (await bridge(page, "getFarmingState")).farm.waterBucket.currentWater).toBe(8);
  await expect.poll(async () => (await bridge(page, "getAudioEffectState")).lastEffectType).toBe("well-refill");

  await faceFarmCell(page);
  await expect.poll(async () => (await bridge(page, "getInteractionState"))?.candidate?.kind).toBe("farm-water");
  await expect.poll(async () => (await bridge(page, "getFarmingState")).highlightMode).toBe("water-bucket-valid");
  await pressInteract(page);
  await expect.poll(async () => (await bridge(page, "getFarmingState")).farm.waterBucket.currentWater).toBe(7);
  await expect.poll(async () => (await bridge(page, "getAudioEffectState")).lastEffectType).toBe("water");

  const start = (await bridge(page, "getSession")).gameplay.worldTimeSeconds;
  await bridge(page, "setFarmingWeather", [{
    id: "rain",
    precipitation: true,
    start,
    end: start + 86400,
  }]);
  await bridge(page, "setFarmingRandomValue", 0.999999);
  await faceFarmCell(page);
  await bridge(page, "advanceGameplayTime", 1_440_000);
  await expect.poll(async () => (await bridge(page, "getFarmingState")).farm.soilCells[0].crop?.mature).toBe(true);
  await bridge(page, "setEnergy", 100);
  await bridge(page, "wakeUp");
  await faceFarmCell(page);
  await expect.poll(async () => (await bridge(page, "getInteractionState"))?.candidate?.kind).toBe("farm-harvest");
  await page.waitForTimeout(100);
  await pressInteract(page);
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.worldItems.filter((item) => item.item.id === "potato")).toHaveLength(6);
  await expect.poll(async () => (await bridge(page, "getAudioEffectState")).lastEffectType).toBe("harvest");
  const drops = (await bridge(page, "getSession")).gameplay.worldItems.filter((item) => item.item.id === "potato");
  expect(drops.every((drop) => drop.item.id === "potato" && drop.item.quantity === 1)).toBe(true);
  await page.waitForTimeout(450);
  await page.locator("canvas").screenshot({ path: `${EVIDENCE_DIR}/potato-loop-integrated.png` });
  await testInfo.attach("potato-loop-integrated", {
    path: `${EVIDENCE_DIR}/potato-loop-integrated.png`,
    contentType: "image/png",
  });

  await page.reload();
  await boot(page);
  const restored = await bridge(page, "getSession");
  expect(restored.gameplay.farm.wells).toHaveLength(2);
  expect(restored.gameplay.farm.wells).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "farm-well-1", fixed: true }),
    expect.objectContaining({ fixed: false, x: WELL_CELL.x, y: WELL_CELL.y }),
  ]));
  expect(restored.gameplay.farm.soilCells).toHaveLength(1);
  expect(restored.gameplay.worldItems.filter((item) => item.item.id === "potato")).toHaveLength(6);
  expect(pageErrors).toEqual([]);
});

test("axe removes crop before soil and thrown wood or stone crushes crops", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop proves the collision path once");
  await boot(page);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await boot(page);

  const plant = async () => {
    if ((await bridge(page, "getFarmingState")).farm.soilCells.length === 0) {
      await bridge(page, "selectInventorySlot", 2);
      await faceFarmCell(page);
      await expect.poll(async () => (await bridge(page, "getInteractionState"))?.candidate?.kind).toBe("farm-till");
      await pressInteract(page);
    }
    const seedSlot = (await bridge(page, "getSession")).gameplay.inventory.slots
      .findIndex((item) => item?.id === "potato-seed");
    await bridge(page, "selectInventorySlot", seedSlot);
    await faceFarmCell(page);
    await expect.poll(async () => (await bridge(page, "getInteractionState"))?.candidate?.kind).toBe("farm-plant");
    await pressInteract(page);
    await expect.poll(async () => (await bridge(page, "getFarmingState")).farm.soilCells[0].crop?.type).toBe("potato");
  };

  await plant();
  await bridge(page, "selectInventorySlot", 0);
  await faceFarmCell(page);
  await expect.poll(async () => (await bridge(page, "getInteractionState"))?.candidate).toMatchObject({
    kind: "farm-axe-cell",
    prompt: "hud:interaction.destroyCrop",
  });
  await pressInteract(page);
  await expect.poll(async () => (await bridge(page, "getFarmingState")).farm.soilCells[0].crop).toBeNull();
  await expect.poll(async () => (await bridge(page, "getInteractionState"))?.candidate?.prompt).toBe("hud:interaction.destroySoil");
  await pressInteract(page);
  await expect.poll(async () => (await bridge(page, "getFarmingState")).farm.soilCells).toHaveLength(0);

  for (const itemId of ["wood", "stone"]) {
    await plant();
    expect(await bridge(page, "addInventoryItem", { itemId, quantity: 1 })).toMatchObject({ mutated: true });
    const slot = (await bridge(page, "getSession")).gameplay.inventory.slots.findIndex((item) => item?.id === itemId);
    await bridge(page, "placePlayerAt", {
      x: FARM_CELL.x - 8,
      y: FARM_CELL.y + 8,
      facing: { x: 1, y: 0 },
    });
    await page.waitForTimeout(80);
    await bridge(page, "selectInventorySlot", slot);
    expect(await bridge(page, "dropInventorySlot", slot)).toMatchObject({ status: "dropped", mutated: true });
    await expect.poll(async () => (await bridge(page, "getFarmingState")).farm.soilCells[0].crop).toBeNull();
    expect((await bridge(page, "getFarmingState")).farm.soilCells).toHaveLength(1);
    await page.waitForTimeout(450);
  }
});
