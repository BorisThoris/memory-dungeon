import type { StoreOfferRow } from '../../shared/run-store-rules';

/** The store stop, after every third floor (`run-store-rules.ts`). */
export const STORE_SHEET_COPY = {
    title: 'Store',
    subtitle: (floor: number, gold: number): string =>
        `Floor ${floor} cleared. You have ${gold} gold to spend before you descend; prices climb with each thing you buy.`,
    /** The price on a row's own button; the row beside it already says what it is. */
    priceLabel: (row: StoreOfferRow): string => (row.blocked === 'owned' ? 'Owned' : `${row.price} gold`),
    /** What a screen reader hears for that button, which cannot lean on the row it sits in. */
    buyAriaLabel: (row: StoreOfferRow): string =>
        row.blocked === 'owned' ? `${row.title}: owned` : `Buy ${row.title.toLowerCase()} for ${row.price} gold`,
    rowBody: (row: StoreOfferRow): string =>
        row.blocked === 'owned'
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
        row.kind === 'relic'
            ? `Bought ${row.title}, yours for the rest of the run. ${goldLeft} gold left.`
            : `Bought ${row.title.toLowerCase()}. ${goldLeft} gold left.`,
    descend: 'Descend'
} as const;

/** The dock's bomb (`applyBomb`): it aims at the one card face up, so it says so until there is one. */
export const BOMB_TOOL_COPY = {
    waiting: 'Flip a card first: a bomb takes the pair of the one card face up',
    ready: 'Bomb this card: its pair leaves the board, no miss'
} as const;
