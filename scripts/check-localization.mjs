import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DIALOGUE_DEFINITIONS } from "../src/interaction/dialogueConfig.js";
import { INTERACTION_DEFINITIONS } from "../src/interaction/interactionConfig.js";
import { createGameSessionState } from "../src/session/gameSessionState.js";
import { FALLBACK_LANGUAGE, LOCALIZATION_NAMESPACES, SUPPORTED_LOCALES, normalizeLanguageCode } from "../src/localization/locales.js";
import { WILD_ATOLL_LOCALIZATION_KEYS } from "../src/world/wildAtollDomain.js";

const root = "public/locales";
function flatten(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object" && !Array.isArray(v) ? flatten(v, key) : [[key, v]];
  });
}
function read(locale, ns) { return JSON.parse(readFileSync(join(root, locale, `${ns}.json`), "utf8")); }
const primary = new Map();
for (const ns of LOCALIZATION_NAMESPACES) primary.set(ns, new Map(flatten(read(FALLBACK_LANGUAGE, ns))));
assert.deepEqual(readdirSync(root).sort(), [...SUPPORTED_LOCALES].sort(), "only supported locale directories exist");
for (const locale of SUPPORTED_LOCALES) {
  assert.deepEqual(readdirSync(join(root, locale)).sort(), LOCALIZATION_NAMESPACES.map((ns) => `${ns}.json`).sort(), `${locale} namespace parity`);
  for (const ns of LOCALIZATION_NAMESPACES) {
    const entries = new Map(flatten(read(locale, ns)));
    assert.deepEqual([...entries.keys()].sort(), [...primary.get(ns).keys()].sort(), `${locale}/${ns} keys match fallback`);
    for (const [key, value] of entries) {
      assert(typeof value === "string" && value.trim(), `${locale}/${ns}:${key} is non-empty text`);
      assert(!/[—–]/u.test(value), `${locale}/${ns}:${key} uses the supported ASCII hyphen instead of a typographic dash`);
    }
  }
}
function assertKey(ref) { const [ns, key] = ref.split(":"); assert(primary.get(ns)?.has(key), `fallback contains ${ref}`); }
for (const dialogue of Object.values(DIALOGUE_DEFINITIONS)) { assertKey(dialogue.speakerKey); for (const line of dialogue.lines) assertKey(line.textKey); }
for (const definition of INTERACTION_DEFINITIONS) assertKey(definition.promptKey);
for (const key of WILD_ATOLL_LOCALIZATION_KEYS) assertKey(key);
assertKey("hud:interaction.next"); assertKey("hud:interaction.close");
assert.equal(FALLBACK_LANGUAGE, "ru", "clean storage fallback locale is Russian"); assert.equal(normalizeLanguageCode("en-US"), "en"); assert.equal(normalizeLanguageCode("ru-RU"), "ru"); assert.equal(normalizeLanguageCode("fr-FR"), "ru");
assert(!("language" in createGameSessionState()), "GameSessionState does not contain language preference");
function bracesAreBalanced(message) {
  let depth = 0;
  for (const char of message) {
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    assert(depth >= 0, `ICU braces underflow in ${message}`);
  }
  assert.equal(depth, 0, `ICU braces balance in ${message}`);
}
for (const locale of SUPPORTED_LOCALES) {
  const d = read(locale, "dialogue");
  bracesAreBalanced(d.validation.itemCount);
  bracesAreBalanced(d.validation.visitorMood);
  assert(d.validation.itemCount.includes("plural"), `${locale} representative plural exists`);
  assert(d.validation.visitorMood.includes("select"), `${locale} representative select exists`);
  const atollEntries = flatten(read(locale, "hud").atoll);
  for (const [key, value] of atollEntries) {
    assert(!value.includes("?"), `${locale}/hud:atoll.${key} does not substitute a question mark for a dash`);
    assert(value.length <= 40, `${locale}/hud:atoll.${key} stays within the compact HUD text budget`);
    assert(!/^(?:hud:)?atoll\./.test(value), `${locale}/hud:atoll.${key} is player text, not a technical key`);
  }
}
for (const file of ["src/interaction/dialogueConfig.js", "src/interaction/interactionConfig.js", "src/interaction/interactionRuntime.js", "src/ui/interactionHud.js"]) {
  const text = readFileSync(file, "utf8");
  for (const literal of ["TALK", "NEXT", "CLOSE", "HELLO THERE", "THE VILLAGE IS QUIET", "SEE YOU AROUND", "HOME NPC"]) {
    assert(!text.includes(literal), `${file} has no user-facing English literal ${literal}`);
  }
}
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
assert.equal(pkg.dependencies["@fontsource/pixelify-sans"], "5.2.7", "Pixelify Sans is pinned as an npm dependency");
assert.equal(lock.packages["node_modules/@fontsource/pixelify-sans"].version, "5.2.7", "Pixelify Sans lockfile entry is pinned");
const mainSource = readFileSync("src/main.js", "utf8");
assert(mainSource.includes('import "@fontsource/pixelify-sans/latin.css"'), "Pixelify Sans Latin CSS is imported from the package");
assert(mainSource.includes('import "@fontsource/pixelify-sans/cyrillic.css"'), "Pixelify Sans Cyrillic CSS is imported from the package");
for (const forbidden of [".ttf", ".otf", ".woff", ".woff2"]) {
  assert(!mainSource.includes(`public/assets/fonts/pixelify-sans`) && !mainSource.includes(forbidden), `runtime does not reference committed font binary ${forbidden}`);
}
const localizationSource = readFileSync("src/localization/index.js", "utf8");
assert(localizationSource.includes("VITE_BUILD_ID"), "locale requests are versioned by the current build");
assert(localizationSource.includes("{{ns}}.json?v="), "locale backend bypasses stale preview caches");
for (const locale of SUPPORTED_LOCALES) {
  const hud = read(locale, "hud");
  assert.equal(hud.language.current, locale.toUpperCase(), `${locale} language button exposes only current language code`);
}

console.log("localization checks passed");
