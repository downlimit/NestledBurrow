import { expect, test } from "@playwright/test";

async function bridge(page) {
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
}

async function snapshot(page) {
  return page.evaluate(() => window.__NESTLED_BURROW_E2E__.getNeedsState());
}

test.describe("Task #061 Sims-like needs", () => {
  test.skip(({ isMobile }) => isMobile, "focused runtime proof uses deterministic desktop interactions");

  test("facility, NPC radius, and resource profiles drive canonical flows", async ({ page }) => {
    await bridge(page);

    await page.evaluate(() => {
      const api = window.__NESTLED_BURROW_E2E__;
      api.setNeeds({ novelty: 50, satiety: 50, toilet: 50, lustre: 50, dialogue: 50 });
      api.placePlayerNear("home-shower-01");
      api.interact();
      api.completeInteractionApproach();
      api.advanceGameplayTime(1000);
    });
    let state = await snapshot(page);
    expect(state.activity.facility).toBe("shower");
    await expect.poll(async () => page.evaluate(() => window.__NESTLED_BURROW_E2E__.getInteractionState())).toMatchObject({
      candidate: { prompt: "hud:interaction.leaveShower" },
    });
    expect(state.flow.lustre.rate).toBe(600);
    expect(state.flow.toilet.rate).toBe(-6);
    expect(state.values.lustre).toBeGreaterThan(59);
    expect(state.values.toilet).toBeLessThan(50);

    await page.evaluate(() => window.__NESTLED_BURROW_E2E__.interact());
    expect((await snapshot(page)).activity.facility).toBeNull();
    await page.evaluate(() => window.__NESTLED_BURROW_E2E__.advanceGameplayTime(900));

    for (const [facilityId, needId, stopPrompt] of [
      ["editor-toilet-2", "toilet", "hud:interaction.leaveToilet"],
      ["editor-table-3", "satiety", "hud:interaction.stopEating"],
    ]) {
      await page.evaluate(({ facilityId, needId }) => {
        const api = window.__NESTLED_BURROW_E2E__;
        api.setNeeds({ [needId]: 50 });
        api.placePlayerNear(facilityId);
        api.interact();
        api.completeInteractionApproach();
        api.advanceGameplayTime(500);
      }, { facilityId, needId });
      await expect.poll(async () => page.evaluate(() => window.__NESTLED_BURROW_E2E__.getInteractionState())).toMatchObject({
        candidate: { prompt: stopPrompt },
      });
      await page.evaluate(() => window.__NESTLED_BURROW_E2E__.interact());
      await expect.poll(snapshot.bind(null, page)).toMatchObject({ activity: { facility: null } });
      await page.evaluate(() => window.__NESTLED_BURROW_E2E__.advanceGameplayTime(700));
    }

    await page.evaluate(() => {
      const api = window.__NESTLED_BURROW_E2E__;
      api.setNeeds({ dialogue: 50 });
      api.placePlayerNear("seed-merchant");
      api.advanceGameplayTime(1000);
    });
    state = await snapshot(page);
    expect(state.activity.npcNearby).toBe(true);
    expect(state.flow.dialogue.rate).toBe(0);
    expect(state.values.dialogue).toBeCloseTo(50, 5);

    await page.evaluate(() => {
      const api = window.__NESTLED_BURROW_E2E__;
      api.setNeeds({ novelty: 50 });
      api.selectInventorySlot(0);
      api.setPlayerMotion({ moving: true, running: true });
      api.advanceGameplayTime(100);
    });
    state = await snapshot(page);
    expect(state.flow.novelty.rate).toBe(-1);
    await page.evaluate(() => window.__NESTLED_BURROW_E2E__.setPlayerMotion({ moving: false, running: false }));

    const cases = [
      ["fallen-log-01", 0],
      ["yard-stone-02", 1],
      ["yard-ruby-01", 1],
    ];
    for (const [resourceId, slotIndex] of cases) {
      state = await page.evaluate(({ resourceId, slotIndex }) => {
        const api = window.__NESTLED_BURROW_E2E__;
        api.setNeeds({ novelty: 50, satiety: 50 });
        api.selectInventorySlot(slotIndex);
        api.placePlayerNear(resourceId);
        api.expireHitCooldown();
        api.interact();
        api.advanceGameplayTime(1000);
        return api.getNeedsState();
      }, { resourceId, slotIndex });
      await expect.poll(async () => (await page.evaluate(() => window.__NESTLED_BURROW_E2E__.getInteractionHudState())).promptAlpha).toBe(0.5);
      expect(state.activity.activeResourceKind).toBeTruthy();
      expect(state.flow.novelty.rate).toBe(-1);
      expect(state.flow.satiety.rate).toBe(-7);
      expect(state.values.novelty).toBeLessThan(50);
    }
  });

  test("HUD exposes six independent NESTLD rows", async ({ page }) => {
    await bridge(page);
    const hud = await page.evaluate(() => window.__NESTLED_BURROW_E2E__.getHudState());
    expect(hud.resources.needsRows.map((row) => row.symbol).join("")).toBe("NESTLD");
    expect(hud.resources.needsRows).toHaveLength(6);
    expect(hud.areas.needRows).toHaveLength(6);
  });

  test("physical tool expenditure is normalized from actual energy loss", async ({ page }) => {
    await bridge(page);
    const flows = await page.evaluate(() => {
      const api = window.__NESTLED_BURROW_E2E__;
      api.selectInventorySlot(0);
      api.placePlayerNear("fallen-log-01");
      api.expireHitCooldown();
      api.interact();
      const active = api.getHudState().resources.energyFlow;
      api.advanceGameplayTime(700);
      const idle = api.getHudState().resources.energyFlow;
      return { active, idle };
    });
    expect(flows.active).toMatchObject({ direction: "down", arrows: 2 });
    expect(flows.idle).toMatchObject({ direction: "down", arrows: 1 });
  });

  test("long interaction walks to the nearest use point and exits there", async ({ page }) => {
    await bridge(page);
    const approach = await page.evaluate(() => {
      const api = window.__NESTLED_BURROW_E2E__;
      api.setNeeds({ satiety: 50 });
      api.placePlayerNear("editor-table-3");
      api.interact();
      return api.getRuntimeState().interactionTimeline;
    });
    expect(approach).toMatchObject({ phase: "approach", protectedNeed: null, metadata: { id: "editor-table-3" } });
    await expect.poll(async () => (await page.evaluate(() => window.__NESTLED_BURROW_E2E__.getRuntimeState())).interactionTimeline.phase).toBe("active");
    const arrived = await page.evaluate(() => {
      const api = window.__NESTLED_BURROW_E2E__;
      return { motor: api.getCharacterSnapshot("player").position, visual: api.getPlayerVisualState() };
    });
    expect(Math.hypot(arrived.motor.x - approach.approachPoint.x, arrived.motor.y - approach.approachPoint.y)).toBeLessThanOrEqual(1.5);
    expect(arrived.visual.x).toBeCloseTo(arrived.motor.x, 2);
    expect(arrived.visual.y).toBeCloseTo(arrived.motor.y, 2);
    await expect.poll(async () => page.evaluate(() => window.__NESTLED_BURROW_E2E__.getInteractionState())).toMatchObject({ candidate: { prompt: "hud:interaction.stopEating" } });
    await page.evaluate(() => window.__NESTLED_BURROW_E2E__.interact());
    await page.evaluate(() => window.__NESTLED_BURROW_E2E__.advanceGameplayTime(650));
    const exited = await page.evaluate(() => ({ runtime: window.__NESTLED_BURROW_E2E__.getRuntimeState(), motor: window.__NESTLED_BURROW_E2E__.getCharacterSnapshot("player").position }));
    expect(exited.runtime.interactionTimeline.phase).toBe("free");
    expect(exited.motor).toEqual(arrived.motor);
  });

  test("toilet and bed transitions protect only their target need", async ({ page }) => {
    await bridge(page);
    const toilet = await page.evaluate(() => {
      const api = window.__NESTLED_BURROW_E2E__;
      api.setNeeds({ toilet: 0.01, lustre: 80 });
      api.placePlayerNear("editor-toilet-2");
      api.interact();
      api.completeInteractionApproach();
      const motor = api.getCharacterSnapshot("player").position;
      api.advanceGameplayTime(400);
      return { needs: api.getNeedsState(), runtime: api.getRuntimeState(), motor, after: api.getCharacterSnapshot("player").position };
    });
    expect(toilet.runtime.interactionTimeline).toMatchObject({ phase: "enter", protectedNeed: "toilet", effectActive: false });
    expect(toilet.needs.values.toilet).toBeCloseTo(0.01, 6);
    expect(toilet.needs.values.lustre).toBeLessThan(80);
    expect(toilet.after).toEqual(toilet.motor);
    await page.evaluate(() => window.__NESTLED_BURROW_E2E__.advanceGameplayTime(100));
    expect((await snapshot(page)).values.toilet).toBeGreaterThan(0.01);
    await page.evaluate(() => {
      const api = window.__NESTLED_BURROW_E2E__;
      api.interact();
      api.advanceGameplayTime(600);
      api.setEnergy(0.01);
      api.placePlayerNear("home-bed-01");
      api.interact();
      api.completeInteractionApproach();
      api.advanceGameplayTime(900);
    });
    let runtime = await page.evaluate(() => window.__NESTLED_BURROW_E2E__.getRuntimeState());
    expect(runtime).toMatchObject({ sleeping: false, interactionTimeline: { phase: "enter", protectedNeed: "energy", effectActive: false } });
    expect((await page.evaluate(() => window.__NESTLED_BURROW_E2E__.getResourceState())).currentEnergy).toBeCloseTo(0.01, 6);
    await page.evaluate(() => window.__NESTLED_BURROW_E2E__.advanceGameplayTime(100));
    runtime = await page.evaluate(() => window.__NESTLED_BURROW_E2E__.getRuntimeState());
    expect(runtime).toMatchObject({ sleeping: true, interactionTimeline: { phase: "active", effectActive: true } });
    await expect.poll(async () => page.evaluate(() => window.__NESTLED_BURROW_E2E__.getInteractionState())).toMatchObject({
      candidate: { prompt: "hud:interaction.wake" },
    });
    await page.evaluate(() => window.__NESTLED_BURROW_E2E__.interact());
    runtime = await page.evaluate(() => window.__NESTLED_BURROW_E2E__.getRuntimeState());
    expect(runtime).toMatchObject({ sleeping: false, interactionTimeline: { phase: "exit", protectedNeed: "energy", effectActive: false } });
  });

  test("running gate, tool costs, and deterministic collapse remain player-visible", async ({ page }) => {
    await bridge(page);
    await page.evaluate(() => window.__NESTLED_BURROW_E2E__.setEnergy(9));
    await expect.poll(async () => page.evaluate(() => window.__NESTLED_BURROW_E2E__.getLowEnergyMarkerState())).not.toBeNull();
    const marker = await page.evaluate(() => window.__NESTLED_BURROW_E2E__.getLowEnergyMarkerState());
    expect(marker.y - marker.playerY).toBeLessThanOrEqual(-18);

    const toolSpend = await page.evaluate(() => {
      const api = window.__NESTLED_BURROW_E2E__;
      api.setEnergy(100);
      for (let index = 0; index < 7; index += 1) api.performPhysicalAction("axe");
      return api.getResourceState().currentEnergy;
    });
    expect(toolSpend).toBeCloseTo(98.6, 8);

    const blockedRun = await page.evaluate(() => {
      const api = window.__NESTLED_BURROW_E2E__;
      api.setEnergy(19);
      api.setPlayerMotion({ moving: true, running: true });
      return api.getPlayerMovementState();
    });
    expect(blockedRun.runSpeedMultiplier).toBe(1);

    await page.evaluate(() => {
      const api = window.__NESTLED_BURROW_E2E__;
      api.setEnergy(0);
      api.advanceGameplayTime(16);
    });
    await expect.poll(async () => page.evaluate(() => window.__NESTLED_BURROW_E2E__.getRuntimeState())).toMatchObject({ sleeping: true, exhaustedSleeping: true });
    await page.evaluate(() => window.__NESTLED_BURROW_E2E__.advanceGameplayTime(7400));
    expect((await page.evaluate(() => window.__NESTLED_BURROW_E2E__.getRuntimeState())).exhaustedSleeping).toBe(true);
    await page.evaluate(() => window.__NESTLED_BURROW_E2E__.advanceGameplayTime(100));
    await expect.poll(async () => page.evaluate(() => window.__NESTLED_BURROW_E2E__.getRuntimeState())).toMatchObject({ sleeping: false, exhaustedSleeping: false });
  });

  test("debug presets reach critical states and toilet accident stays locked through recovery", async ({ page }) => {
    await bridge(page);
    await page.evaluate(() => window.__NESTLED_BURROW_E2E__.setNeedsDebugPreset("hungry"));
    expect((await snapshot(page)).values.satiety).toBe(0);
    await page.evaluate(() => window.__NESTLED_BURROW_E2E__.setNeedsDebugPreset("urgent-toilet"));
    expect((await snapshot(page)).values.toilet).toBeCloseTo(5, 2);
    await page.evaluate(() => {
      const api = window.__NESTLED_BURROW_E2E__;
      api.setNeeds({ toilet: 0 });
      api.advanceGameplayTime(9000);
    });
    expect((await snapshot(page)).values.toilet).toBe(0);
    expect((await page.evaluate(() => window.__NESTLED_BURROW_E2E__.getRuntimeState())).interactionTimeline.phase).toBe("free");
    await page.evaluate(() => window.__NESTLED_BURROW_E2E__.advanceGameplayTime(1000));
    expect((await page.evaluate(() => window.__NESTLED_BURROW_E2E__.getRuntimeState())).interactionTimeline).toMatchObject({
      phase: "shake", profileId: "toilet-accident", protectedNeed: "toilet", shakeIndex: 1,
    });
    await page.evaluate(() => window.__NESTLED_BURROW_E2E__.advanceGameplayTime(2250));
    const recoveryStartFrame = await page.evaluate(() => ({
      needs: window.__NESTLED_BURROW_E2E__.getNeedsState(),
      runtime: window.__NESTLED_BURROW_E2E__.getRuntimeState().interactionTimeline,
    }));
    const recoveryRuntime = recoveryStartFrame.runtime;
    expect(recoveryRuntime).toMatchObject({ phase: "recovery", puddleOutput: { localPuddle: true } });
    expect(recoveryRuntime.recoveryProgress).toBeLessThan(0.2);
    const recoveryStart = recoveryStartFrame.needs;
    expect(recoveryStart.values.toilet).toBeCloseTo(70 * recoveryRuntime.recoveryProgress, 2);
    const midpointFrame = await page.evaluate(() => {
      window.__NESTLED_BURROW_E2E__.advanceGameplayTime(1000);
      return {
        needs: window.__NESTLED_BURROW_E2E__.getNeedsState(),
        runtime: window.__NESTLED_BURROW_E2E__.getRuntimeState().interactionTimeline,
      };
    });
    const recoveryMidpoint = midpointFrame.needs;
    const midpointRuntime = midpointFrame.runtime;
    expect(recoveryMidpoint.values.toilet).toBeCloseTo(70 * midpointRuntime.recoveryProgress, 2);
    expect(recoveryMidpoint.values.lustre).toBeCloseTo(recoveryStart.values.lustre - 45 * (midpointRuntime.recoveryProgress - recoveryRuntime.recoveryProgress), 1);
    const finalStepMs = Math.max(1, Math.floor((1 - midpointRuntime.recoveryProgress) * 2000));
    const beforeCompletion = await page.evaluate((milliseconds) => {
      window.__NESTLED_BURROW_E2E__.advanceGameplayTime(Math.max(0, milliseconds - 100));
      return window.__NESTLED_BURROW_E2E__.getRuntimeState().interactionTimeline;
    }, finalStepMs);
    expect(beforeCompletion.phase).toBe("recovery");
    const completionFrame = await page.evaluate(() => {
      window.__NESTLED_BURROW_E2E__.advanceGameplayTime(150);
      return {
        needs: window.__NESTLED_BURROW_E2E__.getNeedsState(),
        runtime: window.__NESTLED_BURROW_E2E__.getRuntimeState().interactionTimeline,
      };
    });
    const state = completionFrame.needs;
    expect(state.values.toilet).toBeGreaterThan(69.9);
    expect(state.values.lustre).toBeCloseTo(recoveryStart.values.lustre - 45 * (1 - recoveryRuntime.recoveryProgress), 1);
    expect(completionFrame.runtime.phase).toBe("free");
    expect(state.runtime.debugPresetActive).toBe(true);
  });
});
