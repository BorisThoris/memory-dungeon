import { describe, expect, it } from 'vitest';
import {
    mismatchFloaterLiveRegionText,
    mismatchFloaterNextAction,
    mismatchFloaterRecoveryBurst,
    mismatchFloaterRecoveryChips,
    mismatchFloaterRecoveryCrescendo,
    mismatchFloaterRecoveryCrescendoLabel,
    mismatchFloaterRecoveryHint,
    mismatchFloaterRecoveryLaneMap,
    mismatchFloaterRecoverySequence,
    mismatchFloaterRecoveryStack,
    mismatchFloaterSignal,
    mismatchFloaterVisualLabel
} from './mismatchFloater';

describe('mismatchFloaterLiveRegionText', () => {
    it('announces a recovery action and tempo loss for plain misses', () => {
        expect(mismatchFloaterLiveRegionText()).toBe(
            'No match. Next action: Safe pair: Safe match. Recovery sequence: First Safe match. Then Prime x3 loop. Keep Re-prime chain. Recover with a safe match. Chain reset'
        );
    });

    it('announces the chain depth lost when a high streak breaks', () => {
        expect(mismatchFloaterLiveRegionText([], null, { brokenChainDepth: 6 })).toBe(
            'No match. Chain x6 broken. Next chase: Break into x10. Next action: Rebuild chase: Break into x10. Recovery sequence: First Safe match. Then Break into x10. Keep Protect next streak. Recover with a safe match. x6 lost'
        );
    });

    it('announces the reward target lost when a high streak breaks near payoff', () => {
        expect(
            mismatchFloaterLiveRegionText([], null, {
                brokenChainDepth: 6,
                brokenChainRewardCue: { label: 'x8 +1 shard', distanceLabel: '2 matches' }
            })
        ).toBe(
            'No match. Chain x6 broken. Lost reward target: x8 +1 shard in 2 matches. Next chase: Break into x10. Next action: Save cashout: Rebuild toward x8 +1 shard. Recovery sequence: First Safe match. Then Rebuild toward x8 +1 shard. Keep Break into x10. Recover with a safe match. x6 lost'
        );
    });

    it('includes trait interaction text when present', () => {
        expect(mismatchFloaterLiveRegionText(['Cursed + Volatile: recall pressure'])).toBe(
            'Trait penalty. No match. Next action: Recover route: peek or route away. Recovery sequence: First peek or route away. Then Prime with tool. Keep Avoid repeat risk. Cursed + Volatile: recall pressure. Recover - peek or route away'
        );
    });

    it('announces multi-trait miss drawbacks as trait surge in the live region', () => {
        expect(
            mismatchFloaterLiveRegionText([
                'Cursed + Volatile: recall pressure',
                'Stasis: nearby trait blocked'
            ])
        ).toBe(
            'Trait surge: 2 risks. No match. Next action: Recover route: choose another opener. Recovery sequence: First choose another opener. Then Route away from surge. Keep Avoid repeat risk. Cursed + Volatile: recall pressure. Stasis: nearby trait blocked. Next - choose another opener'
        );
    });

    it('enriches legacy recovery lane maps with action verbs in live text', () => {
        expect(
            mismatchFloaterLiveRegionText(
                [],
                null,
                {
                    brokenChainDepth: 6,
                    brokenChainRewardCue: { label: 'x8 +1 shard', distanceLabel: '2 matches' }
                },
                'Recovery lane map. Recover: 1. Safe pair. Lost: 1. Lost cashout. Chain: 2. Chain lost.'
            )
        ).toBe(
            'No match. Chain x6 broken. Lost reward target: x8 +1 shard in 2 matches. Next chase: Break into x10. Next action: Save cashout: Rebuild toward x8 +1 shard. Recovery sequence: First Safe match. Then Rebuild toward x8 +1 shard. Keep Break into x10. Recovery lane map. Recover: 1. Confirm pair. Safe pair. Lost: 1. Save cashout. Lost cashout. Chain: 2. Rebuild chain. Chain lost. Recover with a safe match. x6 lost'
        );
    });

    it('does not duplicate explicit recovery lane actions in live text', () => {
        expect(
            mismatchFloaterLiveRegionText(
                ['Cursed + Volatile: recall pressure'],
                null,
                {},
                'Recovery lane map. Recover: 1. Stabilize route. Recover route. Tool: 1. Trigger tool. Use tool. Risk: 1. Route away. Avoid repeat.'
            )
        ).toBe(
            'Trait penalty. No match. Next action: Recover route: peek or route away. Recovery sequence: First peek or route away. Then Prime with tool. Keep Avoid repeat risk. Cursed + Volatile: recall pressure Recovery lane map. Recover: 1. Stabilize route. Recover route. Tool: 1. Trigger tool. Use tool. Risk: 1. Route away. Avoid repeat.'
        );
    });
});

