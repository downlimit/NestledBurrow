import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createStage1Population,
  PERSON_LIFE_STAGES,
  PERSON_LIFE_STATUSES,
  SPENDING_CAPACITY_VALUES,
  SPENDING_CAPACITY_WEIGHTS,
} from "../src/character/populationDomain.js";
import { ensureMaturePopulation } from "../src/character/populationLifecycleDomain.js";
import {
  PRICE_BANDS,
  PRICE_PREFERENCES,
  PRICE_SENSITIVITY_VALUES,
  WEALTH_LEVEL_ORDER,
  personEconomyProfile,
  priceAppealForPerson,
  wealthLevelForSpendingCapacity,
} from "../src/character/personEconomyProfile.js";
import {
  inheritedFamilySpendingCapacity,
  rebalancePopulationWealth,
  spendingCapacityIndex,
  synchronizePartnerWealth,
  wealthDistributionForPopulation,
  wealthSubgroupsForPopulation,
  wealthTargetShares,
} from "../src/character/populationWealthBalance.js";
import {
  getSalePriceBand,
  getSaleProfileTags,
} from "../src/tavern/saleProfileDomain.js";
import {
  createNeutralTavernFeedbackState,
  priceReputationFitForPerson,
  recordCompletedVisitFeedback,
  reputationCandidateWeight,
} from "../src/tavern/tavernFeedbackDomain.js";
import { decideFoodVisit } from "../src/tavern/visitDemandDomain.js";

const allLiked = {
  cuisine: { local: 1 },
  dishClass: { hot: 1, drink: 1 },
  ingredient: { potato: 1, lemon: 1 },
};
function personWithPreference(preference, spendingCapacity = 6) {
  for (let index = 0; index < 1_000; index += 1) {
    const person = {
      id: `person-price-test-${index}`,
      displayName: `Price Test ${index}`,
      spendingCapacity,
      foodPreferences: allLiked,
      needs: { satiety: 0 },
    };
    if (personEconomyProfile(person).pricePreference === preference) return person;
  }
  throw new Error(`Could not find deterministic ${preference} price profile`);
}

