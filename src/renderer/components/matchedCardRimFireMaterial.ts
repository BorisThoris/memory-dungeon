import {
    AdditiveBlending,
    DoubleSide,
    MathUtils,
    ShaderMaterial,
    Vector2,
    Vector3
} from 'three';
import { GAMEPLAY_BOARD_VISUALS } from './gameplayVisualConfig';
import { MATCHED_RIM_FIRE_FRAGMENT_SHADER } from './matchedCardRimFireShaderGlsl';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';

const vertexShader = /* glsl */ `
varying vec2 vLocal;

void main() {
  vLocal = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const matchedEdgeGeometry = GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.geometry;
const matchedEdgeBand = GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.band;

const outerHalfSize = new Vector2(
    CARD_PLANE_WIDTH * 0.5 + matchedEdgeGeometry.outerPad,
    CARD_PLANE_HEIGHT * 0.5 + matchedEdgeGeometry.outerPad
);
const innerHalfSize = new Vector2(
    CARD_PLANE_WIDTH * 0.5 - matchedEdgeGeometry.innerPad,
    CARD_PLANE_HEIGHT * 0.5 - matchedEdgeGeometry.innerPad
);

export interface MatchedCardRimFireUniforms {
    uTime: { value: number };
    uSeed: { value: number };
    uIntensity: { value: number };
    uBurst: { value: number };
    uMotion: { value: number };
    uSoftness: { value: number };
    uInnerWidth: { value: number };
    uOuterWidth: { value: number };
    uEmberStrength: { value: number };
    uOuterHalfSize: { value: Vector2 };
    uInnerHalfSize: { value: Vector2 };
    uOuterCorner: { value: number };
    uInnerCorner: { value: number };
    uCoreColor: { value: Vector3 };
    uGlowColor: { value: Vector3 };
    uEmberColor: { value: Vector3 };
}

/**
 * Purpose-built additive ember rim for matched cards. Fully procedural: **no** env map or external
 * texture assets; color comes from {@link GAMEPLAY_BOARD_VISUALS}. Production builds always get
 * valid sRGB triples; if a theme entry were ever invalid, uniforms fall back to warm ember tones.
 */
/** JS-side clamp before GPU (pairs with fragment clamps for Intel/ANGLE edge uniforms). */
export const clampMatchedCardRimFireDriverUniforms = (
    u: Pick<MatchedCardRimFireUniforms, 'uIntensity' | 'uBurst'>
): void => {
    u.uIntensity.value = MathUtils.clamp(u.uIntensity.value, 0, 4);
    u.uBurst.value = MathUtils.clamp(u.uBurst.value, 0, 2);
};

export const createMatchedCardRimFireMaterial = (seed: number): ShaderMaterial => {
    const colors = GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.colors;
    const safeRgb = (
        tuple: readonly [number, number, number],
        fallback: readonly [number, number, number],
        label: string
    ): readonly [number, number, number] => {
        if (tuple.every((n) => Number.isFinite(n))) {
            return tuple;
        }
        if (import.meta.env.DEV) {
            console.warn(`matchedCardRimFireMaterial: invalid ${label} rgb; using fallback`, tuple);
        }
        return fallback;
    };
    const core = safeRgb(colors.core, [0.96, 0.55, 0.28], 'core');
    const glow = safeRgb(colors.glow, [1.0, 0.78, 0.42], 'glow');
    const ember = safeRgb(colors.ember, [1.0, 0.45, 0.12], 'ember');
    const uniforms: MatchedCardRimFireUniforms = {
        uTime: { value: 0 },
        uSeed: { value: (seed % 1000) * 0.001 },
        uIntensity: { value: 0 },
        uBurst: { value: 0 },
        uMotion: { value: 1 },
        uSoftness: { value: matchedEdgeBand.softness },
        uInnerWidth: { value: matchedEdgeBand.innerWidth },
        uOuterWidth: { value: matchedEdgeBand.outerWidth },
        uEmberStrength: { value: 1 },
        uOuterHalfSize: { value: outerHalfSize.clone() },
        uInnerHalfSize: { value: innerHalfSize.clone() },
        uOuterCorner: { value: matchedEdgeGeometry.outerCorner },
        uInnerCorner: { value: matchedEdgeGeometry.innerCorner },
        uCoreColor: { value: new Vector3(...core) },
        uGlowColor: { value: new Vector3(...glow) },
        uEmberColor: { value: new Vector3(...ember) }
    };

    return new ShaderMaterial({
        uniforms: uniforms as unknown as { [uniform: string]: { value: unknown } },
        vertexShader,
        fragmentShader: MATCHED_RIM_FIRE_FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: AdditiveBlending,
        side: DoubleSide,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
    });
};
