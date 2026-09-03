/**
 * The row-shuffle power's dock label and its reasons for being unavailable.
 *
 * "Row" reads as the counterpart to "Swap" in the dock, and both spend the same charge — the game
 * calls that currency "row/swap" everywhere else, so the two buttons standing next to each other
 * is what makes the name make sense.
 */
export const ROW_SHUFFLE_COPY = {
    armed: 'Tap any tile to shuffle its row',
    idle: 'Shuffle one row of hidden tiles (uses 1 row/swap charge)',
    label: 'Row',
    noCharges: 'No row/swap charges',
    noRow: 'Need a row with two hidden tiles',
    pendingFlip: 'Finish the current flip first',
    scholarContract: 'Scholar contract: row shuffle disabled'
} as const;
