import type { BoardState, RealmEvent, RealmId, RealmSeverity, RunState, Tile } from './contracts';
import { isSingletonUtilityPairKey, isWildPairKey } from './tile-identity';
import { orthogonalNeighbourIndices } from './skittish-cards-rules';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { runNonNegativeInteger } from './run-number-guards';
import { REALMS, REALM_SEVERITIES, isRealmWeatherTurn, runRealmId, runRealmSecondaryId, runRealmSeverity } from './realm-rules';
import { omenOfMatch, realmReactionName } from './realm-omen-rules';

/**
 * What a realm does to the board on a resolved turn (`realm-rules.ts` has the realms themselves).
 *
 * Applied last in both turn seams, on the board the turn actually produced, in this order:
 *
 * 1. an omen matched sets off its reaction and turns the realm (`realm-omen-rules.ts`);
 * 2. the realm answers the turn: a match douses a burning card, cuts the vines beside it and
 *    shatters the ice beside it; a miss in the frost freezes the cards it showed, and a miss in any
 *    other realm at its raging pitch is struck back at (`resolveRealmBacklash`);
 * 3. the clocks tick: ice thaws a turn, fuses burn a turn, and a fuse that runs out burns a gold
 *    and spreads the fire to a neighbour;
 * 4. on its turn, the weather: blizzard, wildfire, current, lightning or overgrowth;
 * 5. the guard: if frozen and vined cards leave no pair that can be turned, the ice and the vines
 *    give way. A realm can make a floor harder; it can never leave one that cannot be finished.
 */

/** Turns a miss's cards stay frozen, and on a raging door. */
export const FROSTBITE_TURNS = 2;
export const FROSTBITE_TURNS_RAGING = 3;
/** A wildfire's fuse, in resolved turns. */
export const WILDFIRE_FUSE = 3;
/** The most cards that can be burning at once: fire is pressure, not a flood. */
export const WILDFIRE_MAX_BURNING = 4;
/** Gold a doused fire pays, a burnout burns, a cut vine pays, and what a reaction pays per thing it clears. */
export const DOUSE_GOLD = 2;
export const BURNOUT_GOLD = 1;
export const VINE_CUT_GOLD = 1;
/** A bloomed vine pays this when it is cut. */
export const BLOOM_CUT_GOLD = 3;
/** Every this-many weather events of a floor, the weather is the realm's peak instead. */
export const REALM_PEAK_EVERY = 3;
/** A firestorm may burn this many cards at once, over wildfire's usual cap. */
export const FIRESTORM_MAX_BURNING = 6;
export const REACTION_CLEAR_GOLD = 1;
export const REACTION_CLEAR_GOLD_CAP = 5;
/** A raging ember scalds a miss's cards on a shorter fuse than wildfire's. */
export const SCALD_FUSE = 2;

/** A card the player cannot turn because of the realm: frozen, or held by vines. */
export const isTileFlipBlocked = (tile: Tile): boolean =>
    tile.state === 'hidden' && (runNonNegativeInteger(tile.frost ?? 0) > 0 || tile.vined === true);

const hasRealmStatus = (tile: Tile): boolean =>
    tile.frost != null || tile.snowed != null || tile.fuse != null || tile.vined != null || tile.bloom != null;

const withoutRealmStatus = (tile: Tile): Tile => {
    if (!hasRealmStatus(tile)) return tile;
    const { frost: _frost, snowed: _snowed, fuse: _fuse, vined: _vined, bloom: _bloom, ...rest } = tile;
    return rest;
};

const withoutVines = (tile: Tile): Tile => {
    const { vined: _vined, bloom: _bloom, ...rest } = tile;
    return rest;
};

/** Whether the weather a floor is about to have is its realm's peak: the third, sixth, ninth... */
export const isRealmPeak = (weatherBefore: number): boolean => (runNonNegativeInteger(weatherBefore) + 1) % REALM_PEAK_EVERY === 0;

/**
 * Which realm's weather comes next on a floor, and whether it is the peak. A confluence floor
 * alternates: the first realm's weather, then the second's, and so on.
 */
