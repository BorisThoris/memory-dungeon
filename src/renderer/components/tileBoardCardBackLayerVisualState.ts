import type { CardBackSvgLayerName } from './cardSvgPlaneGeometry';

export interface CardBackLayerVisualState {
    emissiveIntensity: number;
    opacity: number;
    rotationZ: number;
    scale: number;
    x: number;
    y: number;
    z: number;
}

export interface CardBackLayerVisualStateInput {
    index: number;
    layerName: CardBackSvgLayerName;
    reduceMotion: boolean;
    seed: number;
    time: number;
}

export const CARD_BACK_LAYER_BASE_OPACITY: Record<CardBackSvgLayerName, number> = {
    'back-base': 1,
    'back-rims': 0.96,
    'back-corners': 0.9,
    'back-corner-scrolls': 0.62,
    'back-scrolls': 0.82,
    'back-rings': 0.58,
    'back-gem': 0.96,
    'back-vignette': 0.72
};

export const computeCardBackLayerPhase = (seed: number): number => ((seed % 997) / 997) * Math.PI * 2;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const computeCardBackLayerVisualState = ({
    index,
    layerName,
    reduceMotion,
    seed,
    time
}: CardBackLayerVisualStateInput): CardBackLayerVisualState => {
    const phase = computeCardBackLayerPhase(seed);
    const z = index * 0.000035;
    let x = 0;
    let y = 0;
    let rotationZ = 0;
    let scale = 1;
    let opacity = CARD_BACK_LAYER_BASE_OPACITY[layerName] ?? 1;
    let emissiveIntensity = 0;

    if (!reduceMotion) {
        const wave = Math.sin(time * 0.72 + phase + index * 0.61);

        if (layerName === 'back-rims') {
            y = wave * 0.0012;
            opacity += wave * 0.035;
        } else if (layerName === 'back-corners' || layerName === 'back-corner-scrolls') {
            x = Math.sin(time * 0.62 + phase + index) * 0.0013;
            y = Math.cos(time * 0.58 + phase + index) * 0.0013;
            opacity += wave * 0.028;
        } else if (layerName === 'back-scrolls') {
            x = wave * 0.0018;
            opacity += wave * 0.04;
        } else if (layerName === 'back-rings') {
            rotationZ = time * 0.038 + phase * 0.08;
            opacity += wave * 0.045;
        } else if (layerName === 'back-gem') {
            scale = 1 + wave * 0.012;
            emissiveIntensity = 0.08 + (0.5 + 0.5 * wave) * 0.12;
        }
    }

    return {
        emissiveIntensity,
        opacity: clamp(opacity, 0.24, 1),
        rotationZ,
        scale,
        x,
        y,
        z
    };
};
