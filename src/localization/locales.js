export const STORAGE_KEY = "nestledburrow.language";
export const FALLBACK_LANGUAGE = "en";
export const LOCALIZATION_NAMESPACES = Object.freeze(["common", "hud", "dialogue"]);

export const LOCALE_REGISTRY = Object.freeze([
  Object.freeze({ code: "en", label: "EN", direction: "ltr", fontKey: "rubik-regular" }),
  Object.freeze({ code: "ru", label: "RU", direction: "ltr", fontKey: "rubik-regular" }),
]);

export const SUPPORTED_LOCALES = Object.freeze(LOCALE_REGISTRY.map((locale) => locale.code));

export function normalizeLanguageCode(languageCode) {
  if (typeof languageCode !== "string") return FALLBACK_LANGUAGE;
  const base = languageCode.trim().toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LOCALES.includes(base) ? base : FALLBACK_LANGUAGE;
}

export function getLocaleRecord(languageCode) {
  const normalized = normalizeLanguageCode(languageCode);
  return LOCALE_REGISTRY.find((locale) => locale.code === normalized) ?? LOCALE_REGISTRY[0];
}
