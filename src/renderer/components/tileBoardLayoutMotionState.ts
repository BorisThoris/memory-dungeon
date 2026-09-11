import { MathUtils } from 'three';
import { sampleTraumaShake, TILE_SHAKE_MAXIMA } from './boardTrauma';
import type { ResolvingSelectionState } from './tileResolvingSelection';
import type { TileTransform } from './tileBoardTransform';
import {
    computeBoardEntranceMotionTransform,
    computeShuffleMotionTransform
} from './shuffleFlipAnimation';

interface TileBoardLayoutMotionTransform {
    rotX: number;
    rotY: number;
    rotZ: number;
    rx: number;
    ry: number;
    rz: number;
}

interface TileBoardLayoutMotionState {
    entranceLayoutActive: boolean;
    entranceMotion: TileBoardLayoutMotionTransform;
    layoutMotionActive: boolean;
    posLambda: number;
    shuffleLayoutActive: boolean;
    shuffleMotion: TileBoardLayoutMotionTransform;
}

interface TileBoardCardGroupMotionTarget {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
}

interface TileBoardCardGroupMotionState {
    layoutMotionActive: boolean;
    posLambda: number;
    positionXTarget: number;
    positionYTarget: number;
    positionZTarget: number;
    reduceMotion: boolean;
    rotationDamp: number;
    rotationXTarget: number;
    rotationYTarget: number;
    rotationZTarget: number;
    scaleTarget: number;
}

interface TileBoardCardGroupMotionStateInput {
    entranceMotion: TileBoardLayoutMotionTransform;
    fieldDepth: number;
    fieldLift: number;
    fieldRotX: number;
    fieldRotZ: number;
    flipPopScaleMultiplier: number;
    flipPopZ: number;
    hoverDepth: number;
    hoverTiltX: number;
    hoverTiltZ: number;
    idleDrift: number;
    layoutMotionActive: boolean;
    liftSmooth: number;
    matchPulse: number;
    posLambda: number;
    reduceMotion: boolean;
    resolvingSelection: ResolvingSelectionState;
    rotationDamp: number;
    settle: number;
    shuffleMotion: TileBoardLayoutMotionTransform;
    structDepth: number;
    transform: TileTransform;
    /** This card's own trauma (`boardTrauma.ts`); the shake is sampled from it, not from a sine. */
    trauma: number;
    wobbleTime: number;
}

export const TILE_BOARD_ZERO_LAYOUT_MOTION: TileBoardLayoutMotionTransform = {
    rotX: 0,
    rotY: 0,
    rotZ: 0,
    rx: 0,
    ry: 0,
    rz: 0
};

export const computeTileBoardLayoutMotionState = ({
    boardColumns,
    boardEntranceMotionBudgetMs,
    boardEntranceMotionDeadlineMs,
    boardEntranceStaggerTileCount,
    boardRows,
    now,
    reduceMotion,
    shuffleBoardOrderIndex,
    shuffleMotionBudgetMs,
    shuffleMotionDeadlineMs,
    shuffleStaggerTileCount
}: {
    boardColumns: number;
    boardEntranceMotionBudgetMs: number;
    boardEntranceMotionDeadlineMs: number;
    boardEntranceStaggerTileCount: number;
    boardRows: number;
    now: number;
    reduceMotion: boolean;
    shuffleBoardOrderIndex: number;
    shuffleMotionBudgetMs: number;
    shuffleMotionDeadlineMs: number;
    shuffleStaggerTileCount: number;
}): TileBoardLayoutMotionState => {
    const shuffleLayoutActive = !reduceMotion && shuffleMotionDeadlineMs > 0 && now < shuffleMotionDeadlineMs;
    const entranceLayoutActive =
        !reduceMotion &&
        !shuffleLayoutActive &&
        boardEntranceMotionDeadlineMs > 0 &&
        now < boardEntranceMotionDeadlineMs;

    const shuffleMotion =
        shuffleLayoutActive && shuffleMotionBudgetMs > 0 && shuffleStaggerTileCount > 0
            ? computeShuffleMotionTransform(
                  now,
                  shuffleMotionDeadlineMs,
                  shuffleMotionBudgetMs,
                  shuffleBoardOrderIndex,
                  shuffleStaggerTileCount,
                  boardRows,
                  boardColumns
              )
            : TILE_BOARD_ZERO_LAYOUT_MOTION;
    const entranceMotion =
        entranceLayoutActive && boardEntranceMotionBudgetMs > 0 && boardEntranceStaggerTileCount > 0
            ? computeBoardEntranceMotionTransform(
                  now,
                  boardEntranceMotionDeadlineMs,
                  boardEntranceMotionBudgetMs,
                  shuffleBoardOrderIndex,
                  boardEntranceStaggerTileCount,
                  boardRows,
                  boardColumns
              )
            : TILE_BOARD_ZERO_LAYOUT_MOTION;
    const layoutMotionActive = shuffleLayoutActive || entranceLayoutActive;

    return {
        entranceLayoutActive,
        entranceMotion,
        layoutMotionActive,
        posLambda: layoutMotionActive ? 9 : 200,
        shuffleLayoutActive,
        shuffleMotion
    };
};

