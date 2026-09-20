/**
 * How the room answers the run, as continuous functions of the chain meter's fill (0..1 of the way
 * to Fever) rather than four steps: the ring warms as the chain grows, not when a rung is crossed.
 * The torches are not here on purpose — they always burn.
 */
export interface SceneRingLevels {
    /** Opacity of the ring's floor light pass. */
    light: number;
    /** Opacity of the ring's own glow. */
    glow: number;
    /** Hue rotation of the glow in degrees: violet at rest, rose at Fever. */
    hueDeg: number;
    /** Saturation multiplier of the glow. */
    saturate: number;
    /** Peak opacity of the floor flash on a break. */
    pulsePeak: number;
}

const clamp01 = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

export const sceneRingLevels = (fill: number): SceneRingLevels => {
    const f = clamp01(fill);
    // Ease in: the first pairs barely move the room, the last ones before Fever move it most.
    const eased = f * f * (3 - 2 * f);
    return {
        light: round(0.5 + 0.8 * eased),
        glow: round(0.68 + 0.72 * eased),
        hueDeg: Math.round(-40 * eased) + 0, // + 0 folds -0 into 0 so the CSS variable never reads "-0deg"
        saturate: round(1 + 0.4 * eased),
        pulsePeak: round(0.35 + 0.9 * eased)
    };
};

const round = (value: number): number => Math.round(value * 1000) / 1000;
