import type { Tile } from '../../shared/contracts';
import { GAMEPLAY_BOARD_VISUALS } from './gameplayVisualConfig';
import type { ResolvingSelectionState } from './tileResolvingSelection';

export const CARD_FACE_UP_SURFACE_SECONDS = 0.2;
export const CARD_FLIP_POP_SECONDS = 0.22;
export const MATCH_PULSE_DECAY_PER_SECOND = 2.8;

interface TileBoardFaceUpStructState {
    blend: number;
    startedAt: number | null;
}

interface TileBoardMatchPulseState {
    pulse: number;
    prevResolvingSelection: ResolvingSelectionState | null;
}

interface TileBoardMatchedBurstState {
    burst: number;
    startedAt: number | null;
    wasMatched: boolean;
}

interface TileBoardResolvingWaveFrameState {
    flipPopStartedAt: number | null;
    lastResolvingWaveKey: string | null;
    matchPulse: number;
    prevResolvingSelection: ResolvingSelectionState | null;
}

interface TileBoardFlipPopVisualState {
    scaleMultiplier: number;
    startedAt: number | null;
    z: number;
}

interface TileBoardFramePulseRefsState {
    faceUpStructBlend: number;
    faceUpStructStartedAt: number | null;
    flipPopStartedAt: number | null;
    lastResolvingWaveKey: string | null;
    matchedVictoryBurstStartedAt: number | null;
    matchPulse: number;
    prevFaceUp: boolean;
    prevResolvingSelection: ResolvingSelectionState | null;
    wasMatched: boolean;
}

interface TileBoardFramePulseTransitionInput {
    current: TileBoardFramePulseRefsState;
    delta: number;
    faceUp: boolean;
    reduceMotion: boolean;
    resolvingSelection: ResolvingSelectionState;
    resolvingWaveKey: string | null;
    tileState: Tile['state'];
    time: number;
}

