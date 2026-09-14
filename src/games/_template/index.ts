import { defineGame, setting, type LevelBase, type SettingValues } from '../types';
import { Game } from './Game';
import { simulate } from './simulate';

/** Réglages propres à ce jeu, par niveau. */
export interface TemplateLevel extends LevelBase {
  /** Exemple : durée de souffle cumulée à atteindre. */
  targetMs: number;
}

/**
 * Réglages parents (optionnel) : affichés dans l'espace parents, mémorisés,
 * reçus résolus dans `props.settings`. Supprimer si le jeu n'en a pas.
 */
export const SETTINGS = {
  speed: setting.range({ label: { fr: 'Vitesse', en: 'Speed' }, default: 1, min: 0.5, max: 2, step: 0.1, unit: '×' }),
  helper: setting.toggle({ label: { fr: 'Aide visuelle', en: 'Visual helper' }, default: true }),
};
export type TemplateSettings = SettingValues<typeof SETTINGS>;

export default defineGame<TemplateLevel, typeof SETTINGS>({
  id: 'template',
  title: { fr: 'Nouveau jeu', en: 'New game' },
  description: {
    fr: 'Décrivez ici ce que travaille le jeu (pour les parents).',
    en: 'Describe here what the game trains (for parents).',
  },
  instruction: {
    fr: 'Souffle pour jouer !',
    en: 'Blow to play!',
  },
  pattern: 'free',
  accent: '#ffd93d',
  order: 999,
  levels: [
    { id: '1', targetMs: 2000 },
    { id: '2', targetMs: 4000 },
    { id: '3', targetMs: 6000 },
  ],
  settings: SETTINGS,
  Game,
  simulate,
});
