import { plural, tr } from '../../shared/i18n';
/**
 * The Hold's dock button (`hold-rules.ts`, DGE-008): Hold once six links arm it, Release while held,
 * and why it is greyed the rest of the time.
 */
export const HOLD_TOOL_COPY = {
    holdLabel: tr.s('Hold'),
    releaseLabel: tr.s('Release'),
    ready: tr.s('Hold: the pairs you match keep their pops until you release them, all at once'),
    filling: (segments: number, of: number): string => tr`Hold: ${segments} of ${of} chain links to arm it`,
    held: (pairs: number): string =>
        pairs === 0 ? tr.s('Release: nothing held yet; match a pair to hold its pop') : tr`Release ${plural(pairs, { one: '{0} held pair', other: '{0} held pairs' })}: every one breaks at once`,
    pendingFlip: tr.s('Hold: nothing may be face up')
} as const;
