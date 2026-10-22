/** Reprise's dock button (`reprise-rules.ts`, DGE-019). */
export const REPRISE_TOOL_COPY = {
    label: 'Reprise',
    ready: (turns: number, matched: number): string =>
        `Reprise: your last ${turns} turns pay again - ${matched} ${matched === 1 ? 'match' : 'matches'}${matched < turns ? `, and ${turns - matched} ${turns - matched === 1 ? 'miss' : 'misses'} to pay for` : ''}`,
    used: 'Reprise: used on this floor',
    filling: (have: number, need: number): string => `Reprise: ${have} of ${need} turns played this floor`,
    pendingFlip: 'Reprise: nothing may be face up'
} as const;
