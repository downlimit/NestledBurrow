import { expect, test } from "@playwright/test";

const STARTING_LAYOUT_STORAGE_KEY = "nestledBurrow.startingLayout";

async function waitForBridge(page) {
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
}

function moveFacility(definition, dx, dy) {
  const moved = JSON.parse(JSON.stringify(definition));
  moved.footprint.x += dx;
  moved.footprint.y += dy;
  moved.position.x += dx;
  moved.position.y += dy;
  moved.usePosition.x += dx;
  moved.usePosition.y += dy;
  moved.visual.x += dx;
  moved.visual.y += dy;
  if (moved.presentationPose) {
    moved.presentationPose.x += dx;
    moved.presentationPose.y += dy;
    moved.presentationPose.depth += dy;
  }
  return moved;
}

async function getFacilityPositions(page) {
  return page.evaluate(() => Object.fromEntries(
    window.__NESTLED_BURROW_E2E__
      .getFacilityState()
      .definitions
      .map((definition) => [definition.id, {
        x: definition.footprint.x,
        y: definition.footprint.y,
      }]),
  ));
}

test("browser-authored shower and toilet survive NEW GAME", async ({ page }) => {
  await page.goto(".");
  await waitForBridge(page);

  const expected = await page.evaluate((storageKey) => {
    const bridge = window.__NESTLED_BURROW_E2E__;
    const facilities = bridge.getFacilityState().definitions.map((definition) => {
      if (definition.id === "home-shower-01" || definition.id === "home-toilet-01") {
        const moved = JSON.parse(JSON.stringify(definition));
        moved.footprint.y += 64;
        moved.position.y += 64;
        moved.usePosition.y += 64;
        moved.visual.y += 64;
        if (moved.presentationPose) {
          moved.presentationPose.y += 64;
          moved.presentationPose.depth += 64;
        }
        return moved;
      }
      return definition;
    });
    const beds = bridge.getDebrisState().beds;
    const layout = {
      version: 1,
      nextBuildObjectId: 0,
      removedCanonicalFloors: [],
      removedCanonicalWalls: [],
      buildObjects: [],
      facilities,
      beds,
    };
    localStorage.setItem(storageKey, JSON.stringify(layout));
    return Object.fromEntries(
      facilities
        .filter((definition) => definition.id === "home-shower-01" || definition.id === "home-toilet-01")
        .map((definition) => [definition.id, {
          x: definition.footprint.x,
          y: definition.footprint.y,
        }]),
    );
  }, STARTING_LAYOUT_STORAGE_KEY);

  await page.reload();
  await waitForBridge(page);
  await expect.poll(() => getFacilityPositions(page)).toMatchObject(expected);

  await page.evaluate(() => {
    window.__AUTHORING_TEST_OLD_BRIDGE__ = window.__NESTLED_BURROW_E2E__;
    window.__NESTLED_BURROW_E2E__.newGame();
  });
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__)
    && window.__NESTLED_BURROW_E2E__ !== window.__AUTHORING_TEST_OLD_BRIDGE__);

  await expect.poll(() => getFacilityPositions(page)).toMatchObject(expected);
  await expect.poll(() => page.evaluate(
    (storageKey) => localStorage.getItem(storageKey),
    STARTING_LAYOUT_STORAGE_KEY,
  )).not.toBeNull();
});
