import { describe, expect, it } from 'vitest';
import {
    getTraitMarkerCueByRouteGlyph,
    getTraitMarkerCueByShape,
    TRAIT_MARKER_ROUTE_GLYPH_PRIORITY
} from './traitMarkerCueGlossary';

describe('traitMarkerCueGlossary', () => {
    it('keeps route glyph mappings stable for shared board and HUD cue surfaces', () => {
        expect(TRAIT_MARKER_ROUTE_GLYPH_PRIORITY).toEqual([
            'payoff-stack',
            'cashout-crown',
            'surge-burst',
            'next-tap',
            'linked-route',
            'prime-cross'
        ]);

        expect(getTraitMarkerCueByRouteGlyph('payoff-stack')).toEqual({
            action: 'Cash stack',
            glyph: '**',
            label: 'Stack',
            shape: 'payoff-stack'
        });
        expect(getTraitMarkerCueByRouteGlyph('cashout-crown')).toEqual({
            action: 'Cash now',
            glyph: '=+',
            label: 'Cashout',
            shape: 'payoff-bar'
        });
        expect(getTraitMarkerCueByRouteGlyph('surge-burst')).toEqual({
            action: 'Route surge',
            glyph: '++',
            label: 'Surge',
            shape: 'combo-surge'
        });
        expect(getTraitMarkerCueByRouteGlyph('next-tap')).toEqual({
            action: 'Next tap',
            glyph: '|=',
            label: 'Follow-up',
            shape: 'followup-target'
        });
        expect(getTraitMarkerCueByRouteGlyph('linked-route')).toEqual({
            action: 'Match route',
            glyph: 'oo',
            label: 'Route',
            shape: 'linked-route'
        });
        expect(getTraitMarkerCueByRouteGlyph('prime-cross')).toEqual({
            action: 'Prime payoff',
            glyph: 'x|',
            label: 'Prime',
            shape: 'swap-target-crossbar'
        });
    });

    it('exposes shape lookups for reused perk and route cue badges', () => {
        expect(getTraitMarkerCueByShape('perk-armed-bar')).toEqual({
            action: 'Cash perk',
            glyph: '+!',
            label: 'Perk',
            shape: 'perk-armed-bar'
        });
        expect(getTraitMarkerCueByShape('payoff-bar')).toEqual(getTraitMarkerCueByRouteGlyph('cashout-crown'));
        expect(getTraitMarkerCueByShape('swap-target-crossbar')).toEqual(getTraitMarkerCueByRouteGlyph('prime-cross'));
    });
});