export const nextRealmWeather = (
    run: Pick<RunState, 'realmId' | 'realmSecondaryId' | 'realmWeatherThisFloor'>
): { realmId: RealmId; peak: boolean; name: string } | null => {
    const primary = runRealmId(run);
    if (!primary) return null;
    const secondary = runRealmSecondaryId(run);
    const count = runNonNegativeInteger(run.realmWeatherThisFloor ?? 0);
    const realmId = secondary && count % 2 === 1 ? secondary : primary;
    const peak = isRealmPeak(count);
    return { realmId, peak, name: peak ? REALMS[realmId].peak : REALMS[realmId].weather };
};

const isRealCard = (tile: Tile): boolean => !isSingletonUtilityPairKey(tile.pairKey);

export interface RealmTurnInput {
    run: RunState;
    board: BoardState;
    outcome: 'match' | 'miss';
    /** The cards the turn turned: the matched pair, or the missed cards. */
    tileIds: readonly string[];
    /** The source tiles as they were turned, which still carry their fuse and omen. */
    sourceTiles: readonly Tile[];
    /** The floor's turn count after this turn. */
    turnsThisFloor: number;
    pinnedTileIds: readonly string[];
}

export interface RealmTurnResult {
    board: BoardState;
    realmId: RealmId | null;
    goldDelta: number;
    /** Cards lightning left lit, shown face up until the next flip (`realmLitTileIds`). */
    litTileIds: string[];
    events: RealmEvent[];
    weather: number;
    /** Peak weather this turn (every third weather event of a floor). */
    peaks: number;
    /** The second realm after the turn: an omen's reaction ends a confluence. */
    secondaryId: RealmId | null;
    reactions: number;
    doused: number;
    burnouts: number;
    vinesCut: number;
    frozen: number;
    /** A raging realm's backlash this turn (0 or 1). */
    backlashes: number;
}

const rngFor = (kind: string, run: RunState, level: number, turns: number) =>
    createMulberry32(hashStringToSeed(`realm:${kind}:${run.runSeed}:${run.runRulesVersion}:${level}:${turns}`));

const eventKey = (run: RunState, level: number, turns: number, kind: string): string =>
    `${run.runSeed}:${level}:${turns}:${kind}`;

/** Cards the weather may move: face down and not pinned. */
const movable = (tiles: readonly Tile[], index: number, pinned: ReadonlySet<string>): boolean => {
    const tile = tiles[index];
    return tile != null && tile.state === 'hidden' && !pinned.has(tile.id);
};

/** Cycles the tiles at `indices` one step along the list (the last wraps to the first). */
const cycleTiles = (tiles: Tile[], indices: readonly number[]): void => {
    if (indices.length < 2) return;
    const moved = indices.map((index) => tiles[index]!);
    indices.forEach((index, at) => {
        tiles[index] = moved[(at - 1 + moved.length) % moved.length]!;
    });
};

const blizzard = (
    tiles: Tile[],
    board: BoardState,
    pinned: ReadonlySet<string>,
    rng: () => number,
    windEast: boolean
): string[] => {
    const cols = Math.max(1, board.columns);
    const rows: number[][] = [];
    for (let row = 0; row * cols < tiles.length; row += 1) {
        const indices: number[] = [];
        for (let col = 0; col < cols; col += 1) {
            const index = row * cols + col;
            if (index < tiles.length && movable(tiles, index, pinned)) indices.push(index);
        }
        if (indices.length >= 2) rows.push(indices);
    }
    if (rows.length === 0) return [];
    const indices = rows[pickRngIndex(rng, rows.length)]!;
    cycleTiles(tiles, windEast ? indices : [...indices].reverse());
    for (const index of indices) {
        tiles[index] = { ...tiles[index]!, snowed: true };
    }
    return indices.map((index) => tiles[index]!.id);
};

