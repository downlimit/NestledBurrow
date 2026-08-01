import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const EVIDENCE_DIR = "artifacts/task-025";

async function bridge(page, method, argument) {
  return page.evaluate(({ method, argument }) => window.__NESTLED_BURROW_E2E__?.[method]?.(argument), { method, argument });
}

async function boot(page) {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto("./?movementDebug=1");
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  await bridge(page, "selectInventorySlot", 0);
}

async function placeNear(page, id) {
  const resource = (await bridge(page, "getDebrisState")).definitions.find((item) => item.id === id);
  if (resource) {
    const slotIndex = ["stone-small", "stone-large", "ruby-node"].includes(resource.profileId) ? 1 : 0;
    await bridge(page, "selectInventorySlot", slotIndex);
  }
  await expect.poll(async () => {
    await bridge(page, "placePlayerNear", id);
    return (await bridge(page, "getInteractionState"))?.candidate?.entityId;
  }).toBe(id);
}

async function interact(page, id, expire = true) {
  if (expire) await bridge(page, "expireHitCooldown");
  await placeNear(page, id);
  await bridge(page, "interact");
}

function inventoryQuantity(gameplay, itemId) {
  return (gameplay?.inventory?.slots ?? [])
    .filter((item) => item?.id === itemId)
    .reduce((total, item) => total + item.quantity, 0);
}

test("balance panel is compact, scrollable and applies live resource tuning", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop captures the focused balance panel evidence once");
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await boot(page);
  const toggle = page.locator(".balance-debug-toggle");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveText("ОТЛ");
  expect(await toggle.evaluate((element) => ({ width: element.offsetWidth, height: element.offsetHeight }))).toEqual({ width: 36, height: 24 });
  await expect(page.locator(".movement-debug-panel")).toBeHidden();
  await toggle.click({ force: true });
  const panel = page.locator(".movement-debug-panel");
  await expect(panel).toBeVisible();
  expect(await panel.evaluate((element) => element.scrollHeight >= element.clientHeight && getComputedStyle(element).overflowY === "auto")).toBe(true);
  await page.locator('input[data-field="axeDamage"]').fill("7");
  await page.locator('input[data-field="axeDamage"]').dispatchEvent("input");
  await interact(page, "fallen-log-01");
  await expect.poll(async () => (await bridge(page, "getResourceNodeState", "fallen-log-01")).cleared).toBe(true);
  await expect.poll(async () => (await bridge(page, "getAudioEffectState")).lastEffectType).toBe("wood-break");
  await expect.poll(async () => inventoryQuantity((await bridge(page, "getSession")).gameplay, "wood")).toBe(1);
  await page.screenshot({ path: `${EVIDENCE_DIR}/balance-panel.png`, fullPage: false });
  await testInfo.attach("balance-panel", { path: `${EVIDENCE_DIR}/balance-panel.png`, contentType: "image/png" });
  await toggle.click({ force: true });
  await expect(panel).toBeHidden();
});

test("resource classes, rewards, cooldown, sleep scale and build ID share the runtime contract", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop runs the focused resource route once");
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await boot(page);
  const definitions = (await bridge(page, "getDebrisState")).definitions;
  expect(new Set(definitions.map((item) => item.profileId))).toEqual(new Set(["log-small", "log-large", "stone-small", "stone-large", "ruby-node"]));
  expect(definitions.filter((item) => item.profileId === "log-small").length).toBeGreaterThanOrEqual(8);
  await page.locator(".balance-debug-toggle").click({ force: true });
  await page.locator('input[data-field="axeDamage"]').fill("99");
  await page.locator('input[data-field="axeDamage"]').dispatchEvent("input");
  await page.locator(".balance-debug-toggle").click({ force: true });

  await interact(page, "yard-log-04");
  await interact(page, "yard-stone-01");
  await interact(page, "yard-stone-02");
  await expect.poll(async () => {
    const gameplay = (await bridge(page, "getSession")).gameplay;
    return { wood: inventoryQuantity(gameplay, "wood"), stone: inventoryQuantity(gameplay, "stone") };
  }).toEqual({ wood: 3, stone: 4 });

  await bridge(page, "expireHitCooldown");
  await placeNear(page, "yard-ruby-01");
  const before = await bridge(page, "getSession");
  await bridge(page, "interact");
  const afterFirst = await bridge(page, "getSession");
  await bridge(page, "interact");
  const afterSecond = await bridge(page, "getSession");
  expect(afterFirst.gameplay.currentEnergy).toBeLessThanOrEqual(before.gameplay.currentEnergy - 0.5);
  expect(afterFirst.gameplay.currentEnergy).toBeGreaterThan(before.gameplay.currentEnergy - 1);
  expect(afterSecond.gameplay.currentEnergy).toBeLessThanOrEqual(afterFirst.gameplay.currentEnergy);
  expect(afterSecond.gameplay.resourceNodes["yard-ruby-01"].progress).toBe(afterFirst.gameplay.resourceNodes["yard-ruby-01"].progress);

  await bridge(page, "setEnergy", 20);
  await placeNear(page, "home-bed-01");
  await bridge(page, "interact");
  await expect.poll(() => bridge(page, "getRuntimeState")).toMatchObject({ sleeping: true, timeScale: 32 });
  await expect.poll(() => bridge(page, "getInteractionState")).toMatchObject({ candidate: { prompt: "hud:interaction.wake" } });
  await expect.poll(() => bridge(page, "getPlayerVisualState")).toMatchObject({ x: 576, y: 399, angle: -90, textureKey: "tile_0269" });
  await bridge(page, "wakeUp");

  const canvas = await page.locator("canvas").boundingBox();
  if (!canvas) throw new Error("Game canvas is unavailable");
  await page.mouse.click(canvas.x + 45 * canvas.width / 320, canvas.y + 19 * canvas.height / 180);
  const hud = await bridge(page, "getHudState");
  expect(hud.buildLabelVisible).toBe(true);
  expect(hud.buildLabel).toMatch(/^v (?:[0-9a-f]{7}|local)$/u);
  await page.locator("canvas").screenshot({ path: `${EVIDENCE_DIR}/resource-overview.png` });
  await testInfo.attach("resource-overview", { path: `${EVIDENCE_DIR}/resource-overview.png`, contentType: "image/png" });
});

