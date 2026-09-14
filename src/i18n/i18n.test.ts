import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectLang, localeOf, resolveLang, t, tr } from './index';
import { LANGS, STRINGS, type StringKey } from './strings';

/**
 * FR is the reference dictionary and the type already forces EN to define
 * every key. What the type cannot catch: an empty string left as a
 * placeholder, or an interpolation parameter present in one language only.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

const KEYS = Object.keys(STRINGS.fr) as StringKey[];

/** `{name}` placeholders used by a string. */
function params(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe('dictionaries', () => {
  it('define the same keys in every language', () => {
    for (const lang of LANGS) {
      expect(Object.keys(STRINGS[lang]).sort(), `${lang} does not have the same keys as fr`).toEqual([...KEYS].sort());
    }
  });

  it('have no empty string', () => {
    for (const lang of LANGS) {
      const empty = KEYS.filter((k) => !STRINGS[lang][k]?.trim());
      expect(empty, `empty keys in ${lang}: ${empty.join(', ')}`).toEqual([]);
    }
  });

  it('use the same interpolation parameters in every language', () => {
    const mismatched = KEYS.filter((k) => {
      const reference = params(STRINGS.fr[k]);
      return LANGS.some((lang) => params(STRINGS[lang][k]).join() !== reference.join());
    });
    expect(mismatched, `parameters differ between languages: ${mismatched.join(', ')}`).toEqual([]);
  });
});

describe('t', () => {
  it('returns the string for the requested language', () => {
    expect(t('fr', 'common.play')).toBe(STRINGS.fr['common.play']);
    expect(t('en', 'common.play')).toBe(STRINGS.en['common.play']);
  });

  it('interpolates the parameters it is given', () => {
    expect(t('en', 'stars.ofThree', { n: 2 })).toContain('2');
    expect(t('en', 'levels.ofTotal', { n: 1, total: 3 })).toBe('1 of 3 levels');
  });

  it('leaves an unknown placeholder untouched', () => {
    // A missing parameter must stay visible rather than becoming "undefined".
    expect(t('en', 'levels.ofTotal', { n: 1 })).toContain('{total}');
  });

  it('returns the raw string when no parameter is given', () => {
    expect(t('en', 'levels.ofTotal')).toBe(STRINGS.en['levels.ofTotal']);
  });

  it('falls back to French for a key missing from the other language', () => {
    const key = '__missing__' as StringKey;
    const backup = STRINGS.fr[key];
    STRINGS.fr[key] = 'secours';
    try {
      expect(t('en', key)).toBe('secours');
    } finally {
      if (backup === undefined) delete STRINGS.fr[key];
      else STRINGS.fr[key] = backup;
    }
  });
});

describe('tr', () => {
  it('picks the requested language', () => {
    expect(tr({ fr: 'Cerf-volant', en: 'Kite' }, 'fr')).toBe('Cerf-volant');
    expect(tr({ fr: 'Cerf-volant', en: 'Kite' }, 'en')).toBe('Kite');
  });

  it('falls back to French when the language is missing', () => {
    expect(tr({ fr: 'Cerf-volant' } as unknown as { fr: string; en: string }, 'en')).toBe('Cerf-volant');
  });
});

describe('detectLang', () => {
  it('follows the browser languages', () => {
    vi.stubGlobal('navigator', { languages: ['fr-FR', 'en-US'], language: 'fr-FR' });
    expect(detectLang()).toBe('fr');
  });

  it('matches on the base tag', () => {
    vi.stubGlobal('navigator', { languages: ['en-GB'], language: 'en-GB' });
    expect(detectLang()).toBe('en');
  });

  it('skips unsupported languages and takes the first supported one', () => {
    vi.stubGlobal('navigator', { languages: ['de-DE', 'fr-CA'], language: 'de-DE' });
    expect(detectLang()).toBe('fr');
  });

  it('falls back to English when nothing matches', () => {
    vi.stubGlobal('navigator', { languages: ['de-DE'], language: 'de-DE' });
    expect(detectLang()).toBe('en');
  });

  it('falls back to `language` when the list is empty', () => {
    vi.stubGlobal('navigator', { languages: [], language: 'fr-FR' });
    expect(detectLang()).toBe('fr');
  });
});

describe('resolveLang', () => {
  it('prefers the stored language', () => {
    vi.stubGlobal('navigator', { languages: ['en-US'], language: 'en-US' });
    expect(resolveLang('fr')).toBe('fr');
  });

  it('detects when nothing is stored', () => {
    vi.stubGlobal('navigator', { languages: ['fr-FR'], language: 'fr-FR' });
    expect(resolveLang(null)).toBe('fr');
    expect(resolveLang(undefined)).toBe('fr');
  });

  it('detects when the stored value is not a supported language', () => {
    vi.stubGlobal('navigator', { languages: ['fr-FR'], language: 'fr-FR' });
    expect(resolveLang('de' as unknown as 'fr')).toBe('fr');
  });
});

describe('localeOf', () => {
  it('maps to a BCP 47 locale', () => {
    expect(localeOf('fr')).toBe('fr-FR');
    expect(localeOf('en')).toBe('en-GB');
  });
});
