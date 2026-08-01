import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

async function bridge(page, method, argument) {
  return page.evaluate(
    ({ method, argument }) => window.__NESTLED_BURROW_E2E__?.[method]?.(argument),
    { method, argument },
  );
}

async function bootFresh(page) {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
}

async function waitForWorld(page, worldId) {
  await expect.poll(async () => (await bridge(page, "getLocationState"))?.worldId).toBe(worldId);
  await expect.poll(async () => (await bridge(page, "getLocationState"))?.transitionLocked).toBe(false);
}

async function clearResource(page, resourceId, slotIndex) {
  await bridge(page, "selectInventorySlot", slotIndex);
  for (let hit = 0; hit < 7; hit += 1) {
    await bridge(page, "expireHitCooldown");
    await expect.poll(async () => {
      await bridge(page, "placePlayerNear", resourceId);
      return (await bridge(page, "getInteractionState"))?.candidate?.entityId;
    }).toBe(resourceId);
    await bridge(page, "interact");
  }
  await expect.poll(async () => (await bridge(page, "getResourceNodeState", resourceId)).cleared).toBe(true);
}

test("village and Nest transition atomically and preserve location resource state", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop proves the focused location lifecycle once");
  await bootFresh(page);

  const village = await bridge(page, "getLocationState");
  expect(village.worldId).toBe("village");
  expect(village.layout.transitions).toHaveLength(1);
  expect(village.layout.transitions[0].footprintBounds).toMatchObject({ left: 496, top: 64, right: 528, bottom: 96 });
  expect(village.home).toMatchObject({ npcCount: 1, tavernPresent: true, farmingPresent: true, buildModePresent: true, bedPresent: true });

  await bridge(page, "enterTransport", "village-nest-transport");
  await waitForWorld(page, "nest");
  const nest = await bridge(page, "getLocationState");
  expect(nest.layout.bounds).toEqual({ left: 0, top: 0, right: 352, bottom: 256 });
  expect(nest.layout.transitions[0].footprintBounds).toMatchObject({ left: 160, top: 208, right: 192, bottom: 240 });
  expect(nest.home).toEqual({ npcCount: 0, facilityCount: 0, tavernPresent: false, farmingPresent: false, buildModePresent: false, bedPresent: false });
  const camera = await bridge(page, "getCameraState");
  const player = await bridge(page, "getCharacterSnapshot", "player");
  expect(camera.target).toEqual(player.position);
  await page.waitForTimeout(150);
  expect((await bridge(page, "getLocationState")).worldId).toBe("nest");

  const nestResources = (await bridge(page, "getDebrisState")).definitions;
  expect(nestResources).toHaveLength(7);
  expect(nestResources.filter(({ profileId }) => profileId === "tree-planted")).toHaveLength(4);
  expect(nestResources.filter(({ profileId }) => profileId.includes("stone"))).toHaveLength(3);
  await clearResource(page, "nest-tree-01", 0);

  await bridge(page, "enterTransport", "nest-village-transport");
  await waitForWorld(page, "village");
  expect((await bridge(page, "getLocationState")).home).toMatchObject({ npcCount: 1, tavernPresent: true, farmingPresent: true, buildModePresent: true, bedPresent: true });
  await bridge(page, "enterTransport", "village-nest-transport");
  await waitForWorld(page, "nest");
  expect((await bridge(page, "getResourceNodeState", "nest-tree-01")).cleared).toBe(true);
  expect(await bridge(page, "getResourceVisualState", "nest-tree-01")).toBeNull();
  expect(new Set((await bridge(page, "getDebrisState")).definitions.map(({ id }) => id)).size).toBe(7);

  await bridge(page, "saveSession");
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  await waitForWorld(page, "nest");
  const reloaded = await bridge(page, "getLocationState");
  expect(reloaded.home).toEqual({ npcCount: 0, facilityCount: 0, tavernPresent: false, farmingPresent: false, buildModePresent: false, bedPresent: false });
  expect((await bridge(page, "getResourceNodeState", "nest-tree-01")).cleared).toBe(true);
  expect(await bridge(page, "getResourceVisualState", "nest-tree-01")).toBeNull();

  await bridge(page, "enterTransport", "nest-village-transport");
  await waitForWorld(page, "village");
  expect((await bridge(page, "getLocationState")).home).toMatchObject({ npcCount: 1, facilityCount: expect.any(Number), tavernPresent: true, farmingPresent: true, buildModePresent: true, bedPresent: true });
});
