import type { Lang } from '../i18n/strings';
import type { MascotDef } from './mascots.data';
import { MASCOTS_EN } from './mascots.en';

/** A mascot's tagline and description in the requested language. */
export function mascotText(m: MascotDef, lang: Lang): { tagline: string; description: string } {
  if (lang === 'en') return MASCOTS_EN[m.id];
  return { tagline: m.tagline, description: m.description };
}
