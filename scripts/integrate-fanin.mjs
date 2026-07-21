import { readFileSync, writeFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const write = (path, content) => writeFileSync(path, content, "utf8");
const replaceExact = (text, from, to, label) => {
  if (!text.includes(from)) throw new Error(`Missing integration anchor: ${label}`);
  return text.replace(from, to);
};

let main = read("src/main.js");
main = replaceExact(
  main,
  'import { createRuntimeMovementConfig } from "./characterMovement.js";',
  'import { createMovementState, createRuntimeMovementConfig } from "./characterMovement.js";',
  "movement import",
);
main = replaceExact(
  main,
  'import { createGameSessionState } from "./gameSessionState.js";',
  'import { createFreshGameSessionState } from "./gameSessionState.js";',
  "session import",
);
main = replaceExact(
  main,
  'import { createInteractionHud } from "./interactionHud.js";\nimport { createGameHud } from "./gameHud.js";',
  'import { createInteractionHud } from "./interactionHud.js";\nimport { createGameHud } from "./gameHud.js";\nimport {\n  completeNeighborDialogue,\n  NEIGHBOR_DIALOGUE_RESOLVER_ID,\n  resolveNeighborDialogueId,\n} from "./neighborQuest.js";\nimport { createSessionPersistence } from "./sessionPersistence.js";',
  "fan-in imports",
);
main = replaceExact(
  main,
  '    this.createJoystick();\n    this.syncIntegerZoom();',
  '    this.createJoystick();\n    this.syncIntegerZoom();\n    this.installE2EBridge();',
  "bridge create",
);
main = replaceExact(
  main,
  `  createSessionAndInteractionRuntime() {
    this.sessionState = createGameSessionState({
      currentWorldId: "village",
      playerId: "player",
      initialEntityIds: NPCS.map((npc) => npc.id),
    });
    this.interactionHud = createInteractionHud(this, {
      isCoarsePointer: () => this.isCoarsePointer(),
      localization: this.localization,
    });
    this.interactionRuntime = createInteractionRuntime({
      sessionState: this.sessionState,
      characterSystem: this.characterSystem,
      interactionDefinitions: INTERACTION_DEFINITIONS,
      getDialogueDefinition,
      presenter: this.interactionHud,
    });
  }`,
  `  createSessionAndInteractionRuntime() {
    this.sessionPersistence = this.createPersistence();
    const loaded = this.sessionPersistence?.load();
    this.sessionState = loaded?.state ?? createFreshGameSessionState({
      currentWorldId: "village",
      playerId: "player",
      initialEntityIds: NPCS.map((npc) => npc.id),
    });
    if (loaded?.diagnostic) {
      console.warn("Recovered NestledBurrow session", loaded.diagnostic);
    }
    this.interactionHud = createInteractionHud(this, {
      isCoarsePointer: () => this.isCoarsePointer(),
      localization: this.localization,
    });
    this.interactionRuntime = createInteractionRuntime({
      sessionState: this.sessionState,
      characterSystem: this.characterSystem,
      interactionDefinitions: INTERACTION_DEFINITIONS,
      getDialogueDefinition,
      resolveDialogueId: (resolverId, state, entityId) => {
        if (resolverId !== NEIGHBOR_DIALOGUE_RESOLVER_ID) {
          throw new Error(\`Unknown dialogue resolver ID: \${resolverId}\`);
        }
        return resolveNeighborDialogueId(state, entityId);
      },
      completeDialogue: completeNeighborDialogue,
      onPersistentMutation: () => this.saveSession(),
      presenter: this.interactionHud,
    });
  }

  createPersistence() {
    try {
      return createSessionPersistence({ storage: window.localStorage });
    } catch (error) {
      console.warn("Session persistence unavailable", error);
      return null;
    }
  }

  saveSession() {
    const result = this.sessionPersistence?.save(this.sessionState);
    if (result?.status === "error") console.warn("Session save failed", result.diagnostic);
    return result;
  }`,
  "session runtime",
);
main = replaceExact(
  main,
  '      onLanguageChange: () => this.interactionRuntime?.refresh?.(),\n    });',
  '      onLanguageChange: () => this.interactionRuntime?.refresh?.(),\n      onNewGame: () => this.startNewGame(),\n    });',
  "new game callback",
);
main = replaceExact(
  main,
  `  isCoarsePointer() {
    return window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  }`,
  `  startNewGame() {
    const result = this.sessionPersistence?.clear();
    if (result?.status === "error") console.warn("Session reset failed", result.diagnostic);
    this.scene.restart();
  }

  installE2EBridge() {
    if (!import.meta.env.VITE_E2E) return;
    const bridge = {
      getSession: () => JSON.parse(JSON.stringify(this.sessionState)),
      getLanguage: () => this.localization.getLanguage(),
      setLanguage: async (language) => {
        await this.localization.changeLanguage(language);
        this.gameHud?.render();
        this.interactionRuntime?.refresh();
      },
      placePlayerNear: (entityId) => {
        const target = this.characterSystem.getSnapshot(entityId);
        const player = this.characterSystem.require(this.sessionState.playerId);
        player.motor.position = { x: target.position.x - 12, y: target.position.y };
        player.motor.movement = createMovementState({ facing: { x: 1, y: 0 } });
      },
      getInteractionState: () => ({
        candidate: this.interactionRuntime?.getCurrentCandidate() ?? null,
        dialogueActive: this.interactionRuntime?.isDialogueActive() ?? false,
        dialogue: { ...this.sessionState.dialogue },
      }),
      getHudState: () => ({ newGameConfirming: this.gameHud?.isConfirming?.() ?? false }),
    };
    this.e2eBridge = bridge;
    window.__NESTLED_BURROW_E2E__ = bridge;
  }

  isCoarsePointer() {
    return window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  }`,
  "new game and bridge methods",
);
main = replaceExact(
  main,
  `    this.gameHud?.destroy();
    this.gameHud = null;
  }`,
  `    this.gameHud?.destroy();
    this.gameHud = null;
    if (window.__NESTLED_BURROW_E2E__ === this.e2eBridge) {
      delete window.__NESTLED_BURROW_E2E__;
    }
    this.e2eBridge = null;
  }`,
  "bridge cleanup",
);
write("src/main.js", main);

for (const locale of ["en", "ru"]) {
  const dialoguePath = `public/locales/${locale}/dialogue.json`;
  const dialogue = JSON.parse(read(dialoguePath));
  dialogue.neighbor = locale === "en"
    ? {
        speakers: { home: "Mira", street: "Rowan" },
        homeIntro: { first: "Could you check on Rowan by the road?", second: "Come back after you have spoken." },
        homeReminder: { first: "Rowan is usually near the path outside." },
        homeCompletion: { first: "You found Rowan. Thank you.", second: "The village feels a little less quiet now." },
        homeAfter: { first: "Thank you again for helping us." },
        streetBefore: { first: "Hello. Did Mira send you?" },
        streetResponse: { first: "Tell Mira I am all right.", second: "I will return home before dark." },
        streetAfter: { first: "Mira is waiting for your news." },
      }
    : {
        speakers: { home: "Мира", street: "Роуэн" },
        homeIntro: { first: "Проверь, пожалуйста, как там Роуэн у дороги.", second: "Возвращайся, когда поговоришь с ним." },
        homeReminder: { first: "Роуэн обычно стоит у тропинки снаружи." },
        homeCompletion: { first: "Ты нашёл Роуэна. Спасибо.", second: "Теперь деревня кажется чуть менее тихой." },
        homeAfter: { first: "Ещё раз спасибо за помощь." },
        streetBefore: { first: "Привет. Тебя прислала Мира?" },
        streetResponse: { first: "Скажи Мире, что со мной всё хорошо.", second: "Я вернусь домой до темноты." },
        streetAfter: { first: "Мира ждёт твоих новостей." },
      };
  write(dialoguePath, JSON.stringify(dialogue, null, 2) + "\n");

  const hudPath = `public/locales/${locale}/hud.json`;
  const hud = JSON.parse(read(hudPath));
  hud.progress = locale === "en"
    ? { newGame: "New game", confirmNewGame: "Erase saved quest progress and begin again?", confirm: "Start over", cancel: "Cancel" }
    : { newGame: "Новая игра", confirmNewGame: "Удалить сохранённый прогресс и начать заново?", confirm: "Начать", cancel: "Отмена" };
  write(hudPath, JSON.stringify(hud, null, 2) + "\n");
}

write("scripts/check-dialogue.mjs", `import assert from "node:assert/strict";
import { DIALOGUE_DEFINITIONS, getDialogueDefinition } from "../src/dialogueConfig.js";
import { createFreshGameSessionState, getSessionFlag } from "../src/gameSessionState.js";
import { INTERACTION_DEFINITIONS } from "../src/interactionConfig.js";
import { createInteractionRuntime } from "../src/interactionRuntime.js";
import {
  completeNeighborDialogue,
  getNeighborQuestStage,
  NEIGHBOR_DIALOGUE_IDS,
  NEIGHBOR_DIALOGUE_RESOLVER_ID,
  NEIGHBOR_QUEST_FLAGS,
  NEIGHBOR_QUEST_STAGES,
  resolveNeighborDialogueId,
} from "../src/neighborQuest.js";

assert.deepEqual(Object.keys(DIALOGUE_DEFINITIONS).sort(), Object.values(NEIGHBOR_DIALOGUE_IDS).sort(), "all quest dialogue IDs have definitions");
for (const definition of Object.values(DIALOGUE_DEFINITIONS)) {
  assert(Object.isFrozen(definition), \`\${definition.id} definition is immutable\`);
  assert(Object.isFrozen(definition.lines), \`\${definition.id} lines are immutable\`);
  assert(definition.speakerKey.startsWith("dialogue:neighbor."), \`\${definition.id} speaker uses localization key\`);
  assert(definition.lines.every((line) => line.textKey.startsWith("dialogue:neighbor.")), \`\${definition.id} lines use localization keys\`);
}
for (const inheritedId of ["__proto__", "constructor", "toString"]) {
  assert.throws(() => getDialogueDefinition(inheritedId), /Unknown dialogue definition ID/, \`inherited key \${inheritedId} is rejected\`);
}
assert.equal(INTERACTION_DEFINITIONS.length, 2, "home and street NPC both expose dialogue interactions");
assert(INTERACTION_DEFINITIONS.every((definition) => definition.payload.dialogueResolverId === NEIGHBOR_DIALOGUE_RESOLVER_ID), "both interactions use the canonical resolver ID");

const snapshots = new Map([
  ["player", { id: "player", position: { x: 0, y: 0 }, facingDirection: { x: 1, y: 0 } }],
  ["home-npc", { id: "home-npc", position: { x: 10, y: 0 }, facingDirection: { x: -1, y: 0 } }],
  ["street-npc", { id: "street-npc", position: { x: 100, y: 0 }, facingDirection: { x: -1, y: 0 } }],
]);
const characterSystem = {
  getSnapshot(id) { return snapshots.get(id); },
  set(id, snapshot) { snapshots.set(id, snapshot); },
};
const presenter = {
  prompts: [], dialogues: [], hiddenPrompts: 0, hiddenDialogues: 0,
  showPrompt(value) { this.prompts.push(value); },
  hidePrompt() { this.hiddenPrompts += 1; },
  showDialogue(value) { this.dialogues.push(value); },
  hideDialogue() { this.hiddenDialogues += 1; },
};
const session = createFreshGameSessionState();
const saves = [];
const runtime = createInteractionRuntime({
  sessionState: session,
  characterSystem,
  interactionDefinitions: INTERACTION_DEFINITIONS,
  getDialogueDefinition,
  resolveDialogueId(resolverId, state, entityId) {
    assert.equal(resolverId, NEIGHBOR_DIALOGUE_RESOLVER_ID, "runtime receives canonical resolver ID");
    return resolveNeighborDialogueId(state, entityId);
  },
  completeDialogue: completeNeighborDialogue,
  onPersistentMutation(event) { saves.push(event); },
  presenter,
});

function placeNear(entityId) {
  const target = snapshots.get(entityId);
  characterSystem.set("player", { id: "player", position: { x: target.position.x - 10, y: target.position.y }, facingDirection: { x: 1, y: 0 } });
  runtime.update({ actions: { interact: false } });
  assert.equal(runtime.getCurrentCandidate().entityId, entityId, \`\${entityId} becomes current candidate\`);
  assert.equal(presenter.prompts.at(-1).promptKey, "hud:interaction.talk", "presenter receives localized prompt key");
}
function completeCurrentDialogue() {
  runtime.update({ actions: { interact: true } });
  assert(runtime.isDialogueActive(), "interaction starts dialogue");
  while (runtime.isDialogueActive()) runtime.update({ actions: { interact: true } });
}

placeNear("home-npc");
completeCurrentDialogue();
assert.equal(getNeighborQuestStage(session), NEIGHBOR_QUEST_STAGES.talkToStreet, "home intro starts quest");
assert(getSessionFlag(session, NEIGHBOR_QUEST_FLAGS.started), "started flag is durable");
assert.equal(saves.length, 1, "first persistent transition saves once");
assert(presenter.dialogues.at(-1).speakerKey.startsWith("dialogue:neighbor."), "presenter receives speaker descriptor rather than rendered text");

placeNear("street-npc");
completeCurrentDialogue();
assert.equal(getNeighborQuestStage(session), NEIGHBOR_QUEST_STAGES.returnHome, "street response advances quest");
assert(getSessionFlag(session, NEIGHBOR_QUEST_FLAGS.streetAnswered), "street response flag is durable");
assert.equal(saves.length, 2, "second persistent transition saves once");

placeNear("home-npc");
completeCurrentDialogue();
assert.equal(getNeighborQuestStage(session), NEIGHBOR_QUEST_STAGES.completed, "return home completes quest");
assert(getSessionFlag(session, NEIGHBOR_QUEST_FLAGS.completed), "completed flag is durable");
assert.equal(saves.length, 3, "third persistent transition saves once");

placeNear("home-npc");
completeCurrentDialogue();
assert.equal(saves.length, 3, "repeat dialogue does not write unchanged progress");
assert.deepEqual(JSON.parse(JSON.stringify(session)), session, "session remains JSON serializable after full loop");
runtime.destroy();
runtime.destroy();
assert.equal(runtime.getCurrentCandidate(), null, "destroy is idempotent");
console.log("dialogue checks passed: localized neighbor quest runtime, effects and autosave hooks are aligned");
`);

write("scripts/check-hud.mjs", `import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BUILD_LABEL, FULLSCREEN_HIT_AREA, HUD_GLYPHS, compactBuildLabel, isPointInRect, measureBitmapText } from "../src/hud.js";
import {
  LANGUAGE_HIT_AREA,
  NEW_GAME_CANCEL_HIT_AREA,
  NEW_GAME_CONFIRM_HIT_AREA,
  NEW_GAME_CONFIRM_PANEL,
  NEW_GAME_HIT_AREA,
} from "../src/gameHud.js";
import { GAME_HEIGHT, GAME_WIDTH } from "../src/worldConfig.js";

assert.equal(compactBuildLabel("4e090db123"), "v 4e090db", "HUD uses compact canonical short build identifier");
assert.equal(measureBitmapText("v 4e090db"), 51, "bitmap label width is deterministic for alignment");
assert(Number.isInteger(BUILD_LABEL.x) && Number.isInteger(BUILD_LABEL.y), "build label aligns to whole logical pixels");
assert.equal(FULLSCREEN_HIT_AREA.width, 30, "fullscreen hit area remains touch sized");
assert(NEW_GAME_HIT_AREA.x + NEW_GAME_HIT_AREA.width < LANGUAGE_HIT_AREA.x, "New Game and language hit areas do not overlap");
assert(LANGUAGE_HIT_AREA.x + LANGUAGE_HIT_AREA.width <= FULLSCREEN_HIT_AREA.x, "language and fullscreen hit areas do not overlap");
for (const rect of [NEW_GAME_HIT_AREA, LANGUAGE_HIT_AREA, NEW_GAME_CONFIRM_PANEL, NEW_GAME_CONFIRM_HIT_AREA, NEW_GAME_CANCEL_HIT_AREA]) {
  assert(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= GAME_WIDTH && rect.y + rect.height <= GAME_HEIGHT, "GameHud rectangle stays inside logical viewport");
}
assert(isPointInRect(NEW_GAME_CONFIRM_HIT_AREA.x + 2, NEW_GAME_CONFIRM_HIT_AREA.y + 2, NEW_GAME_CONFIRM_PANEL), "confirm action stays inside confirmation panel");
assert(isPointInRect(NEW_GAME_CANCEL_HIT_AREA.x + 2, NEW_GAME_CANCEL_HIT_AREA.y + 2, NEW_GAME_CONFIRM_PANEL), "cancel action stays inside confirmation panel");
for (const char of "v devabcdef0123456789") assert(HUD_GLYPHS[char], \`bitmap glyph exists for \${char}\`);
const main = readFileSync("src/main.js", "utf8");
const gameHud = readFileSync("src/gameHud.js", "utf8");
assert(main.includes("onNewGame: () => this.startNewGame()"), "composition root wires New Game callback");
assert(main.includes("isExcludedPoint: (x, y) => this.isHudPoint(x, y)"), "all HUD areas exclude MobileJoystick input");
assert(gameHud.includes("localization.t(\"hud:progress.newGame\")"), "New Game label is localized");
assert(gameHud.includes("fontFamily: localization.getLocale().fontKey"), "localized HUD text uses locale Unicode font");
assert(gameHud.includes("isConfirming()"), "GameHud exposes deterministic confirmation state");
console.log("hud checks passed: build, fullscreen, language and localized New Game controls are aligned");
`);

const packageJson = JSON.parse(read("package.json"));
packageJson.scripts.check = packageJson.scripts.check
  .replace("npm run check:dialogue &&", "npm run check:dialogue && npm run check:progress && npm run check:i18n &&");
packageJson.scripts["check:progress"] = "node scripts/check-progress.mjs";
packageJson.scripts["check:e2e"] = "playwright test";
packageJson.devDependencies["@playwright/test"] = "1.54.2";
write("package.json", JSON.stringify(packageJson, null, 2) + "\n");

write("playwright.config.js", `import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "artifacts/playwright-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173/NestledBurrow/",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/NestledBurrow/",
    reuseExistingServer: !process.env.CI,
    env: { ...process.env, VITE_E2E: "1" },
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], locale: "en-US" } },
    { name: "mobile-chromium", use: { ...devices["Pixel 5"], locale: "ru-RU" } },
  ],
});
`);

write("tests/e2e/localized-loop.spec.js", `import { expect, test } from "@playwright/test";

async function boot(page) {
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
}
async function bridge(page, expression, argument) {
  return page.evaluate(({ expression, argument }) => {
    const api = window.__NESTLED_BURROW_E2E__;
    return api[expression](argument);
  }, { expression, argument });
}
async function placeNear(page, entityId) {
  await bridge(page, "placePlayerNear", entityId);
  await expect.poll(() => page.evaluate(() => window.__NESTLED_BURROW_E2E__.getInteractionState().candidate?.entityId)).toBe(entityId);
}
async function completeDialogue(page, entityId) {
  await placeNear(page, entityId);
  await page.keyboard.press("KeyE");
  await expect.poll(() => page.evaluate(() => window.__NESTLED_BURROW_E2E__.getInteractionState().dialogueActive)).toBe(true);
  while (await page.evaluate(() => window.__NESTLED_BURROW_E2E__.getInteractionState().dialogueActive)) {
    await page.keyboard.press("KeyE");
  }
}
async function clickLogical(page, x, y) {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Game canvas is unavailable");
  await page.mouse.click(box.x + x * box.width / 320, box.y + y * box.height / 180);
}

test("locale detection and saved preference survive reload", async ({ page }, testInfo) => {
  await boot(page);
  const expected = testInfo.project.name.startsWith("mobile") ? "ru" : "en";
  await expect.poll(() => bridge(page, "getLanguage")).toBe(expected);
  await bridge(page, "setLanguage", "en");
  await page.reload();
  await boot(page);
  await expect.poll(() => bridge(page, "getLanguage")).toBe("en");
});

test("localized quest progress persists and New Game keeps language", async ({ page }) => {
  await boot(page);
  await completeDialogue(page, "home-npc");
  await expect.poll(() => bridge(page, "getSession")).toMatchObject({ flags: { "neighborQuest.started": true } });
  await completeDialogue(page, "street-npc");
  await completeDialogue(page, "home-npc");
  await expect.poll(() => bridge(page, "getSession")).toMatchObject({ flags: {
    "neighborQuest.started": true,
    "neighborQuest.streetAnswered": true,
    "neighborQuest.completed": true,
  } });
  await page.reload();
  await boot(page);
  await expect.poll(() => bridge(page, "getSession")).toMatchObject({ flags: { "neighborQuest.completed": true } });
  await bridge(page, "setLanguage", "ru");
  await clickLogical(page, 24, 18);
  await expect.poll(() => bridge(page, "getHudState")).toMatchObject({ newGameConfirming: true });
  await clickLogical(page, 92, 111);
  await page.waitForFunction(() => Boolean(window.__NESTLED_BURROW_E2E__));
  await expect.poll(() => bridge(page, "getSession")).toMatchObject({ flags: {} });
  await expect.poll(() => bridge(page, "getLanguage")).toBe("ru");
});

test("mobile touch starts a Russian dialogue without joystick capture", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "mobile project only");
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await boot(page);
  await bridge(page, "setLanguage", "ru");
  await placeNear(page, "home-npc");
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Game canvas is unavailable");
  await page.touchscreen.tap(box.x + 280 * box.width / 320, box.y + 158 * box.height / 180);
  await expect.poll(() => page.evaluate(() => window.__NESTLED_BURROW_E2E__.getInteractionState().dialogueActive)).toBe(true);
  await expect.poll(() => bridge(page, "getLanguage")).toBe("ru");
  expect(pageErrors).toEqual([]);
});
`);

console.log("fan-in integration files written");