interface TileBoardFramePulseTransitionState {
    flipPopScaleMultiplier: number;
    flipPopZ: number;
    matchedVictoryBurst: number;
    refs: TileBoardFramePulseRefsState;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const smoothstep01 = (value: number): number => {
    const x = clamp01(value);
    return x * x * (3 - 2 * x);
};

export const computeTileBoardResolvingWaveFrameState = ({
    current,
    resolvingWaveKey
}: {
    current: TileBoardResolvingWaveFrameState;
    resolvingWaveKey: string | null;
}): TileBoardResolvingWaveFrameState => {
    if (resolvingWaveKey === current.lastResolvingWaveKey) {
        return current;
    }

    return {
        flipPopStartedAt: null,
        lastResolvingWaveKey: resolvingWaveKey,
        matchPulse: 0,
        prevResolvingSelection: null
    };
};

export const computeTileBoardFlipPopStart = ({
    faceUp,
    previousStartedAt,
    prevFaceUp,
    reduceMotion,
    time
}: {
    faceUp: boolean;
    previousStartedAt: number | null;
    prevFaceUp: boolean;
    reduceMotion: boolean;
    time: number;
}): number | null => {
    if (reduceMotion) {
        return null;
    }

    return faceUp && !prevFaceUp ? time : previousStartedAt;
};

export const computeTileBoardFaceUpStructState = ({
    faceUp,
    prevFaceUp,
    reduceMotion,
    startedAt,
    time
}: {
    faceUp: boolean;
    prevFaceUp: boolean;
    reduceMotion: boolean;
    startedAt: number | null;
    time: number;
}): TileBoardFaceUpStructState => {
    if (reduceMotion) {
        return { blend: faceUp ? 1 : 0, startedAt: null };
    }

    if (!faceUp) {
        return { blend: 0, startedAt: null };
    }

    if (!prevFaceUp) {
        return { blend: 0, startedAt: time };
    }

    if (startedAt == null) {
        return { blend: 1, startedAt: null };
    }

    const progress = clamp01((time - startedAt) / CARD_FACE_UP_SURFACE_SECONDS);
    const blend = 1 - (1 - progress) * (1 - progress);

    return progress >= 1 ? { blend: 1, startedAt: null } : { blend, startedAt };
};

export const computeTileBoardMatchPulseState = ({
    currentPulse,
    delta,
    prevResolvingSelection,
    reduceMotion,
    resolvingSelection
}: {
    currentPulse: number;
    delta: number;
    prevResolvingSelection: ResolvingSelectionState | null;
    reduceMotion: boolean;
    resolvingSelection: ResolvingSelectionState;
}): TileBoardMatchPulseState => {
    const triggeredPulse =
        resolvingSelection === 'match' && prevResolvingSelection !== 'match' && !reduceMotion ? 1 : currentPulse;

    return {
        pulse: Math.max(0, triggeredPulse - delta * MATCH_PULSE_DECAY_PER_SECOND),
        prevResolvingSelection: resolvingSelection
    };
};

export const computeTileBoardMatchedBurstState = ({
    reduceMotion,
    startedAt,
    tileState,
    time,
    wasMatched
}: {
    reduceMotion: boolean;
    startedAt: number | null;
    tileState: Tile['state'];
    time: number;
    wasMatched: boolean;
}): TileBoardMatchedBurstState => {
    if (tileState !== 'matched') {
        return { burst: 0, startedAt: null, wasMatched: false };
    }

    const nextStartedAt = !wasMatched ? time : startedAt;
    if (nextStartedAt == null) {
        return { burst: 0, startedAt: null, wasMatched: true };
    }

    const burstDuration = reduceMotion
        ? GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.burstDuration.reduceMotion
        : GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.burstDuration.default;
    const progress = clamp01((time - nextStartedAt) / burstDuration);
    const burst = 1 - smoothstep01(progress);

    return progress >= 1
        ? { burst, startedAt: null, wasMatched: true }
        : { burst, startedAt: nextStartedAt, wasMatched: true };
};

export const computeTileBoardFlipPopVisualState = ({
    reduceMotion,
    startedAt,
    time
}: {
    reduceMotion: boolean;
    startedAt: number | null;
    time: number;
}): TileBoardFlipPopVisualState => {
    if (startedAt == null || reduceMotion) {
        return { scaleMultiplier: 1, startedAt: reduceMotion ? null : startedAt, z: 0 };
    }

    const elapsed = time - startedAt;
    if (elapsed >= CARD_FLIP_POP_SECONDS) {
        return { scaleMultiplier: 1, startedAt: null, z: 0 };
    }

    const envelope = Math.sin((elapsed / CARD_FLIP_POP_SECONDS) * Math.PI);
    return {
        scaleMultiplier: 1 + envelope * 0.065,
        startedAt,
        z: envelope * 0.014
    };
};

export const computeTileBoardFramePulseTransitionState = ({
    current,
    delta,
    faceUp,
    reduceMotion,
    resolvingSelection,
    resolvingWaveKey,
    tileState,
    time
}: TileBoardFramePulseTransitionInput): TileBoardFramePulseTransitionState => {
    const resolvingWaveState = computeTileBoardResolvingWaveFrameState({
        current: {
            flipPopStartedAt: current.flipPopStartedAt,
            lastResolvingWaveKey: current.lastResolvingWaveKey,
            matchPulse: current.matchPulse,
            prevResolvingSelection: current.prevResolvingSelection
        },
        resolvingWaveKey
    });

    const flipPopStartedAt = computeTileBoardFlipPopStart({
        faceUp,
        previousStartedAt: resolvingWaveState.flipPopStartedAt,
        prevFaceUp: current.prevFaceUp,
        reduceMotion,
        time
    });

    const faceUpStructState = computeTileBoardFaceUpStructState({
        faceUp,
        prevFaceUp: current.prevFaceUp,
        reduceMotion,
        startedAt: current.faceUpStructStartedAt,
        time
    });

    const matchPulseState = computeTileBoardMatchPulseState({
        currentPulse: resolvingWaveState.matchPulse,
        delta,
        prevResolvingSelection: resolvingWaveState.prevResolvingSelection,
        reduceMotion,
        resolvingSelection
    });

    const matchedBurstState = computeTileBoardMatchedBurstState({
        reduceMotion,
        startedAt: current.matchedVictoryBurstStartedAt,
        tileState,
        time,
        wasMatched: current.wasMatched
    });

    const flipPopVisualState = computeTileBoardFlipPopVisualState({
        reduceMotion,
        startedAt: flipPopStartedAt,
        time
    });

    return {
        flipPopScaleMultiplier: flipPopVisualState.scaleMultiplier,
        flipPopZ: flipPopVisualState.z,
        matchedVictoryBurst: matchedBurstState.burst,
        refs: {
            faceUpStructBlend: faceUpStructState.blend,
            faceUpStructStartedAt: faceUpStructState.startedAt,
            flipPopStartedAt: flipPopVisualState.startedAt,
            lastResolvingWaveKey: resolvingWaveState.lastResolvingWaveKey,
            matchedVictoryBurstStartedAt: matchedBurstState.startedAt,
            matchPulse: matchPulseState.pulse,
            prevFaceUp: faceUp,
            prevResolvingSelection: matchPulseState.prevResolvingSelection,
            wasMatched: matchedBurstState.wasMatched
        }
    };
};
