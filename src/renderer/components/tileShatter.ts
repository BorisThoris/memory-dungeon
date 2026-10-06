import { Color, Vector3, type Euler } from 'three';
import type { Tile } from '../../shared/contracts';
import { RENDERER_THEME } from '../styles/theme';

/**
 * Match discharge / shatter FX: `createTileShatterEffect` allocates pulse specs and `Vector3`/`Color` helpers per burst.
 * Pooling would reduce GC on low-end GPUs but adds lifecycle coupling to Three materials; profile before changing.
 * Dev frame budgeting uses `boardWebglPerfSample` in `TileBoardScene`, not per-shard counters here.
 */
export const TILE_SPACING = 1.24;
/** Narrow stages spend less width between cards so the fitted suits and tap targets stay legible. */
export const getTileColumnSpacing = (compact: boolean): number => compact ? 0.92 : 0.98;
/** Organic layout: max XY offset from nominal grid (world units); deterministic per tile id. */
export const BOARD_LAYOUT_JITTER_XY = 0.028;
/** Organic layout: max idle Y rotation (rad) for a scattered-table read. */
export const BOARD_LAYOUT_YAW_MAX = 0.1;
/** Organic layout: subtle depth variation (world units). */
export const BOARD_LAYOUT_JITTER_Z = 0.0045;
/** Small alternating row offset keeps the dealt feel without obscuring column adjacency. */
export const BOARD_LAYOUT_ROW_STAGGER_X = 0.10;
/** Extra half-extent on boardWorldWidth/Height so fit-zoom does not clip jittered corners. */
export const BOARD_LAYOUT_VIEWPORT_PADDING = 0.16;
/**
 * Card art planes in `TileBoardScene` — keep textures’ canvas aspect in sync to avoid stretching square PNGs.
 * Pipeline: `scripts/card-pipeline/cardTextureConstants.mjs`, `yarn imagegen --resolution card-plane`, `scripts/card-pipeline/normalize-card-texture.ps1`.
 */
export const CARD_PLANE_WIDTH = 0.74;
export const CARD_PLANE_HEIGHT = 1.08;
export const TILE_DEPTH = 0.006;
export const SHELL_SCALE = 1.04;
export const CORE_SCALE = 0.88;

const DISCHARGE_LAYOUT_VERSION = 1;

export type TileShatterMode = 'pulse' | 'fade';

export type TileShatterVec3 = [number, number, number];

export interface TileShatterImpactAnchor {
    x: number;
    y: number;
}

export interface TileShatterTransform {
    position: Vector3;
    rotation: Euler;
    shellScale: number;
    coreScale: number;
    seed: number;
}

export interface TileDischargePulseSpec {
    delayMs: number;
    durationMs: number;
    offset: TileShatterVec3;
    opacity: number;
    scaleFrom: number;
    scaleTo: number;
    tint: string;
}

export interface TileShatterEffectData {
    tileId: string;
    startedAtMs: number;
    durationMs: number;
    mode: TileShatterMode;
    impactAnchor: TileShatterImpactAnchor;
    impactPoint: TileShatterVec3;
    position: TileShatterVec3;
    rotation: TileShatterVec3;
    shellScale: number;
    coreScale: number;
    impactNormal: TileShatterVec3;
    coreTint: string;
    shellTint: string;
    coreOpacity: number;
    flashTint: string;
    pulses: TileDischargePulseSpec[];
}

interface TileShatterFramePulseState {
    opacity: number;
    position: TileShatterVec3;
    scale: number;
    tint: string;
}

interface TileShatterFrameState {
    completed: boolean;
    coreOpacity: number;
    flashOpacity: number;
    flashScale: number;
    groupScale: TileShatterVec3;
    progress: number;
    shellOpacity: number;
    pulseStates: TileShatterFramePulseState[];
}

interface TileShatterSpawnCandidate {
    index: number;
    tile: Tile;
}

const createSeededRandom = (seed: number): (() => number) => {
    let state = seed || 1;

    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let value = Math.imul(state ^ (state >>> 15), 1 | state);
        value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
};

