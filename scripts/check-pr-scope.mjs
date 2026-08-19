import assert from "node:assert/strict";
import {
  classifyPaths,
  classifyPullRequest,
  parseDeliveryMetadata,
  requiresBrowser,
} from "./classify-pr-scope.mjs";
import {
  createStage1Population,
  isLivingPopulationPerson,
  PERSON_GAME_DAY_SECONDS,
} from "../src/character/populationDomain.js";
import {
  advancePopulationLifecycle,
  ensureMaturePopulation,
} from "../src/character/populationLifecycleDomain.js";
import { personSurname } from "../src/character/personFamilyNames.js";

assert.equal(classifyPaths(["docs/readme.md", "NestledBurrow_local.bat"]), "micro");
assert.equal(classifyPaths(["AGENTS.md", "scripts/classify-pr-scope.mjs"]), "ci-meta");
assert.equal(classifyPaths(["scripts/manage-task-preview.mjs"]), "ci-meta");
assert.equal(classifyPaths(["src/main.js", "docs/runtime-note.md"]), "runtime");
assert.equal(classifyPaths([".github/workflows/pr-check.yml"]), "strict");
assert.equal(classifyPaths(["playwright.config.js"]), "strict");
assert.equal(classifyPaths(["src/main.js", "package-lock.json"]), "strict");

assert.equal(requiresBrowser([".github/workflows/pr-check.yml"]), true);
assert.equal(requiresBrowser(["package.json"]), false);
assert.equal(requiresBrowser(["playwright.config.js"]), true);
assert.equal(requiresBrowser(["tests/e2e/task-059-world-locations.spec.js"]), true);
assert.equal(requiresBrowser(["src/build/worldBuildCoordinator.js", "package.json"]), true);
assert.equal(requiresBrowser(["public/locales/en/translation.json"]), true);

const noPreviewBody = `<!-- nestled-burrow-delivery:v1
executor: codex
player-visible: no
preview-acceptance: not-required
auto-merge: yes
-->`;
const publicPendingBody = `<!-- nestled-burrow-delivery:v1
executor: chatgpt
player-visible: yes
preview-acceptance: pending
auto-merge: no
-->`;
const codexAcceptedBody = publicPendingBody
  .replace("executor: chatgpt", "executor: codex")
  .replace("preview-acceptance: pending", "preview-acceptance: accepted");

assert.deepEqual(parseDeliveryMetadata(noPreviewBody).errors, []);
assert.equal(classifyPullRequest(["package.json"], noPreviewBody).preview, false);
assert.equal(classifyPullRequest(["package.json"], noPreviewBody).browser, false);
assert.equal(classifyPullRequest(["package.json"], noPreviewBody).autoMerge, true);
assert.equal(classifyPullRequest(["ROADMAP.md"], publicPendingBody).preview, true);
assert.equal(classifyPullRequest(["src/main.js"], publicPendingBody.replace("preview-acceptance: pending", "preview-acceptance: accepted")).preview, false);
assert.equal(classifyPullRequest(["src/main.js"], codexAcceptedBody).preview, false);
assert.equal(classifyPullRequest(["ROADMAP.md"], publicPendingBody).autoMerge, false);
assert.equal(
  classifyPullRequest(["ROADMAP.md"], publicPendingBody.replace("auto-merge: no", "auto-merge: yes")).autoMerge,
  false,
);
assert.equal(classifyPullRequest(["src/main.js"], "").preview, false);
assert.equal(parseDeliveryMetadata(publicPendingBody.replace("executor: chatgpt", "executor: codex")).valid, false);

const malformed = classifyPullRequest(
  ["src/main.js"],
  "<!-- nestled-burrow-delivery:v1\nplayer-visible: perhaps\n-->"
);
assert.equal(malformed.metadata.valid, false);
assert.equal(malformed.preview, false);
assert.equal(malformed.autoMerge, false);

console.log("PR scope classifier passed: browser coverage and explicit ChatGPT pre-acceptance preview routing are stable");

function surnameSnapshot(population, day) {
  const living = population.filter(isLivingPopulationPerson);
  const allSurnames = living.map(personSurname).filter(Boolean);
  const counts = new Map();
  for (const surname of allSurnames) counts.set(surname, (counts.get(surname) ?? 0) + 1);
  const unique = [...counts.keys()];
  const components = new Set(unique.flatMap((surname) => surname.split("-").filter(Boolean)));
  const doublePeople = allSurnames.filter((surname) => surname.includes("-")).length;
  const doubleUnique = unique.filter((surname) => surname.includes("-")).length;
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    day,
    living: living.length,
    history: population.length,
    uniqueSurnames: unique.length,
    surnameComponents: components.size,
    doubleSurnamePeople: doublePeople,
    doubleSurnameShare: living.length ? Number((doublePeople / living.length).toFixed(4)) : 0,
    uniqueDoubleSurnames: doubleUnique,
    largestSurname: ranked[0]?.[0] ?? null,
    largestSurnameCount: ranked[0]?.[1] ?? 0,
    top5: ranked.slice(0, 5),
  };
}

function canonicalPopulation() {
  return ensureMaturePopulation(createStage1Population(0), 0);
}

function remapPopulationIds(population, variant) {
  const mapping = new Map(population.map((person) => [person.id, `${person.id}-v${variant}`]));
  for (const person of population) {
    person.id = mapping.get(person.id);
    person.relationships = (person.relationships ?? []).map((relationship) => ({
      ...relationship,
      personId: mapping.get(relationship.personId) ?? relationship.personId,
    }));
    person.relatedPersonIds = (person.relatedPersonIds ?? []).map((id) => mapping.get(id) ?? id);
  }
  return population;
}

function runSurnameSimulation(variant) {
  const population = remapPopulationIds(canonicalPopulation(), variant);
  const start = surnameSnapshot(population, 0);
  advancePopulationLifecycle(population, 1000 * PERSON_GAME_DAY_SECONDS);
  return { variant, snapshots: [start, surnameSnapshot(population, 1000)] };
}

for (const variant of [1, 2]) {
  console.log("SURNAME_STRESS_JSON=" + JSON.stringify(runSurnameSimulation(variant)));
}
