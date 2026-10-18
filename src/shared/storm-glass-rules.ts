import type { RealmEvent, RunState } from './contracts';
import { callRealmWeather } from './realm-weather-rules';
import { runRealmId } from './realm-rules';
import { runFilteredStringArray } from './run-array-guards';
import { decrementRunCounter, runNonNegativeInteger } from './run-number-guards';

/**
 * The Storm Glass (2026-10-18): a curio item that sets the arena off on the player's word.
 *
 * The owner asked for items that "trigger arena effect". Break the glass on a realm floor with
 * nothing face up and the realm's weather strikes now, at its peak - a whiteout, a firestorm, a
 * springtide, a thunderclap, a bloom - on top of the realm's own clock, which keeps its count.
 *
 * The pro: the storm comes when the player is ready for it, the cards it moved stay lit face up
 * until their next flip (they see where the current or the lightning put them), and a peak lays
 * the realm's gold out to be earned: fires to douse, vines to cut. The con: the peak lands, with
 * everything it does to the board. Off a realm floor there is no weather to call, and the glass
 * stays dark.
 */
export const STORM_GLASS_SOURCE_ID = 'storm_glass';

/** True when the glass can be broken now: a realm floor in play, a glass in hand, nothing face up. */
export const canBreakStormGlass = (run: RunState): boolean =>
    run.status === 'playing' &&
    run.board != null &&
    runRealmId(run) != null &&
    runNonNegativeInteger(run.stormGlassCharges) > 0 &&
    runFilteredStringArray(run.board.flippedTileIds).length === 0 &&
    run.board.tiles.some((tile) => tile.state === 'hidden');

export interface StormGlassResult {
    readonly run: RunState;
    readonly event: RealmEvent;
    readonly litTileIds: readonly string[];
}

/** Break the glass: the realm's peak now. Null when it cannot be broken or the weather found nothing to touch. */
export const applyStormGlass = (run: RunState): StormGlassResult | null => {
    if (!canBreakStormGlass(run)) return null;
    const uses = runNonNegativeInteger(run.stormGlassUsesThisRun);
    const called = callRealmWeather(run, `${uses}`);
    if (!called) return null;
    return {
        run: {
            ...run,
            board: called.board,
            stormGlassCharges: decrementRunCounter(run.stormGlassCharges),
            stormGlassUsesThisRun: uses + 1,
            powersUsedThisRun: true,
            realmLitTileIds: [...new Set([...runFilteredStringArray(run.realmLitTileIds), ...called.litTileIds])],
            lastRealmEvent: called.event
        },
        event: called.event,
        litTileIds: called.litTileIds
    };
};

/** What the storm did, in a line for the screen reader and the feedback stamp. */
export const stormGlassFeedbackLine = (kind: string, touched: number, lit: number, left: number): string => {
    const spent = `${left} storm ${left === 1 ? 'glass' : 'glasses'} left`;
    const shown = lit > 0 ? `; ${lit} ${lit === 1 ? 'card it moved is' : 'cards it moved are'} lit until your next flip` : '';
    return `The storm glass broke: ${kind} on ${touched} ${touched === 1 ? 'card' : 'cards'}${shown}; ${spent}.`;
};
