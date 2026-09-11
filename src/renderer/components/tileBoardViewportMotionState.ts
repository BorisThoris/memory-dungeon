import { MathUtils } from 'three';
import { BOARD_SHAKE_AT_REST, type BoardShakeSample } from './boardTrauma';
import type { TileBoardViewportState } from './tileBoardViewport';

export const BOARD_VIEWPORT_IDLE_DAMPING = 5.2;
export const BOARD_VIEWPORT_ACTIVE_DAMPING = 7.4;
export const BOARD_VIEWPORT_IDLE_SCALE_DAMPING = 4.8;
export const BOARD_VIEWPORT_ACTIVE_SCALE_DAMPING = 6.8;

interface TileBoardViewportMotionState {
    instant: boolean;
    panDamping: number;
    scaleDamping: number;
    /** The trauma shake for this frame, added on top of the damped pan rather than damped with it. */
    shake: BoardShakeSample;
    targetPanX: number;
    targetPanY: number;
    targetScale: number;
}

/**
 * The damped pan, kept by the caller. The shake has to be added AFTER the damping and cannot be
 * folded into the target, or the damp would smear it into a drift; and it cannot be read back off
 * the group's own position either, because then each frame would damp toward the last frame's
 * shake and the board would wander. So the pan is the state and the shake is an offset on top.
 */
export interface TileBoardPanState {
    x: number;
    y: number;
}

export interface TileBoardViewportMotionTarget {
    position: {
        x: number;
        y: number;
        set?: (x: number, y: number, z: number) => void;
    };
    rotation?: { z: number };
    scale: {
        x: number;
        y: number;
        z: number;
        setScalar: (scale: number) => void;
    };
}

export const computeTileBoardViewportMotionState = ({
    boardViewport,
    interactionSuppressed,
    reduceMotion,
    shake = BOARD_SHAKE_AT_REST
}: {
    boardViewport: Pick<TileBoardViewportState, 'fitZoom' | 'panX' | 'panY' | 'zoom'>;
    interactionSuppressed: boolean;
    reduceMotion: boolean;
    shake?: BoardShakeSample;
}): TileBoardViewportMotionState => ({
    instant: reduceMotion,
    shake: reduceMotion ? BOARD_SHAKE_AT_REST : shake,
    panDamping: interactionSuppressed ? BOARD_VIEWPORT_ACTIVE_DAMPING : BOARD_VIEWPORT_IDLE_DAMPING,
    scaleDamping: interactionSuppressed ? BOARD_VIEWPORT_ACTIVE_SCALE_DAMPING : BOARD_VIEWPORT_IDLE_SCALE_DAMPING,
    targetPanX: boardViewport.panX,
    targetPanY: boardViewport.panY,
    targetScale: boardViewport.fitZoom * boardViewport.zoom
});

export const computeInitialTileBoardViewportMotionState = ({
    boardViewport
}: {
    boardViewport: Pick<TileBoardViewportState, 'fitZoom' | 'panX' | 'panY' | 'zoom'>;
}): Pick<TileBoardViewportMotionState, 'targetPanX' | 'targetPanY' | 'targetScale'> => ({
    targetPanX: boardViewport.panX,
    targetPanY: boardViewport.panY,
    targetScale: boardViewport.fitZoom * boardViewport.zoom
});

export const applyInitialTileBoardViewportMotionState = (
    target: TileBoardViewportMotionTarget,
    motion: Pick<TileBoardViewportMotionState, 'targetPanX' | 'targetPanY' | 'targetScale'>
): void => {
    if (target.position.set) {
        target.position.set(motion.targetPanX, motion.targetPanY, 0);
    } else {
        target.position.x = motion.targetPanX;
        target.position.y = motion.targetPanY;
    }
    target.scale.setScalar(motion.targetScale);
};

export const applyTileBoardViewportMotionState = (
    target: TileBoardViewportMotionTarget,
    motion: TileBoardViewportMotionState,
    delta: number,
    pan: TileBoardPanState = { x: target.position.x, y: target.position.y }
): void => {
    if (motion.instant) {
        pan.x = motion.targetPanX;
        pan.y = motion.targetPanY;
        target.position.x = pan.x;
        target.position.y = pan.y;
        if (target.rotation) {
            target.rotation.z = 0;
        }
        target.scale.setScalar(motion.targetScale);
        return;
    }

    pan.x = MathUtils.damp(pan.x, motion.targetPanX, motion.panDamping, delta);
    pan.y = MathUtils.damp(pan.y, motion.targetPanY, motion.panDamping, delta);
    target.position.x = pan.x + motion.shake.offsetX;
    target.position.y = pan.y + motion.shake.offsetY;
    if (target.rotation) {
        target.rotation.z = motion.shake.angleZ;
    }
    target.scale.x = MathUtils.damp(target.scale.x, motion.targetScale, motion.scaleDamping, delta);
    target.scale.y = MathUtils.damp(target.scale.y, motion.targetScale, motion.scaleDamping, delta);
    target.scale.z = MathUtils.damp(target.scale.z, motion.targetScale, motion.scaleDamping, delta);
};
