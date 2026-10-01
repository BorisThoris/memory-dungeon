import { describe, expect, it } from 'vitest';
import type { BoardState, RealmId, RealmSeverity, RunState, Tile } from './contracts';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';
import {
    BURNOUT_GOLD,
    DOUSE_GOLD,
    FROSTBITE_TURNS,
    VINE_CUT_GOLD,
    WILDFIRE_FUSE,
    BLOOM_CUT_GOLD,
    FIRESTORM_MAX_BURNING,
    boardHasTurnablePair,
    isRealmPeak,
    nextRealmWeather,
    isTileFlipBlocked,
    resolveRealmTurn
} from './realm-weather-rules';

const tile = (id: string, pairKey: string, extra: Partial<Tile> = {}): Tile => ({
    id,
    pairKey,
    state: 'hidden',
    symbol: pairKey,
    label: pairKey,
    ...extra
});

const board = (tiles: Tile[], columns = 4): BoardState => ({
    level: 5,
    pairCount: tiles.length / 2,
    columns,
    rows: Math.ceil(tiles.length / columns),
    tiles,
    flippedTileIds: [],
    matchedPairs: 0,
    floorArchetypeId: null,
    featuredObjectiveId: null
});

const sixteen = (): Tile[] =>
    ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].flatMap((key) => [tile(`${key}1`, key), tile(`${key}2`, key)]);

const runIn = (realmId: RealmId, severity: RealmSeverity = 'wild', extra: Partial<RunState> = {}): RunState => ({
    ...createNewRun(0, { runSeed: 4242, realm: { realmId, severity } }),
    ...extra
});

const turn = (
    run: RunState,
    b: BoardState,
    outcome: 'match' | 'miss',
    ids: string[],
    turnsThisFloor: number
) =>
    resolveRealmTurn({
        run,
        board: b,
        outcome,
        tileIds: ids,
        sourceTiles: ids.map((id) => b.tiles.find((t) => t.id === id)!),
        turnsThisFloor,
        pinnedTileIds: []
    });

const multiset = (b: BoardState): string[] => b.tiles.map((t) => t.id).sort();

