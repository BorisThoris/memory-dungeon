import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveData } from '../../shared/contracts';
import { createDefaultSaveData } from '../../shared/save-data';
import ProfileScreen from './ProfileScreen';

const profileStoreMocks = vi.hoisted(() => ({
    claimMetaProgressionReward: vi.fn(),
    closeSubscreen: vi.fn(),
    openSettings: vi.fn(),
    saveData: null as SaveData | null
}));

vi.mock('../audio/uiSfx', () => ({
    playUiBackSfx: vi.fn(),
    playUiClickSfx: vi.fn(),
    resumeUiSfxContext: vi.fn(),
    uiSfxGainFromSettings: () => 0
}));
vi.mock('zustand/react/shallow', () => ({
    useShallow: <T,>(fn: T) => fn
}));
vi.mock('../store/useAppStore', async () => {
    const { createDefaultSaveData } = await import('../../shared/save-data');
    return {
        useAppStore: (selector: (state: unknown) => unknown) => {
            const saveData = profileStoreMocks.saveData ?? createDefaultSaveData();
            return selector({
                claimMetaProgressionReward: profileStoreMocks.claimMetaProgressionReward,
                closeSubscreen: profileStoreMocks.closeSubscreen,
                openSettings: profileStoreMocks.openSettings,
                saveData,
                settings: saveData.settings,
                steamConnected: false
            });
        }
    };
});

