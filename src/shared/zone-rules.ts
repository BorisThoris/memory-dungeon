import type { RunState, Tile, ZoneResult, ZoneState } from './contracts';
import { comboAscension, comboHeatStage } from './combo-heat-rules';
import { flipTile, resolveBoardTurn } from './game';
import { runFilteredStringArray } from './run-array-guards';
import { runNonNegativeInteger } from './run-number-guards';
import { normalizeSessionStats } from './session-stats-rules';
import { isSingletonUtilityPairKey } from './tile-identity';

/**
 * The Zone: time stops for a hot hand.
 *
 * The new concept the combo study's twelfth round asked for, built on the leaders' one dogma -
 * the hot hand gets a different game, never a safer one - and on the two of them that go
 * furthest: Tetris Effect's Zone, which stops time and lets the player break a base rule (more
 * than four lines at once), and Guitar Hero's Star Power, earned on the streak and *spent* by the
 * player. Here the base rule is that a turn is two cards. In the Zone it is not.
 *
 * - **Ignition** is offered while the combo stands at Inferno or better, on a clean board. It
 *   burns the combo: the whole streak, and the momentum with it, goes to zero the moment the
 *   Zone opens - NBA Jam's fire dies on one basket; this one is cashed in on purpose. What it
 *   buys is a Zone of P pairs: three at Inferno, four at Legendary, one more for every ascension
 *   after, never more than the pairs still hidden.
 * - **In the Zone** nothing resolves. Every card the player turns stays face up, up to 2P of
 *   them; the clock does not run. The player ends it (Resolve) or the 2P-th card does.
 * - **The resolve** plays everything face up at once, in the game's own turns: every complete
 *   pair matches first, so the chain climbs through them and the pop widens as it goes (a
 *   perfect Zone leaves a combo of P standing); then what is left face up is played as misses,
 *   two cards at a time, at full price - the bank pays for each one exactly as it would for a
 *   turn, and a miss with the bank empty ends the run. One lone leftover card turns back for
 *   nothing: a first flip shows a card for free anyway. On top, a Zone bonus of
 *   `ZONE_BONUS_PER_PAIR_SQUARED × matched²`, quadratic the way the Zone's line clears are.
 *
 * Never safer: the Zone costs the combo to enter, and a bad Zone costs as many misses as the
 * same cards would have cost as turns. What it changes is what a turn *is*, for a few seconds,
 * for the player who earned it.
 */
export type { ZoneResult, ZoneState };

export const ZONE_STAGE_FROM = 'inferno' as const;
export const ZONE_PAIRS_AT_INFERNO = 3;
export const ZONE_PAIRS_AT_LEGENDARY = 4;
export const ZONE_PAIRS_CAP = 6;
export const ZONE_BONUS_PER_PAIR_SQUARED = 100;

const STAGES_FROM_INFERNO = new Set(['inferno', 'legendary']);

/** Pairs a Zone opened at this combo holds, before the board's own cap. */
export const zonePairsForCombo = (combo: number): number => {
    const stage = comboHeatStage(combo);
    if (!STAGES_FROM_INFERNO.has(stage)) return 0;
    if (stage === 'inferno') return ZONE_PAIRS_AT_INFERNO;
    return Math.min(ZONE_PAIRS_CAP, ZONE_PAIRS_AT_LEGENDARY + Math.max(0, comboAscension(combo) - 1));
};

const hiddenRealTiles = (run: Pick<RunState, 'board'>): Tile[] =>
    (run.board?.tiles ?? []).filter((tile) => tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey));

const hiddenPairCount = (run: Pick<RunState, 'board'>): number => {
    const halves = new Map<string, number>();
    for (const tile of hiddenRealTiles(run)) halves.set(tile.pairKey, (halves.get(tile.pairKey) ?? 0) + 1);
    return [...halves.values()].filter((count) => count === 2).length;
};

export const isZoneActive = (run: Pick<RunState, 'zone'>): boolean => run.zone != null && runNonNegativeInteger(run.zone.pairs) > 0;

/** The pairs a Zone opened now would hold, or 0 when it cannot open. */
export const zonePairsAvailable = (run: Pick<RunState, 'status' | 'board' | 'stats' | 'zone'>): number => {
    if (run.status !== 'playing' || !run.board || isZoneActive(run)) return 0;
    if (runFilteredStringArray(run.board.flippedTileIds).length > 0) return 0;
    const pairs = Math.min(zonePairsForCombo(runNonNegativeInteger(run.stats?.currentStreak)), hiddenPairCount(run));
    return pairs >= 2 ? pairs : 0;
};

export const canIgniteZone = (run: Pick<RunState, 'status' | 'board' | 'stats' | 'zone'>): boolean => zonePairsAvailable(run) > 0;

/** Open the Zone: the combo burns, time stops. Unchanged when it cannot open. */
export const igniteZone = (run: RunState): RunState => {
    const pairs = zonePairsAvailable(run);
    if (pairs === 0) return run;
    const stats = normalizeSessionStats(run.stats);
    return {
        ...run,
        zone: { pairs },
        zonesThisRun: runNonNegativeInteger(run.zonesThisRun) + 1,
        lastZone: null,
        powersUsedThisRun: true,
        stats: { ...stats, currentStreak: 0 },
        chunkPairsThisChain: 0,
        skipMomentumThisChain: 0,
        comboLinksCarried: 0
    };
};

