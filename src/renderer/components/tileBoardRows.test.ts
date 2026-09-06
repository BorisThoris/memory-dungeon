import { describe, expect, it } from 'vitest';
import type { BoardState, Tile } from '../../shared/contracts';
import { DECOY_PAIR_KEY, WILD_PAIR_KEY } from '../../shared/tile-identity';
import {
    buildTileBoardEnemyHazardRows,
    buildTileBoardRows,
    getEnemyOccupiedTileIds,
    getTileBoardOverlayPrewarmDemandPairKeys,
    getTutorialPairOrdinalByKey
} from './tileBoardRows';

const tile = (id: string, pairKey: string, state: Tile['state'] = 'hidden', overrides: Partial<Tile> = {}): Tile => ({
    id,
    pairKey,
    symbol: id,
    label: id,
    state,
    ...overrides
});

const board = (tiles: Tile[], overrides: Partial<BoardState> = {}): BoardState =>
    ({
        level: 1,
        pairCount: Math.floor(tiles.length / 2),
        columns: 2,
        rows: Math.ceil(tiles.length / 2),
        tiles,
        flippedTileIds: [],
        matchedPairs: 0,
        floorArchetypeId: null,
        ...overrides
    }) as BoardState;

const rows = (input: Partial<Parameters<typeof buildTileBoardRows>[0]> = {}) => {
    const b = input.board ?? board([tile('a1', 'a'), tile('a2', 'a')]);
    return buildTileBoardRows({
        allowGambitThirdFlip: false,
        board: b,
        bountyPairKey: null,
        compact: false,
        cursedPairKey: null,
        debugPeekActive: false,
        destroyEligibleTileIds: new Set(),
        destroyPowerVisualActive: false,
        dimmedTileIds: undefined,
        interactive: true,
        nBackAnchorPairKey: null,
        nBackMutatorActive: false,
        pairProximityHintsEnabled: true,
        peekEligibleTileIds: new Set(),
        peekPowerVisualActive: false,
        peekRevealedTileIds: new Set(),
        pinModeBoardHintActive: false,
        pinnedTileIds: new Set(),
        previewActive: false,
        reduceMotion: true,
        runStatus: 'playing',
        shiftingSpotlightActive: false,
        showTutorialPairMarkers: true,
        silhouetteDuringPlay: false,
        strayEligibleTileIds: new Set(),
        strayPowerVisualActive: false,
        stickyBlockedTileId: null,
        tileSwapEligibleTileIds: new Set(),
        tileSwapFirstTileId: null,
        tileSwapPowerVisualActive: false,
        wardPairKey: null,
        wideRecallInPlay: false,
        ...input
    });
};

