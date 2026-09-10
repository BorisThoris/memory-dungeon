import { describe, expect, it } from 'vitest';
import type { Tile, FloorArchetypeId } from './contracts';
import { buildBoard } from './board-build-rules';
import { createNewRun } from './run-creation-rules';
import { GAME_RULES_VERSION } from './contracts';
import { pairsForFloor } from './pair-curve';
import { shuffleWithRng, createMulberry32 } from './rng';
import {
    assignSuitsToTiles,
    dealBoardSuits,
    dealTilesInClumps,
    mixMaxRunForSuits,
    getSuitDealProfile,
    isLayoutPinnedTile,
    largestHiddenSuitClump,
    PAIR_HALF_SEPARATION,
    sameSuitNeighbourRate,
    suitCountForPairs,
    SUIT_DEAL_PROFILE_BY_ARCHETYPE,
    TILE_SUIT_CATALOG,
    TILE_SUITS
} from './tile-suit-rules';
import { WILD_PAIR_KEY } from './tile-identity';
import { makeTile } from './test/game-fixtures';

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

    it('reads as a shuffle at every board size the game deals, never as painted zones', () => {
        /*
         * Gen 204 turned this test around. It used to require the deal be **clumpier** than a
         * uniform shuffle by at least 0.2, because the pop reaches through same-suit contact and a
         * grown region is contact by construction. Measured on real floors, that produced 0.569
         * same-suit neighbours against the 0.25 a shuffle gives, with one suit covering 30% of the
         * board - four painted zones, which no player believes was dealt.
         *
         * The requirement now runs the other way: near a shuffle, never far above it. A little
         * above is expected and wanted - the repair pass only cuts runs over the cap, so what is
         * left is a shuffle with its worst blobs trimmed, not an anti-clustered lattice.
         */
        for (const pairCount of [4, 6, 8, 12, 16, 20, 30]) {
            const columns = Math.max(2, Math.min(8, Math.ceil(Math.sqrt(pairCount * 2))));
            let mixed = 0;
            let uniform = 0;
            const samples = 12;
            for (let seed = 1; seed <= samples; seed += 1) {
                const suited = assignSuitsToTiles(pairs(pairCount), seed, 1, 1);
                mixed += rate(dealTilesInClumps(suited, columns, seed, 1, 1), columns);
                uniform += rate(shuffleWithRng(createMulberry32(seed), [...suited]), columns);
            }
            const dealt = mixed / samples;
            const shuffled = uniform / samples;
            expect(dealt, `${pairCount} pairs: clumpier than a shuffle`).toBeLessThan(shuffled + 0.12);
            // And not scrubbed below one either: a checkerboard is as arranged as a blob.
            expect(dealt, `${pairCount} pairs: more ordered than a shuffle`).toBeGreaterThan(shuffled - 0.2);
        }
    });

    it('leaves no same-suit run longer than the cap, which is what a blob is', () => {
        /*
         * The average being near a shuffle is not enough - a shuffle produces the occasional long
         * run on its own, and one wall of six is what a player points at. This is the worst case.
         */
        for (const pairCount of [8, 12, 20, 30]) {
            const columns = Math.max(2, Math.min(8, Math.ceil(Math.sqrt(pairCount * 2))));
            for (let seed = 1; seed <= 20; seed += 1) {
                const suited = assignSuitsToTiles(pairs(pairCount), seed, 1, 1);
                const dealt = dealTilesInClumps(suited, columns, seed, 1, 1);
                const suits = new Set(dealt.map((tile) => tile.suit).filter(Boolean));
                const cap = mixMaxRunForSuits(suits.size);
                const seen = new Set<number>();
                let longest = 0;
                dealt.forEach((tile, index) => {
                    if (!tile.suit || seen.has(index)) return;
                    const stack = [index];
                    seen.add(index);
                    let size = 0;
                    while (stack.length > 0) {
                        const current = stack.pop()!;
                        size += 1;
                        const row = Math.floor(current / columns);
                        const column = current % columns;
                        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
                            const nextRow = row + dr;
                            const nextColumn = column + dc;
                            if (nextRow < 0 || nextColumn < 0 || nextColumn >= columns) continue;
                            const neighbour = nextRow * columns + nextColumn;
                            if (neighbour >= dealt.length || seen.has(neighbour)) continue;
                            if (dealt[neighbour]?.suit !== tile.suit) continue;
                            seen.add(neighbour);
                            stack.push(neighbour);
                        }
                    }
                    longest = Math.max(longest, size);
                });
                expect(longest, `${pairCount} pairs, seed ${seed}`).toBeLessThanOrEqual(cap);
            }
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
        const wild: Tile = { id: 'wild', pairKey: WILD_PAIR_KEY, symbol: 'W', label: 'Wild', state: 'hidden' };
        const withWild = [...suited.slice(0, 7), wild, ...suited.slice(7)];
        const dealt = dealTilesInClumps(withWild, 5, 8, 2, 1, isLayoutPinnedTile);
        expect(dealt[7]?.id).toBe('wild');
    });
});

