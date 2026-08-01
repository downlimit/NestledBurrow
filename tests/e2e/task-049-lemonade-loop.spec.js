import { expect, test } from "@playwright/test";

async function bridge(page, method, argument) {
  return page.evaluate(
    ({ method, argument }) => window.__NESTLED_BURROW_E2E__?.[method]?.(argument),
    { method, argument },
  );
}

async function bootFresh(page) {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto("./?movementDebug=1");
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  await bridge(page, "setLanguage", "en");
}

async function placeNear(page, entityId) {
  await expect.poll(async () => {
    await bridge(page, "placePlayerNear", entityId);
    return (await bridge(page, "getInteractionState"))?.candidate?.entityId;
  }).toBe(entityId);
}

async function interactWith(page, entityId) {
  await placeNear(page, entityId);
  return bridge(page, "interact");
}

async function canvasPoint(page, point) {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Game canvas is unavailable");
  return { x: box.x + point.x * box.width / 320, y: box.y + point.y * box.height / 180 };
}

async function dragLogical(page, from, to) {
  const start = await canvasPoint(page, from);
  const end = await canvasPoint(page, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}

function quantity(session, itemId) {
  return session.gameplay.inventory.slots
    .filter((item) => item?.id === itemId)
    .reduce((sum, item) => sum + item.quantity, 0);
}

function combatQuantity(session, itemId) {
  return session.gameplay.combatLoadout.slots
    .filter((item) => item?.id === itemId)
    .reduce((sum, item) => sum + item.quantity, 0);
}

test("fresh Task 049 world has four tools, fixed kitchen/well and three trees", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop captures the integrated baseline once");
  await bootFresh(page);
  const session = await bridge(page, "getSession");
  expect(session.version).toBe(12);
  expect(session.gameplay.inventory.slots.slice(0, 5).map((item) => item?.id)).toEqual([
    "axe", "pickaxe", "hoe", "water-bucket", "potato-seed",
  ]);
  expect(quantity(session, "potato")).toBe(0);
  expect(session.gameplay.farm.waterBucket).toEqual({ capacity: 8, currentWater: 0 });
  expect(session.gameplay.farm.wells).toHaveLength(1);
  expect(session.gameplay.farm.wells[0]).toMatchObject({ x: 544, y: 496, fixed: true });
  expect(session.gameplay.kitchen).toEqual({
    starterLemons: 6,
    stoveRepaired: false,
    servingTables: { "home-serving-table-01": { itemId: null, quantity: 0, reservations: [] } },
  });
  const debris = await bridge(page, "getDebrisState");
  expect(debris.definitions.filter(({ profileId }) => profileId === "tree-planted")).toHaveLength(0);
  await expect.poll(async () => (await bridge(page, "getDebrisState")).plantedTrees.length).toBe(3);
  expect((await bridge(page, "getDebrisState")).plantedTrees.every(({ profileId }) => profileId === "tree-planted")).toBe(true);
  const facilities = await bridge(page, "getFacilityState");
  expect(facilities.definitions.map(({ facilityType }) => facilityType)).toEqual(expect.arrayContaining([
    "gas-stove", "serving-table", "lemon-sack", "juicer",
  ]));
  expect(facilities.visuals["home-gas-stove-01"].textureKey).toBe("facility.gas-stove-broken");
});

test("well refills only the bucket and resource targeting follows the strict tool matrix", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop proves keyboard hotbar targeting once");
  await bootFresh(page);
  await bridge(page, "selectInventorySlot", 0);
  await bridge(page, "placePlayerNear", "yard-stone-02");
  expect((await bridge(page, "getInteractionState")).candidate?.entityId).not.toBe("yard-stone-02");
  await bridge(page, "selectInventorySlot", 1);
  await placeNear(page, "yard-stone-02");
  expect((await bridge(page, "getInteractionState")).candidate).toMatchObject({
    entityId: "yard-stone-02",
    prompt: "hud:interaction.mine",
  });

  await bridge(page, "selectInventorySlot", 3);
  await bridge(page, "placePlayerNear", "farm-well-1");
  await expect.poll(async () => (await bridge(page, "getInteractionState")).candidate?.kind)
    .toBe("farm-refill-water-bucket");
  await bridge(page, "interact");
  await expect.poll(async () => (await bridge(page, "getFarmingState")).farm.waterBucket.currentWater).toBe(8);
  await expect.poll(async () => (await bridge(page, "getAudioEffectState")).lastEffectType).toBe("well-refill");
});

