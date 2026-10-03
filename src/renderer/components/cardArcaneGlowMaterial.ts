import {
    AdditiveBlending,
    Color,
    DoubleSide,
    MathUtils,
    ShaderMaterial,
    Vector2,
    Vector3
} from 'three';
import { RENDERER_THEME } from '../styles/theme';
import { CARD_ARCANE_GLOW_FRAGMENT_SHADER } from './cardArcaneGlowShaderGlsl';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';

const vertexShader = /* glsl */ `
varying vec2 vLocal;

void main() {
  vLocal = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const outerHalfSize = new Vector2(CARD_PLANE_WIDTH * 0.5 + 0.06, CARD_PLANE_HEIGHT * 0.5 + 0.06);
const innerHalfSize = new Vector2(CARD_PLANE_WIDTH * 0.5 - 0.018, CARD_PLANE_HEIGHT * 0.5 - 0.018);

export interface CardArcaneGlowUniforms {
    uTime: { value: number };
    uSeed: { value: number };
    uIntensity: { value: number };
    uPulse: { value: number };
    uMotion: { value: number };
    uMode: { value: number };
    uOuterHalfSize: { value: Vector2 };
    uInnerHalfSize: { value: Vector2 };
    uOuterCorner: { value: number };
    uInnerCorner: { value: number };
    uPrimaryColor: { value: Vector3 };
    uSecondaryColor: { value: Vector3 };
    uAccentColor: { value: Vector3 };
}

const colorToVec3 = (hex: string): Vector3 => {
    const color = RENDERER_THEME.colors[hex as keyof typeof RENDERER_THEME.colors] ?? hex;
    const n = Number.parseInt(color.replace('#', ''), 16);
    if (!Number.isFinite(n)) {
        return new Vector3(1, 0.82, 0.42);
    }
    const linear = new Color(n);
    return new Vector3(linear.r, linear.g, linear.b);
};

export const clampCardArcaneGlowDriverUniforms = (
    u: Pick<CardArcaneGlowUniforms, 'uIntensity' | 'uPulse' | 'uMotion'>
): void => {
    u.uIntensity.value = MathUtils.clamp(u.uIntensity.value, 0, 3);
    u.uPulse.value = MathUtils.clamp(u.uPulse.value, 0, 2);
    u.uMotion.value = MathUtils.clamp(u.uMotion.value, 0, 1.5);
};

export const createCardArcaneGlowMaterial = (seed: number): ShaderMaterial => {
    const uniforms: CardArcaneGlowUniforms = {
        uTime: { value: 0 },
        uSeed: { value: (seed % 1000) * 0.001 },
        uIntensity: { value: 0 },
        uPulse: { value: 0 },
        uMotion: { value: 1 },
        uMode: { value: 0 },
        uOuterHalfSize: { value: outerHalfSize.clone() },
        uInnerHalfSize: { value: innerHalfSize.clone() },
        uOuterCorner: { value: 0.108 },
        uInnerCorner: { value: 0.086 },
        uPrimaryColor: { value: colorToVec3(RENDERER_THEME.colors.goldBright) },
        uSecondaryColor: { value: colorToVec3(RENDERER_THEME.colors.cyanBright) },
        uAccentColor: { value: colorToVec3(RENDERER_THEME.colors.emberSoft) }
    };

    return new ShaderMaterial({
        uniforms: uniforms as unknown as { [uniform: string]: { value: unknown } },
        vertexShader,
        fragmentShader: CARD_ARCANE_GLOW_FRAGMENT_SHADER,
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
