import { describe, expect, it } from 'vitest';
import type { MemoryRouteChoiceFeedback } from '../../shared/memory-recall-feedback';
import {
    getRouteChoiceActionCue,
    getRouteChoiceBeatCue,
    getRouteChoiceDecisionStack,
    getRouteChoiceImpactCue,
    getRouteChoicePayoffAudioCue,
    getRouteChoicePayoffRows,
    getRouteChoicePayoffScreenCue,
    getRouteChoiceSignalAudioCue,
    getRouteChoiceSignalLabels,
    getRouteChoiceSignalScreenCue,
    getRouteChoiceToneBeatCount,
    getSelectedRouteActionCue,
    getSelectedRouteImpactCue,
    trimTerminalPunctuation
} from './gameScreenRouteChoiceModel';

const memoryChoice = (
    overrides: Partial<MemoryRouteChoiceFeedback> = {}
): MemoryRouteChoiceFeedback => ({
    id: 'safe',
    label: 'Safe route',
    routeType: 'safe',
    memoryPrompt: 'Protect recall.',
    readiness: 'ready',
    readinessLabel: 'Recall ready.',
    atmosphericCue: 'A steady ward.',
    consequence: 'Lower pressure.',
    tone: 'stable',
    ...overrides
});

describe('gameScreenRouteChoiceModel', () => {
    it('gives every route a distinct reward/risk contract and primary beat', () => {
        expect(getRouteChoiceSignalLabels('safe')).toEqual({ reward: 'Stable reward', risk: 'Low risk' });
        expect(getRouteChoiceSignalLabels('greed')).toEqual({ reward: 'High reward', risk: 'High risk' });
        expect(getRouteChoiceSignalLabels('mystery')).toEqual({ reward: 'Board change', risk: 'Unknown risk' });

        expect(getRouteChoiceBeatCue('safe')).toMatchObject({ beatCount: 2, tier: 'guard', screenCue: 'guard' });
        expect(getRouteChoiceBeatCue('greed')).toMatchObject({ beatCount: 5, tier: 'cashout', screenCue: 'super' });
        expect(getRouteChoiceBeatCue('mystery')).toMatchObject({ beatCount: 3, tier: 'prime', screenCue: 'pulse' });
    });

    it('adds recall readiness to the payoff rows without hiding route consequence', () => {
        const rows = getRouteChoicePayoffRows({
            memoryChoice: memoryChoice({ readiness: 'unsafe', readinessLabel: 'Recall overloaded.', routeType: 'greed' }),
            routeType: 'greed'
        });

        expect(rows).toEqual([
            { id: 'reward', label: 'Payoff', tone: 'reward', value: 'bonus value' },
            { id: 'risk', label: 'Risk', tone: 'risk', value: 'high pressure' },
            { id: 'next', label: 'Next', tone: 'risk', value: 'richer caches' },
            { id: 'memory', label: 'Recall', tone: 'risk', value: 'Recall overloaded.' }
        ]);
    });

    it('combines route value, recall, and first action into one decision stack', () => {
        const recall = memoryChoice();
        const payoffRows = getRouteChoicePayoffRows({ memoryChoice: recall, routeType: 'safe' });
        expect(getRouteChoiceDecisionStack({
            memoryChoice: recall,
            payoffRows,
            routeType: 'safe',
            signalLabels: getRouteChoiceSignalLabels('safe')
        })).toEqual({
            label: 'Route safety',
            nextCue: 'First: stabilize with ward support',
            tone: 'memory',
            value: 'Stable reward + Recall ready'
        });
    });

    it('turns unsafe Greed recall into an explicit repair-before-cashout action', () => {
        const recall = memoryChoice({
            readiness: 'unsafe',
            readinessLabel: 'Recall overloaded.',
            routeType: 'greed'
        });
        const payoffRows = getRouteChoicePayoffRows({ memoryChoice: recall, routeType: 'greed' });
        const stack = getRouteChoiceDecisionStack({
            memoryChoice: recall,
            payoffRows,
            routeType: 'greed',
            signalLabels: getRouteChoiceSignalLabels('greed')
        });

        expect(getRouteChoiceActionCue({ decisionStack: stack, memoryChoice: recall, routeType: 'greed' })).toEqual({
            action: 'Cash greed',
            detail: 'Repair recall before taking pressure cashout',
            label: 'Do next',
            tone: 'risk'
        });
    });

    it('keeps preview and selected-route impact/action cues semantically aligned', () => {
        const rows = getRouteChoicePayoffRows({ routeType: 'mystery' });
        const stack = getRouteChoiceDecisionStack({
            payoffRows: rows,
            routeType: 'mystery',
            signalLabels: getRouteChoiceSignalLabels('mystery')
        });

        expect(getRouteChoiceImpactCue({ decisionStack: stack, routeType: 'mystery' })).toEqual({
            label: 'Mystery route',
            tone: 'build',
            value: 'Board remix'
        });
        expect(getSelectedRouteImpactCue('mystery')).toEqual({
            label: 'Mystery route',
            tone: 'build',
            value: 'Remix locked'
        });
        expect(getSelectedRouteActionCue('mystery')).toMatchObject({
            tone: 'build',
            value: 'Solve clue first'
        });
    });

    it('derives consistent beat/audio/screen metadata and normalized labels', () => {
        expect(getRouteChoiceToneBeatCount('reward')).toBe(4);
        expect(getRouteChoicePayoffAudioCue('memory')).toBe('route-payoff-memory');
        expect(getRouteChoicePayoffScreenCue('build')).toBe('build');
        expect(getRouteChoiceSignalAudioCue('risk')).toBe('route-signal-risk');
        expect(getRouteChoiceSignalScreenCue('reward')).toBe('burst');
        expect(trimTerminalPunctuation('Recall ready...')).toBe('Recall ready');
    });
});
