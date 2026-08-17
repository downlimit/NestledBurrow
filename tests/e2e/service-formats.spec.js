import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

async function bridge(page, method, argument) {
  return page.evaluate(({ method, argument }) => window.__NESTLED_BURROW_E2E__?.[method]?.(argument), { method, argument });
}

async function advanceUntil(page, read, predicate, { maxMs = 35_000, stepMs = 250 } = {}) {
  for (let elapsedMs = 0; elapsedMs <= maxMs; elapsedMs += stepMs) {
    const value = await read();
    if (predicate(value)) return value;
    await bridge(page, "advanceWorldSimulation", stepMs);
  }
  const value = await read();
  expect(predicate(value)).toBe(true);
  return value;
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

async function openTavern(page) {
  await expect.poll(async () => {
    await bridge(page, "placePlayerNear", "tavern-open-sign");
    return (await bridge(page, "getInteractionState"))?.candidate?.entityId;
  }).toBe("tavern-open-sign");
  await bridge(page, "interact");
  await expect.poll(async () => (await bridge(page, "getTavernState")).menu?.active).toBe(true);
  const canvas = await page.locator("canvas").boundingBox();
  if (!canvas) throw new Error("Game canvas is unavailable");
  await page.mouse.click(canvas.x + 268 * canvas.width / 640, canvas.y + 220 * canvas.height / 360);
  await expect.poll(async () => (await bridge(page, "getTavernState")).open).toBe(true);
  await page.mouse.click(canvas.x + 12 * canvas.width / 640, canvas.y + 90 * canvas.height / 360);
  await expect.poll(async () => (await bridge(page, "getTavernState")).menu?.active).toBe(false);
}

async function expectSingleCompletedOutcome(page, personId) {
  await advanceUntil(
    page,
    async () => ({
      history: (await bridge(page, "getVisitorHistory"))[personId]?.completedVisitCount ?? 0,
      feedback: (await bridge(page, "getTavernFeedback")).venueOpinionsByPersonId[personId]?.completedVisitCount ?? 0,
    }),
    ({ history, feedback }) => history === 1 && feedback === 1,
  );
  await bridge(page, "advanceWorldSimulation", 2_000);
  expect((await bridge(page, "getVisitorHistory"))[personId].completedVisitCount).toBe(1);
  expect((await bridge(page, "getTavernFeedback")).venueOpinionsByPersonId[personId].completedVisitCount).toBe(1);
}

test("fried potato keeps the assisted dine-in order path", async ({ page }) => {
  await bootFresh(page);
  await openTavern(page);
  const personId = (await bridge(page, "getPopulation"))[0].id;
  const guestId = await bridge(page, "forceGuestOrder", {
    personId,
    itemId: "fried-potato-dish",
    serviceFormat: "assisted",
  });
  await advanceUntil(
    page,
    async () => bridge(page, "getGuestOrder", guestId),
    (guest) => guest?.order.status === "offered",
  );
  expect(await bridge(page, "getGuestOrder", guestId)).toMatchObject({
    serviceFormat: "assisted",
    servicePlaceActive: true,
    order: { itemId: "fried-potato-dish", status: "offered" },
  });
  expect(await bridge(page, "acceptGuestOrder", guestId)).toMatchObject({ status: "order-accepted" });
  await bridge(page, "setServingStock", { itemId: "fried-potato-dish", quantity: 1 });
  await advanceUntil(
    page,
    async () => (await bridge(page, "getTavernState")).guest.guests.find(({ id }) => id === guestId)?.state,
    (state) => state === "eating",
  );
  expect((await bridge(page, "getGuestOrder", guestId)).serviceFormat).toBe("assisted");
  await expectSingleCompletedOutcome(page, personId);
});

test("lemonade selects takeaway, releases the handoff place and survives reload", async ({ page }) => {
  await bootFresh(page);
  await openTavern(page);
  const personId = (await bridge(page, "getPopulation"))[0].id;
  await bridge(page, "setPopulationPersonDemand", {
    personId,
    needs: { novelty: 100, energy: 100, satiety: 20, toilet: 100, lustre: 100, dialogue: 100 },
  });
  const guestId = await bridge(page, "forceGuestOrder", {
    personId,
    itemId: "lemonade",
    serviceFormat: "auto",
  });
  await advanceUntil(
    page,
    async () => bridge(page, "getGuestOrder", guestId),
    (guest) => guest?.order.status === "offered",
  );
  expect((await bridge(page, "getGuestOrder", guestId)).serviceFormat).toBe("takeaway");
  expect(await bridge(page, "acceptGuestOrder", guestId)).toMatchObject({ status: "order-accepted" });
  await bridge(page, "advanceWorldSimulation", 1);
  await bridge(page, "saveSession");
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  expect(await bridge(page, "getGuestOrder", guestId)).toMatchObject({
    serviceFormat: "takeaway",
    servicePlaceActive: true,
    order: { itemId: "lemonade", status: "accepted" },
  });
  await bridge(page, "setServingStock", { itemId: "lemonade", quantity: 1 });
  await advanceUntil(
    page,
    async () => bridge(page, "getGuestOrder", guestId),
    (guest) => guest?.servicePlaceActive === false && ["served", "completed"].includes(guest.order.status),
  );
  const liveGuest = (await bridge(page, "getTavernState")).guest.guests.find(({ id }) => id === guestId);
  expect(liveGuest.serviceFormat).toBe("takeaway");
  expect(liveGuest.state).not.toBe("drinking");
  await expectSingleCompletedOutcome(page, personId);
});

test("pre-set exact food is captured once through self-service without take-order", async ({ page }) => {
  await bootFresh(page);
  await bridge(page, "setServingStock", { itemId: "fried-potato-dish", quantity: 1 });
  await openTavern(page);
  const [firstPerson, secondPerson] = (await bridge(page, "getPopulation")).slice(0, 2);
  const firstGuestId = await bridge(page, "forceGuestOrder", {
    personId: firstPerson.id,
    itemId: "fried-potato-dish",
    serviceFormat: "auto",
  });
  const secondGuestId = await bridge(page, "forceGuestOrder", {
    personId: secondPerson.id,
    itemId: "fried-potato-dish",
    serviceFormat: "auto",
  });
  await advanceUntil(
    page,
    async () => bridge(page, "getGuestOrder", firstGuestId),
    (guest) => guest?.serviceFormat === "self-service",
  );
  expect(await bridge(page, "acceptGuestOrder", firstGuestId)).toMatchObject({ status: "order-not-offered" });
  const stock = (await bridge(page, "getSession")).gameplay.kitchen.servingTables["home-serving-table-01"];
  expect(stock.reservations).toEqual([{ guestId: firstGuestId, itemId: "fried-potato-dish" }]);
  expect(stock.reservations.some(({ guestId }) => guestId === secondGuestId)).toBe(false);
  await expectSingleCompletedOutcome(page, firstPerson.id);
  expect((await bridge(page, "getVisitorHistory"))[secondPerson.id]?.completedVisitCount ?? 0).toBe(0);
});