test("holding Space repeats resource work when each cooldown ends", async ({ page }) => {
  await boot(page);
  await placeNear(page, "yard-log-02");
  await page.keyboard.down("Space");
  await page.waitForTimeout(1150);
  await page.keyboard.up("Space");
  await expect.poll(async () => (await bridge(page, "getResourceNodeState", "yard-log-02")).progress).toBeGreaterThanOrEqual(2 / 7);
  await expect.poll(() => bridge(page, "getInteractionHudState")).toMatchObject({ cooldownProgress: 0 });
});

test("resource hit feedback returns to its placement-grid anchor", async ({ page }) => {
  await boot(page);
  const id = "yard-log-02";
  const definition = (await bridge(page, "getDebrisState")).definitions.find((item) => item.id === id);
  const expected = { x: definition.cell.x * 8, y: definition.cell.y * 8 };
  await interact(page, id);
  await expect.poll(async () => (await bridge(page, "getAudioEffectState")).lastEffectType).toBe("wood-hit");
  await page.waitForTimeout(160);
  expect(await bridge(page, "getResourceVisualState", id)).toMatchObject(expected);
  await interact(page, id);
  await page.waitForTimeout(160);
  expect(await bridge(page, "getResourceVisualState", id)).toMatchObject(expected);
});

test("running, exhaustion sleep and wake-up share the energy-flow contract", async ({ page }) => {
  await boot(page);
  await bridge(page, "setEnergy", 14);
  await expect.poll(() => bridge(page, "getHudState")).toMatchObject({ resources: { energyFlow: { direction: "up", arrows: 1 } } });
  await bridge(page, "setEnergy", 15);
  await expect.poll(() => bridge(page, "getHudState")).toMatchObject({ resources: { energyFlow: { direction: "down", arrows: 1 } } });

  await page.keyboard.down("ArrowRight");
  await expect.poll(() => bridge(page, "getHudState")).toMatchObject({ resources: { energyFlow: { direction: "down", arrows: 2 } } });
  await page.keyboard.down("Shift");
  await expect.poll(() => bridge(page, "getPlayerMovementState")).toMatchObject({ runSpeedMultiplier: 1.66 });
  await expect.poll(async () => (await bridge(page, "getAudioEffectState")).lastEffectType).toBe("sprint-on");
  await expect.poll(() => bridge(page, "getHudState")).toMatchObject({ resources: { energyFlow: { direction: "down", arrows: 3 } } });
  await page.keyboard.up("Shift");
  await expect.poll(async () => (await bridge(page, "getAudioEffectState")).lastEffectType).toBe("sprint-off");
  await page.keyboard.up("ArrowRight");

  await bridge(page, "setEnergy", 0);
  await expect.poll(() => bridge(page, "getRuntimeState")).toMatchObject({ sleeping: true, exhaustedSleeping: true, timeScale: 16 });
  await expect.poll(() => bridge(page, "getInteractionState")).toMatchObject({ candidate: { kind: "wake-exhausted", prompt: "hud:interaction.wake" } });
  await expect.poll(() => bridge(page, "getPlayerVisualState")).toMatchObject({ angle: -90, textureKey: "tile_0268" });
  await bridge(page, "tryWakeFromExhaustion");
  await expect.poll(() => bridge(page, "getRuntimeState")).toMatchObject({ sleeping: false, exhaustedSleeping: false, timeScale: 1 });
});

