import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_GUARD_TOKENS } from '../../shared/contracts';
import { createNewRun } from '../../shared/game-core';
import InventoryScreen from './InventoryScreen';

vi.mock('zustand/react/shallow', () => ({
    useShallow: <T,>(fn: T) => fn
}));

const closeSubscreen = vi.fn();
let currentRun = {
    ...createNewRun(0),
    dungeonKeys: { iron: 1, treasure: 0 },
    dungeonMasterKeys: 1,
    relicIds: ['peek_charge_plus_one', 'pin_cap_plus_one', 'stray_charge_plus_one']
};

beforeEach(() => {
    currentRun = {
        ...createNewRun(0),
        dungeonKeys: { iron: 1, treasure: 0 },
        dungeonMasterKeys: 1,
        relicIds: ['peek_charge_plus_one', 'pin_cap_plus_one', 'stray_charge_plus_one']
    };
});

vi.mock('../store/useAppStore', () => ({
    useAppStore: Object.assign(
        (selector: (state: unknown) => unknown) =>
            selector({
                closeSubscreen,
                run: currentRun,
                settings: { masterVolume: 0, sfxVolume: 0 },
                saveData: { unlocks: [] }
            }),
        {
            getState: () => ({ saveData: { unlocks: [] } })
        }
    )
}));

vi.mock('../audio/uiSfx', () => ({
    playUiBackSfx: vi.fn(),
    resumeUiSfxContext: vi.fn(),
    uiSfxGainFromSettings: () => 0
}));