describe('mismatchFloaterRecoveryHint', () => {
    it('recommends a safe match for plain misses', () => {
        expect(mismatchFloaterRecoveryHint()).toBe('Recover - safe match');
    });

    it('recommends a routing recovery for cursed volatile misses', () => {
        expect(mismatchFloaterRecoveryHint(['Cursed + Volatile: recall pressure'])).toBe(
            'Recover - peek or route away'
        );
    });

    it('recommends another opener for stasis blocks', () => {
        expect(mismatchFloaterRecoveryHint(['Stasis: nearby trait blocked'])).toBe(
            'Next - choose another opener'
        );
    });
});

describe('mismatchFloaterRecoveryChips', () => {
    it('keeps plain misses actionable with recover and tempo chips', () => {
        expect(mismatchFloaterRecoveryChips()).toEqual([
            { id: 'action', arcadeCue: 'Safe pair', label: 'Recover', value: 'Safe match', tone: 'recover' },
            { id: 'tempo', arcadeCue: 'Reset', label: 'Tempo', value: 'Chain reset', tone: 'tempo' }
        ]);
    });

    it('surfaces the lost chain as tempo feedback', () => {
        expect(mismatchFloaterRecoveryChips([], { brokenChainDepth: 6 })).toEqual([
            { id: 'action', arcadeCue: 'Safe pair', label: 'Recover', value: 'Safe match', tone: 'recover' },
            { id: 'tempo', arcadeCue: 'Chain lost', label: 'Tempo', value: 'x6 lost', tone: 'tempo' },
            { id: 'target', arcadeCue: 'Rebuild chase', label: 'Next chase', value: 'Break into x10', tone: 'chain' }
        ]);
    });

    it('adds a lost reward chip when a broken chain had a near payoff', () => {
        expect(
            mismatchFloaterRecoveryChips([], {
                brokenChainDepth: 6,
                brokenChainRewardCue: { label: 'x8 +1 shard', distanceLabel: '2 matches' }
            })
        ).toEqual([
            { id: 'action', arcadeCue: 'Safe pair', label: 'Recover', value: 'Safe match', tone: 'recover' },
            { id: 'tempo', arcadeCue: 'Chain lost', label: 'Tempo', value: 'x6 lost', tone: 'tempo' },
            { id: 'payoff', arcadeCue: 'Lost cashout', label: 'Lost reward', urgency: 'setup', value: 'x8 +1 shard', tone: 'risk' },
            { id: 'target', arcadeCue: 'Rebuild chase', label: 'Next chase', value: 'Break into x10', tone: 'chain' }
        ]);
    });

    it('marks one-away lost cashouts as urgent recovery chips', () => {
        expect(
            mismatchFloaterRecoveryChips([], {
                brokenChainDepth: 3,
                brokenChainRewardCue: { label: 'x4 +1 shard', distanceLabel: '1 match' }
            }).find((chip) => chip.id === 'payoff')
        ).toMatchObject({
            arcadeCue: 'Lost cashout',
            urgency: 'one-away',
            value: 'x4 +1 shard'
        });
    });

    it('turns risky trait misses into action, tool, and risk chips', () => {
        expect(mismatchFloaterRecoveryChips(['Cursed + Volatile: recall pressure'])).toEqual([
            { id: 'action', arcadeCue: 'Recover route', label: 'Recover', value: 'peek or route away', tone: 'recover' },
            { id: 'tool', arcadeCue: 'Use tool', label: 'Tool', value: 'Peek / route', tone: 'tool' },
            { id: 'tempo', arcadeCue: 'Avoid repeat', label: 'Risk', value: 'Avoid repeat', tone: 'risk' }
        ]);
    });

    it('calls out multi-trait miss drawbacks as a trait surge', () => {
        expect(
            mismatchFloaterRecoveryChips([
                'Cursed + Volatile: recall pressure',
                'Stasis: nearby trait blocked'
            ])
        ).toEqual([
            { id: 'action', arcadeCue: 'Recover route', label: 'Recover', value: 'choose another opener', tone: 'recover' },
            { id: 'surge', arcadeCue: 'Risk spike', label: 'Trait surge', value: '2 risks', tone: 'risk' },
            { id: 'tool', arcadeCue: 'Use tool', label: 'Tool', value: 'Peek / route', tone: 'tool' },
            { id: 'tempo', arcadeCue: 'Avoid repeat', label: 'Risk', value: 'Avoid repeat', tone: 'risk' }
        ]);
    });
});

