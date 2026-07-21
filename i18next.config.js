export default {
  locales: ["en", "ru"],
  extract: {
    input: ["src/**/*.{js,mjs}"],
    output: "public/locales/{{language}}/{{namespace}}.json",
    defaultNS: "common",
    nsSeparator: ":",
    keySeparator: ".",
    primaryLanguage: "en",
    secondaryLanguages: ["ru"],
    removeUnusedKeys: false,
    preservePatterns: ["common:*", "hud:*", "dialogue:*"],
    extractFromComments: false,
  },
  lint: {
    checkInterpolationParams: true,
  },
};
