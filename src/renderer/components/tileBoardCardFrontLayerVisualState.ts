import type { CardFrontSvgLayerName } from './cardSvgPlaneGeometry';

/**
 * How a card's face moves once it is up.
 *
 * The face is the illustration raster with the authored frame traced over it as meshes
 * (`AnimatedCardFrontSvgLayers`); this says what each of those layers does per frame. The grammar
 * matches the back's (`tileBoardCardBackLayerVisualState`): tiny offsets in card-plane units, a
 * scale, an opacity and an emissive level, all pure functions of the card's seed and the clock, so
 * two cards side by side never move together and a render is reproducible.
 *
 * The face is read, not admired: nothing here moves the art or changes what the player has to
 * remember, and no motion is larger than the frame's own stroke. The gold catches light, the well
 * behind the art breathes, the rune ring turns a degree or two a second, and the corner ticks come
 * up one after another.
 */
export interface CardFrontLayerVisualState {
    emissiveIntensity: number;
    opacity: number;
    rotationZ: number;
    scale: number;
    x: number;
    y: number;
    z: number;
}

export interface CardFrontLayerVisualStateInput {
    index: number;
    layerName: CardFrontSvgLayerName;
    reduceMotion: boolean;
    seed: number;
    time: number;
}

export const CARD_FRONT_LAYER_BASE_OPACITY: Record<CardFrontSvgLayerName, number> = {
    'front-panel': 1,
    'front-well': 0.85,
    'front-frame': 0.98,
    'front-fine': 0.5,
    'front-rune-ring': 0.42,
    'front-corners': 0.7
};

/** The layers the illustration must show through: drawn behind the art, never over it. */
export const CARD_FRONT_UNDER_ART_LAYERS: ReadonlySet<CardFrontSvgLayerName> = new Set([
    'front-panel',
    'front-well'
]);

export const computeCardFrontLayerPhase = (seed: number): number => ((seed % 991) / 991) * Math.PI * 2;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const computeCardFrontLayerVisualState = ({
    index,
    layerName,
    reduceMotion,
    seed,
    time
}: CardFrontLayerVisualStateInput): CardFrontLayerVisualState => {
    const phase = computeCardFrontLayerPhase(seed);
    const z = index * 0.00003;
    // The face never slides: a card the player is reading stays put. Kept in the shape so the two
    // faces answer the same contract (`tileBoardCardBackLayerVisualState`, where the back does move).
    const x = 0;
    const y = 0;
    let rotationZ = 0;
    let scale = 1;
    let opacity = CARD_FRONT_LAYER_BASE_OPACITY[layerName] ?? 1;
    let emissiveIntensity = 0;

    if (!reduceMotion) {
        const wave = Math.sin(time * 0.54 + phase + index * 0.47);

        if (layerName === 'front-well') {
            // The dark behind the art breathes, so the illustration never sits on dead stone.
            scale = 1 + wave * 0.006;
            opacity += wave * 0.05;
        } else if (layerName === 'front-frame') {
            // Gold catching the room: a sheen that runs the frame rather than a flat brightening.
            const sheen = 0.5 + 0.5 * Math.sin(time * 0.38 + phase);
            opacity += (sheen - 0.5) * 0.05;
            emissiveIntensity = 0.04 + sheen * 0.06;
        } else if (layerName === 'front-fine') {
            opacity += wave * 0.06;
        } else if (layerName === 'front-rune-ring') {
            rotationZ = time * 0.052 + phase * 0.1;
            opacity += wave * 0.05;
        } else if (layerName === 'front-corners') {
            // Four ticks on one clock, a quarter turn apart: they come up round the card.
            const tick = 0.5 + 0.5 * Math.sin(time * 0.9 + phase + index * 1.4);
            opacity += tick * 0.16 - 0.08;
            emissiveIntensity = tick * 0.08;
        }
    }

    return {
        emissiveIntensity: clamp(emissiveIntensity, 0, 1),
        opacity: clamp(opacity, 0.2, 1),
        rotationZ,
        scale,
        x,
        y,
        z
    };
};
