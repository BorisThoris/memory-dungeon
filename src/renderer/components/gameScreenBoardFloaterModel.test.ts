import { describe, expect, it } from 'vitest';
import type { MismatchFloaterRecoveryChip } from '../copy/mismatchFloater';
import type { MatchScorePop, MismatchScorePop } from '../store/matchScorePop';
import {
    actualMatchPayoffLaneCount,
    getBoardFloaterImpactCueBeatCount,
    getBoardFloaterImpactCueScreenCue,
    getBoardFloaterRewardBurstAudioCue,
    getBoardFloaterRewardBurstBeatCount,
    getBoardFloaterRewardBurstScreenCue,
    getMatchFloaterHeat,
    getMatchFloaterJackpotCue,
    getMatchPayoffChipAudioCue,
    getMatchPayoffChipBeatCount,
    getMatchPayoffChipScreenCue,
    getMismatchFloaterHeat,
    getMismatchRecoveryChipAudioCue,
    getMismatchRecoveryChipBeatCount,
    getMismatchRecoveryChipScreenCue
} from './gameScreenBoardFloaterModel';

const matchPayload = (overrides: Record<string, unknown> = {}): MatchScorePop => ({
    impactCue: { label: 'Score', tone: 'score', value: '+25' },
    ...overrides
} as unknown as MatchScorePop);

describe('gameScreenBoardFloaterModel', () => {
    it('counts explicit payoff lanes before falling back to chip semantics', () => {
        expect(actualMatchPayoffLaneCount(
            { label: 'Stack cashout', tier: 'reward', value: '4 payoffs paid' } as NonNullable<MatchScorePop['payoffSummary']>
        )).toBe(4);
        expect(actualMatchPayoffLaneCount(
            { label: 'Stack cashout', tier: 'reward', value: 'Cashout paid' } as NonNullable<MatchScorePop['payoffSummary']>,
            [
                { id: 'route', label: 'Route', tone: 'route', value: '+1' },
                { id: 'pickup', label: 'Pickup', tone: 'pickup', value: '+1' }
            ] as NonNullable<MatchScorePop['payoffChips']>
        )).toBe(2);
    });

    it('classifies super-stack impact as the strongest heat and multimodal burst', () => {
        const payload = matchPayload({ impactCue: { label: 'Super stack', tone: 'combo', value: '+400' } });
        expect(getMatchFloaterHeat(payload)).toBe('stack');
        expect(getBoardFloaterImpactCueBeatCount(payload)).toBe(5);
        expect(getBoardFloaterImpactCueScreenCue(payload)).toBe('burst');
    });

    it('keeps reward-burst tier, beat, audio, and screen strength aligned', () => {
        const burst = { label: 'Super stack', tier: 'mega', value: 'Five lanes' } as NonNullable<MatchScorePop['rewardBurst']>;
        expect(getBoardFloaterRewardBurstBeatCount(burst)).toBe(5);
        expect(getBoardFloaterRewardBurstAudioCue(burst)).toBe('reward-burst-super');
        expect(getBoardFloaterRewardBurstScreenCue(burst)).toBe('super');
    });

    it('derives jackpot action from the actual payoff stack', () => {
        expect(getMatchFloaterJackpotCue(matchPayload({
            payoffSummary: { label: 'Super stack', tier: 'reward', value: '5 payoffs paid' },
            payoffChips: [
                { id: 'route', label: 'Route', tone: 'route', value: '+1' },
                { id: 'pickup', label: 'Pickup', tone: 'pickup', value: '+1' },
                { id: 'trait', label: 'Trait', tone: 'trait', value: '+1' },
                { id: 'chainReward', label: 'Chain', tone: 'reward', value: '+1' }
            ]
        }))).toMatchObject({ beatCount: 5, tier: 'super' });
    });

    it('projects payoff chips into one beat/audio/screen language', () => {
        const chip = {
            id: 'chainReward',
            label: 'Chain cashout',
            tone: 'reward',
            value: '+1 Guard',
            arcadeCue: 'One-away cashout'
        } as NonNullable<MatchScorePop['payoffChips']>[number];
        expect(getMatchPayoffChipBeatCount(chip)).toBe(4);
        expect(getMatchPayoffChipAudioCue(chip)).toBe('match-payoff-reward');
        expect(getMatchPayoffChipScreenCue(chip)).toBe('burst');
    });

    it('distinguishes lost rewards from ordinary recovery and aligns recovery chips', () => {
        expect(getMismatchFloaterHeat({ brokenChainRewardCue: 'Guard lost' } as unknown as MismatchScorePop)).toBe('lost-reward');

        const chip = {
            arcadeCue: 'Lost cashout',
            id: 'target',
            label: 'Lost',
            tone: 'risk',
            value: 'Guard reward'
        } as unknown as MismatchFloaterRecoveryChip;
        expect(getMismatchRecoveryChipBeatCount(chip)).toBe(4);
        expect(getMismatchRecoveryChipAudioCue(chip)).toBe('mismatch-chip-lost');
        expect(getMismatchRecoveryChipScreenCue(chip)).toBe('lost');
    });
});
