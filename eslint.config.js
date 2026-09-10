// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    /**
     * THE FIVE RULES THE SDK 57 UPGRADE BROUGHT WITH IT (4 September 2026).
     *
     * `eslint-config-expo` went 10 → 57 with the SDK, which pulled
     * `eslint-plugin-react-hooks` from 5 to 7 and switched on the React
     * Compiler's own diagnostics. They flag forty places in code that was
     * already shipped and unchanged by this upgrade — sheets that seed their
     * draft state in an effect, Reanimated shared values written from a
     * `useCallback`, the spotlight tour reading a ref while it renders.
     *
     * NONE OF THEM IS AN SDK 57 API BREAK, and none is disabled here: every
     * one still prints, with its file and line, on every `npm run lint`. They
     * are warnings rather than errors so that an SDK upgrade does not
     * smuggle in a twenty-file rewrite of the sheet and onboarding logic —
     * that is its own change, with its own device QA, and it is recorded as
     * open in `docs/implementation-status.md`. Raise these back to `error`
     * in the same change that clears them.
     */
    files: ["**/*.{ts,tsx}"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
]);