describe('ProfileScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        profileStoreMocks.saveData = null;
    });

    it('renders progress sections and returns to menu on Back', async () => {
        const user = userEvent.setup();
        render(<ProfileScreen />);

        expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
        expect(screen.getByTestId('profile-screen-body')).toBeInTheDocument();
        expect(screen.getByTestId('profile-section-rail')).toHaveTextContent('Overview');
        expect(screen.getByTestId('profile-section-rail')).toHaveTextContent('Trust');
        expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('data-compact-label', 'Overview');
        expect(screen.getByRole('link', { name: 'Signals' })).toHaveAttribute('data-compact-label', 'Signals');
        expect(screen.getByTestId('profile-summary-grid')).toBeInTheDocument();
        expect(screen.getByTestId('profile-progression-brief')).toBeInTheDocument();
        expect(screen.getAllByText(/initiate tier/i).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByTestId('profile-progression-brief').querySelector('strong')).toHaveTextContent(
            'Next: Week of Archives (0/7)'
        );
        expect(screen.getByTestId('profile-progression-brief').querySelector('strong')).toHaveAttribute(
            'data-full-progression-copy',
            'Next: Week of Archives (0/7 from Daily archive completions).'
        );
        expect(screen.getByText(/adept tier at profile level 3/i)).toBeInTheDocument();
        expect(screen.getByTestId('profile-milestone-rail')).toBeInTheDocument();
        expect(screen.getByTestId('profile-progression-impact-grid')).toHaveTextContent('Relic draft');
        expect(screen.getByTestId('profile-progression-impact-grid')).toHaveTextContent('+1 pick when unlocked');
        expect(screen.getByTestId('profile-progression-impact-grid')).toHaveTextContent(
            'More relic choice at milestone floors'
        );
        expect(screen.getByTestId('profile-progression-impact-grid')).toHaveTextContent('Run setup');
        expect(screen.getByTestId('profile-progression-impact-grid').getAttribute('aria-label')).toContain(
            'Profile progression impact signals. Relic draft: +1 pick when unlocked. Moment: More relic choice at milestone floors.'
        );
        expect(screen.getByText('+1 pick when unlocked').closest('div')).toHaveAccessibleName(
            /Week of Archives.*Relic draft: \+1 pick when unlocked.*Moment: More relic choice at milestone floors/i
        );
        expect(screen.getByText('Lv 1')).toBeInTheDocument();
        expect(screen.getByText('current')).toBeInTheDocument();
        expect(screen.getByText('10 honor marks')).toBeInTheDocument();
        expect(screen.getByTestId('profile-objective-board')).toBeInTheDocument();
        expect(screen.getByTestId('profile-daily-panel')).toBeInTheDocument();
        expect(screen.getByTestId('profile-recent-run')).toBeInTheDocument();
        expect(screen.getByTestId('profile-relic-details')).toBeInTheDocument();
        expect(screen.getByTestId('profile-save-trust-panel')).toBeInTheDocument();
        expect(screen.getByText('Local profile boundaries')).toBeInTheDocument();
        expect(screen.getByText('Cloud sync')).toBeInTheDocument();
        expect(screen.getByText(/cloud sync is not available in this build/i)).toBeInTheDocument();
        expect(screen.getByTestId('profile-trust-footer')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Settings' }));
        expect(profileStoreMocks.openSettings).toHaveBeenCalledWith('profile');

        await user.click(screen.getByRole('button', { name: 'Back' }));
        expect(profileStoreMocks.closeSubscreen).toHaveBeenCalledTimes(1);
    });

    it('lets a ready permanent upgrade be claimed from Profile', async () => {
        const user = userEvent.setup();
        const saveData = createDefaultSaveData();
        saveData.playerStats = {
            ...saveData.playerStats!,
            dailiesCompleted: 7
        };
        profileStoreMocks.saveData = saveData;

        render(<ProfileScreen />);

        expect(screen.getByTestId('profile-progression-impact-grid')).toHaveTextContent('Claim now');
        const claimButton = screen.getByRole('button', {
            name: /Claim Week of Archives\. Reward: \+1 relic pick per milestone/i
        });
        expect(claimButton).toHaveAccessibleName(/Permanent local upgrade/i);
        expect(claimButton).toHaveAttribute('data-profile-claim-payoff', '+1 relic pick per milestone');
        expect(claimButton).toHaveTextContent('+1 relic pick per milestone');
        expect(claimButton).toHaveTextContent('Permanent local upgrade');
        await user.click(claimButton);

        expect(profileStoreMocks.claimMetaProgressionReward).toHaveBeenCalledWith('upgrade_relic_shrine_extra_pick');
    });

    it('carries recent run payoff signals into the profile loop', () => {
        const saveData = createDefaultSaveData();
        saveData.lastRunSummary = {
            totalScore: 12345,
            bestScore: 12345,
            levelsCleared: 4,
            highestLevel: 5,
            achievementsEnabled: true,
            unlockedAchievements: [],
            bestStreak: 11,
            perfectClears: 2,
            activeMutators: ['short_memorize'],
            relicIds: ['extra_shuffle_charge'],
            gameMode: 'endless'
        };
        profileStoreMocks.saveData = saveData;

        render(<ProfileScreen />);

        const recentSignals = screen.getByTestId('profile-recent-run-signals');
        expect(recentSignals).toHaveTextContent('Combo live');
        expect(recentSignals).toHaveTextContent('Combo tier');
        expect(recentSignals).toHaveTextContent('x11');
        expect(recentSignals).toHaveTextContent('Protect the chain and cash the next reward band');
        expect(recentSignals).toHaveTextContent('Clean floor');
        expect(recentSignals).toHaveTextContent('Perfects');
        expect(recentSignals).toHaveTextContent('2');
        expect(recentSignals).toHaveTextContent('Relic online');
        expect(recentSignals).toHaveTextContent('Prime');
        expect(recentSignals).toHaveTextContent('1 relic');
        expect(recentSignals).toHaveTextContent('Pressure read');
        expect(recentSignals).toHaveTextContent('Pressure');
        expect(recentSignals).toHaveTextContent('1 mutator');
        expect(recentSignals).toHaveAttribute('data-recent-run-lane-map', 'chain:1>cash:1>build:1>risk:1');
        expect(recentSignals).toHaveAttribute(
            'data-recent-run-lane-actions',
            'chain:Protect chain:1>cash:Cash reward:1>build:Build route:1>risk:Reduce risk:1'
        );
        expect(recentSignals).toHaveAttribute(
            'data-recent-run-lane-roles',
            'chain:Protect:1>cash:Cashout:1>build:Build:1>risk:Recover:1'
        );
        expect(recentSignals).toHaveAttribute(
            'data-recent-run-lane-role-ids',
            'chain:protect:1>cash:cashout:1>build:build:1>risk:recover:1'
        );
        const laneMap = screen.getByTestId('profile-recent-run-lane-map');
        expect(laneMap).toHaveAttribute(
            'data-recent-run-lane-role-ids',
            'chain:protect:1>cash:cashout:1>build:build:1>risk:recover:1'
        );
        expect(laneMap).toHaveAttribute('data-recent-run-primary-lane', 'chain');
        expect(laneMap).toHaveAttribute('data-recent-run-primary-lane-action', 'Protect chain');
        expect(laneMap).toHaveAttribute('data-recent-run-primary-lane-audio', 'run-payoff-lane-chain');
        expect(laneMap).toHaveAttribute('data-recent-run-primary-lane-beats', '4');
        expect(laneMap).toHaveAttribute('data-recent-run-primary-lane-cue', 'Combo live');
        expect(laneMap).toHaveAttribute('data-recent-run-primary-lane-role', 'Protect');
        expect(laneMap).toHaveAttribute('data-recent-run-primary-lane-role-id', 'protect');
        expect(laneMap).toHaveAttribute('data-recent-run-primary-lane-screen-cue', 'burst');
        expect(laneMap).toHaveTextContent('Chain');
        expect(laneMap).toHaveTextContent('Cash');
        expect(laneMap).toHaveTextContent('Build');
        expect(laneMap).toHaveTextContent('Risk');
        expect(laneMap).toHaveTextContent('Protect chain');
        expect(laneMap).toHaveTextContent('Reduce risk');
        expect(laneMap).toHaveAccessibleName(
            'Profile recent run payoff lanes. Chain Protect x1. Protect chain. Combo live. Cash Cashout x1. Cash reward. Clean floor. Build Build x1. Build route. Relic online. Risk Recover x1. Reduce risk. Pressure read.'
        );
        const primaryLane = screen.getByTestId('profile-recent-run-primary-payoff-lane');
        expect(primaryLane).toHaveAccessibleName('Primary recent run payoff lane. Protect Chain: Protect chain. Combo live. 4 beats.');
        expect(primaryLane).toHaveAttribute('data-recent-run-primary-lane', 'chain');
        expect(primaryLane).toHaveAttribute('data-recent-run-primary-lane-action', 'Protect chain');
        expect(primaryLane).toHaveAttribute('data-recent-run-primary-lane-audio', 'run-payoff-lane-chain');
        expect(primaryLane).toHaveAttribute('data-recent-run-primary-lane-beats', '4');
        expect(primaryLane).toHaveAttribute('data-recent-run-primary-lane-cue', 'Combo live');
        expect(primaryLane).toHaveAttribute('data-recent-run-primary-lane-role', 'Protect');
        expect(primaryLane).toHaveAttribute('data-recent-run-primary-lane-role-id', 'protect');
        expect(primaryLane).toHaveAttribute('data-recent-run-primary-lane-screen-cue', 'burst');
        expect(primaryLane).toHaveTextContent('Replay chase');
        expect(primaryLane).toHaveTextContent('Protect chain');
        expect(primaryLane.querySelectorAll('[data-recent-run-primary-lane-beat]')).toHaveLength(4);
        const chainLane = laneMap.querySelector('[data-recent-run-lane="chain"]');
        const riskLane = laneMap.querySelector('[data-recent-run-lane="risk"]');
        expect(chainLane).toHaveAttribute('data-recent-run-lane-action', 'Protect chain');
        expect(chainLane).toHaveAttribute('data-recent-run-lane-beats', '4');
        expect(chainLane).toHaveAttribute('data-recent-run-lane-role', 'Protect');
        expect(chainLane).toHaveAttribute('data-recent-run-lane-role-id', 'protect');
        expect(chainLane?.querySelectorAll('[data-recent-run-lane-beat]')).toHaveLength(4);
        expect(riskLane).toHaveAttribute('data-recent-run-lane-action', 'Reduce risk');
        expect(riskLane).toHaveAttribute('data-recent-run-lane-beats', '2');
        expect(riskLane).toHaveAttribute('data-recent-run-lane-role', 'Recover');
        expect(riskLane).toHaveAttribute('data-recent-run-lane-role-id', 'recover');
        expect(riskLane?.querySelectorAll('[data-recent-run-lane-beat]')).toHaveLength(2);
        expect(screen.getByTestId('profile-recent-run-payoff-burst')).toHaveTextContent('Combo burst');
        expect(screen.getByTestId('profile-recent-run-payoff-burst')).toHaveTextContent('Chase again');
        expect(screen.getByTestId('profile-recent-run-payoff-burst')).toHaveTextContent('3 payoffs');
        expect(screen.getByTestId('profile-recent-run-payoff-burst')).toHaveAttribute(
            'data-recent-run-burst-action',
            'Chase again'
        );
        expect(screen.getByTestId('profile-recent-run-payoff-burst')).toHaveAttribute(
            'data-recent-run-burst-tone',
            'chain'
        );
        expect(screen.getByTestId('profile-recent-run-payoff-burst')).toHaveAccessibleName(
            'Profile recent run payoff burst. Combo burst: Chase again. 3 payoffs.'
        );
        expect(recentSignals.querySelector('[data-recent-run-signal-tone="chain"]')).toHaveTextContent('x11');
        expect(recentSignals.querySelector('[data-recent-run-signal-tone="chain"]')).toHaveTextContent(
            'Protect the chain and cash the next reward band'
        );
        const chainSignal = recentSignals.querySelector('[data-recent-run-signal-tone="chain"]');
        const buildSignal = recentSignals.querySelector('[data-recent-run-signal-tone="build"]');
        const riskSignal = recentSignals.querySelector('[data-recent-run-signal-tone="risk"]');
        expect(chainSignal).toHaveAttribute('data-recent-run-signal-beats', '4');
        expect(chainSignal).toHaveAttribute('data-recent-run-signal-action', 'Protect chain');
        expect(chainSignal).toHaveAttribute('data-recent-run-signal-audio', 'run-payoff-chain');
        expect(chainSignal).toHaveAttribute('data-recent-run-signal-screen-cue', 'burst');
        expect(chainSignal).toHaveTextContent('Protect chain');
        expect(chainSignal?.querySelectorAll('[data-recent-run-signal-beat]')).toHaveLength(4);
        expect(buildSignal).toHaveTextContent('1 relic');
        expect(buildSignal).toHaveAttribute('data-recent-run-signal-beats', '3');
        expect(buildSignal).toHaveAttribute('data-recent-run-signal-action', 'Build route');
        expect(buildSignal).toHaveAttribute('data-recent-run-signal-audio', 'run-payoff-build');
        expect(buildSignal).toHaveAttribute('data-recent-run-signal-screen-cue', 'snap');
        expect(buildSignal?.querySelectorAll('[data-recent-run-signal-beat]')).toHaveLength(3);
        expect(riskSignal).toHaveAttribute('data-recent-run-signal-beats', '2');
        expect(riskSignal).toHaveAttribute('data-recent-run-signal-action', 'Reduce risk');
        expect(riskSignal).toHaveAttribute('data-recent-run-signal-audio', 'run-payoff-risk');
        expect(riskSignal).toHaveAttribute('data-recent-run-signal-screen-cue', 'guard');
        expect(riskSignal?.querySelectorAll('[data-recent-run-signal-beat]')).toHaveLength(2);
        expect(recentSignals.getAttribute('aria-label')).toContain(
            'Recent run payoff signals. Combo live: Combo tier: x11. Next: Protect the chain and cash the next reward band.'
        );
    });

    it('keeps stored super-stack payoff lanes visible after leaving game over', () => {
        const saveData = createDefaultSaveData();
        saveData.lastRunSummary = {
            totalScore: 22222,
            bestScore: 22222,
            levelsCleared: 5,
            highestLevel: 6,
            achievementsEnabled: true,
            unlockedAchievements: [],
            bestStreak: 12,
            perfectClears: 2,
            activeMutators: [],
            relicIds: ['extra_shuffle_charge'],
            payoffPickupClaimed: 2,
            payoffPickupTotal: 2,
            payoffRewardPerkCount: 1,
            payoffRoutePaid: true,
            payoffRouteRewardText: '+1 combo shard',
            gameMode: 'endless'
        };
        profileStoreMocks.saveData = saveData;

        render(<ProfileScreen />);

        const burst = screen.getByTestId('profile-recent-run-payoff-burst');
        expect(burst).toHaveTextContent('Super stack');
        expect(burst).toHaveTextContent('Rebuild super stack');
        expect(burst).toHaveTextContent('4 payoffs');
        expect(burst).toHaveAttribute('data-recent-run-burst-action', 'Rebuild super stack');
        expect(burst).toHaveAttribute('data-recent-run-burst-tone', 'super');
        expect(burst).toHaveAccessibleName('Profile recent run payoff burst. Super stack: Rebuild super stack. 4 payoffs.');
        expect(screen.getByTestId('profile-recent-run-signals')).toHaveTextContent('Route paid');
        expect(screen.getByTestId('profile-recent-run-signals')).toHaveTextContent('Pickups');
        expect(screen.getByTestId('profile-recent-run-signals')).toHaveTextContent('2/2');
        expect(screen.getByTestId('profile-recent-run-signals')).toHaveAttribute(
            'data-recent-run-lane-map',
            'chain:1>cash:3'
        );
        expect(screen.getByTestId('profile-recent-run-signals')).toHaveAttribute(
            'data-recent-run-lane-actions',
            'chain:Protect chain:1>cash:Cash reward:3'
        );
        expect(screen.getByTestId('profile-recent-run-signals')).toHaveAttribute(
            'data-recent-run-lane-roles',
            'chain:Protect:1>cash:Stack:3'
        );
        expect(screen.getByTestId('profile-recent-run-signals')).toHaveAttribute(
            'data-recent-run-lane-role-ids',
            'chain:protect:1>cash:stack:3'
        );
        expect(screen.getByTestId('profile-recent-run-lane-map')).toHaveAttribute(
            'data-recent-run-lane-role-ids',
            'chain:protect:1>cash:stack:3'
        );
        expect(screen.getByTestId('profile-recent-run-lane-map').querySelector('[data-recent-run-lane="cash"]')).toHaveAttribute(
            'data-recent-run-lane-role-id',
            'stack'
        );
        expect(screen.getByTestId('profile-recent-run-lane-map')).toHaveAccessibleName(
            'Profile recent run payoff lanes. Chain Protect x1. Protect chain. Combo live. Cash Stack x3. Cash reward. Route cashout.'
        );
    });
});
