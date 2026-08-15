import { expect, test } from "@playwright/test";

async function bridge(page, method, argument) {
  return page.evaluate(({ method, argument }) => window.__NESTLED_BURROW_E2E__?.[method]?.(argument), { method, argument });
}

async function boot(page) {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  await expect(page.locator("canvas")).toHaveJSProperty("width", 640);
}

async function tapGameKey(page, key) {
  await page.keyboard.down(key);
  await page.waitForTimeout(120);
  await page.keyboard.up(key);
  await page.waitForTimeout(80);
}

async function tapAlt(page) {
  await tapGameKey(page, "Alt");
}

async function enterNest(page) {
  await expect.poll(async () => {
    await bridge(page, "placePlayerNear", "village-nest-transport");
    return (await bridge(page, "getInteractionState"))?.candidate?.entityId;
  }).toBe("village-nest-transport");
  await tapGameKey(page, "Space");
  await expect.poll(async () => (await bridge(page, "getLocationState")).worldId).toBe("nest");
}

async function collapseWithGuaranteedWake(page) {
  await bridge(page, "setWakeRandomValue", 0);
  await bridge(page, "setEnergy", 0);
  await expect.poll(async () => bridge(page, "getRuntimeState")).toMatchObject({
    sleeping: true,
    exhaustedSleeping: true,
  });
  await expect.poll(async () => bridge(page, "getInteractionState")).toMatchObject({
    candidate: { kind: "wake-exhausted", prompt: "hud:interaction.tryWake" },
  });
}

test("manual wake remains available from peaceful and combat inventory modes", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "physical inventory modes are desktop-only");
  await boot(page);

  await collapseWithGuaranteedWake(page);
  await expect.poll(async () => bridge(page, "getInteractionHudState")).toMatchObject({
    suppressed: false,
    promptVisible: true,
  });
  await tapGameKey(page, "Space");
  await expect.poll(async () => bridge(page, "getRuntimeState")).toMatchObject({
    sleeping: false,
    exhaustedSleeping: false,
  });

  await tapAlt(page);
  await expect.poll(async () => (await bridge(page, "getHudState")).inventoryMode).toMatchObject({
    mode: "COMBAT",
    stableMode: "COMBAT",
    transitioning: false,
  });

  await collapseWithGuaranteedWake(page);
  await expect.poll(async () => bridge(page, "getInteractionHudState")).toMatchObject({
    suppressed: false,
    promptVisible: true,
  });
  await tapGameKey(page, "Space");
  await expect.poll(async () => bridge(page, "getRuntimeState")).toMatchObject({
    sleeping: false,
    exhaustedSleeping: false,
  });
});

test("Wild Atoll knockout exposes no manual wake interaction", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Atoll keyboard route is covered on desktop");
  await boot(page);

  await enterNest(page);
  await expect.poll(async () => {
    await bridge(page, "placePlayerNear", "nest-atoll-entrance");
    return (await bridge(page, "getWildAtollState"))?.candidateId;
  }).toBe("enter");
  await tapGameKey(page, "Space");
  await expect.poll(async () => (await bridge(page, "getLocationState")).worldId).toBe("atoll");

  await bridge(page, "setEnergy", 0);
  await expect.poll(async () => bridge(page, "getRuntimeState")).toMatchObject({
    sleeping: true,
    exhaustedSleeping: true,
  });
  await page.waitForTimeout(100);
  expect((await bridge(page, "getInteractionState")).candidate).toBeNull();
  await expect.poll(async () => bridge(page, "getInteractionHudState")).toMatchObject({
    promptVisible: false,
  });
});
