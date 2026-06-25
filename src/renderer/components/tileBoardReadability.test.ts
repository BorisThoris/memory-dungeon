import { describe, expect, it } from 'vitest';
import type { BoardState, Tile } from '../../shared/contracts';
import { EXIT_PAIR_KEY } from '../../shared/tile-identity';
import { getDungeonUtilityReadabilityKind, getTileBoardReadabilityState } from './tileBoardReadability';

const tile = (overrides: Partial<Tile> = {}): Tile => ({
    id: 'a1',
    pairKey: 'a',
    symbol: 'A',
    label: 'A',
    state: 'hidden',
    ...overrides
});

const state = (overrides: Partial<Parameters<typeof getTileBoardReadabilityState>[0]> = {}) =>
    getTileBoardReadabilityState({
        destroyBlockedDecoyBack: false,
        enemyOccupiedBack: false,
        faceUp: false,
        hazardBackAccent: null,
        nonPickableBack: false,
        objectiveBackAccent: false,
        powerBackAccent: null,
        routeBackAccent: false,
        spotlightBountyOnBack: false,
        spotlightWardOnBack: false,
        stickyFingerSlotMark: false,
        tile: tile(),
        ...overrides
    });

const terminalLockedExitBoard = (): BoardState => ({
    level: 1,
    pairCount: 1,
    columns: 2,
    rows: 2,
    matchedPairs: 1,
    flippedTileIds: [],
    floorArchetypeId: null,
    featuredObjectiveId: null,
    dungeonExitTileId: 'exit',
    dungeonExitLockKind: 'iron',
    dungeonExitActivated: false,
    tiles: [
        tile({ id: 'a1', state: 'matched' }),
        tile({ id: 'a2', state: 'matched' }),
        tile({
            id: 'exit',
            pairKey: EXIT_PAIR_KEY,
            dungeonCardKind: 'exit',
            dungeonExitLockKind: 'iron'
        })
    ]
});