/** How many cards the Zone still lets the player turn. */
export const zoneFlipsLeft = (run: Pick<RunState, 'zone' | 'board'>): number =>
    isZoneActive(run) ? Math.max(0, runNonNegativeInteger(run.zone!.pairs) * 2 - runFilteredStringArray(run.board?.flippedTileIds).length) : 0;

/**
 * Turn a card in the Zone: it stays up, nothing resolves. The last allowed card resolves the
 * Zone. Unchanged when the card cannot be turned (not hidden, already up, sticky-blocked).
 */
export const zoneFlipTile = (run: RunState, tileId: string): RunState => {
    if (!isZoneActive(run) || run.status !== 'playing' || !run.board || zoneFlipsLeft(run) === 0) return run;
    const board = run.board;
    const index = board.tiles.findIndex((tile) => tile.id === tileId);
    const tile = board.tiles[index];
    if (!tile || tile.state !== 'hidden') return run;
    const flipped = runFilteredStringArray(board.flippedTileIds);
    if (flipped.includes(tileId)) return run;
    if (flipped.length === 0 && run.stickyBlockIndex !== null && index === run.stickyBlockIndex) return run;
    const next: RunState = {
        ...run,
        peekRevealedTileIds: [],
        flashPairRevealedTileIds: [],
        lanternLitTileIds: [],
        board: {
            ...board,
            tiles: board.tiles.map((candidate) => (candidate.id === tileId ? { ...candidate, state: 'flipped' as const } : candidate)),
            flippedTileIds: [...flipped, tileId]
        },
        flipHistory: [...run.flipHistory, tileId]
    };
    return zoneFlipsLeft(next) === 0 ? resolveZone(next) : next;
};

const faceDown = (run: RunState, ids: readonly string[]): RunState => ({
    ...run,
    board: run.board
        ? {
              ...run.board,
              tiles: run.board.tiles.map((tile) => (ids.includes(tile.id) ? { ...tile, state: 'hidden' as const } : tile)),
              flippedTileIds: []
          }
        : run.board
});

/** Play one turn of two cards through the game's own resolver, from a board with nothing up. */
const playTurn = (run: RunState, first: string, second: string): RunState => resolveBoardTurn(flipTile(flipTile(run, first), second));

/**
 * End the Zone: matches first, then the misses, then the bonus. Unchanged when no Zone is open.
 * Stops early if a turn ends the floor or the run; whatever was still face up goes down with it.
 */
export const resolveZone = (run: RunState): RunState => {
    if (!isZoneActive(run) || !run.board) return run;
    const pairs = runNonNegativeInteger(run.zone!.pairs);
    const up = runFilteredStringArray(run.board.flippedTileIds);
    const byPair = new Map<string, string[]>();
    for (const id of up) {
        const tile = run.board.tiles.find((candidate) => candidate.id === id);
        if (tile) byPair.set(tile.pairKey, [...(byPair.get(tile.pairKey) ?? []), id]);
    }
    const matches: Array<[string, string]> = [];
    const leftovers: string[] = [];
    for (const ids of byPair.values()) {
        if (ids.length >= 2) matches.push([ids[0]!, ids[1]!]);
        for (const id of ids.slice(2)) leftovers.push(id);
        if (ids.length === 1) leftovers.push(ids[0]!);
    }
    // Everything goes down, and the Zone closes, before the turns replay what was seen.
    let next: RunState = { ...faceDown(run, up), zone: null };
    // A pop from an earlier turn can take a card that was face up; a turn is played only on
    // cards still on the board, and a pair the pop took counts as the pop's, not the Zone's.
    const stillHidden = (state: RunState, id: string): boolean => state.board?.tiles.find((tile) => tile.id === id)?.state === 'hidden';
    let matched = 0;
    let missed = 0;
    for (const [first, second] of matches) {
        if (next.status !== 'playing') break;
        if (!stillHidden(next, first) || !stillHidden(next, second)) continue;
        next = playTurn(next, first, second);
        matched += 1;
    }
    let pending: string | null = null;
    for (const id of leftovers) {
        if (next.status !== 'playing') break;
        if (!stillHidden(next, id)) continue;
        if (pending === null) {
            pending = id;
            continue;
        }
        next = playTurn(next, pending, id);
        pending = null;
        missed += 1;
    }
    const bonus = ZONE_BONUS_PER_PAIR_SQUARED * matched * matched;
    const stats = normalizeSessionStats(next.stats);
    const key = `zone:${run.runSeed}:${run.board.level}:${runNonNegativeInteger(run.zonesThisRun)}`;
    return {
        ...next,
        zone: null,
        zonePairsThisRun: runNonNegativeInteger(run.zonePairsThisRun) + matched,
        lastZone: { key, pairs, matched, missed, bonus },
        stats: {
            ...stats,
            totalScore: runNonNegativeInteger(stats.totalScore) + bonus,
            currentLevelScore: runNonNegativeInteger(stats.currentLevelScore) + bonus
        }
    };
};
