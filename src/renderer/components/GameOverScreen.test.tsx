import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RunState } from '../../shared/contracts';
import { createNewRun, createRunSummary, finishMemorizePhase } from '../../shared/game-core';
import { createDefaultSaveData } from '../../shared/save-data';
import { getGameOverNextRunRows } from '../../shared/game-over-next-run';
import GameOverScreen from './GameOverScreen';

const uiSfxMocks = vi.hoisted(() => ({
    playGameOverOpenSfx: vi.fn(),
    playUiBackSfx: vi.fn(),
    resumeUiSfxContext: vi.fn(),
    uiSfxGainFromSettings: () => 1
}));

vi.mock('./MainMenuBackground', () => ({ default: () => null }));
vi.mock('../hooks/useViewportSize', () => ({
    useViewportSize: () => ({ width: 1280, height: 800 })
}));
vi.mock('../platformTilt/usePlatformTiltField', () => ({
    usePlatformTiltField: () => ({ tiltRef: { current: null } })
}));
vi.mock('../audio/uiSfx', () => uiSfxMocks);
vi.mock('zustand/react/shallow', () => ({
    useShallow: <T,>(fn: T) => fn
}));
vi.mock('../store/useAppStore', () => ({
    useAppStore: (selector: (s: never) => unknown) =>
        selector({
            goToMenu: vi.fn(),
            restartRun: vi.fn(),
            saveData: createDefaultSaveData(),
            settings: {
                reduceMotion: true,
                graphicsQuality: 'high',
                uiScale: 1
            }
        } as never)
}));

const gameOverRunFixture = (): RunState => {
    let run = finishMemorizePhase(createNewRun(100, { runSeed: 0xabc }));
    run = { ...run, status: 'gameOver', lives: 0 };
    return createRunSummary(run, []);
};