describe('mismatchFloaterRecoveryLaneMap', () => {
    it('groups lost-reward recovery chips into readable recovery lanes', () => {
        expect(
            mismatchFloaterRecoveryLaneMap(
                mismatchFloaterRecoveryChips([], {
                    brokenChainDepth: 6,
                    brokenChainRewardCue: { label: 'x8 +1 shard', distanceLabel: '2 matches' }
                })
            )
        ).toEqual([
            { id: 'recover', label: 'Recover', count: 1, cue: 'Safe pair' },
            { id: 'lost', label: 'Lost', count: 1, cue: 'Lost cashout' },
            { id: 'chain', label: 'Chain', count: 2, cue: 'Chain lost' }
        ]);
    });

    it('groups trait-risk misses into recover, tool, and risk lanes', () => {
        expect(mismatchFloaterRecoveryLaneMap(mismatchFloaterRecoveryChips(['Cursed + Volatile: recall pressure']))).toEqual([
            { id: 'recover', label: 'Recover', count: 1, cue: 'Recover route' },
            { id: 'tool', label: 'Tool', count: 1, cue: 'Use tool' },
            { id: 'risk', label: 'Risk', count: 1, cue: 'Avoid repeat' }
        ]);
    });
});

describe('mismatchFloaterRecoveryBurst', () => {
    it('makes plain misses recoverable at a glance', () => {
        expect(mismatchFloaterRecoveryBurst()).toEqual({
            label: 'Recover',
            value: 'Safe match',
            tier: 'recover'
        });
    });

    it('promotes broken chains over generic recovery', () => {
        expect(mismatchFloaterRecoveryBurst([], { brokenChainDepth: 6 })).toEqual({
            label: 'Chain broken',
            value: 'x6 lost',
            tier: 'break'
        });
    });

    it('promotes lost reward targets over broken chain text', () => {
        expect(
            mismatchFloaterRecoveryBurst([], {
                brokenChainDepth: 6,
                brokenChainRewardCue: { label: 'x8 +1 shard', distanceLabel: '2 matches' }
            })
        ).toEqual({
            label: 'Reward lost',
            value: 'x8 +1 shard',
            tier: 'lost-reward'
        });
    });

    it('turns trait misses into a route risk pulse', () => {
        expect(mismatchFloaterRecoveryBurst(['Cursed + Volatile: recall pressure'])).toEqual({
            label: 'Route risk',
            value: 'peek or route away',
            tier: 'risk'
        });
    });

    it('promotes multi-trait miss drawbacks to a trait-surge pulse', () => {
        expect(
            mismatchFloaterRecoveryBurst([
                'Cursed + Volatile: recall pressure',
                'Stasis: nearby trait blocked'
            ])
        ).toEqual({
            label: 'Trait surge',
            value: '2 risks',
            tier: 'risk'
        });
    });
});