const current = (tiles: Tile[], board: BoardState, pinned: ReadonlySet<string>, sweep: number): { ids: string[]; col: number } => {
    const cols = Math.max(1, board.columns);
    for (let step = 0; step < cols; step += 1) {
        const col = (sweep + step) % cols;
        const indices: number[] = [];
        for (let index = col; index < tiles.length; index += cols) {
            if (movable(tiles, index, pinned)) indices.push(index);
        }
        if (indices.length >= 2) {
            cycleTiles(tiles, indices);
            return { ids: indices.map((index) => tiles[index]!.id), col };
        }
    }
    return { ids: [], col: -1 };
};

/** Thunderclap: the row with the most face-down cards is lit, every card in it. Nothing moves. */
const thunderclap = (tiles: Tile[], board: BoardState): string[] => {
    const cols = Math.max(1, board.columns);
    let best: string[] = [];
    for (let row = 0; row * cols < tiles.length; row += 1) {
        const ids = tiles.slice(row * cols, row * cols + cols).filter((tile) => tile.state === 'hidden').map((tile) => tile.id);
        if (ids.length > best.length) best = ids;
    }
    return best;
};

/** Firestorm's second half: every burning card spreads to one face-down neighbour, under the storm's cap. */
const spreadEveryFire = (tiles: Tile[], board: BoardState, rng: () => number): string[] => {
    const spread: string[] = [];
    const burning = tiles.map((tile, index) => ({ tile, index })).filter(({ tile }) => tile.state === 'hidden' && tile.fuse != null);
    for (const { index } of burning) {
        if (tiles.filter((tile) => tile.state === 'hidden' && tile.fuse != null).length >= FIRESTORM_MAX_BURNING) break;
        const near = orthogonalNeighbourIndices(index, board.columns, tiles.length).filter((n) => {
            const tile = tiles[n];
            return tile != null && tile.state === 'hidden' && tile.fuse == null && isRealCard(tile);
        });
        if (near.length === 0) continue;
        const pick = near[pickRngIndex(rng, near.length)]!;
        tiles[pick] = { ...tiles[pick]!, fuse: WILDFIRE_FUSE };
        spread.push(tiles[pick]!.id);
    }
    return spread;
};

const lightning = (tiles: Tile[], pinned: ReadonlySet<string>, rng: () => number, strikes: number): string[] => {
    const pool = tiles.map((_, index) => index).filter((index) => movable(tiles, index, pinned));
    const lit: string[] = [];
    for (let strike = 0; strike < strikes && pool.length >= 2; strike += 1) {
        const a = pool.splice(pickRngIndex(rng, pool.length), 1)[0]!;
        const others = pool.filter((index) => tiles[index]!.pairKey !== tiles[a]!.pairKey);
        const candidates = others.length > 0 ? others : pool;
        const b = candidates[pickRngIndex(rng, candidates.length)]!;
        pool.splice(pool.indexOf(b), 1);
        const tileA = tiles[a]!;
        tiles[a] = tiles[b]!;
        tiles[b] = tileA;
        lit.push(tiles[a]!.id, tiles[b]!.id);
    }
    return lit;
};

const overgrowth = (tiles: Tile[], board: BoardState, pinned: ReadonlySet<string>, rng: () => number, count: number): string[] => {
    const grown: string[] = [];
    for (let n = 0; n < count; n += 1) {
        const open = tiles
            .map((tile, index) => ({ tile, index }))
            .filter(({ tile }) => tile.state === 'hidden' && tile.vined !== true && !pinned.has(tile.id) && isRealCard(tile));
        if (open.length === 0) break;
        // Vines creep: a card touching vines already is taken first, so they spread in a patch.
        const creeping = open.filter(({ index }) =>
            orthogonalNeighbourIndices(index, board.columns, tiles.length).some((near) => tiles[near]?.vined === true)
        );
        const pool = creeping.length > 0 ? creeping : open;
        const { index } = pool[pickRngIndex(rng, pool.length)]!;
        tiles[index] = { ...tiles[index]!, vined: true };
        grown.push(tiles[index]!.id);
    }
    return grown;
};

