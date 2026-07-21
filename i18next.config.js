export default {
  locales: ["en", "ru"],
  defaultLocale: "en",
  input: ["src/**/*.{js,mjs}"],
  output: "public/locales/$LOCALE/$NAMESPACE.json",
  namespaceSeparator: ":",
  keySeparator: ".",
  lexers: {
    js: ["JavascriptLexer"],
  },
  keepRemoved: [
    /^common:language\./,
    /^hud:fullscreen\./,
    /^hud:language\./,
    /^hud:interaction\./,
    /^dialogue:homeGreeting\./,
    /^dialogue:validation\./,
  ],
};
