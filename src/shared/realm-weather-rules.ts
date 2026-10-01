import type { BoardState, RealmEvent, RealmId, RealmSeverity, RunState, Tile } from './contracts';
import { isSingletonUtilityPairKey, isWildPairKey } from './tile-identity';
import { orthogonalNeighbourIndices } from './skittish-cards-rules';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { runNonNegativeInteger } from './run-number-guards';
import { REALM_SEVERITIES, isRealmWeatherTurn, runRealmId, runRealmSeverity } from './realm-rules';
import { omenOfMatch, realmReactionName } from './realm-omen-rules';

/**
 * What a realm does to the board on a resolved turn (`realm-rules.ts` has the realms themselves).
 *
 * Applied last in both turn seams, on the board the turn actually produced, in this order:
 *
 * 1. an omen matched sets off its reaction and turns the realm (`realm-omen-rules.ts`);
 * 2. the realm answers the turn: a match douses a burning card, cuts the vines beside it and
 *    shatters the ice beside it; a miss in the frost freezes the cards it showed;
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
export const REACTION_CLEAR_GOLD = 1;
export const REACTION_CLEAR_GOLD_CAP = 5;

/** A card the player cannot turn because of the realm: frozen, or held by vines. */
export const isTileFlipBlocked = (tile: Tile): boolean =>
    tile.state === 'hidden' && (runNonNegativeInteger(tile.frost ?? 0) > 0 || tile.vined === true);

const hasRealmStatus = (tile: Tile): boolean =>
    tile.frost != null || tile.snowed != null || tile.fuse != null || tile.vined != null;

const withoutRealmStatus = (tile: Tile): Tile => {
    if (!hasRealmStatus(tile)) return tile;
    const { frost: _frost, snowed: _snowed, fuse: _fuse, vined: _vined, ...rest } = tile;
    return rest;
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
    reactions: number;
    doused: number;
    burnouts: number;
    vinesCut: number;
    frozen: number;
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

const current = (tiles: Tile[], board: BoardState, pinned: ReadonlySet<string>, sweep: number): string[] => {
    const cols = Math.max(1, board.columns);
    for (let step = 0; step < cols; step += 1) {
        const col = (sweep + step) % cols;
        const indices: number[] = [];
        for (let index = col; index < tiles.length; index += cols) {
            if (movable(tiles, index, pinned)) indices.push(index);
        }
        if (indices.length >= 2) {
            cycleTiles(tiles, indices);
            return indices.map((index) => tiles[index]!.id);
        }
    }
    return [];
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
            const { frost: _frost, vined: _vined, ...rest } = tile;
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
        reactions: 0,
        doused: 0,
        burnouts: 0,
        vinesCut: 0,
        frozen: 0
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
    let goldDelta = 0;
    let reactions = 0;
    let doused = 0;
    let burnouts = 0;
    let vinesCut = 0;
    let frozen = 0;
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
        const thawed: string[] = [];
        for (const id of tileIds) {
            const at = indexOf.get(id);
            if (at == null) continue;
            for (const near of orthogonalNeighbourIndices(at, board.columns, tiles.length)) {
                const tile = tiles[near];
                if (!tile || tile.state !== 'hidden') continue;
                if (tile.vined === true) {
                    const { vined: _vined, ...rest } = tile;
                    tiles[near] = rest;
                    cut.push(tile.id);
                } else if (runNonNegativeInteger(tile.frost ?? 0) > 0) {
                    const { frost: _frost, ...rest } = tile;
                    tiles[near] = rest;
                    thawed.push(tile.id);
                }
            }
        }
        if (cut.length > 0) {
            vinesCut += cut.length;
            goldDelta += cut.length * VINE_CUT_GOLD;
            events.push({ key: eventKey(run, level, turns, 'harvest'), kind: 'harvest', tileIds: cut, gold: cut.length * VINE_CUT_GOLD });
        }
        if (thawed.length > 0) {
            events.push({ key: eventKey(run, level, turns, 'shatter'), kind: 'thaw', tileIds: thawed });
        }
    } else if (realmId === 'frost') {
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

    // 4. The weather.
    if (isRealmWeatherTurn(realmId, severity, turns)) {
        const rng = rngFor(realmId, run, level, turns);
        const sweep = runNonNegativeInteger(run.realmWeatherThisFloor ?? 0);
        let touched: string[] = [];
        let kind: RealmEvent['kind'] = 'blizzard';
        switch (realmId) {
            case 'frost': {
                // The wind holds its direction for a floor, so a player can learn which way it blows.
                const windEast = hashStringToSeed(`realm-wind:${run.runSeed}:${level}`) % 2 === 0;
                touched = blizzard(tiles, board, pinned, rng, windEast);
                kind = 'blizzard';
                break;
            }
            case 'ember':
                touched = wildfire(tiles, rng, reach);
                kind = 'wildfire';
                break;
            case 'tide':
                touched = current(tiles, board, pinned, sweep);
                kind = 'current';
                break;
            case 'storm':
                touched = lightning(tiles, pinned, rng, reach);
                litTileIds = [...litTileIds, ...touched];
                kind = 'lightning';
                break;
            case 'grove':
                touched = overgrowth(tiles, board, pinned, rng, reach);
                kind = 'overgrowth';
                break;
        }
        if (touched.length > 0) {
            weather += 1;
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
        reactions,
        doused,
        burnouts,
        vinesCut,
        frozen
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
        gold: Math.max(0, runNonNegativeInteger(run.gold ?? 0) + result.goldDelta),
        realmWeatherThisFloor: runNonNegativeInteger(run.realmWeatherThisFloor ?? 0) + result.weather,
        realmReactionsThisFloor: runNonNegativeInteger(run.realmReactionsThisFloor ?? 0) + result.reactions,
        realmReactionsThisRun: runNonNegativeInteger(run.realmReactionsThisRun ?? 0) + result.reactions,
        realmDousedThisFloor: runNonNegativeInteger(run.realmDousedThisFloor ?? 0) + result.doused,
        realmBurnoutsThisFloor: runNonNegativeInteger(run.realmBurnoutsThisFloor ?? 0) + result.burnouts,
        realmVinesCutThisFloor: runNonNegativeInteger(run.realmVinesCutThisFloor ?? 0) + result.vinesCut,
        realmFrozenThisFloor: runNonNegativeInteger(run.realmFrozenThisFloor ?? 0) + result.frozen,
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