/**
 * A raging realm strikes back at a miss (2026-10-01). Frost always froze a miss's cards; the other
 * four realms only acted on their clock, so a miss in them cost the bank and nothing else. At the
 * raging pitch each now answers the miss in its own way, on the two cards the player just saw:
 *
 * - **ember, scald**: both catch fire on a short fuse (`SCALD_FUSE`): match them in time or they
 *   burn a gold and spread;
 * - **tide, undertow**: each is dragged one cell down its column (the bottom one to the top), so
 *   what was seen is a cell off;
 * - **storm, static**: each is thrown across the board, swapped with a card of another pair, and
 *   not lit, so what was seen is gone;
 * - **grove, snare**: both are vined and held until a match beside them cuts them.
 *
 * Pinned cards stay put. The guard after the turn still frees the vines if they would leave no pair
 * that can be turned. Returns the cards it touched (the ones moved and the ones they swapped with).
 */
export const resolveRealmBacklash = (
    realmId: RealmId,
    tiles: Tile[],
    columns: number,
    pinned: ReadonlySet<string>,
    missedIds: readonly string[],
    rng: () => number
): { kind: RealmEvent['kind']; tileIds: string[] } | null => {
    const at = (id: string): number => tiles.findIndex((tile) => tile.id === id);
    const missed = missedIds.filter((id) => {
        const index = at(id);
        return index >= 0 && tiles[index]!.state === 'hidden' && isRealCard(tiles[index]!);
    });
    if (missed.length === 0) return null;
    const touched: string[] = [];
    switch (realmId) {
        case 'ember': {
            for (const id of missed) {
                const index = at(id);
                const burning = tiles.filter((tile) => tile.state === 'hidden' && tile.fuse != null).length;
                if (tiles[index]!.fuse != null || burning >= WILDFIRE_MAX_BURNING) continue;
                tiles[index] = { ...tiles[index]!, fuse: SCALD_FUSE };
                touched.push(id);
            }
            return touched.length > 0 ? { kind: 'scald', tileIds: touched } : null;
        }
        case 'tide': {
            const cols = Math.max(1, columns);
            for (const id of missed) {
                const index = at(id);
                if (!movable(tiles, index, pinned)) continue;
                let below = index + cols;
                if (below >= tiles.length) below = index % cols;
                if (below === index || !movable(tiles, below, pinned)) continue;
                const other = tiles[below]!;
                tiles[below] = tiles[index]!;
                tiles[index] = other;
                touched.push(id, other.id);
            }
            return touched.length > 0 ? { kind: 'undertow', tileIds: [...new Set(touched)] } : null;
        }
        case 'storm': {
            for (const id of missed) {
                const index = at(id);
                if (!movable(tiles, index, pinned)) continue;
                const pool = tiles
                    .map((_, n) => n)
                    .filter((n) => n !== index && movable(tiles, n, pinned) && !missed.includes(tiles[n]!.id) && tiles[n]!.pairKey !== tiles[index]!.pairKey);
                if (pool.length === 0) continue;
                const far = pool[pickRngIndex(rng, pool.length)]!;
                const other = tiles[far]!;
                tiles[far] = tiles[index]!;
                tiles[index] = other;
                touched.push(id, other.id);
            }
            return touched.length > 0 ? { kind: 'static', tileIds: [...new Set(touched)] } : null;
        }
        case 'grove': {
            for (const id of missed) {
                const index = at(id);
                if (pinned.has(id) || tiles[index]!.vined === true) continue;
                tiles[index] = { ...tiles[index]!, vined: true };
                touched.push(id);
            }
            return touched.length > 0 ? { kind: 'snare', tileIds: touched } : null;
        }
        case 'frost':
            return null;
    }
    return null;
};

