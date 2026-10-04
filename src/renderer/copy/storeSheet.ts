import type { StoreOfferRow } from '../../shared/run-store-rules';

/** The store stop, after every third floor (`run-store-rules.ts`). */
export const STORE_SHEET_COPY = {
    title: 'Camp',
    subtitle: (floor: number, gold: number): string =>
        `Floor ${floor} cleared. You have ${gold} gold to spend before you descend; prices climb with each thing you buy.`,
    /** The price on a row's own button; the row beside it already says what it is. */
    priceLabel: (row: StoreOfferRow): string => (row.blocked === 'max_rank' ? 'Max rank' : row.blocked === 'owned' ? 'Owned' : `${row.price} gold${row.essenceCost ? ` + ${row.essenceCost} essence` : ''}`),
    /** What a screen reader hears for that button, which cannot lean on the row it sits in. */
    buyAriaLabel: (row: StoreOfferRow): string =>
        row.blocked === 'max_rank' ? `${row.title}: max rank` : row.blocked === 'owned' ? `${row.title}: owned` : `Buy ${row.title.toLowerCase()} for ${row.price} gold${row.essenceCost ? ` and ${row.essenceCost} essence` : ''}`,
    rowBody: (row: StoreOfferRow): string =>
        row.blocked === 'essence' ? `${row.body} Needs ${row.essenceCost} essence; you hold ${row.essenceHeld}.`
            : row.blocked === 'prepared' ? `${row.body} A bottle is already prepared at this stop.`
            : row.blocked === 'owned'
            ? `${row.body} Yours for the rest of the run.`
            : row.blocked === 'full'
            ? `${row.body} Your bank is full.`
            : row.blocked === 'no_bank'
              ? `${row.body} This run has no miss bank to put one in.`
              : row.blocked === 'gold'
                ? `${row.body} ${row.price} gold; you are short.`
                : row.body,
    /**
     * Said once a purchase goes through. Nothing else on the sheet speaks when it does: the gold
     * lives in the subtitle and the new price on a button, and neither is a live region.
     */
    receipt: (row: StoreOfferRow, goldLeft: number): string =>
        row.rank !== undefined ? `Upgraded ${row.title} to rank ${row.rank + 1} of 3. ${goldLeft} gold left.`
            : row.kind === 'focus' ? `Forged ${row.title}. Its casts are stronger for this run. ${goldLeft} gold left.`
            : row.kind === 'prime' ? `Prepared ${row.title.toLowerCase()}. Match a different element to react. ${goldLeft} gold left.`
            : row.kind === 'relic'
            ? `Bought ${row.title}, yours for the rest of the run. ${goldLeft} gold left.`
            : `Bought ${row.title.toLowerCase()}. ${goldLeft} gold left.`,
    descend: 'Descend'
} as const;

/** The dock can arm before a flip or spend immediately on the one card already face up. */
export const BOMB_TOOL_COPY = {
    waiting: 'Bomb: choose a card to remove its pair',
    armed: 'Choose a card to bomb. Press Bomb again or Escape to cancel.',
    unavailable: 'Bomb: wait for the floor to begin',
    resolving: 'Bomb: finish the current pair first',
    lastPair: 'Bomb: the last pair must be matched',
    noPartner: 'Bomb: choose a card with a hidden matching partner',
    ready: 'Bomb this card: its pair leaves the board, no miss'
} as const;
