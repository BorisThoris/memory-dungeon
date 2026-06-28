import { describe, expect, it } from 'vitest';
import type { BoardState, RunState, Tile } from './contracts';
import { createNewRun } from './game';
import { createMatchedPairClaimBoard, deriveMatchClaimContext } from './match-claim-rules';
import { WILD_PAIR_KEY } from './tile-identity';

const tile = (id: string, pairKey = 'A', extra: Partial<Tile> = {}): Tile => ({
    id,
    label: id.toUpperCase(),
    pairKey,
    state: 'flipped',
    symbol: id.toUpperCase(),
    ...extra
});

const boardWith = (tiles: Tile[]): BoardState => ({
    columns: 2,
    featuredObjectiveId: null,
    flippedTileIds: tiles.map((t) => t.id),
    floorArchetypeId: null,
    level: 2,
    matchedPairs: 0,
    pairCount: 1,
    rows: 1,
    tiles
});

const runWith = (tiles: Tile[], patch: Partial<RunState> = {}): RunState => {
    const run = createNewRun(0, { runSeed: 1234 });
    return {
        ...run,
        board: boardWith(tiles),
        status: 'resolving',
        ...patch,
        stats: {
            ...run.stats,
            ...(patch.stats ?? {})
        }
    };
};

describe('match claim rules', () => {
    it('derives findable and blind mimic route-special rewards for a matched pair', () => {
        const first = tile('a1', 'A', {
            findableKind: 'score_glint',
            routeSpecialKind: 'mimic_cache'
        });
        const second = tile('a2', 'A');
        const run = runWith([first, second], { lives: 1 });

        const context = deriveMatchClaimContext({
            firstTile: first,
            firstTileId: first.id,
            run,
            secondTile: second,
            secondTileId: second.id
        });

        expect(context.claimedFindableKind).toBe('score_glint');
        expect(context.findableScoreBonus).toBe(25);
        expect(context.findablesClaimedDelta).toBe(1);
        expect(context.claimedRouteCardKind).toBe('mimic_cache');
        expect(context.mimicCacheClaimed).toBe(true);
        expect(context.mimicCacheBite).toBe(true);
        expect(context.mimicCacheFatalBite).toBe(true);
        expect(context.routeCardReward.shopGold).toBe(1);
    });

    it('uses the non-wild pair key and reports wild usage when one matched tile is wild', () => {
        const first = tile('wild', WILD_PAIR_KEY);
        const second = tile('b1', 'B', { routeSpecialKind: 'loaded_gateway' });
        const run = runWith([first, second]);

        const context = deriveMatchClaimContext({
            firstTile: first,
            firstTileId: first.id,
            run,
            secondTile: second,
            secondTileId: second.id
        });

        expect(context.matchedPairKey).toBe('B');
        expect(context.usedWild).toBe(true);
        expect(context.loadedGatewayClaimed).toBe(true);
    });

    it('classifies dungeon trap and key rewards from matched dungeon card fields', () => {
        const trapA = tile('trap-a', 'T', {
            dungeonCardEffectId: 'trap_spikes',
            dungeonCardKind: 'trap',
            dungeonCardState: 'revealed'
        });
        const trapB = tile('trap-b', 'T', {
            dungeonCardEffectId: 'trap_spikes',
            dungeonCardKind: 'trap',
            dungeonCardState: 'revealed'
        });
        const trapRun = runWith([trapA, trapB]);

        const trapContext = deriveMatchClaimContext({
            firstTile: trapA,
            firstTileId: trapA.id,
            run: trapRun,
            secondTile: trapB,
            secondTileId: trapB.id
        });

        expect(trapContext.matchedDungeonKind).toBe('trap');
        expect(trapContext.dungeonTrapResolvedDelta).toBe(1);
        expect(trapContext.dungeonReward.score).toBe(10);
        expect(trapContext.dungeonReward.shopGold).toBe(1);

        const keyA = tile('key-a', 'K', {
            dungeonCardEffectId: 'key_iron',
            dungeonCardKind: 'key',
            dungeonKeyKind: 'treasure'
        });
        const keyB = tile('key-b', 'K', {
            dungeonCardEffectId: 'key_iron',
            dungeonCardKind: 'key'
        });
        const keyRun = runWith([keyA, keyB]);

        const keyContext = deriveMatchClaimContext({
            firstTile: keyA,
            firstTileId: keyA.id,
            run: keyRun,
            secondTile: keyB,
            secondTileId: keyB.id
        });

        expect(keyContext.matchedDungeonKind).toBe('key');
        expect(keyContext.matchedDungeonKeyKind).toBe('treasure');
        expect(keyContext.dungeonReward.keysHeldDelta).toBe(1);

        const nextKeyBoard = createMatchedPairClaimBoard({
            board: keyRun.board!,
            context: keyContext,
            firstTileId: keyA.id,
            secondTileId: keyB.id
        });
        expect(nextKeyBoard.dungeonKeysHeld).toBe(1);
        expect(nextKeyBoard.dungeonKeysHeldByKind).toEqual({ treasure: 1 });
    });

    it('decrements typed floor-held keys when a typed lock spends one', () => {
        const lockA = tile('lock-a', 'L', {
            dungeonCardEffectId: 'lock_cache',
            dungeonCardKind: 'lock',
            dungeonKeyKind: 'treasure'
        });
        const lockB = tile('lock-b', 'L', {
            dungeonCardEffectId: 'lock_cache',
            dungeonCardKind: 'lock',
            dungeonKeyKind: 'treasure'
        });
        const run = runWith([lockA, lockB], {
            board: {
                ...boardWith([lockA, lockB]),
                dungeonKeysHeld: 1,
                dungeonKeysHeldByKind: { treasure: 1 }
            }
        });
        const context = deriveMatchClaimContext({
            firstTile: lockA,
            firstTileId: lockA.id,
            run,
            secondTile: lockB,
            secondTileId: lockB.id
        });

        const nextBoard = createMatchedPairClaimBoard({
            board: run.board!,
            context,
            firstTileId: lockA.id,
            secondTileId: lockB.id
        });

        expect(context.dungeonReward.keysHeldDelta).toBe(-1);
        expect(nextBoard.dungeonKeysHeld).toBe(0);
        expect(nextBoard.dungeonKeysHeldByKind).toEqual({ treasure: 0 });
    });

    it('requires both matched tiles to be pinned before granting pin lattice reward', () => {
        const first = tile('p1', 'P', { routeSpecialKind: 'pin_lattice' });
        const second = tile('p2', 'P');
        const unpinnedRun = runWith([first, second], { pinnedTileIds: ['p1'] });
        const pinnedRun = runWith([first, second], { pinnedTileIds: ['p1', 'p2'] });

        expect(
            deriveMatchClaimContext({
                firstTile: first,
                firstTileId: first.id,
                run: unpinnedRun,
                secondTile: second,
                secondTileId: second.id
            }).pinLatticeRewarded
        ).toBe(false);
        expect(
            deriveMatchClaimContext({
                firstTile: first,
                firstTileId: first.id,
                run: pinnedRun,
                secondTile: second,
                secondTileId: second.id
            }).pinLatticeRewarded
        ).toBe(true);
    });

    it('creates the matched-pair board claim and clears claimed tile metadata', () => {
        const first = tile('a1', 'A', {
            dungeonCardEffectId: 'gateway_safe',
            dungeonCardKind: 'gateway',
            dungeonRouteType: 'safe',
            findableKind: 'score_glint',
            routeSpecialKind: 'loaded_gateway',
            routeSpecialRevealed: true,
            scoutRevealSource: 'omen_seal'
        });
        const second = tile('a2', 'A');
        const run = runWith([first, second]);
        const context = deriveMatchClaimContext({
            firstTile: first,
            firstTileId: first.id,
            run,
            secondTile: second,
            secondTileId: second.id
        });

        const nextBoard = createMatchedPairClaimBoard({
            board: run.board!,
            context,
            firstTileId: first.id,
            secondTileId: second.id
        });

        expect(nextBoard.flippedTileIds).toEqual([]);
        expect(nextBoard.matchedPairs).toBe(1);
        expect(nextBoard.selectedGatewayRouteType).toBe('safe');
        expect(nextBoard.tiles[0]).toMatchObject({ id: 'a1', state: 'matched' });
        expect(nextBoard.tiles[0]!.findableKind).toBeUndefined();
        expect(nextBoard.tiles[0]!.routeSpecialKind).toBeUndefined();
        expect(nextBoard.tiles[0]!.routeSpecialRevealed).toBeUndefined();
        expect(nextBoard.tiles[0]!.scoutRevealSource).toBeUndefined();
        expect(nextBoard.tiles[0]!.dungeonCardKind).toBeUndefined();
    });

    it('resets a gambit third tile while preserving sprung trap visibility', () => {
        const first = tile('a1', 'A');
        const second = tile('a2', 'A');
        const ordinaryThird = tile('b1', 'B');
        const sprungTrapThird = tile('trap', 'T', {
            dungeonCardKind: 'trap',
            dungeonCardState: 'resolved'
        });
        const run = runWith([first, second, ordinaryThird, sprungTrapThird]);
        const context = deriveMatchClaimContext({
            firstTile: first,
            firstTileId: first.id,
            run,
            secondTile: second,
            secondTileId: second.id
        });

        const hiddenThirdBoard = createMatchedPairClaimBoard({
            board: run.board!,
            context,
            firstTileId: first.id,
            secondTileId: second.id,
            thirdTileId: ordinaryThird.id
        });
        const sprungThirdBoard = createMatchedPairClaimBoard({
            board: run.board!,
            context,
            firstTileId: first.id,
            secondTileId: second.id,
            thirdTileId: sprungTrapThird.id
        });

        expect(hiddenThirdBoard.tiles.find((t) => t.id === ordinaryThird.id)?.state).toBe('hidden');
        expect(sprungThirdBoard.tiles.find((t) => t.id === sprungTrapThird.id)?.state).toBe('flipped');
    });
});
