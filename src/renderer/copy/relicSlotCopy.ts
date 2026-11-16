import { tr } from '../../shared/i18n';
/** The relic slots (`run-relic-rules.ts`, DGE-013): the choice a fifth relic asks, and the inventory's count. */
export const RELIC_SLOT_COPY = {
    title: tr.s('Every relic slot is held'),
    body: (slots: number): string => tr`A run carries ${slots} relics. Taking the Miser's Purse gives one up, and its ranks go with it.`,
    giveUp: (title: string, rank: number): string => (rank > 0 ? tr`Give up ${title} (rank ${rank})` : tr`Give up ${title}`),
    keep: tr.s('Keep them all'),
    slotsLine: (held: number, slots: number): string => tr`Relics: ${held} of ${slots} slots`
} as const;
