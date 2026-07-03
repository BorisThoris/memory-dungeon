import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RelicId } from '../../shared/contracts';
import { playRelicChoiceCrescendoSfx, resumeAudioContext } from '../audio/gameSfx';
import RelicDraftOfferPanel from './RelicDraftOfferPanel';

vi.mock('../audio/gameSfx', () => ({
    playRelicChoiceCrescendoSfx: vi.fn(),
    resumeAudioContext: vi.fn()
}));

describe('RelicDraftOfferPanel', () => {
    beforeEach(() => {
        vi.mocked(playRelicChoiceCrescendoSfx).mockClear();
        vi.mocked(resumeAudioContext).mockClear();
    });

    it('surfaces compact impact chips on relic choices', () => {
        const onPick = vi.fn();

        render(
            <RelicDraftOfferPanel
                currentRelicIds={['first_shuffle_free_per_floor']}
                descriptionById={{
                    region_shuffle_free_first: 'First row swap is free each floor.',
                    peek_charge_plus_one: '+1 peek charge.',
                    guard_token_plus_one: '+1 guard token.'
                } as Record<RelicId, string>}
                onPick={onPick}
                optionIds={['region_shuffle_free_first', 'peek_charge_plus_one', 'guard_token_plus_one']}
                payoffEngineSignal={{
                    detail: 'Chain + Pickup + Burst',
                    label: 'Payoff engine',
                    nextCue: 'Push x6 reward',
                    tone: 'burst',
                    value: '4 payoffs live'
                }}
                pickRound={0}
                serviceActions={[
                    {
                        available: true,
                        cost: 2,
                        description: 'Spend shop gold to roll a fresh relic trio once this draft round.',
                        effectPreview: 'Fresh choices',
                        label: 'Reroll offer',
                        serviceId: 'reroll_offer',
                        unavailableReason: null,
                        usedThisRound: 0
                    },
                    {
                        available: true,
                        cost: 3,
                        description: 'Spend shop gold to bias the visible choices toward uncommon and rare relics.',
                        effectPreview: 'Favor rare picks',
                        label: 'Upgrade offer',
                        serviceId: 'upgrade_offer',
                        unavailableReason: null,
                        usedThisRound: 0
                    }
                ]}
            />
        );

        const payoffEngine = screen.getByTestId('relic-draft-payoff-engine');
        expect(payoffEngine).toHaveAttribute('data-relic-payoff-engine-label', 'Super stack');
        expect(payoffEngine).toHaveAttribute('data-relic-payoff-engine-tone', 'super');
        expect(payoffEngine).toHaveAttribute('data-relic-payoff-engine-beats', '5');
        expect(payoffEngine).toHaveAttribute('data-relic-payoff-engine-action', 'Push relic stack');
        expect(payoffEngine).toHaveAttribute('data-relic-payoff-engine-audio', 'relic-payoff-super');
        expect(payoffEngine).toHaveAttribute('data-relic-payoff-engine-screen-cue', 'super');
        expect(payoffEngine.querySelectorAll('[data-relic-payoff-engine-beat]')).toHaveLength(5);
        expect(payoffEngine).toHaveTextContent('Super stack');
        expect(payoffEngine).toHaveTextContent('4 payoffs live');
        expect(payoffEngine).toHaveTextContent('Chain + Pickup + Burst');
        expect(payoffEngine).toHaveTextContent('Push x6 reward');
        expect(payoffEngine).toHaveAccessibleName(
            /Relic draft payoff engine.*Super stack: Push relic stack.*4 payoffs live.*Chain \+ Pickup \+ Burst.*Push x6 reward/i
        );
        const draftLaneMap = screen.getByTestId('relic-draft-lane-map');
        expect(draftLaneMap).toHaveAttribute('data-relic-draft-lane-map', 'stack:1>guard:1>route:1');
        expect(draftLaneMap).toHaveAttribute(
            'data-relic-draft-lane-actions',
            'stack:Stack now:1>guard:Protect run:1>route:Open route:1'
        );
        expect(draftLaneMap).toHaveAttribute('data-relic-draft-primary-lane', 'stack');
        expect(draftLaneMap).toHaveAttribute('data-relic-draft-primary-lane-action', 'Stack now');
        expect(draftLaneMap).toHaveAttribute('data-relic-draft-primary-lane-audio', 'relic-draft-lane-stack');
        expect(draftLaneMap).toHaveAttribute('data-relic-draft-primary-lane-beats', '4');
        expect(draftLaneMap).toHaveAttribute('data-relic-draft-primary-lane-cue', 'Best fit');
        expect(draftLaneMap).toHaveAttribute('data-relic-draft-primary-lane-screen-cue', 'burst');
        const primaryDraftLane = screen.getByTestId('relic-draft-primary-lane');
        expect(primaryDraftLane).toHaveAccessibleName('Primary draft lane. Stack: Stack now. Best fit. 4 beats.');
        expect(primaryDraftLane).toHaveAttribute('data-relic-draft-primary-lane', 'stack');
        expect(primaryDraftLane).toHaveAttribute('data-relic-draft-primary-lane-action', 'Stack now');
        expect(primaryDraftLane).toHaveAttribute('data-relic-draft-primary-lane-audio', 'relic-draft-lane-stack');
        expect(primaryDraftLane).toHaveAttribute('data-relic-draft-primary-lane-beats', '4');
        expect(primaryDraftLane).toHaveAttribute('data-relic-draft-primary-lane-cue', 'Best fit');
        expect(primaryDraftLane).toHaveAttribute('data-relic-draft-primary-lane-screen-cue', 'burst');
        expect(primaryDraftLane).toHaveTextContent('Best lane');
        expect(primaryDraftLane).toHaveTextContent('Stack');
        expect(primaryDraftLane).toHaveTextContent('Stack now');
        expect(primaryDraftLane.querySelectorAll('[data-relic-draft-primary-lane-beat]')).toHaveLength(4);
        expect(draftLaneMap).toHaveTextContent('Stack');
        expect(draftLaneMap).toHaveTextContent('Guard');
        expect(draftLaneMap).toHaveTextContent('Route');
        expect(draftLaneMap.querySelector('[data-relic-draft-lane="stack"]')).toHaveTextContent('Best fit');
        expect(draftLaneMap.querySelector('[data-relic-draft-lane="stack"]')).toHaveTextContent('Stack now');
        expect(draftLaneMap.querySelector('[data-relic-draft-lane="guard"]')).toHaveTextContent('Protect run');
        expect(draftLaneMap.querySelector('[data-relic-draft-lane="route"]')).toHaveTextContent('Open route');
        expect(draftLaneMap.querySelector('[data-relic-draft-lane="stack"]')).toHaveAttribute(
            'data-relic-draft-lane-action',
            'Stack now'
        );
        expect(draftLaneMap.querySelector('[data-relic-draft-lane="guard"]')).toHaveAttribute(
            'data-relic-draft-lane-action',
            'Protect run'
        );
        expect(draftLaneMap.querySelector('[data-relic-draft-lane="route"]')).toHaveAttribute(
            'data-relic-draft-lane-action',
            'Open route'
        );
        expect(draftLaneMap.querySelector('[data-relic-draft-lane="guard"]')).toHaveTextContent('Guard');
        expect(draftLaneMap.querySelector('[data-relic-draft-lane="route"]')).toHaveTextContent('Conduit Cartographer');
        expect(draftLaneMap.querySelector('[data-relic-draft-lane="stack"]')).toHaveAttribute(
            'data-relic-draft-lane-beats',
            '4'
        );
        expect(
            draftLaneMap
                .querySelector('[data-relic-draft-lane="stack"]')
                ?.querySelectorAll('[data-relic-draft-lane-beat]')
        ).toHaveLength(4);
        expect(draftLaneMap.querySelector('[data-relic-draft-lane="guard"]')).toHaveAttribute(
            'data-relic-draft-lane-beats',
            '3'
        );
        expect(
            draftLaneMap
                .querySelector('[data-relic-draft-lane="guard"]')
                ?.querySelectorAll('[data-relic-draft-lane-beat]')
        ).toHaveLength(3);
        expect(draftLaneMap.querySelector('[data-relic-draft-lane="route"]')).toHaveAttribute(
            'data-relic-draft-lane-beats',
            '3'
        );
        expect(draftLaneMap).toHaveAccessibleName(
            'Relic draft lane map. Stack: 1. Stack now. Best fit. Guard: 1. Protect run. Guard. Route: 1. Open route. Conduit Cartographer.'
        );

        const cards = screen.getAllByTestId('relic-offer-card');
        expect(cards[0]).toHaveTextContent('Action');
        expect(cards[1]).toHaveTextContent('Info');
        expect(cards[2]).toHaveTextContent('Guard');
        expect(cards[2]).toHaveTextContent('Momentum');
        expect(cards[1]?.querySelector('[data-impact-tone="info"]')).toHaveAttribute('data-impact-beats', '1');
        expect(cards[1]?.querySelector('[data-impact-tone="info"]')?.querySelectorAll('[data-impact-chip-beat]')).toHaveLength(1);
        expect(cards[2]?.querySelector('[data-impact-tone="momentum"]')).toHaveAttribute('data-impact-beats', '4');
        expect(cards[2]?.querySelector('[data-impact-tone="momentum"]')?.querySelectorAll('[data-impact-chip-beat]')).toHaveLength(4);
        expect(cards[0]).toHaveTextContent('+1 The Saboteur lane');
        expect(cards[0]).toHaveTextContent('Now x2');
        expect(cards[0]).toHaveTextContent('disarm / delete / reroute');
        expect(cards[0]).toHaveTextContent('Drift Routing');
        expect(cards[0]).toHaveTextContent('More row/swap charges');
        expect(cards[0]).toHaveTextContent('Use Drift matches');
        expect(cards[0]).toHaveTextContent('Choice heat');
        expect(cards[0]).toHaveTextContent('Pick action');
        expect(cards[0]).toHaveTextContent('Stack x2');
        expect(cards[0]).toHaveTextContent('Feed The Saboteur');
        expect(cards[0]).toHaveTextContent('Hot stack');
        expect(cards[0]).toHaveTextContent('Feeds your existing The Saboteur lane to x2');
        expect(cards[0]).toHaveTextContent('Stack burst');
        expect(cards[0]).toHaveTextContent('x2 The Saboteur');
        expect(cards[0]).toHaveTextContent('Next floor');
        expect(cards[0]).toHaveTextContent('disarm x2 lane');
        expect(cards[0]).toHaveTextContent('Board moment');
        expect(cards[0]).toHaveTextContent('Pick pulse');
        expect(cards[0]).toHaveTextContent('Stack The Saboteur');
        expect(cards[0]).toHaveTextContent('Current build becomes x2');
        expect(cards[0]).toHaveAttribute('data-relic-recommendation', 'best-fit');
        expect(cards[0]).toHaveAttribute('data-relic-choice-heat', 'hot');
        expect(cards[0]).toHaveAttribute('data-relic-choice-heat-value', 'Hot stack');
        expect(cards[0]).toHaveAttribute('data-relic-choice-crescendo-beats', '4');
        expect(cards[0]).toHaveAttribute('data-relic-choice-crescendo-action', 'Stack build');
        expect(cards[0]).toHaveAttribute('data-relic-choice-crescendo-audio', 'relic-crescendo-stack');
        expect(cards[0]).toHaveAttribute('data-relic-choice-crescendo-cue', 'burst');
        expect(cards[0]).toHaveAttribute('data-relic-choice-crescendo-tier', 'stack');
        expect(cards[0]).toHaveAttribute('data-relic-pick-action', 'Stack x2');
        expect(cards[0]).toHaveAttribute('data-relic-pick-action-tone', 'stack');
        expect(cards[0]).toHaveAttribute('data-relic-pick-plan-first', 'First: Stack x2');
        expect(cards[0]).toHaveAttribute('data-relic-pick-plan-then', 'Then: disarm x2 lane');
        expect(cards[0]).toHaveAttribute('data-relic-pick-plan-keep', 'Keep: disarm x2 lane');
        expect(cards[0]).toHaveAttribute(
            'data-relic-engine-recipe',
            'Stack x2 -> disarm x2 lane -> Drift Routing -> disarm x2 lane'
        );
        expect(cards[0]).toHaveAttribute('data-relic-combo-routes', 'drift_routing:drift+volatile:route');
        expect(cards[0]).toHaveTextContent('Best fit');
        expect(cards[0]).toHaveTextContent('x2');
        expect(cards[0]).toHaveTextContent('Stack burst');
        expect(cards[0]).toHaveTextContent('Current build becomes x2');
        expect(cards[0]).toHaveTextContent('First: Stack x2');
        expect(cards[0]).toHaveTextContent('Then: disarm x2 lane');
        expect(cards[0]).toHaveTextContent('Keep: disarm x2 lane');
        expect(cards[0]).toHaveAccessibleName(/Best fit: stacks your The Saboteur lane to x2/i);
        expect(cards[0]).toHaveAccessibleName(
            /Choice heat: Hot stack\. Feeds your existing The Saboteur lane to x2/i
        );
        expect(cards[0]).toHaveAccessibleName(
            /Choice crescendo: Stack build\. Stack burst\. Current build becomes x2\. 4 beats/i
        );
        expect(cards[0]).toHaveAccessibleName(/Pick action: Stack x2\. Feed The Saboteur/i);
        expect(cards[0]).toHaveAccessibleName(
            /Pick plan: First: Stack x2\. Then: disarm x2 lane\. Keep: disarm x2 lane/i
        );
        expect(cards[0]).toHaveAccessibleName(
            /Engine recipe: Pick: Stack x2\. Next: disarm x2 lane\. Route: Drift Routing\. Keep: disarm x2 lane/i
        );
        expect(cards[0]).toHaveAccessibleName(
            /Combo routes: Drift Routing\. Traits: Drift into Volatile\. Payoff: More row\/swap charges/i
        );
        expect(cards[0]).toHaveAccessibleName(/Stack burst: x2 The Saboteur/i);
        expect(cards[0]).toHaveAccessibleName(/Next floor: disarm x2 lane/i);
        expect(cards[0]).toHaveAccessibleName(/Board moment: disarm x2 lane/i);
        expect(cards[0]).toHaveAccessibleName(/Pick pulse: Stack The Saboteur\. Current build becomes x2/i);
        expect(cards[0]).toHaveAccessibleName(/Build fit: Stack x2, Play disarm, Route Drift Routing/i);
        expect(cards[0]).toHaveAccessibleName(/Trait payoff: Drift Routing: More row\/swap charges/i);
        expect(cards[0]).toHaveAccessibleName(/Use Drift matches to keep repositioning tools flowing/i);
        expect(cards[1]).toHaveTextContent('Conduit Cartographer');
        expect(cards[1]).toHaveTextContent('Extra score, peek charge value');
        expect(cards[1]).toHaveTextContent('Stack burst');
        expect(cards[1]).toHaveTextContent('Build plan');
        expect(cards[1]).toHaveTextContent('Move or route Conduit beside readable traits');
        expect(cards[1]).toHaveTextContent('Read combo lane');
        expect(cards[1]).toHaveTextContent('Open route');
        expect(cards[1]).toHaveTextContent('Open Conduit Cartographer');
        expect(cards[1]).toHaveTextContent('Route prime');
        expect(cards[1]).toHaveTextContent('Opens Conduit Cartographer');
        expect(cards[1]).toHaveAttribute('data-relic-choice-heat', 'setup');
        expect(cards[1]).toHaveAttribute('data-relic-choice-crescendo-beats', '2');
        expect(cards[1]).toHaveAttribute('data-relic-choice-crescendo-action', 'Prime route');
        expect(cards[1]).toHaveAttribute('data-relic-choice-crescendo-audio', 'relic-crescendo-prime');
        expect(cards[1]).toHaveAttribute('data-relic-choice-crescendo-cue', 'pulse');
        expect(cards[1]).toHaveAttribute('data-relic-choice-crescendo-tier', 'prime');
        expect(cards[1]).toHaveAttribute('data-relic-pick-action', 'Open route');
        expect(cards[1]).toHaveAttribute('data-relic-pick-action-tone', 'route');
        expect(cards[1]).toHaveAttribute('data-relic-pick-plan-first', 'First: Open route');
        expect(cards[1]).toHaveAttribute(
            'data-relic-pick-plan-then',
            'Then: Move or route Conduit beside readable traits before committing the match.'
        );
        expect(cards[1]).toHaveAttribute('data-relic-pick-plan-keep', 'Keep: readable pairs open');
        expect(cards[1]).toHaveAttribute(
            'data-relic-engine-recipe',
            'Open route -> Move or route Conduit beside readable traits before committing the match. -> Conduit Cartographer -> Read combo lane'
        );
        expect(cards[1]).toHaveAttribute(
            'data-relic-combo-routes',
            'conduit_cartographer:conduit+echo+mirror:guard'
        );
        expect(cards[1]).toHaveAttribute('data-relic-recommendation', 'standard');
        expect(cards[1]).toHaveAccessibleName(/Stack burst: Conduit Cartographer/i);
        expect(cards[1]).toHaveAccessibleName(
            /Choice crescendo: Prime route\. Prime beat\. Move or route Conduit beside readable traits before committing the match\. 2 beats/i
        );
        expect(cards[1]).toHaveAccessibleName(/Pick action: Open route\. Opens Conduit Cartographer/i);
        expect(cards[1]).toHaveAccessibleName(/Build fit: Lane New/i);
        expect(cards[1]).toHaveAccessibleName(/Trait payoff: Conduit Cartographer: Extra score, peek charge value/i);
        expect(cards[2]).toHaveTextContent('Mirror Warden');
        expect(cards[2]).toHaveTextContent('Guard, capped-guard score');
        expect(cards[2]).toHaveTextContent('Live payoff');
        expect(cards[2]).toHaveTextContent('Keep chain');
        expect(cards[2]).toHaveTextContent('Chain stays live');
        expect(cards[2]).toHaveAttribute('data-relic-choice-heat', 'live');
        expect(cards[2]).toHaveAttribute('data-relic-choice-crescendo-beats', '3');
        expect(cards[2]).toHaveAttribute('data-relic-choice-crescendo-action', 'Cash payoff');
        expect(cards[2]).toHaveAttribute('data-relic-choice-crescendo-audio', 'relic-crescendo-cashout');
        expect(cards[2]).toHaveAttribute('data-relic-choice-crescendo-cue', 'snap');
        expect(cards[2]).toHaveAttribute('data-relic-choice-crescendo-tier', 'cashout');
        expect(cards[2]).toHaveAttribute('data-relic-pick-action', 'Keep chain');
        expect(cards[2]).toHaveAttribute('data-relic-pick-action-tone', 'chain');
        expect(cards[2]).toHaveAttribute('data-relic-pick-plan-first', 'First: Keep chain');
        expect(cards[2]).toHaveAttribute(
            'data-relic-pick-plan-then',
            'Then: Route Mirror near Stasis when the floor has enough remaining pairs to exploit the block.'
        );
        expect(cards[2]).toHaveAttribute('data-relic-pick-plan-keep', 'Keep: chain alive');
        expect(cards[2]).toHaveAttribute(
            'data-relic-engine-recipe',
            'Keep chain -> Route Mirror near Stasis when the floor has enough remaining pairs to exploit the block. -> Mirror Warden -> Chain stays live'
        );
        expect(cards[2]).toHaveAccessibleName(/Pick action: Keep chain\. Route Mirror near Stasis/i);
        expect(cards[2]).toHaveAccessibleName(
            /Pick plan: First: Keep chain\. Then: Route Mirror near Stasis when the floor has enough remaining pairs to exploit the block\.+ Keep: chain alive/i
        );
        expect(screen.getAllByTestId('relic-impact-chips')).toHaveLength(3);
        expect(screen.getAllByTestId('relic-pick-action')).toHaveLength(3);
        expect(screen.getAllByTestId('relic-recommendation')).toHaveLength(1);
        expect(screen.getAllByTestId('relic-choice-heat')).toHaveLength(3);
        expect(screen.getAllByTestId('relic-choice-crescendo')).toHaveLength(3);
        expect(screen.getAllByTestId('relic-payoff-burst')).toHaveLength(3);
        expect(screen.getAllByTestId('relic-next-floor-cue')).toHaveLength(3);
        expect(screen.getAllByTestId('relic-board-moment-cue')).toHaveLength(3);
        expect(screen.getAllByTestId('relic-pick-pulse')).toHaveLength(3);
        expect(screen.getAllByTestId('relic-pick-plan')).toHaveLength(3);
        expect(screen.getAllByTestId('relic-engine-recipe')).toHaveLength(3);
        expect(screen.getAllByTestId('relic-build-pulse')).toHaveLength(3);
        expect(screen.getAllByTestId('relic-build-fit-signals')).toHaveLength(3);
        expect(screen.getAllByTestId('relic-combo-routes')).toHaveLength(3);
        expect(screen.getAllByTestId('relic-build-plan-rows')).toHaveLength(3);
        expect(cards[0]?.querySelector('[data-impact-tone="action"]')).toHaveTextContent('Action');
        expect(cards[0]?.querySelector('[data-testid="relic-impact-chips"]')).toHaveAccessibleName(
            /Row Compass impact chips.*Action/i
        );
        expect(cards[0]?.querySelector('[data-build-lane-count="2"]')).toHaveTextContent('Now x2');
        expect(cards[0]?.querySelector('[data-choice-heat-tier="hot"]')).toHaveTextContent('Hot stack');
        expect(cards[0]?.querySelector('[data-choice-crescendo-tier="stack"]')).toHaveTextContent('Stack burst');
        expect(cards[0]?.querySelector('[data-choice-crescendo-tier="stack"]')).toHaveTextContent('Stack build');
        expect(cards[0]?.querySelector('[data-choice-crescendo-tier="stack"]')).toHaveAttribute(
            'data-choice-crescendo-action',
            'Stack build'
        );
        expect(cards[0]?.querySelector('[data-choice-crescendo-tier="stack"]')).toHaveAttribute(
            'data-choice-crescendo-audio',
            'relic-crescendo-stack'
        );
        expect(cards[0]?.querySelector('[data-choice-crescendo-tier="stack"]')?.querySelectorAll('i')).toHaveLength(4);
        expect(cards[0]?.querySelector('[data-pick-action-tone="stack"]')).toHaveTextContent('Stack x2');
        expect(cards[0]?.querySelector('[data-pick-plan-tone="stack"]')).toHaveTextContent('First: Stack x2');
        expect(cards[0]?.querySelector('[data-testid="relic-pick-action"]')).toHaveAccessibleName(
            /Pick action: Stack x2\. Feed The Saboteur/i
        );
        expect(cards[0]?.querySelector('[data-testid="relic-pick-plan"]')).toHaveAccessibleName(
            /Pick plan: First: Stack x2\. Then: disarm x2 lane\. Keep: disarm x2 lane/i
        );
        expect(cards[0]?.querySelector('[data-testid="relic-engine-recipe"]')).toHaveAccessibleName(
            /Engine recipe: Pick: Stack x2\. Next: disarm x2 lane\. Route: Drift Routing\. Keep: disarm x2 lane/i
        );
        expect(cards[0]?.querySelector('[data-engine-recipe-step="pick"]')).toHaveTextContent('Stack x2');
        expect(cards[0]?.querySelector('[data-engine-recipe-step="next"]')).toHaveTextContent('disarm x2 lane');
        expect(cards[0]?.querySelector('[data-engine-recipe-step="route"]')).toHaveTextContent('Drift Routing');
        expect(cards[0]?.querySelector('[data-engine-recipe-step="keep"]')).toHaveTextContent('disarm x2 lane');
        expect(cards[0]?.querySelector('[data-testid="relic-choice-heat"]')).toHaveAccessibleName(
            /Choice heat: Hot stack\. Feeds your existing The Saboteur lane to x2/i
        );
        expect(cards[0]?.querySelector('[data-relic-payoff-tier="stack"]')).toHaveTextContent('x2 The Saboteur');
        expect(cards[0]?.querySelector('[data-relic-next-floor-tone="stack"]')).toHaveTextContent('disarm x2 lane');
        expect(cards[0]?.querySelector('[data-board-moment-tone="control"]')).toHaveTextContent('disarm x2 lane');
        expect(cards[0]?.querySelector('[data-pick-pulse-tone="stack"]')).toHaveTextContent('Stack The Saboteur');
        expect(cards[0]?.querySelector('[data-testid="relic-pick-pulse"]')).toHaveAccessibleName(
            /Pick pulse: Stack The Saboteur\. Current build becomes x2/i
        );
        expect(cards[0]?.querySelector('[data-testid="relic-next-floor-cue"]')).toHaveAccessibleName(
            /Next floor: disarm x2 lane/i
        );
        expect(cards[0]?.querySelector('[data-testid="relic-board-moment-cue"]')).toHaveAccessibleName(
            /Board moment: disarm x2 lane/i
        );
        expect(cards[0]?.querySelector('[data-testid="relic-build-pulse"]')).toHaveAccessibleName(
            /Row Compass build lane.*\+1 The Saboteur lane.*Now x2/i
        );
        expect(cards[0]?.querySelector('[data-build-fit-tone="stack"]')).toHaveTextContent('x2');
        expect(cards[0]?.querySelector('[data-build-fit-tone="stack"]')).toHaveAttribute('data-build-fit-beats', '4');
        expect(cards[0]?.querySelector('[data-build-fit-tone="stack"]')).toHaveAttribute('data-build-fit-action', 'Stack build');
        expect(cards[0]?.querySelector('[data-build-fit-tone="stack"]')).toHaveAttribute('data-build-fit-audio', 'relic-fit-stack');
        expect(cards[0]?.querySelector('[data-build-fit-tone="stack"]')).toHaveAttribute('data-build-fit-screen-cue', 'burst');
        expect(cards[0]?.querySelector('[data-build-fit-tone="stack"]')?.querySelectorAll('[data-build-fit-beat]')).toHaveLength(4);
        expect(cards[0]?.querySelector('[data-build-fit-tone="play"]')).toHaveTextContent('disarm');
        expect(cards[0]?.querySelector('[data-build-fit-tone="play"]')).toHaveAttribute('data-build-fit-beats', '3');
        expect(cards[0]?.querySelector('[data-build-fit-tone="play"]')).toHaveAttribute('data-build-fit-action', 'Play next');
        expect(cards[0]?.querySelector('[data-build-fit-tone="play"]')).toHaveAttribute('data-build-fit-screen-cue', 'snap');
        expect(cards[0]?.querySelector('[data-build-fit-tone="play"]')?.querySelectorAll('[data-build-fit-beat]')).toHaveLength(3);
        expect(cards[0]?.querySelector('[data-build-fit-tone="route"]')).toHaveTextContent('Drift Routing');
        expect(cards[0]?.querySelector('[data-build-fit-tone="route"]')).toHaveAttribute('data-build-fit-beats', '4');
        expect(cards[0]?.querySelector('[data-build-fit-tone="route"]')).toHaveAttribute('data-build-fit-action', 'Open route');
        expect(cards[0]?.querySelector('[data-build-fit-tone="route"]')).toHaveAttribute('data-build-fit-audio', 'relic-fit-route');
        expect(cards[0]?.querySelector('[data-build-fit-tone="route"]')?.querySelectorAll('[data-build-fit-beat]')).toHaveLength(4);
        expect(cards[0]?.querySelector('[data-testid="relic-build-fit-signals"]')).toHaveAccessibleName(
            /Row Compass build fit signals.*Stack: x2.*Play: disarm.*Route: Drift Routing/i
        );
        expect(cards[0]?.querySelector('[data-testid="relic-combo-routes"]')).toHaveAccessibleName(
            /Combo routes: Drift Routing.*Traits: Drift into Volatile.*Use Drift matches/i
        );
        expect(cards[0]?.querySelector('[data-combo-route-id="drift_routing"]')).toHaveAttribute(
            'data-combo-route-tone',
            'route'
        );
        expect(cards[0]?.querySelector('[data-combo-route-id="drift_routing"]')).toHaveAttribute(
            'data-combo-trait-count',
            '2'
        );
        expect(cards[0]?.querySelector('[data-combo-route-id="drift_routing"]')).toHaveAttribute(
            'data-combo-route-beats',
            '3'
        );
        expect(cards[0]?.querySelector('[data-combo-route-trait="drift"]')).toHaveTextContent('Drift');
        expect(cards[0]?.querySelector('[data-combo-route-trait="volatile"]')).toHaveTextContent('Volatile');
        expect(
            cards[0]?.querySelector('[data-combo-route-id="drift_routing"]')?.querySelectorAll('[data-combo-route-beat]')
        ).toHaveLength(3);
        expect(cards[0]?.querySelector('[data-build-plan-id="drift_routing"]')).toHaveTextContent('More row/swap charges');
        expect(cards[0]?.querySelector('[data-testid="relic-build-plan-rows"]')).toHaveAccessibleName(
            /Row Compass trait payoff rows.*Drift Routing: More row\/swap charges.*Use Drift matches/i
        );
        expect(cards[1]?.querySelector('[data-impact-tone="info"]')).toHaveTextContent('Info');
        expect(cards[1]?.querySelector('[data-relic-payoff-tier="new"]')).toHaveTextContent('Conduit Cartographer');
        expect(cards[1]?.querySelector('[data-choice-crescendo-tier="prime"]')?.querySelectorAll('i')).toHaveLength(2);
        expect(cards[1]?.querySelector('[data-relic-next-floor-tone="route"]')).toHaveTextContent(
            'Move or route Conduit beside readable traits'
        );
        expect(cards[1]?.querySelector('[data-board-moment-tone="scout"]')).toHaveTextContent('Read combo lane');
        expect(cards[1]?.querySelector('[data-pick-action-tone="route"]')).toHaveTextContent('Open route');
        expect(cards[1]?.querySelector('[data-pick-plan-tone="route"]')).toHaveTextContent(
            'Then: Move or route Conduit beside readable traits before committing the match.'
        );
        expect(cards[1]?.querySelector('[data-testid="relic-engine-recipe"]')).toHaveTextContent('Conduit Cartographer');
        expect(cards[1]?.querySelector('[data-testid="relic-engine-recipe"]')).toHaveTextContent('Read combo lane');
        expect(cards[1]?.querySelector('[data-pick-pulse-tone="route"]')).toHaveTextContent('Open Conduit Cartographer');
        expect(cards[1]?.querySelector('[data-choice-heat-tier="setup"]')).toHaveTextContent('Route prime');
        expect(cards[1]?.querySelector('[data-build-fit-tone="new"]')).toHaveTextContent('New');
        expect(cards[1]?.querySelector('[data-build-fit-tone="new"]')).toHaveAttribute('data-build-fit-beats', '2');
        expect(cards[1]?.querySelector('[data-build-fit-tone="new"]')).toHaveAttribute('data-build-fit-action', 'Start lane');
        expect(cards[1]?.querySelector('[data-build-fit-tone="new"]')).toHaveAttribute('data-build-fit-audio', 'relic-fit-new');
        expect(cards[1]?.querySelector('[data-build-fit-tone="new"]')).toHaveAttribute('data-build-fit-screen-cue', 'pulse');
        expect(cards[1]?.querySelector('[data-combo-route-id="conduit_cartographer"]')).toHaveAttribute(
            'data-combo-route-tone',
            'guard'
        );
        expect(cards[1]?.querySelector('[data-combo-route-id="conduit_cartographer"]')).toHaveAttribute(
            'data-combo-trait-count',
            '3'
        );
        expect(cards[1]?.querySelector('[data-combo-route-id="conduit_cartographer"]')).toHaveAttribute(
            'data-combo-route-beats',
            '4'
        );
        expect(cards[1]?.querySelector('[data-combo-route-trait="conduit"]')).toHaveTextContent('Conduit');
        expect(cards[1]?.querySelector('[data-combo-route-trait="echo"]')).toHaveTextContent('Echo');
        expect(cards[1]?.querySelector('[data-combo-route-trait="mirror"]')).toHaveTextContent('Mirror');
        expect(cards[2]?.querySelector('[data-impact-tone="guard"]')).toHaveTextContent('Guard');
        expect(cards[2]?.querySelector('[data-impact-tone="momentum"]')).toHaveTextContent('Momentum');
        expect(cards[2]?.querySelector('[data-choice-heat-tier="live"]')).toHaveTextContent('Live payoff');
        expect(cards[2]?.querySelector('[data-pick-action-tone="chain"]')).toHaveTextContent('Keep chain');
        expect(cards[2]?.querySelector('[data-pick-plan-tone="chain"]')).toHaveTextContent('Keep: chain alive');
        expect(cards[2]?.querySelector('[data-testid="relic-engine-recipe"]')).toHaveTextContent('Mirror Warden');
        expect(cards[2]?.querySelector('[data-testid="relic-engine-recipe"]')).toHaveTextContent('Chain stays live');
        expect(cards[2]?.querySelector('[data-board-moment-tone="chain"]')).toHaveTextContent('Chain stays live');
        expect(cards[2]?.querySelector('[data-pick-pulse-tone="chain"]')).toHaveTextContent('Keep chain alive');
        expect(cards[2]?.querySelector('[data-choice-crescendo-tier="cashout"]')).toHaveTextContent('Cashout beat');
        expect(cards[2]?.querySelector('[data-choice-crescendo-tier="cashout"]')).toHaveTextContent('Cash payoff');
        expect(cards[2]?.querySelector('[data-choice-crescendo-tier="cashout"]')).toHaveAttribute(
            'data-choice-crescendo-action',
            'Cash payoff'
        );
        expect(cards[2]?.querySelector('[data-choice-crescendo-tier="cashout"]')?.querySelectorAll('i')).toHaveLength(3);
        expect(screen.getByTestId('relic-offer-services')).toHaveTextContent('2g');
        expect(screen.getByTestId('relic-offer-services')).toHaveTextContent('Fresh choices');
        expect(screen.getByTestId('relic-offer-services').querySelector('[data-service-effect="upgrade_offer"]')).toHaveTextContent('Favor rare picks');
        expect(screen.getByTestId('relic-service-reroll_offer-cue')).toHaveTextContent(
            'Use when no relic feeds your current payoffs'
        );
        expect(screen.getByTestId('relic-service-reroll_offer-cue')).toHaveAttribute(
            'data-service-cue-tone',
            'reroll'
        );
        expect(screen.getByTestId('relic-service-reroll_offer-cue')).toHaveAccessibleName(
            'Service cue: Use when no relic feeds your current payoffs.'
        );
        expect(screen.getByTestId('relic-service-upgrade_offer-cue')).toHaveTextContent(
            'Raise the ceiling before locking a pick'
        );
        expect(screen.getByTestId('relic-service-upgrade_offer-cue')).toHaveAttribute(
            'data-service-cue-tone',
            'upgrade'
        );
        expect(
            screen.getByRole('button', {
                name: /Reroll offer\. Cost: 2 gold\. Effect: Fresh choices\. Service cue: Use when no relic feeds your current payoffs/i
            })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', {
                name: /Upgrade offer\. Cost: 3 gold\. Effect: Favor rare picks\. Service cue: Raise the ceiling before locking a pick/i
            })
        ).toBeInTheDocument();

        fireEvent.click(cards[0]!);
        expect(onPick).toHaveBeenCalledWith('region_shuffle_free_first');
    });

    it('plays each relic choice crescendo once per focused or hovered option signature', () => {
        const onPick = vi.fn();

        render(
            <RelicDraftOfferPanel
                currentRelicIds={['first_shuffle_free_per_floor']}
                descriptionById={{
                    region_shuffle_free_first: 'First row swap is free each floor.',
                    peek_charge_plus_one: '+1 peek charge.',
                    guard_token_plus_one: '+1 guard token.'
                } as Record<RelicId, string>}
                onPick={onPick}
                optionIds={['region_shuffle_free_first', 'peek_charge_plus_one', 'guard_token_plus_one']}
                pickRound={0}
                sfxGain={0.75}
            />
        );

        const cards = screen.getAllByTestId('relic-offer-card');
        fireEvent.focus(cards[0]!);
        fireEvent.pointerEnter(cards[0]!);
        fireEvent.focus(cards[1]!);

        expect(resumeAudioContext).toHaveBeenCalledTimes(2);
        expect(playRelicChoiceCrescendoSfx).toHaveBeenCalledTimes(2);
        expect(playRelicChoiceCrescendoSfx).toHaveBeenNthCalledWith(1, 0.75, 'stack', 4);
        expect(playRelicChoiceCrescendoSfx).toHaveBeenNthCalledWith(2, 0.75, 'prime', 2);
    });
});