const hashString = (value: string): number => {
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) | 0;
    }

    return hash >>> 0;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const smoothstep = (edge0: number, edge1: number, value: number): number => {
    if (edge0 === edge1) {
        return value < edge0 ? 0 : 1;
    }

    const normalized = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return normalized * normalized * (3 - 2 * normalized);
};

const mixColor = (from: string, to: string, amount: number): string => {
    const color = new Color(from);
    color.lerp(new Color(to), clamp(amount, 0, 1));
    return `#${color.getHexString()}`;
};

const toVec3 = (vector: Vector3): TileShatterVec3 => [vector.x, vector.y, vector.z];

const buildPulseSpecs = (
    rng: () => number,
    impactPoint: Vector3,
    impactNormal: Vector3,
    compact: boolean,
    durationMs: number
): TileDischargePulseSpec[] => {
    const { colors } = RENDERER_THEME;
    const pulseCount = compact ? 3 : 4;
    const pulses: TileDischargePulseSpec[] = [];

    for (let index = 0; index < pulseCount; index += 1) {
        const delayMs = Math.round(index * (compact ? 64 : 78) + rng() * 20);
        const pulseDuration = Math.round(durationMs * clamp(0.28 + index * 0.06 + rng() * 0.06, 0.24, 0.56));
        const scaleFrom = 0.1 + index * 0.07 + rng() * 0.04;
        const scaleTo = (compact ? 0.62 : 0.74) + index * 0.2 + rng() * 0.1;
        const opacity = clamp(0.52 - index * 0.07 + rng() * 0.08, 0.14, 0.62);
        const offset = new Vector3(
            impactPoint.x + impactNormal.x * 0.03 + (rng() - 0.5) * 0.03,
            impactPoint.y + impactNormal.y * 0.03 + (rng() - 0.5) * 0.03,
            impactPoint.z + 0.008 + index * 0.009
        );
        const baseTint = index % 2 === 0 ? colors.goldBright : colors.cyanBright;
        const accentTint = index % 3 === 0 ? colors.emberSoft : colors.cyan;
        const tint = mixColor(baseTint, accentTint, 0.3 + rng() * 0.4);

        pulses.push({
            delayMs,
            durationMs: pulseDuration,
            offset: toVec3(offset),
            opacity,
            scaleFrom,
            scaleTo,
            tint
        });
    }

    return pulses.sort((left, right) => left.delayMs - right.delayMs || left.scaleFrom - right.scaleFrom);
};

export const getTileShatterFrameState = (effect: TileShatterEffectData, nowMs: number): TileShatterFrameState => {
    const elapsedMs = Math.max(nowMs - effect.startedAtMs, 0);
    const progress = clamp(elapsedMs / effect.durationMs, 0, 1);
    const collapseProgress = effect.mode === 'pulse' ? smoothstep(0.08, 0.84, progress) : smoothstep(0.12, 0.9, progress);
    const flashProgress = effect.mode === 'pulse' ? smoothstep(0, 0.08, progress) * (1 - smoothstep(0.16, 0.38, progress)) : 0;
    const shellFadeProgress = effect.mode === 'pulse' ? smoothstep(0.16, 0.96, progress) : smoothstep(0.08, 0.9, progress);
    const coreFadeProgress = effect.mode === 'pulse' ? smoothstep(0.22, 0.98, progress) : smoothstep(0.16, 0.96, progress);
    const pulseStates: TileShatterFramePulseState[] =
        effect.mode === 'pulse'
            ? effect.pulses.map((pulse) => {
                  const localMs = elapsedMs - pulse.delayMs;
                  const pulseProgress = clamp(localMs / Math.max(1, pulse.durationMs), 0, 1);
                  const visible = localMs > 0 && localMs <= pulse.durationMs;
                  const rise = smoothstep(0, 0.15, pulseProgress);
                  const fall = 1 - smoothstep(0.28, 1, pulseProgress);
                  const opacity = visible ? pulse.opacity * rise * fall : 0;
                  const spread = smoothstep(0, 1, pulseProgress);
                  const scale = pulse.scaleFrom + (pulse.scaleTo - pulse.scaleFrom) * spread;

                  return {
                      opacity,
                      position: [
                          pulse.offset[0],
                          pulse.offset[1],
                          pulse.offset[2] + spread * 0.04
                      ],
                      scale,
                      tint: pulse.tint
                  };
              })
            : [];
    const groupScale: TileShatterVec3 = [
        effect.shellScale * (1 - collapseProgress * 0.02),
        effect.shellScale * (1 - collapseProgress * 0.02),
        effect.shellScale * (1 - collapseProgress * 0.034)
    ];

    return {
        completed: progress >= 1,
        coreOpacity: effect.coreOpacity * (1 - coreFadeProgress),
        flashOpacity: effect.mode === 'pulse' ? effect.coreOpacity * flashProgress * 0.95 : 0,
        flashScale: 0.12 + flashProgress * 0.88,
        groupScale,
        progress,
        shellOpacity: effect.coreOpacity * (1 - shellFadeProgress),
        pulseStates
    };
};

