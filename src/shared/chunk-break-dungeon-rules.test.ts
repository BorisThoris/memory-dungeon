import { describe, expect, it } from 'vitest';
import type { BoardState, EnemyHazardState, RunState, Tile, TileSuit } from './contracts';
import { makeBoard, makeRun, makeTile } from './test/game-fixtures';
import { resolveBoardTurn, flipTile } from './game';
import { findSuitRegion, resolveChunkBreak, tileBlocksChunk } from './chunk-break-rules';
import { applyMagpieTheft, resolveMagpieVisit } from './magpie-rules';
import { FLOOR_CURIO_GREETINGS, floorCurioGreetingReply } from './floor-curio-greeting-rules';
import { createNewRun } from './run-creation-rules';

/**
 * Same map as chunk-break-rules.test.ts, four columns:
 *
 *   A  B  C  D        A B C ember, D tide
 *   A' B' E  F        E F tide
 *   D' C' E' F'
 */
const suit = (id: string): TileSuit => (['A', 'B', 'C'].includes(id[0]!) ? 'ember' : 'tide');
const tile = (id: string, extra: Partial<Tile> = {}): Tile => makeTile(id, id[0]!, id[0]!, { suit: suit(id), ...extra });
const layout = (edit: (t: Tile) => Tile = (t) => t): Tile[] =>
    [
        tile('A1'), tile('B1'), tile('C1'), tile('D1'),
        tile('A2'), tile('B2'), tile('E1'), tile('F1'),
        tile('D2'), tile('C2'), tile('E2'), tile('F2')
    ].map(edit);
const board = (tiles: Tile[], overrides: Partial<BoardState> = {}): BoardState =>
    makeBoard(tiles, { columns: 4, rows: 3, level: 3, ...overrides });
const endless: Pick<RunState, 'gameMode' | 'floorCurioId'> = { gameMode: 'endless', floorCurioId: null };
const sharp = (b: BoardState, run: Pick<RunState, 'gameMode' | 'floorCurioId'> = endless) => resolveChunkBreak({ board: b, run, matchedTileIds: ['A1', 'A2'], chain: 6 });

describe('traps stop chunks', () => {
    it('does not propagate through an unsprung trap, so C behind it survives', () => {
        const trapped = board(layout((t) => (t.id === 'B2' ? { ...t, dungeonCardKind: 'trap', dungeonCardState: 'hidden' } : t)));
        expect(tileBlocksChunk(trapped.tiles[5]!)).toBe(true);
        // B1 is still reachable from A1 directly; C is only reachable through B2, which is the trap.
        const region = findSuitRegion(trapped, ['A1', 'A2'], Number.POSITIVE_INFINITY).map((i) => trapped.tiles[i]!.id);
        expect(region).toContain('B1');
        expect(region).not.toContain('B2');
        expect(region).not.toContain('C2');
    });

    it('propagates through a trap that has already sprung', () => {
        const sprung = board(layout((t) => (t.id === 'B2' ? { ...t, dungeonCardKind: 'trap', dungeonCardState: 'resolved' } : t)));
        expect(findSuitRegion(sprung, ['A1', 'A2'], Number.POSITIVE_INFINITY).map((i) => sprung.tiles[i]!.id)).toContain('C2');
    });
});

describe('chunks are attacks', () => {
    it('hits a revealed enemy card standing inside the clump for the chunk size, and finishes it at zero', () => {
        const withEnemy = board(
            layout((t) =>
                t.pairKey === 'C'
                    ? { ...t, dungeonCardKind: 'enemy', dungeonCardState: 'revealed', dungeonCardHp: 1, dungeonCardMaxHp: 2 }
                    : t
            )
        );
        const result = sharp(withEnemy);
        // B breaks (1 pair); C is the enemy inside the region and takes 1, which is all it had.
        expect(result.brokenPairKeys).toEqual(['B']);
        expect(result.enemyHits).toBe(1);
        expect(result.enemiesDefeated).toBe(1);
        expect(result.board.tiles.find((t) => t.id === 'C1')?.state).toBe('removed');
        expect(result.score).toBeGreaterThan(sharp(board(layout((t) => (t.pairKey === 'C' ? { ...t, state: 'matched' } : t)))).score);
    });

    it('hits a revealed warden standing on a tile inside the clump, and leaves a hidden one alone', () => {
        const hazard = (state: EnemyHazardState['state']): EnemyHazardState => ({
            id: 'w1',
            kind: 'warden',
            label: 'Warden',
            currentTileId: 'B1',
            nextTileId: 'C1',
            pattern: 'patrol' as EnemyHazardState['pattern'],
            state,
            damage: 1,
            hp: 3,
            maxHp: 3
        });
        const revealed = sharp(board(layout(), { enemyHazards: [hazard('revealed')] }));
        expect(revealed.enemyHits).toBe(1);
        expect(revealed.board.enemyHazards?.[0]?.hp).toBe(3 - Math.max(1, revealed.brokenPairKeys.length));

        const hidden = sharp(board(layout(), { enemyHazards: [hazard('hidden')] }));
        expect(hidden.enemyHits).toBe(0);
        expect(hidden.board.enemyHazards?.[0]?.hp).toBe(3);
    });
});