test("awake energy drains continuously per real second and low-energy idle recovers", async ({ page }) => {
  const maxFrameEnergyDrift = 0.2;
  await boot(page);
  await bridge(page, "setEnergy", 100);
  await bridge(page, "setPlayerMotion", { moving: false });
  let before = (await bridge(page, "getResourceState")).currentEnergy;
  await bridge(page, "advanceGameplayTime", 1000);
  let after = (await bridge(page, "getResourceState")).currentEnergy;
  expect(before - after).toBeGreaterThanOrEqual(0.25);
  expect(before - after).toBeLessThan(0.25 + maxFrameEnergyDrift);
  await bridge(page, "setPlayerMotion", { moving: true, running: false });
  before = (await bridge(page, "getResourceState")).currentEnergy;
  await bridge(page, "advanceGameplayTime", 1000);
  after = (await bridge(page, "getResourceState")).currentEnergy;
  expect(before - after).toBeGreaterThanOrEqual(0.75);
  expect(before - after).toBeLessThan(0.75 + maxFrameEnergyDrift);
  await bridge(page, "setPlayerMotion", { moving: true, running: true });
  before = (await bridge(page, "getResourceState")).currentEnergy;
  await bridge(page, "advanceGameplayTime", 1000);
  after = (await bridge(page, "getResourceState")).currentEnergy;
  expect(before - after).toBeGreaterThanOrEqual(1.5);
  expect(before - after).toBeLessThan(1.5 + maxFrameEnergyDrift);
  await bridge(page, "setEnergy", 4);
  await bridge(page, "setPlayerMotion", { moving: false });
  before = (await bridge(page, "getResourceState")).currentEnergy;
  await bridge(page, "advanceGameplayTime", 1000);
  after = (await bridge(page, "getResourceState")).currentEnergy;
  expect(after - before).toBeGreaterThanOrEqual(1.5 / 1.66);
  expect(after - before).toBeLessThan(1.5 / 1.66 + maxFrameEnergyDrift);
});

test("resource colliders have their requested insets and work from directly above", async ({ page }) => {
  await boot(page);
  const log = await bridge(page, "getResourceCollider", "fallen-log-01");
  const largeLog = await bridge(page, "getResourceCollider", "yard-log-04");
  const stone = await bridge(page, "getResourceCollider", "yard-stone-02");
  const largeStone = await bridge(page, "getResourceCollider", "yard-stone-01");
  expect(log.bottom - log.top).toBe(13);
  expect(stone.bottom - stone.top).toBe(13);
  expect(stone.right - stone.left).toBe(13);
  expect(stone.left).toBe(95 * 8 + 1);
  expect(largeLog.bottom - largeLog.top).toBe(19.5);
  expect(largeStone.bottom - largeStone.top).toBe(19.5);
  const stoneDefinition = (await bridge(page, "getDebrisState")).definitions.find((item) => item.id === "yard-stone-02");
  await bridge(page, "selectInventorySlot", 1);
  await bridge(page, "placePlayerAt", { x: stoneDefinition.position.x, y: stoneDefinition.position.y - 20, facing: { x: 0, y: -1 } });
  await expect.poll(() => bridge(page, "getInteractionState")).toMatchObject({ candidate: { entityId: "yard-stone-02" } });
});

test("logs and stones always show a work target from every approach angle", async ({ page }) => {
  await boot(page);
  const definitions = (await bridge(page, "getDebrisState")).definitions;
  for (const id of ["fallen-log-01", "yard-log-04", "yard-stone-02", "yard-stone-01"]) {
    const resource = definitions.find((item) => item.id === id);
    const slotIndex = ["stone-small", "stone-large", "ruby-node"].includes(resource.profileId) ? 1 : 0;
    await bridge(page, "selectInventorySlot", slotIndex);
    for (const [x, y] of [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]) {
      const length = Math.hypot(x, y);
      const reach = resource.radius - 1;
      await bridge(page, "placePlayerAt", {
        x: resource.position.x + x / length * reach,
        y: resource.position.y + y / length * reach,
        facing: { x: -x, y: -y },
      });
      await expect.poll(() => bridge(page, "getInteractionState")).toMatchObject({ candidate: { kind: "work-resource" } });
    }
  }
});