describe('a pair is laid apart from its own other half', () => {
    const gridDistance = (columns: number, a: number, b: number): number =>
        Math.abs(Math.floor(a / columns) - Math.floor(b / columns)) + Math.abs((a % columns) - (b % columns));

    it('keeps the two halves off each other across real generated floors', () => {
        // Measured before Gen 198, on this same sweep: 0.228 of pairs landed orthogonally touching
        // and a further 0.144 at a corner - about what chance gives on a board of twenty cells,
        // which is why the deal read as arranged rather than random. A memory game whose boards
        // hand the player one free pair in five is showing them pairs they never had to remember.
        let pairs = 0;
        let touching = 0;
        let corner = 0;
        for (const runSeed of [101, 42_001, 90_123, 7, 555, 8_675_309]) {
            for (let level = 1; level <= 20; level += 1) {
                const board = buildBoard(level, { runSeed, runRulesVersion: GAME_RULES_VERSION, gameMode: 'endless' });
                const at = new Map<string, number[]>();
                board.tiles.forEach((tile, index) => at.set(tile.pairKey, [...(at.get(tile.pairKey) ?? []), index]));
                for (const [, indexes] of at) {
                    if (indexes.length !== 2) continue;
                    const [a, b] = indexes as [number, number];
                    pairs += 1;
                    const distance = gridDistance(board.columns, a, b);
                    if (distance === 1) touching += 1;
                    if (
                        distance === 2 &&
                        Math.floor(a / board.columns) !== Math.floor(b / board.columns) &&
                        a % board.columns !== b % board.columns
                    ) {
                        corner += 1;
                    }
                }
            }
        }
        expect(pairs).toBeGreaterThan(1_000);
        // Never zero: a suit squeezed into a corner has nowhere far enough, and the deal takes the
        // farthest cell it has rather than refusing to place a tile. Well under the old rate is the
        // guarantee, and it is a ratchet - if it climbs back, the separation stopped being applied.
        expect(touching / pairs, 'pair halves orthogonally touching').toBeLessThan(0.08);
        expect((touching + corner) / pairs, 'pair halves touching or at a corner').toBeLessThan(0.19);
    });

    it('places the halves at least the separation apart when the suit has room', () => {
        // A single suit in one long row: there is always somewhere far enough, so the floor holds.
        const tiles: Tile[] = Array.from({ length: 12 }, (_, index) =>
            makeTile(`t${index}`, `p${Math.floor(index / 2)}`, 'x', { suit: 'ember' })
        );
        const dealt = dealTilesInClumps(tiles, 12, 4_242, 3, GAME_RULES_VERSION);
        const at = new Map<string, number[]>();
        dealt.forEach((tile, index) => at.set(tile.pairKey, [...(at.get(tile.pairKey) ?? []), index]));
        for (const [pairKey, indexes] of at) {
            expect(gridDistance(12, indexes[0]!, indexes[1]!), pairKey).toBeGreaterThanOrEqual(PAIR_HALF_SEPARATION);
        }
    });
});

