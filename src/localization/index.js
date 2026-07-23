import i18next from "i18next";
import HttpBackend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";
import ICU from "i18next-icu";
import {
  FALLBACK_LANGUAGE,
  LOCALIZATION_NAMESPACES,
  LOCALE_REGISTRY,
  STORAGE_KEY,
  SUPPORTED_LOCALES,
  getLocaleRecord,
  normalizeLanguageCode,
} from "./locales.js";

function baseUrl() {
  return import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
}

function syncDocumentLocale(locale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale.code;
  document.documentElement.dir = locale.direction;
}

export async function createLocalization(options = {}) {
  const listeners = new Set();
  const instance = i18next.createInstance();
  let destroyed = false;
  let currentLanguage = FALLBACK_LANGUAGE;

  instance.use(ICU).use(HttpBackend).use(LanguageDetector);
  instance.on("failedLoading", (lng, ns, message) => {
    console.error(`Failed to load locale ${lng}/${ns}: ${message}`);
  });

  await instance.init({
    supportedLngs: SUPPORTED_LOCALES,
    fallbackLng: FALLBACK_LANGUAGE,
    load: "languageOnly",
    nonExplicitSupportedLngs: true,
    ns: LOCALIZATION_NAMESPACES,
    defaultNS: "common",
    fallbackNS: "common",
    backend: { loadPath: `${baseUrl()}locales/{{lng}}/{{ns}}.json` },
    detection: {
      order: ["localStorage"],
      lookupLocalStorage: STORAGE_KEY,
      caches: ["localStorage"],
      excludeCacheFor: [],
    },
    lng: options.language ? normalizeLanguageCode(options.language) : undefined,
    interpolation: { escapeValue: false },
    returnEmptyString: false,
    saveMissing: Boolean(options.saveMissing),
    debug: Boolean(options.debug),
  });

  currentLanguage = normalizeLanguageCode(instance.resolvedLanguage || instance.language);
  if (instance.language !== currentLanguage) await instance.changeLanguage(currentLanguage);
  syncDocumentLocale(getLocaleRecord(currentLanguage));

  async function changeLanguage(languageCode) {
    if (destroyed) return currentLanguage;
    const next = normalizeLanguageCode(languageCode);
    if (next === currentLanguage) return currentLanguage;
    await instance.changeLanguage(next);
    currentLanguage = normalizeLanguageCode(instance.resolvedLanguage || instance.language);
    syncDocumentLocale(getLocaleRecord(currentLanguage));
    for (const listener of [...listeners]) listener(currentLanguage, getLocaleRecord(currentLanguage));
    return currentLanguage;
  }

  return {
    t(key, values) {
      const result = instance.t(key, values);
      if (result === key && import.meta.env.DEV) console.warn(`Missing localization key: ${key}`);
      return result || instance.t(key, { ...values, lng: FALLBACK_LANGUAGE }) || key;
    },
    changeLanguage,
    getLanguage() { return currentLanguage; },
    getLocale() { return getLocaleRecord(currentLanguage); },
    getSupportedLocales() { return LOCALE_REGISTRY.map((locale) => ({ ...locale })); },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      destroyed = true;
      listeners.clear();
      instance.off();
    },
  };
}
