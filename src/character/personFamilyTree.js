import { givenNameSex, oppositePersonSex, personSex, PERSON_SEXES } from "./personDemographics.js";
import { localizePersonDisplayName } from "./personNameLocalization.js";
import { generatedBaseSurname, personGivenName, personSurname } from "./personFamilyNames.js";
import { localizePersonFullName, localizePersonSurname } from "./personFullNameLocalization.js";
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
      return fictionalParentPair(
        `${focusPerson.id}:fictional-parent:${parentIndex}`,
        parent.ancestrySurname ?? parent.canonicalSurname,
        usedNames,
      );
    }
    const person = getPerson(parent.id);
    return parentNodes(getPerson, person, `${focusPerson.id}:grandparents:${parent.id}`, usedNames);
  });

  const partner = relationshipPeople(getPerson, focusPerson, PERSON_RELATIONSHIP_KINDS.partner)
    .filter((person) => personSex(person) !== personSex(focusPerson))
    .map((person) => realNode(person, usedNames))[0] ?? null;
  const children = relationshipPeople(getPerson, focusPerson, PERSON_RELATIONSHIP_KINDS.parent)
    .map((person) => realNode(person, usedNames))
    .slice(0, 3);

  return { focus, parents, grandparents, partner, children };
}

function parentNodes(getPerson, person, fallbackKey, usedNames) {
  const rawActualPeople = person
    ? relationshipPeople(getPerson, person, PERSON_RELATIONSHIP_KINDS.child).slice(0, 2)
    : [];
  const actualPeople = rawActualPeople.length >= 2 && personSex(rawActualPeople[0]) === personSex(rawActualPeople[1])
    ? [rawActualPeople[0]]
    : rawActualPeople;
  const actual = actualPeople.map((relative) => realNode(relative, usedNames));
  if (actual.length >= 2) return actual;

  const childSurname = personSurname(person) || generatedBaseSurname(`fictional-child:${fallbackKey}`);
  if (actual.length === 0) return fictionalParentPair(fallbackKey, childSurname, usedNames);

  const actualSurname = personSurname(actualPeople[0]) || childSurname;
  actual.push(fictionalSpouseNode(
    `${fallbackKey}:missing-spouse`,
    actualSurname,
    usedNames,
    personSex(actualPeople[0]),
  ));
  return actual;
}

function fictionalParentPair(key, childSurname, usedNames) {
  const normalizedChildSurname = canonicalSurname(childSurname) || generatedBaseSurname(`fictional-line:${key}`);
  const childParts = normalizedChildSurname.split("-").filter(Boolean);
  const firstAncestry = childParts[0] ?? normalizedChildSurname;
  const secondAncestry = childParts[1] ?? distinctGeneratedSurname(`${key}:second-line`, [firstAncestry]);

  if (childParts.length >= 2) {
    return orderedFictionalPair(key, usedNames, [
      { surname: normalizedChildSurname, ancestrySurname: firstAncestry, sex: PERSON_SEXES.male },
      { surname: normalizedChildSurname, ancestrySurname: secondAncestry, sex: PERSON_SEXES.female },
    ]);
  }

  const unit = stableUnit(`fictional-marriage:${key}`);
  let surnames;
  if (unit < 0.85) {
    surnames = [
      { surname: normalizedChildSurname, ancestrySurname: normalizedChildSurname, sex: PERSON_SEXES.male },
      { surname: normalizedChildSurname, ancestrySurname: secondAncestry, sex: PERSON_SEXES.female },
    ];
  } else if (unit < 0.90) {
    surnames = [
      { surname: normalizedChildSurname, ancestrySurname: normalizedChildSurname, sex: PERSON_SEXES.male },
      { surname: secondAncestry, ancestrySurname: secondAncestry, sex: PERSON_SEXES.female },
    ];
  } else if (unit < 0.95) {
    surnames = [
      { surname: normalizedChildSurname, ancestrySurname: secondAncestry, sex: PERSON_SEXES.male },
      { surname: normalizedChildSurname, ancestrySurname: normalizedChildSurname, sex: PERSON_SEXES.female },
    ];
  } else {
    const combined = combineSurnameComponents(normalizedChildSurname, secondAncestry);
    surnames = [
      { surname: combined, ancestrySurname: normalizedChildSurname, sex: PERSON_SEXES.male },
      { surname: combined, ancestrySurname: secondAncestry, sex: PERSON_SEXES.female },
    ];
  }
  return orderedFictionalPair(key, usedNames, surnames);
}

function orderedFictionalPair(key, usedNames, definitions) {
  const swap = stableUnit(`fictional-parent-order:${key}`) >= 0.9;
  const ordered = swap ? [definitions[1], definitions[0]] : definitions;
  return ordered.map((definition, index) => fictionalNode(
    `${key}:parent:${index}`,
    usedNames,
    definition,
  ));
}

