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
}

async function activateStair(page, worldId, transportId) {
  const locations = {
    village: {
      interaction: { x: 32 * 16, y: 13 * 16, facing: { x: 0, y: -1 } },
      retreat: { x: 32 * 16, y: 15 * 16, facing: { x: 0, y: -1 } },
    },
    nest: {
      interaction: { x: 11 * 16, y: 12 * 16, facing: { x: 0, y: 1 } },
      retreat: { x: 11 * 16, y: 10 * 16, facing: { x: 0, y: 1 } },
    },
  };
  const route = locations[worldId];
  if (!route) throw new Error(`Unknown stair world: ${worldId}`);
  if ((await bridge(page, "getLocationState"))?.transitionLocked) {
    await bridge(page, "placePlayerAt", route.retreat);
    await expect.poll(async () => (await bridge(page, "getLocationState"))?.transitionLocked).toBe(false);
  }
  await bridge(page, "placePlayerAt", route.interaction);
  await expect.poll(async () => (await bridge(page, "getInteractionState"))?.candidate?.entityId).toBe(transportId);
  const candidate = (await bridge(page, "getInteractionState"))?.candidate;
  await bridge(page, "placePlayerAt", {
    x: candidate.position.x,
    y: candidate.position.y,
    facing: route.interaction.facing,
  });
  await expect.poll(async () => (await bridge(page, "getInteractionState"))?.candidate?.entityId).toBe(transportId);
  await page.keyboard.press("Space");
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

async function expectSharedTreeHighlight(page, resourceId) {
  await bridge(page, "selectInventorySlot", 0);
  await expect.poll(async () => {
    await bridge(page, "placePlayerNear", resourceId);
    return (await bridge(page, "getInteractionState"))?.candidate?.entityId;
  }).toBe(resourceId);
  await expect.poll(() => bridge(page, "getResourceVisualState", resourceId)).toMatchObject({
    highlighted: true,
    highlightMode: "tint",
    highlightCopies: 0,
    spriteCount: 12,
  });
}

test("fresh Burrow places melee starters by the dummy and opens build mode without a selected asset", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop proves build-mode pointer and move behavior once");
  await bootFresh(page);

  const dummy = (await bridge(page, "getMeleeState")).dummy;
  const starters = (await bridge(page, "getSession")).gameplay.worldItems
    .filter(({ id }) => id.startsWith("starter-melee-"))
    .map(({ id, item, x, y }) => ({ id, itemId: item.id, x, y }));
  expect(starters).toEqual([
    { id: "starter-melee-sword", itemId: "sword", x: dummy.position.x - 8, y: dummy.position.y + 24 },
    { id: "starter-melee-battle-axe", itemId: "battle-axe", x: dummy.position.x + 24, y: dummy.position.y + 24 },
  ]);

  expect(await bridge(page, "getBuildModeState")).toMatchObject({ active: false, selectedId: null });
  await bridge(page, "toggleBuildMode");
  expect(await bridge(page, "getBuildModeState")).toMatchObject({ active: true, selectedId: null });

  const before = (await bridge(page, "getTavernState")).sign;
  expect(await bridge(page, "moveTavernSign", { x: before.position.x - 32, y: before.position.y })).toMatchObject({ status: "moved" });
  const after = (await bridge(page, "getTavernState")).sign;
  expect(after.position).toEqual({ x: before.position.x - 32, y: before.position.y });
  expect(after.interactionPosition).toEqual({ x: before.interactionPosition.x - 32, y: before.interactionPosition.y });
  expect(after.guestCheckPoint).toEqual({ x: before.guestCheckPoint.x - 32, y: before.guestCheckPoint.y });
  await expect.poll(async () => {
    await bridge(page, "placePlayerNear", "tavern-open-sign");
    return (await bridge(page, "getInteractionState"))?.candidate?.entityId;
  }).toBe("tavern-open-sign");
  await bridge(page, "toggleBuildMode");
});

