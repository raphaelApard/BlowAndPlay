import { useAppState, actions, getAppState } from '../store/store';
import { LANGS, STRINGS, type Lang, type Localized, type StringKey } from './strings';

export type { Lang, Localized, StringKey } from './strings';
export { LANGS } from './strings';

type Params = Record<string, string | number>;

/** The browser language mapped to one of the app's languages; English by default. */
export function detectLang(): Lang {
  const candidates = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of candidates) {
    const base = (tag ?? '').toLowerCase().split('-')[0] as Lang;
    if (LANGS.includes(base)) return base;
  }
  return 'en';
}

export function resolveLang(stored: Lang | null | undefined): Lang {
  return stored && LANGS.includes(stored) ? stored : detectLang();
}

/** Langue courante hors React (boucles de rendu, fonctions utilitaires). */
export function getLang(): Lang {
  return resolveLang(getAppState().settings.lang);
}

export function useLang(): Lang {
  return resolveLang(useAppState().settings.lang);
}

export function setLang(lang: Lang) {
  actions.setLang(lang);
}

function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** Translated string. Falls back to French if the key is missing in the requested language. */
export function t(lang: Lang, key: StringKey, params?: Params): string {
  return interpolate(STRINGS[lang][key] ?? STRINGS.fr[key], params);
}

/** Localized text provided by data (game, mascot, setting). */
export function tr(text: Localized, lang: Lang): string {
  return text[lang] ?? text.fr;
}

export type Translate = (key: StringKey, params?: Params) => string;

/** `const { t, tr, lang } = useT()`: translation bound to the current language. */
export function useT(): { t: Translate; tr: (text: Localized) => string; lang: Lang } {
  const lang = useLang();
  return { lang, t: (key, params) => t(lang, key, params), tr: (text) => tr(text, lang) };
}

/** Locale BCP 47 pour `toLocaleString` et consorts. */
export function localeOf(lang: Lang): string {
  return lang === 'fr' ? 'fr-FR' : 'en-GB';
}
