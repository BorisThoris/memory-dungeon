import type { MutableRefObject, RefObject } from 'react';
import { MathUtils, type Group } from 'three';
import type { GraphicsQualityPreset, Tile } from '../../shared/contracts';
import { GAMEPLAY_BOARD_VISUALS } from './gameplayVisualConfig';
import type { ResolvingSelectionState } from './tileResolvingSelection';

/**
 * Subset of `TileBezelFrameBag` / props used to decide whether consolidated `useFrame` must run
 * `advanceTileBezelFrame` for this tile. When false for ~2 frames (hysteresis below), idle drift
 * is skipped for that tile (spec: drop subtle motion while quiescent).
 */
export type TileBezelActivityBag = {
    propsRef: MutableRefObject<{
        reduceMotion: boolean;
        faceUp: boolean;
        pickable: boolean;
        focusDimmed: boolean;
        keyboardFocused: boolean;
        graphicsQuality: GraphicsQualityPreset;
        textureRevision: number;
        resolvingSelection: ResolvingSelectionState;
        shuffleMotionDeadlineMs: number;
        shuffleMotionBudgetMs: number;
        shuffleStaggerTileCount: number;
        boardEntranceMotionDeadlineMs: number;
        boardEntranceMotionBudgetMs: number;
        boardEntranceStaggerTileCount: number;
        tile: Tile;
        tileFieldParallaxEnabled: boolean;
        fieldAmp: number;
        fieldTiltRef: MutableRefObject<{ x: number; y: number }>;
        hoverTiltRef: MutableRefObject<{ tileId: string | null; x: number; y: number }>;
        transform: {
            imperfectionRotationX: number;
            imperfectionRotationZ: number;
            layoutYaw: number;
            flipRotationY: number;
            baseX: number;
            baseY: number;
            imperfectionX: number;
            imperfectionY: number;
            layoutJitterX: number;
            layoutJitterY: number;
            layoutJitterZ: number;
        };
    }>;
    groupRef: RefObject<Group | null>;
    flipPopT0Ref: MutableRefObject<number | null>;
    faceUpStructBlendRef: MutableRefObject<number>;
    faceUpStructT0Ref: MutableRefObject<number | null>;
    matchPulseRef: MutableRefObject<number>;
    matchedVictoryBurstT0Ref: MutableRefObject<number | null>;
    liftSmoothRef: MutableRefObject<number>;
    pressingOnCardRef: MutableRefObject<boolean>;
    focusDimBlendRef: MutableRefObject<number>;
    lastActivityVisualGateRef: MutableRefObject<{
        textureRevision: number;
        keyboardFocused: boolean;
        focusDimmed: boolean;
        graphicsQuality: GraphicsQualityPreset;
    } | null>;
};

const POS_EPS = 0.00028;
const ROT_EPS = 0.0004;

export interface TileFrameActivitySchedule {
    nextIdleStreak: number;
    runFrame: boolean;
}

export interface AdvanceScheduledTileBezelFramesInput<TBag extends TileBezelActivityBag> {
    advanceFrame: (bag: TBag) => void;
    bags: Iterable<[string, TBag]>;
    clockElapsedTime: number;
    idleStreaks: Map<string, number>;
    nowMs: number;
    shouldAdvance?: (bag: TBag, clockElapsedTime: number, nowMs: number) => boolean;
}

export interface AdvanceScheduledTileBezelFramesResult {
    advancedCount: number;
    scheduledCount: number;
}

export const scheduleTileBezelFrameActivity = (
    wantsFrame: boolean,
    previousIdleStreak: number
): TileFrameActivitySchedule => {
    const nextIdleStreak = wantsFrame ? 0 : previousIdleStreak + 1;

    return {
        nextIdleStreak,
        runFrame: wantsFrame || nextIdleStreak <= 2
    };
};

export const advanceScheduledTileBezelFrames = <TBag extends TileBezelActivityBag>({
    advanceFrame,
    bags,
    clockElapsedTime,
    idleStreaks,
    nowMs,
    shouldAdvance = shouldAdvanceTileBezelThisFrame
}: AdvanceScheduledTileBezelFramesInput<TBag>): AdvanceScheduledTileBezelFramesResult => {
    let advancedCount = 0;
    let scheduledCount = 0;

    for (const [id, bag] of bags) {
        const schedule = scheduleTileBezelFrameActivity(
            shouldAdvance(bag, clockElapsedTime, nowMs),
            idleStreaks.get(id) ?? 0
        );
        idleStreaks.set(id, schedule.nextIdleStreak);
        scheduledCount += 1;

        if (schedule.runFrame) {
            advanceFrame(bag);
            advancedCount += 1;
        }
    }

    return { advancedCount, scheduledCount };
};

