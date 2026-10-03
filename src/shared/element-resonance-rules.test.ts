import { describe, expect, it } from 'vitest';
import type { BoardState, RealmId, RealmSeverity, RunState, Tile, TileSuit } from './contracts';
import { createNewRun } from './game';
import { TILE_SUITS } from './tile-suit-rules';
import {
    ELEMENT_REACTIONS,
    ELEMENT_REACTION_KINDS,
    RESONANCE_SCORE_PER_STACK,
    THAW_SCORE_PER_POTENCY_SQUARED,
    elementPopSpec,
    elementReactionOf,
    pendingElementReaction,
    reactionPotency,
    resolveElementReaction,
    resonanceAfterMatch,
    resonanceAfterMiss,
    resonanceTier,
    stacksForTier
} from './element-resonance-rules';
import { applyRealmTurnToRun, resolveRealmTurn } from './realm-weather-rules';
import { deepenFloorDeck } from './realm-rules';
import { resolveChunkBreak } from './chunk-break-rules';
import { resolveTurnMatchBoardResolution } from './turn-match-board-resolution-rules';

const card = (id: string, pairKey: string, suit?: TileSuit, extra: Partial<Tile> = {}): Tile => ({
    id,
    pairKey,
    symbol: pairKey,
    label: pairKey,
    state: 'hidden',
    ...(suit ? { suit } : {}),
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
} as BoardState);

const runIn = (realmId: RealmId, severity: RealmSeverity = 'calm', extra: Partial<RunState> = {}): RunState => ({
    ...createNewRun(0, { runSeed: 4242, realm: { realmId, severity } }),
    ...extra
});

/** A 4x3 floor: the matched fire pair in the corner, and one pair of each other element around it. */
const floor = (): Tile[] => [
    card('a1', 'a', 'ember', { state: 'matched' }), card('a2', 'a', 'ember', { state: 'matched' }), card('b1', 'b', 'tide'), card('b2', 'b', 'tide'),
    card('c1', 'c', 'moss'), card('c2', 'c', 'moss'), card('d1', 'd', 'bone'), card('d2', 'd', 'bone'),
    card('e1', 'e', 'ember'), card('e2', 'e', 'ember'), card('f1', 'f', 'tide'), card('f2', 'f', 'tide')
];

const matchTurn = (run: RunState, tiles: Tile[]) =>
    resolveRealmTurn({
        run,
        board: board(tiles),
        outcome: 'match',
        tileIds: ['a1', 'a2'],
        sourceTiles: tiles.slice(0, 2),
        groupTileIds: ['a1', 'a2'],
        pairsBySuit: { ember: 1 },
        turnsThisFloor: 1,
        pinnedTileIds: []
    });

