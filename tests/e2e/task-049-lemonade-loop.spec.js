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

async function bootFresh(page) {
  await boot(page);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await boot(page);
}

async function bridgeState(page, method) {
  return bridge(page, method);
}

async function canvasPoint(page, point) {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Game canvas is unavailable");
  return {
    x: box.x + point.x * box.width / 320,
    y: box.y + point.y * box.height / 180,
  };
}

async function clickLogical(page, point) {
  const target = await canvasPoint(page, point);
  await page.mouse.click(target.x, target.y);
}

async function dragLogical(page, start, end) {
  const source = await canvasPoint(page, start);
  const target = await canvasPoint(page, end);
  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 6 });
  await page.mouse.up();
}

async function pressInteract(page) {
  await page.keyboard.down("Space");
  await page.waitForTimeout(50);
  await page.keyboard.up("Space");
}

async function placeNear(page, entityId) {
  await expect.poll(async () => {
    await bridge(page, "placePlayerNear", entityId);
    return (await bridgeState(page, "getInteractionState"))?.candidate?.entityId;
  }).toBe(entityId);
}

function inventoryQuantity(gameplay, itemId) {
  return gameplay.inventory.slots
    .filter((item) => item?.id === itemId)
    .reduce((sum, item) => sum + item.quantity, 0);
}

async function addAndServeLemonade(page) {
  await bridge(page, "addInventoryItem", { itemId: "lemon", quantity: 1 });
  await bridge(page, "setFarmWater", 1);
  await placeNear(page, "kitchen-juicer");
  await pressInteract(page);
  await expect.poll(async () => inventoryQuantity((await bridgeState(page, "getSession")).gameplay, "lemonade")).toBe(1);
  await placeNear(page, "kitchen-serving-table");
  await pressInteract(page);
  await expect.poll(async () => (await bridgeState(page, "getSession")).gameplay.kitchen.servingTables["kitchen-serving-table"]?.itemId).toBe("lemonade");
}

test("fresh Task 049 world has four tools, fixed kitchen/well and two trees", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop validates Task 049 fixtures once");
  await bootFresh(page);
  const session = await bridgeState(page, "getSession");
  expect(session.gameplay.inventory.slots.slice(0, 4).map((item) => item.id)).toEqual(["axe", "pickaxe", "hoe", "water-bucket"]);
  expect(session.gameplay.farm.wells).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "farm-well-1", fixed: true }),
  ]));
  expect(session.gameplay.farm.lemonSack).toMatchObject({ capacity: 10, remaining: 10 });
  expect((await bridgeState(page, "getDebrisState")).definitions.filter((definition) => definition.profileId === "tree-planted")).toHaveLength(2);
  expect((await bridgeState(page, "getFacilityState")).definitions.map((definition) => definition.facilityType)).toEqual(expect.arrayContaining([
    "cutting-table",
    "gas-stove",
    "serving-table",
    "juicer",
    "lemon-sack",
  ]));
});

test("well refills only the bucket and resource targeting follows the strict tool matrix", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop validates strict tool routing once");
  await bootFresh(page);
  await bridge(page, "setFarmWater", 0);
  await bridge(page, "selectInventorySlot", 0);
  await placeNear(page, "farm-well-1");
  expect((await bridgeState(page, "getInteractionState")).candidate).toBeNull();
  await bridge(page, "selectInventorySlot", 3);
  await placeNear(page, "farm-well-1");
  await pressInteract(page);
  await expect.poll(async () => (await bridgeState(page, "getSession")).gameplay.farm.waterBucket.currentWater).toBe(8);
  expect((await bridgeState(page, "getSession")).gameplay.needs.lustre).toBe(50);

  const logId = (await bridgeState(page, "getDebrisState")).definitions.find((definition) => definition.profileId === "log-small").id;
  await bridge(page, "selectInventorySlot", 1);
  await placeNear(page, logId);
  expect((await bridgeState(page, "getInteractionState")).candidate).toBeNull();
  await bridge(page, "selectInventorySlot", 0);
  await placeNear(page, logId);
  await expect.poll(async () => (await bridgeState(page, "getInteractionState")).candidate?.entityId).toBe(logId);
});

test("merchant gain feedback aggregates and finite lemons become lemonade atomically", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop validates Task 049 inventory feedback once");
  await bootFresh(page);
  await bridge(page, "setCoins", 5);
  await placeNear(page, "seed-merchant");
  await pressInteract(page);
  const merchant = await bridgeState(page, "getMerchantState");
  await clickLogical(page, { x: merchant.buyButton.x + merchant.buyButton.width / 2, y: merchant.buyButton.y + merchant.buyButton.height / 2 });
  await expect.poll(async () => (await bridgeState(page, "getHudState")).resources.inventoryGain.pendingCount).toBeGreaterThan(0);
  await clickLogical(page, { x: merchant.buyButton.x + merchant.buyButton.width / 2, y: merchant.buyButton.y + merchant.buyButton.height / 2 });
  await expect.poll(async () => (await bridgeState(page, "getHudState")).resources.inventoryGain.totalQuantity).toBe(2);
  await pressInteract(page);

  await bridge(page, "selectInventorySlot", 9);
  await placeNear(page, "kitchen-lemon-sack");
  const before = await bridgeState(page, "getSession");
  await pressInteract(page);
  await expect.poll(async () => inventoryQuantity((await bridgeState(page, "getSession")).gameplay, "lemon")).toBe(1);
  expect((await bridgeState(page, "getSession")).gameplay.farm.lemonSack.remaining).toBe(before.gameplay.farm.lemonSack.remaining - 1);

  await bridge(page, "setFarmWater", 1);
  await placeNear(page, "kitchen-juicer");
  await pressInteract(page);
  await expect.poll(async () => inventoryQuantity((await bridgeState(page, "getSession")).gameplay, "lemonade")).toBe(1);
  const afterJuice = await bridgeState(page, "getSession");
  expect(inventoryQuantity(afterJuice.gameplay, "lemon")).toBe(0);
  expect(afterJuice.gameplay.farm.waterBucket.currentWater).toBe(0);
});

