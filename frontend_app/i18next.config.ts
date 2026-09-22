import { defineConfig } from 'i18next-cli';

/**
 * Extraction / sync config for MindForge UI strings.
 *
 * Conventions (parser-friendly):
 * - Always call `t('static.key')` or `t('static.key', { defaultValue: '…' })`
 *   with a string-literal key. No `` t(`foo.${id}`) ``.
 * - Dynamic ids (shortcuts, menu) go through a switch / explicit map whose
 *   branches each contain a literal `t('…')` so the CLI can see them.
 * - `i18n.t(...)` outside React is also extracted (`*.t`).
 *
 * Commands (from frontend_app/):
 *   pnpm i18n:extract   — scan source, update locale JSON
 *   pnpm i18n:sync      — align secondary locales to English key set
 *   pnpm i18n:status    — translation coverage report
 */
export default defineConfig({
  locales: ['en', 'zh-CN'],
  extract: {
    input: ['src/**/*.{ts,tsx}'],
    ignore: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/__tests__/**'],
    // Single flat file per language (resources loaded as `translation` in i18n/index.ts).
    output: 'src/i18n/locales/{{language}}.json',
    defaultNS: false,
    keySeparator: '.',
    nsSeparator: false,
    functions: ['t', '*.t'],
    useTranslationNames: ['useTranslation'],
    sort: true,
    indentation: 2,
    primaryLanguage: 'en',
    secondaryLanguages: ['zh-CN'],
    // Prefer defaultValue from call sites; otherwise leave empty for translators.
    defaultValue: (key, _namespace, language, value) => {
      if (value) return value;
      if (language === 'en') return '';
      return '';
    },
    // Count is used for interpolation only (relativeTime), not ICU plurals.
    disablePlurals: true,
    // Keep hand-maintained translations while we migrate; turn on once every
    // key is referenced from source via a literal t()/i18n.t() call.
    removeUnusedKeys: false,
    extractFromComments: false,
  },
});
