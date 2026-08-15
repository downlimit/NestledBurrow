import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const EVIDENCE_DIR = "artifacts/task-046";
const SLOT_CENTERS = Array.from({ length: 10 }, (_, index) => ({ x: 210 + index * 24, y: 347 }));

async function bridge(page, method, argument) {
  return page.evaluate(({ method, argument }) => window.__NESTLED_BURROW_E2E__?.[method]?.(argument), { method, argument });
}

async function boot(page) {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  await expect(page.locator("canvas")).toHaveJSProperty("width", 1920);
  await expect(page.locator("canvas")).toHaveJSProperty("height", 1080);
}

async function canvasPoint(page, point) {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Game canvas is unavailable");
  return { x: box.x + point.x * box.width / 640, y: box.y + point.y * box.height / 360 };
}

async function dragLogical(page, from, to) {
  const start = await canvasPoint(page, from);
  const end = await canvasPoint(page, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}

function inventoryState(hud) {
  return hud.resources.inventory;
}

function droppedWorldItems(session) {
  return session.gameplay.worldItems.filter((item) => !item.id.startsWith("starter-melee-"));
}

test("ten-slot hotbar selects with digits and Q/E, swaps, drops and picks up tools", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop pointer and keyboard route captures game integration once");
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await boot(page);

  let inventory = inventoryState(await bridge(page, "getHudState"));
  expect(inventory.slots).toHaveLength(10);
  expect(inventory.slots.slice(0, 4).map((item) => item.id))
    .toEqual(["axe", "pickaxe", "hoe", "water-bucket"]);

  await page.keyboard.press("Digit1");
  await expect.poll(async () => inventoryState(await bridge(page, "getHudState")).selectedIndex).toBe(0);
  await expect.poll(async () => (await bridge(page, "getAudioEffectState")).lastEffectType).toBe("inventory-activate");
  await page.keyboard.press("Digit1");
  await expect.poll(async () => inventoryState(await bridge(page, "getHudState")).selectedIndex).toBeNull();
  await expect.poll(async () => (await bridge(page, "getAudioEffectState")).lastEffectType).toBe("inventory-deactivate");
  await page.keyboard.press("KeyE");
  await expect.poll(async () => inventoryState(await bridge(page, "getHudState")).selectedIndex).toBe(1);
  await page.keyboard.press("KeyE");
  await expect.poll(async () => inventoryState(await bridge(page, "getHudState")).selectedIndex).toBe(2);
  await expect.poll(async () => (await bridge(page, "getAudioEffectState")).lastEffectType).toBe("inventory-change");
  await page.keyboard.press("KeyQ");
  await expect.poll(async () => inventoryState(await bridge(page, "getHudState")).selectedIndex).toBe(1);
  await page.keyboard.press("Digit2");
  await expect.poll(async () => inventoryState(await bridge(page, "getHudState")).selectedIndex).toBeNull();
  await page.keyboard.press("KeyE");
  await expect.poll(async () => inventoryState(await bridge(page, "getHudState")).selectedIndex).toBe(2);
  await page.keyboard.press("Digit3");
  await expect.poll(async () => inventoryState(await bridge(page, "getHudState")).selectedIndex).toBeNull();

  await dragLogical(page, SLOT_CENTERS[0], SLOT_CENTERS[9]);
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.inventory.slots[9]?.id).toBe("axe");
  expect((await bridge(page, "getSession")).gameplay.inventory.slots[0]).toBeNull();
  await page.keyboard.press("Digit0");
  await expect.poll(async () => inventoryState(await bridge(page, "getHudState")).selectedIndex).toBe(9);
  await page.keyboard.press("Numpad0");
  await expect.poll(async () => inventoryState(await bridge(page, "getHudState")).selectedIndex).toBeNull();

  await dragLogical(page, SLOT_CENTERS[9], SLOT_CENTERS[3]);
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.inventory.slots[3]?.id).toBe("axe");
  await dragLogical(page, SLOT_CENTERS[3], { x: 160, y: 120 });
  await expect.poll(async () => droppedWorldItems(await bridge(page, "getSession"))).toHaveLength(1);
  await expect.poll(async () => (await bridge(page, "getAudioEffectState")).lastEffectType).toBe("drop");
  expect((await bridge(page, "getSession")).gameplay.inventory.slots[3]).toBeNull();
  await page.waitForTimeout(500);

  const dropped = droppedWorldItems(await bridge(page, "getSession"))[0];
  expect(dropped.item).toMatchObject({ id: "axe", kind: "tool", quantity: 1 });
  await page.locator("canvas").screenshot({ path: `${EVIDENCE_DIR}/inventory-dropped-in-game.png` });
  await testInfo.attach("inventory-dropped-in-game", { path: `${EVIDENCE_DIR}/inventory-dropped-in-game.png`, contentType: "image/png" });

  await bridge(page, "placePlayerAt", { x: dropped.x, y: dropped.y, facing: { x: 0, y: 1 } });
  await expect.poll(async () => droppedWorldItems(await bridge(page, "getSession"))).toHaveLength(0);
  await expect.poll(async () => (await bridge(page, "getAudioEffectState")).lastEffectType).toBe("pickup");
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.inventory.slots[0]?.id).toBe("axe");

  for (const toolId of ["pickaxe", "hoe", "water-bucket"]) {
    const session = await bridge(page, "getSession");
    const slotIndex = session.gameplay.inventory.slots.findIndex((item) => item?.id === toolId);
    await dragLogical(page, SLOT_CENTERS[slotIndex], { x: 160, y: 120 });
    await expect.poll(async () => droppedWorldItems(await bridge(page, "getSession"))).toHaveLength(1);
    await page.waitForTimeout(500);
    const toolDrop = droppedWorldItems(await bridge(page, "getSession"))[0];
    await bridge(page, "placePlayerAt", { x: toolDrop.x, y: toolDrop.y, facing: { x: 0, y: 1 } });
    await expect.poll(async () => droppedWorldItems(await bridge(page, "getSession"))).toHaveLength(0);
    await expect.poll(async () => (await bridge(page, "getSession")).gameplay.inventory.slots.some((item) => item?.id === toolId)).toBe(true);
  }
  expect(pageErrors).toEqual([]);
});
