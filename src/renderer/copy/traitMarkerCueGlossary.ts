export const TRAIT_MARKER_ROUTE_GLYPH_PRIORITY = [
    'payoff-stack',
    'cashout-crown',
    'surge-burst',
    'next-tap',
    'linked-route',
    'prime-cross'
] as const;

export type TraitMarkerRouteGlyphId = (typeof TRAIT_MARKER_ROUTE_GLYPH_PRIORITY)[number];

export type TraitMarkerShapeId =
    | 'combo-surge'
    | 'followup-target'
    | 'linked-route'
    | 'payoff-bar'
    | 'payoff-stack'
    | 'perk-armed-bar'
    | 'swap-target-crossbar';

export type TraitMarkerCueAction =
    | 'Cash now'
    | 'Cash perk'
    | 'Cash stack'
    | 'Match route'
    | 'Next tap'
    | 'Prime payoff'
    | 'Route surge';

export type TraitMarkerCueCopy = {
    action: TraitMarkerCueAction;
    glyph: string;
    label: string;
    shape: TraitMarkerShapeId;
};

const TRAIT_MARKER_ROUTE_CUE_COPY: Record<TraitMarkerRouteGlyphId, TraitMarkerCueCopy> = {
    'cashout-crown': {
        action: 'Cash now',
        glyph: '=+',
        label: 'Cashout',
        shape: 'payoff-bar'
    },
    'linked-route': {
        action: 'Match route',
        glyph: 'oo',
        label: 'Route',
        shape: 'linked-route'
    },
    'next-tap': {
        action: 'Next tap',
        glyph: '|=',
        label: 'Follow-up',
        shape: 'followup-target'
    },
    'payoff-stack': {
        action: 'Cash stack',
        glyph: '**',
        label: 'Stack',
        shape: 'payoff-stack'
    },
    'prime-cross': {
        action: 'Prime payoff',
        glyph: 'x|',
        label: 'Prime',
        shape: 'swap-target-crossbar'
    },
    'surge-burst': {
        action: 'Route surge',
        glyph: '++',
        label: 'Surge',
        shape: 'combo-surge'
    }
};

const TRAIT_MARKER_SHAPE_CUE_COPY: Record<TraitMarkerShapeId, TraitMarkerCueCopy> = {
    'combo-surge': TRAIT_MARKER_ROUTE_CUE_COPY['surge-burst'],
    'followup-target': TRAIT_MARKER_ROUTE_CUE_COPY['next-tap'],
    'linked-route': TRAIT_MARKER_ROUTE_CUE_COPY['linked-route'],
    'payoff-bar': TRAIT_MARKER_ROUTE_CUE_COPY['cashout-crown'],
    'payoff-stack': TRAIT_MARKER_ROUTE_CUE_COPY['payoff-stack'],
    'perk-armed-bar': {
        action: 'Cash perk',
        glyph: '+!',
        label: 'Perk',
        shape: 'perk-armed-bar'
    },
    'swap-target-crossbar': TRAIT_MARKER_ROUTE_CUE_COPY['prime-cross']
};

export const getTraitMarkerCueByRouteGlyph = (id: TraitMarkerRouteGlyphId): TraitMarkerCueCopy =>
    TRAIT_MARKER_ROUTE_CUE_COPY[id];

export const getTraitMarkerCueByShape = (shape: TraitMarkerShapeId): TraitMarkerCueCopy =>
    TRAIT_MARKER_SHAPE_CUE_COPY[shape];
