import { describe, expect, it } from 'vitest';
import { buildBoard } from './board-generation';
import { GAME_RULES_VERSION, type RelicId, type RunState } from './contracts';
import { flipTile, resolveBoardTurn } from './turn-resolution';
import { makeBoard, makePair, makeRun, makeTile } from './test/game-fixtures';
import { getTraitOpportunityHudModel, getTraitOpportunitySummary } from './trait-opportunities';
import {
    applyVolatileMismatchTrait,
    assignTileTraitsToGeneratedBoard,
    calculateTileTraitMatchRewards,
    calculateTileTraitMismatchPenalty,
    formatTileTraitInteractionTags,
    getBoardTraitInteractionPreviewLines,
    getTileSwapTraitPreviewLines,
    getTileTraitInteractionPreviewLines,
    TILE_TRAIT_INTERACTION_TAGS,
    TILE_TRAIT_INTERACTION_TEXT,
    resolveTileTraitEffects
} from './tile-trait-rules';

const uniqueTraitPairCount = (tiles: ReturnType<typeof makeTile>[]): number =>
    new Set(tiles.filter((tile) => tile.tileTraitKind != null).map((tile) => tile.pairKey)).size;

const hasAdjacentTraitPair = (
    tiles: ReturnType<typeof makeTile>[],
    first: string,
    second: string
): boolean => {
    const columns = Math.min(Math.max(Math.ceil(Math.sqrt(tiles.length)), 2), 8);
    return tiles.some((tile, index) => {
        if (tile.tileTraitKind !== first) {
            return false;
        }
        const row = Math.floor(index / columns);
        return [index - 1, index + 1, index - columns, index + columns].some((neighborIndex) => {
            if (neighborIndex < 0 || neighborIndex >= tiles.length) {
                return false;
            }
            if ((neighborIndex === index - 1 || neighborIndex === index + 1) && Math.floor(neighborIndex / columns) !== row) {
                return false;
            }
            return tiles[neighborIndex]?.tileTraitKind === second;
        });
    });
};