describe('InventoryScreen REG-079 run inventory model', () => {
    it('shows active relic archetype as the run build identity', () => {
        render(<InventoryScreen />);

        expect(screen.getByTestId('inventory-build-identity')).toHaveTextContent('The Seer');
        expect(screen.getByTestId('inventory-build-identity')).toHaveTextContent('peek, pin, read');
        expect(screen.getByTestId('inventory-build-identity')).toHaveTextContent('Scrying Spark');
    });

    it('summarizes the active arcade reward loop in the run snapshot', () => {
        currentRun = {
            ...currentRun,
            findablesClaimedThisFloor: 1,
            findablesTotalThisFloor: 2,
            traitRouteObjectiveProgressThisFloor: 1,
            traitRouteObjectiveRequiredThisFloor: 2,
            stats: {
                ...currentRun.stats,
                currentStreak: 4,
                bestStreak: 5,
                comboShards: 2,
                guardTokens: 1
            }
        };
        render(<InventoryScreen />);

        const loopSignals = screen.getByTestId('inventory-run-loop-signals');
        expect(loopSignals).toHaveTextContent('Chain loop');
        expect(loopSignals).toHaveTextContent('x4');
        expect(loopSignals).toHaveTextContent('Push x6 reward');
        expect(loopSignals).toHaveTextContent('Pickup loop');
        expect(loopSignals).toHaveTextContent('1/2');
        expect(loopSignals).toHaveTextContent('1 marked pickup left');
        expect(loopSignals).toHaveTextContent('Burst bank');
        expect(loopSignals).toHaveTextContent('2 shards / 1 guards');
        expect(loopSignals).toHaveTextContent('Shard burst is primed');
        expect(loopSignals).toHaveTextContent('Trait route');
        expect(loopSignals).toHaveTextContent('1/2');
        expect(loopSignals).toHaveTextContent('Cash next route');
        expect(loopSignals).toHaveTextContent('One route to cashout: +25 score.');
        expect(loopSignals.querySelector('[data-run-loop-signal="chain"]')).toHaveTextContent('Clean matches');
        expect(loopSignals.querySelector('[data-run-loop-signal="chain"]')).toHaveTextContent('Push x6 reward');
        expect(loopSignals.querySelector('[data-run-loop-signal="chain"]')).toHaveAttribute('data-run-loop-beats', '4');
        expect(loopSignals.querySelector('[data-run-loop-signal="chain"]')).toHaveAttribute('data-run-loop-action', 'Push chain');
        expect(loopSignals.querySelector('[data-run-loop-signal="chain"]')).toHaveAttribute('data-run-loop-audio', 'inventory-loop-chain');
        expect(loopSignals.querySelector('[data-run-loop-signal="chain"]')).toHaveAttribute('data-run-loop-screen-cue', 'burst');
        expect(loopSignals.querySelector('[data-run-loop-signal="chain"]')).toHaveTextContent('Push chain');
        expect(
            loopSignals.querySelector('[data-run-loop-signal="chain"]')?.querySelectorAll('[data-run-loop-signal-beat]')
        ).toHaveLength(4);
        expect(loopSignals.querySelector('[data-run-loop-signal="reward"]')).toHaveAttribute('data-run-loop-beats', '3');
        expect(loopSignals.querySelector('[data-run-loop-signal="reward"]')).toHaveAttribute('data-run-loop-action', 'Claim pickup');
        expect(loopSignals.querySelector('[data-run-loop-signal="reward"]')).toHaveAttribute('data-run-loop-audio', 'inventory-loop-pickup');
        expect(loopSignals.querySelector('[data-run-loop-signal="reward"]')).toHaveAttribute('data-run-loop-screen-cue', 'snap');
        expect(
            loopSignals.querySelector('[data-run-loop-signal="reward"]')?.querySelectorAll('[data-run-loop-signal-beat]')
        ).toHaveLength(3);
        expect(loopSignals.querySelector('[data-run-loop-signal="resource"]')).toHaveTextContent('guards preserve tempo');
        expect(loopSignals.querySelector('[data-run-loop-signal="resource"]')).toHaveAttribute('data-run-loop-beats', '4');
        expect(loopSignals.querySelector('[data-run-loop-signal="resource"]')).toHaveAttribute('data-run-loop-action', 'Bank resource');
        expect(loopSignals.querySelector('[data-run-loop-signal="resource"]')).toHaveAttribute('data-run-loop-audio', 'inventory-loop-resource');
        expect(loopSignals.querySelector('[data-run-loop-signal="trait"]')).toHaveAttribute('data-run-loop-beats', '4');
        expect(loopSignals.querySelector('[data-run-loop-signal="trait"]')).toHaveAttribute('data-run-loop-action', 'Cash trait');
        expect(loopSignals.querySelector('[data-run-loop-signal="trait"]')).toHaveAttribute('data-run-loop-audio', 'inventory-loop-trait');
        expect(loopSignals.getAttribute('aria-label')).toContain(
            'Inventory run loop signals. Chain loop: x4: Push x6 reward: Clean matches are actively feeding reward thresholds.'
        );
        expect(loopSignals.getAttribute('aria-label')).toContain(
            'Trait route: 1/2: Cash next route: One route to cashout: +25 score.'
        );
        const payoffEngine = screen.getByTestId('inventory-payoff-engine');
        expect(payoffEngine).toHaveAttribute('data-inventory-payoff-engine-tone', 'super');
        expect(payoffEngine).toHaveAttribute('data-inventory-payoff-engine-beats', '5');
        expect(payoffEngine).toHaveAttribute('data-inventory-payoff-engine-action', 'Push reward stack');
        expect(payoffEngine).toHaveAttribute('data-inventory-payoff-engine-audio', 'inventory-payoff-super');
        expect(payoffEngine).toHaveAttribute('data-inventory-payoff-engine-screen-cue', 'super');
        expect(payoffEngine.querySelectorAll('[data-inventory-payoff-engine-beat]')).toHaveLength(5);
        expect(payoffEngine).toHaveTextContent('Super stack');
        expect(payoffEngine).toHaveTextContent('4 payoffs live');
        expect(payoffEngine).toHaveTextContent('Chain + Pickup + Burst + Trait route');
        expect(payoffEngine).toHaveTextContent('Push x6 reward');
        expect(payoffEngine).toHaveAccessibleName(
            /Inventory payoff engine.*Super stack: Push reward stack.*4 payoffs live.*Chain \+ Pickup \+ Burst \+ Trait route.*Push x6 reward/i
        );
    });

    it('keeps old completed trait routes concrete when the exact reward text is missing', () => {
        currentRun = {
            ...currentRun,
            traitRouteObjectiveCompletedThisFloor: true,
            traitRouteObjectiveRewardClaimedThisFloor: true,
            traitRouteObjectiveRewardTextThisFloor: null
        };
        render(<InventoryScreen />);

        const loopSignals = screen.getByTestId('inventory-run-loop-signals');
        expect(loopSignals.querySelector('[data-run-loop-signal="trait"]')).toHaveTextContent('Route paid');
        expect(loopSignals.querySelector('[data-run-loop-signal="trait"]')).toHaveTextContent('Cashout claimed: Trait route cashout.');
        expect(loopSignals.querySelector('[data-run-loop-signal="trait"]')).not.toHaveTextContent('reward claimed');
    });

    it('shows payoff engine setup when no live reward lanes are active yet', () => {
        currentRun = {
            ...createNewRun(0),
            dungeonKeys: { iron: 1, treasure: 0 },
            dungeonMasterKeys: 1,
            findablesClaimedThisFloor: 0,
            findablesTotalThisFloor: 0,
            traitRouteObjectiveCompletedThisFloor: false,
            traitRouteObjectiveProgressThisFloor: 0,
            traitRouteObjectiveRequiredThisFloor: 0,
            traitRouteObjectiveRewardClaimedThisFloor: false,
            relicIds: []
        };
        render(<InventoryScreen />);

        const payoffEngine = screen.getByTestId('inventory-payoff-engine');
        expect(payoffEngine).toHaveAttribute('data-inventory-payoff-engine-tone', 'setup');
        expect(payoffEngine).toHaveAttribute('data-inventory-payoff-engine-beats', '2');
        expect(payoffEngine).toHaveAttribute('data-inventory-payoff-engine-action', 'Start loop');
        expect(payoffEngine).toHaveAttribute('data-inventory-payoff-engine-audio', 'inventory-payoff-setup');
        expect(payoffEngine).toHaveAttribute('data-inventory-payoff-engine-screen-cue', 'pulse');
        expect(payoffEngine.querySelectorAll('[data-inventory-payoff-engine-beat]')).toHaveLength(2);
        expect(payoffEngine).toHaveTextContent('Prime payoff');
        expect(payoffEngine).toHaveTextContent('Prime beat');
        expect(payoffEngine).toHaveTextContent('Open with a safe match to light chain, pickup, or trait payoffs.');
        expect(payoffEngine).toHaveTextContent('Start x3 loop');
    });

    it('shows active trait-build rewards enabled by drafted relics', () => {
        currentRun = {
            ...currentRun,
            relicIds: ['chapter_compass', 'combo_shard_plus_step', 'region_shuffle_free_first']
        };
        render(<InventoryScreen />);

        expect(screen.getByTestId('inventory-trait-builds')).toHaveTextContent('Conduit Cartographer');
        expect(screen.getByTestId('inventory-trait-builds')).toHaveTextContent('Sealed Catalyst');
        expect(screen.getByTestId('inventory-trait-builds')).toHaveTextContent('Drift Routing');
    });

    it('shows trait-build guidance from the selected starting loadout before relic drafts', () => {
        currentRun = {
            ...createNewRun(0, { startingLoadoutId: 'route_tactician' }),
            dungeonKeys: { iron: 1, treasure: 0 },
            dungeonMasterKeys: 1,
            relicIds: []
        };
        render(<InventoryScreen />);

        expect(screen.getByTestId('inventory-trait-builds')).toHaveTextContent('Drift Routing');
        expect(screen.getByTestId('inventory-trait-builds')).toHaveTextContent('Conduit Cartographer');
    });

    it('shows active durable reward perks claimed from route drafts', () => {
        currentRun = {
            ...currentRun,
            rewardPerkIds: ['echo_conduit_double', 'hazard_banish_per_floor']
        };
        render(<InventoryScreen />);

        expect(screen.getByTestId('inventory-reward-perks')).toHaveTextContent('Echo Conduit Double');
        expect(screen.getByTestId('inventory-reward-perks')).toHaveTextContent('Hazard Banish');
        expect(screen.getByTestId('inventory-reward-perks')).toHaveTextContent('Trait combo');
        expect(screen.getByTestId('inventory-reward-perks')).toHaveTextContent('Double Echo payoff');
        expect(screen.getByTestId('inventory-reward-perks')).toHaveTextContent('Echo next to Conduit');
        expect(screen.getByTestId('inventory-reward-perks')).toHaveTextContent(
            'Match Echo touching Conduit before cashing adjacent Sealed.'
        );
        expect(screen.getByTestId('inventory-reward-perks')).toHaveTextContent('Hazard control');
        expect(screen.getByTestId('inventory-reward-perks')).toHaveTextContent('Hazard erased before flip');
        expect(screen.getByTestId('inventory-reward-perks')).toHaveTextContent('Floor start');
        expect(screen.getByTestId('inventory-reward-perks')).toHaveTextContent(
            'Check the first board beat; hazard pressure should already be reduced.'
        );
        expect(screen.getByTestId('inventory-reward-perks')).toHaveAttribute(
            'data-reward-perk-lane-map',
            'trait-combo:1>hazard-control:1'
        );
        expect(screen.getByTestId('inventory-reward-perks')).toHaveAttribute(
            'data-reward-perk-lane-actions',
            'trait-combo:Set combo:1>hazard-control:Pre-clear hazard:1'
        );
        expect(screen.getByTestId('inventory-reward-perk-lane-map')).toHaveTextContent('Trait combo');
        expect(screen.getByTestId('inventory-reward-perk-lane-map')).toHaveTextContent('Hazard control');
        expect(screen.getByTestId('inventory-reward-perk-lane-map')).toHaveTextContent('Set combo');
        expect(screen.getByTestId('inventory-reward-perk-lane-map')).toHaveTextContent('Pre-clear hazard');
        expect(screen.getByTestId('inventory-reward-perk-lane-map')).toHaveAttribute(
            'data-reward-perk-lane-map',
            'trait-combo:1>hazard-control:1'
        );
        expect(screen.getByTestId('inventory-reward-perk-lane-map')).toHaveAttribute(
            'data-reward-perk-lane-actions',
            'trait-combo:Set combo:1>hazard-control:Pre-clear hazard:1'
        );
        expect(screen.getByTestId('inventory-reward-perk-lane-map')).toHaveAttribute(
            'data-reward-perk-primary-lane',
            'trait-combo'
        );
        expect(screen.getByTestId('inventory-reward-perk-lane-map')).toHaveAttribute(
            'data-reward-perk-primary-lane-action',
            'Set combo'
        );
        expect(screen.getByTestId('inventory-reward-perk-lane-map')).toHaveAttribute(
            'data-reward-perk-primary-lane-audio',
            'reward-perk-lane-combo'
        );
        expect(screen.getByTestId('inventory-reward-perk-lane-map')).toHaveAttribute(
            'data-reward-perk-primary-lane-beats',
            '4'
        );
        expect(screen.getByTestId('inventory-reward-perk-lane-map')).toHaveAttribute(
            'data-reward-perk-primary-lane-payoff',
            'Double Echo payoff'
        );
        expect(screen.getByTestId('inventory-reward-perk-lane-map')).toHaveAttribute(
            'data-reward-perk-primary-lane-screen-cue',
            'burst'
        );
        const primaryPerkLane = screen.getByTestId('inventory-reward-perk-primary-lane');
        expect(primaryPerkLane).toHaveAccessibleName(
            'Primary inventory perk lane. Trait combo: Set combo. Double Echo payoff. 4 beats.'
        );
        expect(primaryPerkLane).toHaveAttribute('data-reward-perk-primary-lane', 'trait-combo');
        expect(primaryPerkLane).toHaveAttribute('data-reward-perk-primary-lane-action', 'Set combo');
        expect(primaryPerkLane).toHaveAttribute('data-reward-perk-primary-lane-audio', 'reward-perk-lane-combo');
        expect(primaryPerkLane).toHaveAttribute('data-reward-perk-primary-lane-beats', '4');
        expect(primaryPerkLane).toHaveAttribute('data-reward-perk-primary-lane-payoff', 'Double Echo payoff');
        expect(primaryPerkLane).toHaveAttribute('data-reward-perk-primary-lane-screen-cue', 'burst');
        expect(primaryPerkLane).toHaveTextContent('Best perk lane');
        expect(primaryPerkLane).toHaveTextContent('Trait combo');
        expect(primaryPerkLane).toHaveTextContent('Set combo');
        expect(primaryPerkLane.querySelectorAll('[data-reward-perk-primary-lane-beat]')).toHaveLength(4);
        expect(
            screen
                .getByTestId('inventory-reward-perk-lane-map')
                .querySelector('[data-reward-perk-lane-kind="trait-combo"]')
        ).toHaveAttribute('data-reward-perk-lane-beats', '4');
        expect(
            screen
                .getByTestId('inventory-reward-perk-lane-map')
                .querySelector('[data-reward-perk-lane-kind="trait-combo"]')
        ).toHaveAttribute('data-reward-perk-lane-action', 'Set combo');
        expect(
            screen
                .getByTestId('inventory-reward-perk-lane-map')
                .querySelector('[data-reward-perk-lane-kind="trait-combo"]')
                ?.querySelectorAll('[data-reward-perk-lane-beat]')
        ).toHaveLength(4);
        expect(
            screen
                .getByTestId('inventory-reward-perk-lane-map')
                .querySelector('[data-reward-perk-lane-kind="hazard-control"]')
        ).toHaveAttribute('data-reward-perk-lane-beats', '3');
        expect(
            screen
                .getByTestId('inventory-reward-perk-lane-map')
                .querySelector('[data-reward-perk-lane-kind="hazard-control"]')
        ).toHaveAttribute('data-reward-perk-lane-action', 'Pre-clear hazard');
        expect(
            screen
                .getByTestId('inventory-reward-perk-lane-map')
                .querySelector('[data-reward-perk-lane-kind="hazard-control"]')
                ?.querySelectorAll('[data-reward-perk-lane-beat]')
        ).toHaveLength(3);
        expect(screen.getByTestId('inventory-reward-perk-lane-map')).toHaveAccessibleName(
            'Inventory reward perk lane map. Trait combo: 1. Set combo. Double Echo payoff. Hazard control: 1. Pre-clear hazard. Hazard erased before flip.'
        );
        expect(screen.getByTestId('inventory-reward-perks').getAttribute('aria-label')).toContain(
            'Inventory durable reward perks. Trait combo: Double Echo payoff. Moment: Echo next to Conduit: Match Echo touching Conduit before cashing adjacent Sealed.: Echo Conduit Double.'
        );
        const echoRewardRow = screen.getByText('Echo Conduit Double').closest('div')!;
        expect(echoRewardRow.querySelector('[data-reward-perk-signal="payoff"]')).toHaveAttribute(
            'data-reward-perk-signal-beats',
            '4'
        );
        expect(echoRewardRow.querySelector('[data-reward-perk-signal="payoff"]')).toHaveAttribute(
            'data-reward-perk-signal-action',
            'Claim payoff'
        );
        expect(echoRewardRow.querySelector('[data-reward-perk-signal="payoff"]')).toHaveAttribute(
            'data-reward-perk-signal-audio',
            'reward-perk-payoff'
        );
        expect(echoRewardRow.querySelector('[data-reward-perk-signal="payoff"]')).toHaveAttribute(
            'data-reward-perk-signal-screen-cue',
            'burst'
        );
        expect(echoRewardRow.querySelector('[data-reward-perk-signal="payoff"]')).toHaveTextContent('Claim payoff');
        expect(
            echoRewardRow
                .querySelector('[data-reward-perk-signal="payoff"]')
                ?.querySelectorAll('[data-reward-perk-signal-beat]')
        ).toHaveLength(4);
        expect(echoRewardRow.querySelector('[data-reward-perk-signal="next"]')).toHaveAttribute(
            'data-reward-perk-signal-beats',
            '3'
        );
        expect(echoRewardRow.querySelector('[data-reward-perk-signal="next"]')).toHaveAttribute(
            'data-reward-perk-signal-action',
            'Play next'
        );
        expect(echoRewardRow.querySelector('[data-reward-perk-signal="next"]')).toHaveAttribute(
            'data-reward-perk-signal-screen-cue',
            'snap'
        );
        expect(screen.getByText('Echo Conduit Double').closest('div')).toHaveAccessibleName(
            /Echo Conduit Double.*Lane: Trait combo.*Payoff: Double Echo payoff.*Moment: Echo next to Conduit.*Next: Match Echo touching Conduit/i
        );
    });

    it('shows the selected starting loadout identity when present', () => {
        currentRun = {
            ...currentRun,
            startingLoadoutId: 'route_tactician'
        };
        render(<InventoryScreen />);

        expect(screen.getByTestId('inventory-starting-loadout')).toHaveTextContent('Route Tactician');
        expect(screen.getByTestId('inventory-starting-loadout')).toHaveTextContent('Move trait pairs into adjacency');
        expect(screen.getByTestId('inventory-starting-loadout-signals')).toHaveTextContent('+1 row route, free swap');
        expect(screen.getByTestId('inventory-starting-loadout-signals')).toHaveTextContent('Drift + Conduit');
        expect(screen.getByTestId('inventory-starting-loadout-signals')).toHaveTextContent('Adjacency routes');
        expect(screen.getByTestId('inventory-starting-loadout-signals')).toHaveAccessibleName(
            /Route Tactician impact: Starts: \+1 row route, free swap.*Build bias: Drift \+ Conduit.*Payoff: Adjacency routes/i
        );
        expect(
            screen.getByTestId('inventory-starting-loadout-signals').querySelector('[data-loadout-impact-tone="resource"]')
        ).toHaveAttribute('data-loadout-impact-beats', '3');
        expect(
            screen.getByTestId('inventory-starting-loadout-signals').querySelector('[data-loadout-impact-tone="resource"]')
        ).toHaveAttribute('data-loadout-impact-action', 'Bank resource');
        expect(
            screen.getByTestId('inventory-starting-loadout-signals').querySelector('[data-loadout-impact-tone="resource"]')
        ).toHaveAttribute('data-loadout-impact-audio', 'inventory-loadout-resource');
        expect(
            screen.getByTestId('inventory-starting-loadout-signals').querySelector('[data-loadout-impact-tone="resource"]')
        ).toHaveAttribute('data-loadout-impact-screen-cue', 'pulse');
        expect(
            screen
                .getByTestId('inventory-starting-loadout-signals')
                .querySelector('[data-loadout-impact-tone="resource"]')
                ?.querySelectorAll('[data-loadout-impact-signal-beat]')
        ).toHaveLength(3);
        expect(
            screen.getByTestId('inventory-starting-loadout-signals').querySelector('[data-loadout-impact-tone="build"]')
        ).toHaveAttribute('data-loadout-impact-beats', '3');
        expect(
            screen.getByTestId('inventory-starting-loadout-signals').querySelector('[data-loadout-impact-tone="build"]')
        ).toHaveAttribute('data-loadout-impact-action', 'Prime build');
        expect(
            screen.getByTestId('inventory-starting-loadout-signals').querySelector('[data-loadout-impact-tone="build"]')
        ).toHaveAttribute('data-loadout-impact-screen-cue', 'snap');
        expect(
            screen.getByTestId('inventory-starting-loadout-signals').querySelector('[data-loadout-impact-tone="payoff"]')
        ).toHaveAttribute('data-loadout-impact-beats', '4');
        expect(
            screen.getByTestId('inventory-starting-loadout-signals').querySelector('[data-loadout-impact-tone="payoff"]')
        ).toHaveAttribute('data-loadout-impact-action', 'Chase payoff');
        expect(
            screen.getByTestId('inventory-starting-loadout-signals').querySelector('[data-loadout-impact-tone="payoff"]')
        ).toHaveAttribute('data-loadout-impact-audio', 'inventory-loadout-payoff');
        expect(
            screen.getByTestId('inventory-starting-loadout-signals').querySelector('[data-loadout-impact-tone="payoff"]')
        ).toHaveAttribute('data-loadout-impact-screen-cue', 'burst');
        expect(
            screen
                .getByTestId('inventory-starting-loadout-signals')
                .querySelector('[data-loadout-impact-tone="payoff"]')
                ?.querySelectorAll('[data-loadout-impact-signal-beat]')
        ).toHaveLength(4);
    });

    it('shows run-scoped loadout and consumable stack rules', () => {
        currentRun = {
            ...currentRun,
            dungeonKeys: { iron: 1, treasure: 1 }
        };
        render(<InventoryScreen />);

        expect(screen.getByRole('heading', { name: 'Run consumables and loadout' })).toBeInTheDocument();
        expect(screen.getByText(/Mid-run mutable/)).toBeInTheDocument();
        expect(screen.getByText(/Shuffle charge:/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Shuffle charge action cue/i)).toHaveTextContent('Route reset');
        expect(screen.getByLabelText(/Shuffle charge action cue/i)).toHaveAttribute('data-inventory-action-tone', 'route');
        expect(screen.getByText(/Dungeon key:/)).toHaveTextContent('2 (iron 1, treasure 1)');
        expect(screen.getByLabelText(/Dungeon key action cue/i)).toHaveTextContent('Open route');
        expect(screen.getByLabelText(/Dungeon key action cue/i)).toHaveAttribute('data-inventory-action-tone', 'key');
        expect(screen.getByText(/Master key:/)).toBeInTheDocument();
        expect(screen.getByText(/Loadout slots/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Destroy charge action cue/i)).toHaveTextContent('Restock first');
        expect(screen.getByLabelText(/Destroy charge action cue/i)).toHaveTextContent('No charges currently banked.');
        expect(screen.getByRole('link', { name: 'Consumables' })).toHaveAttribute('href', '#inventory-consumables');
        expect(screen.getByTestId('inventory-prep-strip')).toHaveTextContent(/Run prep snapshot/);
        expect(screen.getByTestId('inventory-prep-strip')).toHaveTextContent(/Mutable windows/);
    });

    it('does not invent a build identity before the first relic', () => {
        currentRun = { ...createNewRun(0), dungeonKeys: { iron: 1, treasure: 0 }, dungeonMasterKeys: 1 };
        render(<InventoryScreen />);

        expect(screen.getByTestId('inventory-meta-frame-build')).toHaveTextContent('First relic still ahead');
        expect(screen.queryByTestId('inventory-build-identity')).toBeNull();
    });

    it('surfaces full inventory edge cases on capped run rows', () => {
        currentRun = {
            ...currentRun,
            gambitAvailableThisFloor: true,
            gambitThirdFlipUsed: false,
            stats: { ...currentRun.stats, guardTokens: MAX_GUARD_TOKENS }
        };
        render(<InventoryScreen />);

        expect(screen.getByText('Gambit token: 1/1')).toBeInTheDocument();
        expect(screen.getByText('Gambit token is at its run limit.')).toBeInTheDocument();
        expect(screen.getByText('Guard token is at its run limit.')).toBeInTheDocument();
    });

    it('uses normalized inventory quantities in the charges summary', () => {
        currentRun = {
            ...currentRun,
            shuffleCharges: -2,
            destroyPairCharges: -1,
            peekCharges: -4,
            strayRemoveCharges: -3,
            undoUsesThisFloor: -1,
            stats: { ...currentRun.stats, guardTokens: -2, comboShards: -5 }
        };
        render(<InventoryScreen />);
        const chargesPanel = within(screen.getByTestId('inventory-charges-panel'));

        expect(chargesPanel.getByText(/Shuffle charges/)).toHaveTextContent('0');
        expect(chargesPanel.getByText(/Destroy charges/)).toHaveTextContent('0');
        expect(chargesPanel.getByText(/Peek charges/)).toHaveTextContent('0');
        expect(chargesPanel.getByText(/Stray remove/)).toHaveTextContent('0');
        expect(chargesPanel.getByText(/Guard tokens/)).toHaveTextContent('0');
        expect(chargesPanel.getByText(/Combo shards/)).toHaveTextContent('0');
        expect(chargesPanel.getByText(/Undo this floor/)).toHaveTextContent('0');
    });
});
