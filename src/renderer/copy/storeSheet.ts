import { tr } from '../../shared/i18n';
import type { StoreOfferRow } from '../../shared/run-store-rules';

/** The store stop, after every third floor (`run-store-rules.ts`). */
export const STORE_SHEET_COPY = {
    title: tr.s('Camp'),
    subtitle: (floor: number, gold: number): string =>
        tr`Floor ${floor} cleared. You have ${gold} gold to spend before you descend; prices climb with each thing you buy.`,
    /** The price on a row's own button; the row beside it already says what it is. */
    priceLabel: (row: StoreOfferRow): string => (row.blocked === 'max_rank' ? tr.s('Max rank') : row.blocked === 'owned' ? tr.s('Owned') : row.blocked === 'slots' ? tr.s('No slot') : tr`${row.price} gold${row.essenceCost ? tr` + ${row.essenceCost} essence` : ''}`),
    /** What a screen reader hears for that button, which cannot lean on the row it sits in. */
    buyAriaLabel: (row: StoreOfferRow): string =>
        row.blocked === 'max_rank' ? tr`${row.title}: max rank` : row.blocked === 'owned' ? tr`${row.title}: owned` : tr`Buy ${row.title.toLowerCase()} for ${row.price} gold${row.essenceCost ? tr` and ${row.essenceCost} essence` : ''}`,
    rowBody: (row: StoreOfferRow): string =>
        row.blocked === 'essence' ? tr`${row.body} Needs ${row.essenceCost} essence; you hold ${row.essenceHeld}.`
            : row.blocked === 'prepared' ? tr`${row.body} A bottle is already prepared at this stop.`
            : row.blocked === 'owned'
            ? tr`${row.body} Yours for the rest of the run.`
            : row.blocked === 'full'
            ? tr`${row.body} You hold all the lives you can.`
            : row.blocked === 'no_bank'
              ? tr`${row.body} This run has no lives to add to.`
              : row.blocked === 'gold'
                ? tr`${row.body} ${row.price} gold; you are short.`
                : row.body,
    /**
     * Said once a purchase goes through. Nothing else on the sheet speaks when it does: the gold
     * lives in the subtitle and the new price on a button, and neither is a live region.
     */
    receipt: (row: StoreOfferRow, goldLeft: number): string =>
        row.rank !== undefined ? tr`Upgraded ${row.title} to rank ${row.rank + 1} of 3. ${goldLeft} gold left.`
            : row.kind === 'focus' ? tr`Forged ${row.title}. Its casts are stronger for this run. ${goldLeft} gold left.`
            : row.kind === 'prime' ? tr`Prepared ${row.title.toLowerCase()}. Match a different element to react. ${goldLeft} gold left.`
            : row.kind === 'relic'
            ? tr`Bought ${row.title}, yours for the rest of the run. ${goldLeft} gold left.`
            : tr`Bought ${row.title.toLowerCase()}. ${goldLeft} gold left.`,
    descend: tr.s('Descend')
} as const;

/** The dock can arm before a flip or spend immediately on the one card already face up. */
export const BOMB_TOOL_COPY = {
    waiting: tr.s('Bomb: choose a card to remove its pair'),
    armed: tr.s('Choose a card to bomb. Press Bomb again or Escape to cancel.'),
    unavailable: tr.s('Bomb: wait for the floor to begin'),
    resolving: tr.s('Bomb: finish the current pair first'),
    lastPair: tr.s('Bomb: the last pair must be matched'),
    noPartner: tr.s('Bomb: choose a card with a hidden matching partner'),
    ready: tr.s('Bomb this card: its pair leaves the board, no miss')
} as const;
