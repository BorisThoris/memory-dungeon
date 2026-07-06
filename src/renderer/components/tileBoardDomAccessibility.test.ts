import { describe, expect, it } from 'vitest';
import type { BoardState } from '../../shared/contracts';
import {
    getBoardChainAccessibilitySummary,
    getDungeonCardText,
    getEnemyHazardText,
    getFocusedTileLiveLabel,
    getHazardTileText,
    getPairProximityLabel,
    getPickableTileIds,
    getPowerTargetAriaText,
    getTileBeatAccessibilityText,
    getTileAriaLabel,
    getTilePosition,
    getTileTraitPreviewText,
    gridIndexFromTileId,
    moveFocusInGrid
} from './tileBoardDomAccessibility';

const board: BoardState = {
    level: 1,
    pairCount: 2,
    columns: 2,
    rows: 2,
    matchedPairs: 0,
    flippedTileIds: [],
    floorArchetypeId: null,
    featuredObjectiveId: null,
    tiles: [
        { id: 'a1', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
        { id: 'a2', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
        { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' },
        { id: 'b2', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' }
    ]
};

describe('tile board DOM accessibility helpers', () => {
    it('maps tile indexes to one-based grid positions', () => {
        expect(getTilePosition(0, 2)).toEqual({ row: 1, column: 1 });
        expect(getTilePosition(3, 2)).toEqual({ row: 2, column: 2 });
    });

    it('builds hidden and face-up tile labels with route, hazard, scout, and enemy context', () => {
        const labelledBoard: BoardState = {
            ...board,
            enemyHazards: [
                {
                    id: 'enemy-a',
                    kind: 'sentinel',
                    label: 'Sentinel',
                    currentTileId: 'a1',
                    nextTileId: 'b1',
                    pattern: 'patrol',
                    state: 'revealed',
                    damage: 1,
                    hp: 2,
                    maxHp: 3
                }
            ],
            tiles: [
                {
                    ...board.tiles[0]!,
                    state: 'flipped',
                    routeCardKind: 'greed_cache',
                    tileTraitKind: 'volatile',
                    tileHazardKind: 'shuffle_snare',
                    scoutRevealSource: 'omen_seal'
                },
                ...board.tiles.slice(1)
            ]
        };
        const label = getTileAriaLabel(labelledBoard, labelledBoard.tiles[0]!, true, 1, 1);

        expect(label).toContain('Tile A, row 1, column 1');
        expect(label).toContain('Route card: Greed cache.');
        expect(label).toContain('Hazard tile:');
        expect(label).toContain('Trait: Volatile.');
        expect(label).toContain('Scouted by Omen Seal.');
        expect(label).toContain('Occupied by revealed moving enemy patrol Sentinel, 2/3 HP, 1 damage.');
        expect(getEnemyHazardText(labelledBoard, 'b1')).toContain('Next target of moving enemy patrol Sentinel');
    });

    it('does not announce stale moving enemy patrols on cleared boards', () => {
        const clearedBoard: BoardState = {
            ...board,
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
            ],
            tiles: board.tiles.map((tile) => ({ ...tile, state: 'matched' }))
        };

        expect(getEnemyHazardText(clearedBoard, 'a1')).toBe('');
        expect(getEnemyHazardText(clearedBoard, 'a2')).toBe('');
    });

    it('announces terminal fallback primary exits as open instead of still key locked', () => {
        const exitTile = {
            id: 'exit',
            pairKey: '__exit__',
            symbol: 'E',
            label: 'Iron Gate',
            state: 'flipped' as const,
            dungeonCardKind: 'exit' as const,
            dungeonExitLockKind: 'iron' as const
        };
        const exitBoard: BoardState = {
            ...board,
            pairCount: 1,
            matchedPairs: 1,
            dungeonExitTileId: 'exit',
            dungeonExitLockKind: 'iron',
            dungeonKeysHeld: 0,
            tiles: [
                { id: 'a1', pairKey: 'A', symbol: 'A', label: 'A', state: 'matched' },
                { id: 'a2', pairKey: 'A', symbol: 'A', label: 'A', state: 'matched' },
                exitTile
            ]
        };

        const label = getTileAriaLabel(exitBoard, exitTile, true, 2, 1);

        expect(label).toContain('Can be opened once revealed');
        expect(label).not.toContain('Requires iron key');
    });

    it('announces pending key fallback primary exits as pair-clear gates', () => {
        const exitTile = {
            id: 'exit',
            pairKey: '__exit__',
            symbol: 'E',
            label: 'Iron Gate',
            state: 'flipped' as const,
            dungeonCardKind: 'exit' as const,
            dungeonExitLockKind: 'iron' as const
        };
        const exitBoard: BoardState = {
            ...board,
            pairCount: 1,
            matchedPairs: 0,
            dungeonExitTileId: 'exit',
            dungeonExitLockKind: 'iron',
            dungeonKeysHeld: 0,
            tiles: [
                { id: 'a1', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
                { id: 'a2', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
                exitTile
            ]
        };

        const label = getTileAriaLabel(exitBoard, exitTile, true, 2, 1);

        expect(label).toContain('No key source remains; clear remaining pairs to force this exit open.');
        expect(label).not.toContain('Requires iron key');
    });

    it('describes board power target validity', () => {
        const hidden = board.tiles[0]!;
        expect(
            getPowerTargetAriaText(hidden, true, new Set(['a1']), false, new Set(), false, new Set(), false, new Set(), null)
        ).toContain(
            'Destroy target: valid'
        );
        expect(
            getPowerTargetAriaText(hidden, false, new Set(), true, new Set(['a1']), false, new Set(), false, new Set(), null)
        ).toContain(
            'Peek target: valid'
        );
        expect(
            getPowerTargetAriaText(hidden, false, new Set(), false, new Set(), true, new Set(['a1']), false, new Set(), null)
        ).toContain(
            'Stray target: valid'
        );
        expect(
            getPowerTargetAriaText(hidden, false, new Set(), false, new Set(), false, new Set(), true, new Set(['a1']), null)
        ).toContain('Swap target: valid');
        expect(
            getPowerTargetAriaText(hidden, false, new Set(), false, new Set(), false, new Set(), true, new Set(['a1']), 'a1')
        ).toContain('Swap origin selected');
    });

    it('announces nearby trait interactions and swap-created trait previews', () => {
        const traitBoard: BoardState = {
            ...board,
            tiles: [
                { ...board.tiles[0]!, pairKey: 'echo', tileTraitKind: 'echo' },
                { ...board.tiles[1]!, pairKey: 'sealed', tileTraitKind: 'sealed' },
                board.tiles[2]!,
                board.tiles[3]!
            ]
        };

        expect(getTileTraitPreviewText(traitBoard, traitBoard.tiles[0]!)).toContain('Echo + Sealed: combo shard');
        expect(getTileTraitPreviewText(traitBoard, traitBoard.tiles[0]!)).toContain('Chain-ready trait card');
        expect(getTileTraitPreviewText(traitBoard, traitBoard.tiles[0]!)).toContain('Match now');
        expect(getTileBeatAccessibilityText(traitBoard, traitBoard.tiles[0]!, false)).toBe(
            ' Beat: route. Action: Match route. 3-beat pulse. Match to build chain.'
        );
        expect(getTileAriaLabel(traitBoard, traitBoard.tiles[0]!, true, 1, 1)).toContain(
            'Match now: Echo + Sealed: combo shard'
        );
        expect(getTileAriaLabel(traitBoard, traitBoard.tiles[0]!, false, 1, 1)).toContain(
            'Beat: route. Action: Match route. 3-beat pulse. Match to build chain.'
        );
        expect(getTileTraitPreviewText(traitBoard, traitBoard.tiles[1]!)).toContain('Echo + Sealed: combo shard');
        expect(getTileAriaLabel(traitBoard, traitBoard.tiles[1]!, true, 1, 2)).toContain(
            'Echo + Sealed: combo shard'
        );
        const comboSurgeBoard: BoardState = {
            ...board,
            tiles: [
                { id: 'echo', pairKey: 'echo', symbol: 'E', label: 'Echo', state: 'hidden', tileTraitKind: 'echo' },
                { id: 'sealed', pairKey: 'sealed', symbol: 'S', label: 'Sealed', state: 'hidden', tileTraitKind: 'sealed' },
                { id: 'mirror', pairKey: 'mirror', symbol: 'M', label: 'Mirror', state: 'hidden', tileTraitKind: 'mirror' },
                { id: 'conduit', pairKey: 'conduit', symbol: 'C', label: 'Conduit', state: 'hidden', tileTraitKind: 'conduit' }
            ]
        };
        expect(getTileTraitPreviewText(comboSurgeBoard, comboSurgeBoard.tiles[1]!)).toContain(
            'Combo-surge trait card'
        );
        const comboSurgeLabel = getTileAriaLabel(comboSurgeBoard, comboSurgeBoard.tiles[1]!, false, 1, 2);
        expect(comboSurgeLabel).toContain('Combo-surge trait card');
        expect(comboSurgeLabel).toContain('Sealed + Conduit: shard spark');
        expect(comboSurgeLabel).toContain('Conduit: adjacent trait charge');
        expect(comboSurgeLabel).toContain('Beat: surge. Action: Route surge. 4-beat pulse. Multiple trait routes are live.');
        const swapBoard: BoardState = {
            ...board,
            tiles: [
                { id: 's1', pairKey: 'sealed', symbol: 'S', label: 'Sealed', state: 'hidden', tileTraitKind: 'sealed' },
                { id: 'f1', pairKey: 'filler', symbol: 'F', label: 'Filler', state: 'hidden' },
                { id: 'x1', pairKey: 'origin', symbol: 'O', label: 'Origin', state: 'hidden' },
                { id: 'h1', pairKey: 'heavy', symbol: 'H', label: 'Heavy', state: 'hidden', tileTraitKind: 'heavy' }
            ]
        };

        expect(
            getPowerTargetAriaText(
                swapBoard.tiles[0]!,
                false,
                new Set(),
                false,
                new Set(),
                false,
                new Set(),
                true,
                new Set(['s1']),
                'x1',
                swapBoard
            )
        ).toContain(
            'Chain prime target. Swap preview: Creates trait route: Sealed + Heavy: score surge; Sealed + Heavy: score surge.'
        );

        expect(
            getFocusedTileLiveLabel({
                board: swapBoard,
                debugPeekActive: false,
                destroyEligibleTileIds: new Set(),
                destroyPowerVisualActive: false,
                focusedTileId: 's1',
                pairProximityHintsEnabled: true,
                peekEligibleTileIds: new Set(),
                peekPowerVisualActive: false,
                peekRevealedTileIds: new Set(),
                previewActive: false,
                runStatus: 'playing',
                strayEligibleTileIds: new Set(),
                strayPowerVisualActive: false,
                tileSwapEligibleTileIds: new Set(),
                tileSwapFirstTileId: null,
                tileSwapPowerVisualActive: false,
                traitRouteHintText: 'Swap Sealed with Filler: Sealed + Heavy: score surge',
                traitRouteTargetTileIds: ['s1', 'f1']
            })
        ).toContain('Chain prime target. Swap Sealed with Filler: Sealed + Heavy: score surge.');
        expect(
            getFocusedTileLiveLabel({
                board: swapBoard,
                debugPeekActive: false,
                destroyEligibleTileIds: new Set(),
                destroyPowerVisualActive: false,
                focusedTileId: 's1',
                pairProximityHintsEnabled: true,
                peekEligibleTileIds: new Set(),
                peekPowerVisualActive: false,
                peekRevealedTileIds: new Set(),
                previewActive: false,
                runStatus: 'playing',
                strayEligibleTileIds: new Set(),
                strayPowerVisualActive: false,
                tileSwapEligibleTileIds: new Set(),
                tileSwapFirstTileId: null,
                tileSwapPowerVisualActive: false,
                traitRouteHintText: 'Swap Sealed with Filler: Sealed + Heavy: score surge',
                traitRouteTargetTileIds: ['s1', 'f1']
            })
        ).toContain('Beat: prime. Action: Prime payoff. 2-beat pulse. Set this route up.');

        expect(
            getFocusedTileLiveLabel({
                board: traitBoard,
                debugPeekActive: false,
                destroyEligibleTileIds: new Set(),
                destroyPowerVisualActive: false,
                focusedTileId: 'a1',
                pairProximityHintsEnabled: true,
                peekEligibleTileIds: new Set(),
                peekPowerVisualActive: false,
                peekRevealedTileIds: new Set(),
                previewActive: false,
                runStatus: 'playing',
                strayEligibleTileIds: new Set(),
                strayPowerVisualActive: false,
                tileSwapEligibleTileIds: new Set(),
                tileSwapFirstTileId: null,
                tileSwapPowerVisualActive: false,
                traitRewardHotText: 'Next reward x6 +1 shard in 1 match',
                traitRewardHotTileIds: ['a1', 'a2']
            })
        ).toContain('Best chain play. Chain reward hot. Next reward x6 +1 shard in 1 match');
        expect(
            getFocusedTileLiveLabel({
                board: traitBoard,
                debugPeekActive: false,
                destroyEligibleTileIds: new Set(),
                destroyPowerVisualActive: false,
                focusedTileId: 'a1',
                pairProximityHintsEnabled: true,
                peekEligibleTileIds: new Set(),
                peekPowerVisualActive: false,
                peekRevealedTileIds: new Set(),
                previewActive: false,
                runStatus: 'playing',
                strayEligibleTileIds: new Set(),
                strayPowerVisualActive: false,
                tileSwapEligibleTileIds: new Set(),
                tileSwapFirstTileId: null,
                tileSwapPowerVisualActive: false,
                traitRewardHotText: 'Next reward x6 +1 shard in 1 match',
                traitRewardHotTileIds: ['a1', 'a2']
            })
        ).toContain('Beat: cashout. Action: Cash now. 5-beat pulse. Hit this route now.');

        const selectedTraitBoard: BoardState = {
            ...board,
            flippedTileIds: ['a1'],
            tiles: [
                { id: 'a1', pairKey: 'echo', symbol: 'E', label: 'Echo', state: 'flipped', tileTraitKind: 'echo' },
                { id: 's1', pairKey: 'sealed', symbol: 'S', label: 'Sealed', state: 'hidden', tileTraitKind: 'sealed' },
                { id: 'a2', pairKey: 'echo', symbol: 'E', label: 'Echo', state: 'hidden', tileTraitKind: 'echo' },
                { id: 'b2', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' }
            ]
        };

        expect(
            getFocusedTileLiveLabel({
                board: selectedTraitBoard,
                debugPeekActive: false,
                destroyEligibleTileIds: new Set(),
                destroyPowerVisualActive: false,
                focusedTileId: 'a2',
                pairProximityHintsEnabled: true,
                peekEligibleTileIds: new Set(),
                peekPowerVisualActive: false,
                peekRevealedTileIds: new Set(),
                previewActive: false,
                runStatus: 'playing',
                strayEligibleTileIds: new Set(),
                strayPowerVisualActive: false,
                tileSwapEligibleTileIds: new Set(),
                tileSwapFirstTileId: null,
                tileSwapPowerVisualActive: false
            })
        ).toContain('Selected chain follow-up. Match this mate to keep the trait route moving.');
        expect(
            getFocusedTileLiveLabel({
                board: selectedTraitBoard,
                debugPeekActive: false,
                destroyEligibleTileIds: new Set(),
                destroyPowerVisualActive: false,
                focusedTileId: 'a2',
                pairProximityHintsEnabled: true,
                peekEligibleTileIds: new Set(),
                peekPowerVisualActive: false,
                peekRevealedTileIds: new Set(),
                previewActive: false,
                runStatus: 'playing',
                strayEligibleTileIds: new Set(),
                strayPowerVisualActive: false,
                tileSwapEligibleTileIds: new Set(),
                tileSwapFirstTileId: null,
                tileSwapPowerVisualActive: false
            })
        ).toContain('Beat: follow-up. Action: Next tap. 3-beat pulse. Tap next to keep the route moving.');

        const armedSwapLabel = getFocusedTileLiveLabel({
            board: swapBoard,
            debugPeekActive: false,
            destroyEligibleTileIds: new Set(),
            destroyPowerVisualActive: false,
            focusedTileId: 's1',
            pairProximityHintsEnabled: true,
            peekEligibleTileIds: new Set(),
            peekPowerVisualActive: false,
            peekRevealedTileIds: new Set(),
            previewActive: false,
            runStatus: 'playing',
            strayEligibleTileIds: new Set(),
            strayPowerVisualActive: false,
            tileSwapEligibleTileIds: new Set(['s1']),
            tileSwapFirstTileId: 'x1',
            tileSwapPowerVisualActive: true,
            traitRouteHintText: 'Swap Sealed with Filler: Sealed + Heavy: score surge',
            traitRouteTargetTileIds: ['s1', 'f1']
        });
        expect(armedSwapLabel).toContain('Swap target: valid');
        expect(armedSwapLabel).toContain('Swap preview: Creates trait route: Sealed + Heavy: score surge');
        expect(armedSwapLabel).not.toContain('Chain prime target. Swap Sealed with Filler');
    });

    it('summarizes board-level chain readability for cashout, surge, setup, and idle states', () => {
        const traitBoard: BoardState = {
            ...board,
            tiles: [
                { id: 'echo', pairKey: 'echo', symbol: 'E', label: 'Echo', state: 'hidden', tileTraitKind: 'echo' },
                { id: 'sealed', pairKey: 'sealed', symbol: 'S', label: 'Sealed', state: 'hidden', tileTraitKind: 'sealed' },
                { id: 'mirror', pairKey: 'mirror', symbol: 'M', label: 'Mirror', state: 'hidden', tileTraitKind: 'mirror' },
                { id: 'conduit', pairKey: 'conduit', symbol: 'C', label: 'Conduit', state: 'hidden', tileTraitKind: 'conduit' }
            ]
        };

        expect(
            getBoardChainAccessibilitySummary(traitBoard, {
                rewardHotText: 'Next reward x6 +1 shard in 1 match',
                rewardHotTileIds: new Set(['echo', 'sealed']),
                sequenceText: 'Sequence: First match lit route. Then cash reward. Keep chain target live'
            })
        ).toMatchObject({
            label: expect.stringContaining('Chain board: Ready x4, Surge x4, Payoff x2, Hot x2. Next: Next reward x6 +1 shard in 1 match. Sequence: First match lit route. Then cash reward. Keep chain target live.'),
            payoffStackCount: 2,
            readyCount: 4,
            rewardHotCount: 2,
            setupCount: 0,
            surgeCount: 4,
            tone: 'cashout'
        });

        expect(getBoardChainAccessibilitySummary(traitBoard)).toMatchObject({
            label: expect.stringContaining('Surge x4. Next: Combo surge ready: Echo + Sealed: combo shard.'),
            primaryLine: 'Echo + Sealed: combo shard',
            secondaryLine: 'Echo + Mirror: recall focus',
            followupCount: 0,
            readyCount: 4,
            rewardHotCount: 0,
            setupCount: 0,
            surgeCount: 4,
            tone: 'surge'
        });

        const selectedFollowupBoard: BoardState = {
            ...board,
            flippedTileIds: ['echo-a'],
            tiles: [
                { id: 'echo-a', pairKey: 'echo', symbol: 'E', label: 'Echo', state: 'flipped', tileTraitKind: 'echo' },
                { id: 'sealed-a', pairKey: 'sealed', symbol: 'S', label: 'Sealed', state: 'hidden', tileTraitKind: 'sealed' },
                { id: 'echo-b', pairKey: 'echo', symbol: 'E', label: 'Echo', state: 'hidden', tileTraitKind: 'echo' },
                board.tiles[3]!
            ]
        };

        expect(getBoardChainAccessibilitySummary(selectedFollowupBoard)).toMatchObject({
            label: expect.stringContaining(
                'Chain board: Ready x2, Follow-up x1. Next: follow up the marked mate: Echo + Sealed: combo shard.'
            ),
            primaryLine: '1 selected follow-up',
            followupCount: 1,
            readyCount: 2,
            rewardHotCount: 0,
            setupCount: 0,
            surgeCount: 0,
            tone: 'ready'
        });

        expect(
            getBoardChainAccessibilitySummary(board, {
                hintText: 'Swap toward Sealed + Heavy',
                targetTileIds: new Set(['a1', 'b2'])
            })
        ).toMatchObject({
            label: 'Chain board: Prime x2. Next: Swap toward Sealed + Heavy.',
            readyCount: 0,
            primaryLine: 'Match or move traits together to light a route.',
            rewardHotCount: 0,
            setupCount: 2,
            surgeCount: 0,
            tone: 'setup'
        });

        const setupBoard: BoardState = {
            ...board,
            tiles: [
                { id: 's1', pairKey: 'sealed', symbol: 'S', label: 'Sealed', state: 'hidden', tileTraitKind: 'sealed' },
                { id: 'f1', pairKey: 'filler', symbol: 'F', label: 'Filler', state: 'hidden' },
                { id: 'x1', pairKey: 'origin', symbol: 'O', label: 'Origin', state: 'hidden' },
                { id: 'h1', pairKey: 'heavy', symbol: 'H', label: 'Heavy', state: 'hidden', tileTraitKind: 'heavy' }
            ]
        };

        expect(getBoardChainAccessibilitySummary(setupBoard)).toMatchObject({
            label: 'Chain board: Prime x2. Next: One swap primes route: Swap Sealed with Filler: Sealed + Heavy: score surge.',
            primaryLine: 'Swap Sealed with Filler: Sealed + Heavy: score surge',
            secondaryLine: null,
            readyCount: 0,
            rewardHotCount: 0,
            setupCount: 2,
            surgeCount: 0,
            tone: 'setup'
        });

        expect(getBoardChainAccessibilitySummary(board)).toMatchObject({
            label: 'Chain board: no lit cards. Next: no chain routes are lit.',
            tone: 'idle'
        });
    });

    it('collects pickable tiles and moves keyboard focus across available grid slots', () => {
        const blockedBoard: BoardState = {
            ...board,
            tiles: [
                board.tiles[0]!,
                { ...board.tiles[1]!, state: 'removed' },
                board.tiles[2]!,
                board.tiles[3]!
            ]
        };

        expect(getPickableTileIds(blockedBoard, true, false)).toEqual(['a1', 'b1', 'b2']);
        expect(moveFocusInGrid(blockedBoard, 'a1', 'right', true, false)).toBe('a1');
        expect(moveFocusInGrid(blockedBoard, 'a1', 'down', true, false)).toBe('b1');
        expect(moveFocusInGrid(blockedBoard, 'b1', 'right', true, false)).toBe('b2');
    });

    it('exposes leaf text helpers used by keyboard and DOM board renderers', () => {
        const dungeonTile = {
            ...board.tiles[0]!,
            state: 'flipped' as const,
            dungeonCardKind: 'exit' as const,
            dungeonExitLockKind: 'none' as const
        };
        const hazardTile = { ...board.tiles[1]!, tileHazardKind: 'shuffle_snare' as const };
        const proximityBoard: BoardState = {
            ...board,
            flippedTileIds: ['a1'],
            tiles: [{ ...board.tiles[0]!, state: 'flipped' }, ...board.tiles.slice(1)]
        };

        expect(getDungeonCardText(dungeonTile, board)).toContain('Can be opened once revealed');
        expect(getHazardTileText(hazardTile)).toContain('Hazard tile:');
        expect(gridIndexFromTileId(board, 'b2')).toBe(3);
        expect(gridIndexFromTileId(board, 'missing')).toBe(0);
        expect(getPairProximityLabel(proximityBoard, proximityBoard.tiles[0]!, true, true)).toBe('1');
        expect(getPairProximityLabel(proximityBoard, proximityBoard.tiles[0]!, false, true)).toBeNull();
    });

    it('builds the focused tile live label with power targeting and pair proximity copy', () => {
        const focusedBoard: BoardState = {
            ...board,
            flippedTileIds: ['a1'],
            tiles: [
                { ...board.tiles[0]!, state: 'flipped' },
                board.tiles[1]!,
                board.tiles[2]!,
                board.tiles[3]!
            ]
        };

        const label = getFocusedTileLiveLabel({
            board: focusedBoard,
            debugPeekActive: false,
            destroyEligibleTileIds: new Set(['a1']),
            destroyPowerVisualActive: true,
            focusedTileId: 'a1',
            pairProximityHintsEnabled: true,
            peekEligibleTileIds: new Set(),
            peekPowerVisualActive: false,
            peekRevealedTileIds: new Set(),
            previewActive: false,
            runStatus: 'playing',
            strayEligibleTileIds: new Set(),
            strayPowerVisualActive: false,
            tileSwapEligibleTileIds: new Set(),
            tileSwapFirstTileId: null,
            tileSwapPowerVisualActive: false
        });

        expect(label).toContain('Tile A, row 1, column 1');
        expect(label).toContain('Destroy target: valid');
        expect(label).toContain('Pair distance: 1 grid steps');
    });

    it('returns an empty focused tile live label when focus is absent or stale', () => {
        expect(
            getFocusedTileLiveLabel({
                board,
                debugPeekActive: false,
                destroyEligibleTileIds: new Set(),
                destroyPowerVisualActive: false,
                focusedTileId: null,
                pairProximityHintsEnabled: true,
                peekEligibleTileIds: new Set(),
                peekPowerVisualActive: false,
                peekRevealedTileIds: new Set(),
                previewActive: false,
                runStatus: 'playing',
                strayEligibleTileIds: new Set(),
                strayPowerVisualActive: false,
                tileSwapEligibleTileIds: new Set(),
                tileSwapFirstTileId: null,
                tileSwapPowerVisualActive: false
            })
        ).toBe('');
        expect(
            getFocusedTileLiveLabel({
                board,
                debugPeekActive: false,
                destroyEligibleTileIds: new Set(),
                destroyPowerVisualActive: false,
                focusedTileId: 'missing',
                pairProximityHintsEnabled: true,
                peekEligibleTileIds: new Set(),
                peekPowerVisualActive: false,
                peekRevealedTileIds: new Set(),
                previewActive: false,
                runStatus: 'playing',
                strayEligibleTileIds: new Set(),
                strayPowerVisualActive: false,
                tileSwapEligibleTileIds: new Set(),
                tileSwapFirstTileId: null,
                tileSwapPowerVisualActive: false
            })
        ).toBe('');
    });
});