describe('tileBoardReadability', () => {
    it('classifies dungeon utility readability markers with stable precedence', () => {
        expect(getDungeonUtilityReadabilityKind(tile({ dungeonCardKind: 'exit', dungeonExitLockKind: 'iron' }))).toBe('exit');
        expect(getDungeonUtilityReadabilityKind(tile({ dungeonCardKind: 'lever' }))).toBe('lever');
        expect(getDungeonUtilityReadabilityKind(tile({ dungeonCardKind: 'shop' }))).toBe('shop');
        expect(getDungeonUtilityReadabilityKind(tile({ dungeonCardKind: 'lock' }))).toBe('lock');
        expect(getDungeonUtilityReadabilityKind(tile({ dungeonExitLockKind: 'iron' }))).toBe('lock');
        expect(getDungeonUtilityReadabilityKind(tile({ dungeonExitLockKind: 'none' }))).toBeNull();
    });

    it('uses effective exit lock state for primary exit lock markers when board context is available', () => {
        const board = terminalLockedExitBoard();
        const exitTile = board.tiles.find((candidate) => candidate.id === 'exit')!;

        expect(getDungeonUtilityReadabilityKind(exitTile, board)).toBe('exit');
        expect(
            getDungeonUtilityReadabilityKind(
                tile({ id: 'stray-lock-copy', dungeonExitLockKind: 'iron' }),
                board
            )
        ).toBe('lock');
        expect(state({ tile: exitTile, board })).toMatchObject({
            isExitCard: true,
            isLockCard: false
        });
    });

    it('shows hidden readability markers for hidden special backs only', () => {
        expect(state().showHiddenReadabilityMarkers).toBe(false);
        expect(state({ powerBackAccent: 'peek' }).showHiddenReadabilityMarkers).toBe(true);
        expect(state({ tile: tile({ dungeonCardKind: 'trap' }) }).showHiddenReadabilityMarkers).toBe(true);
        expect(state({ faceUp: true, powerBackAccent: 'peek' }).showHiddenReadabilityMarkers).toBe(false);
    });

    it('prioritizes hidden accent colors by enemy, hazard, boss, dungeon utility, trap, objective, route, and powers', () => {
        expect(state({ enemyOccupiedBack: true, hazardBackAccent: 'fuse_cache' }).hiddenReadabilityAccentColor).toBe(
            '#ff9f86'
        );
        expect(state({ hazardBackAccent: 'fuse_cache', tile: tile({ dungeonBossId: 'trap_warden' }) }).hiddenReadabilityAccentColor).toBe(
            '#ff9f86'
        );
        expect(state({ tile: tile({ dungeonBossId: 'trap_warden' }) }).hiddenReadabilityAccentColor).toBe('#ffcf66');
        expect(state({ tile: tile({ dungeonCardKind: 'exit' }) }).hiddenReadabilityAccentColor).toBe('#7bd88f');
        expect(state({ tile: tile({ dungeonCardKind: 'lock' }) }).hiddenReadabilityAccentColor).toBe('#f2d39d');
        expect(state({ tile: tile({ dungeonCardKind: 'lever' }) }).hiddenReadabilityAccentColor).toBe('#d4a03d');
        expect(state({ tile: tile({ dungeonCardKind: 'shop' }) }).hiddenReadabilityAccentColor).toBe('#5ee0c8');
        expect(state({ tile: tile({ dungeonCardKind: 'trap', dungeonCardState: 'resolved' }) }).hiddenReadabilityAccentColor).toBe(
            '#7bd88f'
        );
        expect(state({ objectiveBackAccent: true }).hiddenReadabilityAccentColor).toBe('#f2d39d');
        expect(state({ routeBackAccent: true }).hiddenReadabilityAccentColor).toBe('#59b4d9');
        expect(state({ tile: tile({ tileTraitKind: 'mirror' }) }).hiddenReadabilityAccentColor).toBe('#b890ff');
        expect(state({ powerBackAccent: 'destroy' }).hiddenReadabilityAccentColor).toBe('#d94848');
        expect(state({ powerBackAccent: 'stray' }).hiddenReadabilityAccentColor).toBe('#d4a03d');
        expect(state({ powerBackAccent: 'swap' }).hiddenReadabilityAccentColor).toBe('#5dd6ff');
        expect(state({ powerBackAccent: 'swapOrigin' }).hiddenReadabilityAccentColor).toBe('#f2f9ff');
    });

    it('marks front readability for face-up special cards that are not matched', () => {
        expect(state({ faceUp: true, tile: tile({ state: 'flipped', routeCardKind: 'safe_ward' }) }).showFaceReadabilityMarker).toBe(
            true
        );
        expect(state({ faceUp: true, tile: tile({ state: 'flipped', dungeonCardKind: 'exit' }) }).showFaceReadabilityMarker).toBe(
            true
        );
        expect(state({ faceUp: true, tile: tile({ state: 'flipped', dungeonCardKind: 'lever' }) }).showFaceReadabilityMarker).toBe(
            true
        );
        expect(state({ faceUp: true, tile: tile({ state: 'flipped', dungeonCardKind: 'shop' }) }).showFaceReadabilityMarker).toBe(
            true
        );
        expect(state({ faceUp: true, tile: tile({ state: 'matched', routeCardKind: 'safe_ward' }) }).showFaceReadabilityMarker).toBe(
            false
        );
        expect(state({ faceUp: false, tile: tile({ tileHazardKind: 'mirror_decoy' }) }).showFaceReadabilityMarker).toBe(
            false
        );
        expect(state({ faceUp: true, tile: tile({ state: 'flipped', tileTraitKind: 'echo' }) }).showFaceReadabilityMarker).toBe(
            true
        );
    });

    it('reports trap, boss, relic, and selected-card flags used by mesh rendering', () => {
        const result = state({
            faceUp: true,
            tile: tile({
                dungeonBossId: 'rush_sentinel',
                dungeonCardKind: 'trap',
                dungeonCardState: 'revealed',
                findableKind: 'score_glint',
                state: 'flipped'
            })
        });

        expect(result.isArmedTrap).toBe(false);
        expect(result.isBossCard).toBe(true);
        expect(result.isExitCard).toBe(false);
        expect(result.isLeverCard).toBe(false);
        expect(result.isLockCard).toBe(false);
        expect(result.isRelicCard).toBe(true);
        expect(result.isRevealedTrap).toBe(true);
        expect(result.isShopCard).toBe(false);
        expect(result.isSelectedCard).toBe(true);
        expect(result.trapReadabilityColor).toBe('#ffcf66');
        expect(result.faceReadabilityAccentColor).toBe('#ffcf66');
    });

    it('reports dungeon utility flags used by spatial marker meshes', () => {
        expect(state({ tile: tile({ dungeonCardKind: 'exit' }) })).toMatchObject({
            isExitCard: true,
            isLockCard: false,
            showHiddenReadabilityMarkers: true
        });
        expect(state({ tile: tile({ dungeonCardKind: 'lever' }) })).toMatchObject({
            isLeverCard: true,
            showHiddenReadabilityMarkers: true
        });
        expect(state({ tile: tile({ dungeonCardKind: 'shop' }) })).toMatchObject({
            isShopCard: true,
            showHiddenReadabilityMarkers: true
        });
        expect(state({ tile: tile({ dungeonExitLockKind: 'iron' }) })).toMatchObject({
            isLockCard: true,
            showHiddenReadabilityMarkers: true
        });
    });
});
