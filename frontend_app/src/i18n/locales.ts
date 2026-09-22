export const APP_LOCALES = ['en', 'zh-CN'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export function isAppLocale(value: string): value is AppLocale {
  return (APP_LOCALES as readonly string[]).includes(value);
}

/** Map OS / navigator language to a bundled locale. */
export function detectSystemLocale(language = typeof navigator !== 'undefined' ? navigator.language : 'en'): AppLocale {
  const lower = language.toLowerCase();
  if (lower === 'zh' || lower.startsWith('zh-')) return 'zh-CN';
  return 'en';
}

/**
 * Resolve the effective UI locale.
 * `null` preference = follow the system (same pattern as `keyboardLayout`).
 */
export function resolveLocale(preference: AppLocale | null): AppLocale {
  return preference ?? detectSystemLocale();
}
