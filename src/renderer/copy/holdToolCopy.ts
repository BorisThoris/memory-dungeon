/**
 * The Hold's dock button (`hold-rules.ts`, DGE-008): Hold once six links arm it, Release while held,
 * and why it is greyed the rest of the time.
 */
export const HOLD_TOOL_COPY = {
    holdLabel: 'Hold',
    releaseLabel: 'Release',
    ready: 'Hold: the pairs you match keep their pops until you release them, all at once',
    filling: (segments: number, of: number): string => `Hold: ${segments} of ${of} chain links to arm it`,
    held: (pairs: number): string =>
        pairs === 0 ? 'Release: nothing held yet; match a pair to hold its pop' : `Release ${pairs} held ${pairs === 1 ? 'pair' : 'pairs'}: every one breaks at once`,
    pendingFlip: 'Hold: nothing may be face up'
} as const;
