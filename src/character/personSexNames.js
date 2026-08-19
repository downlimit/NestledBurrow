import { assignedPersonSex, givenNameSex, PERSON_SEXES } from "./personDemographics.js";
import { COMMON_PERSON_NAMES } from "./personNames.js";

const RESERVED_STAGE1_NAMES = new Set([
  "Mira", "Rowan", "Ilya", "Anya", "Tomas", "Lida", "Pavel", "Vera",
  "Niko", "Sonya", "Emil", "Daria", "Mark", "Nina", "Lev", "Zoya",
].map((name) => name.toLowerCase()));

const GENERATED_NAMES_BY_SEX = Object.freeze({
  [PERSON_SEXES.male]: Object.freeze(COMMON_PERSON_NAMES.filter((name) => (
    !RESERVED_STAGE1_NAMES.has(name.toLowerCase()) && givenNameSex(name) === PERSON_SEXES.male
  ))),
  [PERSON_SEXES.female]: Object.freeze(COMMON_PERSON_NAMES.filter((name) => (
    !RESERVED_STAGE1_NAMES.has(name.toLowerCase()) && givenNameSex(name) === PERSON_SEXES.female
  ))),
});

export function generatedPopulationSexMatchedName(personId) {
  const id = String(personId ?? "").trim() || "generated-person";
  const sex = assignedPersonSex(id);
  const candidates = GENERATED_NAMES_BY_SEX[sex];
  if (!candidates?.length) throw new Error(`No generated names available for sex ${sex}`);
  return candidates[stableHash(`sex-name:${id}`) % candidates.length];
}

function stableHash(key) {
  let hash = 2166136261;
  for (const character of String(key ?? "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
