const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  ...expoConfig,
  {
    rules: {
      "no-unused-vars": "warn",
      "no-console": "warn",
    },
  },
  {
    ignores: ["node_modules/", ".expo/", "dist/"],
  },
]);
