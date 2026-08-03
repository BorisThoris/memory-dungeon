import { describe, expect, it } from 'vitest';
import type { ChainRewardForecastCue } from '../copy/chainMomentum';
import type { MismatchFloaterRecoveryLaneMapEntry } from '../copy/mismatchFloater';
import type { MatchScorePopPayoffLaneMapEntry } from '../store/matchScorePop';
import {
    getBoardMatchPayoffStackAction,
    getBoardMatchPayoffStackAudioCue,
    getBoardMatchPayoffStackBeatCount,
    getBoardMatchPayoffStackScreenCue,
    getMismatchRecoveryLaneAudioCue,
    getMismatchRecoveryLaneBeatCount,
    getMismatchRecoveryLaneScreenCue,
    getPrimaryMismatchRecoveryLane,
    matchChainRewardForecastCues,
    matchPayoffChips,
    matchPayoffLaneActionMapAttr,
    matchPayoffLaneMap,
    matchPayoffLaneMapAttr,
    matchPayoffLaneMapLabel,
    matchTraitInteractionTexts,
    mismatchRecoveryLaneActionMapAttr,
    mismatchRecoveryLaneMapLabel
} from './gameScreenBoardFeedbackModel';

describe('gameScreenBoardFeedbackModel', () => {
    it('normalizes persisted match chips without trusting malformed values', () => {
        expect(matchPayoffChips([
            { id: 'score', label: 'Score', tone: 'score', value: '+25' },
            { id: 'unknown', label: 'Invalid', tone: 'score', value: '+99' },
            null
        ])).toEqual([{ id: 'score', label: 'Score', tone: 'score', value: '+25' }]);
        expect(matchTraitInteractionTexts(['Echo cashout', 4, null])).toEqual(['Echo cashout']);
    });

    it('projects a typed match lane into stable DOM, action, and accessibility labels', () => {
        const lane: MatchScorePopPayoffLaneMapEntry = {
            id: 'route',
            label: 'Route',
            tone: 'route',
            count: 2,
            cue: 'Cash route reward'
        };

        expect(matchPayoffLaneMap([lane, { ...lane, count: Number.NaN }])).toEqual([lane]);
        expect(matchPayoffLaneMapAttr([lane])).toBe('route:2');
        expect(matchPayoffLaneActionMapAttr([lane])).toBe('route:Cash route:2');
        expect(matchPayoffLaneMapLabel([lane])).toContain('Route: 2. Cash route. Cash route reward.');
    });

    it('keeps only complete chain reward forecast cues', () => {
        const cue: ChainRewardForecastCue = {
            id: 'guard',
            label: 'Guard token',
            actionLabel: 'Next',
            chaseLabel: 'Hit now',
            distance: 1,
            distanceLabel: '1 away',
            targetStreak: 4,
            tone: 'guard',
            urgency: 'next'
        };

        expect(matchChainRewardForecastCues([cue, { ...cue, tone: 'invalid' }])).toEqual([cue]);
    });

    it('selects the strongest mismatch lane and exposes consistent multimodal cues', () => {
        const recover: MismatchFloaterRecoveryLaneMapEntry = {
            id: 'recover',
            label: 'Recover',
            count: 1,
            cue: 'Safe pair'
        };
        const lost: MismatchFloaterRecoveryLaneMapEntry = {
            id: 'lost',
            label: 'Lost',
            count: 1,
            cue: 'Reward at risk'
        };

        expect(getPrimaryMismatchRecoveryLane([recover, lost])).toEqual(lost);
        expect(getMismatchRecoveryLaneBeatCount(lost)).toBe(4);
        expect(getMismatchRecoveryLaneAudioCue(lost)).toBe('mismatch-recovery-lost');
        expect(getMismatchRecoveryLaneScreenCue(lost)).toBe('risk');
        expect(mismatchRecoveryLaneActionMapAttr([recover, lost])).toBe(
            'recover:Confirm pair:1>lost:Save cashout:1'
        );
        expect(mismatchRecoveryLaneMapLabel([recover, lost])).toContain('Save cashout');
    });

    it('derives one coherent beat/action/audio/screen contract for payoff stacks', () => {
        const stack = { laneCount: 4, tone: 'combo' };

        expect(getBoardMatchPayoffStackBeatCount(stack)).toBe(5);
        expect(getBoardMatchPayoffStackAction(stack)).toBe('Cash stack');
        expect(getBoardMatchPayoffStackAudioCue(stack)).toBe('match-stack-super');
        expect(getBoardMatchPayoffStackScreenCue(stack)).toBe('super');
    });
});