describe('mismatchFloaterRecoveryStack', () => {
    it('keeps plain misses lightweight', () => {
        expect(mismatchFloaterRecoveryStack()).toBeNull();
    });

    it('groups broken-chain lost rewards into one readable stack', () => {
        expect(
            mismatchFloaterRecoveryStack([], {
                brokenChainDepth: 6,
                brokenChainRewardCue: { label: 'x8 +1 shard', distanceLabel: '2 matches' }
            })
        ).toEqual({
            label: 'Lost reward stack',
            value: 'Chain break + Lost reward + Next chase',
            detail: 'x6 lost -> x8 +1 shard -> Break into x10',
            tone: 'lost-reward'
        });
    });

    it('groups trait penalties with the recovery route', () => {
        expect(mismatchFloaterRecoveryStack(['Cursed + Volatile: recall pressure'])).toEqual({
            label: 'Risk stack',
            value: 'Trait risk + Tool + Recover',
            detail: 'Cursed + Volatile -> peek or route away',
            tone: 'risk'
        });
    });

    it('groups multi-trait penalties as a trait-surge recovery stack', () => {
        expect(
            mismatchFloaterRecoveryStack([
                'Cursed + Volatile: recall pressure',
                'Stasis: nearby trait blocked'
            ])
        ).toEqual({
            label: 'Risk stack',
            value: 'Trait surge + Tool + Recover',
            detail: '2 trait risks -> choose another opener',
            tone: 'risk'
        });
    });
});

describe('mismatchFloaterRecoverySequence', () => {
    it('gives plain misses an immediate rebuild rhythm', () => {
        expect(mismatchFloaterRecoverySequence()).toEqual({
            first: 'Safe match',
            keep: 'Re-prime chain',
            label: 'Recovery sequence',
            then: 'Prime x3 loop',
            tone: 'recover'
        });
    });

    it('turns lost one-away rewards into a concrete recovery route', () => {
        expect(
            mismatchFloaterRecoverySequence([], {
                brokenChainDepth: 6,
                brokenChainRewardCue: { distanceLabel: '1 match', label: 'x6 +1 shard' }
            })
        ).toEqual({
            first: 'Safe match',
            keep: 'Break into x10',
            label: 'Recovery sequence',
            then: 'Rebuild toward x6 +1 shard',
            tone: 'lost-reward'
        });
    });

    it('uses trait-risk recovery as the first step before rebuilding', () => {
        expect(
            mismatchFloaterRecoverySequence(
                ['Cursed + Volatile: recall pressure'],
                { brokenChainDepth: 4 }
            )
        ).toEqual({
            first: 'peek or route away',
            keep: 'Protect next streak',
            label: 'Recovery sequence',
            then: 'Push x6 reward',
            tone: 'risk'
        });
    });
});

