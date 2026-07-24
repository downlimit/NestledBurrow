import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const EVIDENCE_DIR = "artifacts/task-019";

async function bootAtNativeResolution(page) {
  await page.setViewportSize({ width: 320, height: 180 });
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  await expect(page.locator("canvas")).toHaveJSProperty("width", 320);
  await expect(page.locator("canvas")).toHaveJSProperty("height", 180);
}

async function bridge(page, method, argument) {
  return page.evaluate(({ method, argument }) => window.__NESTLED_BURROW_E2E__?.[method]?.(argument), { method, argument });
}

async function activateLogical(page, x, y, touch = false) {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Game canvas is unavailable");
  const targetX = box.x + x * box.width / 320;
  const targetY = box.y + y * box.height / 180;
  if (touch) await page.touchscreen.tap(targetX, targetY);
  else await page.mouse.click(targetX, targetY);
}

async function captureNativeCanvas(page, testInfo, name) {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const image = await page.locator("canvas").screenshot({ path: `${EVIDENCE_DIR}/${name}.png` });
  expect(image.readUInt32BE(16)).toBe(320);
  expect(image.readUInt32BE(20)).toBe(180);
  await testInfo.attach(name, { body: image, contentType: "image/png" });
}

test("desktop HUD separates permanent zones and keeps Options modal-safe", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "native HUD evidence is captured once on desktop");
  await bootAtNativeResolution(page);

  const normal = await bridge(page, "getHudState");
  expect(normal).toMatchObject({
    optionsOpen: false,
    buildLabelVisible: false,
    newGameConfirming: false,
    areas: {
      options: { x: 8, y: 4, width: 74, height: 30 },
      clock: { x: 120, y: 4, width: 80, height: 24 },
      fullscreen: { x: 286, y: 4, width: 30, height: 30 },
      resources: { x: 244, y: 54, width: 46, height: 44 },
      energy: { x: 294, y: 54, width: 16, height: 44 },
    },
    resources: {
      woodText: "0",
      rubyText: "0",
      icons: { wood: true, ruby: true },
      energyRatio: 1,
      energyFillHeight: 38,
    },
  });
  expect(normal.resources.clockText).toMatch(/^\d{2}:\d{2}$/u);
  expect(await bridge(page, "isHudPoint", { x: 45, y: 19 })).toBe(true);
  expect(await bridge(page, "isHudPoint", { x: 189, y: 54 })).toBe(false);
  expect(await bridge(page, "isHudPoint", { x: 265, y: 70 })).toBe(false);
  await captureNativeCanvas(page, testInfo, "normal-hud");

  const debrisId = (await bridge(page, "getDebrisState")).definitions[0].id;
  await expect.poll(async () => {
    await bridge(page, "placePlayerNear", debrisId);
    return (await bridge(page, "getInteractionState"))?.candidate?.entityId;
  }).toBe(debrisId);
  await activateLogical(page, 45, 19);
  await expect.poll(() => bridge(page, "getHudState")).toMatchObject({ optionsOpen: true, buildLabelVisible: true });
  expect(await bridge(page, "isHudPoint", { x: 189, y: 54 })).toBe(true);
  expect(await bridge(page, "isHudPoint", { x: 20, y: 108 })).toBe(true);
  expect(await bridge(page, "isHudPoint", { x: 280, y: 158 })).toBe(true);
  expect(await bridge(page, "getInteractionHudState")).toMatchObject({ suppressed: false, promptVisible: true });
  await captureNativeCanvas(page, testInfo, "options-with-prompt");

  await activateLogical(page, 189, 54);
  await expect.poll(() => bridge(page, "getLanguage")).toBe("en");
  const localizedHud = await bridge(page, "getHudState");
  expect(localizedHud.optionsOpen).toBe(true);
  expect(localizedHud.resources.clockText).toMatch(/^\d{1,2}:\d{2} [AP]M$/u);
  await activateLogical(page, 101, 49);
  await expect.poll(async () => (await bridge(page, "getAudioSettings")).master).toBeCloseTo(0.5, 1);

  const sessionBeforeConfirmation = await bridge(page, "getSession");
  await activateLogical(page, 185, 87);
  await expect.poll(() => bridge(page, "getHudState")).toMatchObject({ optionsOpen: false, buildLabelVisible: false, newGameConfirming: true });
  expect(await bridge(page, "isHudPoint", { x: 45, y: 19 })).toBe(false);
  expect(await bridge(page, "isHudPoint", { x: 189, y: 54 })).toBe(true);
  expect(await bridge(page, "isHudPoint", { x: 265, y: 70 })).toBe(true);
  expect(await bridge(page, "isHudPoint", { x: 280, y: 158 })).toBe(false);
  expect(await bridge(page, "getInteractionHudState")).toMatchObject({ suppressed: true, promptVisible: false, dialogueVisible: false });
  await activateLogical(page, 228, 95);
  await expect.poll(() => bridge(page, "getHudState")).toMatchObject({ optionsOpen: false, newGameConfirming: false });
  expect(await bridge(page, "getInteractionHudState")).toMatchObject({ suppressed: false });
  const sessionAfterCancel = await bridge(page, "getSession");
  const { worldTimeSeconds: _beforeTime, ...gameplayBeforeConfirmation } = sessionBeforeConfirmation.gameplay;
  const { worldTimeSeconds: _afterTime, ...gameplayAfterCancel } = sessionAfterCancel.gameplay;
  expect({ ...sessionAfterCancel, gameplay: gameplayAfterCancel }).toEqual({ ...sessionBeforeConfirmation, gameplay: gameplayBeforeConfirmation });
});

test("coarse pointer activates only visible Options hit areas", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "coarse-pointer contract runs on the mobile project");
  await bootAtNativeResolution(page);
  expect(await bridge(page, "getLanguage")).toBe("ru");
  await activateLogical(page, 189, 54, true);
  expect(await bridge(page, "getLanguage")).toBe("ru");
  expect(await bridge(page, "getHudState")).toMatchObject({ optionsOpen: false });

  await activateLogical(page, 45, 19, true);
  await expect.poll(() => bridge(page, "getHudState")).toMatchObject({ optionsOpen: true });
  expect(await bridge(page, "isHudPoint", { x: 189, y: 54 })).toBe(true);
  await activateLogical(page, 189, 54, true);
  await expect.poll(() => bridge(page, "getLanguage")).toBe("en");
});
