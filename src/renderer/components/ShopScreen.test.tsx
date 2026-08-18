import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunShopOfferState, RunState } from '../../shared/contracts';
import { createNewRun } from '../../shared/game-core';
import { createDefaultSaveData } from '../../shared/save-data';
import { SHOP_ITEM_CATALOG } from '../../shared/shop-rules';
import { useAppStore } from '../store/useAppStore';
import ShopScreen from './ShopScreen';

const uiSfxMocks = vi.hoisted(() => ({
    playUiBackSfx: vi.fn(),
    playUiClickSfx: vi.fn(),
    playUiConfirmSfx: vi.fn(),
    resumeUiSfxContext: vi.fn(),
    uiSfxGainFromSettings: (masterVolume: number, sfxVolume: number) =>
        Math.max(0, Math.min(1, masterVolume)) * Math.max(0, Math.min(1, sfxVolume))
}));

vi.mock('../audio/uiSfx', () => uiSfxMocks);

const offer = (
    itemId: RunShopOfferState['itemId'],
    overrides: Partial<RunShopOfferState> = {}
): RunShopOfferState => ({
    ...SHOP_ITEM_CATALOG[itemId],
    id: `offer-${itemId}`,
    compatible: true,
    purchased: false,
    unavailableReason: null,
    ...overrides
});

