import type { RunState } from '../../shared/contracts';
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

/** What a Curio held, in its drop balloon (`itemDropFeed.ts`). */
export const CURIO_DROP_COPY = {
    crucible: { title: 'CRUCIBLE', line: 'Melt a pair; its element pours out as another' },
    storm_glass: { title: 'STORM GLASS', line: 'Break it: the realm\'s peak strikes when you choose' },
    misers_purse: { title: "MISER'S PURSE", line: 'On offer in your dock: double gold, one miss fewer' }
} as const;

/**
 * How to use a curio item, said under the board while one is held and not yet used this run
 * (`RunShell`'s caption, when nothing else is being said). The drop balloon names it for two seconds;
 * this stays until the player has tried it.
 */
export const CURIO_HINT_COPY = {
    crucible: 'Crucible in hand: turn a card over, then press Crucible to melt its pair and recast its element.',
    storm_glass: 'Storm Glass in hand: on a realm floor with nothing face up, press it to call the storm now.',
    misers_purse: "Miser's Purse on offer: press Purse to take it up - double gold from every clear, one miss fewer."
} as const;

/** The curio item to explain now, if any: the first one held and not yet tried this run. */
export const curioItemHint = (run: Pick<RunState, 'status' | 'crucibleCharges' | 'crucibleUsesThisRun' | 'stormGlassCharges' | 'stormGlassUsesThisRun' | 'misersPurseOffers'>): string | null => {
    if (run.status !== 'playing') return null;
    if ((run.misersPurseOffers ?? 0) > 0) return CURIO_HINT_COPY.misers_purse;
    if ((run.crucibleCharges ?? 0) > 0 && (run.crucibleUsesThisRun ?? 0) === 0) return CURIO_HINT_COPY.crucible;
    if ((run.stormGlassCharges ?? 0) > 0 && (run.stormGlassUsesThisRun ?? 0) === 0) return CURIO_HINT_COPY.storm_glass;
    return null;
};

/** The Miser's Purse on offer (`misers-purse-rules.ts`). */
export const MISERS_PURSE_TOOL_COPY = {
    ready: (cap: number): string => `Take up the Miser's Purse: every clear pays double gold, and the miss bank holds ${cap}`,
    unavailable: "Miser's Purse: wait for the floor to begin"
} as const;

/** The Storm Glass's dock tooltips (`storm-glass-rules.ts`). */
export const STORM_GLASS_TOOL_COPY = {
    ready: 'Storm Glass: the realm\'s peak strikes now; the cards it moves stay lit until your next flip',
    noRealm: 'Storm Glass: there is no realm on this floor to call',
    faceUp: 'Storm Glass: finish the current pair first',
    unavailable: 'Storm Glass: wait for the floor to begin'
} as const;

/** The Crucible's dock tooltips (`crucible-rules.ts`): it acts on the one card face up. */
export const CRUCIBLE_TOOL_COPY = {
    waiting: 'Crucible: turn a card over, then melt its element into another',
    ready: 'Crucible: melt this pair. Every other face-down pair of its element is recast as another, new faces in new places',
    resolving: 'Crucible: finish the current pair first',
    unavailable: 'Crucible: wait for the floor to begin',
    lastPair: 'Crucible: the last pair must be matched',
    noPartner: 'Crucible: its twin must still be face down'
} as const;

export const METEOR_TOOL_COPY = {
    armedTitle: 'Select a card for the meteor strike. Click Meteor again or press Escape to cancel without spending.',
    idleTitle: 'Spend one stored meteor: choose a card and strike the surrounding area.',
    armed: 'Select a card for your meteor. Tap Meteor again to cancel.'
} as const;
