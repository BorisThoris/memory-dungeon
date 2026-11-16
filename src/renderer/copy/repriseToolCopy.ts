import { plural, tr } from '../../shared/i18n';
/** Reprise's dock button (`reprise-rules.ts`, DGE-019). */
export const REPRISE_TOOL_COPY = {
    label: tr.s('Reprise'),
    ready: (turns: number, matched: number): string =>
        tr`Reprise: your last ${turns} turns pay again - ${plural(matched, { one: '{0} match', other: '{0} matches' })}${matched < turns ? tr`, and ${turns - matched} ${turns - matched === 1 ? tr.s('miss') : tr.s('misses')} to pay for` : ''}`,
    used: tr.s('Reprise: used on this floor'),
    filling: (have: number, need: number): string => tr`Reprise: ${have} of ${need} turns played this floor`,
    pendingFlip: tr.s('Reprise: nothing may be face up')
} as const;