describe('ShopScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAppStore.setState({ run: null, view: 'menu', shopReturnMode: null });
    });

    it('shows shop offer signal chips and payoff rows for setup, key, and blocked buys', () => {
        const saveData = createDefaultSaveData();
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 77 });
        const run = {
            ...baseRun,
            status: 'levelComplete',
            shopGold: 2,
            findablesClaimedThisFloor: 1,
            findablesTotalThisFloor: 2,
            traitRouteObjectiveProgressThisFloor: 1,
            traitRouteObjectiveRequiredThisFloor: 2,
            stats: {
                ...baseRun.stats,
                currentStreak: 4,
                bestStreak: 5,
                comboShards: 2,
                guardTokens: 1
            },
            board: {
                ...baseRun.board!,
                tiles: baseRun.board!.tiles.map((tile, index) =>
                    index === 0
                        ? { ...tile, tileTraitKind: 'conduit' as const }
                        : index === 1
                          ? { ...tile, tileTraitKind: 'echo' as const }
                          : tile
                )
            },
            pendingRouteCardPlan: {
                choiceId: 'greed',
                routeType: 'greed',
                sourceLevel: 1,
                targetLevel: 2
            },
            shopOffers: [
                offer('trait_routing_kit'),
                offer('master_key', { cost: 2 }),
                offer('destroy_charge', { cost: 5 })
            ]
        } as RunState;
        useAppStore.setState({
            hydrated: true,
            hydrating: false,
            view: 'shop',
            saveData,
            settings: saveData.settings,
            run,
            shopReturnMode: 'summary'
        });

        render(<ShopScreen />);

        const payoffEngine = screen.getByTestId('shop-payoff-engine');
        expect(payoffEngine).toHaveAttribute('data-shop-payoff-engine-tone', 'super');
        expect(payoffEngine).toHaveAttribute('data-shop-payoff-engine-beats', '5');
        expect(payoffEngine).toHaveAttribute('data-shop-payoff-engine-action', 'Push buy stack');
        expect(payoffEngine).toHaveAttribute('data-shop-payoff-engine-audio', 'shop-payoff-engine-super');
        expect(payoffEngine).toHaveAttribute('data-shop-payoff-engine-screen-cue', 'super');
        expect(payoffEngine.querySelectorAll('[data-shop-payoff-engine-beat]')).toHaveLength(5);
        expect(payoffEngine).toHaveTextContent('Super stack');
        expect(payoffEngine).toHaveTextContent('4 payoffs live');
        expect(payoffEngine).toHaveTextContent('Chain + Pickup + Burst + Trait route');
        expect(payoffEngine).toHaveTextContent('Push x6 reward');
        expect(payoffEngine).toHaveAccessibleName(
            /Shop payoff engine.*Super stack: Push buy stack.*4 payoffs live.*Chain \+ Pickup \+ Burst \+ Trait route.*Push x6 reward/i
        );
        const offerLaneMap = screen.getByTestId('shop-offer-lane-map');
        expect(offerLaneMap).toHaveAttribute('data-shop-offer-lane-map', 'route:1>blocked:2');
        expect(offerLaneMap).toHaveAttribute('data-shop-offer-lane-actions', 'route:Open route:1>blocked:Earn gold:2');
        expect(offerLaneMap).toHaveAttribute('data-shop-offer-lane-roles', 'route:Open:1>blocked:Bank:2');
        expect(offerLaneMap).toHaveAttribute('data-shop-offer-lane-role-ids', 'route:open:1>blocked:bank:2');
        expect(offerLaneMap).toHaveAttribute('data-shop-primary-offer-lane', 'route');
        expect(offerLaneMap).toHaveAttribute('data-shop-primary-offer-lane-action', 'Open route');
        expect(offerLaneMap).toHaveAttribute('data-shop-primary-offer-lane-audio', 'shop-lane-route');
        expect(offerLaneMap).toHaveAttribute('data-shop-primary-offer-lane-beats', '4');
        expect(offerLaneMap).toHaveAttribute('data-shop-primary-offer-lane-cue', 'Open greedy route');
        expect(offerLaneMap).toHaveAttribute('data-shop-primary-offer-lane-role', 'Open');
        expect(offerLaneMap).toHaveAttribute('data-shop-primary-offer-lane-role-id', 'open');
        expect(offerLaneMap).toHaveAttribute('data-shop-primary-offer-lane-screen-cue', 'burst');
        const offerLaneMapSummary = screen.getByTestId('shop-offer-lane-map-summary');
        expect(offerLaneMapSummary).toHaveAttribute('data-shop-offer-lane-count', '2');
        expect(offerLaneMapSummary).toHaveAttribute('data-shop-offer-lane-summary-primary', 'route');
        expect(offerLaneMapSummary).toHaveAttribute('data-shop-offer-lane-summary-primary-action', 'Open route');
        expect(offerLaneMapSummary).toHaveAttribute('data-shop-offer-lane-summary-primary-audio', 'shop-lane-route');
        expect(offerLaneMapSummary).toHaveAttribute('data-shop-offer-lane-summary-primary-role', 'Open');
        expect(offerLaneMapSummary).toHaveAttribute('data-shop-offer-lane-summary-primary-role-id', 'open');
        expect(offerLaneMapSummary).toHaveAttribute('data-shop-offer-lane-summary-primary-screen-cue', 'burst');
        expect(offerLaneMapSummary).toHaveTextContent('Lanes');
        expect(offerLaneMapSummary).toHaveTextContent('2 lanes');
        expect(offerLaneMapSummary).toHaveTextContent('Open Route');
        expect(offerLaneMapSummary.querySelectorAll('[data-shop-offer-lane-map-summary-beat]')).toHaveLength(3);
        expect(
            offerLaneMapSummary.querySelector('[data-shop-offer-lane-map-summary-beat="1"]')
        ).toHaveAttribute('data-shop-offer-lane-map-summary-beat-focus', 'route');
        expect(
            offerLaneMapSummary.querySelector('[data-shop-offer-lane-map-summary-beat="1"]')
        ).toHaveAttribute('data-shop-offer-lane-map-summary-beat-role-id', 'open');
        expect(
            offerLaneMapSummary.querySelector('[data-shop-offer-lane-map-summary-beat="1"]')
        ).toHaveAttribute('data-shop-offer-lane-map-summary-beat-screen-cue', 'burst');
        expect(
            offerLaneMapSummary.querySelector('[data-shop-offer-lane-map-summary-beat="2"]')
        ).toHaveAttribute('data-shop-offer-lane-map-summary-beat-focus', 'support');
        const primaryOfferLane = screen.getByTestId('shop-primary-offer-lane');
        expect(primaryOfferLane).toHaveAccessibleName('Primary shop lane. Open Route: Open route. Open greedy route. 4 beats.');
        expect(primaryOfferLane).toHaveAttribute('data-shop-primary-offer-lane', 'route');
        expect(primaryOfferLane).toHaveAttribute('data-shop-primary-offer-lane-action', 'Open route');
        expect(primaryOfferLane).toHaveAttribute('data-shop-primary-offer-lane-audio', 'shop-lane-route');
        expect(primaryOfferLane).toHaveAttribute('data-shop-primary-offer-lane-beats', '4');
        expect(primaryOfferLane).toHaveAttribute('data-shop-primary-offer-lane-cue', 'Open greedy route');
        expect(primaryOfferLane).toHaveAttribute('data-shop-primary-offer-lane-role', 'Open');
        expect(primaryOfferLane).toHaveAttribute('data-shop-primary-offer-lane-role-id', 'open');
        expect(primaryOfferLane).toHaveAttribute('data-shop-primary-offer-lane-screen-cue', 'burst');
        expect(primaryOfferLane).toHaveTextContent('Best buy lane');
        expect(primaryOfferLane).toHaveTextContent('Open');
        expect(primaryOfferLane).toHaveTextContent('Open route');
        expect(primaryOfferLane.querySelectorAll('[data-shop-primary-offer-lane-beat]')).toHaveLength(4);
        expect(offerLaneMap).toHaveTextContent('Route');
        expect(offerLaneMap).toHaveTextContent('Open');
        expect(offerLaneMap).toHaveTextContent('Open route');
        expect(offerLaneMap).toHaveTextContent('x1 / Open greedy route');
        expect(offerLaneMap).toHaveTextContent('Blocked');
        expect(offerLaneMap).toHaveTextContent('Bank');
        expect(offerLaneMap).toHaveTextContent('Earn gold');
        expect(offerLaneMap).toHaveTextContent('x2 / Need 1g before map conduit cartographer');
        expect(offerLaneMap.querySelector('[data-shop-offer-lane="route"]')).toHaveAttribute(
            'data-shop-offer-lane-action',
            'Open route'
        );
        expect(offerLaneMap.querySelector('[data-shop-offer-lane="route"]')).toHaveAttribute(
            'data-shop-offer-lane-beats',
            '4'
        );
        expect(offerLaneMap.querySelector('[data-shop-offer-lane="route"]')).toHaveAttribute('data-shop-offer-lane-role', 'Open');
        expect(offerLaneMap.querySelector('[data-shop-offer-lane="route"]')).toHaveAttribute('data-shop-offer-lane-role-id', 'open');
        expect(
            offerLaneMap.querySelector('[data-shop-offer-lane="route"]')?.querySelectorAll('[data-shop-offer-lane-beat]')
        ).toHaveLength(4);
        expect(offerLaneMap.querySelector('[data-shop-offer-lane="blocked"]')).toHaveAttribute(
            'data-shop-offer-lane-action',
            'Earn gold'
        );
        expect(offerLaneMap.querySelector('[data-shop-offer-lane="blocked"]')).toHaveAttribute(
            'data-shop-offer-lane-beats',
            '4'
        );
        expect(offerLaneMap.querySelector('[data-shop-offer-lane="blocked"]')).toHaveAttribute('data-shop-offer-lane-role', 'Bank');
        expect(offerLaneMap.querySelector('[data-shop-offer-lane="blocked"]')).toHaveAttribute(
            'data-shop-offer-lane-role-id',
            'bank'
        );
        expect(
            offerLaneMap
                .querySelector('[data-shop-offer-lane="blocked"]')
                ?.querySelectorAll('[data-shop-offer-lane-beat]')
        ).toHaveLength(4);
        expect(offerLaneMap).toHaveAccessibleName(
            'Shop offer lanes. Route: Open x1. Open route. Open greedy route. Blocked: Bank x2. Earn gold. Need 1g before map conduit cartographer.'
        );

        expect(screen.getByTestId('shop-offer-trait_routing_kit-signals')).toHaveTextContent('Combo prime');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-signals')).toHaveTextContent('Recall');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-signals')).toHaveAttribute(
            'aria-label',
            'Trait routing kit offer signals. Combo prime. Recall.'
        );
        const traitRoutingSignals = screen.getByTestId('shop-offer-trait_routing_kit-signals');
        const comboPrimeSignal = traitRoutingSignals.querySelector('[data-shop-signal-tone="setup"]');
        const recallSignal = traitRoutingSignals.querySelector('[data-shop-signal-tone="recall"]');
        expect(comboPrimeSignal).toHaveAttribute('data-shop-signal-beats', '4');
        expect(comboPrimeSignal).toHaveAttribute('data-shop-signal-action', 'Prime route');
        expect(comboPrimeSignal).toHaveAttribute('data-shop-signal-audio', 'shop-signal-setup');
        expect(comboPrimeSignal).toHaveAttribute('data-shop-signal-screen-cue', 'burst');
        expect(comboPrimeSignal).toHaveTextContent('Prime route');
        expect(comboPrimeSignal?.querySelectorAll('[data-shop-signal-beat]')).toHaveLength(4);
        expect(recallSignal).toHaveAttribute('data-shop-signal-beats', '3');
        expect(recallSignal).toHaveAttribute('data-shop-signal-action', 'Reveal pair');
        expect(recallSignal).toHaveAttribute('data-shop-signal-audio', 'shop-signal-recall');
        expect(recallSignal).toHaveAttribute('data-shop-signal-screen-cue', 'pulse');
        expect(recallSignal?.querySelectorAll('[data-shop-signal-beat]')).toHaveLength(3);
        expect(screen.getByTestId('shop-offer-trait_routing_kit-payoffs')).toHaveTextContent('+1 peek and +1 route link');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-payoffs')).toHaveTextContent('prime a trait chain turn');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-payoffs')).toHaveTextContent('link trait cards');
        expect(
            screen.getByTestId('shop-offer-trait_routing_kit-payoffs').querySelector('[data-shop-payoff-id="gain"]')
        ).toHaveAttribute('data-shop-payoff-beats', '4');
        expect(
            screen.getByTestId('shop-offer-trait_routing_kit-payoffs').querySelector('[data-shop-payoff-id="gain"]')
        ).toHaveAttribute('data-shop-payoff-action', 'Claim payoff');
        expect(
            screen.getByTestId('shop-offer-trait_routing_kit-payoffs').querySelector('[data-shop-payoff-id="gain"]')
        ).toHaveAttribute('data-shop-payoff-audio', 'shop-payoff-gain');
        expect(
            screen.getByTestId('shop-offer-trait_routing_kit-payoffs').querySelector('[data-shop-payoff-id="gain"]')
        ).toHaveAttribute('data-shop-payoff-screen-cue', 'burst');
        expect(
            screen
                .getByTestId('shop-offer-trait_routing_kit-payoffs')
                .querySelector('[data-shop-payoff-id="gain"]')
                ?.querySelectorAll('[data-shop-payoff-beat]')
        ).toHaveLength(4);
        expect(
            screen.getByTestId('shop-offer-trait_routing_kit-payoffs').querySelector('[data-shop-payoff-id="setup"]')
        ).toHaveAttribute('data-shop-payoff-beats', '3');
        expect(
            screen.getByTestId('shop-offer-trait_routing_kit-payoffs').querySelector('[data-shop-payoff-id="setup"]')
        ).toHaveAttribute('data-shop-payoff-action', 'Prime route');
        expect(
            screen.getByTestId('shop-offer-trait_routing_kit-payoffs').querySelector('[data-shop-payoff-id="setup"]')
        ).toHaveAttribute('data-shop-payoff-screen-cue', 'snap');
        expect(
            screen
                .getByTestId('shop-offer-trait_routing_kit-payoffs')
                .querySelector('[data-shop-payoff-id="setup"]')
                ?.querySelectorAll('[data-shop-payoff-beat]')
        ).toHaveLength(3);
        expect(
            screen.getByTestId('shop-offer-trait_routing_kit-payoffs').querySelector('[data-shop-payoff-id="blocked"]')
        ).toHaveAttribute('data-shop-payoff-beats', '2');
        expect(
            screen.getByTestId('shop-offer-trait_routing_kit-payoffs').querySelector('[data-shop-payoff-id="blocked"]')
        ).toHaveAttribute('data-shop-payoff-action', 'Earn gold');
        expect(
            screen.getByTestId('shop-offer-trait_routing_kit-payoffs').querySelector('[data-shop-payoff-id="blocked"]')
        ).toHaveAttribute('data-shop-payoff-screen-cue', 'locked');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-payoff-burst')).toHaveTextContent('Blocked');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-payoff-burst')).toHaveTextContent('Not enough shop gold');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-payoff-burst')).toHaveAttribute(
            'data-shop-payoff-burst-tier',
            'blocked'
        );
        expect(screen.getByTestId('shop-offer-trait_routing_kit')).toHaveAttribute('data-shop-impact-cue', 'Blocked');
        expect(screen.getByTestId('shop-offer-trait_routing_kit')).toHaveAttribute('data-shop-impact-cue-tone', 'blocked');
        expect(screen.getByTestId('shop-offer-trait_routing_kit')).toHaveAttribute('data-shop-plan-first', 'Not enough shop gold');
        expect(screen.getByTestId('shop-offer-trait_routing_kit')).toHaveAttribute('data-shop-plan-then', 'Find shop gold');
        expect(screen.getByTestId('shop-offer-trait_routing_kit')).toHaveAttribute('data-shop-plan-keep', 'Map Conduit Cartographer');
        expect(screen.getByTestId('shop-offer-trait_routing_kit')).toHaveAttribute('data-shop-heat', 'blocked');
        expect(screen.getByTestId('shop-offer-trait_routing_kit')).toHaveAttribute('data-shop-heat-value', 'Blocked');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-heat')).toHaveTextContent('Shop heat');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-heat')).toHaveTextContent('Blocked');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-heat')).toHaveTextContent(
            'Need 1g before map conduit cartographer'
        );
        expect(screen.getByTestId('shop-offer-trait_routing_kit-heat')).toHaveAttribute(
            'data-shop-heat-tier',
            'blocked'
        );
        expect(screen.getByTestId('shop-offer-trait_routing_kit-heat')).toHaveAccessibleName(
            'Shop heat: Blocked. Need 1g before map conduit cartographer.'
        );
        expect(screen.getByTestId('shop-offer-trait_routing_kit-impact-cue')).toHaveTextContent('Blocked');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-impact-cue')).toHaveTextContent(
            'Need 1g before map conduit cartographer'
        );
        expect(screen.getByTestId('shop-offer-trait_routing_kit-impact-cue')).toHaveAccessibleName(
            'Shop impact cue: Blocked: Need 1g before map conduit cartographer.'
        );
        expect(screen.getByTestId('shop-offer-trait_routing_kit-board-moment')).toHaveTextContent('Board moment');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-board-moment')).toHaveTextContent(
            'Map Conduit Cartographer'
        );
        expect(screen.getByTestId('shop-offer-trait_routing_kit-board-moment')).toHaveAttribute(
            'data-shop-board-moment-tone',
            'setup'
        );
        expect(screen.getByTestId('shop-offer-trait_routing_kit-board-moment')).toHaveAccessibleName(
            'Board moment: Map Conduit Cartographer.'
        );
        expect(screen.getByTestId('shop-offer-trait_routing_kit-buy-cue')).toHaveTextContent('Blocked cue');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-buy-cue')).toHaveTextContent(
            'Need 1g before map conduit cartographer'
        );
        expect(screen.getByTestId('shop-offer-trait_routing_kit-buy-cue')).toHaveAttribute(
            'data-shop-buy-cue-tone',
            'blocked'
        );
        expect(screen.getByTestId('shop-offer-trait_routing_kit-buy-cue')).toHaveAccessibleName(
            'Blocked cue: Need 1g before map conduit cartographer.'
        );
        expect(screen.getByTestId('shop-offer-trait_routing_kit-buy-plan')).toHaveTextContent('First');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-buy-plan')).toHaveTextContent('Not enough shop gold');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-buy-plan')).toHaveTextContent('Then');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-buy-plan')).toHaveTextContent('Find shop gold');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-buy-plan')).toHaveTextContent('Keep');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-buy-plan')).toHaveTextContent('Map Conduit Cartographer');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-buy-plan')).toHaveAttribute(
            'data-shop-buy-plan-tone',
            'blocked'
        );
        expect(screen.getByTestId('shop-offer-trait_routing_kit-buy-plan')).toHaveAccessibleName(
            'Buy plan. First: Not enough shop gold. Then: Find shop gold. Keep: Map Conduit Cartographer.'
        );
        expect(screen.getByTestId('shop-offer-trait_routing_kit-action')).toHaveTextContent('Blocked');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-action')).toHaveTextContent('Need gold');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-action')).toHaveTextContent(
            'Not enough shop gold -> Map Conduit Cartographer'
        );
        expect(screen.getByTestId('shop-offer-trait_routing_kit-action')).toHaveAttribute('data-shop-action-label', 'Blocked');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-action')).toHaveAttribute('data-shop-action-badge', 'Need gold');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-action')).toHaveAttribute(
            'data-shop-action-cue',
            'Blocked'
        );
        expect(screen.getByTestId('shop-offer-trait_routing_kit-action')).toHaveAttribute(
            'data-shop-action-tone',
            'blocked'
        );
        expect(screen.getByTestId('shop-offer-trait_routing_kit-payoffs').getAttribute('aria-label')).toContain(
            'Trait routing kit payoff. Payoff: +1 peek and +1 route link. Next move: prime a trait chain turn. Blocked: Not enough shop gold. Use: link trait cards.'
        );
        expect(
            screen.getByTestId('shop-offer-trait_routing_kit-payoffs').querySelector('[data-shop-payoff-id="next"]')
        ).toHaveTextContent('prime a trait chain turn');
        expect(
            screen
                .getByTestId('shop-offer-trait_routing_kit-payoffs')
                .querySelector('[data-shop-payoff-id="setup"]')
        ).toHaveTextContent('link trait cards');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-fit')).toHaveTextContent('Board fit');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-fit')).toHaveTextContent('Conduit Cartographer');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-fit')).toHaveTextContent('conduit + echo');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-fit').getAttribute('aria-label')).toContain(
            'Trait routing kit board fit. Board fit: Conduit Cartographer. Trait link: conduit + echo.'
        );
        expect(screen.getByTestId('shop-offer-trait_routing_kit')).toHaveAttribute(
            'data-shop-recommendation',
            'standard'
        );
        expect(
            screen.getByRole('button', {
                name: /Spend 3g on Trait routing kit\. Shop heat: Blocked\. Need 1g before map conduit cartographer\. Impact cue: Blocked: Need 1g before map conduit cartographer\. Buy plan: First: Not enough shop gold\. Then: Find shop gold\. Keep: Map Conduit Cartographer\. Blocked: Not enough shop gold\. Board moment: Map Conduit Cartographer\. Blocked cue: Need 1g before map conduit cartographer\. Payoff: \+1 peek and \+1 route link.*Fit: Board fit: Conduit Cartographer/i
            })
        ).toBeInTheDocument();

        expect(screen.getByTestId('shop-offer-master_key-signals')).toHaveTextContent('Any lock');
        expect(screen.getByTestId('shop-offer-master_key-signals')).toHaveAttribute(
            'aria-label',
            'Master key offer signals. Any lock. Safety.'
        );
        const masterKeySignals = screen.getByTestId('shop-offer-master_key-signals');
        expect(masterKeySignals.querySelector('[data-shop-signal-tone="key"]')).toHaveAttribute(
            'data-shop-signal-beats',
            '4'
        );
        expect(masterKeySignals.querySelector('[data-shop-signal-tone="key"]')).toHaveAttribute(
            'data-shop-signal-audio',
            'shop-signal-key'
        );
        expect(masterKeySignals.querySelector('[data-shop-signal-tone="key"]')).toHaveAttribute(
            'data-shop-signal-screen-cue',
            'burst'
        );
        expect(
            masterKeySignals.querySelector('[data-shop-signal-tone="key"]')?.querySelectorAll('[data-shop-signal-beat]')
        ).toHaveLength(4);
        expect(masterKeySignals.querySelector('[data-shop-signal-tone="safety"]')).toHaveAttribute(
            'data-shop-signal-beats',
            '3'
        );
        expect(masterKeySignals.querySelector('[data-shop-signal-tone="safety"]')).toHaveAttribute(
            'data-shop-signal-audio',
            'shop-signal-safety'
        );
        expect(masterKeySignals.querySelector('[data-shop-signal-tone="safety"]')).toHaveAttribute(
            'data-shop-signal-screen-cue',
            'guard'
        );
        expect(
            masterKeySignals.querySelector('[data-shop-signal-tone="safety"]')?.querySelectorAll('[data-shop-signal-beat]')
        ).toHaveLength(3);
        expect(screen.getByTestId('shop-offer-master_key-payoffs')).toHaveTextContent('opens any lock');
        expect(screen.getByTestId('shop-offer-master_key-payoffs')).toHaveTextContent('enter any locked route');
        expect(screen.getByTestId('shop-offer-master_key-payoff-burst')).toHaveTextContent('Route unlock');
        expect(screen.getByTestId('shop-offer-master_key-payoff-burst')).toHaveTextContent('Greedy route');
        expect(screen.getByTestId('shop-offer-master_key-payoff-burst')).toHaveAttribute(
            'data-shop-payoff-burst-tier',
            'route'
        );
        expect(screen.getByTestId('shop-offer-master_key')).toHaveAttribute('data-shop-impact-cue', 'Buy route');
        expect(screen.getByTestId('shop-offer-master_key')).toHaveAttribute('data-shop-impact-cue-tone', 'route');
        expect(screen.getByTestId('shop-offer-master_key')).toHaveAttribute('data-shop-plan-first', 'opens any lock');
        expect(screen.getByTestId('shop-offer-master_key')).toHaveAttribute('data-shop-plan-then', 'enter any locked route');
        expect(screen.getByTestId('shop-offer-master_key')).toHaveAttribute('data-shop-plan-keep', 'enter any locked route');
        expect(screen.getByTestId('shop-offer-master_key')).toHaveAttribute('data-shop-heat', 'route');
        expect(screen.getByTestId('shop-offer-master_key')).toHaveAttribute('data-shop-heat-value', 'Live route');
        expect(screen.getByTestId('shop-offer-master_key-heat')).toHaveTextContent('Shop heat');
        expect(screen.getByTestId('shop-offer-master_key-heat')).toHaveTextContent('Live route');
        expect(screen.getByTestId('shop-offer-master_key-heat')).toHaveTextContent('Open greedy route');
        expect(screen.getByTestId('shop-offer-master_key-heat')).toHaveAttribute('data-shop-heat-tier', 'route');
        expect(screen.getByTestId('shop-offer-master_key-heat')).toHaveAccessibleName(
            'Shop heat: Live route. Open greedy route.'
        );
        expect(screen.getByTestId('shop-offer-master_key-impact-cue')).toHaveTextContent('Buy route');
        expect(screen.getByTestId('shop-offer-master_key-impact-cue')).toHaveTextContent('Open greedy route');
        expect(screen.getByTestId('shop-offer-master_key-board-moment')).toHaveTextContent('Open greedy route');
        expect(screen.getByTestId('shop-offer-master_key-board-moment')).toHaveAttribute(
            'data-shop-board-moment-tone',
            'route'
        );
        expect(screen.getByTestId('shop-offer-master_key-buy-cue')).toHaveTextContent('Buy cue');
        expect(screen.getByTestId('shop-offer-master_key-buy-cue')).toHaveTextContent('Buy then open greedy route');
        expect(screen.getByTestId('shop-offer-master_key-buy-cue')).toHaveAttribute('data-shop-buy-cue-tone', 'available');
        expect(screen.getByTestId('shop-offer-master_key-buy-plan')).toHaveTextContent('opens any lock');
        expect(screen.getByTestId('shop-offer-master_key-buy-plan')).toHaveTextContent('enter any locked route');
        expect(screen.getByTestId('shop-offer-master_key-buy-plan')).toHaveAttribute('data-shop-buy-plan-tone', 'route');
        expect(screen.getByTestId('shop-offer-master_key-buy-plan')).toHaveAccessibleName(
            'Buy plan. First: opens any lock. Then: enter any locked route. Keep: enter any locked route.'
        );
        expect(screen.getByTestId('shop-offer-master_key-action')).toHaveTextContent('Buy route');
        expect(screen.getByTestId('shop-offer-master_key-action')).toHaveTextContent('2g');
        expect(screen.getByTestId('shop-offer-master_key-action')).toHaveTextContent('opens any lock -> enter any locked route');
        expect(screen.getByTestId('shop-offer-master_key-action')).toHaveAttribute('data-shop-action-label', 'Buy route');
        expect(screen.getByTestId('shop-offer-master_key-action')).toHaveAttribute('data-shop-action-badge', '2g');
        expect(screen.getByTestId('shop-offer-master_key-action')).toHaveAttribute('data-shop-action-cue', 'Buy route');
        expect(screen.getByTestId('shop-offer-master_key-action')).toHaveAttribute('data-shop-action-tone', 'route');
        expect(screen.getByTestId('shop-offer-master_key-fit')).toHaveTextContent('Route fit');
        expect(screen.getByTestId('shop-offer-master_key-fit')).toHaveTextContent('Greedy route');
        expect(screen.getByTestId('shop-offer-master_key-fit').getAttribute('aria-label')).toContain(
            'Master key board fit. Route fit: Greedy route.'
        );
        expect(screen.getByTestId('shop-offer-master_key')).toHaveAttribute('data-shop-recommendation', 'best-buy');
        expect(screen.getByTestId('shop-offer-master_key-recommendation')).toHaveTextContent('Best buy');
        expect(screen.getByTestId('shop-offer-master_key-recommendation')).toHaveTextContent('Buy route');
        expect(screen.getByTestId('shop-offer-master_key-recommendation')).toHaveTextContent('Greedy route');
        expect(screen.getByTestId('shop-offer-master_key-recommendation')).toHaveAttribute(
            'data-shop-recommendation-action',
            'Buy route'
        );
        expect(screen.getByTestId('shop-offer-master_key-recommendation')).toHaveAttribute(
            'data-shop-recommendation-beats',
            '4'
        );
        expect(screen.getByTestId('shop-offer-master_key-recommendation')).toHaveAttribute(
            'data-shop-recommendation-audio',
            'shop-recommendation-route'
        );
        expect(screen.getByTestId('shop-offer-master_key-recommendation')).toHaveAttribute(
            'data-shop-recommendation-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('shop-offer-master_key-recommendation')).toHaveAttribute(
            'data-shop-recommendation-tone',
            'route'
        );
        expect(
            screen.getByTestId('shop-offer-master_key-recommendation').querySelectorAll('[data-shop-recommendation-beat]')
        ).toHaveLength(4);
        expect(screen.getByTestId('shop-offer-master_key-recommendation')).toHaveAccessibleName(
            'Best buy: Route fit Greedy route. Buy route. 4 beats.'
        );
        expect(
            screen.getByRole('button', {
                name: /Spend 2g on Master key\. Shop heat: Live route\. Open greedy route\. Impact cue: Buy route: Open greedy route\. Buy plan: First: opens any lock\. Then: enter any locked route\. Keep: enter any locked route\. Route unlock: Greedy route\. Board moment: Open greedy route\. Buy cue: Buy then open greedy route\. Best buy: Route fit Greedy route\. Payoff: opens any lock/i
            })
        ).toBeInTheDocument();

        expect(screen.getByTestId('shop-offer-destroy_charge-signals')).toHaveTextContent('Control');
        expect(screen.getByTestId('shop-offer-destroy_charge-payoff-burst')).toHaveTextContent('Blocked');
        expect(screen.getByTestId('shop-offer-destroy_charge-payoff-burst')).toHaveTextContent('Not enough shop gold');
        expect(screen.getByTestId('shop-offer-destroy_charge-board-moment')).toHaveTextContent('Erase a blocker');
        expect(screen.getByTestId('shop-offer-destroy_charge-buy-plan')).toHaveTextContent('Not enough shop gold');
        expect(screen.getByTestId('shop-offer-destroy_charge-buy-plan')).toHaveTextContent('Find shop gold');
        expect(screen.getByTestId('shop-offer-destroy_charge-buy-plan')).toHaveTextContent('Erase a blocker');
        expect(screen.getByTestId('shop-offer-destroy_charge-impact-cue')).toHaveTextContent('Blocked');
        expect(screen.getByTestId('shop-offer-destroy_charge-impact-cue')).toHaveTextContent('Need 3g before erase a blocker');
        expect(screen.getByTestId('shop-offer-destroy_charge-board-moment')).toHaveAttribute(
            'data-shop-board-moment-tone',
            'control'
        );
        expect(screen.getByTestId('shop-offer-destroy_charge-payoffs')).toHaveTextContent('Not enough shop gold');
        expect(screen.getByTestId('shop-offer-destroy_charge-payoffs')).toHaveTextContent('clear one chain blocker');
        expect(screen.getByTestId('shop-offer-destroy_charge-payoffs').getAttribute('aria-label')).toContain(
            'Destroy charge payoff. Payoff: +1 pair control. Next move: clear one chain blocker. Blocked: Not enough shop gold.'
        );
        expect(screen.getByTestId('shop-offer-destroy_charge-buy-cue')).toHaveTextContent(
            'Need 3g before erase a blocker'
        );
        expect(screen.getByTestId('shop-offer-destroy_charge-action')).toHaveTextContent(
            'Not enough shop gold -> Erase a blocker'
        );
        expect(screen.getByTestId('shop-offer-destroy_charge-action')).toHaveAttribute('data-shop-action-cue', 'Blocked');
        expect(screen.getByTestId('shop-offer-destroy_charge-action')).toHaveAttribute(
            'data-shop-action-tone',
            'blocked'
        );
        expect(
            screen.getByTestId('shop-offer-destroy_charge-payoffs').querySelector('[data-shop-payoff-tone="blocked"]')
        ).toHaveTextContent('Not enough shop gold');
        expect(
            screen.getByRole('button', {
                name: /Spend 5g on Destroy charge.*Buy plan: First: Not enough shop gold\. Then: Find shop gold\. Keep: Erase a blocker.*Blocked: Not enough shop gold/i
            })
        ).toBeDisabled();

        const actionDock = screen.getByTestId('shop-action-dock');
        expect(actionDock).toHaveTextContent('Back to floor summary');
        expect(actionDock).toHaveTextContent('Review the route, rewards, and gold before leaving.');
        expect(actionDock).toHaveTextContent('Continue to Greedy route floor');
        expect(actionDock).toHaveTextContent('Greedy route starts with push x6 reward.');
        expect(
            screen.getByRole('button', { name: /Continue to Greedy route floor.*Greedy route starts with push x6 reward/i })
        ).toBeInTheDocument();
    });

    it('labels affordable trait routing purchases as route prime instead of generic setup payoffs', () => {
        const saveData = createDefaultSaveData();
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 91 });
        const run = {
            ...baseRun,
            status: 'levelComplete',
            shopGold: 5,
            board: {
                ...baseRun.board!,
                tiles: baseRun.board!.tiles.map((tile, index) =>
                    index === 0
                        ? { ...tile, tileTraitKind: 'conduit' as const }
                        : index === 1
                          ? { ...tile, tileTraitKind: 'echo' as const }
                          : tile
                )
            },
            shopOffers: [offer('trait_routing_kit')]
        } as RunState;
        useAppStore.setState({
            hydrated: true,
            hydrating: false,
            view: 'shop',
            saveData,
            settings: saveData.settings,
            run,
            shopReturnMode: 'summary'
        });

        render(<ShopScreen />);

        expect(screen.getByTestId('shop-offer-trait_routing_kit')).toHaveAttribute('data-shop-heat', 'setup');
        expect(screen.getByTestId('shop-offer-trait_routing_kit')).toHaveAttribute('data-shop-heat-value', 'Combo route');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-heat')).toHaveTextContent('Combo route');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-heat')).toHaveAccessibleName(
            'Shop heat: Combo route. Map Conduit Cartographer.'
        );
        expect(screen.getByTestId('shop-offer-trait_routing_kit-impact-cue')).toHaveTextContent('Prime combo');
        expect(screen.getByTestId('shop-offer-trait_routing_kit-board-moment')).toHaveTextContent(
            'Map Conduit Cartographer'
        );
        expect(
            screen.getByRole('button', {
                name: /Spend 3g on Trait routing kit\. Shop heat: Combo route\. Map Conduit Cartographer\. Impact cue: Prime combo: Map Conduit Cartographer/i
            })
        ).toBeInTheDocument();
    });
});