describe('mismatchFloaterRecoveryCrescendo', () => {
    it('keeps plain misses in a lightweight recover rhythm', () => {
        expect(mismatchFloaterRecoveryCrescendo()).toEqual({
            beatCount: 2,
            detail: 'Safe match then prime x3 loop',
            label: 'Recover beat',
            screenCue: 'pulse',
            tier: 'recover'
        });
    });

    it('marks plain chain breaks as a three-beat snap', () => {
        expect(mismatchFloaterRecoveryCrescendo([], { brokenChainDepth: 4 })).toEqual({
            beatCount: 3,
            detail: 'x4 lost; Push x6 reward',
            label: 'Break beat',
            screenCue: 'snap',
            tier: 'break'
        });
    });

    it('turns single trait penalties into a risk beat', () => {
        expect(mismatchFloaterRecoveryCrescendo(['Cursed + Volatile: recall pressure'])).toEqual({
            beatCount: 3,
            detail: 'peek or route away',
            label: 'Risk beat',
            screenCue: 'snap',
            tier: 'risk'
        });
    });

    it('promotes lost rewards to a burst rhythm', () => {
        expect(
            mismatchFloaterRecoveryCrescendo([], {
                brokenChainDepth: 6,
                brokenChainRewardCue: { label: 'x8 +1 shard', distanceLabel: '2 matches' }
            })
        ).toEqual({
            beatCount: 4,
            detail: 'Rebuild toward x8 +1 shard',
            label: 'Lost reward burst',
            screenCue: 'burst',
            tier: 'lost-reward'
        });
    });

    it('promotes multi-trait penalties to a trait surge burst', () => {
        expect(
            mismatchFloaterRecoveryCrescendo([
                'Cursed + Volatile: recall pressure',
                'Stasis: nearby trait blocked'
            ])
        ).toEqual({
            beatCount: 4,
            detail: '2 trait risks; route away before chasing',
            label: 'Trait surge burst',
            screenCue: 'burst',
            tier: 'trait-surge'
        });
    });

    it('uses the maximum beat count when trait surge and lost reward combine', () => {
        expect(
            mismatchFloaterRecoveryCrescendo(
                ['Cursed + Volatile: recall pressure', 'Stasis: nearby trait blocked'],
                {
                    brokenChainDepth: 6,
                    brokenChainRewardCue: { label: 'x8 +1 shard', distanceLabel: '2 matches' }
                }
            )
        ).toEqual({
            beatCount: 5,
            detail: 'Lost x8 +1 shard while 2 trait risks spiked',
            label: 'Trait surge burst',
            screenCue: 'super',
            tier: 'trait-surge'
        });
    });

    it('formats an accessible crescendo label', () => {
        expect(mismatchFloaterRecoveryCrescendoLabel('Mismatch recovery crescendo', mismatchFloaterRecoveryCrescendo())).toBe(
            'Mismatch recovery crescendo: Recover beat. 2 beats. Safe match then prime x3 loop.'
        );
    });
});

describe('mismatchFloaterNextAction', () => {
    it('turns plain misses into a direct next play', () => {
        expect(mismatchFloaterNextAction()).toEqual({
            arcadeCue: 'Safe pair',
            label: 'Recover now',
            value: 'Safe match',
            tone: 'recover'
        });
    });

    it('tells broken chains to stabilize before chasing again', () => {
        expect(mismatchFloaterNextAction([], { brokenChainDepth: 6 })).toEqual({
            arcadeCue: 'Rebuild chase',
            label: 'Rebuild chain',
            value: 'Break into x10',
            tone: 'risk'
        });
    });

    it('keeps lost rewards chaseable instead of only punitive', () => {
        expect(
            mismatchFloaterNextAction([], {
                brokenChainDepth: 6,
                brokenChainRewardCue: { label: 'x8 +1 shard', distanceLabel: '2 matches' }
            })
        ).toEqual({
            arcadeCue: 'Save cashout',
            label: 'Save streak',
            value: 'Rebuild toward x8 +1 shard',
            tone: 'lost-reward'
        });
    });

    it('uses trait recovery copy as the next play', () => {
        expect(mismatchFloaterNextAction(['Cursed + Volatile: recall pressure'])).toEqual({
            arcadeCue: 'Recover route',
            label: 'Recover route',
            value: 'peek or route away',
            tone: 'risk'
        });
    });
});

describe('mismatchFloaterVisualLabel', () => {
    it('returns short board label', () => {
        expect(mismatchFloaterVisualLabel()).toBe('Miss');
    });

    it('uses a chain break label for high-streak misses', () => {
        expect(mismatchFloaterVisualLabel([], { brokenChainDepth: 6 })).toBe('Break');
    });

    it('uses a stronger board label for trait penalties', () => {
        expect(mismatchFloaterVisualLabel(['Cursed + Volatile: recall pressure'])).toBe('Penalty');
    });
});

describe('mismatchFloaterSignal', () => {
    it('marks plain misses as miss feedback', () => {
        expect(mismatchFloaterSignal()).toEqual({ label: 'Miss', tone: 'miss' });
    });

    it('marks high-streak misses as chain break feedback', () => {
        expect(mismatchFloaterSignal([], { brokenChainDepth: 6 })).toEqual({ label: 'Break', tone: 'break' });
    });

    it('marks trait interaction misses as risk feedback', () => {
        expect(mismatchFloaterSignal(['Cursed + Volatile: recall pressure'])).toEqual({
            label: 'Risk',
            tone: 'penalty'
        });
    });
});
