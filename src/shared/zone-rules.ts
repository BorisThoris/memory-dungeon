import { inSequenceOrder } from './match-rule-rules';
import { crawlCarryHeroTo } from './crawl-rules';
import { dropMask, unmaskOnFlip } from './mask-rules';
import type { RunState, Tile, ZoneResult, ZoneState } from './contracts';
import { isTileFlipBlocked, shedSnow } from './realm-weather-rules';
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
    // A Triples floor's three (`match-rule-rules.ts`) is no pair the Zone can play.
    return [...halves.entries()].filter(([key, count]) => count === 2 && !(run.board?.tripleKeys ?? []).includes(key)).length;
};

export const isZoneActive = (run: Pick<RunState, 'zone'>): boolean => run.zone != null && runNonNegativeInteger(run.zone.pairs) > 0;

/** The pairs a Zone opened now would hold, or 0 when it cannot open. */
export const zonePairsAvailable = (run: Pick<RunState, 'status' | 'board' | 'stats' | 'zone'>): number => {
    if (run.status !== 'playing' || !run.board || isZoneActive(run)) return 0;
    if (runFilteredStringArray(run.board.flippedTileIds).length > 0) return 0;
    const pairs = Math.min(zonePairsForCombo(runNonNegativeInteger(run.stats?.currentStreak)), hiddenPairCount(run));
    return pairs >= 2 ? pairs : 0;
};

// The Zone waits while the Hold is held (`hold-rules.ts`): its replayed turns would lose the held pairs.
export const canIgniteZone = (run: Pick<RunState, 'status' | 'board' | 'stats' | 'zone' | 'holding'>): boolean => !run.holding && zonePairsAvailable(run) > 0;

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
    // The realm's holds apply in the Zone too: a frozen or vined card cannot be turned.
    if (isTileFlipBlocked(tile)) return run;
    // A Zone flip is a first flip too: a mask drops (`mask-rules.ts`).
    const next: RunState = {
        ...unmaskOnFlip(run, tile),
        peekRevealedTileIds: [],
        flashPairRevealedTileIds: [],
        lanternLitTileIds: [],
        realmLitTileIds: [],
        board: {
            ...board,
            tiles: board.tiles.map((candidate) => (candidate.id === tileId ? { ...dropMask(shedSnow(candidate)), state: 'flipped' as const } : candidate)),
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

/**
 * Play one turn of two cards through the game's own resolver, from a board with nothing up. The
 * cards were turned inside the Zone, so weather that took hold of them while earlier turns replayed
 * (a vine, the frost) does not stop them being played: they were already in the player's hand.
 */
const playTurn = (run: RunState, ...ids: string[]): RunState =>
    // The crawl (`crawl-rules.ts`): the Zone carries the hero to the turn's first card, so it can be turned.
    resolveBoardTurn(ids.reduce((state, id) => flipTile(state, id), crawlCarryHeroTo(releaseHolds(run, ids), ids[0] ?? '')));

const releaseHolds = (run: RunState, ids: readonly string[]): RunState =>
    run.board && run.board.tiles.some((tile) => ids.includes(tile.id) && isTileFlipBlocked(tile))
        ? {
              ...run,
              board: {
                  ...run.board,
                  tiles: run.board.tiles.map((tile) => {
                      if (!ids.includes(tile.id)) return tile;
                      const { frost: _frost, vined: _vined, ...rest } = tile;
                      return rest;
                  })
              }
          }
        : run;

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
    const matches: string[][] = [];
    const leftovers: string[] = [];
    for (const [pairKey, ids] of byPair) {
        // A Triples floor's three (`match-rule-rules.ts`) is a match only with all three seen.
        const size = (run.board.tripleKeys ?? []).includes(pairKey) ? 3 : 2;
        // On Sequences the replay turns them one, two, three.
        const ordered = inSequenceOrder(ids.map((id) => run.board!.tiles.find((tile) => tile.id === id)!)).map((tile) => tile.id);
        if (ids.length >= size) matches.push(size === 3 ? ordered.slice(0, size) : ids.slice(0, size));
        leftovers.push(...(ids.length >= size ? ids.slice(size) : ids));
    }
    // Everything goes down, and the Zone closes, before the turns replay what was seen.
    let next: RunState = { ...faceDown(run, up), zone: null };
    // A pop from an earlier turn can take a card that was face up; a turn is played only on
    // cards still on the board, and a pair the pop took counts as the pop's, not the Zone's.
    const stillHidden = (state: RunState, id: string): boolean => state.board?.tiles.find((tile) => tile.id === id)?.state === 'hidden';
    let matched = 0;
    let missed = 0;
    for (const ids of matches) {
        if (next.status !== 'playing') break;
        if (!ids.every((id) => stillHidden(next, id))) continue;
        next = playTurn(next, ...ids);
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
