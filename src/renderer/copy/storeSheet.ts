import type { StoreOfferRow } from '../../shared/run-store-rules';

/** The store stop, after every third floor (`run-store-rules.ts`). */
export const STORE_SHEET_COPY = {
    title: 'Store',
    subtitle: (floor: number, gold: number): string =>
        `Floor ${floor} cleared. You have ${gold} gold to spend before you descend; prices climb with each thing you buy.`,
    buyAction: (row: StoreOfferRow): string =>
        row.blocked === 'owned' ? `${row.title} · owned` : `${row.title} · ${row.price} gold`,
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
    descend: 'Descend'
} as const;

/** The dock's bomb (`applyBomb`): it aims at the one card face up, so it says so until there is one. */
export const BOMB_TOOL_COPY = {
    waiting: 'Flip a card first: a bomb takes the pair of the one card face up',
    ready: 'Bomb this card: its pair leaves the board, no miss'
} as const;
