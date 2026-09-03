import { describe, expect, it } from 'vitest';
import type { BoardState, Tile } from '../../shared/contracts';
import { EXIT_PAIR_KEY } from '../../shared/tile-identity';
import { tileTraitColor } from '../../shared/tile-trait-rules';
import { ENEMY_HAZARD_COLORS, HAZARD_TILE_COLORS, TRAP_STATE_COLORS } from './tileBoardThreatColors';
import {
    getDungeonUtilityReadabilityKind,
    getTileBoardReadabilityState,
    getTraitLaneReadabilityColor,
    TRAIT_LANE_COLORS,
    getTraitLaneReadabilityPattern,
    getTraitPreviewReadabilityBeatCount,
    getTraitPreviewReadabilityTone,
    getTraitRouteCadenceAction,
    getTraitRouteReadabilityBeatCount,
    getTraitRouteReadabilityBeatTier,
    getTraitRouteReadabilityCadence,
    getTraitRouteReadabilityGlyph
} from './tileBoardReadability';

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
        traitComboBack: false,
        traitComboSurgeBack: false,
        traitRewardHotBack: false,
        traitRouteTargetBack: false,
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
        expect(state({ traitRouteTargetBack: true }).showHiddenReadabilityMarkers).toBe(true);
        expect(state({ faceUp: true, powerBackAccent: 'peek' }).showHiddenReadabilityMarkers).toBe(false);
    });

    it('prioritizes hidden accent colors by enemy, hazard, boss, dungeon utility, trap, objective, route, and powers', () => {
        // Threat accents read from the gated palettes rather than repeating hex here: this test is
        // about which category wins, and `tileBoardThreatColors.test.ts` owns what each looks like.
        expect(state({ enemyOccupiedBack: true, hazardBackAccent: 'fuse_cache' }).hiddenReadabilityAccentColor).toBe(
            ENEMY_HAZARD_COLORS.sentinel
        );
        expect(state({ hazardBackAccent: 'fuse_cache', tile: tile({ dungeonBossId: 'trap_warden' }) }).hiddenReadabilityAccentColor).toBe(
            HAZARD_TILE_COLORS.trap
        );
        expect(state({ tile: tile({ dungeonBossId: 'trap_warden' }) }).hiddenReadabilityAccentColor).toBe(
            ENEMY_HAZARD_COLORS.boss
        );
        expect(state({ tile: tile({ dungeonCardKind: 'exit' }) }).hiddenReadabilityAccentColor).toBe('#7bd88f');
        expect(state({ tile: tile({ dungeonCardKind: 'lock' }) }).hiddenReadabilityAccentColor).toBe('#f2d39d');
        expect(state({ tile: tile({ dungeonCardKind: 'lever' }) }).hiddenReadabilityAccentColor).toBe('#d4a03d');
        expect(state({ tile: tile({ dungeonCardKind: 'shop' }) }).hiddenReadabilityAccentColor).toBe('#5ee0c8');
        expect(state({ tile: tile({ dungeonCardKind: 'trap', dungeonCardState: 'resolved' }) }).hiddenReadabilityAccentColor).toBe(
            TRAP_STATE_COLORS.resolved
        );
        expect(state({ objectiveBackAccent: true }).hiddenReadabilityAccentColor).toBe('#f2d39d');
        expect(state({ routeBackAccent: true }).hiddenReadabilityAccentColor).toBe('#59b4d9');
        expect(state({ traitRewardHotBack: true }).hiddenReadabilityAccentColor).toBe('#ffe48a');
        expect(state({ traitComboSurgeBack: true }).hiddenReadabilityAccentColor).toBe('#ffd166');
        expect(state({ traitComboBack: true }).hiddenReadabilityAccentColor).toBe('#f7f1c2');
        expect(state({ traitComboBack: true, traitLaneBack: 'guard' }).hiddenReadabilityAccentColor).toBe(TRAIT_LANE_COLORS.guard);
        expect(state({ traitRouteTargetBack: true }).hiddenReadabilityAccentColor).toBe('#5dd6ff');
        expect(state({ tile: tile({ tileTraitKind: 'mirror' }) }).hiddenReadabilityAccentColor).toBe(tileTraitColor('mirror'));
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
        expect(result.trapReadabilityColor).toBe(TRAP_STATE_COLORS.revealed);
        expect(result.faceReadabilityAccentColor).toBe(ENEMY_HAZARD_COLORS.boss);
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

    it('reports chain-ready and chain-setup back states for mesh rendering', () => {
        expect(state({ traitComboBack: true, tile: tile({ tileTraitKind: 'echo' }) })).toMatchObject({
            isTraitComboBack: true,
            isTraitPayoffStackBack: false,
            isTraitRewardHotBack: false,
            isTraitRouteTargetBack: false,
            showHiddenReadabilityMarkers: true,
            traitRouteReadabilityIntensity: 'ready',
            traitRouteReadabilityTier: 'combo'
        });
        expect(state({ traitRewardHotBack: true, tile: tile({ tileTraitKind: 'echo' }) })).toMatchObject({
            isTraitComboBack: false,
            isTraitPayoffStackBack: false,
            isTraitRewardHotBack: true,
            isTraitRouteTargetBack: false,
            showHiddenReadabilityMarkers: true,
            traitRouteReadabilityIntensity: 'cashout',
            traitRouteReadabilityTier: 'reward-hot'
        });
        expect(state({ traitComboBack: true, traitRewardHotBack: true, tile: tile({ tileTraitKind: 'echo' }) })).toMatchObject({
            isTraitComboBack: true,
            isTraitComboSurgeBack: false,
            isTraitPayoffStackBack: true,
            isTraitRewardHotBack: true,
            isTraitRouteTargetBack: false,
            showHiddenReadabilityMarkers: true,
            traitRouteReadabilityIntensity: 'stack',
            traitRouteReadabilityTier: 'payoff-stack'
        });
        expect(state({ traitComboSurgeBack: true, tile: tile({ tileTraitKind: 'echo' }) })).toMatchObject({
            isTraitComboBack: false,
            isTraitComboSurgeBack: true,
            isTraitPayoffStackBack: false,
            isTraitRewardHotBack: false,
            isTraitRouteTargetBack: false,
            showHiddenReadabilityMarkers: true,
            traitRouteReadabilityIntensity: 'surge',
            traitRouteReadabilityTier: 'surge'
        });
        expect(state({ traitRouteTargetBack: true })).toMatchObject({
            isTraitComboBack: false,
            isTraitComboSurgeBack: false,
            isTraitPayoffStackBack: false,
            isTraitRewardHotBack: false,
            isTraitRouteTargetBack: true,
            showHiddenReadabilityMarkers: true,
            traitRouteReadabilityIntensity: 'setup',
            traitRouteReadabilityTier: 'route-target'
        });
        expect(state({ perkArmedBack: true })).toMatchObject({
            isPerkArmedBack: true,
            traitRouteReadabilityIntensity: 'setup',
            traitRouteReadabilityTier: 'perk-armed'
        });
        expect(state({ selectedTraitFollowupBack: true })).toMatchObject({
            isSelectedTraitFollowupBack: true,
            traitRouteReadabilityIntensity: 'ready',
            traitRouteReadabilityTier: 'selected-followup'
        });
        expect(state({ faceUp: true, traitComboBack: true, traitRewardHotBack: true, traitRouteTargetBack: true })).toMatchObject({
            isTraitComboBack: false,
            isTraitComboSurgeBack: false,
            isTraitPayoffStackBack: false,
            isTraitRewardHotBack: false,
            isTraitRouteTargetBack: false,
            traitRouteReadabilityIntensity: 'none',
            traitRouteReadabilityTier: 'none'
        });
    });

    it('maps trait route tiers to arcade beat tiers used by board feedback', () => {
        expect(getTraitRouteReadabilityBeatTier('payoff-stack')).toBe('cashout');
        expect(getTraitRouteReadabilityBeatTier('reward-hot')).toBe('cashout');
        expect(getTraitRouteReadabilityBeatTier('surge')).toBe('surge');
        expect(getTraitRouteReadabilityBeatTier('selected-followup')).toBe('follow-up');
        expect(getTraitRouteReadabilityBeatTier('combo')).toBe('route');
        expect(getTraitRouteReadabilityBeatTier('route-target')).toBe('setup');
        expect(getTraitRouteReadabilityBeatTier('perk-armed')).toBe('setup');
        expect(getTraitRouteReadabilityBeatTier('none')).toBeNull();

        expect(getTraitRouteReadabilityBeatCount('cashout')).toBe(5);
        expect(getTraitRouteReadabilityBeatCount('surge')).toBe(4);
        expect(getTraitRouteReadabilityBeatCount('follow-up')).toBe(3);
        expect(getTraitRouteReadabilityBeatCount('route')).toBe(3);
        expect(getTraitRouteReadabilityBeatCount('setup')).toBe(2);
        expect(getTraitRouteReadabilityBeatCount(null)).toBe(0);
    });

    it('maps trait route tiers to distinct card glyphs for hidden-back readability', () => {
        expect(getTraitRouteReadabilityGlyph('payoff-stack')).toBe('payoff-stack');
        expect(getTraitRouteReadabilityGlyph('reward-hot')).toBe('cashout-crown');
        expect(getTraitRouteReadabilityGlyph('surge')).toBe('surge-burst');
        expect(getTraitRouteReadabilityGlyph('selected-followup')).toBe('next-tap');
        expect(getTraitRouteReadabilityGlyph('combo')).toBe('linked-route');
        expect(getTraitRouteReadabilityGlyph('route-target')).toBe('prime-cross');
        expect(getTraitRouteReadabilityGlyph('perk-armed')).toBe('prime-cross');
        expect(getTraitRouteReadabilityGlyph('none')).toBe('none');
    });

    it('maps trait route tiers to cadence actions for board readability pulses', () => {
        expect(getTraitRouteReadabilityCadence('payoff-stack')).toBe('cashout');
        expect(getTraitRouteReadabilityCadence('reward-hot')).toBe('cashout');
        expect(getTraitRouteReadabilityCadence('surge')).toBe('surge');
        expect(getTraitRouteReadabilityCadence('selected-followup')).toBe('follow-up');
        expect(getTraitRouteReadabilityCadence('combo')).toBe('route');
        expect(getTraitRouteReadabilityCadence('route-target')).toBe('prime');
        expect(getTraitRouteReadabilityCadence('perk-armed')).toBe('prime');
        expect(getTraitRouteReadabilityCadence('none')).toBe('none');

        expect(getTraitRouteCadenceAction('cashout')).toBe('Cash now');
        expect(getTraitRouteCadenceAction('surge')).toBe('Route surge');
        expect(getTraitRouteCadenceAction('follow-up')).toBe('Next tap');
        expect(getTraitRouteCadenceAction('route')).toBe('Match route');
        expect(getTraitRouteCadenceAction('prime')).toBe('Prime payoff');
        expect(getTraitRouteCadenceAction('none')).toBe('None');
    });

    it('scales face-up trait preview intensity from interaction line count', () => {
        expect(getTraitPreviewReadabilityBeatCount(0)).toBe(2);
        expect(getTraitPreviewReadabilityBeatCount(1)).toBe(2);
        expect(getTraitPreviewReadabilityBeatCount(2)).toBe(3);
        expect(getTraitPreviewReadabilityBeatCount(3)).toBe(4);
        expect(getTraitPreviewReadabilityBeatCount(4)).toBe(5);
        expect(getTraitPreviewReadabilityBeatCount(8)).toBe(5);

        expect(getTraitPreviewReadabilityTone(0)).toBe('ready');
        expect(getTraitPreviewReadabilityTone(1)).toBe('ready');
        expect(getTraitPreviewReadabilityTone(2)).toBe('surge');
        expect(getTraitPreviewReadabilityTone(3)).toBe('cashout');
        expect(getTraitPreviewReadabilityTone(8)).toBe('cashout');
    });

    it('reports trait lane readability colors for hidden card lane markers', () => {
        // Lane colours are owned by the colour-vision gate; this pins the mapping, not the hex.
        for (const lane of ['shard', 'guard', 'tool', 'risk', 'block', 'recall'] as const) {
            expect(getTraitLaneReadabilityColor(lane)).toBe(TRAIT_LANE_COLORS[lane]);
        }
        expect(getTraitLaneReadabilityColor('score')).toBe(TRAIT_LANE_COLORS.other);
        expect(getTraitLaneReadabilityPattern('shard')).toBe('cash-pip');
        expect(getTraitLaneReadabilityPattern('guard')).toBe('guard-ward');
        expect(getTraitLaneReadabilityPattern('tool')).toBe('tool-cross');
        expect(getTraitLaneReadabilityPattern('risk')).toBe('risk-slash');
        expect(getTraitLaneReadabilityPattern('block')).toBe('block-bars');
        expect(getTraitLaneReadabilityPattern('recall')).toBe('recall-pair');
        expect(getTraitLaneReadabilityPattern('score')).toBe('score-pip');

        expect(state({ traitComboBack: true, traitLaneBack: 'shard', tile: tile({ tileTraitKind: 'echo' }) })).toMatchObject({
            hiddenReadabilityAccentColor: TRAIT_LANE_COLORS.shard,
            traitLaneReadabilityAction: 'Cash shard',
            traitLaneReadabilityColor: TRAIT_LANE_COLORS.shard,
            traitLaneReadabilityId: 'shard',
            traitLaneReadabilityLabel: 'Shard',
            traitLaneReadabilityPattern: 'cash-pip',
            traitRouteReadabilityIntensity: 'ready',
            traitRouteReadabilityTier: 'combo'
        });
        expect(state({ faceUp: true, traitComboBack: true, traitLaneBack: 'shard' })).toMatchObject({
            traitLaneReadabilityAction: null,
            traitLaneReadabilityColor: null,
            traitLaneReadabilityId: null,
            traitLaneReadabilityLabel: null,
            traitLaneReadabilityPattern: null,
            traitRouteReadabilityIntensity: 'none',
            traitRouteReadabilityTier: 'none'
        });
    });
});