function fictionalSpouseNode(key, familySurname, usedNames, actualSex) {
  const normalizedFamilySurname = canonicalSurname(familySurname) || generatedBaseSurname(`fictional-family:${key}`);
  const ownLine = distinctGeneratedSurname(`${key}:own-line`, normalizedFamilySurname.split("-"));
  const keepsOwn = stableUnit(`fictional-spouse-keeps:${key}`) < 0.05;
  const sex = oppositePersonSex(actualSex)
    ?? (stableUnit(`fictional-spouse-sex:${key}`) < 0.5 ? PERSON_SEXES.female : PERSON_SEXES.male);
  return fictionalNode(key, usedNames, {
    surname: keepsOwn ? ownLine : normalizedFamilySurname,
    ancestrySurname: ownLine,
    sex,
  });
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
  const canonicalGivenName = personGivenName(person) || generatedPopulationName(person.id);
  const displayName = localizePersonDisplayName(canonicalGivenName);
  const fullDisplayName = localizePersonFullName(person);
  usedNames.add(displayName.toLowerCase());
  return {
    id: person.id,
    displayName,
    fullDisplayName,
    canonicalSurname: personSurname(person),
    ancestrySurname: personSurname(person),
    sex: personSex(person),
    fictional: false,
    lifeStatus: person.lifeStatus ?? PERSON_LIFE_STATUSES.alive,
  };
}

function fictionalNode(key, usedNames, { surname = null, ancestrySurname = null, sex = null } = {}) {
  const safeSex = sex === PERSON_SEXES.female || sex === PERSON_SEXES.male
    ? sex
    : (stableUnit(`fictional-sex:${key}`) < 0.5 ? PERSON_SEXES.female : PERSON_SEXES.male);
  let attempt = 0;
  let canonicalName = commonNameForSexKey(`ancestor:${key}`, safeSex, attempt);
  let displayName = localizePersonDisplayName(canonicalName);
  while (usedNames.has(displayName.toLowerCase()) && attempt < 1000) {
    attempt += 1;
    canonicalName = commonNameForSexKey(`ancestor:${key}`, safeSex, attempt);
    displayName = localizePersonDisplayName(canonicalName);
  }
  usedNames.add(displayName.toLowerCase());
  const id = `fictional-${stableHash(key).toString(16)}`;
  const canonicalDisplaySurname = canonicalSurname(surname) || generatedBaseSurname(id);
  const canonicalAncestrySurname = canonicalSurname(ancestrySurname) || canonicalDisplaySurname;
  const localizedSurname = localizePersonSurname(canonicalDisplaySurname);
  return {
    id,
    displayName,
    fullDisplayName: [displayName, localizedSurname].filter(Boolean).join(" "),
    canonicalSurname: canonicalDisplaySurname,
    ancestrySurname: canonicalAncestrySurname,
    sex: safeSex,
    fictional: true,
    lifeStatus: PERSON_LIFE_STATUSES.dead,
  };
}

function commonNameForSexKey(key, sex, attemptOffset = 0) {
  for (let offset = 0; offset < 1000; offset += 1) {
    const candidate = commonNameForKey(`${key}:${attemptOffset + offset}`, []);
    if (givenNameSex(candidate) === sex) return candidate;
  }
  return commonNameForKey(`${key}:fallback:${sex}`, []);
}

function distinctGeneratedSurname(key, avoided = []) {
  const avoidedSet = new Set((Array.isArray(avoided) ? avoided : [avoided])
    .map((value) => canonicalSurname(value).toLowerCase())
    .filter(Boolean));
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const candidate = generatedBaseSurname(`fictional-surname:${key}:${attempt}`);
    const components = candidate.split("-").map((part) => part.toLowerCase());
    if (!components.some((part) => avoidedSet.has(part))) return candidate;
  }
  return generatedBaseSurname(`fictional-surname:${key}:fallback`);
}

function combineSurnameComponents(first, second) {
  const firstPart = canonicalSurname(first).split("-")[0] ?? "";
  const secondPart = canonicalSurname(second).split("-")[0] ?? "";
  if (!firstPart) return secondPart;
  if (!secondPart || firstPart.toLowerCase() === secondPart.toLowerCase()) return firstPart;
  return `${firstPart}-${secondPart}`;
}

function canonicalSurname(value) {
  return String(value ?? "")
    .trim()
    .split("-")
    .map((part) => {
      const text = part.trim();
      return text ? `${text[0].toUpperCase()}${text.slice(1)}` : "";
    })
    .filter(Boolean)
    .slice(0, 2)
    .join("-");
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