export const getNewlyMatchedTiles = (
    tiles: readonly Tile[],
    previousMatchedIds: ReadonlySet<string>,
    activeShatterIds: ReadonlySet<string>,
    settledMatchedIds: ReadonlySet<string>
): TileShatterSpawnCandidate[] => {
    const newlyMatched: TileShatterSpawnCandidate[] = [];

    tiles.forEach((tile, index) => {
        if (tile.state !== 'matched') {
            return;
        }

        if (previousMatchedIds.has(tile.id) || activeShatterIds.has(tile.id) || settledMatchedIds.has(tile.id)) {
            return;
        }

        newlyMatched.push({ index, tile });
    });

    return newlyMatched;
};

export const createTileShatterEffect = (
    tile: Tile,
    transform: TileShatterTransform,
    compact: boolean,
    reduceMotion: boolean,
    startedAtMs: number,
    impactAnchor?: TileShatterImpactAnchor
): TileShatterEffectData => {
    const { colors } = RENDERER_THEME;
    const layoutSeed = hashString(`${tile.id}:${transform.seed}:bezel-pulse:v${DISCHARGE_LAYOUT_VERSION}`);
    const rng = createSeededRandom(layoutSeed);
    const mode: TileShatterMode = reduceMotion ? 'fade' : 'pulse';
    const durationMs = reduceMotion ? 180 : compact ? 640 : 780;
    const normalizedImpactAnchor: TileShatterImpactAnchor = impactAnchor
        ? {
              x: clamp(impactAnchor.x, -1, 1),
              y: clamp(impactAnchor.y, -1, 1)
          }
        : {
              x: 0,
              y: 0
          };
    const impactPoint = new Vector3(
        normalizedImpactAnchor.x * (compact ? 0.2 : 0.24),
        normalizedImpactAnchor.y * (compact ? 0.2 : 0.24),
        0.05 + rng() * 0.04
    );
    const impactNormal = new Vector3(normalizedImpactAnchor.x * 0.22, normalizedImpactAnchor.y * 0.22, 1.24 + rng() * 0.14).normalize();
    const effectPosition = transform.position.clone().setZ(0.03);
    const shellTint = mixColor(colors.smokeDeep, colors.goldDeep, 0.28);
    const coreTint = mixColor(colors.smokeDeep, reduceMotion ? colors.cyanBright : colors.goldBright, reduceMotion ? 0.32 : 0.24);

    return {
        coreOpacity: reduceMotion ? 0.9 : 0.96,
        coreScale: transform.coreScale,
        coreTint,
        durationMs,
        flashTint: mixColor(colors.goldBright, colors.cyanBright, 0.38),
        impactAnchor: normalizedImpactAnchor,
        impactNormal: toVec3(impactNormal),
        impactPoint: toVec3(impactPoint),
        mode,
        position: toVec3(effectPosition),
        pulses: mode === 'pulse' ? buildPulseSpecs(rng, impactPoint, impactNormal, compact, durationMs) : [],
        rotation: [transform.rotation.x, transform.rotation.y, transform.rotation.z],
        shellScale: transform.shellScale,
        shellTint,
        startedAtMs,
        tileId: tile.id
    };
};
