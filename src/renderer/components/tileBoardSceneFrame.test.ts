import { describe, expect, it } from 'vitest';
import { Group } from 'three';
import { gameplayRenderQualityProfile } from './gameplayRenderProfile';
import { runTileBoardSceneFrame } from './tileBoardSceneFrame';
import type { TileBoardRuneFieldUniformTarget } from './tileBoardRuneField';

const boardViewport = {
    fitZoom: 1,
    panX: 2,
    panY: -3,
    zoom: 1.5
};

const runeUniforms = (): TileBoardRuneFieldUniformTarget & { grid: { x: number; y: number } } => {
    const target = {
        grid: { x: 0, y: 0 },
        uGrid: {
            value: {
                set(x: number, y: number): void {
                    target.grid.x = x;
                    target.grid.y = y;
                }
            }
        },
        uIntensity: { value: 0 },
        uMotion: { value: 0 },
        uTime: { value: 0 }
    };

    return target;
};

describe('tileBoardSceneFrame', () => {
    it('skips tile frame advancement in legacy tile-step mode', () => {
        let advanced = 0;
        const perfPhases: Array<{ tileStepMs: number; viewportMs: number }> = [];

        const result = runTileBoardSceneFrame({
            accumulatePerfPhases: (phases) => perfPhases.push(phases),
            advanceTileFrame: () => {
                advanced += 1;
            },
            bags: new Map(),
            boardGroup: null,
            boardRuneFieldMetrics: { centerX: 0, centerY: 0, height: 4, width: 6 },
            boardViewport,
            clockElapsedTime: 10,
            delta: 0.016,
            idleStreaks: new Map(),
            interactionSuppressed: false,
            now: () => 100,
            perfOn: false,
            reduceMotion: false,
            runeFieldUniforms: null,
            sceneRenderQuality: gameplayRenderQualityProfile('medium'),
            tileStepLegacy: true
        });

        expect(advanced).toBe(0);
        expect(perfPhases).toEqual([]);
        expect(result.tileFrames).toBeNull();
        expect(result.viewportUpdated).toBe(false);
        expect(result.runeFieldUpdated).toBe(false);
    });

    it('updates viewport motion and records perf phases when sampling is on', () => {
        const group = new Group();
        const perfPhases: Array<{ tileStepMs: number; viewportMs: number }> = [];
        const ticks = [10, 12, 17, 30, 37];

        const result = runTileBoardSceneFrame({
            accumulatePerfPhases: (phases) => perfPhases.push(phases),
            advanceTileFrame: () => undefined,
            bags: new Map(),
            boardGroup: group,
            boardRuneFieldMetrics: { centerX: 0, centerY: 0, height: 4, width: 6 },
            boardViewport,
            clockElapsedTime: 10,
            delta: 0.016,
            idleStreaks: new Map(),
            interactionSuppressed: false,
            now: () => ticks.shift() ?? 37,
            perfOn: true,
            reduceMotion: true,
            runeFieldUniforms: null,
            sceneRenderQuality: gameplayRenderQualityProfile('medium'),
            tileStepLegacy: false
        });

        expect(result.tileFrames).toEqual({ advancedCount: 0, scheduledCount: 0 });
        expect(result.viewportUpdated).toBe(true);
        expect(group.position.x).toBe(2);
        expect(group.position.y).toBe(-3);
        expect(group.scale.x).toBe(1.5);
        expect(perfPhases).toEqual([{ tileStepMs: 7, viewportMs: 7 }]);
    });

    it('updates rune field uniforms after the viewport phase', () => {
        const uniforms = runeUniforms();

        const result = runTileBoardSceneFrame({
            accumulatePerfPhases: () => undefined,
            advanceTileFrame: () => undefined,
            bags: new Map(),
            boardGroup: null,
            boardRuneFieldMetrics: { centerX: 0, centerY: 0, height: 8, width: 12 },
            boardViewport,
            clockElapsedTime: 22,
            delta: 0.016,
            idleStreaks: new Map(),
            interactionSuppressed: false,
            now: () => 100,
            perfOn: false,
            reduceMotion: true,
            runeFieldUniforms: uniforms,
            sceneRenderQuality: gameplayRenderQualityProfile('high'),
            tileStepLegacy: true
        });

        expect(result.runeFieldUpdated).toBe(true);
        expect(uniforms.uTime.value).toBe(22);
        expect(uniforms.uIntensity.value).toBeCloseTo(gameplayRenderQualityProfile('high').stageRuneFieldIntensity * 0.46);
        expect(uniforms.uMotion.value).toBe(0.06);
        expect(uniforms.grid).toEqual({ x: 12, y: 8 });
    });
});
