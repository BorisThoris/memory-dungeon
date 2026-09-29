/**
 * The Zone's dock button (`zone-rules.ts`): Ignite while the combo allows it, Resolve while a
 * Zone is open, and why it is greyed the rest of the time.
 */
export const ZONE_TOOL_COPY = {
    igniteLabel: 'Ignite',
    resolveLabel: 'Resolve',
    ready: (pairs: number): string => `Ignite the Zone: burn the combo, turn ${pairs * 2} cards with nothing resolving, then play them all at once`,
    open: (left: number): string => (left === 0 ? 'Resolve the Zone now' : `Resolve the Zone now, or turn ${left} more`),
    tooCold: 'Ignite: reach an Inferno combo first',
    pendingFlip: 'Ignite: nothing may be face up',
    unavailable: 'Ignite: wait for the floor to begin',
    tooFewPairs: 'Ignite: the floor needs two hidden pairs'
} as const;

/** The rail's line while a Zone is open. */
export const zoneRailLine = (up: number, cap: number): string => `Zone · ${up} of ${cap} cards`;
