import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveData } from '../../shared/contracts';
import { createDefaultSaveData } from '../../shared/save-data';
import CollectionScreen from './CollectionScreen';

const collectionStoreMocks = vi.hoisted(() => ({
    saveData: null as SaveData | null
}));

vi.mock('../audio/uiSfx', () => ({
    playUiBackSfx: vi.fn(),
    resumeUiSfxContext: vi.fn(),
    uiSfxGainFromSettings: () => 0
}));
vi.mock('zustand/react/shallow', () => ({
    useShallow: <T,>(fn: T) => fn
}));

vi.mock('../store/useAppStore', () => ({
    useAppStore: (selector: (state: unknown) => unknown) => {
        const saveData = collectionStoreMocks.saveData ?? createDefaultSaveData();
        saveData.achievements.ACH_FIRST_CLEAR = true;
        return selector({
            closeSubscreen: vi.fn(),
            saveData,
            settings: saveData.settings
        });
    }
}));

describe('CollectionScreen REG-093 reward gallery', () => {
    beforeEach(() => {
        collectionStoreMocks.saveData = null;
    });

    it('surfaces owned, in-progress, and missing local reward rows', () => {
        render(<CollectionScreen />);

        const gallery = screen.getByTestId('collection-reward-gallery');
        expect(gallery).toHaveTextContent(/Achievement gallery/);
        expect(gallery).toHaveTextContent(/Cosmetic gallery/);
        expect(gallery).toHaveTextContent(/in progress|missing|owned/i);
        expect(gallery).toHaveTextContent(/Mastery goals push clean chains/i);
        expect(gallery).toHaveTextContent(/Visual-only rewards keep gameplay power readable and fair/i);
        expect(gallery.getAttribute('aria-label')).toContain('Collection reward gallery. Achievement gallery.');
        expect(gallery.getAttribute('aria-label')).toContain('Next: Clear floors, protect lives, and chase score milestones.');
        expect(screen.getByText('Achievement gallery').closest('div')).toHaveAccessibleName(
            /Achievement gallery.*Impact: Mastery goals push clean chains.*Next: Clear floors, protect lives, and chase score milestones/i
        );
        expect(screen.getByText('Cosmetic gallery').closest('div')).toHaveAccessibleName(
            /Cosmetic gallery.*Impact: Visual-only rewards keep gameplay power readable and fair/i
        );

        const rewardSignals = screen.getByTestId('collection-reward-signals');
        expect(rewardSignals).toHaveAccessibleName(/Collection reward signals.*Profile level 1/i);
        expect(rewardSignals).toHaveAccessibleName(/Next: Earn one more achievement for 2 honor marks/i);
        expect(within(rewardSignals).getByText('Profile level 1').closest('div')).toHaveAccessibleName(
            /Profile level 1.*Next: Earn one more achievement for 2 honor marks/i
        );

        const metaBoard = screen.getByTestId('collection-meta-progression-board');
        expect(metaBoard).toHaveTextContent(/Initiate tier - 3 honor marks to next profile level/i);
        expect(metaBoard).toHaveTextContent(/Progression focus/i);
        expect(metaBoard).toHaveTextContent(/Next: Week of Archives/i);
        expect(metaBoard).toHaveTextContent(/Adept tier at profile level 3/i);

        const impactGrid = screen.getByTestId('collection-progression-impact-grid');
        expect(impactGrid).toHaveTextContent(/Relic draft/i);
        expect(impactGrid).toHaveTextContent(/\+1 pick when unlocked/i);
        expect(impactGrid).toHaveTextContent(/More relic choice at milestone floors/i);
        expect(impactGrid).toHaveTextContent(/Run setup/i);
        expect(impactGrid.getAttribute('aria-label')).toContain(
            'Collection progression impact signals. Relic draft: +1 pick when unlocked. Moment: More relic choice at milestone floors.'
        );
        expect(screen.getByText('+1 pick when unlocked').closest('div')).toHaveAccessibleName(
            /Week of Archives.*Relic draft: \+1 pick when unlocked.*Moment: More relic choice at milestone floors/i
        );

        expect(screen.getByText('Classic Card Back')).toBeInTheDocument();
        expect(screen.getAllByText('Daily Bronze Crest').length).toBeGreaterThan(0);
        expect(screen.getByText(/Locked · Future honor bridge: Daily Initiate/i)).toBeInTheDocument();
        expect(screen.getByText(/Locked · Future honor bridge: Ascendant V/i)).toBeInTheDocument();
        expect(screen.getByTestId('meta-screen-body')).not.toHaveTextContent('undefined');
    });

    it('surfaces last-run payoff signals in the collection archive', () => {
        const saveData = createDefaultSaveData();
        saveData.lastRunSummary = {
            totalScore: 9876,
            bestScore: 9876,
            levelsCleared: 3,
            highestLevel: 4,
            achievementsEnabled: true,
            unlockedAchievements: [],
            bestStreak: 10,
            perfectClears: 1,
            activeMutators: ['short_memorize'],
            relicIds: ['extra_shuffle_charge'],
            gameMode: 'endless'
        };
        collectionStoreMocks.saveData = saveData;

        render(<CollectionScreen />);

        const payoffSignals = screen.getByTestId('collection-last-run-payoff-signals');
        expect(payoffSignals).toHaveTextContent('Combo live');
        expect(payoffSignals).toHaveTextContent('Combo tier');
        expect(payoffSignals).toHaveTextContent('x10');
        expect(payoffSignals).toHaveTextContent('Protect the chain and cash the next reward band');
        expect(payoffSignals).toHaveTextContent('Clean floor');
        expect(payoffSignals).toHaveTextContent('Perfects');
        expect(payoffSignals).toHaveTextContent('Relic online');
        expect(payoffSignals).toHaveTextContent('Prime');
        expect(payoffSignals).toHaveTextContent('1 relic');
        expect(payoffSignals).toHaveTextContent('Pressure read');
        expect(payoffSignals).toHaveTextContent('Pressure');
        expect(payoffSignals).toHaveAttribute('data-run-payoff-lane-map', 'chain:1>cash:1>build:1>risk:1');
        expect(payoffSignals).toHaveAttribute(
            'data-run-payoff-lane-actions',
            'chain:Protect chain:1>cash:Cash reward:1>build:Build route:1>risk:Reduce risk:1'
        );
        expect(screen.getByTestId('collection-last-run-payoff-lane-map')).toHaveAttribute(
            'data-run-payoff-lane-map',
            'chain:1>cash:1>build:1>risk:1'
        );
        expect(screen.getByTestId('collection-last-run-payoff-lane-map')).toHaveAttribute(
            'data-run-payoff-lane-actions',
            'chain:Protect chain:1>cash:Cash reward:1>build:Build route:1>risk:Reduce risk:1'
        );
        expect(screen.getByTestId('collection-last-run-payoff-lane-map')).toHaveAttribute(
            'data-run-payoff-primary-lane',
            'chain'
        );
        expect(screen.getByTestId('collection-last-run-payoff-lane-map')).toHaveAttribute(
            'data-run-payoff-primary-lane-action',
            'Protect chain'
        );
        expect(screen.getByTestId('collection-last-run-payoff-lane-map')).toHaveAttribute(
            'data-run-payoff-primary-lane-beats',
            '4'
        );
        expect(screen.getByTestId('collection-last-run-payoff-lane-map')).toHaveAttribute(
            'data-run-payoff-primary-lane-cue',
            'Combo live'
        );
        const laneMapSummary = screen.getByTestId('collection-last-run-payoff-lane-map-summary');
        expect(laneMapSummary).toHaveAttribute('data-run-payoff-lane-count', '4');
        expect(laneMapSummary).toHaveTextContent('Archive lanes');
        expect(laneMapSummary).toHaveTextContent('4 lanes');
        expect(laneMapSummary).toHaveTextContent('Chain led');
        expect(laneMapSummary.querySelectorAll('[data-run-payoff-lane-map-summary-beat]')).toHaveLength(5);
        expect(laneMapSummary.querySelector('[data-run-payoff-lane-map-summary-beat="1"]')).toHaveAttribute(
            'data-run-payoff-lane-map-summary-beat-focus',
            'chain'
        );
        expect(laneMapSummary.querySelector('[data-run-payoff-lane-map-summary-beat="2"]')).toHaveAttribute(
            'data-run-payoff-lane-map-summary-beat-focus',
            'support'
        );
        expect(screen.getByTestId('collection-last-run-payoff-lane-map')).toHaveTextContent('Chain');
        expect(screen.getByTestId('collection-last-run-payoff-lane-map')).toHaveTextContent('Cash');
        expect(screen.getByTestId('collection-last-run-payoff-lane-map')).toHaveTextContent('Build');
        expect(screen.getByTestId('collection-last-run-payoff-lane-map')).toHaveTextContent('Risk');
        expect(screen.getByTestId('collection-last-run-payoff-lane-map')).toHaveTextContent('Protect chain');
        expect(screen.getByTestId('collection-last-run-payoff-lane-map')).toHaveTextContent('Reduce risk');
        expect(screen.getByTestId('collection-last-run-payoff-lane-map')).toHaveAccessibleName(
            'Collection last run payoff lanes. Chain: 1. Protect chain. Combo live. Cash: 1. Cash reward. Clean floor. Build: 1. Build route. Relic online. Risk: 1. Reduce risk. Pressure read.'
        );
        const laneMap = screen.getByTestId('collection-last-run-payoff-lane-map');
        expect(laneMap).toHaveAttribute('data-run-payoff-primary-lane-audio', 'run-payoff-lane-chain');
        expect(laneMap).toHaveAttribute('data-run-payoff-primary-lane-screen-cue', 'burst');
        const primaryLane = screen.getByTestId('collection-last-run-primary-payoff-lane');
        expect(primaryLane).toHaveAccessibleName('Primary archived payoff lane. Chain: Protect chain. Combo live. 4 beats.');
        expect(primaryLane).toHaveAttribute('data-run-payoff-primary-lane', 'chain');
        expect(primaryLane).toHaveAttribute('data-run-payoff-primary-lane-action', 'Protect chain');
        expect(primaryLane).toHaveAttribute('data-run-payoff-primary-lane-audio', 'run-payoff-lane-chain');
        expect(primaryLane).toHaveAttribute('data-run-payoff-primary-lane-beats', '4');
        expect(primaryLane).toHaveAttribute('data-run-payoff-primary-lane-cue', 'Combo live');
        expect(primaryLane).toHaveAttribute('data-run-payoff-primary-lane-screen-cue', 'burst');
        expect(primaryLane).toHaveTextContent('Archive chase');
        expect(primaryLane).toHaveTextContent('Protect chain');
        expect(primaryLane.querySelectorAll('[data-run-payoff-primary-lane-beat]')).toHaveLength(4);
        expect(primaryLane.querySelector('[data-run-payoff-primary-lane-beat="1"]')).toHaveAttribute(
            'data-run-payoff-primary-lane-beat-focus',
            'primary'
        );
        const chainLane = laneMap.querySelector('[data-run-payoff-lane="chain"]');
        const riskLane = laneMap.querySelector('[data-run-payoff-lane="risk"]');
        expect(chainLane).toHaveAttribute('data-run-payoff-lane-action', 'Protect chain');
        expect(chainLane).toHaveAttribute('data-run-payoff-lane-beats', '4');
        expect(chainLane?.querySelectorAll('[data-run-payoff-lane-beat]')).toHaveLength(4);
        expect(chainLane?.querySelector('[data-run-payoff-lane-beat="1"]')).toHaveAttribute(
            'data-run-payoff-lane-beat-focus',
            'primary'
        );
        expect(riskLane).toHaveAttribute('data-run-payoff-lane-action', 'Reduce risk');
        expect(riskLane).toHaveAttribute('data-run-payoff-lane-beats', '2');
        expect(riskLane?.querySelectorAll('[data-run-payoff-lane-beat]')).toHaveLength(2);
        expect(screen.getByTestId('collection-last-run-payoff-burst')).toHaveTextContent('Combo burst');
        expect(screen.getByTestId('collection-last-run-payoff-burst')).toHaveTextContent('Chase again');
        expect(screen.getByTestId('collection-last-run-payoff-burst')).toHaveTextContent('3 payoffs');
        expect(screen.getByTestId('collection-last-run-payoff-burst')).toHaveAttribute(
            'data-run-payoff-burst-action',
            'Chase again'
        );
        expect(screen.getByTestId('collection-last-run-payoff-burst')).toHaveAttribute(
            'data-run-payoff-burst-tone',
            'chain'
        );
        expect(screen.getByTestId('collection-last-run-payoff-burst')).toHaveAccessibleName(
            'Collection last run payoff burst. Combo burst: Chase again. 3 payoffs.'
        );
        const crescendo = screen.getByTestId('collection-last-run-payoff-crescendo');
        expect(crescendo).toHaveTextContent('Stack burst');
        expect(crescendo).toHaveTextContent('Combo plus payoff lanes are ready to chase again');
        expect(crescendo.querySelectorAll('i')).toHaveLength(4);
        expect(crescendo.querySelector('[data-run-payoff-crescendo-beat="1"]')).toHaveAttribute(
            'data-run-payoff-crescendo-beat-focus',
            'primary'
        );
        expect(crescendo).toHaveAttribute('data-run-payoff-crescendo-audio', 'stack-burst');
        expect(crescendo).toHaveAttribute('data-run-payoff-crescendo-beats', '4');
        expect(crescendo).toHaveAttribute('data-run-payoff-crescendo-cue', 'burst');
        expect(crescendo).toHaveAttribute('data-run-payoff-crescendo-tier', 'stack');
        expect(crescendo).toHaveAccessibleName(
            'Collection last run payoff crescendo. Stack burst: Combo plus payoff lanes are ready to chase again. 4 beats.'
        );
        expect(payoffSignals.querySelector('[data-run-payoff-tone="chain"]')).toHaveTextContent('x10');
        expect(payoffSignals.querySelector('[data-run-payoff-tone="chain"]')).toHaveTextContent(
            'Protect the chain and cash the next reward band'
        );
        const chainPayoff = payoffSignals.querySelector('[data-run-payoff-tone="chain"]');
        const buildPayoff = payoffSignals.querySelector('[data-run-payoff-tone="build"]');
        const riskPayoff = payoffSignals.querySelector('[data-run-payoff-tone="risk"]');
        expect(chainPayoff).toHaveAttribute('data-run-payoff-beats', '4');
        expect(chainPayoff).toHaveAttribute('data-run-payoff-action', 'Protect chain');
        expect(chainPayoff).toHaveAttribute('data-run-payoff-audio', 'run-payoff-chain');
        expect(chainPayoff).toHaveAttribute('data-run-payoff-screen-cue', 'burst');
        expect(chainPayoff).toHaveTextContent('Protect chain');
        expect(chainPayoff?.querySelectorAll('[data-run-payoff-beat]')).toHaveLength(4);
        expect(chainPayoff?.querySelector('[data-run-payoff-beat="1"]')).toHaveAttribute(
            'data-run-payoff-beat-focus',
            'primary'
        );
        expect(buildPayoff).toHaveTextContent('1 relic');
        expect(buildPayoff).toHaveAttribute('data-run-payoff-beats', '3');
        expect(buildPayoff).toHaveAttribute('data-run-payoff-action', 'Build route');
        expect(buildPayoff).toHaveAttribute('data-run-payoff-audio', 'run-payoff-build');
        expect(buildPayoff).toHaveAttribute('data-run-payoff-screen-cue', 'snap');
        expect(buildPayoff?.querySelectorAll('[data-run-payoff-beat]')).toHaveLength(3);
        expect(riskPayoff).toHaveAttribute('data-run-payoff-beats', '2');
        expect(riskPayoff).toHaveAttribute('data-run-payoff-action', 'Reduce risk');
        expect(riskPayoff).toHaveAttribute('data-run-payoff-audio', 'run-payoff-risk');
        expect(riskPayoff).toHaveAttribute('data-run-payoff-screen-cue', 'guard');
        expect(riskPayoff?.querySelectorAll('[data-run-payoff-beat]')).toHaveLength(2);
        expect(payoffSignals).toHaveAccessibleName(
            /Collection last run payoff signals.*Combo live: Combo tier: x10.*Next: Protect the chain/i
        );
    });

    it('renders stored super-stack payoff lanes in the collection archive', () => {
        const saveData = createDefaultSaveData();
        saveData.lastRunSummary = {
            totalScore: 24680,
            bestScore: 24680,
            levelsCleared: 5,
            highestLevel: 6,
            achievementsEnabled: true,
            unlockedAchievements: [],
            bestStreak: 13,
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
        collectionStoreMocks.saveData = saveData;

        render(<CollectionScreen />);

        const burst = screen.getByTestId('collection-last-run-payoff-burst');
        expect(burst).toHaveTextContent('Super stack');
        expect(burst).toHaveTextContent('Rebuild super stack');
        expect(burst).toHaveTextContent('4 payoffs');
        expect(burst).toHaveAttribute('data-run-payoff-burst-action', 'Rebuild super stack');
        expect(burst).toHaveAttribute('data-run-payoff-burst-tone', 'super');
        expect(burst).toHaveAccessibleName('Collection last run payoff burst. Super stack: Rebuild super stack. 4 payoffs.');
        const crescendo = screen.getByTestId('collection-last-run-payoff-crescendo');
        expect(crescendo).toHaveTextContent('Super burst');
        expect(crescendo).toHaveTextContent('Archive this route as a full payoff stack to rebuild next run');
        expect(crescendo.querySelectorAll('i')).toHaveLength(5);
        expect(crescendo).toHaveAttribute('data-run-payoff-crescendo-audio', 'super-burst');
        expect(crescendo).toHaveAttribute('data-run-payoff-crescendo-beats', '5');
        expect(crescendo).toHaveAttribute('data-run-payoff-crescendo-cue', 'super');
        expect(crescendo).toHaveAttribute('data-run-payoff-crescendo-tier', 'super');
        expect(crescendo).toHaveAccessibleName(
            'Collection last run payoff crescendo. Super burst: Archive this route as a full payoff stack to rebuild next run. 5 beats.'
        );
        expect(screen.getByTestId('collection-last-run-payoff-signals')).toHaveTextContent('Route paid');
        expect(screen.getByTestId('collection-last-run-payoff-signals')).toHaveTextContent('Pickups');
        expect(screen.getByTestId('collection-last-run-payoff-signals')).toHaveTextContent('2/2');
        expect(screen.getByTestId('collection-last-run-payoff-signals')).toHaveAttribute(
            'data-run-payoff-lane-map',
            'chain:1>cash:3'
        );
        expect(screen.getByTestId('collection-last-run-payoff-signals')).toHaveAttribute(
            'data-run-payoff-lane-actions',
            'chain:Protect chain:1>cash:Cash reward:3'
        );
        expect(screen.getByTestId('collection-last-run-payoff-lane-map')).toHaveAccessibleName(
            'Collection last run payoff lanes. Chain: 1. Protect chain. Combo live. Cash: 3. Cash reward. Route cashout.'
        );

        const sequence = screen.getByTestId('collection-last-run-payoff-sequence');
        expect(sequence).toHaveTextContent('First');
        expect(sequence).toHaveTextContent('Route cashout: +1 combo shard');
        expect(sequence).toHaveTextContent('Then');
        expect(sequence).toHaveTextContent('Keep claiming before exit');
        expect(sequence).toHaveTextContent('Keep');
        expect(sequence).toHaveTextContent('Keep feeding the route that paid out');
        expect(sequence).toHaveAttribute('data-run-payoff-sequence-first', 'Route cashout: +1 combo shard');
        expect(sequence).toHaveAttribute('data-run-payoff-sequence-then', 'Keep claiming before exit');
        expect(sequence).toHaveAttribute('data-run-payoff-sequence-keep', 'Keep feeding the route that paid out');
        expect(sequence).toHaveAttribute('data-run-payoff-sequence-tone', 'super');
        expect(sequence).toHaveAccessibleName(
            'Collection last run payoff sequence. First: Route cashout: +1 combo shard. Then: Keep claiming before exit. Keep: Keep feeding the route that paid out.'
        );
    });

    it('shows the next chain chase when the last run has not reached combo mastery', () => {
        const saveData = createDefaultSaveData();
        saveData.lastRunSummary = {
            totalScore: 6400,
            bestScore: 6400,
            levelsCleared: 2,
            highestLevel: 3,
            achievementsEnabled: true,
            unlockedAchievements: [],
            bestStreak: 7,
            perfectClears: 0,
            gameMode: 'endless'
        };
        collectionStoreMocks.saveData = saveData;

        render(<CollectionScreen />);

        const payoffSignals = screen.getByTestId('collection-last-run-payoff-signals');
        expect(payoffSignals).toHaveTextContent('Next chase');
        expect(payoffSignals).toHaveTextContent('Chain chase');
        expect(payoffSignals).toHaveTextContent('x10 next');
        expect(screen.queryByTestId('collection-last-run-payoff-burst')).toBeNull();
        const crescendo = screen.getByTestId('collection-last-run-payoff-crescendo');
        expect(crescendo).toHaveTextContent('Cashout beat');
        expect(crescendo.querySelectorAll('i')).toHaveLength(3);
        expect(crescendo).toHaveAttribute('data-run-payoff-crescendo-audio', 'cashout-pop');
        expect(crescendo).toHaveAttribute('data-run-payoff-crescendo-cue', 'snap');
        expect(crescendo).toHaveAttribute('data-run-payoff-crescendo-tier', 'cashout');
        expect(payoffSignals).toHaveAccessibleName(/Chain chase: x10 next/i);
    });
});
