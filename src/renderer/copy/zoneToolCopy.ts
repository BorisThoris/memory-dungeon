import { tr } from '../../shared/i18n';
/**
 * The Zone's dock button (`zone-rules.ts`): Ignite while the combo allows it, Resolve while a
 * Zone is open, and why it is greyed the rest of the time.
 */
export const ZONE_TOOL_COPY = {
    igniteLabel: tr.s('Ignite'),
    resolveLabel: tr.s('Resolve'),
    ready: (pairs: number): string => tr`Ignite the Zone: burn the combo, turn ${pairs * 2} cards with nothing resolving, then play them all at once`,
    open: (left: number): string => (left === 0 ? tr.s('Resolve the Zone now') : tr`Resolve the Zone now, or turn ${left} more`),
    tooCold: tr.s('Ignite: reach an Inferno combo first'),
    pendingFlip: tr.s('Ignite: nothing may be face up'),
    unavailable: tr.s('Ignite: wait for the floor to begin'),
    tooFewPairs: tr.s('Ignite: the floor needs two hidden pairs')
} as const;

/** The rail's line while a Zone is open. */
export const zoneRailLine = (up: number, cap: number): string => tr`Zone · ${up} of ${cap} cards`;

/** Cash in's dock button (`combo-cash-in-rules.ts`, `?combo2=1`): Bank while the pot holds something. */
export const CASH_IN_TOOL_COPY = {
    ready: (score: number, gold: number): string =>
        tr`Bank the pot: +${score.toLocaleString()} score and +${gold} gold, and the combo halves`,
    pendingFlip: tr.s('Bank between turns, with no card up')
} as const;
