import { tr } from '../../shared/i18n';
import type { RunState } from '../../shared/contracts';
/**
 * What each tool in the run dock is called, and why it is greyed out when it is.
 *
 * A disabled power with no reason next to it is the most annoying thing a board can do, so these
 * strings do real work — they are the difference between "that button is broken" and "I need two
 * hidden tiles". Grouped by power so a translator sees each set of reasons together.
 */
export const ROW_SHUFFLE_COPY = {
    armed: tr.s('Tap any tile to shuffle its row'),
    idle: tr.s('Shuffle one row of hidden tiles (uses 1 row/swap charge)'),
    label: tr.s('Row'),
    noCharges: tr.s('No row/swap charges'),
    noRow: tr.s('Need a row with hidden cards from different pairs'),
    pendingFlip: tr.s('Finish the current flip first'),
    scholarContract: tr.s('Scholar contract: row shuffle disabled')
} as const;

export const PEEK_COPY = {
    idle: tr.s('Peek at a hidden tile'),
    pendingFlip: tr.s('Finish the current flip first'),
    pinArmed: tr.s('Turn off Pin before peeking'),
    swapArmed: tr.s('Finish or cancel Swap before peeking'),
    unavailable: tr.s('Peek is available while playing'),
    noTargets: tr.s('No hidden cards left to peek at')
} as const;

/** Tile swap: the other half of the row/swap charge. */
export const TILE_SWAP_COPY = {
    firstTile: tr.s('Tap the first hidden tile to move'),
    idle: tr.s('Swap two hidden tiles (uses 1 row/swap charge)'),
    needTwoHidden: tr.s('Need two hidden tiles to swap'),
    noCharges: tr.s('No row/swap charges'),
    peekArmed: tr.s('Cancel Peek before swapping cards'),
    pendingFlip: tr.s('Finish the current flip first'),
    scholarContract: tr.s('Scholar contract: tile swap disabled'),
    secondTile: tr.s('Tap a second hidden tile to swap positions')
} as const;

/** Flash pair, which only carries charges in Practice and Wild runs. */
export const FLASH_PAIR_COPY = {
    idle: tr.s('Briefly reveal a random hidden pair (practice / wild)'),
    noCharges: tr.s('No flash charges this floor'),
    pendingFlip: tr.s('Finish the current flip first')
} as const;

/** Full-board shuffle, as distinct from the row shuffle above. */
export const BOARD_SHUFFLE_COPY = {
    idle: tr.s('Shuffle hidden tiles (1 charge this run)'),
    needTwoPairs: tr.s('Need at least two hidden pairs to shuffle'),
    noCharges: tr.s('No shuffle charges'),
    pendingFlip: tr.s('Finish the current flip first'),
    scholarContract: tr.s('Scholar contract: shuffle disabled')
} as const;

/** What a Curio held, in its drop balloon (`itemDropFeed.ts`). */
export const CURIO_DROP_COPY = {
    crucible: { title: 'CRUCIBLE', line: tr.s('Melt a pair; its element pours out as another') },
    storm_glass: { title: tr.s('STORM GLASS'), line: tr.s('Break it: the realm\'s peak strikes when you choose') },
    misers_purse: { title: tr.s("MISER'S PURSE"), line: tr.s('On offer in your dock: double gold, one miss fewer') },
    still_bell: { title: tr.s('STILL BELL'), line: tr.s('Ring it: the realm lets go, then answers') }
} as const;

/**
 * How to use a curio item, said under the board while one is held and not yet used this run
 * (`RunShell`'s caption, when nothing else is being said). The drop balloon names it for two seconds;
 * this stays until the player has tried it.
 */
export const CURIO_HINT_COPY = {
    crucible: tr.s('Crucible in hand: turn a card over, then press Crucible to melt its pair and recast its element.'),
    storm_glass: tr.s('Storm Glass in hand: on a realm floor with nothing face up, press it to call the storm now.'),
    misers_purse: tr.s("Miser's Purse on offer: press Purse to take it up - double gold from every clear, one miss fewer."),
    still_bell: tr.s('Still Bell in hand: when the realm holds cards, press Bell to free them all - the realm answers with its weather.')
} as const;

/** The curio item to explain now, if any: the first one held and not yet tried this run. */
export const curioItemHint = (run: Pick<RunState, 'status' | 'crucibleCharges' | 'crucibleUsesThisRun' | 'stormGlassCharges' | 'stormGlassUsesThisRun' | 'misersPurseOffers' | 'stillBellCharges' | 'stillBellUsesThisRun'>): string | null => {
    if (run.status !== 'playing') return null;
    if ((run.misersPurseOffers ?? 0) > 0) return CURIO_HINT_COPY.misers_purse;
    if ((run.crucibleCharges ?? 0) > 0 && (run.crucibleUsesThisRun ?? 0) === 0) return CURIO_HINT_COPY.crucible;
    if ((run.stormGlassCharges ?? 0) > 0 && (run.stormGlassUsesThisRun ?? 0) === 0) return CURIO_HINT_COPY.storm_glass;
    if ((run.stillBellCharges ?? 0) > 0 && (run.stillBellUsesThisRun ?? 0) === 0) return CURIO_HINT_COPY.still_bell;
    return null;
};

/** The Miser's Purse on offer (`misers-purse-rules.ts`). */
export const MISERS_PURSE_TOOL_COPY = {
    ready: (cap: number): string => tr`Take up the Miser's Purse: every clear pays double gold, and you can hold ${cap} lives`,
    unavailable: tr.s("Miser's Purse: wait for the floor to begin")
} as const;

/** The Still Bell's dock tooltips (`still-bell-rules.ts`). */
export const STILL_BELL_TOOL_COPY = {
    ready: tr.s('Still Bell: every card the realm holds is let go now, and the realm answers with one strike of its weather'),
    nothingHeld: tr.s('Still Bell: the realm holds nothing to let go'),
    noRealm: tr.s('Still Bell: there is no realm on this floor'),
    faceUp: tr.s('Still Bell: finish the current pair first'),
    unavailable: tr.s('Still Bell: wait for the floor to begin')
} as const;

/** The Storm Glass's dock tooltips (`storm-glass-rules.ts`). */
export const STORM_GLASS_TOOL_COPY = {
    ready: tr.s('Storm Glass: the realm\'s peak strikes now; the cards it moves stay lit until your next flip'),
    noRealm: tr.s('Storm Glass: there is no realm on this floor to call'),
    nothingToTouch: tr.s('Storm Glass: the storm would find nothing to touch on this board'),
    faceUp: tr.s('Storm Glass: finish the current pair first'),
    unavailable: tr.s('Storm Glass: wait for the floor to begin')
} as const;

/** The Crucible's dock tooltips (`crucible-rules.ts`): it acts on the one card face up. */
export const CRUCIBLE_TOOL_COPY = {
    waiting: tr.s('Crucible: turn a card over, then melt its element into another'),
    ready: tr.s('Crucible: melt this pair. Every other face-down pair of its element is recast as another, new faces in new places'),
    resolving: tr.s('Crucible: finish the current pair first'),
    unavailable: tr.s('Crucible: wait for the floor to begin'),
    lastPair: tr.s('Crucible: the last pair must be matched'),
    noPartner: tr.s('Crucible: its twin must still be face down')
} as const;

export const METEOR_TOOL_COPY = {
    armedTitle: tr.s('Select a card for the meteor strike. Click Meteor again or press Escape to cancel without spending.'),
    idleTitle: tr.s('Spend one stored meteor: choose a card and strike the surrounding area.'),
    armed: tr.s('Select a card for your meteor. Tap Meteor again to cancel.')
} as const;
