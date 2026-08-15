import { describe, expect, it } from 'vitest';
import type { RunState } from '../../shared/contracts';
import type { DungeonExitStatus } from '../../shared/dungeon-rules';
import {
    GAMBIT_SIGNAL_ROWS,
    GAMBIT_SIGNAL_ROWS_LABEL,
    dungeonExitPromptLockLine,
    dungeonExitPromptTitle,
    formatGameplayDetailRowsLabel,
    getClearLifeBonusLabel,
    getFirstRouteChoiceTeachingLabel,
    getGambitSignalAudioCue,
    getGambitSignalBeatCount,
    getGambitSignalScreenCue,
    getOnboardingPromptSignalAudioCue,
    getOnboardingPromptSignalBeatCount,
    getOnboardingPromptSignalScreenCue,
    getOnboardingPromptSignals,
    getRiskWagerPrimaryCue,
    getRiskWagerSignalAudioCue,
    getRiskWagerSignalBeatCount,
    getRiskWagerSignalRows,
    getRiskWagerSignalScreenCue,
    getRouteSpecialSignalAudioCue,
    getRouteSpecialSignalBeatCount,
    getRouteSpecialSignalScreenCue,
    routeCardKindForRouteType,
    routeSpecialSignalRows,
    routeTypeLabel
} from './gameScreenDecisionSignals';

const exitStatus = (overrides: Partial<DungeonExitStatus> = {}): DungeonExitStatus => ({
    exitTile: null,
    revealed: true,
    lockKind: 'none',
    requiredLeverCount: 0,
    leverCount: 0,
    terminalKeySoftlockFallback: false,
    keyFallbackPending: false,
    hasMatchingKey: false,
    hasMasterKey: false,
    canActivateWithoutSpend: true,
    canActivateWithKey: false,
    canActivateWithMasterKey: false,
    canActivate: true,
    lockedReason: null,
    routeType: null,
    ...overrides
});

describe('gameScreenDecisionSignals', () => {
    it('maps route choices to cards and coherent multimodal special-pair cues', () => {
        expect(routeTypeLabel('safe')).toBe('Safe route');
        expect(routeCardKindForRouteType('greed')).toBe('greed_cache');

        const rows = routeSpecialSignalRows('mimic_cache');
        expect(rows.map(({ label, value }) => `${label}:${value}`)).toEqual([
            'Role:Trap loot',
            'Payoff:Scout first',
            'Risk:Blind bite'
        ]);
        expect(getRouteSpecialSignalBeatCount(rows[2])).toBe(3);
        expect(getRouteSpecialSignalAudioCue(rows[2])).toBe('route-card-risk');
        expect(getRouteSpecialSignalScreenCue(rows[2])).toBe('risk');
    });

    it('explains every exit-lock state, including terminal key fallback', () => {
        const fallback = exitStatus({ keyFallbackPending: true, lockKind: 'iron' });
        expect(dungeonExitPromptTitle(fallback)).toBe('Key fallback pending');
        expect(dungeonExitPromptLockLine(fallback, {} as RunState)).toContain('force this exit open');

        const keyed = exitStatus({ lockKind: 'iron', canActivateWithoutSpend: false });
        const run = { dungeonKeys: { iron: 2 }, dungeonMasterKeys: 1 } as RunState;
        expect(dungeonExitPromptTitle(keyed)).toBe('Iron key exit');
        expect(dungeonExitPromptLockLine(keyed, run)).toBe('Keys: 2 matching, 1 master.');
    });

    it('keeps clear-life rewards and first-route teaching explicit', () => {
        expect(getClearLifeBonusLabel({ clearLifeGained: 1, clearLifeReason: 'perfect' } as NonNullable<RunState['lastLevelResult']>))
            .toBe('Perfect floor bonus: +1 Life');
        expect(getClearLifeBonusLabel({ clearLifeGained: 0 } as NonNullable<RunState['lastLevelResult']>)).toBeNull();
        expect(getFirstRouteChoiceTeachingLabel('safe')).toBe('Recommended first route');
        expect(getFirstRouteChoiceTeachingLabel('greed')).toBe('High reward, higher danger');
    });

    it('projects onboarding steps into matching beat, audio, and screen signals', () => {
        const reward = getOnboardingPromptSignals('first_match')[1];
        expect(reward).toMatchObject({ label: 'Reward', value: 'Score pop', tone: 'reward' });
        expect(getOnboardingPromptSignalBeatCount(reward)).toBe(4);
        expect(getOnboardingPromptSignalAudioCue(reward)).toBe('onboarding-reward');
        expect(getOnboardingPromptSignalScreenCue(reward)).toBe('burst');
    });

    it('keeps Gambit opportunity copy and multimodal cost cues aligned', () => {
        expect(GAMBIT_SIGNAL_ROWS_LABEL).toContain('Window: Third flip');
        expect(GAMBIT_SIGNAL_ROWS_LABEL).toContain('Cost: No perfect');
        expect(getGambitSignalBeatCount('Cost')).toBe(3);
        expect(getGambitSignalAudioCue('Cost')).toBe('gambit-cost');
        expect(getGambitSignalScreenCue('Cost')).toBe('risk');
        expect(GAMBIT_SIGNAL_ROWS).toHaveLength(3);
    });

    it('derives wager rows and the primary decision cue from one wager state', () => {
        const rows = getRiskWagerSignalRows({ armed: true, bonusFavor: 4, streakAtRisk: 6 });
        expect(rows).toEqual([
            { label: 'Armed', value: 'x6 streak', tone: 'armed' },
            { label: 'Payoff', value: '+4 Favor', tone: 'reward' },
            { label: 'Trigger', value: 'Next objective', tone: 'objective' }
        ]);
        expect(getRiskWagerSignalBeatCount(rows[1])).toBe(4);
        expect(getRiskWagerSignalAudioCue(rows[1])).toBe('risk-wager-signal-reward');
        expect(getRiskWagerSignalScreenCue(rows[1])).toBe('burst');
        expect(getRiskWagerPrimaryCue({ armed: true, bonusFavor: 4, streakAtRisk: 6 })).toEqual({
            action: 'Protect streak',
            beatCount: 4,
            label: 'Wager armed',
            payoff: '+4 Favor',
            risk: 'x6 streak',
            tone: 'armed'
        });
        expect(formatGameplayDetailRowsLabel('Wager', rows)).toContain('Payoff: +4 Favor');
    });
});