describe('tile trait rules', () => {
    it('formats trait interaction tags as unique player-facing lines', () => {
        expect(
            formatTileTraitInteractionTags([
                'echo:sealed-combo',
                'echo:sealed-combo',
                'unknown',
                '__proto__',
                'constructor',
                'toString',
                'cursed:volatile-danger'
            ])
        ).toEqual(['Echo + Sealed: combo shard', 'Cursed + Volatile: recall pressure']);
    });

    it('keeps every known interaction tag backed by player-facing copy', () => {
        expect(TILE_TRAIT_INTERACTION_TAGS.length).toBeGreaterThan(0);
        expect(Object.keys(TILE_TRAIT_INTERACTION_TEXT)).toEqual([...TILE_TRAIT_INTERACTION_TAGS]);
        for (const tag of TILE_TRAIT_INTERACTION_TAGS) {
            expect(TILE_TRAIT_INTERACTION_TEXT[tag]).toMatch(/\S/);
        }
    });

    it('previews nearby trait interactions before a match or swap is committed', () => {
        const board = makeBoard(
            [
                makeTile('e1', 'e', 'E', { tileTraitKind: 'echo' }),
                makeTile('s1', 's', 'S', { tileTraitKind: 'sealed' }),
                makeTile('x1', 'x', 'X'),
                makeTile('h1', 'h', 'H', { tileTraitKind: 'heavy' })
            ],
            { columns: 2, rows: 2 }
        );

        expect(getTileTraitInteractionPreviewLines(board, ['e1'], 'match')).toContain('Echo + Sealed: combo shard');
        expect(getTileSwapTraitPreviewLines(board, 'x1', 's1')).toEqual(
            expect.arrayContaining(['Sealed + Heavy: score surge'])
        );
    });

    it('assigns deterministic route-weighted traits to generated safe tiles from the opener floor', () => {
        const baseTiles = [
            ...makePair('a', 'A'),
            ...makePair('b', 'B'),
            ...makePair('c', 'C'),
            ...makePair('d', 'D')
        ];
        const tiles = assignTileTraitsToGeneratedBoard(baseTiles, 123, 30, 4, 'greed');

        const traitTiles = tiles.filter((tile) => tile.tileTraitKind != null);
        expect(traitTiles.length).toBeGreaterThan(0);
        expect(
            traitTiles.every(
                (tile) =>
                    !['exit', 'shop', 'room'].includes(tile.dungeonCardKind ?? '')
            )
        ).toBe(true);
        expect(assignTileTraitsToGeneratedBoard(baseTiles, 123, 30, 4, 'greed').map((tile) => tile.tileTraitKind ?? null)).toEqual(
            tiles.map((tile) => tile.tileTraitKind ?? null)
        );
    });

    it('uses final board columns when repairing generated trait interaction layouts', () => {
        const seed = 70_202;
        const floor = 4;
        const routeType = 'safe';
        const board = buildBoard(floor, {
            runSeed: seed,
            runRulesVersion: GAME_RULES_VERSION,
            gameMode: 'endless',
            routeCardPlan: {
                choiceId: `contract:${routeType}:${seed}:${floor}`,
                routeType,
                sourceLevel: floor - 1,
                targetLevel: floor
            }
        });

        expect(uniqueTraitPairCount(board.tiles)).toBeGreaterThanOrEqual(2);
        expect(getBoardTraitInteractionPreviewLines(board).length).toBeGreaterThan(0);
    });

    it('keeps the opener readable while still introducing traits as a core mechanic', () => {
        const [a1, a2] = makePair('a', 'A');
        const tiles = assignTileTraitsToGeneratedBoard([a1, a2], 1, 30, 1, 'mystery');
        expect(uniqueTraitPairCount(tiles)).toBe(1);
        expect(tiles.every((tile) => ['echo', 'mirror', 'heavy'].includes(tile.tileTraitKind ?? ''))).toBe(true);
    });

    it('introduces a match-triggerable trait route on normal opener boards', () => {
        const baseTiles = Array.from({ length: 4 }, (_, index) => makePair(`pair-${index}`, String(index))).flat();
        const tiles = assignTileTraitsToGeneratedBoard(baseTiles, 1, 30, 1, 'safe');
        const board = makeBoard(tiles, { columns: 3, rows: 3 });
        const openerTraits = tiles.map((tile) => tile.tileTraitKind).filter(Boolean);

        expect(uniqueTraitPairCount(tiles)).toBe(2);
        expect(openerTraits).not.toContain('cursed');
        expect(openerTraits).not.toContain('volatile');
        expect(getBoardTraitInteractionPreviewLines(board, 'match').length).toBeGreaterThan(0);
    });

    it('scales trait density into a normal board layer and seeds route combo adjacency', () => {
        const baseTiles = Array.from({ length: 8 }, (_, index) => makePair(`pair-${index}`, String(index))).flat();

        const safeTiles = assignTileTraitsToGeneratedBoard(baseTiles, 123, 30, 4, 'safe');
        const greedTiles = assignTileTraitsToGeneratedBoard(baseTiles, 123, 30, 4, 'greed');
        const safeBoard = makeBoard(safeTiles, { columns: 4, rows: 4 });
        const greedBoard = makeBoard(greedTiles, { columns: 4, rows: 4 });

        expect(uniqueTraitPairCount(safeTiles)).toBe(4);
        expect(hasAdjacentTraitPair(safeTiles, 'conduit', 'echo')).toBe(true);
        expect(getBoardTraitInteractionPreviewLines(safeBoard, 'match').length).toBeGreaterThanOrEqual(2);
        expect(uniqueTraitPairCount(greedTiles)).toBe(4);
        expect(hasAdjacentTraitPair(greedTiles, 'drift', 'volatile')).toBe(true);
        expect(getBoardTraitInteractionPreviewLines(greedBoard, 'match').length).toBeGreaterThanOrEqual(2);
    });

    it('biases generated trait interaction pairs toward starting loadout identity', () => {
        const baseTiles = Array.from({ length: 8 }, (_, index) => makePair(`pair-${index}`, String(index))).flat();

        const scoutTiles = assignTileTraitsToGeneratedBoard(baseTiles, 123, 30, 4, 'greed', [], 'memory_scout');
        const tacticianTiles = assignTileTraitsToGeneratedBoard(baseTiles, 123, 30, 4, 'safe', [], 'route_tactician');
        const cursebreakerTiles = assignTileTraitsToGeneratedBoard(baseTiles, 123, 30, 4, 'safe', [], 'cursebreaker');
        const vaultbreakerTiles = assignTileTraitsToGeneratedBoard(baseTiles, 123, 30, 4, 'mystery', [], 'vaultbreaker');

        expect(hasAdjacentTraitPair(scoutTiles, 'conduit', 'echo')).toBe(true);
        expect(hasAdjacentTraitPair(tacticianTiles, 'drift', 'volatile')).toBe(true);
        expect(hasAdjacentTraitPair(cursebreakerTiles, 'mirror', 'stasis')).toBe(true);
        expect(hasAdjacentTraitPair(vaultbreakerTiles, 'cursed', 'volatile')).toBe(true);
        expect(assignTileTraitsToGeneratedBoard(baseTiles, 123, 30, 4, 'safe', [], 'route_tactician')).toEqual(
            tacticianTiles
        );
    });

    it('does not hard-cap trait count on larger eligible boards', () => {
        const baseTiles = Array.from({ length: 18 }, (_, index) => makePair(`pair-${index}`, String(index))).flat();
        const tiles = assignTileTraitsToGeneratedBoard(baseTiles, 123, 30, 12, null);

        expect(uniqueTraitPairCount(tiles)).toBe(9);
    });

    it('keeps generated post-opener trait floors from becoming isolated flavor', () => {
        const levels = [2, 4, 7, 9, 12] as const;
        const seeds = [11, 42_001, 91_337] as const;

        for (const runSeed of seeds) {
            for (const level of levels) {
                const board = buildBoard(level, {
                    runSeed,
                    runRulesVersion: GAME_RULES_VERSION,
                    gameMode: 'endless',
                    floorTag: level === 7 || level === 9 ? 'boss' : 'normal',
                    floorArchetypeId: level === 7 ? 'trap_hall' : level === 9 ? 'rush_recall' : null,
                    activeMutators: level === 9 ? ['short_memorize', 'wide_recall'] : []
                });
                const traitPairs = uniqueTraitPairCount(board.tiles);
                const summary = getTraitOpportunitySummary(board);
                const hud = getTraitOpportunityHudModel(board, {
                    peekCharges: 0,
                    regionShuffleCharges: 1,
                    regionShuffleFreeThisFloor: false,
                    shuffleCharges: 0
                });

                expect(traitPairs, `seed ${runSeed} level ${level}`).toBeGreaterThanOrEqual(2);
                expect(hud.active, `seed ${runSeed} level ${level}`).toBe(true);
                expect(
                    summary.interactionLines.length + (hud.swapHint ? 1 : 0),
                    `seed ${runSeed} level ${level}`
                ).toBeGreaterThan(0);
            }
        }
    }, 15_000);

    it('surfaces the newer interaction traits through seeded route pools', () => {
        const baseTiles = Array.from({ length: 12 }, (_, index) => makePair(`pair-${index}`, String(index))).flat();
        const intensities: readonly (null | 'safe' | 'greed' | 'mystery')[] = [null, 'safe', 'greed', 'mystery'];
        const seen = new Set(
            intensities.flatMap((intensity) =>
                Array.from({ length: 120 }, (_, index) =>
                    assignTileTraitsToGeneratedBoard(baseTiles, index + 1, 30, 12, intensity)
                )
                    .flat()
                    .map((tile) => tile.tileTraitKind)
                    .filter((kind): kind is NonNullable<typeof kind> => kind != null)
            )
        );

        expect([...seen]).toEqual(expect.arrayContaining(['drift', 'conduit', 'stasis']));
    });

    it('guarantees generated trait boards have match-triggerable routes when enough trait pairs exist', () => {
        const baseTiles = Array.from({ length: 10 }, (_, index) => makePair(`pair-${index}`, String(index))).flat();
        const intensities: readonly (null | 'safe' | 'greed' | 'mystery')[] = [null, 'safe', 'greed', 'mystery'];

        for (const intensity of intensities) {
            for (let seed = 1; seed <= 80; seed += 1) {
                const tiles = assignTileTraitsToGeneratedBoard(baseTiles, seed, 30, 7, intensity);
                const board = makeBoard(tiles, { columns: 5, rows: 4 });

                expect(uniqueTraitPairCount(tiles)).toBeGreaterThanOrEqual(2);
                expect(getBoardTraitInteractionPreviewLines(board, 'match').length).toBeGreaterThan(0);
            }
        }
    });

    it('turns echo and mirror clean matches into resource rewards', () => {
        const run = makeRun([]);
        const [echoA, echoB] = makePair('echo', 'E');
        const [mirrorA, mirrorB] = makePair('mirror', 'M');

        expect(calculateTileTraitMatchRewards(run, [{ ...echoA, tileTraitKind: 'echo' }, echoB])).toEqual({
            comboShardGain: 0,
            guardTokenGain: 0,
            peekChargeGain: 1,
            relicFavorGain: 0,
            scoreBonus: 0,
            shopGoldGain: 0
        });
        expect(calculateTileTraitMatchRewards(run, [{ ...mirrorA, tileTraitKind: 'mirror' }, mirrorB])).toEqual({
            comboShardGain: 0,
            guardTokenGain: 1,
            peekChargeGain: 0,
            relicFavorGain: 0,
            scoreBonus: 0,
            shopGoldGain: 0
        });
    });

    it('turns cursed, sealed, and heavy matches into build rewards', () => {
        const run = makeRun([], { relicIds: ['parasite_ledger'] });
        const [cursedA, cursedB] = makePair('cursed', 'C');
        const [sealedA, sealedB] = makePair('sealed', 'S');
        const [heavyA, heavyB] = makePair('heavy', 'H');

        expect(calculateTileTraitMatchRewards(run, [{ ...cursedA, tileTraitKind: 'cursed' }, cursedB])).toMatchObject({
            relicFavorGain: 1,
            scoreBonus: 15,
            shopGoldGain: 1
        });
        expect(calculateTileTraitMatchRewards(run, [{ ...sealedA, tileTraitKind: 'sealed' }, sealedB]).comboShardGain).toBe(1);
        expect(calculateTileTraitMatchRewards(run, [{ ...heavyA, tileTraitKind: 'heavy' }, heavyB]).scoreBonus).toBe(35);
    });

    it('normalizes malformed resource counters before calculating trait match rewards', () => {
        const run = makeRun([], {
            matchResolutionsThisFloor: Number.NaN,
            peekCharges: Number.POSITIVE_INFINITY,
            recallFocus: Number.POSITIVE_INFINITY,
            relicIds: ['guard_token_plus_one'],
            rewardPerkIds: ['trait_streak_toolkit'],
            stats: {
                ...makeRun([]).stats,
                comboShards: Number.POSITIVE_INFINITY,
                currentStreak: Number.POSITIVE_INFINITY,
                guardTokens: Number.NaN
            }
        });
        const [sealedA, sealedB] = makePair('sealed', 'S');
        const [mirrorA, mirrorB] = makePair('mirror', 'M');

        expect(calculateTileTraitMatchRewards(run, [{ ...sealedA, tileTraitKind: 'sealed' }, sealedB]).comboShardGain).toBe(1);
        expect(resolveTileTraitEffects({
            run,
            source: 'match',
            sourceTiles: [{ ...sealedA, tileTraitKind: 'sealed' }, sealedB]
        }).flashPairChargeGain).toBe(0);
        expect(calculateTileTraitMatchRewards(run, [{ ...mirrorA, tileTraitKind: 'mirror' }, mirrorB]).guardTokenGain).toBe(2);
    });

    it('normalizes malformed stat records before calculating trait match rewards', () => {
        const run = {
            ...makeRun([]),
            stats: Number.NaN as unknown as RunState['stats']
        };
        const [sealedA, sealedB] = makePair('sealed', 'S');
        const [mirrorA, mirrorB] = makePair('mirror', 'M');

        expect(calculateTileTraitMatchRewards(run, [{ ...sealedA, tileTraitKind: 'sealed' }, sealedB]).comboShardGain).toBe(1);
        expect(calculateTileTraitMatchRewards(run, [{ ...mirrorA, tileTraitKind: 'mirror' }, mirrorB]).guardTokenGain).toBe(1);
    });

    it('ignores malformed relic ids before calculating trait match rewards', () => {
        const run = makeRun([], {
            relicIds: Number.NaN as unknown as RelicId[]
        });
        const [cursedA, cursedB] = makePair('cursed', 'C');
        const [mirrorA, mirrorB] = makePair('mirror', 'M');

        expect(calculateTileTraitMatchRewards(run, [{ ...cursedA, tileTraitKind: 'cursed' }, cursedB])).toMatchObject({
            relicFavorGain: 1,
            shopGoldGain: 0
        });
        expect(calculateTileTraitMatchRewards(run, [{ ...mirrorA, tileTraitKind: 'mirror' }, mirrorB]).guardTokenGain).toBe(1);
    });

    it('applies echo reward through normal two-card resolution', () => {
        const run = makeRun([
            makeTile('a1', 'a', 'A', { tileTraitKind: 'echo' }),
            makeTile('a2', 'a', 'A', { tileTraitKind: 'echo' })
        ]);

        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'a1'), 'a2'));
        expect(resolved.peekCharges).toBe(run.peekCharges + 1);
        expect(resolved.stats.tileTraitMatches.echo).toBe(1);
    });

    it('turns drift adjacency into row and full shuffle charges', () => {
        const board = makeBoard(
            [
                makeTile('d1', 'd', 'D', { tileTraitKind: 'drift', state: 'flipped' }),
                makeTile('d2', 'd', 'D', { tileTraitKind: 'drift', state: 'flipped' }),
                makeTile('v2', 'v', 'V', { tileTraitKind: 'volatile' }),
                makeTile('v1', 'v', 'V', { tileTraitKind: 'volatile' })
            ],
            { columns: 2, rows: 2 }
        );
        const run = makeRun(board.tiles, { board });

        const effect = resolveTileTraitEffects({
            run,
            board,
            sourceTiles: [board.tiles[0]!, board.tiles[1]!],
            source: 'match'
        });

        expect(effect.regionShuffleChargeGain).toBe(1);
        expect(effect.shuffleChargeGain).toBe(1);
        expect(effect.interactionTags).toContain('drift:volatile-full-shuffle');
    });

    it('applies drift charges through normal two-card resolution', () => {
        const board = makeBoard(
            [
                makeTile('d1', 'd', 'D', { tileTraitKind: 'drift' }),
                makeTile('d2', 'd', 'D', { tileTraitKind: 'drift' }),
                makeTile('v2', 'v', 'V', { tileTraitKind: 'volatile' }),
                makeTile('v1', 'v', 'V', { tileTraitKind: 'volatile' })
            ],
            { columns: 2, rows: 2 }
        );
        const run = makeRun(board.tiles, { board, shuffleCharges: 0, regionShuffleCharges: 0 });

        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'd1'), 'd2'));

        expect(resolved.regionShuffleCharges).toBe(1);
        expect(resolved.shuffleCharges).toBe(1);
        expect(resolved.stats.tileTraitMatches.drift).toBe(1);
    });

    it('converts nearby echo and mirror traits into conduit score and resources', () => {
        const board = makeBoard(
            [
                makeTile('c1', 'c', 'C', { tileTraitKind: 'conduit', state: 'flipped' }),
                makeTile('c2', 'c', 'C', { tileTraitKind: 'conduit', state: 'flipped' }),
                makeTile('m1', 'm', 'M', { tileTraitKind: 'mirror' }),
                makeTile('e1', 'e', 'E', { tileTraitKind: 'echo' }),
                makeTile('x1', 'x', 'X'),
                makeTile('x2', 'x', 'X')
            ],
            { columns: 3, rows: 2 }
        );
        const run = makeRun(board.tiles, { board });

        const effect = resolveTileTraitEffects({
            run,
            board,
            sourceTiles: [board.tiles[0]!, board.tiles[1]!],
            source: 'match'
        });

        expect(effect.scoreBonus).toBe(24);
        expect(effect.guardTokenGain).toBe(1);
        expect(effect.peekChargeGain).toBe(1);
    });

    it('turns second-order trait adjacencies into additional board-control payoffs', () => {
        const board = makeBoard(
            [
                makeTile('c1', 'conduit', 'C', { tileTraitKind: 'conduit', state: 'flipped' }),
                makeTile('c2', 'conduit', 'C', { tileTraitKind: 'conduit', state: 'flipped' }),
                makeTile('s1', 'stasis', 'T', { tileTraitKind: 'stasis' }),
                makeTile('x1', 'x', 'X'),
                makeTile('sealed1', 'sealed', 'S', { tileTraitKind: 'sealed', state: 'flipped' }),
                makeTile('sealed2', 'sealed', 'S', { tileTraitKind: 'sealed', state: 'flipped' }),
                makeTile('conduit-near', 'conduit-near', 'C', { tileTraitKind: 'conduit' }),
                makeTile('x2', 'x2', 'X'),
                makeTile('h1', 'heavy', 'H', { tileTraitKind: 'heavy', state: 'flipped' }),
                makeTile('h2', 'heavy', 'H', { tileTraitKind: 'heavy', state: 'flipped' }),
                makeTile('m1', 'mirror', 'M', { tileTraitKind: 'mirror' }),
                makeTile('y1', 'y', 'Y'),
                makeTile('y2', 'y', 'Y'),
                makeTile('z1', 'z', 'Z'),
                makeTile('z2', 'z', 'Z')
            ],
            { columns: 4, rows: 3 }
        );
        const run = makeRun(board.tiles, { board });

        const conduitEffect = resolveTileTraitEffects({
            run,
            board,
            sourceTiles: [board.tiles[0]!, board.tiles[1]!],
            source: 'match'
        });
        const sealedEffect = resolveTileTraitEffects({
            run,
            board,
            sourceTiles: [board.tiles[4]!, board.tiles[5]!],
            source: 'match'
        });
        const heavyEffect = resolveTileTraitEffects({
            run,
            board,
            sourceTiles: [board.tiles[8]!, board.tiles[9]!],
            source: 'match'
        });

        expect(conduitEffect.stickyBlockIndex).toBe(2);
        expect(conduitEffect.interactionTags).toContain('conduit:stasis-lock');
        expect(sealedEffect.comboShardGain).toBe(2);
        expect(sealedEffect.interactionTags).toContain('sealed:conduit-spark');
        expect(heavyEffect.guardTokenGain).toBe(1);
        expect(heavyEffect.scoreBonus).toBe(50);
        expect(heavyEffect.interactionTags).toContain('heavy:mirror-guard');
    });

    it('lets reward perks turn Echo, trait streaks, and Cursed openers into build engines', () => {
        const board = makeBoard(
            [
                makeTile('e1', 'e', 'E', { tileTraitKind: 'echo', state: 'flipped' }),
                makeTile('e2', 'e', 'E', { tileTraitKind: 'echo', state: 'flipped' }),
                makeTile('c1', 'conduit', 'C', { tileTraitKind: 'conduit' }),
                makeTile('s1', 'sealed', 'S', { tileTraitKind: 'sealed' }),
                makeTile('x1', 'x', 'X'),
                makeTile('x2', 'x', 'X')
            ],
            { columns: 3, rows: 2 }
        );
        const run = makeRun(board.tiles, {
            board,
            rewardPerkIds: ['echo_conduit_double', 'trait_streak_toolkit', 'cursed_opener_greed'],
            stats: { ...makeRun(board.tiles).stats, currentStreak: 2 }
        });

        const echoEffect = resolveTileTraitEffects({
            run,
            board,
            sourceTiles: [board.tiles[0]!, board.tiles[1]!],
            source: 'match'
        });
        const cursedEffect = resolveTileTraitEffects({
            run: { ...run, matchResolutionsThisFloor: 0 },
            board,
            sourceTiles: [
                makeTile('curse-a', 'curse', 'C', { tileTraitKind: 'cursed', state: 'flipped' }),
                makeTile('curse-b', 'curse', 'C', { tileTraitKind: 'cursed', state: 'flipped' })
            ],
            source: 'match'
        });

        expect(echoEffect.peekChargeGain).toBe(2);
        expect(echoEffect.comboShardGain).toBe(2);
        expect(echoEffect.flashPairChargeGain).toBe(1);
        expect(echoEffect.interactionTags).toEqual(
            expect.arrayContaining(['reward-perk:echo-conduit-double', 'reward-perk:trait-streak-flash'])
        );
        expect(cursedEffect.shopGoldGain).toBe(1);
        expect(cursedEffect.scoreBonus).toBe(40);
        expect(cursedEffect.interactionTags).toContain('reward-perk:cursed-opener-greed');
    });

    it('applies trait streak flash-pair perk through normal two-card resolution', () => {
        const board = makeBoard([
            makeTile('e1', 'e', 'E', { tileTraitKind: 'echo' }),
            makeTile('e2', 'e', 'E', { tileTraitKind: 'echo' })
        ]);
        const run = makeRun(board.tiles, {
            board,
            flashPairCharges: 0,
            rewardPerkIds: ['trait_streak_toolkit'],
            stats: { ...makeRun(board.tiles).stats, currentStreak: 2 }
        });

        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'e1'), 'e2'));

        expect(resolved.flashPairCharges).toBe(1);
    });

    it('lets relic choices amplify trait-combo play patterns', () => {
        const board = makeBoard(
            [
                makeTile('c1', 'conduit', 'C', { tileTraitKind: 'conduit', state: 'flipped' }),
                makeTile('c2', 'conduit', 'C', { tileTraitKind: 'conduit', state: 'flipped' }),
                makeTile('e1', 'echo', 'E', { tileTraitKind: 'echo' }),
                makeTile('s1', 'sealed', 'S', { tileTraitKind: 'sealed' }),
                makeTile('d1', 'drift', 'D', { tileTraitKind: 'drift', state: 'flipped' }),
                makeTile('d2', 'drift', 'D', { tileTraitKind: 'drift', state: 'flipped' })
            ],
            { columns: 3, rows: 2 }
        );
        const run = makeRun(board.tiles, {
            board,
            relicIds: ['chapter_compass', 'combo_shard_plus_step', 'region_shuffle_free_first']
        });

        const conduitEffect = resolveTileTraitEffects({
            run,
            board,
            sourceTiles: [board.tiles[0]!, board.tiles[1]!],
            source: 'match'
        });
        const sealedEffect = resolveTileTraitEffects({
            run,
            board,
            sourceTiles: [{ ...board.tiles[3]!, state: 'flipped' }, { ...board.tiles[3]!, id: 's2', state: 'flipped' }],
            source: 'match'
        });
        const driftEffect = resolveTileTraitEffects({
            run,
            board,
            sourceTiles: [board.tiles[4]!, board.tiles[5]!],
            source: 'match'
        });

        expect(conduitEffect.peekChargeGain).toBe(2);
        expect(conduitEffect.scoreBonus).toBe(46);
        expect(conduitEffect.interactionTags).toEqual(expect.arrayContaining(['chapter-compass:conduit-map']));
        expect(sealedEffect.comboShardGain).toBe(2);
        expect(sealedEffect.interactionTags).toContain('catalyst-thread:sealed-engine');
        expect(driftEffect.regionShuffleChargeGain).toBe(2);
        expect(driftEffect.scoreBonus).toBe(10);
        expect(driftEffect.interactionTags).toContain('row-compass:drift-routing');
    });

    it('turns trait relic overflow into score instead of wasting capped rewards', () => {
        const board = makeBoard(
            [
                makeTile('m1', 'mirror', 'M', { tileTraitKind: 'mirror', state: 'flipped' }),
                makeTile('m2', 'mirror', 'M', { tileTraitKind: 'mirror', state: 'flipped' }),
                makeTile('s1', 'sealed', 'S', { tileTraitKind: 'sealed', state: 'flipped' }),
                makeTile('s2', 'sealed', 'S', { tileTraitKind: 'sealed', state: 'flipped' })
            ],
            { columns: 2, rows: 2 }
        );
        const run = makeRun(board.tiles, {
            board,
            relicIds: ['guard_token_plus_one', 'combo_shard_plus_step'],
            stats: { ...makeRun(board.tiles).stats, guardTokens: 2, comboShards: 2 }
        });

        const mirrorEffect = resolveTileTraitEffects({
            run,
            board,
            sourceTiles: [board.tiles[0]!, board.tiles[1]!],
            source: 'match'
        });
        const sealedEffect = resolveTileTraitEffects({
            run,
            board,
            sourceTiles: [board.tiles[2]!, board.tiles[3]!],
            source: 'match'
        });

        expect(mirrorEffect.guardTokenGain).toBe(1);
        expect(mirrorEffect.scoreBonus).toBe(20);
        expect(mirrorEffect.interactionTags).toContain('warden-sigil:mirror-ward');
        expect(sealedEffect.comboShardGain).toBe(0);
        expect(sealedEffect.scoreBonus).toBe(18);
    });

    it('lets older traits interact through nearby trait layout', () => {
        const board = makeBoard(
            [
                makeTile('e1', 'e', 'E', { tileTraitKind: 'echo', state: 'flipped' }),
                makeTile('e2', 'e', 'E', { tileTraitKind: 'echo', state: 'flipped' }),
                makeTile('s1', 's', 'S', { tileTraitKind: 'sealed' }),
                makeTile('h1', 'h', 'H', { tileTraitKind: 'heavy' }),
                makeTile('m1', 'm', 'M', { tileTraitKind: 'mirror' }),
                makeTile('t1', 't', 'T', { tileTraitKind: 'stasis' }),
                makeTile('x1', 'x', 'X'),
                makeTile('x2', 'x', 'X')
            ],
            { columns: 4, rows: 2 }
        );
        const run = makeRun(board.tiles, { board });

        const echoEffect = resolveTileTraitEffects({
            run,
            board,
            sourceTiles: [board.tiles[0]!, board.tiles[1]!],
            source: 'match'
        });
        const mirrorEffect = resolveTileTraitEffects({
            run,
            board,
            sourceTiles: [{ ...board.tiles[4]!, state: 'flipped' }, { ...board.tiles[4]!, id: 'm2', state: 'flipped' }],
            source: 'match'
        });

        expect(echoEffect.comboShardGain).toBe(1);
        expect(echoEffect.interactionTags).toContain('echo:sealed-combo');
        expect(mirrorEffect.guardTokenGain).toBe(2);
        expect(mirrorEffect.scoreBonus).toBe(10);
        expect(mirrorEffect.interactionTags).toContain('mirror:stasis-guard');
    });

    it('turns echo beside mirror into recall focus for the next clean match', () => {
        const board = makeBoard(
            [
                makeTile('e1', 'e', 'E', { tileTraitKind: 'echo' }),
                makeTile('m1', 'm', 'M', { tileTraitKind: 'mirror' }),
                makeTile('e2', 'e', 'E', { tileTraitKind: 'echo' }),
                makeTile('x1', 'x', 'X')
            ],
            { columns: 2, rows: 2 }
        );
        const run = makeRun(board.tiles, { board, recallFocus: 1 });

        const effect = resolveTileTraitEffects({
            run,
            board,
            sourceTiles: [{ ...board.tiles[0]!, state: 'flipped' }, { ...board.tiles[2]!, state: 'flipped' }],
            source: 'match'
        });
        const resolved = resolveBoardTurn(flipTile(flipTile({ ...run, board }, 'e1'), 'e2'));

        expect(effect.recallFocusGain).toBe(1);
        expect(effect.interactionTags).toContain('echo:mirror-focus');
        expect(resolved.recallFocus).toBe(3);
    });

    it('turns risky cursed and volatile adjacency into greed upside and miss pressure', () => {
        const board = makeBoard(
            [
                makeTile('c1', 'c', 'C', { tileTraitKind: 'cursed', state: 'flipped' }),
                makeTile('c2', 'c', 'C', { tileTraitKind: 'cursed', state: 'flipped' }),
                makeTile('v1', 'v', 'V', { tileTraitKind: 'volatile' }),
                makeTile('x1', 'x', 'X')
            ],
            { columns: 2, rows: 2 }
        );
        const run = makeRun(board.tiles, { board });

        const matchEffect = resolveTileTraitEffects({
            run,
            board,
            sourceTiles: [board.tiles[0]!, board.tiles[1]!],
            source: 'match'
        });
        const missPenalty = calculateTileTraitMismatchPenalty(run, [board.tiles[0]!, board.tiles[3]!], board);

        expect(matchEffect.shopGoldGain).toBe(1);
        expect(matchEffect.scoreBonus).toBe(35);
        expect(matchEffect.interactionTags).toContain('cursed:volatile-greed');
        expect(missPenalty).toMatchObject({ triesDelta: 1, recallMistakesDelta: 1 });
    });

    it('lets wager surety buffer cursed plus volatile miss pressure without removing recall pressure', () => {
        const board = makeBoard(
            [
                makeTile('c1', 'c', 'C', { tileTraitKind: 'cursed', state: 'flipped' }),
                makeTile('v1', 'v', 'V', { tileTraitKind: 'volatile' }),
                makeTile('x1', 'x', 'X', { state: 'flipped' }),
                makeTile('y1', 'y', 'Y')
            ],
            { columns: 2, rows: 2 }
        );
        const run = makeRun(board.tiles, { board, relicIds: ['wager_surety'] });
        const effect = resolveTileTraitEffects({
            run,
            board,
            sourceTiles: [board.tiles[0]!, board.tiles[2]!],
            source: 'mismatch'
        });

        expect(effect.triesDelta).toBe(0);
        expect(effect.recallMistakesDelta).toBe(1);
        expect(effect.interactionTags).toEqual(
            expect.arrayContaining(['cursed:volatile-danger', 'wager-surety:cursed-buffer'])
        );
    });

    it('lets stasis buffer sealed mismatch drain and recall pressure', () => {
        const board = makeBoard(
            [
                makeTile('s1', 'sealed', 'S', { tileTraitKind: 'sealed', state: 'flipped' }),
                makeTile('t1', 'stasis', 'T', { tileTraitKind: 'stasis' }),
                makeTile('x1', 'x', 'X', { state: 'flipped' }),
                makeTile('y1', 'y', 'Y')
            ],
            { columns: 2, rows: 2 }
        );
        const run = makeRun(board.tiles, { board, peekCharges: 1 });
        const penalty = calculateTileTraitMismatchPenalty(run, [board.tiles[0]!, board.tiles[2]!], board);

        expect(penalty).toMatchObject({ peekChargeLoss: 0, recallMistakesDelta: 0 });
        expect(
            resolveTileTraitEffects({
                run,
                board,
                sourceTiles: [board.tiles[0]!, board.tiles[2]!],
                source: 'mismatch'
            }).interactionTags
        ).toContain('stasis:sealed-buffer');
    });

    it('lets stasis block a nearby trait only when another hidden pair remains', () => {
        const board = makeBoard(
            [
                makeTile('s1', 's', 'S', { tileTraitKind: 'stasis', state: 'flipped' }),
                makeTile('s2', 's', 'S', { tileTraitKind: 'stasis', state: 'flipped' }),
                makeTile('x2', 'x', 'X', { tileTraitKind: 'echo' }),
                makeTile('x1', 'x', 'X', { tileTraitKind: 'echo' }),
                makeTile('y1', 'y', 'Y'),
                makeTile('y2', 'y', 'Y')
            ],
            { columns: 3, rows: 2 }
        );
        const run = makeRun(board.tiles, { board });

        const effect = resolveTileTraitEffects({
            run,
            board,
            sourceTiles: [board.tiles[0]!, board.tiles[1]!],
            source: 'match'
        });
        const unsafeBoard = { ...board, tiles: board.tiles.slice(0, 4), pairCount: 2, rows: 2 };
        const unsafeEffect = resolveTileTraitEffects({
            run: makeRun(unsafeBoard.tiles, { board: unsafeBoard }),
            board: unsafeBoard,
            sourceTiles: [unsafeBoard.tiles[0]!, unsafeBoard.tiles[1]!],
            source: 'match'
        });

        expect(effect.stickyBlockIndex).toBe(2);
        expect(effect.interactionTags).toContain('stasis:nearby-block');
        expect(unsafeEffect.stickyBlockIndex).toBeNull();
    });

    it('adds mirror mismatch pressure without hiding the base miss bookkeeping', () => {
        const [a1] = makePair('a', 'A');
        const [b1] = makePair('b', 'B');
        const run = makeRun([], { peekCharges: 1 });
        const penalty = calculateTileTraitMismatchPenalty(run, [{ ...a1, tileTraitKind: 'mirror' }, b1]);

        expect(penalty).toMatchObject({ triesDelta: 1, recallMistakesDelta: 1, peekChargeLoss: 0 });
    });

    it('drains peek on sealed mismatch before adding deeper recall pressure', () => {
        const [a1] = makePair('a', 'A');
        const [b1] = makePair('b', 'B');
        const withPeek = calculateTileTraitMismatchPenalty(makeRun([], { peekCharges: 1 }), [
            { ...a1, tileTraitKind: 'sealed' },
            b1
        ]);
        const withoutPeek = calculateTileTraitMismatchPenalty(makeRun([], { peekCharges: 0 }), [
            { ...a1, tileTraitKind: 'sealed' },
            b1
        ]);

        expect(withPeek).toMatchObject({ peekChargeLoss: 1, recallMistakesDelta: 0 });
        expect(withoutPeek).toMatchObject({ peekChargeLoss: 0, recallMistakesDelta: 1 });
    });

    it('normalizes malformed mismatch resource counters before trait penalties', () => {
        const [sealedA] = makePair('sealed', 'S');
        const [volatileA] = makePair('volatile', 'V');
        const [plainA] = makePair('plain', 'P');

        expect(calculateTileTraitMismatchPenalty(
            makeRun([], { peekCharges: Number.POSITIVE_INFINITY }),
            [{ ...sealedA, tileTraitKind: 'sealed' }, plainA]
        )).toMatchObject({
            peekChargeLoss: 0,
            recallMistakesDelta: 1
        });
        expect(calculateTileTraitMismatchPenalty(
            makeRun([], {
                relicIds: ['wager_surety'],
                stats: { ...makeRun([]).stats, guardTokens: Number.POSITIVE_INFINITY }
            }),
            [{ ...volatileA, tileTraitKind: 'volatile' }, plainA]
        ).blocksVolatileShuffle).toBe(false);
    });

    it('ignores malformed relic ids before trait mismatch penalties', () => {
        const [cursedA] = makePair('cursed', 'C');
        const [volatileA] = makePair('volatile', 'V');

        const run = makeRun([], { relicIds: Number.NaN as unknown as RelicId[] });
        const sourceTiles = [{ ...cursedA, tileTraitKind: 'cursed' as const }, { ...volatileA, tileTraitKind: 'volatile' as const }];
        const penalty = calculateTileTraitMismatchPenalty(
            run,
            sourceTiles
        );
        const effect = resolveTileTraitEffects({
            run,
            source: 'mismatch',
            sourceTiles
        });

        expect(penalty.triesDelta).toBe(1);
        expect(penalty.blocksVolatileShuffle).toBe(false);
        expect(effect.interactionTags).not.toContain('wager-surety:cursed-buffer');
    });

    it('normalizes malformed flip history before volatile mismatch shuffles', () => {
        const board = makeBoard([
            makeTile('v1', 'v', 'V', { tileTraitKind: 'volatile', state: 'flipped' }),
            makeTile('x1', 'x', 'X', { state: 'flipped' }),
            makeTile('a1', 'a', 'A'),
            makeTile('b1', 'b', 'B')
        ]);
        const result = applyVolatileMismatchTrait(
            board,
            makeRun(board.tiles, { board, flipHistory: Number.NaN as unknown as string[] }),
            [board.tiles[0]!, board.tiles[1]!]
        );

        expect(result.triggered).toBe(true);
    });

    it('normalizes malformed stat records before volatile mismatch shuffles', () => {
        const board = makeBoard([
            makeTile('v1', 'v', 'V', { tileTraitKind: 'volatile', state: 'flipped' }),
            makeTile('x1', 'x', 'X', { state: 'flipped' }),
            makeTile('a1', 'a', 'A'),
            makeTile('b1', 'b', 'B')
        ]);
        const result = applyVolatileMismatchTrait(
            board,
            {
                ...makeRun(board.tiles, { board }),
                stats: Number.NaN as unknown as RunState['stats']
            },
            [board.tiles[0]!, board.tiles[1]!]
        );

        expect(result.triggered).toBe(true);
    });
    it('makes Heavy misses cost extra tries without draining peek value', () => {
        const [a1] = makePair('a', 'A');
        const [b1] = makePair('b', 'B');
        const penalty = calculateTileTraitMismatchPenalty(makeRun([], { peekCharges: 1 }), [
            { ...a1, tileTraitKind: 'heavy' },
            b1
        ]);

        expect(penalty).toMatchObject({ triesDelta: 1, recallMistakesDelta: 0, peekChargeLoss: 0 });
    });

    it('deepens conduit mismatch recall pressure near cursed or volatile traits', () => {
        const board = makeBoard(
            [
                makeTile('c1', 'c', 'C', { tileTraitKind: 'conduit', state: 'flipped' }),
                makeTile('x1', 'x', 'X', { state: 'flipped' }),
                makeTile('y1', 'y', 'Y'),
                makeTile('v1', 'v', 'V', { tileTraitKind: 'volatile' })
            ],
            { columns: 2, rows: 2 }
        );
        const run = makeRun(board.tiles, { board });

        const penalty = calculateTileTraitMismatchPenalty(run, [board.tiles[0]!, board.tiles[1]!], board);

        expect(penalty).toMatchObject({ recallMistakesDelta: 1, triesDelta: 0 });
    });

    it('shuffles safe hidden tiles when a volatile pair is missed', () => {
        const board = makeBoard([
            makeTile('v1', 'v', 'V', { tileTraitKind: 'volatile', state: 'flipped' }),
            makeTile('x1', 'x', 'X', { state: 'flipped' }),
            makeTile('a1', 'a', 'A'),
            makeTile('a2', 'a', 'A'),
            makeTile('b1', 'b', 'B'),
            makeTile('b2', 'b', 'B')
        ]);
        const run = makeRun(board.tiles, { board });

        const result = applyVolatileMismatchTrait(board, run, [board.tiles[0]!, board.tiles[1]!]);
        expect(result.triggered).toBe(true);
        expect(result.board.tiles.slice(2).map((tile) => tile.id)).not.toEqual(board.tiles.slice(2).map((tile) => tile.id));
        expect(result.board.tiles.slice(2).map((tile) => tile.id).sort()).toEqual(board.tiles.slice(2).map((tile) => tile.id).sort());
    });
});
