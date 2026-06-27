import {
    AdditiveBlending,
    DoubleSide,
    MathUtils,
    ShaderMaterial,
    Vector2,
    Vector3
} from 'three';
import { RENDERER_THEME } from '../styles/theme';
import { BOARD_RUNE_FIELD_FRAGMENT_SHADER } from './boardRuneFieldShaderGlsl';

const vertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const hexToVec3 = (hex: string): Vector3 => {
    const n = Number.parseInt(hex.replace('#', ''), 16);
    if (!Number.isFinite(n)) {
        return new Vector3(1, 0.78, 0.42);
    }
    return new Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

type BoardRuneFieldUniforms = {
    uTime: { value: number };
    uIntensity: { value: number };
    uMotion: { value: number };
    uGoldColor: { value: Vector3 };
    uCyanColor: { value: Vector3 };
    uGrid: { value: Vector2 };
};

export const clampBoardRuneFieldDriverUniforms = (
    u: Pick<BoardRuneFieldUniforms, 'uIntensity' | 'uMotion'>
): void => {
    u.uIntensity.value = MathUtils.clamp(u.uIntensity.value, 0, 1.4);
    u.uMotion.value = MathUtils.clamp(u.uMotion.value, 0, 1.3);
};

export const createBoardRuneFieldMaterial = (): ShaderMaterial => {
    const uniforms: BoardRuneFieldUniforms = {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uMotion: { value: 1 },
        uGoldColor: { value: hexToVec3(RENDERER_THEME.colors.goldBright) },
        uCyanColor: { value: hexToVec3(RENDERER_THEME.colors.cyanBright) },
        uGrid: { value: new Vector2(1, 1) }
    };

    return new ShaderMaterial({
        uniforms: uniforms as unknown as { [uniform: string]: { value: unknown } },
        vertexShader,
        fragmentShader: BOARD_RUNE_FIELD_FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        toneMapped: false
    });
};
