import { MathUtils } from 'three';
import type { TileBoardViewportState } from './tileBoardViewport';

export const BOARD_VIEWPORT_IDLE_DAMPING = 5.2;
export const BOARD_VIEWPORT_ACTIVE_DAMPING = 7.4;
export const BOARD_VIEWPORT_IDLE_SCALE_DAMPING = 4.8;
export const BOARD_VIEWPORT_ACTIVE_SCALE_DAMPING = 6.8;

interface TileBoardViewportMotionState {
    instant: boolean;
    panDamping: number;
    scaleDamping: number;
    targetPanX: number;
    targetPanY: number;
    targetScale: number;
}

export interface TileBoardViewportMotionTarget {
    position: {
        x: number;
        y: number;
        set?: (x: number, y: number, z: number) => void;
    };
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
    reduceMotion
}: {
    boardViewport: Pick<TileBoardViewportState, 'fitZoom' | 'panX' | 'panY' | 'zoom'>;
    interactionSuppressed: boolean;
    reduceMotion: boolean;
}): TileBoardViewportMotionState => ({
    instant: reduceMotion,
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
    delta: number
): void => {
    if (motion.instant) {
        target.position.x = motion.targetPanX;
        target.position.y = motion.targetPanY;
        target.scale.setScalar(motion.targetScale);
        return;
    }

    target.position.x = MathUtils.damp(target.position.x, motion.targetPanX, motion.panDamping, delta);
    target.position.y = MathUtils.damp(target.position.y, motion.targetPanY, motion.panDamping, delta);
    target.scale.x = MathUtils.damp(target.scale.x, motion.targetScale, motion.scaleDamping, delta);
    target.scale.y = MathUtils.damp(target.scale.y, motion.targetScale, motion.scaleDamping, delta);
    target.scale.z = MathUtils.damp(target.scale.z, motion.targetScale, motion.scaleDamping, delta);
};
