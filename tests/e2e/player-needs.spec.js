import { expect, test } from "@playwright/test";

async function bridge(page) {
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
}

async function snapshot(page) {
  return page.evaluate(() => window.__NESTLED_BURROW_E2E__.getNeedsState());
}

test.describe("Task #030 player needs", () => {
  test.skip(({ isMobile }) => isMobile, "focused runtime proof uses deterministic desktop interactions");

  test("facility, NPC radius, and resource profiles drive canonical flows", async ({ page }) => {
    await bridge(page);

    await page.evaluate(() => {
      const api = window.__NESTLED_BURROW_E2E__;
      api.setNeeds({ novelty: 50, satiety: 50, toilet: 50, lustre: 50, dialogue: 50 });
      api.placePlayerNear("home-shower-01");
      api.interact();
      api.advanceGameplayTime(1000);
    });
    let state = await snapshot(page);
    expect(state.activity.facility).toBe("shower");
    await expect.poll(async () => page.evaluate(() => window.__NESTLED_BURROW_E2E__.getInteractionState())).toMatchObject({
      candidate: { prompt: "hud:interaction.leaveShower" },
    });
    expect(state.flow.lustre.rate).toBe(10);
    expect(state.flow.toilet.rate).toBe(-0.1125);
    expect(state.values.lustre).toBeGreaterThan(59);
    expect(state.values.toilet).toBeLessThan(50);

    await page.evaluate(() => window.__NESTLED_BURROW_E2E__.interact());
    expect((await snapshot(page)).activity.facility).toBeNull();

    for (const [facilityId, needId, stopPrompt] of [
      ["home-toilet-01", "toilet", "hud:interaction.leaveToilet"],
      ["home-table-01", "satiety", "hud:interaction.stopEating"],
    ]) {
      await page.evaluate(({ facilityId, needId }) => {
        const api = window.__NESTLED_BURROW_E2E__;
        api.setNeeds({ [needId]: 50 });
        api.placePlayerNear(facilityId);
        api.interact();
      }, { facilityId, needId });
      await expect.poll(async () => page.evaluate(() => window.__NESTLED_BURROW_E2E__.getInteractionState())).toMatchObject({
        candidate: { prompt: stopPrompt },
      });
      await page.evaluate(() => window.__NESTLED_BURROW_E2E__.interact());
      await expect.poll(snapshot.bind(null, page)).toMatchObject({ activity: { facility: null } });
    }

    await page.evaluate(() => {
      const api = window.__NESTLED_BURROW_E2E__;
      api.setNeeds({ dialogue: 50 });
      api.placePlayerNear("seed-merchant");
      api.advanceGameplayTime(1000);
    });
    state = await snapshot(page);
    expect(state.activity.npcNearby).toBe(true);
    expect(state.flow.dialogue.rate).toBe(0.5);
    expect(state.values.dialogue).toBeCloseTo(50.5, 0);

    await page.evaluate(() => {
      const api = window.__NESTLED_BURROW_E2E__;
      api.setNeeds({ novelty: 50 });
      api.selectInventorySlot(0);
      api.setPlayerMotion({ moving: true, running: true });
      api.advanceGameplayTime(100);
    });
    state = await snapshot(page);
    expect(state.flow.novelty.rate).toBe(9);
    await page.evaluate(() => window.__NESTLED_BURROW_E2E__.setPlayerMotion({ moving: false, running: false }));

    const cases = [
      ["fallen-log-01", -1.5],
      ["yard-stone-02", -1.5],
      ["yard-ruby-01", 8],
    ];
    for (const [resourceId, expectedRate] of cases) {
      await page.evaluate(({ resourceId }) => {
        const api = window.__NESTLED_BURROW_E2E__;
        api.setNeeds({ novelty: 50, satiety: 50 });
        api.placePlayerNear(resourceId);
        api.expireHitCooldown();
        api.interact();
        api.advanceGameplayTime(1000);
      }, { resourceId });
      await expect.poll(async () => (await page.evaluate(() => window.__NESTLED_BURROW_E2E__.getInteractionHudState())).promptAlpha).toBe(0.5);
      state = await snapshot(page);
      expect(state.activity.activeResourceKind).toBeTruthy();
      expect(state.flow.novelty.rate).toBe(expectedRate);
      expect(state.flow.satiety.rate).toBeCloseTo(-0.495, 5);
      if (expectedRate > 0) expect(state.values.novelty).toBeGreaterThan(50);
      else expect(state.values.novelty).toBeLessThan(50);
    }
  });

  test("HUD exposes six independent NESTLD rows", async ({ page }) => {
    await bridge(page);
    const hud = await page.evaluate(() => window.__NESTLED_BURROW_E2E__.getHudState());
    expect(hud.resources.needsRows.map((row) => row.symbol).join("")).toBe("NESTLD");
    expect(hud.resources.needsRows).toHaveLength(6);
    expect(hud.areas.needRows).toHaveLength(6);
  });

  test("fatigue marker and failed floor wake provide readable feedback", async ({ page }) => {
    await bridge(page);
    await page.evaluate(() => window.__NESTLED_BURROW_E2E__.setEnergy(9));
    await expect.poll(async () => page.evaluate(() => window.__NESTLED_BURROW_E2E__.getLowEnergyMarkerState())).not.toBeNull();
    const marker = await page.evaluate(() => window.__NESTLED_BURROW_E2E__.getLowEnergyMarkerState());
    expect(marker.y - marker.playerY).toBeLessThanOrEqual(-18);

    await page.evaluate(() => {
      const api = window.__NESTLED_BURROW_E2E__;
      api.setEnergy(0);
      api.advanceGameplayTime(16);
      api.setWakeRandomValue(1);
    });
    await expect.poll(async () => page.evaluate(() => window.__NESTLED_BURROW_E2E__.getRuntimeState())).toMatchObject({ sleeping: true, exhaustedSleeping: true });
    await page.evaluate(() => window.__NESTLED_BURROW_E2E__.interact());
    await expect.poll(async () => page.evaluate(() => window.__NESTLED_BURROW_E2E__.getInteractionHudState())).toMatchObject({
      messageKey: "hud:interaction.wakeFailed",
      promptVisible: true,
    });
  });
});
