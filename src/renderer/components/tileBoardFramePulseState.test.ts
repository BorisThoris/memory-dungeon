import { describe, expect, it } from 'vitest';
import { GAMEPLAY_BOARD_VISUALS } from './gameplayVisualConfig';
import {
    CARD_FACE_UP_SURFACE_SECONDS,
    CARD_FLIP_POP_SECONDS,
    MATCH_PULSE_DECAY_PER_SECOND,
    computeTileBoardFaceUpStructState,
    computeTileBoardFramePulseTransitionState,
    computeTileBoardFlipPopStart,
    computeTileBoardFlipPopVisualState,
    computeTileBoardMatchedBurstState,
    computeTileBoardMatchPulseState,
    computeTileBoardResolvingWaveFrameState
} from './tileBoardFramePulseState';

describe('tileBoardFramePulseState', () => {
    it('computes the combined frame pulse transition in the same order as the individual helpers', () => {
        const state = computeTileBoardFramePulseTransitionState({
            current: {
                faceUpStructBlend: 0,
                faceUpStructStartedAt: null,
                flipPopStartedAt: null,
                lastResolvingWaveKey: null,
                matchedVictoryBurstStartedAt: null,
                matchPulse: 0,
                prevFaceUp: false,
                prevResolvingSelection: null,
                wasMatched: false
            },
            delta: 0,
            faceUp: true,
            reduceMotion: false,
            resolvingSelection: 'match',
            resolvingWaveKey: 'wave-a',
            tileState: 'matched',
            time: 5
        });

        expect(state.refs.lastResolvingWaveKey).toBe('wave-a');
        expect(state.refs.prevFaceUp).toBe(true);
        expect(state.refs.faceUpStructBlend).toBe(0);
        expect(state.refs.faceUpStructStartedAt).toBe(5);
        expect(state.refs.matchPulse).toBe(1);
        expect(state.refs.prevResolvingSelection).toBe('match');
        expect(state.refs.matchedVictoryBurstStartedAt).toBe(5);
        expect(state.refs.wasMatched).toBe(true);
        expect(state.refs.flipPopStartedAt).toBe(5);
        expect(state.flipPopScaleMultiplier).toBe(1);
        expect(state.flipPopZ).toBe(0);
        expect(state.matchedVictoryBurst).toBe(1);
    });

    it('resets transient pulse inputs before computing a changed resolving wave transition', () => {
        const state = computeTileBoardFramePulseTransitionState({
            current: {
                faceUpStructBlend: 1,
                faceUpStructStartedAt: null,
                flipPopStartedAt: 7,
                lastResolvingWaveKey: 'wave-a',
                matchedVictoryBurstStartedAt: null,
                matchPulse: 0.8,
                prevFaceUp: true,
                prevResolvingSelection: 'match',
                wasMatched: false
            },
            delta: 0.1,
            faceUp: true,
            reduceMotion: false,
            resolvingSelection: 'match',
            resolvingWaveKey: 'wave-b',
            tileState: 'flipped',
            time: 8
        });

        expect(state.refs.lastResolvingWaveKey).toBe('wave-b');
        expect(state.refs.matchPulse).toBeCloseTo(0.72);
        expect(state.refs.prevResolvingSelection).toBe('match');
        expect(state.refs.flipPopStartedAt).toBeNull();
        expect(state.flipPopScaleMultiplier).toBe(1);
        expect(state.matchedVictoryBurst).toBe(0);
    });

    it('preserves resolving wave frame state while the wave key is unchanged', () => {
        const current = {
            flipPopStartedAt: 4,
            lastResolvingWaveKey: 'wave-a',
            matchPulse: 0.45,
            prevResolvingSelection: 'match' as const
        };

        expect(
            computeTileBoardResolvingWaveFrameState({
                current,
                resolvingWaveKey: 'wave-a'
            })
        ).toBe(current);
    });

    it('clears transient pulse state when the resolving wave key changes', () => {
        expect(
            computeTileBoardResolvingWaveFrameState({
                current: {
                    flipPopStartedAt: 4,
                    lastResolvingWaveKey: 'wave-a',
                    matchPulse: 0.45,
                    prevResolvingSelection: 'match'
                },
                resolvingWaveKey: 'wave-b'
            })
        ).toEqual({
            flipPopStartedAt: null,
            lastResolvingWaveKey: 'wave-b',
            matchPulse: 0,
            prevResolvingSelection: null
        });
    });

    it('starts flip-pop only on a face-up edge and disables it for reduced motion', () => {
        expect(
            computeTileBoardFlipPopStart({
                faceUp: true,
                previousStartedAt: null,
                prevFaceUp: false,
                reduceMotion: false,
                time: 10
            })
        ).toBe(10);

        expect(
            computeTileBoardFlipPopStart({
                faceUp: true,
                previousStartedAt: 8,
                prevFaceUp: true,
                reduceMotion: false,
                time: 10
            })
        ).toBe(8);

        expect(
            computeTileBoardFlipPopStart({
                faceUp: true,
                previousStartedAt: 8,
                prevFaceUp: false,
                reduceMotion: true,
                time: 10
            })
        ).toBeNull();
    });

    it('eases face-up structural blend and clears its timer at completion', () => {
        expect(
            computeTileBoardFaceUpStructState({
                faceUp: true,
                prevFaceUp: false,
                reduceMotion: false,
                startedAt: null,
                time: 10
            })
        ).toEqual({ blend: 0, startedAt: 10 });

        const midway = computeTileBoardFaceUpStructState({
            faceUp: true,
            prevFaceUp: true,
            reduceMotion: false,
            startedAt: 10,
            time: 10 + CARD_FACE_UP_SURFACE_SECONDS / 2
        });
        expect(midway.blend).toBeCloseTo(0.75);
        expect(midway.startedAt).toBe(10);

        expect(
            computeTileBoardFaceUpStructState({
                faceUp: true,
                prevFaceUp: true,
                reduceMotion: false,
                startedAt: 10,
                time: 10 + CARD_FACE_UP_SURFACE_SECONDS + 0.001
            })
        ).toEqual({ blend: 1, startedAt: null });
    });

    it('decays match pulse after triggering on a match transition', () => {
        expect(MATCH_PULSE_DECAY_PER_SECOND).toBeGreaterThan(0);
        const state = computeTileBoardMatchPulseState({
            currentPulse: 0.2,
            delta: 0.1,
            prevResolvingSelection: null,
            reduceMotion: false,
            resolvingSelection: 'match'
        });

        expect(state.prevResolvingSelection).toBe('match');
        expect(state.pulse).toBeCloseTo(1 - 0.1 * MATCH_PULSE_DECAY_PER_SECOND);
    });

    it('does not trigger match pulse for reduced motion or continuing match state', () => {
        expect(
            computeTileBoardMatchPulseState({
                currentPulse: 0.2,
                delta: 0.1,
                prevResolvingSelection: null,
                reduceMotion: true,
                resolvingSelection: 'match'
            }).pulse
        ).toBe(0);

        expect(
            computeTileBoardMatchPulseState({
                currentPulse: 0.8,
                delta: 0.1,
                prevResolvingSelection: 'match',
                reduceMotion: false,
                resolvingSelection: 'match'
            }).pulse
        ).toBeCloseTo(0.52);
    });

    it('starts and fades matched victory burst using the configured duration', () => {
        const started = computeTileBoardMatchedBurstState({
            reduceMotion: false,
            startedAt: null,
            tileState: 'matched',
            time: 3,
            wasMatched: false
        });
        expect(started).toEqual({ burst: 1, startedAt: 3, wasMatched: true });

        const duration = GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.burstDuration.default;
        const halfway = computeTileBoardMatchedBurstState({
            reduceMotion: false,
            startedAt: 3,
            tileState: 'matched',
            time: 3 + duration / 2,
            wasMatched: true
        });
        expect(halfway.burst).toBeCloseTo(0.5);
        expect(halfway.startedAt).toBe(3);

        expect(
            computeTileBoardMatchedBurstState({
                reduceMotion: false,
                startedAt: 3,
                tileState: 'matched',
                time: 3 + duration + 0.001,
                wasMatched: true
            })
        ).toEqual({ burst: 0, startedAt: null, wasMatched: true });
    });

    it('clears matched victory burst for non-matched tiles', () => {
        expect(
            computeTileBoardMatchedBurstState({
                reduceMotion: false,
                startedAt: 3,
                tileState: 'hidden',
                time: 4,
                wasMatched: true
            })
        ).toEqual({ burst: 0, startedAt: null, wasMatched: false });
    });

    it('computes and clears flip-pop visual envelope', () => {
        const peak = computeTileBoardFlipPopVisualState({
            reduceMotion: false,
            startedAt: 2,
            time: 2 + CARD_FLIP_POP_SECONDS / 2
        });
        expect(peak.scaleMultiplier).toBeCloseTo(1.065);
        expect(peak.z).toBeCloseTo(0.014);
        expect(peak.startedAt).toBe(2);

        expect(
            computeTileBoardFlipPopVisualState({
                reduceMotion: false,
                startedAt: 2,
                time: 2 + CARD_FLIP_POP_SECONDS
            })
        ).toEqual({ scaleMultiplier: 1, startedAt: null, z: 0 });
    });
});
