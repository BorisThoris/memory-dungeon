/**
 * What each tool in the run dock is called, and why it is greyed out when it is.
 *
 * A disabled power with no reason next to it is the most annoying thing a board can do, so these
 * strings do real work — they are the difference between "that button is broken" and "I need two
 * hidden tiles". Grouped by power so a translator sees each set of reasons together.
 */
export const ROW_SHUFFLE_COPY = {
    armed: 'Tap any tile to shuffle its row',
    idle: 'Shuffle one row of hidden tiles (uses 1 row/swap charge)',
    label: 'Row',
    noCharges: 'No row/swap charges',
    noRow: 'Need a row with hidden cards from different pairs',
    pendingFlip: 'Finish the current flip first',
    scholarContract: 'Scholar contract: row shuffle disabled'
} as const;

export const PEEK_COPY = {
    idle: 'Peek at a hidden tile',
    pendingFlip: 'Finish the current flip first',
    pinArmed: 'Turn off Pin before peeking',
    swapArmed: 'Finish or cancel Swap before peeking',
    unavailable: 'Peek is available while playing',
    noTargets: 'No hidden cards left to peek at'
} as const;

/** Tile swap: the other half of the row/swap charge. */
export const TILE_SWAP_COPY = {
    firstTile: 'Tap the first hidden tile to move',
    idle: 'Swap two hidden tiles (uses 1 row/swap charge)',
    needTwoHidden: 'Need two hidden tiles to swap',
    noCharges: 'No row/swap charges',
    peekArmed: 'Cancel Peek before swapping cards',
    pendingFlip: 'Finish the current flip first',
    scholarContract: 'Scholar contract: tile swap disabled',
    secondTile: 'Tap a second hidden tile to swap positions'
} as const;

/** Flash pair, which only carries charges in Practice and Wild runs. */
export const FLASH_PAIR_COPY = {
    idle: 'Briefly reveal a random hidden pair (practice / wild)',
    noCharges: 'No flash charges this floor',
    pendingFlip: 'Finish the current flip first'
} as const;

/** Full-board shuffle, as distinct from the row shuffle above. */
export const BOARD_SHUFFLE_COPY = {
    idle: 'Shuffle hidden tiles (1 charge this run)',
    needTwoPairs: 'Need at least two hidden pairs to shuffle',
    noCharges: 'No shuffle charges',
    pendingFlip: 'Finish the current flip first',
    scholarContract: 'Scholar contract: shuffle disabled'
} as const;

export const METEOR_TOOL_COPY = {
    armedTitle: 'Select a card for the meteor strike. Click Meteor again or press Escape to cancel without spending.',
    idleTitle: 'Spend one stored meteor: choose a card and strike the surrounding area.',
    armed: 'Select a card for your meteor. Tap Meteor again to cancel.'
} as const;
