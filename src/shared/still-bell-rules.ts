import { plural, tr } from './i18n';
import type { RealmEvent, RunState, Tile } from './contracts';
import { isRealmHeld } from './odd-card-rules';
import { callRealmWeather } from './realm-weather-rules';
import { runRealmId } from './realm-rules';
import { runFilteredStringArray } from './run-array-guards';
import { decrementRunCounter, runNonNegativeInteger } from './run-number-guards';

/**
 * The Still Bell (2026-10-19): a curio item that neutralizes what the realm is holding.
 *
 * The owner asked for items that neutralize a type of card. Ring the bell on a realm floor with
 * nothing face up and every face-down card the realm holds is let go at once: frost thaws, snow
 * melts off the backs, vines and their blooms fall away, fuses go out. The pro: a board that was
 * half locked is whole again. The con: the realm answers the bell - one strike of its own weather,
 * the everyday kind rather than its peak, on top of its clock, which keeps its count - and a doused
 * fire or a cut vine pays nothing, since nothing was earned.
 *
 * Cards keep their ids (the board never re-deals), and a turnable pair is always left.
 */
export const STILL_BELL_SOURCE_ID = 'still_bell';

// Held by the realm in the one sense the rest of the game uses (`isRealmHeld`), and face down.
const isHeld = (tile: Tile): boolean => tile.state === 'hidden' && isRealmHeld(tile);

/** True when the bell can ring: a realm floor in play, a bell in hand, nothing face up, and something held. */
export const canRingStillBell = (run: RunState): boolean =>
    run.status === 'playing' &&
    run.board != null &&
    runRealmId(run) != null &&
    runNonNegativeInteger(run.stillBellCharges) > 0 &&
    runFilteredStringArray(run.board.flippedTileIds).length === 0 &&
    run.board.tiles.some(isHeld);

export interface StillBellResult {
    readonly run: RunState;
    /** The cards the bell let go. */
    readonly freedTileIds: readonly string[];
    /** The realm's answer, if its weather found anything to touch. */
    readonly answer: RealmEvent | null;
}

/** Ring the bell: every held card freed, then the realm's answer. Null when it cannot ring. */
export const applyStillBell = (run: RunState): StillBellResult | null => {
    if (!canRingStillBell(run) || !run.board) return null;
    const freedTileIds: string[] = [];
    const tiles = run.board.tiles.map((tile) => {
        if (!isHeld(tile)) return tile;
        freedTileIds.push(tile.id);
        const { frost: _frost, snowed: _snowed, vined: _vined, bloom: _bloom, fuse: _fuse, ...rest } = tile;
        return rest;
    });
    const uses = runNonNegativeInteger(run.stillBellUsesThisRun);
    const stilled: RunState = { ...run, board: { ...run.board, tiles } };
    // The answer is the realm's, not the player's: nothing it moves is lit for them.
    const called = callRealmWeather(stilled, `bell:${uses}`, { peak: false, lightMoved: false });
    const after = called ? called.board : stilled.board!;
    const event: RealmEvent = called?.event ?? { key: `${run.runSeed}:${run.board.level}:bell:${uses}`, kind: 'thaw', tileIds: freedTileIds };
    return {
        run: {
            ...stilled,
            board: after,
            stillBellCharges: decrementRunCounter(run.stillBellCharges),
            stillBellUsesThisRun: uses + 1,
            powersUsedThisRun: true,
            realmLitTileIds: [...new Set([...runFilteredStringArray(run.realmLitTileIds), ...(called?.litTileIds ?? [])])],
            lastRealmEvent: event
        },
        freedTileIds,
        answer: called?.event ?? null
    };
};

/** What the bell did, in a line for the screen reader and the feedback stamp. */
export const stillBellFeedbackLine = (freed: number, answer: string | null, left: number): string => {
    const spent = tr`${plural(left, { one: '{0} bell', other: '{0} bells' })} left`;
    const answered = answer ? tr`, and the realm answered with ${answer}` : '';
    return plural(freed, { one: 'The still bell rang: {0} held card let go{1}; {2}.', other: 'The still bell rang: {0} held cards let go{1}; {2}.' }, answered, spent);
};
