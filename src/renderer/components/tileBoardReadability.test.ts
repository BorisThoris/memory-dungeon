import { describe, expect, it } from 'vitest';
import type { Tile } from '../../shared/contracts';
import { getTileBoardReadabilityState } from './tileBoardReadability';

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

describe('tileBoardReadability', () => {
    it('shows hidden readability markers for hidden special backs only', () => {
        expect(state().showHiddenReadabilityMarkers).toBe(false);
        expect(state({ powerBackAccent: 'peek' }).showHiddenReadabilityMarkers).toBe(true);
        expect(state({ tile: tile({ dungeonCardKind: 'trap' }) }).showHiddenReadabilityMarkers).toBe(true);
        expect(state({ faceUp: true, powerBackAccent: 'peek' }).showHiddenReadabilityMarkers).toBe(false);
    });

    it('prioritizes hidden accent colors by enemy, hazard, boss, trap, objective, route, and powers', () => {
        expect(state({ enemyOccupiedBack: true, hazardBackAccent: 'fuse_cache' }).hiddenReadabilityAccentColor).toBe(
            '#ff9f86'
        );
        expect(state({ hazardBackAccent: 'fuse_cache', tile: tile({ dungeonBossId: 'trap_warden' }) }).hiddenReadabilityAccentColor).toBe(
            '#ff9f86'
        );
        expect(state({ tile: tile({ dungeonBossId: 'trap_warden' }) }).hiddenReadabilityAccentColor).toBe('#ffcf66');
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
        expect(result.isRelicCard).toBe(true);
        expect(result.isRevealedTrap).toBe(true);
        expect(result.isSelectedCard).toBe(true);
        expect(result.trapReadabilityColor).toBe('#ffcf66');
        expect(result.faceReadabilityAccentColor).toBe('#ffcf66');
    });
});