assert.deepEqual(SPENDING_CAPACITY_VALUES, [2, 3, 4, 5, 6]);
assert.deepEqual(SPENDING_CAPACITY_WEIGHTS, [22, 31, 24, 16, 7]);
assert.equal(SPENDING_CAPACITY_WEIGHTS.reduce((sum, value) => sum + value, 0), 100);
assert(Math.abs(wealthTargetShares().reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
assert.deepEqual(WEALTH_LEVEL_ORDER, ["poor", "modest", "middle", "comfortable", "wealthy"]);
for (let index = 0; index < SPENDING_CAPACITY_VALUES.length; index += 1) {
  assert.equal(wealthLevelForSpendingCapacity(SPENDING_CAPACITY_VALUES[index]), WEALTH_LEVEL_ORDER[index]);
}
assert.equal(getSalePriceBand("lemonade"), PRICE_BANDS.budget);
assert.equal(getSalePriceBand("fried-potato-dish"), PRICE_BANDS.standard);
assert.equal(getSalePriceBand({ price: 6 }), PRICE_BANDS.premium);
assert(getSaleProfileTags("lemonade").includes("priceBand:budget"));
assert(getSaleProfileTags("fried-potato-dish").includes("priceBand:standard"));

const budgetPerson = personWithPreference(PRICE_PREFERENCES.budget);
const premiumPerson = personWithPreference(PRICE_PREFERENCES.premium);
const neutralPerson = personWithPreference(PRICE_PREFERENCES.neutral);
for (const person of [budgetPerson, premiumPerson, neutralPerson]) {
  assert.deepEqual(personEconomyProfile(person), personEconomyProfile({ ...person }));
}
assert.equal(personEconomyProfile(neutralPerson).priceSensitivity, 0);
assert(PRICE_SENSITIVITY_VALUES.includes(personEconomyProfile(budgetPerson).priceSensitivity));
assert(PRICE_SENSITIVITY_VALUES.includes(personEconomyProfile(premiumPerson).priceSensitivity));
assert.equal(priceAppealForPerson(neutralPerson, PRICE_BANDS.budget), 1);
assert(priceAppealForPerson(budgetPerson, PRICE_BANDS.budget)
  > priceAppealForPerson(budgetPerson, PRICE_BANDS.standard));
assert(priceAppealForPerson(premiumPerson, PRICE_BANDS.standard)
  > priceAppealForPerson(premiumPerson, PRICE_BANDS.budget));

const budgetDecision = decideFoodVisit({
  person: budgetPerson,
  venueOffer: { foodItemIds: ["fried-potato-dish", "lemonade"] },
  randomSource: () => 0,
});
assert.equal(budgetDecision.bestOfferItemId, "lemonade");
assert.equal(budgetDecision.wealthLevel, "wealthy");
assert.equal(budgetDecision.pricePreference, PRICE_PREFERENCES.budget);

const premiumDecision = decideFoodVisit({
  person: premiumPerson,
  venueOffer: { foodItemIds: ["fried-potato-dish", "lemonade"] },
  randomSource: () => 0,
});
assert.equal(premiumDecision.bestOfferItemId, "fried-potato-dish");
assert.equal(premiumDecision.pricePreference, PRICE_PREFERENCES.premium);

const poorPremiumDecision = decideFoodVisit({
  person: { ...premiumPerson, spendingCapacity: 2 },
  venueOffer: { foodItemIds: ["fried-potato-dish", "lemonade"] },
  householdAvailableCoins: 100,
  randomSource: () => 0,
});
assert.deepEqual(poorPremiumDecision.affordableItemIds.sort(), ["fried-potato-dish", "lemonade"].sort(),
  "wealth class no longer acts as a second wallet once real household money exists");
assert.equal(poorPremiumDecision.bestOfferItemId, "fried-potato-dish");

const neutralDecision = decideFoodVisit({
  person: neutralPerson,
  venueOffer: { foodItemIds: ["fried-potato-dish", "lemonade"] },
  randomSource: () => 0,
});
assert.equal(neutralDecision.bestOfferPriceAppeal, 1);

const feedback = createNeutralTavernFeedbackState([budgetPerson, premiumPerson, neutralPerson], 0);
recordCompletedVisitFeedback(feedback, {
  personId: budgetPerson.id,
  satisfactionTier: 3,
  itemId: "lemonade",
  worldTimeSeconds: 0,
});
const oneSalePriceFit = priceReputationFitForPerson(feedback, budgetPerson);
assert(oneSalePriceFit > 0 && oneSalePriceFit < personEconomyProfile(budgetPerson).priceSensitivity);
for (let index = 1; index < 8; index += 1) {
  recordCompletedVisitFeedback(feedback, {
    personId: budgetPerson.id,
    satisfactionTier: 3,
    itemId: "lemonade",
    worldTimeSeconds: index,
  });
}
assert(feedback.reputationProfile.foodTagWeights["priceBand:budget"]
  > feedback.reputationProfile.foodTagWeights["priceBand:standard"]);
assert(priceReputationFitForPerson(feedback, budgetPerson) > priceReputationFitForPerson(feedback, premiumPerson));
assert(reputationCandidateWeight(feedback, budgetPerson) > reputationCandidateWeight(feedback, premiumPerson));
assert(reputationCandidateWeight(feedback, premiumPerson) > 0);

const partnerA = {
  id: "wealth-partner-a", lifeStatus: PERSON_LIFE_STATUSES.alive, lifeStage: PERSON_LIFE_STAGES.adult,
  spendingCapacity: 2, relationships: [{ personId: "wealth-partner-b", kind: "partner" }],
  foodPreferences: allLiked, preferredVisitPeriods: ["night"],
};
const partnerB = {
  id: "wealth-partner-b", lifeStatus: PERSON_LIFE_STATUSES.alive, lifeStage: PERSON_LIFE_STAGES.adult,
  spendingCapacity: 3, relationships: [{ personId: "wealth-partner-a", kind: "partner" }],
  foodPreferences: allLiked, preferredVisitPeriods: ["night"],
};
synchronizePartnerWealth([partnerA, partnerB]);
assert.equal(partnerA.spendingCapacity, partnerB.spendingCapacity);

const inheritedCapacity = inheritedFamilySpendingCapacity(
  { id: "parent-a", spendingCapacity: 5 },
  { id: "parent-b", spendingCapacity: 5 },
  "child-a",
  [],
);
assert(Math.abs(spendingCapacityIndex(inheritedCapacity) - spendingCapacityIndex(5)) <= 1);

const maturePopulation = createStage1Population(0);
ensureMaturePopulation(maturePopulation, 0);
const matureById = new Map(maturePopulation.map((person) => [person.id, person]));
for (const person of maturePopulation) {
  const partnerId = person.relationships?.find((relationship) => relationship.kind === "partner")?.personId;
  const partner = partnerId ? matureById.get(partnerId) : null;
  if (partner?.lifeStatus === PERSON_LIFE_STATUSES.alive && person.lifeStatus === PERSON_LIFE_STATUSES.alive) {
    assert.equal(person.spendingCapacity, partner.spendingCapacity);
  }
}
assert(wealthDistributionForPopulation(maturePopulation).counts.every((count) => count > 0));

const synthetic = Array.from({ length: 100 }, (_, index) => ({
  id: `wealth-balance-${index}`,
  displayName: `Wealth Balance ${index}`,
  lifeStatus: PERSON_LIFE_STATUSES.alive,
  lifeStage: PERSON_LIFE_STAGES.adult,
  spendingCapacity: 6,
  relationships: [],
  foodPreferences: allLiked,
  preferredVisitPeriods: ["night"],
}));
for (let day = 1; day <= 240; day += 1) {
  rebalancePopulationWealth(synthetic, day, { maxHouseholdMoves: 8, mobilityChance: 1 });
}
const balanced = wealthDistributionForPopulation(synthetic);
assert(balanced.counts.every((count) => count > 0));
for (let index = 0; index < balanced.shares.length; index += 1) {
  assert(Math.abs(balanced.shares[index] - balanced.targetShares[index]) <= 0.12,
    `career-event balance remains broadly near target wealth share ${index}`);
}
const nightGroup = wealthSubgroupsForPopulation(synthetic).find((group) => group.key === "visit:night");
assert(nightGroup && nightGroup.members.length === 100);
assert(wealthSubgroupsForPopulation(synthetic).some((group) => group.key === "food:cuisine:local"));

const tavernDoc = readFileSync("systems/tavern-service.md", "utf8");
const characterDoc = readFileSync("systems/character-and-needs.md", "utf8");
for (const phrase of ["Ценовое предпочтение", "Ценовая чувствительность", "Ценовой сегмент"]) {
  assert(tavernDoc.includes(phrase), `tavern contract records ${phrase}`);
}
for (const phrase of ["22:31:24:16:7", "пять уровней", "супруг", "подгрупп"]) {
  assert(characterDoc.includes(phrase), `character contract records ${phrase}`);
}

console.log("Task #102 wealth and tavern price-audience contracts OK");