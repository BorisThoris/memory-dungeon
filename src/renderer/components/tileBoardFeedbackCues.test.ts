import { describe, expect, it } from 'vitest';
import {
    boardOpportunityAudioCue,
    boardOpportunityScreenCue,
    boardPayoffStackCrescendoAudioCue,
    getBoardChainCalloutAction,
    getBoardChainCalloutAudioCue,
    getBoardChainCalloutScreenCue,
    getBoardChainCueAction,
    getBoardChainCueAudioCue,
    getBoardChainCueScreenCue,
    getBoardChainPriorityAudioCue,
    getBoardChainPriorityScreenCue,
    getBoardOpportunityActionId,
    getBoardOpportunityBeatCount,
    getBoardOpportunityCompassSummaryAction,
    getBoardOpportunityCompassSummaryTier,
    getBoardOpportunityHeat,
    getBoardOpportunityImpactCueId,
    getChainOpportunityBeatActionId,
    getFocusedPreviewAudioCue,
    getFocusedPreviewBeatCount,
    getFocusedPreviewScreenCue,
    type BoardOpportunityCompassCueRow
} from './tileBoardFeedbackCues';

const makeRow = (overrides: Partial<BoardOpportunityCompassCueRow> = {}): BoardOpportunityCompassCueRow => ({
    action: 'Route',
    id: 'chain',
    impactCue: 'route prime',
    tone: 'chain',
    ...overrides
});

describe('tileBoardFeedbackCues', () => {
    it('classifies opportunity heat tiers', () => {
        expect(getBoardOpportunityHeat('Super Stack')).toBe('cashout');
        expect(getBoardOpportunityHeat('Combo Surge')).toBe('surge');
        expect(getBoardOpportunityHeat('Perk Armed')).toBe('prime');
        expect(getBoardOpportunityHeat('Safe Pair')).toBe('normal');
    });

    it('maps chain beat signals to board action ids', () => {
        expect(getChainOpportunityBeatActionId(null)).toBeNull();
        expect(getChainOpportunityBeatActionId({ action: 'Cash out', audioCue: 'x', beatCount: 5, detail: 'x', label: 'x', screenCue: 'burst', tier: 'cashout' })).toBe('cashout');
        expect(getChainOpportunityBeatActionId({ action: 'Route', audioCue: 'x', beatCount: 3, detail: 'x', label: 'x', screenCue: 'pulse', tier: 'follow-up' })).toBe('followup');
        expect(getChainOpportunityBeatActionId({ action: 'Route', audioCue: 'x', beatCount: 3, detail: 'x', label: 'x', screenCue: 'pulse', tier: 'surge' })).toBe('surge');
        expect(getChainOpportunityBeatActionId({ action: 'Route', audioCue: 'x', beatCount: 2, detail: 'x', label: 'x', screenCue: 'tick', tier: 'route' })).toBe('route');
    });

    it('maps chain cue, priority, and callout metadata', () => {
        expect(getBoardChainCueAction('cashout')).toBe('Cash now');
        expect(getBoardChainCueAudioCue('followup')).toBe('chain-cue-followup');
        expect(getBoardChainCueScreenCue('setup')).toBe('tick');

        expect(getBoardChainPriorityAudioCue('best')).toBe('chain-priority-best');
        expect(getBoardChainPriorityScreenCue('ready')).toBe('pulse');

        expect(getBoardChainCalloutAction('ready')).toBe('Match route');
        expect(getBoardChainCalloutAudioCue('surge')).toBe('chain-callout-surge');
        expect(getBoardChainCalloutScreenCue('setup')).toBe('tick');
    });

    it('maps opportunity ids, tiers, and cues', () => {
        expect(getBoardOpportunityImpactCueId('trait combo route')).toBe('trait-combo-route');
        expect(getBoardOpportunityImpactCueId('unknown cue')).toBe('tool-route');

        expect(getBoardOpportunityActionId(makeRow({ action: 'Cash out now' }))).toBe('cashout');
        expect(getBoardOpportunityActionId(makeRow({ action: 'Scout first', id: 'hazard', tone: 'risk' }))).toBe('risk');
        expect(getBoardOpportunityActionId(makeRow({ action: 'Use charm', id: 'tool', tone: 'control' }))).toBe('tool');

        expect(getBoardOpportunityBeatCount(makeRow({ impactCue: 'super stack' }))).toBe(5);
        expect(getBoardOpportunityBeatCount(makeRow({ impactCue: 'combo surge' }))).toBe(4);
        expect(getBoardOpportunityBeatCount(makeRow({ impactCue: 'safe pair', id: 'hazard' }))).toBe(3);
        expect(getBoardOpportunityBeatCount(makeRow({ impactCue: 'safe pair', id: 'chain' }))).toBe(2);

        expect(getBoardOpportunityCompassSummaryTier(makeRow({ id: 'pickup', tone: 'pickup', impactCue: 'safe pair' }))).toBe('recover');
        expect(getBoardOpportunityCompassSummaryTier(makeRow({ id: 'tool', tone: 'setup', impactCue: 'safe pair' }))).toBe('tool');
        expect(getBoardOpportunityCompassSummaryTier(makeRow({ impactCue: 'route cashout' }))).toBe('cashout');

        expect(getBoardOpportunityCompassSummaryAction(makeRow({ id: 'pickup', tone: 'pickup', impactCue: 'safe pair' }))).toBe('claim');
        expect(getBoardOpportunityCompassSummaryAction(makeRow({ id: 'recovery', tone: 'recover', impactCue: 'safe pair' }))).toBe('recover');
        expect(getBoardOpportunityCompassSummaryAction(makeRow({ tone: 'perk', impactCue: 'route prime' }))).toBe('prime');
    });

    it('maps focused preview and opportunity presentation cues', () => {
        expect(getFocusedPreviewBeatCount({ kind: 'trait', tone: 'cashout', rewardHotText: null })).toBe(5);
        expect(getFocusedPreviewBeatCount({ kind: 'hazard', tone: 'hazard', rewardHotText: null })).toBe(3);
        expect(getFocusedPreviewAudioCue({ kind: 'pickup', tone: 'pickup', rewardHotText: null })).toBe('preview-pickup');
        expect(getFocusedPreviewScreenCue({ kind: 'trait', tone: 'setup', rewardHotText: null })).toBe('pulse');

        expect(boardOpportunityAudioCue(makeRow({ id: 'perk', impactCue: 'route prime' }))).toBe('opportunity-perk');
        expect(boardOpportunityAudioCue(makeRow({ id: 'chain', impactCue: 'route cashout' }))).toBe('opportunity-cashout');
        expect(boardOpportunityScreenCue(makeRow({ id: 'hazard', impactCue: 'safe pair' }))).toBe('guard');
        expect(boardOpportunityScreenCue(makeRow({ id: 'chain', impactCue: 'route prime' }))).toBe('pulse');
    });

    it('maps payoff stack crescendo audio', () => {
        expect(boardPayoffStackCrescendoAudioCue('super')).toBe('super-burst');
        expect(boardPayoffStackCrescendoAudioCue('stack')).toBe('stack-burst');
        expect(boardPayoffStackCrescendoAudioCue('cashout')).toBe('cashout-pop');
        expect(boardPayoffStackCrescendoAudioCue('prime')).toBe('prime-pop');
    });
});
