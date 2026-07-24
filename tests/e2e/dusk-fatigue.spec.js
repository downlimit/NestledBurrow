import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const EVIDENCE_DIR = "artifacts/task-018";

async function boot(page) {
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
}

async function bridge(page, method, argument) {
  return page.evaluate(({ method, argument }) => window.__NESTLED_BURROW_E2E__?.[method]?.(argument), { method, argument });
}

async function placeNear(page, entityId) {
  await expect.poll(async () => {
    await bridge(page, "placePlayerNear", entityId);
    return (await bridge(page, "getInteractionState"))?.candidate?.entityId;
  }).toBe(entityId);
}

async function hit(page, entityId) {
  await placeNear(page, entityId);
  await page.keyboard.down("Space");
  await page.waitForTimeout(60);
  await page.keyboard.up("Space");
}

async function captureEvidence(page, testInfo, name) {
  const image = await page.locator("canvas").screenshot({ path: `${EVIDENCE_DIR}/${name}.png` });
  await testInfo.attach(name, { body: image, contentType: "image/png" });
}

test("multiply overlay follows exact dusk and dawn phases while HUD stays above it", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "final visual evidence is captured once at native logical resolution");
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await boot(page);
  const phases = [
    [12, 0xffffff, "day-hud"],
    [18, 0xffb380, "orange-dusk"],
    [20, 0xff648b, "pink-dusk"],
    [22, 0x425cd4, "blue-night"],
    [7, null, "morning-transition"],
  ];
  for (const [hour, color, name] of phases) {
    await bridge(page, "setWorldTimeSeconds", hour * 3600);
    if (color != null) await expect.poll(() => bridge(page, "getDayNightState")).toMatchObject({ color });
    await captureEvidence(page, testInfo, name);
  }
  const hud = await bridge(page, "getHudState");
  expect(hud.resources.icons).toEqual({ wood: true, ruby: true });
  expect(hud.resources.energyText).toBe("ЭН 100/100");
  expect(hud.resources.clockText).toBe("07:00");
  await bridge(page, "setLanguage", "en");
  await expect.poll(() => bridge(page, "getHudState")).toMatchObject({ resources: { energyText: "EN 100/100", clockText: "7:00 AM" } });
});

test("energy curve changes player speed smoothly and uses maximum energy", async ({ page }) => {
  await boot(page);
  await bridge(page, "setEnergyState", { current: 25, maximum: 100 });
  await expect.poll(() => bridge(page, "getPlayerMovementState")).toMatchObject({ targetMultiplier: 1, effectiveMultiplier: 1 });
  await bridge(page, "setEnergyState", { current: 13, maximum: 100 });
  await expect.poll(async () => (await bridge(page, "getPlayerMovementState")).targetMultiplier).toBeCloseTo(0.8125, 6);
  await bridge(page, "setEnergyState", { current: 10, maximum: 200 });
  await expect.poll(async () => (await bridge(page, "getPlayerMovementState")).targetMultiplier).toBeCloseTo(0.4791667, 6);
  const firstFrame = await bridge(page, "getPlayerMovementState");
  expect(firstFrame.effectiveMultiplier).toBeGreaterThan(firstFrame.targetMultiplier);
  await expect.poll(async () => (await bridge(page, "getPlayerMovementState")).effectiveMultiplier, { timeout: 1500 }).toBeCloseTo(firstFrame.targetMultiplier, 3);
  await bridge(page, "setEnergyState", { current: 200, maximum: 200 });
  const recoveryStart = await bridge(page, "getPlayerMovementState");
  expect(recoveryStart.effectiveMultiplier).toBeLessThan(1);
  await expect.poll(async () => (await bridge(page, "getPlayerMovementState")).effectiveMultiplier, { timeout: 1500 }).toBeCloseTo(1, 3);
});

test("successful low-energy hits shake only energy text and dispatch distinct volume-aware SFX", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "keyboard interaction and audio-unlock coverage runs once");
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await boot(page);
  await bridge(page, "setEnergy", 16);
  const beforeLowHit = await bridge(page, "getHudState");
  await hit(page, "fallen-log-01");
  await expect.poll(async () => (await bridge(page, "getHudState")).resources.energyShakeCount).toBe(beforeLowHit.resources.energyShakeCount + 1);
  await expect.poll(() => bridge(page, "getAudioEffectState")).toMatchObject({ lastEffectType: "log" });
  await captureEvidence(page, testInfo, "low-energy-resources");

  await bridge(page, "setEnergy", 19);
  const exactThreshold = await bridge(page, "getHudState");
  await hit(page, "yard-log-02");
  await expect.poll(async () => (await bridge(page, "getResourceState")).currentEnergy).toBe(15);
  expect((await bridge(page, "getHudState")).resources.energyShakeCount).toBe(exactThreshold.resources.energyShakeCount);

  await bridge(page, "setEnergy", 3);
  const failedState = await bridge(page, "getHudState");
  const failedAudio = await bridge(page, "getAudioEffectState");
  await hit(page, "yard-log-03");
  expect((await bridge(page, "getHudState")).resources.energyShakeCount).toBe(failedState.resources.energyShakeCount);
  expect((await bridge(page, "getAudioEffectState")).playCount).toBe(failedAudio.playCount);

  await bridge(page, "setEnergy", 100);
  await hit(page, "yard-ruby-01");
  await expect.poll(() => bridge(page, "getAudioEffectState")).toMatchObject({ lastEffectType: "ruby" });
  await bridge(page, "setAudioChannel", { channel: "effects", value: 0 });
  const mutedAudio = await bridge(page, "getAudioEffectState");
  await hit(page, "yard-log-04");
  expect((await bridge(page, "getAudioEffectState")).playCount).toBe(mutedAudio.playCount);
});
