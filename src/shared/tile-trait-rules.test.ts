import { describe, expect, it } from 'vitest';
import { buildBoard } from './board-generation';
import { GAME_RULES_VERSION, type RunState } from './contracts';
import { flipTile, resolveBoardTurn } from './turn-resolution';
import { makeBoard, makePair, makeRun, makeTile } from './test/game-fixtures';
import { getTraitOpportunityHudModel, getTraitOpportunitySummary } from './trait-opportunities';
import {
    assignTileTraitsToGeneratedBoard,
    calculateTileTraitMatchRewards,
    calculateTileTraitMismatchPenalty,
    FIRST_TRAIT_FLOOR,
    formatTileTraitInteractionTags,
    getBoardTraitInteractionPreviewLines,
    getTileSwapTraitPreviewLines,
    getTileTraitInteractionPreviewLines,
    TILE_TRAIT_COPY,
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
                'conduit:echo-peek',
                'conduit:echo-peek',
                'unknown',
                '__proto__',
                'constructor',
                'toString',
                'stasis:nearby-block'
            ])
        ).toEqual(['Conduit + Echo: peek spark', 'Stasis: nearby trait blocked']);
    });

    it('keeps every known interaction tag backed by player-facing copy', () => {
        expect(TILE_TRAIT_INTERACTION_TAGS.length).toBeGreaterThan(0);
        expect(Object.keys(TILE_TRAIT_INTERACTION_TEXT)).toEqual([...TILE_TRAIT_INTERACTION_TAGS]);
        for (const tag of TILE_TRAIT_INTERACTION_TAGS) {
            expect(TILE_TRAIT_INTERACTION_TEXT[tag]).toMatch(/\S/);
        }
    });

    it('keeps the four traits and only the interactions whose both halves survived the triage', () => {
        expect(Object.keys(TILE_TRAIT_COPY).sort()).toEqual(['conduit', 'echo', 'heavy', 'stasis']);
        expect([...TILE_TRAIT_INTERACTION_TAGS]).toEqual([
            'conduit:adjacent-score',
            'conduit:echo-peek',
            'conduit:stasis-lock',
            'stasis:nearby-block'
        ]);
        // A cut trait must not survive as a word in the copy of a kept one.
        for (const copy of Object.values(TILE_TRAIT_COPY)) {
            expect(`${copy.match} ${copy.mismatch}`).not.toMatch(/\b(Mirror|Cursed|Sealed|Volatile|Drift)\b/);
        }
    });

    it('previews nearby trait interactions before a match or swap is committed', () => {
        const board = makeBoard(
            [
                makeTile('c1', 'c', 'C', { tileTraitKind: 'conduit' }),
                makeTile('e1', 'e', 'E', { tileTraitKind: 'echo' }),
                makeTile('x1', 'x', 'X'),
                makeTile('t1', 't', 'T', { tileTraitKind: 'stasis' })
            ],
            { columns: 2, rows: 2 }
        );

        expect(getTileTraitInteractionPreviewLines(board, ['c1'])).toEqual([
            'Conduit: adjacent trait charge',
            'Conduit + Echo: peek spark'
        ]);
        // Echo pays on its own match and has nothing to preview as a source.
        expect(getTileTraitInteractionPreviewLines(board, ['e1'])).toEqual([]);
        // Moving the Conduit down beside the Stasis is what lights the lock pulse.
        expect(getTileSwapTraitPreviewLines(board, 'c1', 'x1')).toEqual(
            expect.arrayContaining(['Conduit + Stasis: lock pulse'])
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

    it('leaves the three authored floors traitless and starts traits on the fourth', () => {
        const baseTiles = Array.from({ length: 6 }, (_, index) => makePair(`pair-${index}`, String(index))).flat();

        expect(FIRST_TRAIT_FLOOR).toBe(4);
        for (const level of [1, 2, 3]) {
            const tiles = assignTileTraitsToGeneratedBoard(baseTiles, 1, 30, level);
            expect(uniqueTraitPairCount(tiles), `floor ${level}`).toBe(0);
            // Untouched means untouched: the same tiles come back, only copied.
            expect(tiles).toEqual(baseTiles);
        }
        expect(uniqueTraitPairCount(assignTileTraitsToGeneratedBoard(baseTiles, 1, 30, 4))).toBeGreaterThanOrEqual(2);
    });

    it('scales trait density into a normal board layer and seeds combo adjacency', () => {
        const baseTiles = Array.from({ length: 8 }, (_, index) => makePair(`pair-${index}`, String(index))).flat();

        const tiles = assignTileTraitsToGeneratedBoard(baseTiles, 123, 30, 4);
        const board = makeBoard(tiles, { columns: 4, rows: 4 });

        expect(uniqueTraitPairCount(tiles)).toBe(4);
        expect(getBoardTraitInteractionPreviewLines(board).length).toBeGreaterThanOrEqual(1);
    });

    it('does not hard-cap trait count on larger eligible boards', () => {
        const baseTiles = Array.from({ length: 18 }, (_, index) => makePair(`pair-${index}`, String(index))).flat();
        const tiles = assignTileTraitsToGeneratedBoard(baseTiles, 123, 30, 12);

        expect(uniqueTraitPairCount(tiles)).toBe(9);
    });

    it('keeps generated trait floors from becoming isolated flavor', () => {
        const levels = [4, 5, 7, 9, 12] as const;
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

    it('draws every kept trait through the seeded pool', () => {
        const baseTiles = Array.from({ length: 12 }, (_, index) => makePair(`pair-${index}`, String(index))).flat();
        const seen = new Set(
            Array.from({ length: 120 }, (_, index) => assignTileTraitsToGeneratedBoard(baseTiles, index + 1, 30, 12))
                .flat()
                .map((tile) => tile.tileTraitKind)
                .filter((kind): kind is NonNullable<typeof kind> => kind != null)
        );

        expect([...seen].sort()).toEqual(['conduit', 'echo', 'heavy', 'stasis']);
    });

    it('guarantees generated trait boards have match-triggerable routes when enough trait pairs exist', () => {
        const baseTiles = Array.from({ length: 10 }, (_, index) => makePair(`pair-${index}`, String(index))).flat();

        for (let seed = 1; seed <= 320; seed += 1) {
            const tiles = assignTileTraitsToGeneratedBoard(baseTiles, seed, 30, 7);
            const board = makeBoard(tiles, { columns: 5, rows: 4 });

            expect(uniqueTraitPairCount(tiles)).toBeGreaterThanOrEqual(2);
            expect(getBoardTraitInteractionPreviewLines(board).length).toBeGreaterThan(0);
        }
    });

    it('turns echo and heavy clean matches into their own rewards', () => {
        const run = makeRun([]);
        const [echoA, echoB] = makePair('echo', 'E');
        const [heavyA, heavyB] = makePair('heavy', 'H');

        expect(calculateTileTraitMatchRewards(run, [{ ...echoA, tileTraitKind: 'echo' }, echoB])).toEqual({
            peekChargeGain: 1,
            scoreBonus: 0
        });
        expect(calculateTileTraitMatchRewards(run, [{ ...heavyA, tileTraitKind: 'heavy' }, heavyB])).toEqual({
            peekChargeGain: 0,
            scoreBonus: 35
        });
    });

    it('normalizes malformed resource counters before calculating trait match rewards', () => {
        const board = makeBoard(
            [
                makeTile('c1', 'c', 'C', { tileTraitKind: 'conduit', state: 'flipped' }),
                makeTile('c2', 'c', 'C', { tileTraitKind: 'conduit', state: 'flipped' }),
                makeTile('e1', 'e', 'E', { tileTraitKind: 'echo' }),
                makeTile('x1', 'x', 'X')
            ],
            { columns: 2, rows: 2 }
        );
        const run = makeRun(board.tiles, {
            board,
            matchResolutionsThisFloor: Number.NaN,
            peekCharges: Number.POSITIVE_INFINITY,
            stats: { ...makeRun([]).stats, currentStreak: Number.POSITIVE_INFINITY, comboShards: Number.NaN }
        });
        const malformedStats = { ...run, stats: Number.NaN as unknown as RunState['stats'] };

        for (const candidate of [run, malformedStats]) {
            expect(calculateTileTraitMatchRewards(candidate, [board.tiles[0]!, board.tiles[1]!], board)).toEqual({
                peekChargeGain: 1,
                scoreBonus: 12
            });
        }
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

    it('converts nearby heavy and echo traits into conduit score and a relayed peek charge', () => {
        const board = makeBoard(
            [
                makeTile('c1', 'c', 'C', { tileTraitKind: 'conduit', state: 'flipped' }),
                makeTile('c2', 'c', 'C', { tileTraitKind: 'conduit', state: 'flipped' }),
                makeTile('h1', 'h', 'H', { tileTraitKind: 'heavy' }),
                makeTile('e1', 'e', 'E', { tileTraitKind: 'echo' }),
                makeTile('x1', 'x', 'X'),
                makeTile('x2', 'x', 'X')
            ],
            { columns: 3, rows: 2 }
        );
        const run = makeRun(board.tiles, { board, peekCharges: 2 });

        const effect = resolveTileTraitEffects({
            run,
            board,
            sourceTiles: [board.tiles[0]!, board.tiles[1]!],
            source: 'match'
        });

        expect(effect.scoreBonus).toBe(24);
        expect(effect.peekChargeGain).toBe(1);
        expect(effect.interactionTags).toEqual(['conduit:adjacent-score', 'conduit:echo-peek']);
        // The peek half pays through the effects engine, so the turn journals a definition command for it.
        expect(effect.gameplayCommands?.map((command) => (command.type === 'effects.apply' ? command.definitionId : command.type))).toEqual([
            'trait.conduit_echo_peek'
        ]);
        expect(effect.gameplayEvents).toContainEqual(
            expect.objectContaining({ type: 'inventory.changed', itemId: 'peek_charge', applied: 1 })
        );

        const resolved = resolveBoardTurn(flipTile(flipTile({ ...run, board: { ...board, tiles: board.tiles.map((tile) => ({ ...tile, state: 'hidden' as const })) } }, 'c1'), 'c2'));
        expect(resolved.peekCharges).toBe(3);
    });

    it('turns conduit beside stasis into a lock pulse on the nearby trait tile', () => {
        const board = makeBoard(
            [
                makeTile('c1', 'conduit', 'C', { tileTraitKind: 'conduit', state: 'flipped' }),
                makeTile('c2', 'conduit', 'C', { tileTraitKind: 'conduit', state: 'flipped' }),
                makeTile('t1', 'stasis', 'T', { tileTraitKind: 'stasis' }),
                makeTile('x1', 'x', 'X'),
                makeTile('y1', 'y', 'Y'),
                makeTile('y2', 'y', 'Y'),
                makeTile('z1', 'z', 'Z'),
                makeTile('z2', 'z', 'Z')
            ],
            { columns: 4, rows: 2 }
        );
        const run = makeRun(board.tiles, { board });

        const effect = resolveTileTraitEffects({
            run,
            board,
            sourceTiles: [board.tiles[0]!, board.tiles[1]!],
            source: 'match'
        });

        expect(effect.stickyBlockIndex).toBe(2);
        expect(effect.scoreBonus).toBe(22);
        expect(effect.interactionTags).toEqual(['conduit:adjacent-score', 'conduit:stasis-lock']);
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

    it('makes Heavy misses cost an extra try and nothing else', () => {
        const [a1, a2] = makePair('a', 'A');
        const [b1, b2] = makePair('b', 'B');
        const heavyA = { ...a1, tileTraitKind: 'heavy' as const };

        expect(calculateTileTraitMismatchPenalty(makeRun([], { peekCharges: 1 }), [heavyA, b1])).toEqual({ triesDelta: 1 });
        expect(
            calculateTileTraitMismatchPenalty(
                makeRun([], { stats: { ...makeRun([]).stats, tries: Number.POSITIVE_INFINITY } }),
                [a1, b1]
            )
        ).toEqual({ triesDelta: 0 });

        const run = makeRun([heavyA, { ...a2, tileTraitKind: 'heavy' }, b1, b2], { peekCharges: 1 });
        const resolved = resolveBoardTurn(flipTile(flipTile(run, 'a-a'), 'b-a'));
        expect(resolved.stats.tries).toBe(run.stats.tries + 2);
        expect(resolved.peekCharges).toBe(1);
        expect(resolved.stats.tileTraitMismatches.heavy).toBe(1);
    });

    it('previews nothing for a miss: the surviving interactions all fire on a match', () => {
        const board = makeBoard(
            [
                makeTile('h1', 'h', 'H', { tileTraitKind: 'heavy', state: 'flipped' }),
                makeTile('c1', 'c', 'C', { tileTraitKind: 'conduit' }),
                makeTile('x1', 'x', 'X', { state: 'flipped' }),
                makeTile('t1', 't', 'T', { tileTraitKind: 'stasis' })
            ],
            { columns: 2, rows: 2 }
        );
        const run = makeRun(board.tiles, { board });

        const effect = resolveTileTraitEffects({
            run,
            board,
            sourceTiles: [board.tiles[0]!, board.tiles[2]!],
            source: 'mismatch'
        });

        expect(effect).toEqual({
            interactionTags: [],
            peekChargeGain: 0,
            scoreBonus: 0,
            stickyBlockIndex: null,
            triesDelta: 1
        });
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