test("village and Nest transition atomically and preserve location resource state", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop proves the focused location lifecycle once");
  await bootFresh(page);

  const village = await bridge(page, "getLocationState");
  expect(village.worldId).toBe("village");
  expect(village.layout.transitions).toHaveLength(1);
  expect(village.layout.transitions[0].footprintBounds).toMatchObject({ left: 480, top: 64, right: 544, bottom: 192 });
  expect(village.home).toMatchObject({ npcCount: 1, tavernPresent: true, farmingPresent: true, buildModePresent: true, bedPresent: true });
  await expect.poll(async () => (await bridge(page, "getDebrisState")).plantedTrees.length).toBe(2);
  const villageDebris = await bridge(page, "getDebrisState");
  expect(villageDebris.definitions.filter(({ profileId }) => profileId === "log-small")).toHaveLength(2);
  expect(villageDebris.definitions.filter(({ profileId }) => profileId === "log-large")).toHaveLength(1);
  expect(villageDebris.definitions.filter(({ profileId }) => profileId === "stone-small")).toHaveLength(3);
  expect(villageDebris.definitions.filter(({ profileId }) => profileId === "stone-large")).toHaveLength(3);
  const villageTreeId = villageDebris.plantedTrees[0].id;
  await expectSharedTreeHighlight(page, villageTreeId);
  await bridge(page, "expireHitCooldown");
  await bridge(page, "interact");
  await expect.poll(async () => (await bridge(page, "getResourceNodeState", villageTreeId)).progress).toBeGreaterThan(0);

  await activateStair(page, "village", "village-nest-transport");
  await waitForWorld(page, "nest");
  const nest = await bridge(page, "getLocationState");
  expect(nest.layout.bounds).toEqual({ left: 0, top: 0, right: 352, bottom: 256 });
  expect(nest.layout.transitions[0].footprintBounds).toMatchObject({ left: 144, top: 208, right: 208, bottom: 256 });
  expect(nest.home).toEqual({ npcCount: 0, facilityCount: 0, tavernPresent: false, farmingPresent: false, buildModePresent: false, bedPresent: false });
  expect(await bridge(page, "getMeleeState")).toMatchObject({ dummy: null });
  const camera = await bridge(page, "getCameraState");
  const player = await bridge(page, "getCharacterSnapshot", "player");
  expect(camera.target).toEqual(player.position);
  await page.waitForTimeout(150);
  expect((await bridge(page, "getLocationState")).worldId).toBe("nest");

  await activateStair(page, "nest", "nest-village-transport");
  await waitForWorld(page, "village");
  expect((await bridge(page, "getMeleeState")).dummy.id).toBe("training-dummy-01");
  await activateStair(page, "village", "village-nest-transport");
  await waitForWorld(page, "nest");

  const nestResources = (await bridge(page, "getDebrisState")).definitions;
  expect(nestResources).toHaveLength(7);
  expect(nestResources.filter(({ profileId }) => profileId === "tree-planted")).toHaveLength(4);
  expect(nestResources.filter(({ profileId }) => profileId.includes("stone"))).toHaveLength(3);
  await expectSharedTreeHighlight(page, "nest-tree-02");
  await clearResource(page, "nest-tree-01", 0);

  await activateStair(page, "nest", "nest-village-transport");
  await waitForWorld(page, "village");
  expect((await bridge(page, "getLocationState")).home).toMatchObject({ npcCount: 1, tavernPresent: true, farmingPresent: true, buildModePresent: true, bedPresent: true });
  await activateStair(page, "village", "village-nest-transport");
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

  await activateStair(page, "nest", "nest-village-transport");
  await waitForWorld(page, "village");
  expect((await bridge(page, "getLocationState")).home).toMatchObject({ npcCount: 1, facilityCount: expect.any(Number), tavernPresent: true, farmingPresent: true, buildModePresent: true, bedPresent: true });
});

test("new game from Nest tears down the location and boots one fresh village", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "desktop proves the focused location teardown once");
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await bootFresh(page);
  await activateStair(page, "village", "village-nest-transport");
  await waitForWorld(page, "nest");
  await page.evaluate(() => { window.__NESTLED_BURROW_E2E__.__task059PreviousBridge = true; });

  await bridge(page, "newGame");

  await page.waitForFunction(
    () => Boolean(window.__NESTLED_BURROW_E2E__)
      && !window.__NESTLED_BURROW_E2E__.__task059PreviousBridge,
    null,
    { timeout: 3_000 },
  );
  await waitForWorld(page, "village");
  expect((await bridge(page, "getLocationState")).home).toMatchObject({
    npcCount: 1,
    tavernPresent: true,
    farmingPresent: true,
    buildModePresent: true,
    bedPresent: true,
  });
  expect(pageErrors).toEqual([]);
});
