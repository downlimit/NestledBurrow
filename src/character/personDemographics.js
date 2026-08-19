import { PERSON_LIFE_STAGES } from "./populationDomain.js";

export const PERSON_SEXES = Object.freeze({ male: "male", female: "female" });

const STAGE1_SEX_BY_ID = Object.freeze({
  "person-mira": PERSON_SEXES.female,
  "person-rowan": PERSON_SEXES.male,
  "person-ilya": PERSON_SEXES.male,
  "person-anya": PERSON_SEXES.female,
  "person-tomas": PERSON_SEXES.male,
  "person-lida": PERSON_SEXES.female,
  "person-pavel": PERSON_SEXES.male,
  "person-vera": PERSON_SEXES.female,
  "person-niko": PERSON_SEXES.male,
  "person-sonya": PERSON_SEXES.female,
  "person-emil": PERSON_SEXES.male,
  "person-daria": PERSON_SEXES.female,
  "person-mark": PERSON_SEXES.male,
  "person-nina": PERSON_SEXES.female,
  "person-lev": PERSON_SEXES.male,
  "person-zoya": PERSON_SEXES.female,
});

const MALE_NAME_EXCEPTIONS = new Set([
  "andrea", "ari", "ilya", "jari", "kari", "luca", "mika", "niko", "sami", "toni",
]);
const FEMALE_NAME_EXCEPTIONS = new Set([
  "abigail", "adele", "agnes", "alice", "amber", "amy", "ann", "anne", "ashley", "astrid", "audrey",
  "beth", "birgit", "britt", "brittany", "bryn", "carol", "catherine", "charlotte", "cheryl", "chloe", "claire",
  "crystal", "dawn", "deborah", "denise", "edith", "elise", "elizabeth", "ellen", "emily", "erin",
  "esther", "evelyn", "gabrielle", "grete", "gwen", "heather", "helen", "hilary", "holly", "ingrid",
  "ines", "iris", "isabel", "isabelle", "jane", "janet", "jennifer", "jill", "judith", "juliet",
  "karen", "kate", "katherine", "kathleen", "kathryn", "katie", "kelly", "kim", "kirsten", "lauren",
  "leah", "lilian", "linda", "liv", "lorraine", "louise", "lucy", "lynn", "madeleine", "margaret",
  "maren", "margot", "marit", "mary", "may", "megan", "michelle", "miriam", "molly", "monique",
  "nancy", "nicole", "patricia", "rachel", "ruth", "sarah", "shannon", "sharon", "sigrid", "sophie",
  "stacey", "susan", "sylvie", "sylvia", "teresa", "therese", "tove", "tracy", "valerie", "wendy",
]);

const RU_STAGE_LABELS = Object.freeze({
  [PERSON_LIFE_STAGES.newborn]: Object.freeze({ male: "Новорождённый", female: "Новорождённая" }),
  [PERSON_LIFE_STAGES.infant]: Object.freeze({ male: "Младенец", female: "Младенец" }),
  [PERSON_LIFE_STAGES.toddler]: Object.freeze({ male: "Малыш", female: "Малышка" }),
  [PERSON_LIFE_STAGES.child]: Object.freeze({ male: "Ребёнок", female: "Ребёнок" }),
  [PERSON_LIFE_STAGES.teen]: Object.freeze({ male: "Подросток", female: "Подросток" }),
  [PERSON_LIFE_STAGES.youngAdult]: Object.freeze({ male: "Молодой взрослый", female: "Молодая взрослая" }),
  [PERSON_LIFE_STAGES.adult]: Object.freeze({ male: "Взрослый", female: "Взрослая" }),
  [PERSON_LIFE_STAGES.elder]: Object.freeze({ male: "Пожилой", female: "Пожилая" }),
});

const EN_STAGE_LABELS = Object.freeze({
  [PERSON_LIFE_STAGES.newborn]: "Newborn",
  [PERSON_LIFE_STAGES.infant]: "Infant",
  [PERSON_LIFE_STAGES.toddler]: "Toddler",
  [PERSON_LIFE_STAGES.child]: "Child",
  [PERSON_LIFE_STAGES.teen]: "Teen",
  [PERSON_LIFE_STAGES.youngAdult]: "Young adult",
  [PERSON_LIFE_STAGES.adult]: "Adult",
  [PERSON_LIFE_STAGES.elder]: "Elder",
});

export function assignedPersonSex(personId) {
  const id = String(personId ?? "").trim();
  const explicit = STAGE1_SEX_BY_ID[id];
  if (explicit) return explicit;
  return stableUnit(`person-sex:${id || "generated-person"}`) < 0.5
    ? PERSON_SEXES.female
    : PERSON_SEXES.male;
}

export function givenNameSex(value) {
  const name = givenName(value).toLowerCase();
  if (!name) return null;
  if (MALE_NAME_EXCEPTIONS.has(name)) return PERSON_SEXES.male;
  if (FEMALE_NAME_EXCEPTIONS.has(name)) return PERSON_SEXES.female;
  if (name.endsWith("a") || name.endsWith("ia") || name.endsWith("ina") || name.endsWith("ella")) {
    return PERSON_SEXES.female;
  }
  return PERSON_SEXES.male;
}

export function personSex(person) {
  if (person?.sex === PERSON_SEXES.male || person?.sex === PERSON_SEXES.female) return person.sex;
  const id = String(person?.id ?? "").trim();
  const explicit = STAGE1_SEX_BY_ID[id];
  if (explicit) return explicit;
  if (/^person-(?:seed-\d{3}|born-\d+-\d+-\d+)$/u.test(id)) return assignedPersonSex(id);
  return givenNameSex(person?.displayName) ?? assignedPersonSex(id || givenName(person?.displayName));
}

export function oppositePersonSex(sex) {
  if (sex === PERSON_SEXES.male) return PERSON_SEXES.female;
  if (sex === PERSON_SEXES.female) return PERSON_SEXES.male;
  return null;
}

export function areOppositePersonSexes(first, second) {
  const firstSex = personSex(first);
  const secondSex = personSex(second);
  return Boolean(firstSex && secondSex && firstSex !== secondSex);
}

export function localizedPersonLifeStageLabel(person, language = "en") {
  const stage = person?.lifeStage;
  if (!stage) return "";
  if (String(language).toLowerCase().startsWith("ru")) {
    const labels = RU_STAGE_LABELS[stage];
    return labels?.[personSex(person)] ?? "";
  }
  return EN_STAGE_LABELS[stage] ?? "";
}

function givenName(value) {
  const displayName = typeof value === "object" ? value?.displayName : value;
  return String(displayName ?? "").trim().split(/\s+/u)[0] ?? "";
}

function stableUnit(key) {
  return stableHash(String(key ?? "")) / 0xffffffff;
}

function stableHash(key) {
  let hash = 2166136261;
  for (const character of key) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
