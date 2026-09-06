import { describe, expect, it } from 'vitest';
import type { Tile, FloorArchetypeId } from './contracts';
import { buildBoard } from './board-build-rules';
import { createNewRun } from './run-creation-rules';
import { GAME_RULES_VERSION } from './contracts';
import { shuffleWithRng, createMulberry32 } from './rng';
import {
    assignSuitsToTiles,
    dealBoardSuits,
    dealTilesInClumps,
    getSuitDealProfile,
    isLayoutPinnedTile,
    largestHiddenSuitClump,
    sameSuitNeighbourRate,
    SUIT_DEAL_PROFILE_BY_ARCHETYPE,
    TILE_SUIT_CATALOG,
    TILE_SUITS
} from './tile-suit-rules';
import { EXIT_PAIR_KEY } from './dungeon-rules';

const pairs = (count: number): Tile[] =>
    Array.from({ length: count }, (_, index) => `p${index}`).flatMap((pairKey) => [
        { id: `${pairKey}-A`, pairKey, symbol: pairKey, label: pairKey, state: 'hidden' as const },
        { id: `${pairKey}-B`, pairKey, symbol: pairKey, label: pairKey, state: 'hidden' as const }
    ]);

describe('the four suits', () => {
    it('each have a rune as well as a colour, because colour alone is not a channel', () => {
        const runes = new Set(TILE_SUITS.map((suit) => TILE_SUIT_CATALOG[suit].rune));
        expect(runes.size).toBe(TILE_SUITS.length);
        for (const suit of TILE_SUITS) {
            expect(TILE_SUIT_CATALOG[suit].hue).toMatch(/^#[0-9a-f]{6}$/iu);
            expect(TILE_SUIT_CATALOG[suit].name.length).toBeGreaterThan(0);
        }
    });
});

describe('dealing suits', () => {
    it('gives both halves of every pair the same suit', () => {
        const dealt = assignSuitsToTiles(pairs(12), 1, 1, GAME_RULES_VERSION);
        const byPair = new Map<string, Set<string>>();
        for (const tile of dealt) {
            byPair.set(tile.pairKey, new Set([...(byPair.get(tile.pairKey) ?? []), tile.suit!]));
        }
        for (const suits of byPair.values()) {
            expect(suits.size).toBe(1);
        }
    });

    it('keeps the suits within one pair of each other, so no suit is half the board', () => {
        const dealt = assignSuitsToTiles(pairs(14), 7, 3, GAME_RULES_VERSION);
        const counts = TILE_SUITS.map((suit) => dealt.filter((tile) => tile.suit === suit).length);
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
    });

    it('is the same deal on a replay', () => {
        expect(assignSuitsToTiles(pairs(10), 99, 4, 1)).toEqual(assignSuitsToTiles(pairs(10), 99, 4, 1));
    });
});

describe('clumping', () => {
    const rate = (tiles: Tile[], columns: number) => sameSuitNeighbourRate({ columns, tiles });

    it('changes only the order: the same tiles come out that went in', () => {
        const suited = assignSuitsToTiles(pairs(16), 5, 2, 1);
        const dealt = dealTilesInClumps(suited, 6, 5, 2, 1);
        expect(dealt.length).toBe(suited.length);
        expect([...dealt].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
            [...suited].sort((a, b) => a.id.localeCompare(b.id))
        );
    });

    it('beats a uniform shuffle at every board size the game deals', () => {
        // Uniform over four equal suits sits near 0.25. The deal has to be visibly clumpier than
        // that at the small boards too, or floor one opens as noise and the map is a late-game idea.
        for (const pairCount of [4, 6, 8, 12, 16, 20, 30]) {
            const columns = Math.max(2, Math.min(8, Math.ceil(Math.sqrt(pairCount * 2))));
            let clumped = 0;
            let uniform = 0;
            const samples = 12;
            for (let seed = 1; seed <= samples; seed += 1) {
                const suited = assignSuitsToTiles(pairs(pairCount), seed, 1, 1);
                clumped += rate(dealTilesInClumps(suited, columns, seed, 1, 1), columns);
                uniform += rate(shuffleWithRng(createMulberry32(seed), [...suited]), columns);
            }
            expect(clumped / samples, `${pairCount} pairs`).toBeGreaterThan(uniform / samples + 0.2);
        }
    });

    it('is the same map on a replay', () => {
        const suited = assignSuitsToTiles(pairs(12), 31, 2, 1);
        expect(dealTilesInClumps(suited, 5, 31, 2, 1).map((t) => t.id)).toEqual(
            dealTilesInClumps(suited, 5, 31, 2, 1).map((t) => t.id)
        );
    });

    it('leaves pinned tiles exactly where the layout plan put them', () => {
        const suited = assignSuitsToTiles(pairs(10), 8, 2, 1);
        const exit: Tile = { id: 'exit', pairKey: EXIT_PAIR_KEY, symbol: 'E', label: 'Exit', state: 'hidden' };
        const withExit = [...suited.slice(0, 7), exit, ...suited.slice(7)];
        const dealt = dealTilesInClumps(withExit, 5, 8, 2, 1, isLayoutPinnedTile);
        expect(dealt[7]?.id).toBe('exit');
    });
});

describe('a built board', () => {
    it('opens with a suit on every tile', () => {
        const run = createNewRun(0, { runSeed: 2_024 });
        for (const tile of run.board!.tiles) {
            expect(TILE_SUITS, `${tile.id} has no suit`).toContain(tile.suit);
        }
    });

    it('opens clumped, not scattered, on every floor big enough to have a map', () => {
        // Floor one is two pairs and an exit, and floor three is ten tiles across four suits —
        // there is no room for regions before the board reaches sixteen tiles. From there on,
        // the built board has to beat a shuffle of its own tiles by a clear margin.
        for (const level of [6, 10, 14, 18]) {
            let clumped = 0;
            let uniform = 0;
            const seeds = [11, 12, 13, 14];
            for (const runSeed of seeds) {
                const board = buildBoard(level, { runSeed, runRulesVersion: GAME_RULES_VERSION, gameMode: 'endless' });
                clumped += sameSuitNeighbourRate(board);
                uniform += sameSuitNeighbourRate({
                    columns: board.columns,
                    tiles: shuffleWithRng(createMulberry32(runSeed), [...board.tiles])
                });
            }
            expect(clumped / seeds.length, `floor ${level}`).toBeGreaterThan(uniform / seeds.length + 0.15);
        }
    });

    it('keeps the exit where the layout plan wanted it', () => {
        // Compare the built board against the same build with the suit deal skipped: the exit
        // must be in the same cell in both, which is the whole contract of pinning.
        const board = buildBoard(3, { runSeed: 77, runRulesVersion: GAME_RULES_VERSION, gameMode: 'endless' });
        const exitIndex = board.tiles.findIndex((tile) => tile.pairKey === EXIT_PAIR_KEY);
        expect(exitIndex).toBeGreaterThanOrEqual(0);
        const replay = buildBoard(3, { runSeed: 77, runRulesVersion: GAME_RULES_VERSION, gameMode: 'endless' });
        expect(replay.tiles.findIndex((tile) => tile.pairKey === EXIT_PAIR_KEY)).toBe(exitIndex);
        expect(dealBoardSuits(board.tiles, board.columns, 77, 3, GAME_RULES_VERSION)[exitIndex]?.pairKey).toBe(EXIT_PAIR_KEY);
    });
});

describe('the deal profile', () => {
    it('is named for every archetype, so a new floor kind cannot fall through to a shape nobody chose', () => {
        const ids: FloorArchetypeId[] = [
            'survey_hall', 'speed_trial', 'treasure_gallery', 'shadow_read', 'anchor_chain', 'trap_hall',
            'script_room', 'rush_recall', 'parasite_tithe', 'spotlight_hunt', 'breather'
        ];
        for (const id of ids) {
            expect(['clumped', 'scattered', 'two_suit']).toContain(SUIT_DEAL_PROFILE_BY_ARCHETYPE[id]);
        }
        expect(Object.keys(SUIT_DEAL_PROFILE_BY_ARCHETYPE).sort()).toEqual([...ids].sort());
        expect(getSuitDealProfile(null)).toBe('clumped');
        expect(getSuitDealProfile('rush_recall')).toBe('scattered');
        expect(getSuitDealProfile('spotlight_hunt')).toBe('two_suit');
    });

    it('scatters a rush floor and clumps a breather, on the same tiles', () => {
        const tiles = pairs(18);
        const clumped = dealBoardSuits(tiles, 6, 91, 9, GAME_RULES_VERSION, 'clumped');
        const scattered = dealBoardSuits(tiles, 6, 91, 9, GAME_RULES_VERSION, 'scattered');
        expect(sameSuitNeighbourRate({ columns: 6, tiles: clumped })).toBeGreaterThan(
            sameSuitNeighbourRate({ columns: 6, tiles: scattered }) + 0.15
        );
        // Same tiles either way, and both halves of every pair still share a suit.
        expect(scattered.map((t) => t.id).sort()).toEqual(tiles.map((t) => t.id).sort());
        for (const tile of scattered) {
            expect(scattered.find((other) => other.pairKey === tile.pairKey && other.id !== tile.id)?.suit).toBe(tile.suit);
        }
    });

    it('deals a spotlight floor in two suits only, still clumped', () => {
        const tiles = pairs(12);
        const two = dealBoardSuits(tiles, 6, 5, 12, GAME_RULES_VERSION, 'two_suit');
        expect(new Set(two.map((t) => t.suit)).size).toBe(2);
        expect(largestHiddenSuitClump({ columns: 6, tiles: two })?.size).toBeGreaterThanOrEqual(8);
    });

    it('reads the profile off the built floor: a rush floor opens scattered, a breather clumped', () => {
        let clumped = 0;
        let scattered = 0;
        for (const runSeed of [21, 22, 23, 24]) {
            const breather = buildBoard(10, { runSeed, runRulesVersion: GAME_RULES_VERSION, gameMode: 'endless', floorArchetypeId: 'breather' });
            const rush = buildBoard(10, { runSeed, runRulesVersion: GAME_RULES_VERSION, gameMode: 'endless', floorArchetypeId: 'rush_recall' });
            clumped += sameSuitNeighbourRate(breather);
            scattered += sameSuitNeighbourRate(rush);
        }
        expect(clumped / 4).toBeGreaterThan(scattered / 4 + 0.1);
    });
});