describe('resonance, the streak and the reactions', () => {
    it('tiers come at T(T+1) stacks and never stop', () => {
        expect([0, 1, 2, 5, 6, 11, 12, 20, 30].map(resonanceTier)).toEqual([0, 0, 1, 1, 2, 2, 3, 4, 5]);
        expect(resonanceTier(stacksForTier(100))).toBe(100);
        expect(resonanceTier(stacksForTier(100) - 1)).toBe(99);
    });

    it('every two different elements make exactly one reaction, and one element makes none', () => {
        const names = new Set<string>();
        for (const a of TILE_SUITS) {
            expect(elementReactionOf(a, a)).toBeNull();
            for (const b of TILE_SUITS) {
                if (a === b) continue;
                const reaction = elementReactionOf(a, b)!;
                expect(reaction).toBe(elementReactionOf(b, a));
                names.add(reaction.name);
            }
        }
        expect(names.size).toBe(ELEMENT_REACTION_KINDS.length);
    });

    it('a match stacks its pairs and its charge without a cap, scores on the stacks it had, and grows the streak', () => {
        let resonance = {};
        let streak = null;
        for (let turn = 0; turn < 200; turn += 1) {
            const after = resonanceAfterMatch({ resonance, streak, pairsBySuit: { ember: 1 }, matchedTiles: [] });
            expect(after.score).toBe(turn * RESONANCE_SCORE_PER_STACK);
            resonance = after.resonance;
            streak = after.streak;
        }
        expect(resonance).toEqual({ ember: 200 });
        expect(streak).toEqual({ suit: 'ember', links: 200 });
        const charged = resonanceAfterMatch({
            resonance,
            streak,
            pairsBySuit: { ember: 2 },
            matchedTiles: [card('x', 'x', 'ember', { empowered: 7 }), card('y', 'x', 'ember')],
            extraPerPair: 1
        });
        expect(charged.gained).toBe(2 * 2 + 7);
        expect(charged.reaction).toBeNull();
    });

    it('a different element on a primed streak reacts; on one pair it only takes the hand', () => {
        const unprimed = resonanceAfterMatch({ resonance: { ember: 1 }, streak: { suit: 'ember', links: 1 }, pairsBySuit: { tide: 1 }, matchedTiles: [] });
        expect(unprimed.reaction).toBeNull();
        expect(unprimed.streak).toEqual({ suit: 'tide', links: 1 });
        const primed = resonanceAfterMatch({ resonance: { ember: 6 }, streak: { suit: 'ember', links: 3 }, pairsBySuit: { tide: 1 }, matchedTiles: [], stormDepth: 4 });
        expect(primed.reaction?.definition.kind).toBe('steam');
        // Three links in hand, half of fire's tier two, and half the storm's depth of four.
        expect(primed.reaction?.potency).toBe(3 + 1 + 2);
        expect(reactionPotency({ suit: 'ember', links: 3 }, { ember: 6 }, 4)).toBe(6);
        expect(primed.streak).toEqual({ suit: 'tide', links: 1 });
        // A pop's pairs are stacks, not links: one turn, one link.
        expect(resonanceAfterMatch({ resonance: {}, streak: null, pairsBySuit: { moss: 3 }, matchedTiles: [] }).streak).toEqual({ suit: 'moss', links: 1 });
    });

    it('a miss breaks the streak and sheds a stack of each missed card’s element, never under zero', () => {
        const after = resonanceAfterMiss({ ember: 3, tide: 0 }, [card('a', 'a', 'ember'), card('b', 'b', 'tide')]);
        expect(after.resonance).toEqual({ ember: 2, tide: 0 });
        expect(after.streak).toBeNull();
        expect(after.shed).toBe(1);
    });

    it('each reaction pays in its own resource', () => {
        const nearest = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        const steam = resolveElementReaction('steam', 3, floor(), nearest);
        expect(steam.litTileIds).toEqual(['b1', 'b2', 'c1']);
        const vined = floor().map((tile) => (tile.id === 'c1' || tile.id === 'f2' ? { ...tile, vined: true, bloom: true } : tile));
        const blaze = resolveElementReaction('blaze', 4, vined, nearest);
        expect(blaze.gold).toBe(2);
        expect(vined.some((tile) => tile.vined || tile.bloom)).toBe(false);
        const iced = floor().map((tile) => (tile.id === 'd1' ? { ...tile, frost: 2 } : tile.id === 'b1' ? { ...tile, snowed: true } : tile));
        const melt = resolveElementReaction('melt', 3, iced, nearest);
        expect(melt.score).toBe(THAW_SCORE_PER_POTENCY_SQUARED * 9);
        expect(iced.some((tile) => tile.frost != null || tile.snowed != null)).toBe(false);
        expect(resolveElementReaction('freezeover', 2, floor(), nearest).stillTurns).toBe(3);
        expect(resolveElementReaction('flood', 5, floor(), nearest).resonanceGain).toBe(5);
        const bloomed = floor();
        const frostbloom = resolveElementReaction('frostbloom', 2, bloomed, nearest);
        expect(frostbloom.touchedTileIds).toEqual(['b1', 'b2']);
        expect(bloomed[2]!.empowered).toBe(1);
        expect(Object.keys(ELEMENT_REACTIONS)).toHaveLength(6);
    });

    it('the turn seam: a fire match on a primed water streak is Steam, lit cards and all', () => {
        const run = runIn('storm', 'calm', { elementStreak: { suit: 'tide', links: 3 }, elementResonance: { tide: 2, ember: 4 } });
        const result = matchTurn(run, floor());
        expect(result.elementReactions).toBe(1);
        const steam = result.events.find((event) => event.kind === 'steam')!;
        // Three links in hand; tier one of water is not yet half a step.
        expect(steam.potency).toBe(3);
        expect(steam.reaction).toBe('Steam');
        expect(result.litTileIds).toHaveLength(3);
        // Four stacks of fire scored, and one more now.
        expect(result.scoreDelta).toBe(4 * RESONANCE_SCORE_PER_STACK);
        expect(result.resonance).toEqual({ tide: 2, ember: 5 });
        expect(result.streak).toEqual({ suit: 'ember', links: 1 });
        const written = applyRealmTurnToRun(run, result);
        expect(written.elementReactionsThisRun).toBe(1);
        expect(written.lastRealmEvent?.kind).toBe('steam');
        expect(written.stats?.totalScore).toBe(run.stats.totalScore + 4 * RESONANCE_SCORE_PER_STACK);
        // The cast fed its own kind. Fire at five stacks is tier one: a reach of three, and its kin charged two steps out.
        expect(result.board.tiles.find((tile) => tile.id === 'e1')?.empowered).toBe(1);
        expect(result.board.tiles.find((tile) => tile.id === 'e2')?.empowered).toBe(1);
    });

    it('a Freeze-over holds the floor still: a raging frost miss freezes nothing, and the count runs down', () => {
        const tiles = floor().map((tile) => ({ ...tile, state: 'hidden' as const }));
        const run = runIn('frost', 'raging', { realmStillTurns: 2 });
        const result = resolveRealmTurn({ run, board: board(tiles), outcome: 'miss', tileIds: ['b1', 'c1'], sourceTiles: [tiles[2]!, tiles[4]!], turnsThisFloor: 3, pinnedTileIds: [] });
        expect(result.board.tiles.some((tile) => (tile.frost ?? 0) > 0)).toBe(false);
        expect(result.weather).toBe(0);
        expect(result.stillTurns).toBe(1);
    });

    it('a missed card loses its charge and its element a stack', () => {
        const tiles = floor().map((tile) => ({ ...tile, state: 'hidden' as const, ...(tile.id === 'b1' ? { empowered: 4 } : {}) }));
        const run = runIn('storm', 'calm', { elementResonance: { tide: 5 }, elementStreak: { suit: 'tide', links: 3 } });
        const result = resolveRealmTurn({ run, board: board(tiles), outcome: 'miss', tileIds: ['b1', 'c1'], sourceTiles: [tiles[2]!, tiles[4]!], turnsThisFloor: 1, pinnedTileIds: [] });
        expect(result.board.tiles.find((tile) => tile.id === 'b1')?.empowered).toBeUndefined();
        expect(result.resonance.tide).toBe(4);
        expect(result.streak).toBeNull();
    });

    it('a deep realm strikes back at a miss on a calm floor', () => {
        const tiles = floor().map((tile) => ({ ...tile, state: 'hidden' as const }));
        const miss = (depth: number) =>
            resolveRealmTurn({
                run: runIn('grove', 'calm', { realmAttunement: { grove: depth } }),
                board: board(tiles),
                outcome: 'miss',
                tileIds: ['b1', 'd1'],
                sourceTiles: [tiles[2]!, tiles[6]!],
                turnsThisFloor: 1,
                pinnedTileIds: []
            });
        expect(miss(5).backlashes).toBe(0);
        expect(miss(6).backlashes).toBe(1);
    });

    it('the pop is the reaction\u2019s: no realm keeps the old pop, a realm floor pops nothing until two elements meet', () => {
        expect(elementPopSpec({}, 'ember')).toBeUndefined();
        expect(elementPopSpec({ realmId: 'storm' }, 'ember')).toBeNull();
        expect(elementPopSpec({ realmId: 'storm', elementStreak: { suit: 'ember', links: 5 } }, 'ember')).toBeNull();
        expect(elementPopSpec({ realmId: 'storm', elementStreak: { suit: 'tide', links: 1 } }, 'ember')).toBeNull();
        expect(elementPopSpec({ realmId: 'storm', elementStreak: { suit: 'tide', links: 3 }, elementResonance: { tide: 6 } }, 'ember')).toEqual({ suits: ['ember', 'tide'], pairsPerSuit: 4 });
        expect(pendingElementReaction({ elementStreak: { suit: 'tide', links: 2 } }, 'bone')?.definition.kind).toBe('freezeover');
    });

    it('a plain match on a realm floor takes its own pair; a reacting one bursts the nearest pairs of both elements', () => {
        // Fire a/e and water b/f all touch: off a realm floor, matching a pops its clump.
        const tiles = (): Tile[] => floor().map((tile) => ({ ...tile, state: 'hidden' as const }));
        const resolve = (run: RunState) => resolveTurnMatchBoardResolution({ run, board: board(tiles()), firstTileId: 'a1', secondTileId: 'a2' });
        const gone = (result: ReturnType<typeof resolve>): string[] => result.chunkBreak.brokenPairKeys.slice().sort();
        expect(gone(resolve(runIn('storm', 'calm')))).toEqual([]);
        expect(gone(resolve(runIn('storm', 'calm', { elementStreak: { suit: 'ember', links: 4 } })))).toEqual([]);
        // Water primed at two links: fire meets it, potency two, so up to two pairs of each. One fire pair and two water pairs stand.
        const steam = resolve(runIn('storm', 'calm', { elementStreak: { suit: 'tide', links: 2 } }));
        expect(gone(steam)).toEqual(['b', 'e', 'f']);
        expect(steam.chunkBreak.waves).toBe(1);
        expect(steam.chunkBreak.score).toBeGreaterThan(0);
        expect(steam.board.tiles.filter((tile) => tile.state === 'removed')).toHaveLength(6);
        // At one link of potency it takes the nearest pair of each and leaves the further water pair.
        const one = resolveChunkBreak({ board: board(tiles().map((tile) => (tile.pairKey === 'a' ? { ...tile, state: 'matched' as const } : tile))), run: { floorCurioId: null }, matchedTileIds: ['a1', 'a2'], chain: 1, spec: { suits: ['ember', 'tide'], pairsPerSuit: 1 } });
        expect(one.brokenPairKeys.slice().sort()).toEqual(['b', 'e']);
        // Grove and frost stand through a fire-and-water reaction.
        expect(steam.board.tiles.filter((tile) => tile.suit === 'moss' || tile.suit === 'bone').every((tile) => tile.state === 'hidden')).toBe(true);
    });

    it('the deeper the realm, the more of the floor is its element, to half the pairs', () => {
        const tiles = floor().map((tile) => ({ ...tile, state: 'hidden' as const }));
        const count = (depth: number): number => new Set(deepenFloorDeck(board(tiles), 'frost', depth, 7, 51).tiles.filter((tile) => tile.suit === 'bone').map((tile) => tile.pairKey)).size;
        expect(count(0)).toBe(1);
        expect(count(1)).toBe(2);
        expect(count(40)).toBe(3);
        // Both halves of a pair turn together, and the storm has no element to deal.
        const deep = deepenFloorDeck(board(tiles), 'frost', 2, 7, 51).tiles;
        for (const tile of deep) expect(tile.suit).toBe(deep.find((other) => other.pairKey === tile.pairKey)!.suit);
        expect(deepenFloorDeck(board(tiles), 'storm', 9, 7, 51).tiles).toEqual(tiles);
    });
});