const wildfire = (tiles: Tile[], rng: () => number, count: number): string[] => {
    const lit: string[] = [];
    for (let n = 0; n < count; n += 1) {
        const burning = tiles.filter((tile) => tile.state === 'hidden' && tile.fuse != null).length;
        if (burning >= WILDFIRE_MAX_BURNING) break;
        const open = tiles
            .map((tile, index) => ({ tile, index }))
            .filter(({ tile }) => tile.state === 'hidden' && tile.fuse == null && isRealCard(tile));
        if (open.length === 0) break;
        const { index } = open[pickRngIndex(rng, open.length)]!;
        tiles[index] = { ...tiles[index]!, fuse: WILDFIRE_FUSE };
        lit.push(tiles[index]!.id);
    }
    return lit;
};

/** True when some pair can still be turned: two unblocked face-down cards of a pair, or the joker and one more. */
export const boardHasTurnablePair = (tiles: readonly Tile[]): boolean => {
    const open = tiles.filter((tile) => tile.state === 'hidden' && !isTileFlipBlocked(tile));
    const hidden = tiles.filter((tile) => tile.state === 'hidden');
    if (hidden.length === 0) return true;
    if (open.some((tile) => isWildPairKey(tile.pairKey)) && open.length >= 2) return true;
    const seen = new Set<string>();
    for (const tile of open) {
        if (isSingletonUtilityPairKey(tile.pairKey)) continue;
        if (seen.has(tile.pairKey)) return true;
        seen.add(tile.pairKey);
    }
    return false;
};

/**
 * The guard, on its own: when frozen and vined cards leave no pair that can be turned, the ice and
 * the vines give way. Mutates `tiles` and returns the ids it freed. Anything that takes cards off
 * the board outside a turn (a bomb) runs it too, or it could leave only held cards behind.
 */
export const releaseRealmHoldsIfStuck = (tiles: Tile[]): string[] => {
    if (boardHasTurnablePair(tiles)) return [];
    const freed: string[] = [];
    tiles.forEach((tile, index) => {
        if (tile.state === 'hidden' && (tile.frost != null || tile.vined != null)) {
            const { frost: _frost, vined: _vined, bloom: _bloom, ...rest } = tile;
            tiles[index] = rest;
            freed.push(tile.id);
        }
    });
    return freed;
};