describe('tileBoardRows', () => {
    it('builds tutorial pair ordinals while skipping decoy and wild pair keys', () => {
        const b = board([
            tile('d', DECOY_PAIR_KEY),
            tile('w', WILD_PAIR_KEY),
            tile('b', 'beta'),
            tile('a', 'alpha')
        ]);

        expect([...getTutorialPairOrdinalByKey(b, true)!.entries()]).toEqual([
            ['alpha', 1],
            ['beta', 2]
        ]);
        expect(getTutorialPairOrdinalByKey(b, false)).toBeNull();
    });

    it('treats preview, debug, and peek reveal ids as face-up without changing tile state', () => {
        const b = board([tile('a1', 'a'), tile('b1', 'b'), tile('c1', 'c')]);

        expect(rows({ board: b, previewActive: true }).map((row) => row.faceUp)).toEqual([true, true, true]);
        expect(rows({ board: b, debugPeekActive: true }).map((row) => row.faceUp)).toEqual([true, true, true]);
        expect(rows({ board: b, peekRevealedTileIds: new Set(['b1']) }).map((row) => row.faceUp)).toEqual([
            false,
            true,
            false
        ]);
    });

    it('assigns hidden-back power accents with pin precedence and decoy destroy blocking', () => {
        const b = board([tile('decoy', DECOY_PAIR_KEY), tile('real', 'real'), tile('peek', 'peek')]);

        const destroyRows = rows({
            board: b,
            destroyEligibleTileIds: new Set(['decoy', 'real']),
            destroyPowerVisualActive: true
        });
        expect(destroyRows[0]!.destroyBlockedDecoyBack).toBe(true);
        expect(destroyRows[0]!.powerBackAccent).toBeNull();
        expect(destroyRows[1]!.powerBackAccent).toBe('destroy');

        const pinRows = rows({
            board: b,
            destroyEligibleTileIds: new Set(['real']),
            destroyPowerVisualActive: true,
            peekEligibleTileIds: new Set(['peek']),
            peekPowerVisualActive: true,
            pinModeBoardHintActive: true
        });
        expect(pinRows.map((row) => row.powerBackAccent)).toEqual(['pin', 'pin', 'pin']);

        const swapRows = rows({
            board: b,
            tileSwapEligibleTileIds: new Set(['real', 'peek']),
            tileSwapFirstTileId: 'real',
            tileSwapPowerVisualActive: true
        });
        expect(swapRows.map((row) => row.powerBackAccent)).toEqual([null, 'swapOrigin', 'swap']);
    });

    it('marks occupied hidden backs only for active enemy hazards', () => {
        const b = board([tile('a1', 'a'), tile('b1', 'b')], {
            enemyHazards: [
                {
                    id: 'active',
                    kind: 'stalker',
                    label: 'Stalker',
                    currentTileId: 'a1',
                    nextTileId: 'b1',
                    pattern: 'stalk',
                    state: 'revealed',
                    damage: 1,
                    hp: 1,
                    maxHp: 1
                },
                {
                    id: 'done',
                    kind: 'sentinel',
                    label: 'Sentinel',
                    currentTileId: 'b1',
                    nextTileId: 'a1',
                    pattern: 'patrol',
                    state: 'defeated',
                    damage: 1,
                    hp: 0,
                    maxHp: 1
                }
            ]
        });

        expect([...getEnemyOccupiedTileIds(b)]).toEqual(['a1']);
        expect(rows({ board: b }).map((row) => row.enemyOccupiedBack)).toEqual([true, false]);
    });

    it('builds enemy hazard render rows from active hazards with current and next transforms', () => {
        const b = board([tile('a1', 'a'), tile('b1', 'b'), tile('c1', 'c')], {
            enemyHazards: [
                {
                    id: 'active',
                    kind: 'warden',
                    label: 'Warden',
                    currentTileId: 'a1',
                    nextTileId: 'b1',
                    pattern: 'guard',
                    state: 'revealed',
                    damage: 1,
                    hp: 2,
                    maxHp: 2
                },
                {
                    id: 'missing',
                    kind: 'observer',
                    label: 'Observer',
                    currentTileId: 'missing',
                    nextTileId: 'c1',
                    pattern: 'observe',
                    state: 'revealed',
                    damage: 1,
                    hp: 1,
                    maxHp: 1
                },
                {
                    id: 'done',
                    kind: 'sentinel',
                    label: 'Sentinel',
                    currentTileId: 'c1',
                    nextTileId: 'a1',
                    pattern: 'patrol',
                    state: 'defeated',
                    damage: 1,
                    hp: 0,
                    maxHp: 1
                }
            ]
        });
        const rowModel = rows({ board: b });
        const hazardRows = buildTileBoardEnemyHazardRows(b, rowModel);

        expect(hazardRows).toHaveLength(1);
        expect(hazardRows[0]!.hazard.id).toBe('active');
        expect(hazardRows[0]!.currentTransform).toBe(rowModel[0]!.transform);
        expect(hazardRows[0]!.nextTransform).toBe(rowModel[1]!.transform);
    });

    it('does not render stale enemy hazards once all real pairs are cleared', () => {
        const b = board(
            [
                tile('a1', 'a', 'matched'),
                tile('a2', 'a', 'matched'),
                tile('b1', 'b', 'matched'),
                tile('b2', 'b', 'matched')
            ],
            {
                matchedPairs: 2,
                enemyHazards: [
                    {
                        id: 'stale-warden',
                        kind: 'warden',
                        label: 'Warden',
                        currentTileId: 'a1',
                        nextTileId: 'a2',
                        pattern: 'guard',
                        state: 'revealed',
                        damage: 1,
                        hp: 1,
                        maxHp: 2,
                        bossId: 'trap_warden'
                    }
                ]
            }
        );
        const rowModel = rows({ board: b });

        expect([...getEnemyOccupiedTileIds(b)]).toEqual([]);
        expect(rowModel.map((row) => row.enemyOccupiedBack)).toEqual([false, false, false, false]);
        expect(buildTileBoardEnemyHazardRows(b, rowModel)).toEqual([]);
    });

    it('collects overlay prewarm pair keys from face-up, resolving, and pickable rows', () => {
        const b = board(
            [
                tile('a1', 'a', 'flipped'),
                tile('a2', 'a'),
                tile('b1', 'b'),
                tile('b2', 'b'),
                tile('c1', 'c'),
                tile('c2', 'c')
            ],
            {
                flippedTileIds: ['a1']
            }
        );
        const rowModel = rows({ board: b, peekRevealedTileIds: new Set(['b1']) });

        expect(getTileBoardOverlayPrewarmDemandPairKeys(rowModel, false, true, false)).toEqual(['a', 'b', 'c']);
        expect(getTileBoardOverlayPrewarmDemandPairKeys(rowModel, true, true, false)).toEqual(['a', 'b']);
    });

    it('surfaces sticky, presentation, spotlight, and hidden-card accents from row state', () => {
        const b = board([
            tile('a1', 'a', 'matched'),
            tile('b1', 'b', 'flipped'),
            tile('c1', 'c', 'hidden', { tileHazardKind: 'fuse_cache', routeCardKind: 'greed_cache' }),
            tile('d1', 'd', 'hidden', { dungeonCardKind: 'trap' })
        ]);

        const result = rows({
            board: b,
            bountyPairKey: 'd',
            nBackAnchorPairKey: 'b',
            nBackMutatorActive: true,
            shiftingSpotlightActive: true,
            silhouetteDuringPlay: true,
            stickyBlockedTileId: 'a1',
            wardPairKey: 'c',
            wideRecallInPlay: true
        });

        expect(result[0]!.stickyFingerSlotMark).toBe(true);
        expect(result[1]!.presentationWideRecall).toBe(true);
        expect(result[1]!.presentationSilhouette).toBe(true);
        expect(result[1]!.presentationNBackAnchor).toBe(true);
        expect(result[2]!.spotlightWardOnBack).toBe(true);
        expect(result[2]!.hazardBackAccent).toBe('fuse_cache');
        expect(result[2]!.routeBackAccent).toBe(true);
        expect(result[3]!.spotlightBountyOnBack).toBe(true);
        expect(result[3]!.objectiveBackAccent).toBe(true);
    });

    it('marks hidden cards that have actionable trait combo routes', () => {
        const b = board([
            tile('echo-a', 'echo', 'hidden', { tileTraitKind: 'echo' }),
            tile('sealed-a', 'sealed', 'hidden', { tileTraitKind: 'sealed' }),
            tile('plain-a', 'plain')
        ]);

        const result = rows({ board: b });

        expect(result.map((row) => row.traitComboBack)).toEqual([true, true, false]);
        expect(result.map((row) => row.traitComboSurgeBack)).toEqual([false, false, false]);
        expect(result.map((row) => row.traitRouteBeatTier)).toEqual(['route', 'route', null]);
        expect(result.map((row) => row.traitRouteCadence)).toEqual(['route', 'route', 'none']);
        expect(result.map((row) => row.traitRouteCadenceAction)).toEqual(['Match route', 'Match route', null]);
        expect(result[0]!.traitInteractionPreviewLines).toContain('Echo + Sealed: combo shard');
        expect(result[0]!.traitLaneBack).toBe('shard');
        expect(result[1]!.traitLaneBack).toBeNull();
        expect(result[2]!.traitLaneBack).toBeNull();
    });

    it('marks hidden trait cards as combo surge cards when multiple trait routes are live', () => {
        const b = board([
            tile('echo-a', 'echo', 'hidden', { tileTraitKind: 'echo' }),
            tile('sealed-a', 'sealed', 'hidden', { tileTraitKind: 'sealed' }),
            tile('mirror-a', 'mirror', 'hidden', { tileTraitKind: 'mirror' }),
            tile('conduit-a', 'conduit', 'hidden', { tileTraitKind: 'conduit' })
        ]);

        const result = rows({ board: b });

        expect(result.map((row) => row.traitComboBack)).toEqual([true, true, true, true]);
        expect(result.map((row) => row.traitComboSurgeBack)).toEqual([true, true, true, true]);
        expect(result.map((row) => row.traitRouteBeatTier)).toEqual(['surge', 'surge', 'surge', 'surge']);
        expect(result.map((row) => row.traitRouteCadence)).toEqual(['surge', 'surge', 'surge', 'surge']);
        expect(result.map((row) => row.traitRouteCadenceAction)).toEqual([
            'Route surge',
            'Route surge',
            'Route surge',
            'Route surge'
        ]);
        expect(result.map((row) => row.traitLaneBack)).toEqual(['shard', 'shard', null, 'shard']);
    });

    it('derives guard lane markers from per-card mirror and stasis interaction previews', () => {
        const b = board([
            tile('mirror-a', 'mirror', 'hidden', { tileTraitKind: 'mirror' }),
            tile('stasis-a', 'stasis', 'hidden', { tileTraitKind: 'stasis' }),
            tile('plain-a', 'plain')
        ]);

        const result = rows({ board: b });

        expect(result.map((row) => row.traitComboBack)).toEqual([true, true, false]);
        expect(result.map((row) => row.traitLaneBack)).toEqual(['guard', null, null]);
    });

    it('marks ready trait cards as chain reward hot when the board model supplies hot ids', () => {
        const b = board([
            tile('echo-a', 'echo', 'hidden', { tileTraitKind: 'echo' }),
            tile('sealed-a', 'sealed', 'hidden', { tileTraitKind: 'sealed' }),
            tile('plain-a', 'plain')
        ]);

        const result = rows({
            board: b,
            traitRewardHotTileIds: new Set(['echo-a', 'sealed-a'])
        });

        expect(result.map((row) => row.traitRewardHotBack)).toEqual([true, true, false]);
        expect(result.map((row) => row.traitRouteReadabilityIntensity)).toEqual(['stack', 'stack', 'none']);
        expect(result.map((row) => row.traitRouteBeatTier)).toEqual(['cashout', 'cashout', null]);
        expect(result.map((row) => row.traitRouteCadence)).toEqual(['cashout', 'cashout', 'none']);
        expect(result.map((row) => row.traitRouteCadenceAction)).toEqual(['Cash now', 'Cash now', null]);
    });

    it('marks setup and follow-up card beat tiers without needing HUD aggregation', () => {
        const b = board(
            [
                tile('echo-a', 'echo', 'flipped', { tileTraitKind: 'echo' }),
                tile('sealed-a', 'sealed', 'hidden', { tileTraitKind: 'sealed' }),
                tile('route-a', 'route', 'hidden'),
                tile('perk-a', 'perk', 'hidden')
            ],
            { flippedTileIds: ['echo-a'] }
        );

        const result = rows({
            board: b,
            perkArmedTileIds: new Set(['perk-a']),
            selectedTraitFollowupTileIds: new Set(['sealed-a']),
            traitRouteTargetTileIds: new Set(['route-a'])
        });

        expect(result.map((row) => row.traitRouteBeatTier)).toEqual([null, 'follow-up', 'setup', 'setup']);
        expect(result.map((row) => row.traitRouteReadabilityIntensity)).toEqual(['none', 'ready', 'setup', 'setup']);
        expect(result.map((row) => row.traitRouteCadence)).toEqual(['none', 'follow-up', 'prime', 'prime']);
        expect(result.map((row) => row.traitRouteCadenceAction)).toEqual([null, 'Next tap', 'Prime payoff', 'Prime payoff']);
    });

    it('marks hidden cards targeted by an armed reward perk payoff', () => {
        const b = board([
            tile('cursed-a', 'cursed', 'hidden', { tileTraitKind: 'cursed' }),
            tile('echo-a', 'echo', 'hidden', { tileTraitKind: 'echo' }),
            tile('plain-a', 'plain')
        ]);

        const result = rows({
            board: b,
            perkArmedTileIds: new Set(['cursed-a'])
        });

        expect(result.map((row) => row.perkArmedBack)).toEqual([true, false, false]);
    });

    it('marks the hidden matching mate as a selected trait followup after one combo trait card is flipped', () => {
        const b = board([
            tile('echo-a', 'echo', 'flipped', { tileTraitKind: 'echo' }),
            tile('sealed-a', 'sealed', 'hidden', { tileTraitKind: 'sealed' }),
            tile('echo-b', 'echo', 'hidden', { tileTraitKind: 'echo' }),
            tile('plain-a', 'plain')
        ]);

        const result = rows({ board: { ...b, flippedTileIds: ['echo-a'] } });

        expect(result.map((row) => row.selectedTraitFollowupBack)).toEqual([false, false, true, false]);
    });

    it('carries semantic trait lane labels and actions for hidden payoff routes', () => {
        const b = board([
            tile('echo-a', 'echo', 'hidden', { tileTraitKind: 'echo' }),
            tile('sealed-a', 'sealed', 'hidden', { tileTraitKind: 'sealed' }),
            tile('plain-a', 'plain')
        ]);

        const result = rows({ board: b });

        expect(result[0]).toMatchObject({
            traitLaneAction: 'Cash shard',
            traitLaneBack: 'shard',
            traitLaneLabel: 'Shard'
        });
        expect(result[1]).toMatchObject({
            traitLaneAction: null,
            traitLaneBack: null,
            traitLaneLabel: null
        });
        expect(result[2]).toMatchObject({
            traitLaneAction: null,
            traitLaneBack: null,
            traitLaneLabel: null
        });
    });

    it('marks plain hidden cards that are swap targets for trait chain setup', () => {
        const b = board([
            tile('sealed-a', 'sealed', 'hidden', { tileTraitKind: 'sealed' }),
            tile('plain-a', 'plain'),
            tile('origin-a', 'origin'),
            tile('heavy-a', 'heavy', 'hidden', { tileTraitKind: 'heavy' })
        ]);

        const result = rows({
            board: b,
            traitRouteTargetTileIds: new Set(['sealed-a', 'plain-a'])
        });

        expect(result.map((row) => row.traitRouteTargetBack)).toEqual([true, true, false, false]);
        expect(result[1]!.tile.tileTraitKind).toBeUndefined();
    });
});

