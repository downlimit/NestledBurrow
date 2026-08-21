import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SPENDING_CAPACITY_VALUES } from "../src/character/populationDomain.js";
import {
  PRICE_BANDS,
  PRICE_PREFERENCES,
  PRICE_SENSITIVITY_VALUES,
  personEconomyProfile,
  priceAppealForPerson,
  wealthLevelForSpendingCapacity,
} from "../src/character/personEconomyProfile.js";
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

assert.deepEqual(SPENDING_CAPACITY_VALUES, [2, 4, 6]);
assert.equal(wealthLevelForSpendingCapacity(2), "low");
assert.equal(wealthLevelForSpendingCapacity(4), "middle");
assert.equal(wealthLevelForSpendingCapacity(6), "high");
assert.equal(getSalePriceBand("lemonade"), PRICE_BANDS.budget);
assert.equal(getSalePriceBand("fried-potato-dish"), PRICE_BANDS.standard);
assert.equal(getSalePriceBand({ price: 6 }), PRICE_BANDS.premium);
assert(getSaleProfileTags("lemonade").includes("priceBand:budget"));
assert(getSaleProfileTags("fried-potato-dish").includes("priceBand:standard"));

const budgetPerson = personWithPreference(PRICE_PREFERENCES.budget);
const premiumPerson = personWithPreference(PRICE_PREFERENCES.premium);
const neutralPerson = personWithPreference(PRICE_PREFERENCES.neutral);
for (const person of [budgetPerson, premiumPerson, neutralPerson]) {
  assert.deepEqual(personEconomyProfile(person), personEconomyProfile({ ...person }),
    "price profile is deterministic from stable identity");
}
assert.equal(personEconomyProfile(neutralPerson).priceSensitivity, 0);
assert(PRICE_SENSITIVITY_VALUES.includes(personEconomyProfile(budgetPerson).priceSensitivity));
assert(PRICE_SENSITIVITY_VALUES.includes(personEconomyProfile(premiumPerson).priceSensitivity));
assert.equal(priceAppealForPerson(neutralPerson, PRICE_BANDS.budget), 1);
assert.equal(priceAppealForPerson(neutralPerson, PRICE_BANDS.standard), 1);
assert.equal(priceAppealForPerson(neutralPerson, PRICE_BANDS.premium), 1);
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
assert.equal(budgetDecision.wealthLevel, "high");
assert.equal(budgetDecision.pricePreference, PRICE_PREFERENCES.budget);
assert.equal(budgetDecision.bestOfferPriceBand, PRICE_BANDS.budget);

const premiumDecision = decideFoodVisit({
  person: premiumPerson,
  venueOffer: { foodItemIds: ["fried-potato-dish", "lemonade"] },
  randomSource: () => 0,
});
assert.equal(premiumDecision.bestOfferItemId, "fried-potato-dish");
assert.equal(premiumDecision.pricePreference, PRICE_PREFERENCES.premium);
assert.equal(premiumDecision.bestOfferPriceBand, PRICE_BANDS.standard);

const poorPremiumDecision = decideFoodVisit({
  person: { ...premiumPerson, spendingCapacity: 2 },
  venueOffer: { foodItemIds: ["fried-potato-dish", "lemonade"] },
  randomSource: () => 0,
});
assert.deepEqual(poorPremiumDecision.affordableItemIds, ["lemonade"],
  "wanting a higher price segment never bypasses the wealth ceiling");
assert.equal(poorPremiumDecision.bestOfferItemId, "lemonade");

const neutralDecision = decideFoodVisit({
  person: neutralPerson,
  venueOffer: { foodItemIds: ["fried-potato-dish", "lemonade"] },
  randomSource: () => 0,
});
assert.equal(neutralDecision.bestOfferPriceAppeal, 1, "price-neutral people do not receive a price penalty");

const feedback = createNeutralTavernFeedbackState([budgetPerson, premiumPerson, neutralPerson], 0);
assert.equal(feedback.reputationProfile.foodTagWeights["priceBand:budget"], 0);
assert.equal(feedback.reputationProfile.foodTagWeights["priceBand:standard"], 0);
recordCompletedVisitFeedback(feedback, {
  personId: budgetPerson.id,
  satisfactionTier: 3,
  itemId: "lemonade",
  worldTimeSeconds: 0,
});
const oneSalePriceFit = priceReputationFitForPerson(feedback, budgetPerson);
assert(oneSalePriceFit > 0 && oneSalePriceFit < personEconomyProfile(budgetPerson).priceSensitivity,
  "one sale starts but does not complete price-audience formation");
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
assert(reputationCandidateWeight(feedback, budgetPerson) > reputationCandidateWeight(feedback, premiumPerson),
  "established budget sales bias later discovery toward budget-preferring people");
assert(reputationCandidateWeight(feedback, premiumPerson) > 0,
  "price mismatch never eliminates discovery entirely");

const budgetEvidenceBeforeRedirect = feedback.reputationProfile.foodTagWeights["priceBand:budget"];
recordCompletedVisitFeedback(feedback, {
  personId: budgetPerson.id,
  satisfactionTier: 3,
  itemId: "fried-potato-dish",
  worldTimeSeconds: 20,
});
assert(feedback.reputationProfile.foodTagWeights["priceBand:budget"]
  > feedback.reputationProfile.foodTagWeights["priceBand:standard"],
"one changed sale does not instantly replace the established price audience");
assert(feedback.reputationProfile.foodTagWeights["priceBand:budget"] < budgetEvidenceBeforeRedirect);
for (let index = 0; index < 24; index += 1) {
  recordCompletedVisitFeedback(feedback, {
    personId: budgetPerson.id,
    satisfactionTier: 3,
    itemId: "fried-potato-dish",
    worldTimeSeconds: 30 + index,
  });
}
assert(feedback.reputationProfile.foodTagWeights["priceBand:standard"]
  > feedback.reputationProfile.foodTagWeights["priceBand:budget"],
"repeated changed sales redirect price reputation progressively");

const tavernDoc = readFileSync("systems/tavern-service.md", "utf8");
const characterDoc = readFileSync("systems/character-and-needs.md", "utf8");
for (const phrase of ["Ценовое предпочтение", "Ценовая чувствительность", "Ценовой сегмент"]) {
  assert(tavernDoc.includes(phrase), `tavern contract records ${phrase}`);
}
assert(characterDoc.includes("personEconomyProfile"));

console.log("Task #102 wealth and tavern price-audience contracts OK");
