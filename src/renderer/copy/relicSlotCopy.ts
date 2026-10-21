/** The relic slots (`run-relic-rules.ts`, DGE-013): the choice a fifth relic asks, and the inventory's count. */
export const RELIC_SLOT_COPY = {
    title: 'Every relic slot is held',
    body: (slots: number): string => `A run carries ${slots} relics. Taking the Miser's Purse gives one up, and its ranks go with it.`,
    giveUp: (title: string, rank: number): string => (rank > 0 ? `Give up ${title} (rank ${rank})` : `Give up ${title}`),
    keep: 'Keep them all',
    slotsLine: (held: number, slots: number): string => `Relics: ${held} of ${slots} slots`
} as const;
