import type { Slot } from '../engine/outfits';

// Module-level so locks and shuffle survive a trip to the closet and back.
export const today = $state<{ locked: Partial<Record<Slot, string>>; seed: number }>({ locked: {}, seed: 0 });
