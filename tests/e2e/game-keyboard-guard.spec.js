import { expect, test } from "@playwright/test";

async function bridge(page, method, argument) {
  return page.evaluate(({ method, argument }) => window.__NESTLED_BURROW_E2E__?.[method]?.(argument), { method, argument });
}

async function boot(page) {
  await page.setViewportSize({ width: 320, height: 180 });
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  await expect(page.locator("canvas")).toHaveJSProperty("width", 320);
}

async function nextKeydownDefaultPrevented(page, key) {
  await page.evaluate(() => {
    window.__NESTLED_BURROW_LAST_KEYDOWN__ = null;
    window.addEventListener("keydown", (event) => {
      window.__NESTLED_BURROW_LAST_KEYDOWN__ = {
        code: event.code,
        defaultPrevented: event.defaultPrevented,
      };
    }, { once: true });
  });
  await page.keyboard.down(key);
  return page.evaluate(() => window.__NESTLED_BURROW_LAST_KEYDOWN__);
}

test("held Alt plus D keeps moving right without browser shortcut takeover", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "physical keyboard guard is desktop-only");
  await boot(page);

  const playerId = (await bridge(page, "getSession")).playerId;
  const before = await bridge(page, "getCharacterSnapshot", playerId);

  await page.keyboard.down("Alt");
  const keydown = await nextKeydownDefaultPrevented(page, "KeyD");
  expect(keydown).toMatchObject({ code: "KeyD", defaultPrevented: true });
  await page.waitForTimeout(350);
  await page.keyboard.up("KeyD");
  await page.keyboard.up("Alt");

  const after = await bridge(page, "getCharacterSnapshot", playerId);
  expect(after.position.x).toBeGreaterThan(before.position.x + 1);
  expect(page.url()).toContain("/");
});

test("held Tab stays inside the game instead of advancing browser focus", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "physical keyboard guard is desktop-only");
  await boot(page);

  await page.evaluate(() => {
    const first = document.createElement("button");
    first.id = "keyboard-guard-first";
    const second = document.createElement("button");
    second.id = "keyboard-guard-second";
    document.body.append(first, second);
    first.focus();
  });

  const keydown = await nextKeydownDefaultPrevented(page, "Tab");
  expect(keydown).toMatchObject({ code: "Tab", defaultPrevented: true });
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe("keyboard-guard-first");
  await page.keyboard.up("Tab");
});