describe('realm weather', () => {
    it('does nothing on a run without a realm', () => {
        const b = board(sixteen());
        const result = turn({ ...runIn('frost'), realmId: null }, b, 'miss', ['a1', 'b1'], 4);
        expect(result.board).toBe(b);
        expect(result.events).toEqual([]);
    });

    it('frost: a miss freezes both cards, and a frozen card cannot be turned until the ice goes', () => {
        const b = board(sixteen());
        const result = turn(runIn('frost'), b, 'miss', ['a1', 'b1'], 1);
        const a1 = result.board.tiles.find((t) => t.id === 'a1')!;
        expect(a1.frost).toBe(FROSTBITE_TURNS);
        expect(isTileFlipBlocked(a1)).toBe(true);
        expect(result.frozen).toBe(2);
        // Two turns later it has thawed.
        const after1 = turn(runIn('frost'), result.board, 'miss', ['c1', 'd1'], 2);
        expect(after1.board.tiles.find((t) => t.id === 'a1')!.frost).toBe(1);
        const after2 = turn(runIn('frost'), after1.board, 'miss', ['e1', 'f1'], 3);
        expect(after2.board.tiles.find((t) => t.id === 'a1')!.frost).toBeUndefined();
    });

    it('frost: a blizzard slides one row with the wind and snows it over, moving nothing off the board', () => {
        const b = board(sixteen());
        const result = turn(runIn('frost'), b, 'match', ['h1', 'h2'].filter(() => false), 4);
        const event = result.events.find((e) => e.kind === 'blizzard')!;
        expect(event.tileIds.length).toBeGreaterThanOrEqual(2);
        expect(multiset(result.board)).toEqual(multiset(b));
        const snowed = result.board.tiles.filter((t) => t.snowed);
        expect(snowed.map((t) => t.id).sort()).toEqual([...event.tileIds].sort());
        // All snowed cards share one row.
        const rows = new Set(snowed.map((t) => Math.floor(result.board.tiles.indexOf(t) / 4)));
        expect(rows.size).toBe(1);
    });

    it('frost: a flip is refused on a frozen card through the real turn seam', () => {
        let run = finishMemorizePhase(createNewRun(0, { runSeed: 9, realm: { realmId: 'frost', severity: 'wild' } }));
        const target = run.board!.tiles[0]!;
        run = { ...run, board: { ...run.board!, tiles: run.board!.tiles.map((t) => (t.id === target.id ? { ...t, frost: 2 } : t)) } };
        expect(flipTile(run, target.id)).toBe(run);
    });

    it('ember: wildfire lights a card on a fuse; matched in time it is doused for gold', () => {
        const b = board(sixteen());
        const lit = turn(runIn('ember'), b, 'miss', ['a1', 'b1'], 3);
        const burning = lit.board.tiles.filter((t) => t.fuse === WILDFIRE_FUSE);
        expect(burning).toHaveLength(1);
        const pairKey = burning[0]!.pairKey;
        const matched = board(lit.board.tiles.map((t) => (t.pairKey === pairKey ? { ...t, state: 'matched' as const } : t)));
        const sources = lit.board.tiles.filter((t) => t.pairKey === pairKey);
        const doused = resolveRealmTurn({
            run: runIn('ember'),
            board: matched,
            outcome: 'match',
            tileIds: sources.map((t) => t.id),
            sourceTiles: sources,
            turnsThisFloor: 4,
            pinnedTileIds: []
        });
        expect(doused.doused).toBe(1);
        expect(doused.goldDelta).toBe(DOUSE_GOLD);
    });

    it('ember: a fuse that runs out burns a gold and spreads to a neighbour', () => {
        const tiles = sixteen();
        tiles[5] = { ...tiles[5]!, fuse: 1 };
        const result = turn(runIn('ember', 'calm'), board(tiles), 'miss', ['a1', 'h2'], 1);
        expect(result.burnouts).toBe(1);
        expect(result.goldDelta).toBe(-BURNOUT_GOLD);
        expect(result.board.tiles[5]!.fuse).toBeUndefined();
        expect(result.board.tiles.filter((t) => t.fuse === WILDFIRE_FUSE)).toHaveLength(1);
    });

    it('tide: the current runs one column down a step', () => {
        const b = board(sixteen());
        const result = turn(runIn('tide'), b, 'miss', ['a1', 'b1'], 3);
        const event = result.events.find((e) => e.kind === 'current')!;
        expect(event.tileIds).toHaveLength(4);
        expect(multiset(result.board)).toEqual(multiset(b));
        // Column 0, cycled down: the bottom card wraps to the top.
        expect(result.board.tiles[0]!.id).toBe(b.tiles[12]!.id);
        expect(result.board.tiles[4]!.id).toBe(b.tiles[0]!.id);
    });

    it('storm: lightning swaps two cards and leaves them lit', () => {
        const b = board(sixteen());
        const result = turn(runIn('storm'), b, 'miss', ['a1', 'b1'], 4);
        expect(result.litTileIds).toHaveLength(2);
        expect(multiset(result.board)).toEqual(multiset(b));
        const moved = result.board.tiles.filter((t, i) => t.id !== b.tiles[i]!.id);
        expect(moved).toHaveLength(2);
    });

    it('grove: vines hold a card; a match beside them cuts them for gold', () => {
        const tiles = sixteen();
        tiles[1] = { ...tiles[1]!, vined: true };
        expect(isTileFlipBlocked(tiles[1]!)).toBe(true);
        // b1/b2 are at 2 and 3; matching a pair at index 0 and 5 touches index 1.
        const pair = [tiles[0]!, tiles[5]!];
        const matched = board(tiles.map((t, i) => (i === 0 || i === 5 ? { ...t, state: 'matched' as const } : t)));
        const result = resolveRealmTurn({
            run: runIn('grove'),
            board: matched,
            outcome: 'match',
            tileIds: pair.map((t) => t.id),
            sourceTiles: pair,
            turnsThisFloor: 1,
            pinnedTileIds: []
        });
        expect(result.vinesCut).toBe(1);
        expect(result.goldDelta).toBe(VINE_CUT_GOLD);
        expect(result.board.tiles[1]!.vined).toBeUndefined();
    });

    it('the guard: ice and vines always leave a pair that can be turned', () => {
        const tiles = sixteen().map((t, i) => (i % 2 === 0 ? { ...t, vined: true } : { ...t }));
        expect(boardHasTurnablePair(tiles)).toBe(false);
        const result = turn(runIn('grove', 'calm'), board(tiles), 'miss', ['a2', 'b2'], 1);
        expect(boardHasTurnablePair(result.board.tiles)).toBe(true);
        expect(result.events.some((e) => e.kind === 'thaw')).toBe(true);
    });

    it('an omen matched sets off a reaction and turns the realm', () => {
        const tiles = sixteen().map((t) => (t.pairKey === 'a' ? { ...t, omen: 'ember' as const } : t));
        tiles[6] = { ...tiles[6]!, frost: 2 };
        const pair = tiles.filter((t) => t.pairKey === 'a');
        const matched = board(tiles.map((t) => (t.pairKey === 'a' ? { ...t, state: 'matched' as const } : t)));
        const result = resolveRealmTurn({
            run: runIn('frost'),
            board: matched,
            outcome: 'match',
            tileIds: pair.map((t) => t.id),
            sourceTiles: pair,
            turnsThisFloor: 1,
            pinnedTileIds: []
        });
        expect(result.realmId).toBe('ember');
        const reaction = result.events.find((e) => e.kind === 'reaction')!;
        expect(reaction.reaction).toBe('Thaw');
        expect(result.board.tiles[6]!.frost).toBeUndefined();
        expect(result.goldDelta).toBe(1);
    });

    it('wildfire through a grove sets the vines alight', () => {
        const tiles = sixteen().map((t) => (t.pairKey === 'a' ? { ...t, omen: 'ember' as const } : t));
        tiles[6] = { ...tiles[6]!, vined: true };
        const pair = tiles.filter((t) => t.pairKey === 'a');
        const result = resolveRealmTurn({
            run: runIn('grove'),
            board: board(tiles.map((t) => (t.pairKey === 'a' ? { ...t, state: 'matched' as const } : t))),
            outcome: 'match',
            tileIds: pair.map((t) => t.id),
            sourceTiles: pair,
            turnsThisFloor: 1,
            pinnedTileIds: []
        });
        expect(result.events[0]!.reaction).toBe('Wildfire');
        expect(result.board.tiles[6]!.fuse).toBe(WILDFIRE_FUSE);
        expect(result.board.tiles[6]!.vined).toBeUndefined();
    });

    it('every third weather of a floor is the realm\u2019s peak', () => {
        expect([0, 1, 2, 3, 4, 5].map(isRealmPeak)).toEqual([false, false, true, false, false, true]);
        expect(nextRealmWeather({ realmId: 'frost', realmWeatherThisFloor: 2 })).toEqual({ realmId: 'frost', peak: true, name: 'Whiteout' });
        expect(nextRealmWeather({ realmId: 'frost', realmWeatherThisFloor: 1 })?.name).toBe('Blizzard');
    });

    it('frost peak: a whiteout snows over every face-down card', () => {
        const b = board(sixteen());
        const result = turn(runIn('frost', 'wild', { realmWeatherThisFloor: 2 }), b, 'match', [], 4);
        expect(result.events.find((e) => e.kind === 'whiteout')).toBeDefined();
        expect(result.board.tiles.every((t) => t.snowed)).toBe(true);
        expect(result.peaks).toBe(1);
    });

    it('ember peak: a firestorm lights a fire and spreads every fire, under its cap', () => {
        const tiles = sixteen();
        tiles[0] = { ...tiles[0]!, fuse: 2 };
        tiles[10] = { ...tiles[10]!, fuse: 2 };
        const result = turn(runIn('ember', 'wild', { realmWeatherThisFloor: 2 }), board(tiles), 'match', [], 3);
        expect(result.events.find((e) => e.kind === 'firestorm')).toBeDefined();
        const burning = result.board.tiles.filter((t) => t.fuse != null).length;
        expect(burning).toBeGreaterThan(3);
        expect(burning).toBeLessThanOrEqual(FIRESTORM_MAX_BURNING);
    });

    it('tide peak: a spring tide runs two columns', () => {
        const b = board(sixteen());
        const result = turn(runIn('tide', 'wild', { realmWeatherThisFloor: 2 }), b, 'miss', ['a1', 'b1'], 3);
        expect(result.events.find((e) => e.kind === 'springtide')!.tileIds).toHaveLength(8);
    });

    it('storm peak: a thunderclap lights a whole row and moves nothing', () => {
        const b = board(sixteen());
        const result = turn(runIn('storm', 'wild', { realmWeatherThisFloor: 2 }), b, 'miss', ['a1', 'b1'], 4);
        expect(result.litTileIds).toHaveLength(4);
        expect(result.board.tiles.map((t) => t.id)).toEqual(b.tiles.map((t) => t.id));
    });

    it('grove peak: the vines bloom, and a bloom cut pays three gold', () => {
        const tiles = sixteen();
        tiles[1] = { ...tiles[1]!, vined: true };
        const bloomed = turn(runIn('grove', 'wild', { realmWeatherThisFloor: 2 }), board(tiles), 'miss', ['h1', 'h2'], 3);
        expect(bloomed.events.find((e) => e.kind === 'bloom')).toBeDefined();
        expect(bloomed.board.tiles[1]!.bloom).toBe(true);
        const pair = [bloomed.board.tiles[0]!, bloomed.board.tiles[5]!];
        const cut = resolveRealmTurn({
            run: runIn('grove', 'wild', { realmWeatherThisFloor: 3 }),
            board: board(bloomed.board.tiles.map((t, i) => (i === 0 || i === 5 ? { ...t, state: 'matched' as const } : t))),
            outcome: 'match',
            tileIds: pair.map((t) => t.id),
            sourceTiles: pair,
            turnsThisFloor: 4,
            pinnedTileIds: []
        });
        expect(cut.board.tiles[1]!.vined).toBeUndefined();
        expect(cut.board.tiles[1]!.bloom).toBeUndefined();
        expect(cut.goldDelta).toBeGreaterThanOrEqual(BLOOM_CUT_GOLD);
    });

    it('a confluence alternates its two realms\u2019 weather, and both answer the player', () => {
        const b = board(sixteen());
        const run = runIn('storm', 'wild', { realmSecondaryId: 'frost', realmWeatherThisFloor: 1 });
        expect(nextRealmWeather(run)?.realmId).toBe('frost');
        const result = turn(run, b, 'miss', ['a1', 'b1'], 4);
        // The second weather is the frost's, and the frost freezes a miss even on a storm floor.
        expect(result.events.map((e) => e.kind)).toEqual(['frostbite', 'blizzard']);
        expect(result.board.tiles.find((t) => t.id === 'a1')!.frost).toBe(FROSTBITE_TURNS);
    });

    it('an omen reaction ends a confluence', () => {
        const tiles = sixteen().map((t) => (t.pairKey === 'a' ? { ...t, omen: 'ember' as const } : t));
        const pair = tiles.filter((t) => t.pairKey === 'a');
        const result = resolveRealmTurn({
            run: runIn('storm', 'wild', { realmSecondaryId: 'frost' }),
            board: board(tiles.map((t) => (t.pairKey === 'a' ? { ...t, state: 'matched' as const } : t))),
            outcome: 'match',
            tileIds: pair.map((t) => t.id),
            sourceTiles: pair,
            turnsThisFloor: 1,
            pinnedTileIds: []
        });
        expect(result.realmId).toBe('ember');
        expect(result.secondaryId).toBeNull();
    });

    it('is seeded: the same turn on the same board does the same thing', () => {
        const b = board(sixteen());
        for (const realm of ['frost', 'ember', 'tide', 'storm', 'grove'] as const) {
            expect(turn(runIn(realm, 'raging'), b, 'miss', ['a1', 'b1'], 6)).toEqual(
                turn(runIn(realm, 'raging'), b, 'miss', ['a1', 'b1'], 6)
            );
        }
    });

    it('whole floors in every realm always leave a way to finish', () => {
        for (const realmId of ['frost', 'ember', 'tide', 'storm', 'grove'] as const) {
            for (const seed of [1, 2, 3, 4, 5]) {
                let run = finishMemorizePhase(createNewRun(0, { runSeed: seed, realm: { realmId, severity: 'raging' } }));
                let safety = 0;
                while (run.status === 'playing' && safety++ < 200) {
                    const open = run.board!.tiles.filter((t) => t.state === 'hidden' && !isTileFlipBlocked(t));
                    expect(boardHasTurnablePair(run.board!.tiles)).toBe(true);
                    const a = open[safety % open.length]!;
                    const b = open.find((t) => t !== a && t.pairKey === a.pairKey) ?? open.find((t) => t !== a)!;
                    run = resolveBoardTurn(flipTile(flipTile(run, a.id), b.id));
                }
                expect(['levelComplete', 'gameOver']).toContain(run.status);
            }
        }
    });
});