export function shouldAdvanceTileBezelThisFrame(
    bag: TileBezelActivityBag,
    clockElapsedTime: number,
    nowMs: number
): boolean {
    const p = bag.propsRef.current;
    const group = bag.groupRef.current;

    if (!group) {
        return false;
    }

    const gate = bag.lastActivityVisualGateRef.current;

    if (
        !gate ||
        gate.textureRevision !== p.textureRevision ||
        gate.keyboardFocused !== p.keyboardFocused ||
        gate.focusDimmed !== p.focusDimmed ||
        gate.graphicsQuality !== p.graphicsQuality
    ) {
        return true;
    }

    /** Reduce-motion path: skip idle tiles unless resolving, burst, dim/lift/rot settle, or rim-fire shader (time uniform). */
    if (p.reduceMotion) {
        if (p.resolvingSelection != null) {
            return true;
        }

        if (bag.matchPulseRef.current > 0.002) {
            return true;
        }

        const matchedBurstT0 = bag.matchedVictoryBurstT0Ref.current;

        if (matchedBurstT0 != null && p.tile.state === 'matched') {
            const burstDuration = GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.burstDuration.reduceMotion;

            if (clockElapsedTime - matchedBurstT0 < burstDuration * 1.02) {
                return true;
            }
        }

        const rimFireNeedsClock =
            p.graphicsQuality !== 'low' &&
            p.tile.state === 'matched' &&
            p.faceUp &&
            p.resolvingSelection === null;

        if (rimFireNeedsClock) {
            return true;
        }

        const dimTarget = p.focusDimmed && !p.faceUp && p.tile.state === 'hidden' ? 1 : 0;

        if (Math.abs(bag.focusDimBlendRef.current - dimTarget) > 0.02) {
            return true;
        }

        const isMatched = p.tile.state === 'matched';
        const structBlend = bag.faceUpStructBlendRef.current;
        const baseLiftFull = isMatched ? 0.0024 : p.faceUp ? 0.0012 : 0;
        const liftGoal = baseLiftFull * structBlend;

        if (Math.abs(bag.liftSmoothRef.current - liftGoal) > POS_EPS) {
            return true;
        }

        const field = p.fieldTiltRef.current;
        const fieldOn = p.tileFieldParallaxEnabled;
        const fieldRotX = fieldOn ? MathUtils.clamp(-field.y, -1, 1) * p.fieldAmp * (isMatched ? 0.042 : 0.074) : 0;
        const fieldRotZ = fieldOn ? MathUtils.clamp(field.x, -1, 1) * p.fieldAmp * (isMatched ? 0.038 : 0.068) : 0;
        const rotationYTarget = p.transform.layoutYaw + p.transform.flipRotationY;
        const rotXTarget = p.transform.imperfectionRotationX + fieldRotX;
        const rotZTarget = p.transform.imperfectionRotationZ + fieldRotZ;

        if (
            Math.abs(group.rotation.y - rotationYTarget) > ROT_EPS ||
            Math.abs(group.rotation.x - rotXTarget) > ROT_EPS ||
            Math.abs(group.rotation.z - rotZTarget) > ROT_EPS
        ) {
            return true;
        }

        const fieldLift = fieldOn
            ? MathUtils.clamp(Math.hypot(field.x, field.y), 0, 1) * p.fieldAmp * (isMatched ? 0.00035 : 0.00062)
            : 0;
        const fieldDepth = fieldOn
            ? MathUtils.clamp(Math.hypot(field.x, field.y), 0, 1) * p.fieldAmp * (isMatched ? 0.0005 : 0.00095)
            : 0;
        const structDepth = (isMatched ? 0.0036 : p.faceUp ? 0.0018 : 0) * structBlend;
        const targetZ = structDepth + fieldDepth + p.transform.layoutJitterZ;

        if (Math.abs(group.position.z - targetZ) > POS_EPS) {
            return true;
        }

        const liftSmooth = bag.liftSmoothRef.current;
        const baseTargetX = p.transform.baseX + p.transform.imperfectionX + p.transform.layoutJitterX;
        const baseTargetY =
            p.transform.baseY + p.transform.imperfectionY + p.transform.layoutJitterY + liftSmooth + fieldLift;

        if (
            Math.abs(group.position.x - baseTargetX) > POS_EPS ||
            Math.abs(group.position.y - baseTargetY) > POS_EPS
        ) {
            return true;
        }

        return false;
    }

    const shuffleLayoutActive = p.shuffleMotionDeadlineMs > 0 && nowMs < p.shuffleMotionDeadlineMs;
    const entranceLayoutActive =
        !shuffleLayoutActive &&
        p.boardEntranceMotionDeadlineMs > 0 &&
        nowMs < p.boardEntranceMotionDeadlineMs;

    if (shuffleLayoutActive || entranceLayoutActive) {
        return true;
    }

    const fp0 = bag.flipPopT0Ref.current;

    if (fp0 != null && clockElapsedTime - fp0 < 0.22) {
        return true;
    }

    if (p.faceUp) {
        if (bag.faceUpStructT0Ref.current != null) {
            return true;
        }
        if (bag.faceUpStructBlendRef.current < 0.998) {
            return true;
        }
    }

    if (p.resolvingSelection != null) {
        return true;
    }

    if (p.graphicsQuality !== 'low' && p.keyboardFocused && p.pickable && p.tile.state !== 'matched') {
        return true;
    }

    if (bag.matchPulseRef.current > 0.002) {
        return true;
    }

    const matchedBurstT0 = bag.matchedVictoryBurstT0Ref.current;

    if (matchedBurstT0 != null && p.tile.state === 'matched') {
        const burstDuration = GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.burstDuration.default;

        if (clockElapsedTime - matchedBurstT0 < burstDuration * 1.02) {
            return true;
        }
    }

    if (bag.pressingOnCardRef.current) {
        return true;
    }

    const hoverTilt = p.hoverTiltRef.current;

    if (hoverTilt.tileId === p.tile.id) {
        return true;
    }

    if (p.tileFieldParallaxEnabled && Math.hypot(p.fieldTiltRef.current.x, p.fieldTiltRef.current.y) > 0.035) {
        return true;
    }

    const isMatched = p.tile.state === 'matched';
    const structBlend = bag.faceUpStructBlendRef.current;
    const baseLiftFull = isMatched ? 0.0024 : p.faceUp ? 0.0012 : 0;
    const hoveredMotion = hoverTilt.tileId === p.tile.id;
    const hoverDomParity = hoveredMotion && !p.faceUp && p.tile.state !== 'matched';
    const hoverLift = hoverDomParity ? (isMatched ? 0.0012 : GAMEPLAY_BOARD_VISUALS.hoverHiddenLift) : 0;
    const liftGoal = baseLiftFull * structBlend + hoverLift;

    if (Math.abs(bag.liftSmoothRef.current - liftGoal) > POS_EPS) {
        return true;
    }

    const field = p.fieldTiltRef.current;
    const fieldOn = p.tileFieldParallaxEnabled;
    const fieldRotX = fieldOn ? MathUtils.clamp(-field.y, -1, 1) * p.fieldAmp * (isMatched ? 0.042 : 0.074) : 0;
    const fieldRotZ = fieldOn ? MathUtils.clamp(field.x, -1, 1) * p.fieldAmp * (isMatched ? 0.038 : 0.068) : 0;
    const hoverDomParity2 = hoveredMotion && !p.faceUp && p.tile.state !== 'matched';
    const hoverTiltX = hoverDomParity2
        ? MathUtils.clamp(-hoverTilt.y, -1, 1) * (isMatched ? 0.05 : GAMEPLAY_BOARD_VISUALS.hoverHiddenTiltX)
        : 0;
    const hoverTiltZ = hoverDomParity2
        ? MathUtils.clamp(hoverTilt.x, -1, 1) * (isMatched ? 0.046 : GAMEPLAY_BOARD_VISUALS.hoverHiddenTiltZ)
        : 0;
    const rotationYTarget = p.transform.layoutYaw + p.transform.flipRotationY;
    const rotXTarget = p.transform.imperfectionRotationX + fieldRotX + hoverTiltX;
    const rotZTarget = p.transform.imperfectionRotationZ + fieldRotZ + hoverTiltZ;

    if (
        Math.abs(group.rotation.y - rotationYTarget) > ROT_EPS ||
        Math.abs(group.rotation.x - rotXTarget) > ROT_EPS ||
        Math.abs(group.rotation.z - rotZTarget) > ROT_EPS
    ) {
        return true;
    }

    const fieldLift = fieldOn
        ? MathUtils.clamp(Math.hypot(field.x, field.y), 0, 1) * p.fieldAmp * (isMatched ? 0.00035 : 0.00062)
        : 0;
    const fieldDepth = fieldOn
        ? MathUtils.clamp(Math.hypot(field.x, field.y), 0, 1) * p.fieldAmp * (isMatched ? 0.0005 : 0.00095)
        : 0;
    const structDepth = (isMatched ? 0.0036 : p.faceUp ? 0.0018 : 0) * structBlend;
    const hoverDepth = hoverDomParity2 ? (isMatched ? 0.0018 : GAMEPLAY_BOARD_VISUALS.hoverHiddenDepth) : 0;
    const targetZ = structDepth + hoverDepth + fieldDepth + p.transform.layoutJitterZ;

    if (Math.abs(group.position.z - targetZ) > POS_EPS) {
        return true;
    }

    const liftSmooth = bag.liftSmoothRef.current;
    const baseTargetX = p.transform.baseX + p.transform.imperfectionX + p.transform.layoutJitterX;
    const baseTargetY =
        p.transform.baseY + p.transform.imperfectionY + p.transform.layoutJitterY + liftSmooth + fieldLift;
    const mismatchShakeX =
        p.resolvingSelection === 'mismatch'
            ? Math.sin(clockElapsedTime * 36) * GAMEPLAY_BOARD_VISUALS.mismatchShakeX
            : 0;
    const mismatchShakeY =
        p.resolvingSelection === 'mismatch'
            ? Math.cos(clockElapsedTime * 29) * GAMEPLAY_BOARD_VISUALS.mismatchShakeY
            : 0;

    if (
        Math.abs(group.position.x - (baseTargetX + mismatchShakeX)) > POS_EPS ||
        Math.abs(group.position.y - (baseTargetY + mismatchShakeY)) > POS_EPS
    ) {
        return true;
    }

    return false;
}