test("merchant gain feedback aggregates and finite lemons become lemonade atomically", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop captures slot feedback and kitchen visuals once");
  await bootFresh(page);
  await bridge(page, "setCoins", 10);
  await bridge(page, "setLanguage", "ru");
  await interactWith(page, "seed-merchant");
  const merchant = await bridge(page, "getMerchantState");
  expect(merchant.labels).toMatchObject({
    title: "ТОРГОВЕЦ СЕМЕНАМИ",
    balance: "Монеты: 10",
    offers: ["КАРТОФЕЛЬ", "ЛИМОН"],
    buys: ["КУПИТЬ · 1", "КУПИТЬ · 2"],
  });
  expect(JSON.stringify(merchant.labels)).not.toContain("merchant.");
  for (const rect of [
    merchant.labelRects.title,
    merchant.labelRects.balance,
    ...merchant.labelRects.offers,
    ...merchant.labelRects.buys,
    merchant.labelRects.exit,
  ]) {
    expect(rect.x).toBeGreaterThanOrEqual(merchant.panel.x);
    expect(rect.x + rect.width).toBeLessThanOrEqual(merchant.panel.x + merchant.panel.width);
  }
  await bridge(page, "interact");
  await expect.poll(async () => (await bridge(page, "getMerchantState")).active).toBe(false);

  expect(await bridge(page, "purchaseSeed", "lemon-seed")).toMatchObject({ status: "purchased" });
  await expect.poll(async () => (await bridge(page, "getInventoryGainState")).icons[0]?.itemId).toBe("lemon-seed");
  const heldIcon = (await bridge(page, "getInventoryGainState")).icons[0];
  expect(heldIcon.scale).toBe(1.5);
  expect(heldIcon.outlineAlpha).toBe(1);
  expect((await bridge(page, "getInventoryGainState")).holdMs).toBe(700);
  const inventoryWhileHeld = (await bridge(page, "getHudState")).resources.inventory;
  expect(inventoryWhileHeld.hiddenSlots).toContain(5);
  await expect.poll(async () => {
    const icon = (await bridge(page, "getInventoryGainState")).icons[0];
    return Boolean(icon && icon.y > heldIcon.y && icon.scale < 1.5 && icon.outlineAlpha < 1);
  }, { intervals: [20], timeout: 1200 }).toBe(true);
  await expect.poll(async () => (await bridge(page, "getHudState")).resources.inventory.hiddenSlots).not.toContain(5);

  expect(await bridge(page, "purchaseSeed", "potato-seed")).toMatchObject({ status: "purchased" });
  expect(await bridge(page, "purchaseSeed", "potato-seed")).toMatchObject({ status: "purchased" });
  await expect.poll(async () => (await bridge(page, "getInventoryGainState")).labels[0]?.text).toBe("+2");
  const gainStartY = (await bridge(page, "getInventoryGainState")).labels[0].y;
  await expect.poll(async () => (await bridge(page, "getInventoryGainState")).labels[0]?.y ?? gainStartY)
    .toBeGreaterThan(gainStartY);

  await interactWith(page, "home-lemon-sack-01");
  await expect.poll(async () => quantity(await bridge(page, "getSession"), "lemon")).toBe(6);
  await expect.poll(async () => (
    await bridge(page, "getInventoryGainState")
  ).icons.some(({ itemId }) => itemId === "lemon")).toBe(true);
  const sackInventory = (await bridge(page, "getHudState")).resources.inventory;
  const lemonSlotIndex = sackInventory.slots.findIndex((item) => item?.id === "lemon");
  expect(sackInventory.hiddenSlots).toContain(lemonSlotIndex);
  expect(sackInventory.quantityLabels).toContainEqual(expect.objectContaining({
    slotIndex: lemonSlotIndex,
    text: "6",
    depth: 10022,
  }));
  expect((await bridge(page, "getSession")).gameplay.kitchen.starterLemons).toBe(0);
  expect((await bridge(page, "getFacilityState")).visuals["home-lemon-sack-01"]).toBeNull();
  await bridge(page, "placePlayerNear", "home-lemon-sack-01");
  expect((await bridge(page, "getInteractionState")).candidate?.entityId).not.toBe("home-lemon-sack-01");

  await bridge(page, "setFarmWater", 1);
  await interactWith(page, "home-juicer-01");
  await expect.poll(async () => quantity(await bridge(page, "getSession"), "lemonade")).toBe(1);
  const crafted = await bridge(page, "getSession");
  expect(quantity(crafted, "lemon")).toBe(5);
  expect(crafted.gameplay.farm.waterBucket.currentWater).toBe(0);
  await page.waitForTimeout(120);
  const evidencePath = testInfo.outputPath("lemonade-kitchen.png");
  await page.locator("canvas").screenshot({ path: evidencePath });
  await testInfo.attach("lemonade-kitchen", { path: evidencePath, contentType: "image/png" });
});