describe('GameOverScreen (REF-031)', () => {
    it('exposes a single page title and polite run summary for assistive tech', () => {
        render(<GameOverScreen run={gameOverRunFixture()} />);

        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(screen.getByRole('heading', { level: 1, name: 'Expedition Over' })).toBeInTheDocument();

        const polite = screen.getByLabelText('Run summary announcement');
        expect(polite).toHaveAttribute('aria-live', 'polite');
        expect(polite).toHaveTextContent(/Expedition complete/);

        expect(screen.getAllByRole('button', { name: 'Play Again - start a new run after this expedition' })[0]).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Mobile Play Again - start a new run after this expedition' })[0]).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Return to the main menu' })[0]).toBeInTheDocument();
    });

    it('uses a second-level heading for unlocked achievements', () => {
        const run = gameOverRunFixture();
        const withAchievement: RunState = {
            ...run,
            lastRunSummary: run.lastRunSummary
                ? {
                      ...run.lastRunSummary,
                      unlockedAchievements: ['ACH_FIRST_CLEAR']
                  }
                : null
        };
        render(<GameOverScreen run={withAchievement} />);

        expect(screen.getByRole('heading', { level: 2, name: 'New archive entries' })).toBeInTheDocument();
    });

    it('plays game-over open on mount', () => {
        render(<GameOverScreen run={gameOverRunFixture()} />);
        expect(uiSfxMocks.playGameOverOpenSfx).toHaveBeenCalledTimes(1);
    });

    it('REG-007 keeps primary retry actions in the above-fold mobile summary block', () => {
        render(<GameOverScreen run={gameOverRunFixture()} />);

        const topSummary = screen.getByTestId('game-over-above-fold-summary');
        expect(topSummary).toHaveTextContent('score');
        expect(topSummary).toHaveTextContent('Play Again');
        expect(topSummary).toHaveTextContent('Main Menu');
        expect(screen.getByText(/Journal/)).toBeInTheDocument();
    });

    it('REG-096 surfaces next-run loop reasons from local summary data', () => {
        const run = gameOverRunFixture();
        const signaledRun: RunState = {
            ...run,
            findablesClaimedThisFloor: 1,
            findablesTotalThisFloor: 2,
            lastRunSummary: run.lastRunSummary
                ? {
                      ...run.lastRunSummary,
                      bestStreak: 5
                  }
                : null
        };
        const rows = getGameOverNextRunRows(signaledRun);
        expect(rows.map((row) => row.id)).toEqual(['run_it_back', 'chain_target', 'build_recap', 'local_share', 'next_goal']);
        expect(rows.every((row) => row.localOnly)).toBe(true);

        render(<GameOverScreen run={signaledRun} />);
        expect(screen.getByTestId('game-over-next-run-loop')).toHaveTextContent(/Classic/);
        expect(screen.getByTestId('game-over-next-run-loop')).toHaveTextContent(/Chain target/);
        expect(screen.getByTestId('game-over-next-run-loop')).toHaveTextContent(/Push x6 reward/);
        expect(screen.getByTestId('game-over-next-run-loop').querySelector('[data-next-run-row="chain_target"]')).toHaveTextContent(
            'Push x6 reward'
        );
        expect(screen.getByTestId('game-over-next-run-loop').querySelector('[data-next-run-row="chain_target"]')).toHaveTextContent(
            'Open with confirmed pairs, then convert tools into one longer streak.'
        );
        expect(screen.getByTestId('game-over-next-run-loop').querySelector('[data-next-run-row="chain_target"]')).toHaveAttribute(
            'data-next-run-action-cue',
            'Open with confirmed pairs, then convert tools into one longer streak.'
        );
        expect(screen.getAllByRole('button', { name: 'Play Again - start a new run after this expedition' })[0]).toHaveAttribute(
            'data-next-run-button-cue',
            'Open with confirmed pairs, then convert tools into one longer streak.'
        );
        expect(screen.getAllByRole('button', { name: 'Play Again - start a new run after this expedition' })[0]).toHaveTextContent(
            'Open with confirmed pairs, then convert tools into one longer streak.'
        );
        expect(screen.getAllByRole('button', { name: 'Return to the main menu' })[0]).toHaveAttribute(
            'data-next-run-button-cue',
            'Use Profile for reward status; choose Classic to benefit from permanent upgrades.'
        );
        expect(screen.getAllByRole('button', { name: 'Return to the main menu' })[0]).toHaveTextContent(
            'Use Profile for reward status; choose Classic to benefit from permanent upgrades.'
        );
        expect(screen.getByTestId('game-over-next-run-loop').querySelector('[data-next-run-row="run_it_back"]')).toHaveTextContent(
            'Play Again restarts the current mode locally; Main Menu returns to the hub.'
        );
        expect(screen.getByTestId('game-over-next-run-loop')).toHaveTextContent(/best chain x5/i);
        expect(screen.getByTestId('game-over-next-run-loop')).toHaveTextContent(/pickups 1\/2/i);
        expect(screen.getByTestId('game-over-next-run-loop')).toHaveTextContent(/Next goal/);
        expect(screen.getByTestId('game-over-next-run-loop').getAttribute('aria-label')).toContain(
            'Next run loop signals. Run it back: Classic'
        );
        expect(screen.getByTestId('game-over-next-run-loop').getAttribute('aria-label')).toContain('best chain x5');
        expect(screen.getByTestId('game-over-next-run-loop').getAttribute('aria-label')).toContain(
            'Chain target: Push x6 reward'
        );
        expect(screen.getByTestId('game-over-next-run-loop').getAttribute('aria-label')).toContain('pickups 1/2');
        expect(screen.getByTestId('game-over-dungeon-journal')).toHaveTextContent(/Dungeon node/);
        expect(screen.getByTestId('game-over-dungeon-journal')).toHaveTextContent(/Dungeon rewards/);
        expect(screen.getByTestId('game-over-dungeon-journal').getAttribute('aria-label')).toContain(
            'Dungeon journal signals. Dungeon node'
        );
    });

    it('surfaces final outcome signals with build and pressure context', () => {
        const run = gameOverRunFixture();
        const signaledRun: RunState = {
            ...run,
            findablesClaimedThisFloor: 2,
            findablesTotalThisFloor: 3,
            rewardPerkIds: ['trait_streak_toolkit'],
            traitRouteObjectiveCompletedThisFloor: true,
            traitRouteObjectiveRewardClaimedThisFloor: true,
            traitRouteObjectiveRewardTextThisFloor: '+1 combo shard',
            stats: {
                ...run.stats,
                mismatches: 2,
                volatileTraitShuffles: 1
            },
            lastRunSummary: run.lastRunSummary
                ? {
                      ...run.lastRunSummary,
                      activeMutators: ['short_memorize'],
                      bestStreak: 7,
                      perfectClears: 2,
                      relicIds: ['extra_shuffle_charge']
                  }
                : null
        };

        render(<GameOverScreen run={signaledRun} />);

        const signals = screen.getByTestId('game-over-outcome-signals');
        expect(signals).toHaveTextContent('Best chain');
        expect(signals).toHaveTextContent('x7');
        expect(signals).toHaveTextContent('Perfect clears');
        expect(signals).toHaveTextContent('2');
        expect(signals.querySelector('[data-outcome-signal="build"]')).toHaveTextContent('1 relic');
        expect(signals.querySelector('[data-outcome-signal="pressure"]')).toHaveTextContent('1 mutator');
        expect(signals.getAttribute('aria-label')).toContain('Game over outcome signals. Score:');
        expect(signals.getAttribute('aria-label')).toContain('Best chain: x7');

        const payoffBurst = screen.getByTestId('game-over-payoff-burst');
        expect(payoffBurst).toHaveTextContent('Chain cashout');
        expect(payoffBurst).toHaveTextContent('x7');
        expect(payoffBurst).toHaveTextContent('Route cashout');
        expect(payoffBurst).toHaveTextContent('Route paid');
        expect(payoffBurst).toHaveTextContent('+1 combo shard');
        expect(payoffBurst).toHaveTextContent('Keep feeding the route that paid out');
        expect(payoffBurst).toHaveTextContent('Left value');
        expect(payoffBurst).toHaveTextContent('Pickups');
        expect(payoffBurst).toHaveTextContent('2/3');
        expect(payoffBurst).toHaveTextContent('Perk online');
        expect(payoffBurst).toHaveTextContent('Prime online');
        expect(payoffBurst).toHaveAttribute('data-payoff-lane-map', 'chain:1>cash:2>build:1>risk:1');
        expect(payoffBurst).toHaveAttribute(
            'data-payoff-lane-actions',
            'chain:Protect chain:1>cash:Cash reward:2>build:Build route:1>risk:Reduce risk:1'
        );
        expect(screen.getByTestId('game-over-payoff-lane-map')).toHaveAttribute(
            'data-payoff-lane-map',
            'chain:1>cash:2>build:1>risk:1'
        );
        expect(screen.getByTestId('game-over-payoff-lane-map')).toHaveAttribute(
            'data-payoff-lane-actions',
            'chain:Protect chain:1>cash:Cash reward:2>build:Build route:1>risk:Reduce risk:1'
        );
        expect(screen.getByTestId('game-over-payoff-lane-map')).toHaveAttribute('data-payoff-primary-lane', 'chain');
        expect(screen.getByTestId('game-over-payoff-lane-map')).toHaveAttribute(
            'data-payoff-primary-lane-action',
            'Protect chain'
        );
        expect(screen.getByTestId('game-over-payoff-lane-map')).toHaveAttribute(
            'data-payoff-primary-lane-audio',
            'run-payoff-lane-chain'
        );
        expect(screen.getByTestId('game-over-payoff-lane-map')).toHaveAttribute('data-payoff-primary-lane-beats', '4');
        expect(screen.getByTestId('game-over-payoff-lane-map')).toHaveAttribute(
            'data-payoff-primary-lane-cue',
            'Chain cashout'
        );
        expect(screen.getByTestId('game-over-payoff-lane-map')).toHaveAttribute(
            'data-payoff-primary-lane-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('game-over-primary-payoff-lane')).toHaveAccessibleName(
            'Primary run payoff lane. Chain: Protect chain. Chain cashout. 4 beats.'
        );
        expect(screen.getByTestId('game-over-primary-payoff-lane')).toHaveAttribute('data-payoff-primary-lane', 'chain');
        expect(screen.getByTestId('game-over-primary-payoff-lane')).toHaveAttribute(
            'data-payoff-primary-lane-action',
            'Protect chain'
        );
        expect(screen.getByTestId('game-over-primary-payoff-lane')).toHaveAttribute(
            'data-payoff-primary-lane-audio',
            'run-payoff-lane-chain'
        );
        expect(screen.getByTestId('game-over-primary-payoff-lane')).toHaveAttribute('data-payoff-primary-lane-beats', '4');
        expect(screen.getByTestId('game-over-primary-payoff-lane')).toHaveAttribute(
            'data-payoff-primary-lane-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('game-over-primary-payoff-lane')).toHaveTextContent('Top chase');
        expect(screen.getByTestId('game-over-primary-payoff-lane')).toHaveTextContent('Protect chain');
        expect(screen.getByTestId('game-over-primary-payoff-lane').querySelectorAll('[data-payoff-primary-lane-beat]')).toHaveLength(4);
        expect(
            screen.getByTestId('game-over-primary-payoff-lane').querySelector('[data-payoff-primary-lane-beat="1"]')
        ).toHaveAttribute('data-payoff-primary-lane-beat-focus', 'primary');
        expect(screen.getByTestId('game-over-payoff-lane-map')).toHaveTextContent('Cash reward');
        expect(screen.getByTestId('game-over-payoff-lane-map')).toHaveTextContent('Reduce risk');
        expect(screen.getByTestId('game-over-payoff-lane-map')).toHaveTextContent('Risk');
        expect(screen.getByTestId('game-over-payoff-lane-map')).toHaveAccessibleName(
            'Run payoff lanes. Chain: 1. Protect chain. Chain cashout. Cash: 2. Cash reward. Route cashout. Build: 1. Build route. Perk online. Risk: 1. Reduce risk. Left value.'
        );
        const laneMap = screen.getByTestId('game-over-payoff-lane-map');
        const cashLane = laneMap.querySelector('[data-payoff-lane="cash"]');
        const riskLane = laneMap.querySelector('[data-payoff-lane="risk"]');
        expect(cashLane).toHaveAttribute('data-payoff-lane-action', 'Cash reward');
        expect(cashLane).toHaveAttribute('data-payoff-lane-beats', '4');
        expect(cashLane?.querySelectorAll('[data-payoff-lane-beat]')).toHaveLength(4);
        expect(cashLane?.querySelector('[data-payoff-lane-beat="1"]')).toHaveAttribute(
            'data-payoff-lane-beat-focus',
            'primary'
        );
        expect(riskLane).toHaveAttribute('data-payoff-lane-action', 'Reduce risk');
        expect(riskLane).toHaveAttribute('data-payoff-lane-beats', '2');
        expect(riskLane?.querySelectorAll('[data-payoff-lane-beat]')).toHaveLength(2);
        expect(screen.getByTestId('game-over-payoff-burst-stack')).toHaveTextContent('Super stack');
        expect(screen.getByTestId('game-over-payoff-burst-stack')).toHaveTextContent('Rebuild super stack');
        expect(screen.getByTestId('game-over-payoff-burst-stack')).toHaveTextContent('5 payoffs');
        expect(screen.getByTestId('game-over-payoff-burst-stack')).toHaveAttribute(
            'data-payoff-burst-stack-action',
            'Rebuild super stack'
        );
        expect(screen.getByTestId('game-over-payoff-burst-stack')).toHaveAttribute(
            'data-payoff-burst-stack-tone',
            'super'
        );
        expect(screen.getByTestId('game-over-payoff-burst-stack')).toHaveAccessibleName(
            'Run payoff stack. Super stack: Rebuild super stack. 5 payoffs.'
        );
        const payoffCrescendo = screen.getByTestId('game-over-payoff-crescendo');
        expect(payoffCrescendo).toHaveTextContent('Super burst');
        expect(payoffCrescendo).toHaveTextContent('Archive this route as a full payoff stack to rebuild next run');
        expect(payoffCrescendo.querySelectorAll('i')).toHaveLength(5);
        expect(payoffCrescendo.querySelector('[data-payoff-crescendo-beat="1"]')).toHaveAttribute(
            'data-payoff-crescendo-beat-focus',
            'primary'
        );
        expect(payoffCrescendo).toHaveAttribute('data-payoff-crescendo-audio', 'super-burst');
        expect(payoffCrescendo).toHaveAttribute('data-payoff-crescendo-beats', '5');
        expect(payoffCrescendo).toHaveAttribute('data-payoff-crescendo-cue', 'super');
        expect(payoffCrescendo).toHaveAttribute('data-payoff-crescendo-tier', 'super');
        expect(payoffCrescendo).toHaveAccessibleName(
            'Run payoff crescendo. Super burst: Archive this route as a full payoff stack to rebuild next run. 5 beats.'
        );
        expect(screen.getByTestId('game-over-payoff-sequence')).toHaveTextContent('First');
        expect(screen.getByTestId('game-over-payoff-sequence')).toHaveTextContent('Route cashout: +1 combo shard');
        expect(screen.getByTestId('game-over-payoff-sequence')).toHaveTextContent('Then');
        expect(screen.getByTestId('game-over-payoff-sequence')).toHaveTextContent('Claim visible rewards before leaving');
        expect(screen.getByTestId('game-over-payoff-sequence')).toHaveTextContent('Keep');
        expect(screen.getByTestId('game-over-payoff-sequence')).toHaveTextContent('Draft and shop around these payoff routes');
        expect(screen.getByTestId('game-over-payoff-sequence')).toHaveAttribute(
            'data-payoff-sequence-first',
            'Route cashout: +1 combo shard'
        );
        expect(screen.getByTestId('game-over-payoff-sequence')).toHaveAttribute(
            'data-payoff-sequence-then',
            'Claim visible rewards before leaving'
        );
        expect(screen.getByTestId('game-over-payoff-sequence')).toHaveAttribute(
            'data-payoff-sequence-keep',
            'Draft and shop around these payoff routes'
        );
        expect(screen.getByTestId('game-over-payoff-sequence')).toHaveAttribute('data-payoff-sequence-tone', 'super');
        expect(screen.getByTestId('game-over-payoff-sequence')).toHaveAccessibleName(
            'Run payoff sequence. First: Route cashout: +1 combo shard. Then: Claim visible rewards before leaving. Keep: Draft and shop around these payoff routes.'
        );
        expect(payoffBurst.querySelector('[data-payoff-burst-tone="chain"]')).toHaveTextContent('x7');
        expect(payoffBurst.querySelector('[data-payoff-burst-tone="chain"]')).toHaveTextContent(
            'Repeat the cashout, then push the next reward threshold'
        );
        const chainBurst = payoffBurst.querySelector('[data-payoff-burst-tone="chain"]');
        const rewardBurst = payoffBurst.querySelector('[data-payoff-burst-tone="reward"]');
        const riskBurst = payoffBurst.querySelector('[data-payoff-burst-tone="risk"]');
        expect(chainBurst).toHaveAttribute('data-payoff-burst-beats', '4');
        expect(chainBurst).toHaveAttribute('data-payoff-burst-action', 'Protect chain');
        expect(chainBurst).toHaveAttribute('data-payoff-burst-audio', 'run-payoff-chain');
        expect(chainBurst).toHaveAttribute('data-payoff-burst-screen-cue', 'snap');
        expect(chainBurst).toHaveTextContent('Protect chain');
        expect(chainBurst?.querySelectorAll('[data-payoff-burst-beat]')).toHaveLength(4);
        expect(chainBurst?.querySelector('[data-payoff-burst-beat="1"]')).toHaveAttribute(
            'data-payoff-burst-beat-focus',
            'primary'
        );
        expect(rewardBurst).toHaveTextContent('Route paid');
        expect(rewardBurst).toHaveAttribute('data-payoff-burst-beats', '4');
        expect(rewardBurst).toHaveAttribute('data-payoff-burst-action', 'Cash reward');
        expect(rewardBurst).toHaveAttribute('data-payoff-burst-audio', 'run-payoff-cashout');
        expect(rewardBurst).toHaveAttribute('data-payoff-burst-screen-cue', 'burst');
        expect(rewardBurst?.querySelectorAll('[data-payoff-burst-beat]')).toHaveLength(4);
        expect(riskBurst).toHaveAttribute('data-payoff-burst-beats', '3');
        expect(riskBurst).toHaveAttribute('data-payoff-burst-action', 'Claim pickups');
        expect(riskBurst).toHaveAttribute('data-payoff-burst-audio', 'run-payoff-pickup');
        expect(riskBurst).toHaveAttribute('data-payoff-burst-screen-cue', 'guard');
        expect(riskBurst?.querySelectorAll('[data-payoff-burst-beat]')).toHaveLength(3);
        expect(payoffBurst.querySelector('[data-payoff-burst-tone="build"]')).toHaveTextContent('Prime online');
        expect(payoffBurst.getAttribute('aria-label')).toContain(
            'Run payoff burst. Route cashout: Route paid: +1 combo shard. Next: Keep feeding the route that paid out.'
        );
        expect(payoffBurst.getAttribute('aria-label')).toContain(
            'Chain cashout: Chain cashout: x7. Next: Repeat the cashout, then push the next reward threshold.'
        );

        const recap = screen.getByTestId('game-over-momentum-recap');
        expect(recap).toHaveTextContent('Chain engine');
        expect(recap).toHaveTextContent('Reward thresholds were in reach.');
        expect(recap).toHaveTextContent('Reward grabs');
        expect(recap).toHaveTextContent('2/3');
        expect(recap).toHaveTextContent('Build engines');
        expect(recap).toHaveTextContent('1 relics / 1 perks');
        expect(recap).toHaveTextContent('Trait route paid: +1 combo shard.');
        expect(recap).toHaveTextContent('Perk next: Keep the clean chain alive; cash a trait match at x3+ for a tool.');
        expect(recap).toHaveTextContent('Pressure read');
        expect(recap).toHaveTextContent('4 signals');
        expect(recap).toHaveTextContent('Next focus');
        expect(recap).toHaveTextContent('Claim pickups');
        expect(recap).toHaveTextContent('Prioritize visible reward pairs before the floor ends.');
        expect(recap.querySelector('[data-momentum-recap-tone="chain"]')).toHaveTextContent('x7');
        expect(recap.querySelector('[data-momentum-recap-tone="build"]')).toHaveTextContent('Trait route paid');
        expect(recap.getAttribute('aria-label')).toContain(
            'Game over momentum recap. Chain engine: x7: Reward thresholds were in reach.'
        );
        expect(recap.getAttribute('aria-label')).toContain(
            'Build engines: 1 relics / 1 perks: Trait route paid: +1 combo shard. Perk next: Keep the clean chain alive; cash a trait match at x3+ for a tool.'
        );
        expect(recap.getAttribute('aria-label')).toContain(
            'Next focus: Claim pickups: Prioritize visible reward pairs before the floor ends.'
        );
    });

    it('normalizes malformed archived run arrays before rendering summary feedback', () => {
        const run = gameOverRunFixture();
        const malformedRun: RunState = {
            ...run,
            findablesClaimedThisFloor: Number.NaN,
            findablesTotalThisFloor: Number.POSITIVE_INFINITY,
            flipHistory: Number.NaN as unknown as RunState['flipHistory'],
            rewardPerkIds: Number.NaN as unknown as RunState['rewardPerkIds'],
            stats: {
                ...run.stats,
                mismatches: Number.NaN,
                volatileTraitShuffles: Number.POSITIVE_INFINITY
            },
            lastRunSummary: run.lastRunSummary
                ? {
                      ...run.lastRunSummary,
                      activeMutators: Number.NaN as unknown as NonNullable<RunState['lastRunSummary']>['activeMutators'],
                      bestScore: Number.POSITIVE_INFINITY,
                      bestStreak: Number.NaN,
                      highestLevel: Number.POSITIVE_INFINITY,
                      levelsCleared: Number.NaN,
                      perfectClears: Number.NEGATIVE_INFINITY,
                      relicIds: Number.NaN as unknown as NonNullable<RunState['lastRunSummary']>['relicIds'],
                      totalScore: Number.NaN
                  }
                : null
        };

        render(<GameOverScreen run={malformedRun} />);

        expect(screen.getByLabelText('Run summary announcement')).toHaveTextContent(
            'Expedition complete. Final score 0. Highest floor 0.'
        );
        expect(screen.getByTestId('game-over-above-fold-summary')).toHaveTextContent(
            '0 scoreFloor 0 / 0 clears / 0 streak'
        );
        expect(screen.getByLabelText('Total score 0')).toHaveTextContent('0');
        expect(screen.getByText('Floor 0 reached before the archive sealed - details below.')).toBeInTheDocument();
        const signals = screen.getByTestId('game-over-outcome-signals');
        expect(signals).toHaveTextContent('Score0Best chainx0Perfect clears0');
        expect(signals).not.toHaveTextContent(/NaN|Infinity/);
        expect(signals.querySelector('[data-outcome-signal="build"]')).toBeNull();
        expect(signals.querySelector('[data-outcome-signal="pressure"]')).toBeNull();
        expect(screen.getByTestId('game-over-momentum-recap')).toHaveTextContent('0 relics / 0 perks');
        expect(screen.getByTestId('game-over-momentum-recap')).not.toHaveTextContent(/NaN|Infinity/);
        expect(screen.queryByTestId('game-over-detail-drawer')).not.toBeInTheDocument();
        expect(screen.getByText('No flip history stored for this run.')).toBeInTheDocument();
    });

    it('PPI-006 preserves contract mode identity in game-over summary', () => {
        const run = gameOverRunFixture();
        const scholarRun: RunState = {
            ...run,
            activeContract: {
                noShuffle: true,
                noDestroy: false,
                maxMismatches: null,
                bonusRelicDraftPick: true
            },
            lastRunSummary: run.lastRunSummary
                ? {
                      ...run.lastRunSummary,
                      activeContract: {
                          noShuffle: true,
                          noDestroy: false,
                          maxMismatches: null,
                          bonusRelicDraftPick: true
                      }
                  }
                : null
        };

        render(<GameOverScreen run={scholarRun} />);

        expect(screen.getByTestId('game-over-mode-heading')).toHaveTextContent(/Scholar contract/i);
        expect(screen.getByTestId('game-over-mode-identity')).toHaveTextContent(/no full-board shuffle/i);
        expect(screen.getByTestId('game-over-next-run-loop')).toHaveTextContent(/Scholar Contract/i);
    });
});
