import type { MascotId } from './mascots.data';

/** English mascot texts; `mascots.data.ts` (generated) remains the French source. */
export const MASCOTS_EN: Record<MascotId, { tagline: string; description: string }> = {
  miko: {
    tagline: 'the friendly cat',
    description: 'A safe bet: familiar, easy to animate, its tail carries all the mood. The most “cuddly toy” of the set.',
  },
  poum: {
    tagline: 'the soft panda',
    description: 'Big eye patches, large shiny eyes, pink cheeks: the most huggable of the series, and readable even at 32 px.',
  },
  lumi: {
    tagline: 'the guiding star',
    description: 'A symbol shape: works as a logo as well as a character, and doubles as a success gauge.',
  },
  tico: {
    tagline: 'the chatty bird',
    description: 'Its big beak makes it the best “talker”: ideal if the mascot has to give instructions.',
  },
  ourso: {
    tagline: 'the reassuring bear',
    description: 'The most comforting: big, slow, protective. Perfect for the youngest and for moments of failure.',
  },
  croa: {
    tagline: 'the jumping frog',
    description: 'Big eyes on top of the head: the funniest to animate, and the most energetic of the series.',
  },
  octo: {
    tagline: 'the playful octopus',
    description: 'Eight arms = eight ways to show, point, clap. The most useful for guiding the child on screen.',
  },
  piko: {
    tagline: 'the shy hedgehog',
    description: 'A very recognisable silhouette and a rare story hook: it hides, then reveals itself when the child succeeds.',
  },
  rex: {
    tagline: 'the curious dino',
    description: 'The absolute favourite of 4–7 year olds. Crest and tail give lots of animation material without cluttering the face.',
  },
  zim: {
    tagline: 'the busy bee',
    description: 'Small, fast, it flies: the only one that can land anywhere in the interface without getting in the way of the game.',
  },
};
