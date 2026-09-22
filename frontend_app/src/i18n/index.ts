import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';
import { isAppLocale, resolveLocale, type AppLocale } from './locales';

export type { AppLocale } from './locales';
export { APP_LOCALES, detectSystemLocale, isAppLocale, resolveLocale } from './locales';

const resources = {
  en: { translation: en },
  'zh-CN': { translation: zhCN },
} as const;

/** Peek persisted preference before React / zustand hydrate. */
function peekStoredLocalePreference(): AppLocale | null {
  try {
    const raw = localStorage.getItem('mindforge-ui');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { locale?: unknown } };
    const value = parsed.state?.locale;
    if (value == null) return null;
    if (typeof value === 'string' && isAppLocale(value)) return value;
  } catch {
    /* private mode / corrupt */
  }
  return null;
}

const initialLng = resolveLocale(peekStoredLocalePreference());

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLng,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  // Missing keys surface as the key in dev; keep English fallback for prod.
  returnNull: false,
});

/** Apply a stored preference (`null` = system) to i18next. */
export async function applyLocalePreference(preference: AppLocale | null): Promise<AppLocale> {
  const next = resolveLocale(preference);
  if (i18n.language !== next) {
    await i18n.changeLanguage(next);
  }
  return next;
}

export default i18n;
