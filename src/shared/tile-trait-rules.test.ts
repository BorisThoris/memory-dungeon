import { describe, expect, it } from 'vitest';
import { buildBoard } from './board-generation';
import { GAME_RULES_VERSION, type RunState } from './contracts';
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
    releaseStrandedStasisBlock,
    resolveTileTraitEffects
} from './tile-trait-rules';

const uniqueTraitPairCount = (tiles: ReturnType<typeof makeTile>[]): number =>
    new Set(tiles.filter((tile) => tile.tileTraitKind != null).map((tile) => tile.pairKey)).size;

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

    it('assigns deterministic traits to generated tiles', () => {
        const baseTiles = [
            ...makePair('a', 'A'),
            ...makePair('b', 'B'),
            ...makePair('c', 'C'),
            ...makePair('d', 'D')
        ];
        const tiles = assignTileTraitsToGeneratedBoard(baseTiles, 123, 30, 4);

        expect(tiles.filter((tile) => tile.tileTraitKind != null).length).toBeGreaterThan(0);
        expect(assignTileTraitsToGeneratedBoard(baseTiles, 123, 30, 4).map((tile) => tile.tileTraitKind ?? null)).toEqual(
            tiles.map((tile) => tile.tileTraitKind ?? null)
        );
    });

    it('uses final board columns when repairing generated trait interaction layouts', () => {
        const board = buildBoard(4, {
            runSeed: 70_202,
            runRulesVersion: GAME_RULES_VERSION,
            gameMode: 'endless'
        });

        expect(uniqueTraitPairCount(board.tiles)).toBeGreaterThanOrEqual(2);
        expect(getBoardTraitInteractionPreviewLines(board).length).toBeGreaterThan(0);
    });

    it('keeps the opener readable while still introducing traits as a core mechanic', () => {
        const [a1, a2] = makePair('a', 'A');
        const tiles = assignTileTraitsToGeneratedBoard([a1, a2], 1, 30, 1);
        expect(uniqueTraitPairCount(tiles)).toBe(1);
        expect(tiles.every((tile) => ['echo', 'mirror', 'heavy'].includes(tile.tileTraitKind ?? ''))).toBe(true);
    });

    it('introduces a match-triggerable trait route on normal opener boards', () => {
        const baseTiles = Array.from({ length: 4 }, (_, index) => makePair(`pair-${index}`, String(index))).flat();
        const tiles = assignTileTraitsToGeneratedBoard(baseTiles, 1, 30, 1);
        const board = makeBoard(tiles, { columns: 3, rows: 3 });
        const openerTraits = tiles.map((tile) => tile.tileTraitKind).filter(Boolean);

        expect(uniqueTraitPairCount(tiles)).toBe(2);
        expect(openerTraits).not.toContain('cursed');
        expect(openerTraits).not.toContain('volatile');
        expect(getBoardTraitInteractionPreviewLines(board, 'match').length).toBeGreaterThan(0);
    });

    it('scales trait density into a normal board layer and seeds combo adjacency', () => {
        const baseTiles = Array.from({ length: 8 }, (_, index) => makePair(`pair-${index}`, String(index))).flat();

        const tiles = assignTileTraitsToGeneratedBoard(baseTiles, 123, 30, 4);
        const board = makeBoard(tiles, { columns: 4, rows: 4 });

        expect(uniqueTraitPairCount(tiles)).toBe(4);
        expect(getBoardTraitInteractionPreviewLines(board, 'match').length).toBeGreaterThanOrEqual(2);
    });


    it('does not hard-cap trait count on larger eligible boards', () => {
        const baseTiles = Array.from({ length: 18 }, (_, index) => makePair(`pair-${index}`, String(index))).flat();
        const tiles = assignTileTraitsToGeneratedBoard(baseTiles, 123, 30, 12);

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

    it('surfaces the newer interaction traits through the seeded pool', () => {
        const baseTiles = Array.from({ length: 12 }, (_, index) => makePair(`pair-${index}`, String(index))).flat();
        const seen = new Set(
            Array.from({ length: 120 }, (_, index) => assignTileTraitsToGeneratedBoard(baseTiles, index + 1, 30, 12))
                .flat()
                .map((tile) => tile.tileTraitKind)
                .filter((kind): kind is NonNullable<typeof kind> => kind != null)
        );

        expect([...seen]).toEqual(expect.arrayContaining(['drift', 'conduit', 'stasis']));
    });

    it('guarantees generated trait boards have match-triggerable routes when enough trait pairs exist', () => {
        const baseTiles = Array.from({ length: 10 }, (_, index) => makePair(`pair-${index}`, String(index))).flat();

        for (let seed = 1; seed <= 320; seed += 1) {
            const tiles = assignTileTraitsToGeneratedBoard(baseTiles, seed, 30, 7);
            const board = makeBoard(tiles, { columns: 5, rows: 4 });

            expect(uniqueTraitPairCount(tiles)).toBeGreaterThanOrEqual(2);
            expect(getBoardTraitInteractionPreviewLines(board, 'match').length).toBeGreaterThan(0);
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
            scoreBonus: 0
        });
        expect(calculateTileTraitMatchRewards(run, [{ ...mirrorA, tileTraitKind: 'mirror' }, mirrorB])).toEqual({
            comboShardGain: 0,
            guardTokenGain: 1,
            peekChargeGain: 0,
            scoreBonus: 0
        });
    });

    it('turns cursed, sealed, and heavy matches into build rewards', () => {
        const run = makeRun([]);
        const [cursedA, cursedB] = makePair('cursed', 'C');
        const [sealedA, sealedB] = makePair('sealed', 'S');
        const [heavyA, heavyB] = makePair('heavy', 'H');

        expect(calculateTileTraitMatchRewards(run, [{ ...cursedA, tileTraitKind: 'cursed' }, cursedB]).scoreBonus).toBe(15);
        expect(calculateTileTraitMatchRewards(run, [{ ...sealedA, tileTraitKind: 'sealed' }, sealedB]).comboShardGain).toBe(1);
        expect(calculateTileTraitMatchRewards(run, [{ ...heavyA, tileTraitKind: 'heavy' }, heavyB]).scoreBonus).toBe(35);
    });

    it('normalizes malformed resource counters before calculating trait match rewards', () => {
        const run = makeRun([], {
            matchResolutionsThisFloor: Number.NaN,
            peekCharges: Number.POSITIVE_INFINITY,
            recallFocus: Number.POSITIVE_INFINITY,
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
        expect(calculateTileTraitMatchRewards(run, [{ ...mirrorA, tileTraitKind: 'mirror' }, mirrorB]).guardTokenGain).toBe(1);
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

        expect(matchEffect.scoreBonus).toBe(35);
        expect(matchEffect.interactionTags).toContain('cursed:volatile-greed');
        expect(missPenalty).toMatchObject({ triesDelta: 1, recallMistakesDelta: 1 });
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
            makeRun([], { stats: { ...makeRun([]).stats, guardTokens: Number.POSITIVE_INFINITY } }),
            [{ ...volatileA, tileTraitKind: 'volatile' }, plainA]
        )).toMatchObject({ peekChargeLoss: 0, recallMistakesDelta: 0, triesDelta: 0 });
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

describe('a Stasis block never becomes the last pair standing', () => {
    /*
     * This softlock was live and unreachable at the same time. `selectStasisBlockIndex` refuses to
     * block when one pair is left, but it looks at the board before the match's pop takes its
     * pairs off it: two pairs at the moment of decision, one once the cascade settles, and the one
     * that survives is the blocked one. Nothing else on the board can be played and the floor never
     * ends.
     *
     * It stayed invisible for as long as every floor carried an exit tile, because a stranded
     * player could still leave through the exit and the floor would clear anyway - so the bug read
     * as "an odd turn" rather than "the run is over". Removing the exit is what surfaced it, on
     * seed 172707 floor 3, which is an ordinary floor and not a corner.
     */
    it('releases the block when the turn leaves a single playable pair behind', () => {
        // One pair already taken by the pop, one pair left, and the block is on it.
        const board = makeBoard([
            makeTile('p1-a', 'p1', 'p1', { state: 'removed' }),
            makeTile('p1-b', 'p1', 'p1', { state: 'removed' }),
            ...makePair('p2', 'p2')
        ]);
        const stranded = makeRun(board.tiles, { board, stickyBlockIndex: 2 });

        expect(releaseStrandedStasisBlock(stranded).stickyBlockIndex).toBeNull();
    });

    it('leaves a block alone while the player still has somewhere else to go', () => {
        const board = makeBoard([...makePair('p1', 'p1'), ...makePair('p2', 'p2'), ...makePair('p3', 'p3')]);
        const blocked = makeRun(board.tiles, { board, stickyBlockIndex: 4 });

        expect(releaseStrandedStasisBlock(blocked).stickyBlockIndex).toBe(4);
    });

    it('is a no-op when no block is standing', () => {
        const board = makeBoard([...makePair('p1', 'p1')]);
        const clean = makeRun(board.tiles, { board, stickyBlockIndex: null });

        expect(releaseStrandedStasisBlock(clean)).toBe(clean);
    });

    it('clears a real generated floor whose pop strands the block it just set', () => {
        // Seed 172707 floor 3: a Stasis match pops the third pair, and the Conduit tile it blocked
        // is half of the only pair left. Before the release this floor sat at 'playing' forever.
        const board = buildBoard(3, {
            runSeed: 172_707,
            runRulesVersion: GAME_RULES_VERSION,
            gameMode: 'endless',
            floorTag: 'normal',
            activeMutators: []
        });
        let run: RunState = { ...makeRun(board.tiles, { board }), board, status: 'playing' };

        for (let pass = 0; pass < board.pairCount + 4 && run.status === 'playing'; pass += 1) {
            const nextPair = [...new Set(run.board!.tiles.map((tile) => tile.pairKey))]
                .map((pairKey) => run.board!.tiles.filter((tile) => tile.pairKey === pairKey && tile.state === 'hidden'))
                .find((tiles) => tiles.length === 2);
            if (!nextPair) break;
            run = resolveBoardTurn(flipTile(flipTile(run, nextPair[0]!.id), nextPair[1]!.id));
        }

        expect(run.status).toBe('levelComplete');
    });
});
