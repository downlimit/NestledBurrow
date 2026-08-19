import assert from "node:assert/strict";
import {
  classifyPaths,
  classifyPullRequest,
  parseDeliveryMetadata,
  requiresBrowser,
} from "./classify-pr-scope.mjs";
import { createStage1Population, isLivingPopulationPerson, PERSON_GAME_DAY_SECONDS } from "../src/character/populationDomain.js";
import { advancePopulationLifecycle, ensureMaturePopulation } from "../src/character/populationLifecycleDomain.js";
import { areOppositePersonSexes, personSex, PERSON_SEXES } from "../src/character/personDemographics.js";
import { createDisplayFamilyTree } from "../src/character/personFamilyTree.js";
import { livingSurnameDiversity } from "../src/character/populationLineageBalance.js";

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

const simPopulation = ensureMaturePopulation(createStage1Population(0), 0);
const initialSexCounts = sexCounts(simPopulation.filter(isLivingPopulationPerson));
assert.equal(sameSexPartnerPairs(simPopulation), 0, "initial mature population must have no same-sex partner pair");
const summary = advancePopulationLifecycle(simPopulation, 1000 * PERSON_GAME_DAY_SECONDS);
const living = simPopulation.filter(isLivingPopulationPerson);
const finalSexCounts = sexCounts(living);
const sameSexPairs = sameSexPartnerPairs(simPopulation);
assert.equal(sameSexPairs, 0, "1000-day simulation must never leave a same-sex partner pair");

const nativeBirths = simPopulation.filter((person) => {
  const match = /^person-born-\d+-(\d+)-\d+$/u.exec(person.id);
  return match && Number(match[1]) < 1000;
});
const nativeBirthSexCounts = sexCounts(nativeBirths);
const nativeBirthFemaleShare = nativeBirths.length > 0 ? nativeBirthSexCounts.female / nativeBirths.length : 0;
assert(nativeBirthFemaleShare >= 0.45 && nativeBirthFemaleShare <= 0.55,
  `newborn sex assignment should stay near 50/50 over the long run, got ${nativeBirthFemaleShare}`);

let fictionalPairViolations = 0;
for (const person of living.slice(0, 120)) {
  const tree = createDisplayFamilyTree(simPopulation, person.id);
  if (!tree) continue;
  for (const pair of [tree.parents, tree.grandparents.slice(0, 2), tree.grandparents.slice(2, 4)]) {
    if (pair.length === 2 && !areOppositePersonSexes(pair[0], pair[1])) fictionalPairViolations += 1;
  }
}
assert.equal(fictionalPairViolations, 0, "display-only parent and grandparent pairs must always be opposite-sex");

const surnameStats = livingSurnameDiversity(simPopulation);
console.log(`SEX_PAIRING_1000_DAY_JSON=${JSON.stringify({
  daysProcessed: summary.daysProcessed,
  living: living.length,
  initialSexCounts,
  finalSexCounts,
  nativeBirths: nativeBirths.length,
  nativeBirthSexCounts,
  nativeBirthFemaleShare: Number(nativeBirthFemaleShare.toFixed(4)),
  partnerPairs: partnerPairCount(simPopulation),
  sameSexPartnerPairs: sameSexPairs,
  fictionalPairViolations,
  uniqueSurnames: surnameStats.surnameCount,
  largestSurnameShare: Number(surnameStats.largestSurnameShare.toFixed(4)),
})}`);

function sexCounts(people) {
  const result = { male: 0, female: 0 };
  for (const person of people) result[personSex(person)] += 1;
  return result;
}

function partnerPairCount(population) {
  const byId = new Map(population.map((person) => [person.id, person]));
  const keys = new Set();
  for (const person of population) {
    for (const relationship of person.relationships ?? []) {
      if (relationship.kind !== "partner" || !byId.has(relationship.personId)) continue;
      keys.add([person.id, relationship.personId].sort().join("|"));
    }
  }
  return keys.size;
}

function sameSexPartnerPairs(population) {
  const byId = new Map(population.map((person) => [person.id, person]));
  const seen = new Set();
  let violations = 0;
  for (const person of population) {
    for (const relationship of person.relationships ?? []) {
      if (relationship.kind !== "partner") continue;
      const partner = byId.get(relationship.personId);
      if (!partner) continue;
      const key = [person.id, partner.id].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      if (!areOppositePersonSexes(person, partner)) violations += 1;
    }
  }
  return violations;
}
