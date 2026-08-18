import { localizePersonDisplayName } from "./personNameLocalization.js";
import { commonNameForKey, generatedPopulationName, isLegacyResidentName } from "./personNames.js";
import { PERSON_LIFE_STATUSES, PERSON_RELATIONSHIP_KINDS } from "./populationDomain.js";

export function createDisplayFamilyTree(personSource, personId) {
  const getPerson = personGetter(personSource);
  const focusPerson = getPerson(personId);
  if (!focusPerson) return null;

  const usedNames = new Set();
  const focus = realNode(focusPerson, usedNames);
  const parents = parentNodes(getPerson, focusPerson, `${focusPerson.id}:parents`, usedNames);
  const grandparents = parents.flatMap((parent, parentIndex) => {
    if (parent.fictional) {
      return fictionalParentPair(`${focusPerson.id}:fictional-parent:${parentIndex}`, usedNames);
    }
    const person = getPerson(parent.id);
    return parentNodes(getPerson, person, `${focusPerson.id}:grandparents:${parent.id}`, usedNames);
  });

  const partner = relationshipPeople(getPerson, focusPerson, PERSON_RELATIONSHIP_KINDS.partner)
    .map((person) => realNode(person, usedNames))[0] ?? null;
  const children = relationshipPeople(getPerson, focusPerson, PERSON_RELATIONSHIP_KINDS.parent)
    .map((person) => realNode(person, usedNames))
    .slice(0, 3);

  return { focus, parents, grandparents, partner, children };
}

function parentNodes(getPerson, person, fallbackKey, usedNames) {
  const actual = person
    ? relationshipPeople(getPerson, person, PERSON_RELATIONSHIP_KINDS.child)
      .map((relative) => realNode(relative, usedNames))
      .slice(0, 2)
    : [];
  while (actual.length < 2) {
    actual.push(fictionalNode(`${fallbackKey}:parent:${actual.length}`, usedNames));
  }
  return actual;
}

function fictionalParentPair(key, usedNames) {
  return [
    fictionalNode(`${key}:0`, usedNames),
    fictionalNode(`${key}:1`, usedNames),
  ];
}

function relationshipPeople(getPerson, person, kind) {
  if (!person || !Array.isArray(person.relationships)) return [];
  return person.relationships
    .filter((relationship) => relationship?.kind === kind)
    .map((relationship) => getPerson(relationship.personId))
    .filter(Boolean);
}

function realNode(person, usedNames) {
  if (isLegacyResidentName(person.displayName)) person.displayName = generatedPopulationName(person.id);
  const canonicalName = String(person.displayName ?? generatedPopulationName(person.id));
  const displayName = localizePersonDisplayName(canonicalName);
  usedNames.add(displayName.toLowerCase());
  return {
    id: person.id,
    displayName,
    fictional: false,
    lifeStatus: person.lifeStatus ?? PERSON_LIFE_STATUSES.alive,
  };
}

function fictionalNode(key, usedNames) {
  let attempt = 0;
  let canonicalName = commonNameForKey(`ancestor:${key}`, []);
  let displayName = localizePersonDisplayName(canonicalName);
  while (usedNames.has(displayName.toLowerCase()) && attempt < 1000) {
    attempt += 1;
    canonicalName = commonNameForKey(`ancestor:${key}:${attempt}`, []);
    displayName = localizePersonDisplayName(canonicalName);
  }
  usedNames.add(displayName.toLowerCase());
  return {
    id: `fictional-${stableHash(key).toString(16)}`,
    displayName,
    fictional: true,
    lifeStatus: PERSON_LIFE_STATUSES.dead,
  };
}

function personGetter(source) {
  if (typeof source === "function") return source;
  const people = Array.isArray(source) ? source : [];
  const byId = new Map(people.filter((person) => person?.id).map((person) => [person.id, person]));
  return (id) => byId.get(id) ?? null;
}

function stableHash(key) {
  let hash = 2166136261;
  for (const character of String(key)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