/** Resolves the realm's part of a turn. A run with no realm gets its board back untouched. */
export const resolveRealmTurn = ({
    run,
    board,
    outcome,
    tileIds,
    sourceTiles,
    turnsThisFloor,
    pinnedTileIds
}: RealmTurnInput): RealmTurnResult => {
    const startRealm = runRealmId(run);
    const empty: RealmTurnResult = {
        board,
        realmId: startRealm,
        goldDelta: 0,
        litTileIds: [],
        events: [],
        weather: 0,
        peaks: 0,
        secondaryId: runRealmSecondaryId(run),
        reactions: 0,
        doused: 0,
        burnouts: 0,
        vinesCut: 0,
        frozen: 0,
        backlashes: 0
    };
    if (!startRealm) {
        return empty;
    }
    const severity: RealmSeverity = runRealmSeverity(run);
    const reach = REALM_SEVERITIES[severity].reach;
    const level = board.level;
    const turns = runNonNegativeInteger(turnsThisFloor);
    const pinned = new Set(pinnedTileIds);
    const tiles: Tile[] = [...board.tiles];
    const indexOf = new Map(tiles.map((tile, index) => [tile.id, index]));
    const events: RealmEvent[] = [];
    let realmId: RealmId = startRealm;
    let secondaryId: RealmId | null = runRealmSecondaryId(run);
    let peaks = 0;
    let goldDelta = 0;
    let reactions = 0;
    let doused = 0;
    let burnouts = 0;
    let vinesCut = 0;
    let frozen = 0;
    let backlashes = 0;
    let weather = 0;
    let litTileIds: string[] = [];
    const touchedThisTurn = new Set<string>();

    // 1. The omen.
    if (outcome === 'match') {
        const omen = omenOfMatch(sourceTiles, realmId);
        if (omen) {
            const from = realmId;
            let cleared = 0;
            const burned: string[] = [];
            tiles.forEach((tile, index) => {
                if (tile.state !== 'hidden') return;
                // Wildfire through a grove: every vine catches instead of falling.
                if (omen === 'ember' && tile.vined === true && burned.length < WILDFIRE_MAX_BURNING) {
                    tiles[index] = { ...withoutRealmStatus(tile), fuse: WILDFIRE_FUSE };
                    burned.push(tile.id);
                    touchedThisTurn.add(tile.id);
                    return;
                }
                if (tile.frost != null || tile.fuse != null || tile.vined != null || tile.snowed != null) {
                    cleared += 1;
                    tiles[index] = withoutRealmStatus(tile);
                }
            });
            const gold = Math.min(REACTION_CLEAR_GOLD_CAP, cleared * REACTION_CLEAR_GOLD);
            goldDelta += gold;
            realmId = omen;
            // The reaction settles the floor on one realm: a confluence ends with it.
            secondaryId = null;
            reactions += 1;
            events.push({
                key: eventKey(run, level, turns, 'reaction'),
                kind: 'reaction',
                tileIds: [...tileIds, ...burned],
                reaction: realmReactionName(from, omen),
                from,
                to: omen,
                gold
            });
            // A storm breaking strikes at once.
            if (omen === 'storm') {
                litTileIds = lightning(tiles, pinned, rngFor('reaction-strike', run, level, turns), reach);
            }
        }
    }

    // 2. The realm answers the turn.
    if (outcome === 'match') {
        const burningMatched = sourceTiles.filter((tile) => tile.fuse != null).length;
        if (burningMatched > 0) {
            doused += 1;
            goldDelta += DOUSE_GOLD;
            events.push({ key: eventKey(run, level, turns, 'doused'), kind: 'doused', tileIds: [...tileIds], gold: DOUSE_GOLD });
        }
        const cut: string[] = [];
        let cutGold = 0;
        const thawed: string[] = [];
        for (const id of tileIds) {
            const at = indexOf.get(id);
            if (at == null) continue;
            for (const near of orthogonalNeighbourIndices(at, board.columns, tiles.length)) {
                const tile = tiles[near];
                if (!tile || tile.state !== 'hidden') continue;
                if (tile.vined === true) {
                    tiles[near] = withoutVines(tile);
                    cut.push(tile.id);
                    cutGold += tile.bloom === true ? BLOOM_CUT_GOLD : VINE_CUT_GOLD;
                } else if (runNonNegativeInteger(tile.frost ?? 0) > 0) {
                    const { frost: _frost, ...rest } = tile;
                    tiles[near] = rest;
                    thawed.push(tile.id);
                }
            }
        }
        if (cut.length > 0) {
            vinesCut += cut.length;
            goldDelta += cutGold;
            events.push({ key: eventKey(run, level, turns, 'harvest'), kind: 'harvest', tileIds: cut, gold: cutGold });
        }
        if (thawed.length > 0) {
            events.push({ key: eventKey(run, level, turns, 'shatter'), kind: 'thaw', tileIds: thawed });
        }
    } else if (realmId === 'frost' || secondaryId === 'frost') {
        const turnsFrozen = severity === 'raging' ? FROSTBITE_TURNS_RAGING : FROSTBITE_TURNS;
        const froze: string[] = [];
        for (const id of tileIds) {
            const at = indexOf.get(id);
            const tile = at == null ? undefined : tiles[at];
            if (at == null || !tile || tile.state !== 'hidden' || !isRealCard(tile)) continue;
            tiles[at] = { ...tile, frost: turnsFrozen };
            froze.push(id);
            touchedThisTurn.add(id);
        }
        if (froze.length > 0) {
            frozen += froze.length;
            events.push({ key: eventKey(run, level, turns, 'frostbite'), kind: 'frostbite', tileIds: froze });
        }
    }
    if (outcome === 'miss' && severity === 'raging' && realmId !== 'frost') {
        const lashed = resolveRealmBacklash(realmId, tiles, board.columns, pinned, tileIds, rngFor('backlash', run, level, turns));
        if (lashed) {
            backlashes += 1;
            for (const id of lashed.tileIds) touchedThisTurn.add(id);
            events.push({ key: eventKey(run, level, turns, lashed.kind), kind: lashed.kind, tileIds: lashed.tileIds });
        }
    }

    // 3. The clocks tick.
    const burntOut: number[] = [];
    tiles.forEach((tile, index) => {
        if (tile.state !== 'hidden' || touchedThisTurn.has(tile.id)) return;
        let next = tile;
        const frost = runNonNegativeInteger(tile.frost ?? 0);
        if (tile.frost != null) {
            if (frost <= 1) {
                const { frost: _frost, ...rest } = next;
                next = rest;
            } else {
                next = { ...next, frost: frost - 1 };
            }
        }
        if (tile.fuse != null) {
            const fuse = runNonNegativeInteger(tile.fuse) - 1;
            if (fuse <= 0) {
                const { fuse: _fuse, ...rest } = next;
                next = rest;
                burntOut.push(index);
            } else {
                next = { ...next, fuse };
            }
        }
        if (next !== tile) tiles[index] = next;
    });
    if (burntOut.length > 0) {
        burnouts += burntOut.length;
        goldDelta -= burntOut.length * BURNOUT_GOLD;
        const spreadRng = rngFor('spread', run, level, turns);
        const spread: string[] = [];
        for (const index of burntOut) {
            const near = orthogonalNeighbourIndices(index, board.columns, tiles.length).filter((n) => {
                const tile = tiles[n];
                return tile != null && tile.state === 'hidden' && tile.fuse == null && isRealCard(tile);
            });
            for (let n = 0; n < reach && near.length > 0; n += 1) {
                const burning = tiles.filter((tile) => tile.state === 'hidden' && tile.fuse != null).length;
                if (burning >= WILDFIRE_MAX_BURNING) break;
                const pick = near.splice(pickRngIndex(spreadRng, near.length), 1)[0]!;
                tiles[pick] = { ...tiles[pick]!, fuse: WILDFIRE_FUSE };
                spread.push(tiles[pick]!.id);
            }
        }
        events.push({
            key: eventKey(run, level, turns, 'burnout'),
            kind: 'burnout',
            tileIds: [...burntOut.map((index) => tiles[index]!.id), ...spread],
            gold: -burntOut.length * BURNOUT_GOLD
        });
    }

    // 4. The weather: the realm's own, its peak every third time, and a confluence's two in turn.
    if (isRealmWeatherTurn(realmId, severity, turns)) {
        const count = runNonNegativeInteger(run.realmWeatherThisFloor ?? 0);
        const weatherRealm: RealmId = secondaryId && count % 2 === 1 ? secondaryId : realmId;
        const peak = isRealmPeak(count);
        const rng = rngFor(weatherRealm, run, level, turns);
        let touched: string[] = [];
        let kind: RealmEvent['kind'] = 'blizzard';
        switch (weatherRealm) {
            case 'frost': {
                if (peak) {
                    // Whiteout: every face-down card is snowed over.
                    tiles.forEach((tile, index) => {
                        if (tile.state === 'hidden') tiles[index] = { ...tile, snowed: true };
                    });
                    touched = tiles.filter((tile) => tile.state === 'hidden').map((tile) => tile.id);
                    kind = 'whiteout';
                    break;
                }
                // The wind holds its direction for a floor, so a player can learn which way it blows.
                const windEast = hashStringToSeed(`realm-wind:${run.runSeed}:${level}`) % 2 === 0;
                touched = blizzard(tiles, board, pinned, rng, windEast);
                kind = 'blizzard';
                break;
            }
            case 'ember':
                touched = wildfire(tiles, rng, reach);
                if (peak) {
                    touched = [...touched, ...spreadEveryFire(tiles, board, rng)];
                    kind = 'firestorm';
                } else {
                    kind = 'wildfire';
                }
                break;
            case 'tide': {
                const first = current(tiles, board, pinned, count);
                touched = first.ids;
                kind = 'current';
                if (peak && first.col >= 0) {
                    touched = [...touched, ...current(tiles, board, pinned, first.col + 1).ids.filter((id) => !first.ids.includes(id))];
                    kind = 'springtide';
                }
                break;
            }
            case 'storm':
                if (peak) {
                    touched = thunderclap(tiles, board);
                    kind = 'thunderclap';
                } else {
                    touched = lightning(tiles, pinned, rng, reach);
                    kind = 'lightning';
                }
                litTileIds = [...litTileIds, ...touched];
                break;
            case 'grove':
                touched = overgrowth(tiles, board, pinned, rng, reach);
                kind = 'overgrowth';
                if (peak) {
                    tiles.forEach((tile, index) => {
                        if (tile.state === 'hidden' && tile.vined === true) tiles[index] = { ...tile, bloom: true };
                    });
                    touched = tiles.filter((tile) => tile.state === 'hidden' && tile.bloom === true).map((tile) => tile.id);
                    kind = 'bloom';
                }
                break;
        }
        if (touched.length > 0) {
            weather += 1;
            if (peak) peaks += 1;
            events.push({ key: eventKey(run, level, turns, kind), kind, tileIds: touched });
        }
    }

    // 5. The guard.
    const freed = releaseRealmHoldsIfStuck(tiles);
    if (freed.length > 0) {
        events.push({ key: eventKey(run, level, turns, 'thaw'), kind: 'thaw', tileIds: freed });
    }

    const changed = tiles.some((tile, index) => tile !== board.tiles[index]);
    return {
        board: changed ? { ...board, tiles } : board,
        realmId,
        goldDelta,
        litTileIds: [...new Set(litTileIds)],
        events,
        weather,
        peaks,
        secondaryId,
        reactions,
        doused,
        burnouts,
        vinesCut,
        frozen,
        backlashes
    };
};