test("stove repair spends the exact atomic cost and survives reload", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop proves the persistent kitchen repair once");
  await bootFresh(page);
  await interactWith(page, "home-gas-stove-01");
  await expect.poll(async () => (await bridge(page, "getTransientMessageState")).visible).toBe(true);
  const repairMessage = await bridge(page, "getTransientMessageState");
  expect(repairMessage.rect).toMatchObject({ y: 115, height: 18 });
  const promptRect = (await bridge(page, "getInteractionHudState")).promptRect;
  expect(repairMessage.rect.y + repairMessage.rect.height).toBeLessThan(promptRect.y);

  await bridge(page, "addCombatInventoryItem", { itemId: "wood", quantity: 10 });
  await bridge(page, "addCombatInventoryItem", { itemId: "stone", quantity: 8 });
  await bridge(page, "setCoins", 10);
  await interactWith(page, "home-gas-stove-01");
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.kitchen.stoveRepaired).toBe(true);
  const repaired = await bridge(page, "getSession");
  expect(quantity(repaired, "wood")).toBe(0);
  expect(quantity(repaired, "stone")).toBe(0);
  expect(combatQuantity(repaired, "wood")).toBe(0);
  expect(combatQuantity(repaired, "stone")).toBe(0);
  expect(repaired.gameplay.coins).toBe(0);
  expect((await bridge(page, "getFacilityState")).visuals["home-gas-stove-01"].textureKey).toBe("facility.gas-stove");
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  expect((await bridge(page, "getSession")).gameplay.kitchen.stoveRepaired).toBe(true);
});

test("lemonade guests take out and pay two coins", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop proves the takeout route once");
  await bootFresh(page);
  await bridge(page, "setServingStock", { itemId: "lemonade", quantity: 1 });
  await interactWith(page, "tavern-open-sign");
  expect((await bridge(page, "getTavernState")).open).toBe(true);
  expect(await bridge(page, "forceGuestSpawn")).toBe("tavern-guest-1");
  await expect.poll(async () => (await bridge(page, "getTavernState")).guest.guests[0]?.itemId, { timeout: 25_000 })
    .toBe("lemonade");
  await expect.poll(async () => {
    const guest = (await bridge(page, "getTavernState")).guest.guests[0];
    const coins = await bridge(page, "getCoinState");
    return guest?.state === "leaving" && coins.length === 1;
  }, { timeout: 25_000 }).toBe(true);
  await expect.poll(async () => (await bridge(page, "getCoinState"))[0]?.landed, { timeout: 30_000 }).toBe(true);
  expect((await bridge(page, "getTavernState")).guest.guests.some(({ state }) => state === "eating")).toBe(false);
  const coinsBefore = (await bridge(page, "getSession")).gameplay.coins;
  const [coin] = await bridge(page, "getCoinState");
  expect(coin.value).toBe(2);
  await bridge(page, "placePlayerAt", { x: coin.x, y: coin.y });
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.coins).toBe(coinsBefore + 2);
  await expect.poll(async () => (await bridge(page, "getHudState")).resources.coinDelta.text).toBe("+2");
});

test("wallet drag drops and recollects exactly one coin", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop proves wallet pointer drag once");
  await bootFresh(page);
  await bridge(page, "setCoins", 3);
  const coinArea = (await bridge(page, "getHudState")).areas.coins;
  await dragLogical(page, {
    x: coinArea.x + coinArea.width / 2,
    y: coinArea.y + coinArea.height / 2,
  }, { x: 210, y: 105 });
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.coins).toBe(2);
  await expect.poll(async () => (await bridge(page, "getHudState")).resources.coinDelta.text).toBe("-1");
  const coinDelta = (await bridge(page, "getHudState")).resources.coinDelta;
  expect(coinDelta).toMatchObject({ visible: true, alpha: 1 });
  await page.waitForTimeout(500);
  expect((await bridge(page, "getHudState")).resources.coinDelta).toMatchObject({
    visible: true,
    x: coinDelta.x,
    alpha: 1,
  });
  await expect.poll(async () => (await bridge(page, "getCoinState")).length).toBe(1);
  const [coin] = await bridge(page, "getCoinState");
  expect(coin.value).toBe(1);
  await expect.poll(async () => (await bridge(page, "getCoinState"))[0]?.landed).toBe(true);
  const [landedCoin] = await bridge(page, "getCoinState");
  await bridge(page, "placePlayerAt", { x: landedCoin.x, y: landedCoin.y });
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.coins).toBe(3);
  await expect.poll(async () => (await bridge(page, "getHudState")).resources.coinDelta.text).toBe("+1");
});

test("fried potato guests dine in and pay four coins", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop proves the dine-in route once");
  await bootFresh(page);
  await bridge(page, "setServingStock", { itemId: "fried-potato-dish", quantity: 1 });
  await interactWith(page, "tavern-open-sign");
  expect(await bridge(page, "forceGuestSpawn")).toBe("tavern-guest-1");
  await expect.poll(async () => (await bridge(page, "getTavernState")).guest.guests[0]?.state, { timeout: 30_000 })
    .toBe("eating");
  await expect.poll(async () => (await bridge(page, "getCoinState"))[0]?.landed, { timeout: 15_000 }).toBe(true);
  const [coin] = await bridge(page, "getCoinState");
  expect(coin.value).toBe(4);
});