describe('a built board', () => {
    it('opens with a suit on every tile', () => {
        const run = createNewRun(0, { runSeed: 2_024 });
        for (const tile of run.board!.tiles) {
            expect(TILE_SUITS, `${tile.id} has no suit`).toContain(tile.suit);
        }
    });

    it('opens on two suits and widens from there, never narrowing as the tutorial ends', () => {
        // Floors 1 to 3 are authored (`authored-floors.ts`): two suits, then three, then three.
        // Floor 4 is the first procedural floor, and the palette rule has to agree with the
        // authored floor before it rather than dropping back - which is what rounding the ratio
        // up rather than to nearest buys (Gen 193).
        const suitsOn = (level: number) =>
            new Set(
                buildBoard(level, { runSeed: 11, runRulesVersion: GAME_RULES_VERSION, gameMode: 'endless' }).tiles.map(
                    (tile) => tile.suit
                )
            ).size;
        expect(suitsOn(1)).toBe(2);
        expect(suitsOn(2)).toBe(3);
        expect(suitsOn(3)).toBe(3);
        expect(suitsOn(4)).toBe(3);
        expect(suitCountForPairs(pairsForFloor(4))).toBe(3);
        // And it never goes backwards as the boards grow.
        let previous = 0;
        for (let level = 4; level <= 40; level += 1) {
            const suits = suitCountForPairs(pairsForFloor(level));
            expect(suits, `floor ${level}`).toBeGreaterThanOrEqual(previous);
            previous = suits;
        }
        expect(previous).toBe(4);
    });

    it('opens mixed on every floor big enough to have a palette', () => {
        /*
         * Gen 204 turned this around with the deal. It used to demand a built floor come out at
         * least 0.15 clumpier than the same tiles shuffled; it now demands the opposite, that a
         * built floor sit near its shuffle. The margin is one-sided and generous upward, because
         * the repair only trims the worst runs - the deal is a shuffle with the walls knocked
         * down, and a shuffle sometimes clusters.
         *
         * Eight seeds, not four, and the reason still holds: the control is a real shuffle and its
         * own variance is wider than the effect at four samples.
         */
        for (const level of [10, 14, 18]) {
            let dealt = 0;
            let uniform = 0;
            const seeds = [11, 12, 13, 14, 21, 34, 55, 89];
            for (const runSeed of seeds) {
                const board = buildBoard(level, { runSeed, runRulesVersion: GAME_RULES_VERSION, gameMode: 'endless' });
                dealt += sameSuitNeighbourRate(board);
                uniform += sameSuitNeighbourRate({
                    columns: board.columns,
                    tiles: shuffleWithRng(createMulberry32(runSeed), [...board.tiles])
                });
            }
            expect(dealt / seeds.length, `floor ${level}`).toBeLessThan(uniform / seeds.length + 0.1);
        }
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

    it('changes the palette rather than the clustering: a rush floor deals fewer suits than a breather', () => {
        /*
         * Gen 204: the profile stopped being a clustering lever, because every floor is mixed now.
         * This used to require a clumped floor read 0.15 over chance against a scattered one; it
         * measured -0.007 the moment both went through the same deal, which is the correct answer
         * to a question that had stopped meaning anything.
         *
         * What the profile still decides is how many suits the floor carries, and that is a real
         * difference a player feels: two suits is a board where almost everything can chain, four
         * is a board where the route has to be found.
         */
        const tiles = pairs(18);
        const seeds = [91, 7, 13, 42, 77, 101, 123, 555];
        for (const seed of seeds) {
            const clumpedSuits = new Set(
                dealBoardSuits(tiles, 6, seed, 9, GAME_RULES_VERSION, 'clumped').map((tile) => tile.suit)
            ).size;
            const scatteredSuits = new Set(
                dealBoardSuits(tiles, 6, seed, 9, GAME_RULES_VERSION, 'scattered').map((tile) => tile.suit)
            ).size;
            expect(scatteredSuits, `seed ${seed}`).toBeLessThan(clumpedSuits);
        }

        // And both are dealt the same way: neither reads as painted zones.
        for (const profile of ['clumped', 'scattered'] as const) {
            const dealt = dealBoardSuits(tiles, 6, 91, 9, GAME_RULES_VERSION, profile);
            const suitCount = new Set(dealt.map((tile) => tile.suit)).size;
            const overChance = sameSuitNeighbourRate({ columns: 6, tiles: dealt }) - 1 / suitCount;
            expect(overChance, profile).toBeLessThan(0.12);
        }

        const scattered = dealBoardSuits(tiles, 6, 91, 9, GAME_RULES_VERSION, 'scattered');
        // Same tiles either way, and both halves of every pair still share a suit.
        expect(scattered.map((t) => t.id).sort()).toEqual(tiles.map((t) => t.id).sort());
        for (const tile of scattered) {
            expect(scattered.find((other) => other.pairKey === tile.pairKey && other.id !== tile.id)?.suit).toBe(tile.suit);
        }
    });

    it('deals a spotlight floor in two suits only, and mixes them like every other floor', () => {
        const tiles = pairs(12);
        const two = dealBoardSuits(tiles, 6, 5, 12, GAME_RULES_VERSION, 'two_suit');
        expect(new Set(two.map((t) => t.suit)).size).toBe(2);
        /*
         * Gen 204: this used to require a run of eight or more - a spotlight floor was the most
         * clumped board in the game, measured at 0.733 same-suit neighbours with one suit covering
         * half the board. It is dealt like everything else now, and its cap is the two-suit one
         * (`mixMaxRunForSuits`), which is looser than the four-suit cap precisely because a
         * two-suit shuffle really does run longer.
         */
        const largest = largestHiddenSuitClump({ columns: 6, tiles: two })?.size ?? 0;
        expect(largest).toBeGreaterThan(1);
        expect(largest).toBeLessThanOrEqual(mixMaxRunForSuits(2));
    });

    it('reads the profile off the built floor: a rush floor carries fewer suits than a breather', () => {
        // Gen 204: the same turn as above, on real built floors rather than bare tiles.
        for (const runSeed of [21, 22, 23, 24]) {
            // Floor 14: deep enough that both archetypes carry more than one suit.
            const breather = buildBoard(14, { runSeed, runRulesVersion: GAME_RULES_VERSION, gameMode: 'endless', floorArchetypeId: 'breather' });
            const rush = buildBoard(14, { runSeed, runRulesVersion: GAME_RULES_VERSION, gameMode: 'endless', floorArchetypeId: 'rush_recall' });
            const suits = (board: { tiles: Tile[] }): number => new Set(board.tiles.map((tile) => tile.suit)).size;
            expect(suits(rush), `seed ${runSeed}`).toBeLessThan(suits(breather));
            // Neither is clumped: both sit within a shuffle's reach of their own chance baseline.
            for (const [name, board] of [['breather', breather], ['rush', rush]] as const) {
                const overChance = sameSuitNeighbourRate(board) - 1 / suits(board);
                expect(overChance, `${name} seed ${runSeed}`).toBeLessThan(0.15);
            }
        }
    });
});

