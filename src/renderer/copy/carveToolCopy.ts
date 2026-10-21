import type { CarveDirection } from '../../shared/contracts';

/** Carve's dock button, its direction picker, and the arrow on the board (`carve-rules.ts`, DGE-015). */
export const CARVE_TOOL_COPY = {
    label: 'Carve',
    ready: (links: number): string => `Carve: spend ${links} chain links to aim your next pop`,
    filling: (have: number, need: number): string => `Carve: ${have} of ${need} chain links`,
    set: (direction: CarveDirection): string => `Carved ${direction}: the next pop walks that way first`,
    pendingFlip: 'Carve: nothing may be face up',
    pickerTitle: 'Carve',
    pickerBody: (links: number): string =>
        `Spend ${links} chain links: your next pop takes the cards that way first and reaches one further. Arrow keys pick a way.`,
    direction: { up: 'Up', right: 'Right', down: 'Down', left: 'Left' } as Record<CarveDirection, string>,
    cancel: 'Keep the links',
    arrow: (direction: CarveDirection): string => `Carved ${direction}`
} as const;

/** The arrow drawn for each way. */
export const CARVE_ARROW: Record<CarveDirection, string> = { up: '\u2191', right: '\u2192', down: '\u2193', left: '\u2190' };
