import { selectCurrentProfile, useAppState } from '../store/store';
import type { Profile } from '../store/types';

/** To be used only under <RequireProfile>: the profile is guaranteed. */
export function useCurrentProfile(): Profile {
  const profile = selectCurrentProfile(useAppState());
  if (!profile) throw new Error('No profile selected');
  return profile;
}
