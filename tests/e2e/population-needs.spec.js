import { expect, test } from "@playwright/test";

test.setTimeout(45_000);

async function bridge(page, method, argument) {
  return page.evaluate(({ method, argument }) => window.__NESTLED_BURROW_E2E__?.[method]?.(argument), { method, argument });
}

async function bootFresh(page) {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto("./?movementDebug=1");
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  await page.evaluate(async () => {
    const previous = window.__NESTLED_BURROW_E2E__;
    previous.newGame();
    await new Promise((resolve) => {
      const check = () => window.__NESTLED_BURROW_E2E__ !== previous ? resolve() : requestAnimationFrame(check);
      requestAnimationFrame(check);
    });
  });
}

test("persistent people survive reload and evaluate at current world time", async ({ page }) => {
  await bootFresh(page);
  const population = await bridge(page, "getPopulation");
  expect(population).toHaveLength(300);
  const person = population[0];
  expect(await bridge(page, "getPopulationPerson", person.id)).toEqual(person);

  expect((await bridge(page, "saveSession")).status).toBe("saved");
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  expect(await bridge(page, "getPopulation")).toEqual(population);

  const session = await bridge(page, "getSession");
  const targetTime = session.gameplay.worldTimeSeconds + 6 * 60 * 60;
  const { evaluated, repeated } = await page.evaluate(({ personId, targetWorldTimeSeconds }) => {
    const api = window.__NESTLED_BURROW_E2E__;
    api.setWorldTimeSeconds(targetWorldTimeSeconds);
    return {
      evaluated: api.evaluatePopulationPerson(personId),
      repeated: api.evaluatePopulationPerson(personId),
    };
  }, { personId: person.id, targetWorldTimeSeconds: targetTime });
  expect(evaluated.status).toBe("evaluated");
  expect(evaluated.person.lastEvaluatedWorldTimeSeconds).toBe(targetTime);
  expect(evaluated.person.needs).not.toEqual(person.needs);

  expect(repeated.status).toBe("unchanged");
  expect(repeated.person).toEqual(evaluated.person);
  expect(await bridge(page, "getPopulationPerson", person.id)).toEqual(evaluated.person);
});
