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
import { personSurname, personSurnameComponents } from "../src/character/personFamilyNames.js";

assert.equal(classifyPaths(["docs/readme.md", "NestledBurrow_local.bat"]), "micro");
assert.equal(classifyPaths(["AGENTS.md", "scripts/classify-pr-scope.mjs"]), "ci-meta");
assert.equal(classifyPaths(["scripts/manage-task-preview.mjs"]), "ci-meta");
assert.equal(classifyPaths(["src/main.js", "docs/runtime-note.md"]), "runtime");
assert.equal(classifyPaths([".github/workflows/pr-check.yml"]), "strict");
assert.equal(classifyPaths(["playwright.config.js"]), "strict");
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
assert.equal(classifyPullRequest(["ROADMAP.md"], publicPendingBody.replace("auto-merge: no", "auto-merge: yes")).autoMerge, false);
assert.equal(classifyPullRequest(["src/main.js"], "").preview, false);
assert.equal(parseDeliveryMetadata(publicPendingBody.replace("executor: chatgpt", "executor: codex")).valid, false);
const malformed = classifyPullRequest(["src/main.js"], "<!-- nestled-burrow-delivery:v1\nplayer-visible: perhaps\n-->");
assert.equal(malformed.metadata.valid, false);
assert.equal(malformed.preview, false);
assert.equal(malformed.autoMerge, false);
console.log("PR scope classifier passed: browser coverage and explicit ChatGPT pre-acceptance preview routing are stable");

function snapshot(population, day, cumulativeArrivals) {
  const living = population.filter(isLivingPopulationPerson);
  const surnames = living.map(personSurname).filter(Boolean);
  const surnameCounts = new Map();
  const roots = new Set();
  for (const person of living) {
    const surname = personSurname(person);
    surnameCounts.set(surname, (surnameCounts.get(surname) ?? 0) + 1);
    for (const root of personSurnameComponents(person)) roots.add(root.toLowerCase());
  }
  const ranked = [...surnameCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const doubles = surnames.filter((surname) => surname.includes("-")).length;
  return {
    day,
    living: living.length,
    history: population.length,
    uniqueSurnames: surnameCounts.size,
    surnameRoots: roots.size,
    doubleShare: Number((doubles / Math.max(1, living.length)).toFixed(4)),
    largestSurname: ranked[0]?.[0] ?? null,
    largestSurnameCount: ranked[0]?.[1] ?? 0,
    largestSurnameShare: Number(((ranked[0]?.[1] ?? 0) / Math.max(1, living.length)).toFixed(4)),
    cumulativeArrivals,
    top5: ranked.slice(0, 5),
  };
}

const population = ensureMaturePopulation(createStage1Population(0), 0);
const checkpoints = [0, 100, 300, 500, 1000];
const snapshots = [snapshot(population, 0, 0)];
let arrivals = 0;
for (const day of checkpoints.slice(1)) {
  const result = advancePopulationLifecycle(population, day * PERSON_GAME_DAY_SECONDS);
  arrivals += result.arrivals ?? 0;
  snapshots.push(snapshot(population, day, arrivals));
}
console.log("BALANCED_SURNAME_SIMULATION_JSON=" + JSON.stringify(snapshots));
