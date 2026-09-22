import { MASCOTS, type MascotDef, type MascotId } from './mascots.data';

export const DEFAULT_MASCOT: MascotId = 'miko';

export function getMascot(id: string | undefined): MascotDef {
  return MASCOTS.find((m) => m.id === id) ?? MASCOTS.find((m) => m.id === DEFAULT_MASCOT)!;
}
