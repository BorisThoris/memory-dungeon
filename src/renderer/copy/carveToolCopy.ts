import { tr } from '../../shared/i18n';
import type { CarveDirection } from '../../shared/contracts';

/** Carve's dock button, its direction picker, and the arrow on the board (`carve-rules.ts`, DGE-015). */
export const CARVE_TOOL_COPY = {
    label: tr.s('Carve'),
    ready: (links: number): string => tr`Carve: spend ${links} chain links to aim your next pop`,
    filling: (have: number, need: number): string => tr`Carve: ${have} of ${need} chain links`,
    set: (direction: CarveDirection): string => tr`Carved ${direction}: the next pop walks that way first`,
    pendingFlip: tr.s('Carve: nothing may be face up'),
    pickerTitle: tr.s('Carve'),
    pickerBody: (links: number): string =>
        tr`Spend ${links} chain links: your next pop takes the cards that way first and reaches one further. Arrow keys pick a way.`,
    direction: { up: tr.s('Up'), right: tr.s('Right'), down: tr.s('Down'), left: tr.s('Left') } as Record<CarveDirection, string>,
    cancel: tr.s('Keep the links'),
    arrow: (direction: CarveDirection): string => tr`Carved ${direction}`
} as const;

/** The arrow drawn for each way. */
export const CARVE_ARROW: Record<CarveDirection, string> = { up: '\u2191', right: '\u2192', down: '\u2193', left: '\u2190' };