/** The run fields a realm turn writes, merged over the run the seam built. */
export const applyRealmTurnToRun = (run: RunState, result: RealmTurnResult): Partial<RunState> => {
    if (!runRealmId(run)) {
        return {};
    }
    const lit = result.litTileIds.length > 0
        ? { realmLitTileIds: [...new Set([...(run.realmLitTileIds ?? []), ...result.litTileIds])] }
        : {};
    return {
        board: result.board,
        realmId: result.realmId,
        realmSecondaryId: result.secondaryId,
        realmPeaksThisFloor: runNonNegativeInteger(run.realmPeaksThisFloor ?? 0) + result.peaks,
        gold: Math.max(0, runNonNegativeInteger(run.gold ?? 0) + result.goldDelta),
        realmWeatherThisFloor: runNonNegativeInteger(run.realmWeatherThisFloor ?? 0) + result.weather,
        realmReactionsThisFloor: runNonNegativeInteger(run.realmReactionsThisFloor ?? 0) + result.reactions,
        realmReactionsThisRun: runNonNegativeInteger(run.realmReactionsThisRun ?? 0) + result.reactions,
        realmDousedThisFloor: runNonNegativeInteger(run.realmDousedThisFloor ?? 0) + result.doused,
        realmBurnoutsThisFloor: runNonNegativeInteger(run.realmBurnoutsThisFloor ?? 0) + result.burnouts,
        realmVinesCutThisFloor: runNonNegativeInteger(run.realmVinesCutThisFloor ?? 0) + result.vinesCut,
        realmFrozenThisFloor: runNonNegativeInteger(run.realmFrozenThisFloor ?? 0) + result.frozen,
        realmBacklashesThisFloor: runNonNegativeInteger(run.realmBacklashesThisFloor ?? 0) + result.backlashes,
        // The most telling event of the turn is the one the HUD names: a reaction over everything.
        lastRealmEvent:
            result.events.find((event) => event.kind === 'reaction') ?? result.events[result.events.length - 1] ?? run.lastRealmEvent ?? null,
        ...lit
    };
};

/** A card turned face up sheds its snow: it has been read. */
export const shedSnow = (tile: Tile): Tile => {
    if (tile.snowed == null) return tile;
    const { snowed: _snowed, ...rest } = tile;
    return rest;
};