test("stove repair spends the exact atomic cost and survives reload", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop validates stove repair once");
  await bootFresh(page);
  await bridge(page, "setCoins", 10);
  await bridge(page, "addInventoryItem", { itemId: "wood", quantity: 10 });
  await bridge(page, "addInventoryItem", { itemId: "stone", quantity: 8 });
  await placeNear(page, "kitchen-gas-stove");
  await pressInteract(page);
  await expect.poll(async () => (await bridgeState(page, "getSession")).gameplay.kitchen.stoveRepaired).toBe(true);
  const repaired = await bridgeState(page, "getSession");
  expect(repaired.gameplay.coins).toBe(0);
  expect(inventoryQuantity(repaired.gameplay, "wood")).toBe(0);
  expect(inventoryQuantity(repaired.gameplay, "stone")).toBe(0);
  await page.reload();
  await boot(page);
  expect((await bridgeState(page, "getSession")).gameplay.kitchen.stoveRepaired).toBe(true);
});

test("lemonade guests take out and pay two coins", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop validates lemonade guest route once");
  await bootFresh(page);
  await addAndServeLemonade(page);
  await placeNear(page, "tavern-sign");
  await pressInteract(page);
  expect(await bridge(page, "forceGuestSpawn")).toBe("tavern-guest-1");
  await expect.poll(async () => (await bridgeState(page, "getTavernState")).guest.guests[0]?.itemId, { timeout: 25_000 }).toBe("lemonade");
  await expect.poll(async () => {
    const guest = (await bridgeState(page, "getTavernState")).guest.guests[0];
    const coins = await bridgeState(page, "getCoinState");
    return guest?.state === "leaving" && coins.length === 1;
  }, { timeout: 25_000 }).toBe(true);
  await expect.poll(async () => (await bridgeState(page, "getCoinState"))[0]?.landed, { timeout: 30_000 }).toBe(true);
  expect((await bridgeState(page, "getTavernState")).guest.guests.some(({ state }) => state === "eating")).toBe(false);
  const coinsBefore = (await bridgeState(page, "getSession")).gameplay.coins;
  const [coin] = await bridgeState(page, "getCoinState");
  expect(coin.value).toBe(2);
  await bridge(page, "placePlayerAt", { x: coin.x, y: coin.y });
  await expect.poll(async () => (await bridgeState(page, "getSession")).gameplay.coins).toBe(coinsBefore + 2);
  await expect.poll(async () => (await bridgeState(page, "getHudState")).resources.coinDelta.text).toBe("+2");
});

test("wallet drag drops and recollects exactly one coin", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop proves wallet pointer drag once");
  await bootFresh(page);
  await bridge(page, "setCoins", 3);
  const coinArea = (await bridgeState(page, "getHudState")).areas.coins;
  await dragLogical(page, {
    x: coinArea.x + coinArea.width / 2,
    y: coinArea.y + coinArea.height / 2,
  }, { x: 210, y: 105 });
  await expect.poll(async () => (await bridgeState(page, "getSession")).gameplay.coins).toBe(2);
  await expect.poll(async () => (await bridgeState(page, "getHudState")).resources.coinDelta.text).toBe("-1");
  const coinDelta = (await bridgeState(page, "getHudState")).resources.coinDelta;
  expect(coinDelta).toMatchObject({ visible: true, alpha: 1 });
  await page.waitForTimeout(500);
  const progressedCoinDelta = (await bridgeState(page, "getHudState")).resources.coinDelta;
  expect(progressedCoinDelta).toMatchObject({
    visible: true,
    text: "-1",
    startedAtMs: coinDelta.startedAtMs,
  });
  expect(progressedCoinDelta.x).toBeGreaterThanOrEqual(coinDelta.x);
  expect(progressedCoinDelta.alpha).toBeLessThanOrEqual(coinDelta.alpha);
  await expect.poll(async () => (await bridgeState(page, "getCoinState")).length).toBe(1);
  const [coin] = await bridgeState(page, "getCoinState");
  expect(coin.value).toBe(1);
  await expect.poll(async () => (await bridgeState(page, "getCoinState"))[0]?.landed).toBe(true);
  const [landedCoin] = await bridgeState(page, "getCoinState");
  await bridge(page, "placePlayerAt", { x: landedCoin.x, y: landedCoin.y });
  await expect.poll(async () => (await bridgeState(page, "getSession")).gameplay.coins).toBe(3);
  await expect.poll(async () => (await bridgeState(page, "getHudState")).resources.coinDelta.text).toBe("+1");
});

test("fried potato guests dine in and pay four coins", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop validates dine-in potato route once");
  await bootFresh(page);
  await bridge(page, "setServingDish", true);
  await placeNear(page, "tavern-sign");
  await pressInteract(page);
  expect(await bridge(page, "forceGuestSpawn")).toBe("tavern-guest-1");
  await expect.poll(async () => {
    const guest = (await bridgeState(page, "getTavernState")).guest.guests[0];
    return guest?.state === "eating";
  }, { timeout: 25_000 }).toBe(true);
  await expect.poll(async () => {
    const guest = (await bridgeState(page, "getTavernState")).guest.guests[0];
    const coins = await bridgeState(page, "getCoinState");
    return guest?.state === "leaving" && coins.length === 1;
  }, { timeout: 25_000 }).toBe(true);
  const [coin] = await bridgeState(page, "getCoinState");
  expect(coin.value).toBe(4);
});
