import type { TileTransform } from './tileBoardTransform';
import { clampBoardRuneFieldDriverUniforms } from './boardRuneFieldMaterial';

export interface TileBoardRuneFieldMetrics {
    centerX: number;
    centerY: number;
    height: number;
    width: number;
}

interface TileBoardRuneFieldUniformState {
    gridHeight: number;
    gridWidth: number;
    intensity: number;
    motion: number;
    time: number;
}

export interface TileBoardRuneFieldUniformTarget {
    uGrid: { value: { set: (x: number, y: number) => void } };
    uIntensity: { value: number };
    uMotion: { value: number };
    uTime: { value: number };
}

interface ComputeTileBoardRuneFieldMetricsInput {
    cardHeight: number;
    cardWidth: number;
    tileSpacing: number;
    transforms: readonly TileTransform[];
}

export const computeTileBoardRuneFieldMetrics = ({
    cardHeight,
    cardWidth,
    tileSpacing,
    transforms
}: ComputeTileBoardRuneFieldMetricsInput): TileBoardRuneFieldMetrics => {
    if (transforms.length === 0) {
        return { centerX: 0, centerY: 0, height: cardHeight * 3, width: cardWidth * 4 };
    }

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const transform of transforms) {
        const x = transform.baseX + transform.imperfectionX + transform.layoutJitterX;
        const y = transform.baseY + transform.imperfectionY + transform.layoutJitterY;
        minX = Math.min(minX, x - cardWidth * 0.78);
        maxX = Math.max(maxX, x + cardWidth * 0.78);
        minY = Math.min(minY, y - cardHeight * 0.78);
        maxY = Math.max(maxY, y + cardHeight * 0.78);
    }

    const padX = tileSpacing * 0.72;
    const padY = tileSpacing * 0.6;

    return {
        centerX: (minX + maxX) * 0.5,
        centerY: (minY + maxY) * 0.5,
        height: Math.max(cardHeight * 2.6, maxY - minY + padY),
        width: Math.max(cardWidth * 3.4, maxX - minX + padX)
    };
};

export const computeTileBoardRuneFieldUniformState = ({
    elapsedTime,
    metrics,
    reduceMotion,
    renderQuality
}: {
    elapsedTime: number;
    metrics: TileBoardRuneFieldMetrics;
    reduceMotion: boolean;
    renderQuality: {
        stageRuneFieldIntensity: number;
        stageRuneFieldMotion: number;
    };
}): TileBoardRuneFieldUniformState => ({
    gridHeight: metrics.height,
    gridWidth: metrics.width,
    intensity: reduceMotion
        ? renderQuality.stageRuneFieldIntensity * 0.46
        : renderQuality.stageRuneFieldIntensity,
    motion: reduceMotion
        ? Math.min(renderQuality.stageRuneFieldMotion, 0.06)
        : renderQuality.stageRuneFieldMotion,
    time: elapsedTime
});

export const applyTileBoardRuneFieldUniformState = (
    uniforms: TileBoardRuneFieldUniformTarget,
    state: TileBoardRuneFieldUniformState
): void => {
    uniforms.uTime.value = state.time;
    uniforms.uIntensity.value = state.intensity;
    uniforms.uMotion.value = state.motion;
    uniforms.uGrid.value.set(state.gridWidth, state.gridHeight);
    clampBoardRuneFieldDriverUniforms({ uIntensity: uniforms.uIntensity, uMotion: uniforms.uMotion });
};
