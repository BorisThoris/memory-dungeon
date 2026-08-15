import { describe, expect, it } from 'vitest';
import type { RunState } from '../../shared/contracts';
import type { BoardTurnResolvedEvent } from '../store/gameplayFeedbackAdapter';
import {
    getFloorClearActionSequenceCue,
    getFloorClearCarryForwardCue,
    getFloorClearCashoutRows,
    getFloorClearObjectiveSignalAudioCue,
    getFloorClearObjectiveSignalBeatCount,
    getFloorClearObjectiveSignalScreenCue,
    getFloorClearPayoffStackAction,
    getFloorClearPayoffStackAudioCue,
    getFloorClearPayoffStackBeatCount,
    getFloorClearPayoffStackScreenCue,
    getFloorClearPayoffStackSignal,
    getNextFloorSignalAudioCue,
    getNextFloorSignalBeatCount,
    getNextFloorSignalScreenCue,
    getPickupStackToastText
} from './gameScreenFloorClearFeedbackModel';

const floorClearRun = (overrides: Record<string, unknown> = {}): RunState => ({
    lastLevelResult: {
        scoreGained: 250,
        objectiveBonusScore: 100,
        mistakes: 0,
        perfect: true,
        featuredObjectiveCompleted: true,
        traitRouteObjectiveCompleted: false,
        traitRouteObjectiveRequired: null
    },
    stats: { bestStreak: 6, comboShards: 1 },
    lives: 3,
    findablesTotalThisFloor: 1,
    findablesClaimedThisFloor: 1,
    pendingRouteCardPlan: null,
    ...overrides
} as unknown as RunState);

describe('gameScreenFloorClearFeedbackModel', () => {
    it('summarizes paid and missed floor value as stable cashout rows', () => {
        const paid = getFloorClearCashoutRows(floorClearRun());
        expect(paid.map((row) => row.id)).toEqual(['cashout', 'missed', 'next']);
        expect(paid[0]).toMatchObject({ label: 'Cashout', tone: 'reward' });
        expect(paid[1]).toMatchObject({ label: 'Clean read', value: 'perfect clear' });

        const missed = getFloorClearCashoutRows(floorClearRun({
            findablesTotalThisFloor: 3,
            findablesClaimedThisFloor: 1
        }));
        expect(missed[1]).toMatchObject({ label: 'Missed value', tone: 'missed', value: '2 pickups left' });
        expect(missed[2]).toMatchObject({ value: 'claim pickups' });
    });

    it('collapses multiple paid lanes into one coherent super-stack cue', () => {
        const run = floorClearRun({
            lastLevelResult: {
                scoreGained: 400,
                objectiveBonusScore: 100,
                mistakes: 0,
                perfect: true,
                featuredObjectiveCompleted: true,
                traitRouteObjectiveCompleted: true,
                traitRouteObjectiveRequired: 'echo',
                traitRouteObjectiveReward: 'Trait route paid.'
            }
        });
        const rows = getFloorClearCashoutRows(run);
        const cue = getFloorClearPayoffStackSignal(run, rows, [
            { id: 'objective', label: 'Objective', value: 'Paid', tone: 'reward' }
        ], 1);

        expect(cue).toMatchObject({ label: 'Super stack', tone: 'super', value: '6 payoffs paid' });
        expect(getFloorClearPayoffStackBeatCount(cue!)).toBe(5);
        expect(getFloorClearPayoffStackAction(cue!)).toBe('Rebuild stack');
        expect(getFloorClearPayoffStackAudioCue(cue!)).toBe('floor-stack-super');
        expect(getFloorClearPayoffStackScreenCue(cue!)).toBe('super');
    });

    it('prioritizes banked relic picks in the carry-forward decision', () => {
        expect(getFloorClearCarryForwardCue(floorClearRun(), 2)).toEqual({
            detail: 'Spend it at the next milestone draft.',
            label: 'Carry forward',
            tone: 'reward',
            value: '+2 relic pick banked'
        });
    });

    it('keeps objective and next-floor beat, audio, and screen cues aligned', () => {
        const objective = { id: 'trait', label: 'Trait route', tone: 'trait', value: 'Paid' } as const;
        expect(getFloorClearObjectiveSignalBeatCount(objective)).toBe(4);
        expect(getFloorClearObjectiveSignalAudioCue(objective)).toBe('floor-objective-trait');
        expect(getFloorClearObjectiveSignalScreenCue(objective)).toBe('trait');

        const next = { detail: 'Ward ready', id: 'ward', label: 'Counter', tone: 'counterplay', value: 'Guard' } as const;
        expect(getNextFloorSignalBeatCount(next)).toBe(4);
        expect(getNextFloorSignalAudioCue(next)).toBe('next-floor-counterplay');
        expect(getNextFloorSignalScreenCue(next)).toBe('burst');
    });

    it('stacks pickup progress with an imminent chain reward', () => {
        const event = {
            matchedFindableKind: 'score_glint',
            currentStreakAfter: 3,
            comboShardsAfter: 0,
            livesAfter: 3,
            findablesClaimedAfter: 1,
            findablesTotalAfter: 2
        } as unknown as BoardTurnResolvedEvent;

        expect(getPickupStackToastText(event)).toContain('Pickups 1/2.');
    });

    it('turns the cashout state into an explicit next-floor action sequence', () => {
        const run = floorClearRun();
        const rows = getFloorClearCashoutRows(run);
        const stack = getFloorClearPayoffStackSignal(run, rows, [], 0);
        const carry = getFloorClearCarryForwardCue(run, 0);

        expect(getFloorClearActionSequenceCue({
            carryForwardCue: carry,
            cashoutRows: rows,
            payoffStackSignal: stack,
            routeChoiceRequired: true,
            run
        })).toMatchObject({
            first: 'Choose route card',
            label: 'Next floor loop',
            tone: 'route'
        });
    });
});
