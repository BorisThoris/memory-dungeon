import { MathUtils } from 'three';
import type { Tile } from '../../shared/contracts';
import { GAMEPLAY_BOARD_VISUALS } from './gameplayVisualConfig';
import type { TileTraitRouteReadabilityIntensity } from './tileBoardReadability';

interface MotionVector {
    x: number;
    y: number;
}

interface TileBoardInteractionMotionStateInput {
    faceUp: boolean;
    fieldAmp: number;
    fieldTilt: MotionVector;
    hoverTilt: MotionVector & { tileId: string | null };
    isMatched: boolean;
    pickable: boolean;
    reduceMotion: boolean;
    seed: number;
    tileId: string;
    tileState: Tile['state'];
    routeReadabilityIntensity?: TileTraitRouteReadabilityIntensity;
    tileFieldParallaxEnabled: boolean;
    time: number;
}

interface TileBoardInteractionMotionState {
    baseDepthFull: number;
    baseLiftFull: number;
    fieldDepth: number;
    fieldLift: number;
    fieldRotX: number;
    fieldRotZ: number;
    hoverDepth: number;
    hoverDomParity: boolean;
    hoverFaceUpPickable: boolean;
    hoverLift: number;
    hoverTiltX: number;
    hoverTiltZ: number;
    idleDrift: number;
    liftLambda: number;
    rotationDamp: number;
    settle: number;
}

interface TileBoardLiftSmoothInput {
    current: number;
    delta: number;
    liftLambda: number;
    target: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const computeTileBoardLiftSmooth = ({
    current,
    delta,
    liftLambda,
    target
}: TileBoardLiftSmoothInput): number => MathUtils.damp(current, target, liftLambda, delta);

export const computeTileBoardInteractionMotionState = ({
    faceUp,
    fieldAmp,
    fieldTilt,
    hoverTilt,
    isMatched,
    pickable,
    reduceMotion,
    seed,
    tileFieldParallaxEnabled,
    tileId,
    tileState,
    routeReadabilityIntensity = 'none',
    time
}: TileBoardInteractionMotionStateInput): TileBoardInteractionMotionState => {
    const fieldOn = tileFieldParallaxEnabled;
    const hovered = !reduceMotion && hoverTilt.tileId === tileId;
    const hoverDomParity = hovered && !faceUp && tileState !== 'matched';
    const hoverFaceUpPickable = hovered && faceUp && pickable && tileState !== 'matched';
    const hoverTiltX = hoverDomParity
        ? clamp(-hoverTilt.y, -1, 1) * (isMatched ? 0.05 : GAMEPLAY_BOARD_VISUALS.hoverHiddenTiltX)
        : 0;
    const hoverTiltZ = hoverDomParity
        ? clamp(hoverTilt.x, -1, 1) * (isMatched ? 0.046 : GAMEPLAY_BOARD_VISUALS.hoverHiddenTiltZ)
        : 0;
    const hoverLift = hoverDomParity ? (isMatched ? 0.0012 : GAMEPLAY_BOARD_VISUALS.hoverHiddenLift) : 0;
    const hoverDepth = hoverDomParity ? (isMatched ? 0.0018 : GAMEPLAY_BOARD_VISUALS.hoverHiddenDepth) : 0;
    const fieldMagnitude = clamp(Math.hypot(fieldTilt.x, fieldTilt.y), 0, 1);
    const routeLiftBoost =
        routeReadabilityIntensity === 'stack'
            ? 0.0022
            : routeReadabilityIntensity === 'cashout'
              ? 0.0015
              : routeReadabilityIntensity === 'surge'
                ? 0.001
                : routeReadabilityIntensity === 'ready'
                  ? 0.0008
                  : routeReadabilityIntensity === 'setup'
                    ? 0.00045
                    : 0;
    const routeDepthBoost =
        routeReadabilityIntensity === 'stack'
            ? 0.0009
            : routeReadabilityIntensity === 'cashout'
              ? 0.00064
              : routeReadabilityIntensity === 'surge'
                ? 0.00042
                : routeReadabilityIntensity === 'ready'
                  ? 0.00028
                  : routeReadabilityIntensity === 'setup'
                    ? 0.00018
                    : 0;
    const routeDriftBoost =
        routeReadabilityIntensity === 'stack'
            ? 0.0003
            : routeReadabilityIntensity === 'cashout'
              ? 0.00024
              : routeReadabilityIntensity === 'surge'
                ? 0.00018
                : routeReadabilityIntensity === 'ready'
                  ? 0.00012
                  : routeReadabilityIntensity === 'setup'
                    ? 0.00008
                    : 0;
    const routeLambdaBoost =
        routeReadabilityIntensity === 'stack'
            ? 30
            : routeReadabilityIntensity === 'cashout'
              ? 22
              : routeReadabilityIntensity === 'surge'
                ? 16
                : routeReadabilityIntensity === 'ready'
                  ? 10
                  : routeReadabilityIntensity === 'setup'
                    ? 6
                    : 0;

    return {
        baseDepthFull: (isMatched ? 0.0036 : faceUp ? 0.0018 : 0) + routeDepthBoost,
        baseLiftFull: (isMatched ? 0.0024 : faceUp ? 0.0012 : 0) + routeLiftBoost,
        fieldDepth: fieldOn ? fieldMagnitude * fieldAmp * (isMatched ? 0.0005 : 0.00095) + routeDepthBoost * 0.62 : 0,
        fieldLift: fieldOn ? fieldMagnitude * fieldAmp * (isMatched ? 0.00035 : 0.00062) + routeLiftBoost * 0.55 : 0,
        fieldRotX: fieldOn ? clamp(-fieldTilt.y, -1, 1) * fieldAmp * (isMatched ? 0.042 : 0.074) : 0,
        fieldRotZ: fieldOn ? clamp(fieldTilt.x, -1, 1) * fieldAmp * (isMatched ? 0.038 : 0.068) : 0,
        hoverDepth,
        hoverDomParity,
        hoverFaceUpPickable,
        hoverLift,
        hoverTiltX,
        hoverTiltZ,
        idleDrift: reduceMotion ? 0 : Math.sin(time * 0.09 + seed * 0.017) * ((isMatched ? 0.00038 : 0.00024) + routeDriftBoost),
        liftLambda: reduceMotion ? 400 : (faceUp && !isMatched ? 48 : 200) + routeLambdaBoost,
        rotationDamp: reduceMotion ? 42 : faceUp ? 18 : 16,
        settle: reduceMotion ? 0 : Math.sin(time * 0.08 + seed * 0.013) * (isMatched ? 0.00048 : 0.0003)
    };
};