describe('a findable goes with the chunk', () => {
    it('claims one findable pair inside the region and removes it with the rest', () => {
        const withFindable = board(layout((t) => (t.pairKey === 'C' ? { ...t, findableKind: 'shard_spark' } : t)));
        const result = sharp(withFindable);
        expect(result.claimedFindableKind).toBe('shard_spark');
        expect(result.brokenPairKeys.sort()).toEqual(['B', 'C']);
        expect(result.board.tiles.find((t) => t.id === 'C1')?.findableKind).toBeUndefined();
    });

    it('leaves a findable that rides on a lever, because the exit is waiting for that lever', () => {
        // This exact shape softlocked an endless floor: the chunk swallowed a lever pair for its
        // findable, the lever never resolved, and the exit stayed locked with the board cleared.
        const leverWithFindable = board(
            layout((t) =>
                t.pairKey === 'C'
                    ? { ...t, findableKind: 'shard_spark', dungeonCardKind: 'lever', dungeonCardState: 'hidden' }
                    : t
            )
        );
        const result = sharp(leverWithFindable);
        expect(result.claimedFindableKind).toBeNull();
        expect(result.brokenPairKeys).not.toContain('C');
        expect(result.board.tiles.find((t) => t.id === 'C1')?.dungeonCardKind).toBe('lever');
    });

    it('counts as claimed on a real turn', () => {
        const tiles = layout((t) => (t.pairKey === 'B' ? { ...t, findableKind: 'score_glint' } : t));
        const base = makeRun(tiles, { gameMode: 'endless' });
        const run = { ...base, board: board(tiles), floorCurioId: null, stats: { ...base.stats, currentStreak: 5 }, findablesTotalThisFloor: 1 };
        const after = resolveBoardTurn(flipTile(flipTile(run, 'A1'), 'A2'));
        expect(after.findablesClaimedThisFloor).toBe(1);
        expect(after.board!.tiles.find((t) => t.id === 'B1')?.state).toBe('removed');
    });
});

describe('the magpie prefers what you were given', () => {
    it('steals a chunk-broken pair before a matched one, and the pair comes back unmarked', () => {
        const broken = sharp(board(layout()));
        const afterMatch = {
            ...broken.board,
            tiles: broken.board.tiles.map((t) => (t.pairKey === 'A' ? { ...t, state: 'matched' as const } : t))
        };
        const visit = resolveMagpieVisit({ board: afterMatch, guardTokens: 0, mismatchCount: 3, runSeed: 1, rulesVersion: 1 });
        expect(visit.kind).toBe('theft');
        expect(broken.brokenPairKeys).toContain(visit.theft!.pairKey);

        const returned = applyMagpieTheft(afterMatch, visit.theft!);
        for (const t of returned.tiles.filter((candidate) => candidate.pairKey === visit.theft!.pairKey)) {
            expect(t.state).toBe('hidden');
            expect(t.brokenByChunk).toBeUndefined();
        }
    });

    it('never picks up a defeated enemy, which is removed but not a chunk casualty', () => {
        const defeatedEnemy = board(layout((t) => (t.pairKey === 'B' ? { ...t, state: 'removed' } : t.pairKey === 'A' ? { ...t, state: 'matched' } : t)));
        const visit = resolveMagpieVisit({ board: defeatedEnemy, guardTokens: 0, mismatchCount: 3, runSeed: 1, rulesVersion: 1 });
        expect(visit.theft?.pairKey).toBe('A');
    });
});

describe('the residents lean in', () => {
    it('spilled toffee makes the clump stick diagonally', () => {
        // Move C so neither half touches the ember clump orthogonally: C1 takes D1's corner, C2 takes
        // E2's cell, which sits on B2's diagonal. Dry, C is out of reach; sticky, it comes along.
        const tiles = layout();
        const swap = (a: string, b: string) => {
            const i = tiles.findIndex((t) => t.id === a);
            const j = tiles.findIndex((t) => t.id === b);
            [tiles[i], tiles[j]] = [tiles[j]!, tiles[i]!];
        };
        swap('C1', 'D1');
        swap('C2', 'E2');
        const dry = sharp(board(tiles));
        const sticky = sharp(board(tiles), { gameMode: 'endless', floorCurioId: 'sticky_toffee' });
        expect(dry.brokenPairKeys).not.toContain('C');
        expect(sticky.brokenPairKeys).toContain('C');
    });

    it('the greeted skull names the biggest clump on the floor', () => {
        const run = { ...createNewRun(0, { runSeed: 9 }), board: board(layout()) };
        const line = floorCurioGreetingReply(FLOOR_CURIO_GREETINGS.gossiping_skull, run);
        expect(line).toMatch(/Ember clump/);
        expect(line).not.toBe(FLOOR_CURIO_GREETINGS.gossiping_skull.reply);
    });

    it('the skull falls back to its usual gossip on a floor with no clump worth naming', () => {
        // suit = (column + row) mod 4: no two orthogonal neighbours share a suit, so every clump is one tile.
        const suits = ['ember', 'tide', 'moss', 'bone'] as const;
        const scattered = board(layout().map((t, i) => ({ ...t, suit: suits[((i % 4) + Math.floor(i / 4)) % 4] })));
        const run = { ...createNewRun(0, { runSeed: 9 }), board: scattered };
        expect(floorCurioGreetingReply(FLOOR_CURIO_GREETINGS.gossiping_skull, run)).toBe(FLOOR_CURIO_GREETINGS.gossiping_skull.reply);
    });
});
