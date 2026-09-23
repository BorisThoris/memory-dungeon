import type { StoreOfferRow } from '../../shared/run-store-rules';

/** The store sheet on the pause menu (`run-store-rules.ts`). */
export const STORE_SHEET_COPY = {
    title: 'Store',
    subtitle: (gold: number): string => `You have ${gold} gold. Prices climb with each thing you buy this run.`,
    /** The pause menu's entry, carrying the purse so the player knows whether it is worth opening. */
    pauseAction: (gold: number): string => `Store · ${gold} gold`,
    buyAction: (row: StoreOfferRow): string => `${row.title} · ${row.price} gold`,
    rowBody: (row: StoreOfferRow): string =>
        row.blocked === 'full'
            ? `${row.body} You have all four.`
            : row.blocked === 'no_bank'
              ? `${row.body} This run has no miss bank to put one in.`
              : row.blocked === 'gold'
                ? `${row.body} ${row.price} gold; you are short.`
                : row.body,
    back: 'Back'
} as const;