export const applyTileBoardCardGroupMotionState = (
    target: TileBoardCardGroupMotionTarget,
    state: TileBoardCardGroupMotionState,
    delta: number
): void => {
    target.rotation.x = MathUtils.damp(
        target.rotation.x,
        state.rotationXTarget,
        state.reduceMotion ? 42 : 22,
        delta
    );
    target.rotation.z = MathUtils.damp(
        target.rotation.z,
        state.rotationZTarget,
        state.reduceMotion ? 42 : 22,
        delta
    );
    target.rotation.y = state.reduceMotion
        ? state.rotationYTarget
        : MathUtils.damp(target.rotation.y, state.rotationYTarget, state.rotationDamp, delta);

    if (state.layoutMotionActive) {
        target.position.x = MathUtils.damp(target.position.x, state.positionXTarget, state.posLambda, delta);
        target.position.y = MathUtils.damp(target.position.y, state.positionYTarget, state.posLambda, delta);
        target.position.z = MathUtils.damp(target.position.z, state.positionZTarget, state.posLambda, delta);
    } else {
        target.position.x = state.positionXTarget;
        target.position.y = state.positionYTarget;
        target.position.z = state.positionZTarget;
    }

    target.scale.x = state.scaleTarget;
    target.scale.y = state.scaleTarget;
    target.scale.z = state.scaleTarget;
};

export const computeTileBoardCardGroupMotionState = ({
    entranceMotion,
    fieldDepth,
    fieldLift,
    fieldRotX,
    fieldRotZ,
    flipPopScaleMultiplier,
    flipPopZ,
    hoverDepth,
    hoverTiltX,
    hoverTiltZ,
    idleDrift,
    layoutMotionActive,
    liftSmooth,
    matchPulse,
    posLambda,
    reduceMotion,
    resolvingSelection,
    rotationDamp,
    settle,
    shuffleMotion,
    structDepth,
    transform,
    trauma,
    wobbleTime
}: TileBoardCardGroupMotionStateInput): TileBoardCardGroupMotionState => {
    const baseTargetX = transform.baseX + transform.imperfectionX + transform.layoutJitterX;
    const baseTargetY =
        transform.baseY + transform.imperfectionY + transform.layoutJitterY + liftSmooth + fieldLift + idleDrift + settle;
    const targetX = baseTargetX + shuffleMotion.rx + entranceMotion.rx;
    const targetY = baseTargetY + shuffleMotion.ry + entranceMotion.ry;
    const targetZ = structDepth + hoverDepth + fieldDepth + shuffleMotion.rz + entranceMotion.rz + transform.layoutJitterZ;
    /*
     * The miss shake, on the trauma model (`boardTrauma.ts`). It used to be a sine switched on by
     * `resolvingSelection === 'mismatch'` and off again the frame that left - so it could not stack,
     * it stopped mid-swing, and it was a tone rather than noise. The trauma decays instead, and a
     * second miss on the same card adds to what is left of the first.
     */
    const shake = reduceMotion
        ? { angleZ: 0, offsetX: 0, offsetY: 0 }
        : sampleTraumaShake({ maxima: TILE_SHAKE_MAXIMA, seconds: wobbleTime, trauma });
    const matchPulseMul = resolvingSelection === 'match' ? 0.13 : 0.085;

    return {
        layoutMotionActive,
        positionXTarget: targetX + shake.offsetX,
        positionYTarget: targetY + shake.offsetY,
        positionZTarget: targetZ + flipPopZ,
        posLambda,
        reduceMotion,
        rotationDamp,
        rotationXTarget: transform.imperfectionRotationX + fieldRotX + hoverTiltX + shuffleMotion.rotX + entranceMotion.rotX,
        rotationYTarget: transform.layoutYaw + transform.flipRotationY + shuffleMotion.rotY + entranceMotion.rotY,
        rotationZTarget:
            transform.imperfectionRotationZ + fieldRotZ + hoverTiltZ + shuffleMotion.rotZ + entranceMotion.rotZ + shake.angleZ,
        scaleTarget: transform.baseScale * flipPopScaleMultiplier * (1 + matchPulse * matchPulseMul)
    };
};
