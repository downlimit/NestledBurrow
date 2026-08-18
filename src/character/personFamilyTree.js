import { PERSON_LIFE_STATUSES, PERSON_RELATIONSHIP_KINDS } from "./populationDomain.js";

const FICTIONAL_ANCESTOR_NAMES = Object.freeze([
  "Alma", "Ansel", "Bera", "Corin", "Della", "Eamon", "Elva", "Fenn",
  "Gilda", "Hale", "Iona", "Joren", "Kelda", "Lorne", "Maren", "Nell",
  "Orin", "Pella", "Runa", "Soren", "Tilda", "Ulric", "Vera", "Wynn",
]);

export function createDisplayFamilyTree(personSource, personId) {
  const getPerson = personGetter(personSource);
  const focusPerson = getPerson(personId);
  if (!focusPerson) return null;

  const focus = realNode(focusPerson);
  const parents = parentNodes(getPerson, focusPerson, `${focusPerson.id}:parents`);
  const grandparents = parents.flatMap((parent, parentIndex) => {
    if (parent.fictional) {
      return [
        fictionalNode(`${parent.id}:parent:0`),
        fictionalNode(`${parent.id}:parent:1`),
      ];
    }
    const person = getPerson(parent.id);
    return parentNodes(getPerson, person, `${focusPerson.id}:grandparents:${parentIndex}`);
  });

  const partner = relationshipPeople(getPerson, focusPerson, PERSON_RELATIONSHIP_KINDS.partner)
    .map(realNode)[0] ?? null;
  const children = relationshipPeople(getPerson, focusPerson, PERSON_RELATIONSHIP_KINDS.parent)
    .map(realNode)
    .slice(0, 3);

  return { focus, parents, grandparents, partner, children };
}

function parentNodes(getPerson, person, fallbackKey) {
  const actual = person
    ? relationshipPeople(getPerson, person, PERSON_RELATIONSHIP_KINDS.child).map(realNode).slice(0, 2)
    : [];
  while (actual.length < 2) actual.push(fictionalNode(`${fallbackKey}:${actual.length}`));
  return actual;
}

function relationshipPeople(getPerson, person, kind) {
  if (!person || !Array.isArray(person.relationships)) return [];
  return person.relationships
    .filter((relationship) => relationship?.kind === kind)
    .map((relationship) => getPerson(relationship.personId))
    .filter(Boolean);
}

function realNode(person) {
  return {
    id: person.id,
    displayName: person.displayName,
    fictional: false,
    lifeStatus: person.lifeStatus ?? PERSON_LIFE_STATUSES.alive,
  };
}

function fictionalNode(key) {
  const index = Math.floor(stableUnit(key) * FICTIONAL_ANCESTOR_NAMES.length) % FICTIONAL_ANCESTOR_NAMES.length;
  return {
    id: `fictional-${stableHash(key).toString(16)}`,
    displayName: FICTIONAL_ANCESTOR_NAMES[index],
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

function stableUnit(key) {
  return stableHash(key) / 0xffffffff;
}

function stableHash(key) {
  let hash = 2166136261;
  for (const character of String(key)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
