import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const EVIDENCE_DIR = "artifacts/task-046";
const SLOT_CENTERS = Array.from({ length: 10 }, (_, index) => ({ x: 52 + index * 24, y: 167 }));

async function bridge(page, method, argument) {
  return page.evaluate(({ method, argument }) => window.__NESTLED_BURROW_E2E__?.[method]?.(argument), { method, argument });
}

async function boot(page) {
  await page.setViewportSize({ width: 320, height: 180 });
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  await expect(page.locator("canvas")).toHaveJSProperty("width", 320);
  await expect(page.locator("canvas")).toHaveJSProperty("height", 180);
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

function inventoryState(hud) {
  return hud.resources.inventory;
}

test("ten-slot hotbar selects with 1-9/0, swaps, drops and picks up inside the game", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop pointer and keyboard route captures game integration once");
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await boot(page);

  let inventory = inventoryState(await bridge(page, "getHudState"));
  expect(inventory.slots).toHaveLength(10);
  expect(inventory.slots.slice(0, 3).map((item) => item.id)).toEqual(["axe", "hoe", "watering-can"]);

  await page.keyboard.press("Digit1");
  await expect.poll(async () => inventoryState(await bridge(page, "getHudState")).selectedIndex).toBe(0);
  await page.keyboard.press("Digit1");
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
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.worldItems).toHaveLength(1);
  expect((await bridge(page, "getSession")).gameplay.inventory.slots[3]).toBeNull();
  await page.waitForTimeout(500);

  const dropped = (await bridge(page, "getSession")).gameplay.worldItems[0];
  expect(dropped.item).toMatchObject({ id: "axe", kind: "tool", quantity: 1 });
  await page.locator("canvas").screenshot({ path: `${EVIDENCE_DIR}/inventory-dropped-in-game.png` });
  await testInfo.attach("inventory-dropped-in-game", { path: `${EVIDENCE_DIR}/inventory-dropped-in-game.png`, contentType: "image/png" });

  await bridge(page, "placePlayerAt", { x: dropped.x, y: dropped.y, facing: { x: 0, y: 1 } });
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.worldItems).toHaveLength(0);
  await expect.poll(async () => (await bridge(page, "getSession")).gameplay.inventory.slots[0]?.id).toBe("axe");
  expect(pageErrors).toEqual([]);
});