describe('pair distance after a chunk break', () => {
    // The rows are rebuilt from the live board on every render, so the frame that removes the
    // chunk is the frame every badge is recomputed in. This pins that: a flipped tile reads the
    // distance across the gap, a tile that left has no badge, and nothing is read from a stale board.
    it('recomputes every badge from the board the chunk left behind', () => {
        const before = board(
            [
                tile('a1', 'a', 'flipped'),
                tile('b1', 'b'),
                tile('b2', 'b'),
                tile('a2', 'a'),
                tile('c1', 'c'),
                tile('c2', 'c')
            ],
            { columns: 2, rows: 3, flippedTileIds: ['a1'] }
        );
        const beforeRows = rows({ board: before }).flat();
        expect(beforeRows.find((row) => row.tile.id === 'a1')?.pairProximityDistance).toBe(2);

        const after = board(
            before.tiles.map((t) => (t.pairKey === 'b' ? { ...t, state: 'removed' as const, brokenByChunk: true } : t)),
            { columns: 2, rows: 3, flippedTileIds: ['a1'] }
        );
        const afterRows = rows({ board: after }).flat();
        expect(afterRows.find((row) => row.tile.id === 'a1')?.pairProximityDistance).toBe(2);
        expect(afterRows.find((row) => row.tile.id === 'b1')?.pairProximityDistance).toBeNull();
        expect(afterRows.find((row) => row.tile.id === 'b2')?.pairProximityDistance).toBeNull();
    });
});
