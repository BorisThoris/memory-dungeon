import { describe, expect, it } from 'vitest';
import type { Tile } from '../../shared/contracts';
import { colorDistance, findConfusablePairs, hexToRgb } from '../../shared/color-vision';
import { tileTraitColor } from '../../shared/tile-trait-rules';
import {
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
        faceUp: false,
        nonPickableBack: false,
        powerBackAccent: null,
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

describe('tileBoardReadability', () => {
    it('shows hidden readability markers for hidden special backs only', () => {
        expect(state().showHiddenReadabilityMarkers).toBe(false);
        expect(state({ powerBackAccent: 'peek' }).showHiddenReadabilityMarkers).toBe(true);
        expect(state({ tile: tile({ findableKind: 'score_glint' }) }).showHiddenReadabilityMarkers).toBe(true);
        expect(state({ traitRouteTargetBack: true }).showHiddenReadabilityMarkers).toBe(true);
        expect(state({ faceUp: true, powerBackAccent: 'peek' }).showHiddenReadabilityMarkers).toBe(false);
    });

    it('prioritizes hidden accent colors by trait lane, trait route, trait kind, and powers', () => {
        expect(state({ traitRewardHotBack: true }).hiddenReadabilityAccentColor).toBe('#ffe48a');
        expect(state({ traitComboSurgeBack: true }).hiddenReadabilityAccentColor).toBe('#ffd166');
        expect(state({ traitComboBack: true }).hiddenReadabilityAccentColor).toBe('#f7f1c2');
        expect(state({ traitComboBack: true, traitLaneBack: 'tool' }).hiddenReadabilityAccentColor).toBe(TRAIT_LANE_COLORS.tool);
        expect(state({ traitRouteTargetBack: true }).hiddenReadabilityAccentColor).toBe('#5dd6ff');
        expect(state({ tile: tile({ tileTraitKind: 'stasis' }) }).hiddenReadabilityAccentColor).toBe(tileTraitColor('stasis'));
        expect(state({ powerBackAccent: 'peek' }).hiddenReadabilityAccentColor).toBe('#59b4d9');
        expect(state({ powerBackAccent: 'pin' }).hiddenReadabilityAccentColor).toBe('#e8c878');
        expect(state({ powerBackAccent: 'swap' }).hiddenReadabilityAccentColor).toBe('#5dd6ff');
        expect(state({ powerBackAccent: 'swapOrigin' }).hiddenReadabilityAccentColor).toBe('#f2f9ff');
    });

    it('marks front readability for face-up special cards that are not matched', () => {
        expect(state({ faceUp: true, tile: tile({ state: 'flipped', findableKind: 'score_glint' }) }).showFaceReadabilityMarker).toBe(
            true
        );
        expect(state({ faceUp: true, tile: tile({ state: 'matched', findableKind: 'score_glint' }) }).showFaceReadabilityMarker).toBe(
            false
        );
        expect(state({ faceUp: false, tile: tile({ findableKind: 'score_glint' }) }).showFaceReadabilityMarker).toBe(false);
        expect(state({ faceUp: true, tile: tile({ state: 'flipped' }) }).showFaceReadabilityMarker).toBe(false);
        expect(state({ faceUp: true, tile: tile({ state: 'flipped', tileTraitKind: 'echo' }) }).showFaceReadabilityMarker).toBe(
            true
        );
    });

    it('reports findable and selected-card flags used by mesh rendering', () => {
        const result = state({
            faceUp: true,
            tile: tile({ findableKind: 'score_glint', state: 'flipped' })
        });

        expect(result.isFindableCard).toBe(true);
        expect(result.isSelectedCard).toBe(true);
        expect(result.faceReadabilityAccentColor).toBe('#5ee0c8');
        expect(state({ faceUp: true, tile: tile({ state: 'flipped', tileTraitKind: 'echo' }) }).faceReadabilityAccentColor).toBe(
            tileTraitColor('echo')
        );
        expect(state({ faceUp: true, tile: tile({ state: 'flipped' }) })).toMatchObject({
            isFindableCard: false,
            isSelectedCard: true
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
        expect(getTraitRouteReadabilityGlyph('none')).toBe('none');
    });

    it('maps trait route tiers to cadence actions for board readability pulses', () => {
        expect(getTraitRouteReadabilityCadence('payoff-stack')).toBe('cashout');
        expect(getTraitRouteReadabilityCadence('reward-hot')).toBe('cashout');
        expect(getTraitRouteReadabilityCadence('surge')).toBe('surge');
        expect(getTraitRouteReadabilityCadence('selected-followup')).toBe('follow-up');
        expect(getTraitRouteReadabilityCadence('combo')).toBe('route');
        expect(getTraitRouteReadabilityCadence('route-target')).toBe('prime');
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
        /*
         * Gen 201: four lanes, down from seven. The shard lane was reachable only by matching the
         * word "spark" in "Conduit + Echo: peek spark" - so a peek charge was drawn and labelled as
         * a combo shard, a currency removed in Gen 184. Guard and risk matched nothing any of the
         * four live interactions says.
         */
        for (const lane of ['tool', 'block', 'recall'] as const) {
            expect(getTraitLaneReadabilityColor(lane)).toBe(TRAIT_LANE_COLORS[lane]);
        }
        expect(getTraitLaneReadabilityColor('score')).toBe(TRAIT_LANE_COLORS.other);
        expect(getTraitLaneReadabilityPattern('tool')).toBe('tool-cross');
        expect(getTraitLaneReadabilityPattern('block')).toBe('block-bars');
        expect(getTraitLaneReadabilityPattern('recall')).toBe('recall-pair');
        expect(getTraitLaneReadabilityPattern('score')).toBe('score-pip');

        expect(state({ traitComboBack: true, traitLaneBack: 'tool', tile: tile({ tileTraitKind: 'echo' }) })).toMatchObject({
            hiddenReadabilityAccentColor: TRAIT_LANE_COLORS.tool,
            traitLaneReadabilityAction: 'Use tool',
            traitLaneReadabilityColor: TRAIT_LANE_COLORS.tool,
            traitLaneReadabilityId: 'tool',
            traitLaneReadabilityLabel: 'Tool',
            traitLaneReadabilityPattern: 'tool-cross',
            traitRouteReadabilityIntensity: 'ready',
            traitRouteReadabilityTier: 'combo'
        });
        expect(state({ faceUp: true, traitComboBack: true, traitLaneBack: 'tool' })).toMatchObject({
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

/**
 * Lane colour is a rule the player reads at a glance, so the palette is tuned against the dichromacy
 * simulation in `shared/color-vision.ts`: as shipped, guard and the fallback sat dE 1.0 apart for a
 * protanope.
 */
describe('the trait lane palette', () => {
    const MIN_LANE_COLOR_DISTANCE = 25;
    const BOARD_GROUND = '#090d18';
    const MIN_GROUND_CONTRAST = 45;

    it('keeps every lane colour apart for every kind of colour vision', () => {
        const confusable = findConfusablePairs(TRAIT_LANE_COLORS, MIN_LANE_COLOR_DISTANCE);
        for (const pair of confusable) {
            console.log(`TRAIT LANE PALETTE ${pair.vision}: ${pair.left} vs ${pair.right} = dE ${pair.distance.toFixed(1)}`);
        }
        expect(confusable).toEqual([]);
    });

    it('keeps every lane colour readable against the board', () => {
        const ground = hexToRgb(BOARD_GROUND);
        const faint = Object.entries(TRAIT_LANE_COLORS)
            .map(([lane, hex]) => ({ distance: colorDistance(hexToRgb(hex), ground), lane }))
            .filter((row) => row.distance < MIN_GROUND_CONTRAST);
        expect(faint).toEqual([]);
    });
});
