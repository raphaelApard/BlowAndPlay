import { selectCurrentProfile, useAppState } from '../store/store';
import type { Profile } from '../store/types';

/** À utiliser uniquement sous <RequireProfile> : le profil est garanti. */
export function useCurrentProfile(): Profile {
  const profile = selectCurrentProfile(useAppState());
  if (!profile) throw new Error('Aucun profil sélectionné');
  return profile;
}
