import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DIALOGUE_DEFINITIONS } from "../src/dialogueConfig.js";
import { INTERACTION_DEFINITIONS } from "../src/interactionConfig.js";
import { createGameSessionState } from "../src/gameSessionState.js";
import { LOCALIZATION_NAMESPACES, SUPPORTED_LOCALES, normalizeLanguageCode } from "../src/localization/locales.js";

const root = "public/locales";
function flatten(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object" && !Array.isArray(v) ? flatten(v, key) : [[key, v]];
  });
}
function read(locale, ns) { return JSON.parse(readFileSync(join(root, locale, `${ns}.json`), "utf8")); }
const primary = new Map();
for (const ns of LOCALIZATION_NAMESPACES) primary.set(ns, new Map(flatten(read("en", ns))));
assert.deepEqual(readdirSync(root).sort(), [...SUPPORTED_LOCALES].sort(), "only supported locale directories exist");
for (const locale of SUPPORTED_LOCALES) {
  assert.deepEqual(readdirSync(join(root, locale)).sort(), LOCALIZATION_NAMESPACES.map((ns) => `${ns}.json`).sort(), `${locale} namespace parity`);
  for (const ns of LOCALIZATION_NAMESPACES) {
    const entries = new Map(flatten(read(locale, ns)));
    assert.deepEqual([...entries.keys()].sort(), [...primary.get(ns).keys()].sort(), `${locale}/${ns} keys match fallback`);
    for (const [key, value] of entries) assert(typeof value === "string" && value.trim(), `${locale}/${ns}:${key} is non-empty text`);
  }
}
function assertKey(ref) { const [ns, key] = ref.split(":"); assert(primary.get(ns)?.has(key), `fallback contains ${ref}`); }
for (const dialogue of Object.values(DIALOGUE_DEFINITIONS)) { assertKey(dialogue.speakerKey); for (const line of dialogue.lines) assertKey(line.textKey); }
for (const definition of INTERACTION_DEFINITIONS) assertKey(definition.promptKey);
assertKey("hud:interaction.next"); assertKey("hud:interaction.close");
assert.equal(normalizeLanguageCode("en-US"), "en"); assert.equal(normalizeLanguageCode("ru-RU"), "ru"); assert.equal(normalizeLanguageCode("fr-FR"), "en");
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
}
for (const file of ["src/dialogueConfig.js", "src/interactionConfig.js", "src/interactionRuntime.js", "src/interactionHud.js"]) {
  const text = readFileSync(file, "utf8");
  for (const literal of ["TALK", "NEXT", "CLOSE", "HELLO THERE", "THE VILLAGE IS QUIET", "SEE YOU AROUND", "HOME NPC"]) {
    assert(!text.includes(literal), `${file} has no user-facing English literal ${literal}`);
  }
}
const rubikFontPath = "public/assets/fonts/rubik/Rubik-Regular.ttf";
const rubikLicensePath = "public/assets/fonts/rubik/OFL.txt";
assert(existsSync(rubikFontPath), "Rubik runtime font is committed");
assert(existsSync(rubikLicensePath), "Rubik OFL license is committed beside the font");
assert.equal(
  createHash("sha256").update(readFileSync(rubikFontPath)).digest("hex"),
  "a66d53c66f8e31520c9b6212eae9e1c6bdd59e01eab2f2068ddd1f80f062c235",
  "Rubik runtime font hash matches the validated asset",
);
for (const locale of SUPPORTED_LOCALES) {
  const hud = read(locale, "hud");
  assert.equal(hud.language.currentNext, "{current} / {next}", `${locale} language label uses ICU placeholders`);
  assert(!hud.language.currentNext.includes("{{"), `${locale} language label does not use disabled i18next interpolation`);
}

console.log("localization checks passed");
