import { areOppositePersonSexes, personSex, PERSON_SEXES } from "./personDemographics.js";

export const MARRIAGE_SURNAME_CHANCES = Object.freeze({
  wifeTakesHusband: 0.85,
  keepBoth: 0.05,
  husbandTakesWife: 0.05,
  combineBoth: 0.05,
});
export const CHILD_PATERNAL_SURNAME_CHANCE = 0.9;
export const COMPOUND_SURNAME_CHILD_RETENTION_CHANCE = 0.2;
export const FAMILY_LINE_BIRTH_WEIGHT_MIN = 0.8;
export const FAMILY_LINE_BIRTH_WEIGHT_MAX = 1.2;
export const SAME_SURNAME_PAIR_PENALTY_DAYS = 12;

const SURNAME_ROOTS = Object.freeze([
  "Ald", "Ard", "Ash", "Bar", "Bell", "Birch", "Black", "Blak",
  "Brook", "Cald", "Carr", "Cart", "Ced", "Clark", "Col", "Corb",
  "Dal", "Dan", "Drak", "Ell", "Fair", "Finch", "Fish", "Flint",
  "For", "Frost", "Gal", "Grant", "Gray", "Green", "Hal", "Hart",
  "Hawk", "Hay", "Hill", "Holt", "Kan", "Kent", "Lak", "Lan",
  "Marsh", "Mas", "Moor", "North", "Oak", "Pag", "Park", "Penn",
  "Pin", "Reed", "Ridg", "Ros", "Row", "Shaw", "Ston", "Val",
  "Ward", "Well", "West", "Whit", "Wild", "Wood", "Wynn", "York",
]);
const SURNAME_ENDINGS = Object.freeze(["er", "en", "ley", "man", "son", "ton", "well", "ford"]);
export const COMMON_PERSON_SURNAMES = Object.freeze(SURNAME_ROOTS.flatMap((root) => (
  SURNAME_ENDINGS.map((ending) => `${root}${ending}`)
)));
const STAGE1_SURNAME_INDEX = Object.freeze({
  "person-mira": 7, "person-rowan": 8, "person-ilya": 9, "person-anya": 10,
  "person-tomas": 11, "person-lida": 19, "person-pavel": 20, "person-vera": 21,
  "person-niko": 22, "person-sonya": 23, "person-emil": 31, "person-daria": 32,
  "person-mark": 33, "person-nina": 34, "person-lev": 35, "person-zoya": 43,
});

export function personGivenName(value) {
  const displayName = typeof value === "object" ? value?.displayName : value;
  return String(displayName ?? "").trim().split(/\s+/u)[0] ?? "";
}

export function explicitPersonSurname(value) {
  const displayName = typeof value === "object" ? value?.displayName : value;
  const parts = String(displayName ?? "").trim().split(/\s+/u).filter(Boolean);
  return parts.slice(1).join(" ");
}

export function personSurname(value) {
  const explicit = explicitPersonSurname(value);
  if (explicit) return normalizeSurnameSpelling(explicit);
  if (value && typeof value === "object" && value.id) return generatedBaseSurname(value.id);
  return "";
}

