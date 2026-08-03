import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MatchScorePop, MismatchScorePop } from '../store/matchScorePop';
import { useGameScreenBoardFloaterProjection } from './useGameScreenBoardFloaterProjection';

describe('useGameScreenBoardFloaterProjection', () => {
    it('returns a stable empty projection when no floater is active', () => {
        const { result } = renderHook(() => useGameScreenBoardFloaterProjection({
            matchScorePop: null,
            mismatchScorePop: null,
            reduceMotion: false
        }));

        expect(result.current.boardFloaterPayload).toBeNull();
        expect(result.current.boardFloaterDetailLines).toEqual([]);
        expect(result.current.boardFloaterLiveText).toBe('');
        expect(result.current.boardMatchPayoffStackCue).toBeNull();
    });

    it('projects match payoff, trait, stack, and live-region facts together', () => {
        const matchScorePop = {
            amount: 125,
            chainDepth: 4,
            feedbackHeadline: 'Stack cashout',
            impactCue: { label: 'Stack cashout', tone: 'combo', value: '+125' },
            payoffChips: [
                { id: 'route', label: 'Route', tone: 'route', value: '+1', arcadeCue: 'Route cashout' },
                { id: 'next', label: 'Next', tone: 'reward', value: 'Chase guard', arcadeCue: 'One-away cashout' }
            ],
            payoffSummary: { label: 'Stack cashout', tier: 'reward', value: '2 payoffs paid' },
            traitInteractionTexts: ['Echo cashout']
        } as unknown as MatchScorePop;
        const { result } = renderHook(() => useGameScreenBoardFloaterProjection({
            matchScorePop,
            mismatchScorePop: null,
            reduceMotion: false
        }));

        expect(result.current.boardFloaterPayload?.kind).toBe('match');
        expect(result.current.boardFloaterMatchPayoffChips).toHaveLength(2);
        expect(result.current.boardFloaterTraitLaneMap).toHaveLength(1);
        expect(result.current.boardMatchPayoffStackCue).toMatchObject({ laneCount: 2, label: 'Stack cashout' });
        expect(result.current.boardFloaterLiveText).toContain('Stack cashout');
    });

    it('projects mismatch recovery, lost reward, and lane priority together', () => {
        const mismatchScorePop = {
            brokenChainDepth: 4,
            brokenChainRewardCue: {
                id: 'guard',
                label: 'Guard cashout',
                actionLabel: 'Next',
                chaseLabel: 'Rebuild guard',
                distance: 1,
                distanceLabel: '1 away',
                targetStreak: 4,
                tone: 'guard',
                urgency: 'next'
            },
            traitInteractionTexts: ['Volatile pressure']
        } as unknown as MismatchScorePop;
        const { result } = renderHook(() => useGameScreenBoardFloaterProjection({
            matchScorePop: null,
            mismatchScorePop,
            reduceMotion: true
        }));

        expect(result.current.boardFloaterPayload?.kind).toBe('miss');
        expect(result.current.boardFloaterMismatchSignal).not.toBeNull();
        expect(result.current.boardFloaterMismatchRecoveryChips.length).toBeGreaterThan(0);
        expect(result.current.boardRecoveryContext).not.toBeNull();
        expect(result.current.boardFloaterLiveText).not.toBe('');
    });
});
