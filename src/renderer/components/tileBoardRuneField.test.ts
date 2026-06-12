import { describe, expect, it } from 'vitest';
import type { TileTransform } from './tileBoardTransform';
import {
    applyTileBoardRuneFieldUniformState,
    computeTileBoardRuneFieldMetrics,
    computeTileBoardRuneFieldUniformState
} from './tileBoardRuneField';

const transform = (overrides: Partial<TileTransform> = {}): TileTransform => ({
    baseX: 0,
    baseY: 0,
    baseScale: 1,
    bezelScale: 1,
    panelScale: 1,
    imperfectionRotationX: 0,
    imperfectionRotationZ: 0,
    imperfectionX: 0,
    imperfectionY: 0,
    flipRotationY: 0,
    layoutJitterX: 0,
    layoutJitterY: 0,
    layoutJitterZ: 0,
    layoutYaw: 0,
    seed: 1,
    ...overrides
});

describe('tileBoardRuneField', () => {
    it('uses a stable fallback footprint when no tiles are present', () => {
        expect(
            computeTileBoardRuneFieldMetrics({
                cardHeight: 2,
                cardWidth: 1,
                tileSpacing: 3,
                transforms: []
            })
        ).toEqual({ centerX: 0, centerY: 0, height: 6, width: 4 });
    });

    it('respects minimum card footprint for a single tile', () => {
        const metrics = computeTileBoardRuneFieldMetrics({
            cardHeight: 2,
            cardWidth: 1,
            tileSpacing: 3,
            transforms: [transform()]
        });

        expect(metrics.centerX).toBeCloseTo(0);
        expect(metrics.centerY).toBeCloseTo(0);
        expect(metrics.height).toBeCloseTo(5.2);
        expect(metrics.width).toBeCloseTo(3.72);
    });

    it('expands and centers around layout jitter and imperfections', () => {
        const metrics = computeTileBoardRuneFieldMetrics({
            cardHeight: 2,
            cardWidth: 1,
            tileSpacing: 3,
            transforms: [
                transform({ baseX: -4, baseY: 2, imperfectionX: -0.25, layoutJitterY: 0.5 }),
                transform({ baseX: 3, baseY: -1, layoutJitterX: 0.75, imperfectionY: -0.25 })
            ]
        });

        expect(metrics.centerX).toBeCloseTo(-0.25);
        expect(metrics.centerY).toBeCloseTo(0.625);
        expect(metrics.width).toBeCloseTo(11.72);
        expect(metrics.height).toBeCloseTo(8.67);
    });

    it('builds full-motion uniform targets from render quality and metrics', () => {
        const state = computeTileBoardRuneFieldUniformState({
            elapsedTime: 12.5,
            metrics: { centerX: 0, centerY: 0, height: 4.2, width: 7.4 },
            reduceMotion: false,
            renderQuality: {
                stageRuneFieldIntensity: 0.72,
                stageRuneFieldMotion: 1
            }
        });

        expect(state).toEqual({
            gridHeight: 4.2,
            gridWidth: 7.4,
            intensity: 0.72,
            motion: 1,
            time: 12.5
        });
    });

    it('softens rune-field intensity and caps motion for reduced motion', () => {
        const state = computeTileBoardRuneFieldUniformState({
            elapsedTime: 8,
            metrics: { centerX: 1, centerY: 2, height: 5, width: 6 },
            reduceMotion: true,
            renderQuality: {
                stageRuneFieldIntensity: 0.5,
                stageRuneFieldMotion: 0.68
            }
        });

        expect(state.intensity).toBeCloseTo(0.23);
        expect(state.motion).toBe(0.06);
        expect(state.gridWidth).toBe(6);
        expect(state.gridHeight).toBe(5);
    });

    it('keeps lower reduced-motion values when render quality is already muted', () => {
        const state = computeTileBoardRuneFieldUniformState({
            elapsedTime: 8,
            metrics: { centerX: 1, centerY: 2, height: 5, width: 6 },
            reduceMotion: true,
            renderQuality: {
                stageRuneFieldIntensity: 0,
                stageRuneFieldMotion: 0.02
            }
        });

        expect(state.intensity).toBe(0);
        expect(state.motion).toBe(0.02);
    });

    it('applies rune-field uniform state to shader uniforms', () => {
        const grid = { x: 0, y: 0 };
        const uniforms = {
            uTime: { value: 0 },
            uIntensity: { value: 0 },
            uMotion: { value: 0 },
            uGrid: {
                value: {
                    set(x: number, y: number): void {
                        grid.x = x;
                        grid.y = y;
                    }
                }
            }
        };

        applyTileBoardRuneFieldUniformState(uniforms, {
            gridHeight: 8,
            gridWidth: 12,
            intensity: 0.75,
            motion: 0.4,
            time: 6.5
        });

        expect(uniforms.uTime.value).toBe(6.5);
        expect(uniforms.uIntensity.value).toBe(0.75);
        expect(uniforms.uMotion.value).toBe(0.4);
        expect(grid).toEqual({ x: 12, y: 8 });
    });

    it('clamps rune-field driver uniforms while applying state', () => {
        const uniforms = {
            uTime: { value: 0 },
            uIntensity: { value: 0 },
            uMotion: { value: 0 },
            uGrid: {
                value: {
                    set(): void {
                        return undefined;
                    }
                }
            }
        };

        applyTileBoardRuneFieldUniformState(uniforms, {
            gridHeight: 1,
            gridWidth: 1,
            intensity: 3,
            motion: 4,
            time: 0
        });

        expect(uniforms.uIntensity.value).toBe(1.4);
        expect(uniforms.uMotion.value).toBe(1.3);
    });
});
