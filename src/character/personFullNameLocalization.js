import { personGivenName, personSurname } from "./personFamilyNames.js";
import { localizePersonDisplayName } from "./personNameLocalization.js";

export function localizePersonSurname(value, language) {
  return String(value ?? "")
    .split("-")
    .map((part) => localizePersonDisplayName(part.trim(), language))
    .filter(Boolean)
    .join("-");
}

export function localizePersonFullName(person, language) {
  const givenName = localizePersonDisplayName(personGivenName(person), language);
  const surname = localizePersonSurname(personSurname(person), language);
  return [givenName, surname].filter(Boolean).join(" ");
}

export function localizeStoredPersonFullName(value, language) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const [givenName = "", ...surnameParts] = text.split(/\s+/u);
  const localizedGivenName = localizePersonDisplayName(givenName, language);
  const localizedSurname = localizePersonSurname(surnameParts.join(" "), language);
  return [localizedGivenName, localizedSurname].filter(Boolean).join(" ");
}