export function personSurnameComponents(value) {
  return personSurname(value)
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function withPersonSurname(displayName, surname) {
  const givenName = personGivenName(displayName);
  const safeSurname = normalizeSurnameSpelling(surname);
  return [givenName, safeSurname].filter(Boolean).join(" ");
}

export function canonicalFullPersonName(person) {
  return withPersonSurname(person?.displayName, personSurname(person));
}

export function generatedBaseSurname(personId) {
  const id = String(personId ?? "").trim();
  const stage1Index = STAGE1_SURNAME_INDEX[id];
  if (stage1Index !== undefined) return COMMON_PERSON_SURNAMES[stage1Index % COMMON_PERSON_SURNAMES.length];
  const seed = /^person-seed-(\d{3})$/u.exec(id);
  if (seed) {
    const index = Math.max(1, Number(seed[1])) - 1;
    return COMMON_PERSON_SURNAMES[(index * 131) % COMMON_PERSON_SURNAMES.length];
  }
  return COMMON_PERSON_SURNAMES[stableHash(`surname:${id || "person"}`) % COMMON_PERSON_SURNAMES.length];
}

export function marriageSurnameOutcomeForPair(firstId, secondId) {
  const unit = stableUnit(`marriage-surname:${pairKey(firstId, secondId)}`);
  if (unit < MARRIAGE_SURNAME_CHANCES.wifeTakesHusband) return "wife-takes-husband";
  if (unit < MARRIAGE_SURNAME_CHANCES.wifeTakesHusband + MARRIAGE_SURNAME_CHANCES.keepBoth) return "keep-both";
  if (unit < MARRIAGE_SURNAME_CHANCES.wifeTakesHusband + MARRIAGE_SURNAME_CHANCES.keepBoth
    + MARRIAGE_SURNAME_CHANCES.husbandTakesWife) return "husband-takes-wife";
  return "combine-both";
}

export function surnameSidesForPair(first, second) {
  const firstSex = personSex(first);
  const secondSex = personSex(second);
  if (firstSex === PERSON_SEXES.male && secondSex === PERSON_SEXES.female) {
    return { husband: first, wife: second };
  }
  if (firstSex === PERSON_SEXES.female && secondSex === PERSON_SEXES.male) {
    return { husband: second, wife: first };
  }
  return { husband: null, wife: null };
}

export function applyMarriageFamilyNames(first, second) {
  if (!first?.id || !second?.id) return { mutated: false, outcome: "invalid" };
  const { husband, wife } = surnameSidesForPair(first, second);
  if (!husband || !wife) {
    const mutated = removePartnerRelationship(first, second);
    return { mutated, outcome: "invalid-sex-pair", husbandId: null, wifeId: null };
  }
  const husbandSurname = personSurname(husband);
  const wifeSurname = personSurname(wife);
  const outcome = marriageSurnameOutcomeForPair(first.id, second.id);
  let nextHusband = husbandSurname;
  let nextWife = wifeSurname;
  if (outcome === "wife-takes-husband") nextWife = husbandSurname;
  else if (outcome === "husband-takes-wife") nextHusband = wifeSurname;
  else if (outcome === "combine-both") {
    const combined = combineSurnames(husbandSurname, wifeSurname);
    nextHusband = combined;
    nextWife = combined;
  }
  let mutated = false;
  mutated = setSurname(husband, nextHusband) || mutated;
  mutated = setSurname(wife, nextWife) || mutated;
  return { mutated, outcome, husbandId: husband.id, wifeId: wife.id };
}

export function childFamilySurname(firstParent, secondParent, childId) {
  if (!firstParent && !secondParent) return generatedBaseSurname(childId);
  if (!firstParent) return inheritedSurnameForChild(personSurname(secondParent), childId);
  if (!secondParent) return inheritedSurnameForChild(personSurname(firstParent), childId);
  const { husband: father, wife: mother } = surnameSidesForPair(firstParent, secondParent);
  if (!father || !mother) {
    const inherited = stableUnit(`${childId}:fallback-parent-surname`) < 0.5
      ? personSurname(firstParent)
      : personSurname(secondParent);
    return inheritedSurnameForChild(inherited, childId);
  }
  const inherited = stableUnit(`${childId}:paternal-surname`) < CHILD_PATERNAL_SURNAME_CHANCE
    ? personSurname(father)
    : personSurname(mother);
  return inheritedSurnameForChild(inherited, childId);
}

export function ensurePopulationFamilyNames(population) {
  if (!Array.isArray(population)) return 0;
  const people = population.filter((person) => person?.id && personGivenName(person));
  const byId = new Map(people.map((person) => [person.id, person]));
  let changed = repairInvalidPartnerPairs(people, byId);
  const initiallyMissing = new Set(people.filter((person) => !explicitPersonSurname(person)).map((person) => person.id));
  if (initiallyMissing.size === 0) {
    for (const person of people) changed += setSurname(person, personSurname(person)) ? 1 : 0;
    return changed;
  }

  const visited = new Set();
  for (const person of people) {
    if (!initiallyMissing.has(person.id) || visited.has(person.id)) continue;
    const siblings = missingSiblingGroup(person.id, byId, initiallyMissing);
    for (const sibling of siblings) visited.add(sibling.id);
    if (siblings.length >= 2) {
      const sharedSurname = personSurname(siblings[0]);
      for (const sibling of siblings) changed += setSurname(sibling, sharedSurname) ? 1 : 0;
    } else {
      changed += setSurname(person, personSurname(person)) ? 1 : 0;
    }
  }

  const relevantPairs = partnerPairs(people, byId)
    .filter(([first, second]) => initiallyMissing.has(first.id) || initiallyMissing.has(second.id));
  for (const [first, second] of relevantPairs) changed += applyMarriageFamilyNames(first, second).mutated ? 1 : 0;

  const inheriting = people
    .filter((person) => initiallyMissing.has(person.id) && parentPeople(person, byId).length > 0)
    .sort((a, b) => Number(b.ageYears || 0) - Number(a.ageYears || 0));
  for (const child of inheriting) {
    const parents = parentPeople(child, byId);
    changed += setSurname(child, childFamilySurname(parents[0], parents[1], child.id)) ? 1 : 0;
  }

  for (const [first, second] of relevantPairs) changed += applyMarriageFamilyNames(first, second).mutated ? 1 : 0;
  return changed;
}

export function sharesSurnameComponent(first, second) {
  const firstComponents = new Set(personSurnameComponents(first).map((surname) => surname.toLowerCase()));
  return personSurnameComponents(second).some((surname) => firstComponents.has(surname.toLowerCase()));
}

export function visualSurnamePairPenaltyDays(first, second) {
  if (!areOppositePersonSexes(first, second)) return Number.POSITIVE_INFINITY;
  return sharesSurnameComponent(first, second) ? SAME_SURNAME_PAIR_PENALTY_DAYS : 0;
}

export function familyLineBirthWeight(first, second, population) {
  const living = (Array.isArray(population) ? population : []).filter((person) => person?.lifeStatus !== "dead");
  const counts = new Map();
  let assignments = 0;
  for (const person of living) {
    const components = [...new Set(personSurnameComponents(person).map((surname) => surname.toLowerCase()))];
    for (const component of components) {
      counts.set(component, (counts.get(component) ?? 0) + 1);
      assignments += 1;
    }
  }
  if (counts.size === 0) return 1;
  const pairComponents = [...new Set([
    ...personSurnameComponents(first),
    ...personSurnameComponents(second),
  ].map((surname) => surname.toLowerCase()))];
  if (pairComponents.length === 0) return 1;
  const mean = assignments / counts.size;
  const density = pairComponents.reduce((total, surname) => total + (counts.get(surname) ?? 1), 0) / pairComponents.length;
  const weight = 1 + 0.12 * Math.log2(Math.max(0.01, mean / Math.max(1, density)));
  return clamp(weight, FAMILY_LINE_BIRTH_WEIGHT_MIN, FAMILY_LINE_BIRTH_WEIGHT_MAX);
}

function repairInvalidPartnerPairs(people, byId) {
  let changed = 0;
  for (const [first, second] of partnerPairs(people, byId)) {
    if (areOppositePersonSexes(first, second)) continue;
    if (removePartnerRelationship(first, second)) changed += 1;
  }
  return changed;
}

function removePartnerRelationship(first, second) {
  if (!first || !second) return false;
  const firstBefore = Array.isArray(first.relationships) ? first.relationships.length : 0;
  const secondBefore = Array.isArray(second.relationships) ? second.relationships.length : 0;
  first.relationships = (Array.isArray(first.relationships) ? first.relationships : [])
    .filter((relationship) => !(relationship?.kind === "partner" && relationship.personId === second.id));
  second.relationships = (Array.isArray(second.relationships) ? second.relationships : [])
    .filter((relationship) => !(relationship?.kind === "partner" && relationship.personId === first.id));
  first.relatedPersonIds = first.relationships.map((relationship) => relationship.personId);
  second.relatedPersonIds = second.relationships.map((relationship) => relationship.personId);
  return first.relationships.length !== firstBefore || second.relationships.length !== secondBefore;
}

function partnerPairs(people, byId) {
  const seen = new Set();
  const pairs = [];
  for (const person of people) {
    for (const relationship of Array.isArray(person.relationships) ? person.relationships : []) {
      if (relationship?.kind !== "partner") continue;
      const partner = byId.get(relationship.personId);
      if (!partner) continue;
      const key = pairKey(person.id, partner.id);
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push([person, partner]);
    }
  }
  return pairs.sort((a, b) => pairKey(a[0].id, a[1].id).localeCompare(pairKey(b[0].id, b[1].id)));
}

function missingSiblingGroup(startId, byId, missingIds) {
  const result = [];
  const queued = new Set([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    const id = queue.shift();
    const person = byId.get(id);
    if (!person || !missingIds.has(id)) continue;
    result.push(person);
    for (const relationship of Array.isArray(person.relationships) ? person.relationships : []) {
      if (relationship?.kind !== "sibling" || queued.has(relationship.personId) || !missingIds.has(relationship.personId)) continue;
      queued.add(relationship.personId);
      queue.push(relationship.personId);
    }
  }
  return result;
}

function parentPeople(person, byId) {
  return (Array.isArray(person?.relationships) ? person.relationships : [])
    .filter((relationship) => relationship?.kind === "child")
    .map((relationship) => byId.get(relationship.personId))
    .filter(Boolean)
    .slice(0, 2);
}

function inheritedSurnameForChild(surname, childId) {
  const normalized = normalizeSurnameSpelling(surname);
  const components = normalized.split("-").filter(Boolean);
  if (components.length <= 1) return normalized;
  if (stableUnit(`${childId}:compound-surname-retention`) < COMPOUND_SURNAME_CHILD_RETENTION_CHANCE) {
    return normalizeSurnameSpelling(components.slice(0, 2).join("-"));
  }
  const componentIndex = stableUnit(`${childId}:compound-surname-component`) < 0.5 ? 0 : Math.min(1, components.length - 1);
  return normalizeSurnameSpelling(components[componentIndex]);
}

function combineSurnames(husbandSurname, wifeSurname) {
  const husbandPart = personSurnameComponents(`X ${husbandSurname}`)[0] ?? husbandSurname;
  const wifePart = personSurnameComponents(`X ${wifeSurname}`)[0] ?? wifeSurname;
  if (husbandPart.toLowerCase() === wifePart.toLowerCase()) return normalizeSurnameSpelling(husbandPart);
  return normalizeSurnameSpelling(`${husbandPart}-${wifePart}`);
}

function normalizeSurnameSpelling(value) {
  return String(value ?? "")
    .trim()
    .split("-")
    .map((part) => {
      const text = part.trim();
      return text ? `${text[0].toUpperCase()}${text.slice(1)}` : "";
    })
    .filter(Boolean)
    .join("-");
}

function setSurname(person, surname) {
  const next = withPersonSurname(person?.displayName, surname);
  if (!person || !next || person.displayName === next) return false;
  person.displayName = next;
  return true;
}

function pairKey(firstId, secondId) {
  return [String(firstId ?? ""), String(secondId ?? "")].sort().join("|");
}

function stableUnit(key) {
  return stableHash(key) / 0xffffffff;
}

function stableHash(key) {
  let hash = 2166136261;
  for (const character of String(key ?? "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
