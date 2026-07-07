import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MAX_COMBO_SHARDS, MAX_LIVES } from '../../shared/contracts';
import type { FloorArchetypeId, FeaturedObjectiveId, RunState } from '../../shared/contracts';
import { BUILTIN_PUZZLES } from '../../shared/builtin-puzzles';
import { createDailyRun, createDungeonShowcaseRun, createNewRun, createPuzzleRun, finishMemorizePhase } from '../../shared/game-core';
import GameplayHudBar from './GameplayHudBar';

describe('GameplayHudBar', () => {
    it('shows endless archetype, featured objective, and favor progress on scheduled endless floors', () => {
        const run = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false })),
            relicFavorProgress: 2,
            featuredObjectiveStreak: 3,
            endlessRiskWager: {
                acceptedOnLevel: 0,
                targetLevel: 1,
                streakAtRisk: 3,
                bonusFavorOnSuccess: 2
            }
        };

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={run}
            />
        );

        expect(screen.getByTestId('hud-wing-right')).toHaveTextContent('Classic Dungeon');
        expect(screen.getByTestId('hud-endless-archetype').textContent).toContain('Dungeon Gate');
        expect(screen.getByTestId('hud-chapter-act').textContent).toContain('Act I');
        expect(screen.getByTestId('hud-chapter-act').textContent).toContain('Lantern Academy');
        expect(screen.getByTestId('hud-chapter-act').getAttribute('title')).toContain('Readable halls');
        expect(screen.getByTestId('hud-endless-archetype').getAttribute('title')).toContain('Act I');
        expect(screen.getByTestId('hud-endless-archetype').getAttribute('title')).toContain('Lantern Academy');
        const objectivePill = screen.getByTestId('hud-featured-objective');
        expect(objectivePill.textContent).toContain('Flip par');
        expect(objectivePill.getAttribute('title')).toMatch(/match resolutions/i);
        expect(screen.getByTestId('hud-objective-signals')).toHaveTextContent('Target');
        expect(screen.getByTestId('hud-objective-signals')).toHaveTextContent('Flip par');
        expect(screen.getByTestId('hud-objective-signals')).toHaveTextContent('Favor');
        expect(screen.getByTestId('hud-objective-signals')).toHaveTextContent('2/3');
        expect(screen.getByTestId('hud-objective-signals')).toHaveTextContent('Wager');
        expect(screen.getByTestId('hud-objective-signals')).toHaveTextContent('+2 Favor');
        expect(screen.getByTestId('hud-objective-signals')).toHaveTextContent('Risk');
        expect(screen.getByTestId('hud-objective-signals')).toHaveTextContent('x3');
        expect(screen.getByTestId('hud-objective-signals')).toHaveAttribute(
            'aria-label',
            'Objective reward signals. Target: Flip par. Favor: 2/3. Wager: +2 Favor. Risk: x3.'
        );
        expect(
            screen.getByTestId('hud-objective-signals').querySelector('[data-objective-signal-tone="objective"]')
        ).toHaveAttribute('data-objective-signal-beats', '3');
        expect(
            screen.getByTestId('hud-objective-signals').querySelector('[data-objective-signal-tone="objective"]')
        ).toHaveAttribute('data-objective-signal-action', 'Chase target');
        expect(
            screen.getByTestId('hud-objective-signals').querySelector('[data-objective-signal-tone="objective"]')
        ).toHaveAttribute('data-objective-signal-audio', 'objective-target');
        expect(
            screen
                .getByTestId('hud-objective-signals')
                .querySelector('[data-objective-signal-tone="objective"]')
                ?.querySelectorAll('[data-objective-signal-beat]')
        ).toHaveLength(3);
        expect(
            screen.getByTestId('hud-objective-signals').querySelector('[data-objective-signal-tone="progress"]')
        ).toHaveAttribute('data-objective-signal-beats', '3');
        expect(
            screen.getByTestId('hud-objective-signals').querySelector('[data-objective-signal-tone="progress"]')
        ).toHaveAttribute('data-objective-signal-screen-cue', 'pulse');
        expect(
            screen.getByTestId('hud-objective-signals').querySelector('[data-objective-signal-tone="reward"]')
        ).toHaveAttribute('data-objective-signal-beats', '4');
        expect(
            screen.getByTestId('hud-objective-signals').querySelector('[data-objective-signal-tone="reward"]')
        ).toHaveAttribute('data-objective-signal-action', 'Cash wager');
        expect(
            screen.getByTestId('hud-objective-signals').querySelector('[data-objective-signal-tone="reward"]')
        ).toHaveAttribute('data-objective-signal-screen-cue', 'burst');
        expect(
            screen
                .getByTestId('hud-objective-signals')
                .querySelector('[data-objective-signal-tone="reward"]')
                ?.querySelectorAll('[data-objective-signal-beat]')
        ).toHaveLength(4);
        expect(screen.getByTestId('hud-objective-signals').querySelector('[data-objective-signal-tone="risk"]')).toHaveAttribute(
            'data-objective-signal-beats',
            '2'
        );
        expect(screen.getByTestId('hud-objective-signals').querySelector('[data-objective-signal-tone="risk"]')).toHaveAttribute(
            'data-objective-signal-action',
            'Protect streak'
        );
        expect(screen.getByTestId('hud-objective-signals').querySelector('[data-objective-signal-tone="risk"]')).toHaveAttribute(
            'data-objective-signal-screen-cue',
            'guard'
        );
        expect(screen.getByTestId('hud-favor-progress').textContent).toContain('2/3');
        expect(screen.getByTestId('hud-favor-progress').textContent).toContain('1 more for a relic pick');
        expect(screen.getByTestId('hud-favor-progress').getAttribute('title')).toContain('Temporary run currency');
        expect(screen.getByTestId('hud-featured-streak').textContent).toContain('x3');
        expect(screen.getByTestId('hud-featured-streak').textContent).toContain('Consecutive featured clears');
        expect(screen.getByTestId('hud-endless-risk-wager').textContent).toContain('+2 Favor');
        expect(screen.getByTestId('hud-endless-risk-wager')).toHaveAttribute('data-hud-risk-wager-action', 'Protect streak');
        expect(screen.getByTestId('hud-endless-risk-wager')).toHaveAttribute('data-hud-risk-wager-audio', 'risk-wager-armed');
        expect(screen.getByTestId('hud-endless-risk-wager')).toHaveAttribute('data-hud-risk-wager-beats', '4');
        expect(screen.getByTestId('hud-endless-risk-wager')).toHaveAttribute('data-hud-risk-wager-favor', '2');
        expect(screen.getByTestId('hud-endless-risk-wager')).toHaveAttribute('data-hud-risk-wager-risk', 'x3');
        expect(screen.getByTestId('hud-endless-risk-wager')).toHaveAttribute('data-hud-risk-wager-screen-cue', 'risk');
        expect(screen.getByTestId('hud-endless-risk-wager')).toHaveAccessibleName(
            'Active risk wager. Protect streak. +2 Favor. x3 streak at risk. 4 beats.'
        );
        expect(screen.getByTestId('hud-endless-risk-wager')).toHaveTextContent('Protect streak');
        expect(screen.getByTestId('hud-endless-risk-wager').querySelectorAll('[data-hud-risk-wager-beat]')).toHaveLength(4);
        expect(screen.getByTestId('hud-secondary-stat-drawer')).toHaveTextContent('More');
        expect(screen.getByTestId('hud-wing-right').querySelector('[data-hud-priority="secondary"]')).toBeTruthy();
        expect(screen.getByTestId('hud-secondary-stat-drawer').querySelector('[data-hud-priority="tertiary"]')).toBeTruthy();
    });

    it('shows boss encounter identity on boss-tagged floors', () => {
        const baseRun = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
        const run: RunState = {
            ...baseRun,
            gameMode: 'endless' as const,
            board: {
                ...baseRun.board!,
                dungeonBossId: 'rush_sentinel',
                floorTag: 'boss' as const,
                floorArchetypeId: 'rush_recall' as FloorArchetypeId,
                featuredObjectiveId: 'flip_par' as FeaturedObjectiveId
            },
            activeMutators: ['short_memorize' as const, 'wide_recall' as const]
        };

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={run}
            />
        );

        expect(screen.getByTestId('hud-encounter-identity').textContent).toContain('Boss');
        expect(screen.getByTestId('hud-encounter-identity').getAttribute('title')).toContain('Boss pressure');
        expect(screen.getByTestId('hud-encounter-identity').getAttribute('title')).toContain('Keystone Pair route anchor');
        expect(screen.getByTestId('hud-encounter-identity').getAttribute('title')).toContain('Counter: Row/swap charge');
        expect(screen.getByTestId('hud-floor-identity-reminder')).toHaveTextContent('Boss trophy - Counter: Row/swap charge');
        expect(screen.getByTestId('hud-floor-identity-reminder').getAttribute('title')).toContain('Rush Sentinel shortens study time');
    });

    it('does not show favor UI on non-endless runs', () => {
        const run = finishMemorizePhase(createDailyRun(0, { echoFeedbackEnabled: false }));

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={run}
            />
        );

        expect(screen.queryByTestId('hud-endless-archetype')).toBeNull();
        expect(screen.queryByTestId('hud-featured-objective')).toBeNull();
        expect(screen.queryByTestId('hud-favor-progress')).toBeNull();
        expect(screen.queryByTestId('hud-featured-streak')).toBeNull();
        expect(screen.queryByTestId('hud-endless-risk-wager')).toBeNull();
    });

    it('surfaces stable started-mode identity for contract and puzzle variants', () => {
        const starterPuzzle = BUILTIN_PUZZLES.starter_pairs!;
        const cases: Array<{ expected: RegExp | string; run: RunState }> = [
            {
                expected: 'Dungeon Showcase',
                run: createDungeonShowcaseRun(0, { echoFeedbackEnabled: false })
            },
            {
                expected: /Puzzle: Starter 2.2/,
                run: createPuzzleRun(0, starterPuzzle.id, starterPuzzle.tiles, 1, { echoFeedbackEnabled: false })
            },
            {
                expected: 'Practice',
                run: createNewRun(0, { echoFeedbackEnabled: false, practiceMode: true })
            },
            {
                expected: 'Pin vow',
                run: createNewRun(0, {
                    activeContract: { noShuffle: false, noDestroy: false, maxMismatches: null, maxPinsTotalRun: 10 },
                    echoFeedbackEnabled: false
                })
            }
        ];

        const { unmount } = render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={cases[0]!.run}
            />
        );
        expect(screen.getByTestId('hud-mode-identity')).toHaveTextContent(cases[0]!.expected);
        unmount();

        for (const { expected, run } of cases.slice(1)) {
            const rendered = render(
                <GameplayHudBar
                    cameraViewportMode={false}
                    gauntletRemainingMs={null}
                    politeHudAnnouncement=""
                    run={run}
                />
            );
            expect(screen.getByTestId('hud-mode-identity')).toHaveTextContent(expected);
            rendered.unmount();
        }
    });

    it('shows shuffle, destroy, peek economy on memorize and playing', () => {
        const run = finishMemorizePhase(createDailyRun(0, { echoFeedbackEnabled: false }));

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={run}
            />
        );

        expect(screen.getByTestId('hud-shuffle-charges').textContent).toContain('Shuffle');
        expect(screen.getByTestId('hud-destroy-charges').textContent).toContain('Destroy');
        expect(screen.getByTestId('hud-peek-charges').textContent).toContain('Peek');
        expect(screen.getByTestId('hud-shuffle-charges')).toHaveTextContent('Reshuffles hidden board order');
        expect(screen.getByTestId('hud-destroy-charges')).toHaveTextContent('Forfeits pickups on that pair');
        expect(screen.getByTestId('hud-peek-charges')).toHaveTextContent('Brief reveal only');
        expect(screen.getByTestId('hud-shuffle-charges').getAttribute('title')).toContain('Search');
        expect(screen.getByTestId('hud-destroy-charges').getAttribute('title')).toContain('Damage control');
        expect(screen.getByTestId('hud-peek-charges').getAttribute('title')).toContain('Recall');
        expect(screen.getByTestId('hud-difficulty-profile')).toHaveTextContent('Standard');
        expect(screen.getByTestId('hud-combo-shards').getAttribute('title')).toContain('Temporary run currency');
        expect(screen.getByTestId('hud-combo-shards').getAttribute('title')).toContain('Guard tokens absorb mismatch damage');
        expect(screen.getByTestId('hud-secondary-stat-drawer')).toHaveTextContent('Difficulty');
    });

    it('keeps pair progress visible in the HUD context rail', () => {
        const baseRun = finishMemorizePhase(createDailyRun(0, { echoFeedbackEnabled: false }));
        const run = {
            ...baseRun,
            board: {
                ...baseRun.board!,
                matchedPairs: 2,
                pairCount: 5
            }
        } as RunState;

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={run}
            />
        );

        expect(screen.getByTestId('hud-pair-progress')).toHaveTextContent('Pairs');
        expect(screen.getByTestId('hud-pair-progress')).toHaveTextContent('2/5');
        expect(screen.getByTestId('hud-pair-progress')).toHaveTextContent('3 pairs remain');
        expect(screen.getByTestId('hud-pair-progress').getAttribute('title')).toContain('3 pairs remain');
    });

    it('marks last-life health as critical in visible and accessible HUD copy', () => {
        const run = {
            ...finishMemorizePhase(createDailyRun(0, { echoFeedbackEnabled: false })),
            lives: 1
        } as RunState;

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={run}
            />
        );

        expect(screen.getByTestId('hud-lives')).toHaveAttribute('data-health', 'critical');
        expect(screen.getByTestId('hud-lives')).toHaveTextContent('Critical 1 / 5');
        expect(screen.getByLabelText(/Critical health; protect the last life/i)).toBeInTheDocument();
        expect(screen.getByTestId('hud-lives').getAttribute('title')).toContain('one more unguarded hit');
    });

    it('mirrors the latest live action in a compact visible HUD chip', () => {
        const run = finishMemorizePhase(createDailyRun(0, { echoFeedbackEnabled: false }));

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement="Match resolved. 4/6 pairs cleared. Recall focus 3/3."
                run={run}
            />
        );

        expect(screen.getByTestId('hud-recent-action')).toHaveTextContent('Action result');
        expect(screen.getByTestId('hud-recent-action')).toHaveTextContent('Match resolved');
        expect(screen.getByTestId('hud-recent-action')).toHaveAttribute('data-tone', 'info');
        expect(screen.getByTestId('hud-recent-action').getAttribute('aria-label')).toContain(
            'Action result: Match resolved'
        );
        expect(screen.getByTestId('hud-recent-action').getAttribute('title')).toContain('Recall focus 3/3');
    });

    it('uses arcade labels and tones for reward, trait, and chain action feedback', () => {
        const run = finishMemorizePhase(createDailyRun(0, { echoFeedbackEnabled: false }));
        const { rerender } = render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement="Shard spark claimed: +1 combo shard."
                run={run}
            />
        );

        expect(screen.getByTestId('hud-recent-action')).toHaveTextContent('Reward burst');
        expect(screen.getByTestId('hud-recent-action')).toHaveAttribute('data-tone', 'reward');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveTextContent('Reward cashout');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-impact-cue', 'Reward cashout');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-impact-screen-cue', 'burst');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-impact-beats', '3');
        expect(
            screen.getByTestId('hud-recent-action-impact').querySelector('[data-hud-action-impact-cue="Reward cashout"]')
        ).toHaveAttribute('data-hud-action-impact-beats', '3');
        expect(
            screen.getByTestId('hud-recent-action-impact').querySelector('[data-hud-action-impact-cue="Reward cashout"]')
        ).toHaveAttribute('data-hud-action-impact-screen-cue', 'burst');
        expect(screen.getByTestId('hud-recent-action').getAttribute('aria-label')).toContain(
            'Impact cue: Reward cashout.'
        );

        rerender(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement="Pickup cashout: Shard spark +1 combo shard."
                run={run}
            />
        );
        expect(screen.getByTestId('hud-recent-action')).toHaveTextContent('Reward burst');
        expect(screen.getByTestId('hud-recent-action')).toHaveAttribute('data-tone', 'reward');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveTextContent('Pickup cashout');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-impact-cue', 'Pickup cashout');
        expect(screen.getByTestId('hud-recent-action-impact').querySelector('[data-hud-action-impact-cue="Pickup cashout"]')).toHaveTextContent('Pickup cashout');

        rerender(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement="Cashout armed: x6 +1 shard."
                run={run}
            />
        );
        expect(screen.getByTestId('hud-recent-action')).toHaveTextContent('Cashout armed');
        expect(screen.getByTestId('hud-recent-action')).toHaveAttribute('data-tone', 'reward');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveTextContent('Cashout armed');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-impact-cue', 'Cashout armed');
        expect(
            [...screen.getByTestId('hud-recent-action-impact').querySelectorAll('[data-action-feedback-detail="reward"]')]
                .map((detail) => detail.textContent)
        ).toContain('Cashout armed');
        expect(screen.getByTestId('hud-recent-action').getAttribute('aria-label')).toContain(
            'Impact cue: Cashout armed.'
        );

        rerender(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement="Echo and Stasis trait resolved. 1 row/swap charge gained."
                run={run}
            />
        );
        expect(screen.getByTestId('hud-recent-action')).toHaveTextContent('Trait play');
        expect(screen.getByTestId('hud-recent-action')).toHaveAttribute('data-tone', 'trait');

        rerender(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement="Match resolved. 1/4 pairs cleared. Trait combo surge: Drift and Stasis resolved."
                run={run}
            />
        );
        expect(screen.getByTestId('hud-recent-action')).toHaveTextContent('Trait surge');
        expect(screen.getByTestId('hud-recent-action')).toHaveAttribute('data-tone', 'trait');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-impact-level', 'medium');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-burst-tier', 'trait');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-impact-cue', 'Trait surge');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-impact-screen-cue', 'burst');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-impact-beats', '3');
        expect(screen.getByTestId('hud-recent-action-impact').querySelector('[data-hud-action-impact-cue="Trait surge"]')).toHaveTextContent('Trait surge');
        expect(screen.getByTestId('hud-recent-action-impact').querySelector('[data-hud-action-impact-cue="Trait surge"]')).toHaveAttribute(
            'data-hud-action-impact-beats',
            '3'
        );
        expect(screen.getByTestId('hud-recent-action-impact').querySelector('[data-hud-action-impact-cue="Trait surge"]')).toHaveAttribute(
            'data-hud-action-impact-screen-cue',
            'burst'
        );
        expect(
            screen.getByTestId('hud-recent-action-impact').querySelector('[data-hud-action-impact-beat="1"]')
        ).toHaveAttribute('data-hud-action-impact-beat-focus', 'primary');
        expect(
            screen.getByTestId('hud-recent-action-impact').querySelector('[data-hud-action-impact-beat="2"]')
        ).toHaveAttribute('data-hud-action-impact-beat-focus', 'support');
        expect(screen.getByTestId('hud-recent-action-impact').querySelector('[data-action-feedback-detail="trait"]')).toHaveTextContent('Trait surge');

        rerender(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement="Trait combo surge: Echo and Stasis resolved. Combo shard gained. 1 available. 2 shop gold gained. Payoff stack: 4 payoffs cashed. Cash stack now."
                run={run}
            />
        );
        expect(screen.getByTestId('hud-recent-action')).toHaveTextContent('Payoff stack');
        expect(screen.getByTestId('hud-recent-action')).toHaveAttribute('data-tone', 'reward');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-impact-cue', 'Payoff stack');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-burst-tier', 'reward');
        expect(screen.getByTestId('hud-recent-action-impact').querySelector('[data-hud-action-impact-cue="Payoff stack"]')).toHaveTextContent('Payoff stack');

        rerender(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement="Chain times five - Shard spark claimed: +1 combo shard. Trait routes: 2/2 complete."
                run={run}
            />
        );
        expect(screen.getByTestId('hud-recent-action')).toHaveTextContent('Chain');
        expect(screen.getByTestId('hud-recent-action')).toHaveAttribute('data-tone', 'chain');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-impact-level', 'high');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-burst-tier', 'combo');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-impact-cue', 'Stack cashout');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-impact-screen-cue', 'burst');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-impact-beats', '4');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute(
            'data-lane-map',
            'cash:2>route:1>chain:1'
        );
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute(
            'data-lane-actions',
            'cash:Collect:2>route:Route next:1>chain:Keep streak:1'
        );
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveTextContent('Stack cashout');
        expect(
            screen.getByTestId('hud-recent-action-impact').querySelector('[data-hud-action-impact-cue="Stack cashout"]')
        ).toHaveAttribute('data-hud-action-impact-beats', '4');
        expect(
            screen.getByTestId('hud-recent-action-impact').querySelector('[data-hud-action-impact-cue="Stack cashout"]')
        ).toHaveAttribute('data-hud-action-impact-screen-cue', 'burst');
        expect(
            screen.getByTestId('hud-recent-action-impact').querySelectorAll('[data-hud-action-impact-beat]')
        ).toHaveLength(4);
        expect(
            screen.getByTestId('hud-recent-action-impact').querySelector('[data-hud-action-impact-beat="1"]')
        ).toHaveAttribute('data-hud-action-impact-beat-focus', 'primary');
        expect(screen.getByTestId('hud-recent-action-impact').querySelector('[data-hud-action-stack="combo"]')).toHaveTextContent('4x combo');
        expect(screen.getByTestId('hud-recent-action-impact').querySelector('[data-hud-action-stack="combo"]')).toHaveAttribute(
            'data-hud-action-stack-beats',
            '4'
        );
        expect(screen.getByTestId('hud-recent-action-impact').querySelectorAll('[data-hud-action-stack-beat]')).toHaveLength(4);
        expect(
            screen.getByTestId('hud-recent-action-impact').querySelector('[data-hud-action-stack-beat="1"]')
        ).toHaveAttribute('data-hud-action-stack-beat-focus', 'primary');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveTextContent('Chain x5');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveTextContent('Shard cashout');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveTextContent('Pickup');
        expect(screen.getByTestId('hud-recent-action-impact').querySelector('[data-action-feedback-detail="chain"]')).toHaveTextContent('Chain x5');
        expect(screen.getByTestId('hud-recent-action-impact').querySelector('[data-action-feedback-detail="reward"]')).toHaveTextContent('Shard cashout');
        expect(screen.getByTestId('hud-recent-action-lane-map')).toHaveAccessibleName(
            'Lane map. Cash: 2. Collect. Route: 1. Route next. Chain: 1. Keep streak.'
        );
        const recentActionLaneMapSummary = screen.getByTestId('hud-recent-action-lane-map-summary');
        expect(recentActionLaneMapSummary).toHaveTextContent('Lanes');
        expect(recentActionLaneMapSummary).toHaveTextContent('3 lanes');
        expect(recentActionLaneMapSummary.querySelectorAll('[data-hud-action-lane-map-summary-beat]')).toHaveLength(4);
        expect(
            recentActionLaneMapSummary.querySelector('[data-hud-action-lane-map-summary-beat="1"]')
        ).toHaveAttribute('data-hud-action-lane-map-summary-beat-focus', 'primary');
        expect(screen.getByTestId('hud-recent-action-lane-map')).toHaveAttribute(
            'data-hud-action-lane-map',
            'cash:2>route:1>chain:1'
        );
        expect(screen.getByTestId('hud-recent-action-lane-map')).toHaveAttribute(
            'data-hud-action-lane-actions',
            'cash:Collect:2>route:Route next:1>chain:Keep streak:1'
        );
        expect(screen.getByTestId('hud-recent-action-lane-map')).toHaveAttribute('data-hud-action-primary-lane', 'cash');
        expect(screen.getByTestId('hud-recent-action-lane-map')).toHaveAttribute(
            'data-hud-action-primary-lane-action',
            'Collect'
        );
        expect(screen.getByTestId('hud-recent-action-lane-map')).toHaveAttribute(
            'data-hud-action-primary-lane-audio',
            'hud-action-cash'
        );
        expect(screen.getByTestId('hud-recent-action-lane-map')).toHaveAttribute('data-hud-action-primary-lane-beats', '4');
        expect(screen.getByTestId('hud-recent-action-lane-map')).toHaveAttribute(
            'data-hud-action-primary-lane-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('hud-recent-action-primary-lane')).toHaveAccessibleName(
            'Primary recent action lane. Cash: Collect. 4 beats.'
        );
        expect(screen.getByTestId('hud-recent-action-primary-lane')).toHaveAttribute('data-hud-action-primary-lane', 'cash');
        expect(screen.getByTestId('hud-recent-action-primary-lane')).toHaveAttribute(
            'data-hud-action-primary-lane-action',
            'Collect'
        );
        expect(screen.getByTestId('hud-recent-action-primary-lane')).toHaveAttribute(
            'data-hud-action-primary-lane-audio',
            'hud-action-cash'
        );
        expect(screen.getByTestId('hud-recent-action-primary-lane')).toHaveAttribute(
            'data-hud-action-primary-lane-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('hud-recent-action-primary-lane')).toHaveTextContent('Next lane');
        expect(screen.getByTestId('hud-recent-action-primary-lane').querySelectorAll('[data-hud-action-primary-lane-beat]')).toHaveLength(4);
        expect(
            screen.getByTestId('hud-recent-action-primary-lane').querySelector('[data-hud-action-primary-lane-beat="1"]')
        ).toHaveAttribute('data-hud-action-primary-lane-beat-focus', 'primary');
        expect(
            screen.getByTestId('hud-recent-action-lane-map').querySelector('[data-hud-action-lane="cash"]')
        ).toHaveTextContent('Cash');
        expect(
            screen.getByTestId('hud-recent-action-lane-map').querySelector('[data-hud-action-lane="cash"]')
        ).toHaveAttribute('data-hud-action-lane-action', 'Collect');
        expect(
            screen.getByTestId('hud-recent-action-lane-map').querySelector('[data-hud-action-lane="cash"]')
        ).toHaveAttribute('data-hud-action-lane-focus', 'primary');
        expect(
            screen.getByTestId('hud-recent-action-lane-map').querySelector('[data-hud-action-lane="cash"]')
        ).toHaveAttribute('data-hud-action-lane-beats', '4');
        expect(
            screen
                .getByTestId('hud-recent-action-lane-map')
                .querySelector('[data-hud-action-lane="cash"]')
                ?.querySelectorAll('[data-hud-action-lane-beat]')
        ).toHaveLength(4);
        expect(
            screen
                .getByTestId('hud-recent-action-lane-map')
                .querySelector('[data-hud-action-lane="cash"]')
                ?.querySelector('[data-hud-action-lane-beat="1"]')
        ).toHaveAttribute('data-hud-action-lane-beat-focus', 'primary');
        expect(
            screen.getByTestId('hud-recent-action-lane-map').querySelector('[data-hud-action-lane="route"]')
        ).toHaveTextContent('Route next');
        expect(
            screen.getByTestId('hud-recent-action-lane-map').querySelector('[data-hud-action-lane="route"]')
        ).toHaveAttribute('data-hud-action-lane-action', 'Route next');
        expect(
            screen.getByTestId('hud-recent-action-lane-map').querySelector('[data-hud-action-lane="route"]')
        ).toHaveAttribute('data-hud-action-lane-focus', 'support');
        expect(
            screen.getByTestId('hud-recent-action-lane-map').querySelector('[data-hud-action-lane="chain"]')
        ).toHaveTextContent('Keep streak');
        expect(
            screen.getByTestId('hud-recent-action-lane-map').querySelector('[data-hud-action-lane="chain"]')
        ).toHaveAttribute('data-hud-action-lane-action', 'Keep streak');
        expect(screen.getByTestId('hud-recent-action-stack-summary')).toHaveAttribute(
            'data-hud-action-stack-summary',
            'combo'
        );
        expect(screen.getByTestId('hud-recent-action-stack-summary')).toHaveAttribute(
            'data-hud-action-stack-action',
            'Cash now'
        );
        expect(screen.getByTestId('hud-recent-action-stack-summary')).toHaveAttribute(
            'data-hud-action-stack-tone',
            'cashout'
        );
        expect(screen.getByTestId('hud-recent-action-stack-summary')).toHaveAttribute(
            'data-hud-action-stack-first',
            'First: cash out safest payoff'
        );
        expect(screen.getByTestId('hud-recent-action-stack-summary')).toHaveAttribute(
            'data-hud-action-stack-then',
            'Then: route the chained payoff'
        );
        expect(screen.getByTestId('hud-recent-action-stack-summary')).toHaveAttribute(
            'data-hud-action-stack-keep',
            'Keep: stack before spending'
        );
        expect(screen.getByTestId('hud-recent-action-stack-summary')).toHaveTextContent(
            'Stack cashout: Cash now Chain x5 + Shard cashout + Pickup + Route paid'
        );
        expect(screen.getByTestId('hud-recent-action-stack-summary')).toHaveTextContent(
            'First: cash out safest payoff'
        );
        expect(screen.getByTestId('hud-recent-action-stack-summary')).toHaveTextContent(
            'Then: route the chained payoff'
        );
        expect(screen.getByTestId('hud-recent-action-stack-summary')).toHaveTextContent(
            'Keep: stack before spending'
        );
        expect(screen.getByTestId('hud-recent-action').getAttribute('aria-label')).toContain(
            'Impact cue: Stack cashout.'
        );
        expect(screen.getByTestId('hud-recent-action').getAttribute('aria-label')).toContain(
            'Impact: Chain x5, Shard cashout, Pickup'
        );
        expect(screen.getByTestId('hud-recent-action').getAttribute('aria-label')).toContain('Stack: 4x combo.');
        expect(screen.getByTestId('hud-recent-action').getAttribute('aria-label')).toContain(
            'Lane map. Cash: 2. Collect. Route: 1. Route next. Chain: 1. Keep streak.'
        );
        expect(screen.getByTestId('hud-recent-action').getAttribute('aria-label')).toContain(
            'Stack cashout: Cash now. Chain x5 + Shard cashout + Pickup + Route paid. First: cash out safest payoff.'
        );
        expect(screen.getByTestId('hud-recent-action').getAttribute('aria-label')).toContain(
            'Then: route the chained payoff. Keep: stack before spending.'
        );

        rerender(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement="Cascade: combo cascade. Stack cashout: 3 payoffs: Route + Pickup + Chain. Shard spark +1 combo shard."
                run={run}
            />
        );
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-burst-tier', 'combo');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-impact-cue', 'Stack cashout');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveTextContent('Stack cashout');
        expect(
            screen.getByTestId('hud-recent-action-impact').querySelector('[data-hud-action-impact-cue="Stack cashout"]')
        ).toHaveTextContent('Stack cashout');
        expect(screen.getByTestId('hud-recent-action').getAttribute('aria-label')).toContain(
            'Impact cue: Stack cashout.'
        );

        rerender(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement="Cascade: combo cascade. Super stack: Cash super stack: 4-way payoff. Super stack: 4 payoffs: Route + Pickup + Trait + Chain."
                run={run}
            />
        );
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-burst-tier', 'combo');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-impact-cue', 'Super stack');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveTextContent('Super stack');
        expect(screen.getByTestId('hud-recent-action-stack-summary')).toHaveTextContent(
            'Super stack: Cash super stack'
        );
        expect(screen.getByTestId('hud-recent-action-stack-summary')).toHaveAttribute(
            'data-hud-action-stack-action',
            'Cash super stack'
        );
        expect(screen.getByTestId('hud-recent-action-stack-summary')).toHaveAttribute(
            'data-hud-action-stack-first',
            'First: cash the super stack'
        );
        expect(screen.getByTestId('hud-recent-action').getAttribute('aria-label')).toContain(
            'Impact cue: Super stack.'
        );

        rerender(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement="Surge hit: x6. Surge tier live. Next reward: Combo prime: x8 +1 shard in 2 matches."
                run={run}
            />
        );
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-burst-tier', 'combo');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-impact-cue', 'Prime cashout');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveTextContent('Prime cashout');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveTextContent('Shard setup');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveTextContent('Combo prime');
        expect(
            screen.getByTestId('hud-recent-action-impact').querySelector('[data-hud-action-impact-cue="Prime cashout"]')
        ).toHaveTextContent('Prime cashout');
        expect(screen.getByTestId('hud-recent-action').getAttribute('aria-label')).toContain(
            'Impact cue: Prime cashout.'
        );

        rerender(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement="No match. Chain x6 broken. Lost reward target: x8 +1 shard in 2 matches. Next chase: Break into x10. Recover with a safe match."
                run={run}
            />
        );
        expect(screen.getByTestId('hud-recent-action')).toHaveTextContent('Chain break');
        expect(screen.getByTestId('hud-recent-action')).toHaveAttribute('data-tone', 'danger');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-impact-level', 'high');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-burst-tier', 'risk');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-impact-cue', 'Recovery lane');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveAttribute('data-impact-screen-cue', 'recover');
        expect(screen.getByTestId('hud-recent-action-impact')).toHaveTextContent('Recovery lane');
        expect(
            screen.getByTestId('hud-recent-action-impact').querySelector('[data-hud-action-impact-cue="Recovery lane"]')
        ).toHaveAttribute('data-hud-action-impact-screen-cue', 'recover');
        expect(screen.getByTestId('hud-recent-action-impact').querySelector('[data-hud-action-stack="risk"]')).toHaveTextContent('4x risk');
        expect(screen.getByTestId('hud-recent-action-stack-summary')).toHaveTextContent(
            'Risk stack: Recover Chain x6 + Chain break + Lost reward + Next chase'
        );
        expect(screen.getByTestId('hud-recent-action-stack-summary')).toHaveAttribute(
            'data-hud-action-stack-action',
            'Recover'
        );
        expect(screen.getByTestId('hud-recent-action-stack-summary')).toHaveAttribute(
            'data-hud-action-stack-tone',
            'risk'
        );
        expect(screen.getByTestId('hud-recent-action-stack-summary')).toHaveAttribute(
            'data-hud-action-stack-first',
            'First: recover control'
        );
        expect(screen.getByTestId('hud-recent-action-stack-summary')).toHaveAttribute(
            'data-hud-action-stack-then',
            'Then: rebuild with a safe match'
        );
        expect(screen.getByTestId('hud-recent-action-stack-summary')).toHaveAttribute(
            'data-hud-action-stack-keep',
            'Keep: stop the chain break'
        );
        expect(screen.getByTestId('hud-recent-action-stack-summary')).toHaveTextContent('First: recover control');
        expect(screen.getByTestId('hud-recent-action-stack-summary')).toHaveTextContent(
            'Then: rebuild with a safe match'
        );
        expect(screen.getByTestId('hud-recent-action-stack-summary')).toHaveTextContent('Keep: stop the chain break');
        expect(screen.getByTestId('hud-recent-action').getAttribute('aria-label')).toContain(
            'Impact cue: Recovery lane.'
        );
        expect(screen.getByTestId('hud-recent-action').getAttribute('aria-label')).toContain(
            'Risk stack: Recover. Chain x6 + Chain break + Lost reward + Next chase. First: recover control.'
        );
        expect(screen.getByTestId('hud-recent-action').getAttribute('aria-label')).toContain(
            'Then: rebuild with a safe match. Keep: stop the chain break.'
        );
    });

    it('surfaces named chain momentum tiers instead of a raw streak only', () => {
        const baseRun = finishMemorizePhase(createDailyRun(0, { echoFeedbackEnabled: false }));
        const run = {
            ...baseRun,
            stats: {
                ...baseRun.stats,
                currentStreak: 6
            },
            board: {
                ...baseRun.board!,
                tiles: baseRun.board!.tiles.map((tile) => ({ ...tile, tileTraitKind: undefined }))
            }
        } as RunState;

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={run}
            />
        );

        expect(screen.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-tier', 'surge');
        expect(screen.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-lane-cue', 'Prime cashout');
        expect(screen.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-lane-action', 'Prime chain');
        expect(screen.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-lane-audio', 'chain-prime');
        expect(screen.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-lane-screen-cue', 'pulse');
        expect(screen.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-lane-tone', 'setup');
        expect(screen.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-milestone-action', 'Push combo');
        expect(screen.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-milestone-audio', 'milestone-prime');
        expect(screen.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-milestone-screen-cue', 'pulse');
        expect(screen.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-milestone-target', 'x10');
        expect(screen.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-milestone-tone', 'surge');
        expect(screen.getByTestId('hud-match-chain')).toHaveTextContent('Surge');
        expect(screen.getByTestId('hud-match-chain')).toHaveTextContent('4 matches to x10');
        expect(screen.getByTestId('hud-chain-lane-cue')).toHaveTextContent('Prime cashout');
        expect(screen.getByTestId('hud-chain-lane-cue')).toHaveAttribute('data-chain-lane-action', 'Prime chain');
        expect(screen.getByTestId('hud-chain-lane-cue')).toHaveAttribute('data-chain-lane-audio', 'chain-prime');
        expect(screen.getByTestId('hud-chain-lane-cue')).toHaveAttribute('data-chain-lane-screen-cue', 'pulse');
        expect(screen.getByTestId('hud-chain-lane-cue')).toHaveAttribute('data-chain-lane-tone', 'setup');
        expect(screen.getByTestId('hud-chain-lane-cue').getAttribute('title')).toContain('next reward threshold');
        expect(screen.getByTestId('hud-chain-next-target')).toHaveTextContent('4 matches to x10');
        expect(screen.getByTestId('hud-chain-next-target')).toHaveTextContent('Push combo');
        expect(screen.getByTestId('hud-chain-next-target')).toHaveAttribute(
            'data-chain-next-milestone-action',
            'Push combo'
        );
        expect(screen.getByTestId('hud-chain-next-target')).toHaveAttribute(
            'data-chain-next-milestone-audio',
            'milestone-prime'
        );
        expect(screen.getByTestId('hud-chain-next-target')).toHaveAttribute(
            'data-chain-next-milestone-screen-cue',
            'pulse'
        );
        expect(screen.getByTestId('hud-chain-next-target')).toHaveAttribute(
            'data-chain-next-milestone-label',
            'Combo tier'
        );
        expect(screen.getByTestId('hud-chain-next-target')).toHaveAttribute(
            'data-chain-next-milestone-target',
            'x10'
        );
        expect(screen.getByTestId('hud-chain-next-target')).toHaveAttribute(
            'data-chain-next-milestone-tone',
            'surge'
        );
        expect(screen.getByTestId('hud-chain-next-target')).toHaveAttribute(
            'data-chain-next-first',
            'First: 4 matches to x10'
        );
        expect(screen.getByTestId('hud-chain-next-target')).toHaveAttribute(
            'data-chain-next-then',
            'Then: chase x8 +1 shard'
        );
        expect(screen.getByTestId('hud-chain-next-target')).toHaveAttribute(
            'data-chain-next-keep',
            'Keep: prime cashout'
        );
        expect(screen.getByTestId('hud-chain-next-target')).toHaveTextContent('Then: chase x8 +1 shard');
        expect(screen.getByTestId('hud-chain-next-target')).toHaveTextContent('Keep: prime cashout');
        expect(screen.getByTestId('hud-chain-next-target')).toHaveAttribute(
            'data-chain-next-milestone-fill',
            '60'
        );
        expect(screen.getByTestId('hud-chain-reward-pips')).toHaveAttribute('data-chain-reward-progress', '0/2');
        expect(screen.getByTestId('hud-chain-reward-pips')).toHaveAccessibleName(
            /Chain reward progress 0\/2 toward x8 \+1 shard\. 2 matches left/i
        );
        expect(screen.getByTestId('hud-chain-reward-pips').querySelectorAll('[data-pip-filled="true"]')).toHaveLength(0);
        expect(screen.getByTestId('hud-chain-reward-pips').querySelectorAll('[data-pip-filled="false"]')).toHaveLength(2);
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveTextContent('x8 +1 shard');
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveTextContent('x8 +1 guard');
        expect(screen.getByTestId('hud-chain-reward-ladder')).toHaveAttribute(
            'data-chain-reward-ladder',
            'reward:0/2>guard:2/4>heal:6/8'
        );
        expect(screen.getByTestId('hud-chain-reward-ladder')).toHaveAttribute(
            'data-chain-reward-ladder-actions',
            'reward:Prime cashout:0/2>guard:Prime cashout:2/4>heal:Prime cashout:6/8'
        );
        expect(screen.getByTestId('hud-chain-reward-ladder')).toHaveAccessibleName(
            'Chain reward ladder. Prime: Prime cashout: x8 +1 shard. 0/2. 2 matches left. Prime: Prime cashout: x8 +1 guard. 2/4. 2 matches left. Prime: Prime cashout: x8 +1 life. 6/8. 2 matches left.'
        );
        expect(screen.getByTestId('hud-chain-reward-ladder')).toHaveTextContent('Prime cashout');
        expect(screen.getByTestId('hud-chain-reward-ladder')).toHaveTextContent('0/2');
        expect(screen.getByTestId('hud-chain-reward-ladder')).toHaveTextContent('2/4');
        expect(screen.getByTestId('hud-chain-reward-ladder')).toHaveTextContent('6/8');
        expect(
            screen.getByTestId('hud-chain-reward-ladder').querySelector('[data-chain-reward-ladder-tone="reward"]')
        ).toHaveAttribute('data-chain-reward-ladder-urgency', 'soon');
        expect(
            screen.getByTestId('hud-chain-reward-ladder').querySelector('[data-chain-reward-ladder-tone="reward"]')
        ).toHaveAttribute('data-chain-reward-ladder-action', 'Prime cashout');
        expect(
            screen.getByTestId('hud-chain-reward-ladder').querySelector('[data-chain-reward-ladder-tone="reward"]')
        ).toHaveAttribute('data-chain-reward-ladder-audio', 'chain-reward-stack');
        expect(
            screen.getByTestId('hud-chain-reward-ladder').querySelector('[data-chain-reward-ladder-tone="reward"]')
        ).toHaveAttribute('data-chain-reward-ladder-screen-cue', 'burst');
        expect(
            screen.getByTestId('hud-chain-reward-ladder').querySelector('[data-chain-reward-ladder-tone="reward"]')
        ).toHaveAttribute('data-chain-reward-ladder-filled', '0');
        expect(
            screen.getByTestId('hud-chain-reward-ladder').querySelector('[data-chain-reward-ladder-tone="reward"]')
        ).toHaveAttribute('data-chain-reward-ladder-beats', '3');
        expect(
            screen
                .getByTestId('hud-chain-reward-ladder')
                .querySelector('[data-chain-reward-ladder-tone="reward"]')
                ?.querySelectorAll('[data-chain-reward-ladder-beat]')
        ).toHaveLength(3);
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveTextContent('Prime');
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveTextContent('Prime cashout');
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveTextContent('Triple prime');
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveTextContent('3x stack');
        expect(
            screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')
        ).toHaveAttribute('data-chain-reward-stack-size', '3');
        expect(
            screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')?.querySelectorAll(
                '[data-chain-reward-forecast-stack-beat]'
            )
        ).toHaveLength(3);
        expect(
            screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')
                ?.querySelector('[data-chain-reward-forecast-stack-beat="1"]')
        ).toHaveAttribute('data-chain-reward-forecast-stack-beat-focus', 'primary');
        expect(screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveAttribute(
            'data-chain-reward-arcade-cue',
            'Triple prime'
        );
        expect(screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveAttribute(
            'data-chain-reward-stack-size',
            '3'
        );
        expect(screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveAttribute(
            'data-chain-reward-lane-action',
            'Prime cashout'
        );
        expect(screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveAttribute(
            'data-chain-reward-audio',
            'chain-reward-stack'
        );
        expect(screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveAttribute(
            'data-chain-reward-screen-cue',
            'burst'
        );
        expect(screen.queryByTestId('hud-chain-reward-hot')).toBeNull();
        expect(screen.queryByTestId('hud-chain-stacked-payoff')).toBeNull();
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveAccessibleName(
            /Chain reward forecast.*Prime: Soon: Prime cashout: Triple prime: x8 \+1 shard: 3x stack: 2 matches/i
        );
        expect(screen.getByTestId('hud-combo-shards')).toHaveTextContent('x8 +1 shard');
        expect(screen.getByTestId('hud-combo-shards')).toHaveTextContent('3 shards = +1 life');
        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveAttribute('data-primary-reward-tone', 'reward');
        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveAttribute('data-primary-reward-action', 'Prime cashout');
        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveAttribute('data-primary-reward-audio', 'reward-stack');
        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveAttribute('data-primary-reward-screen-cue', 'burst');
        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveAttribute('data-primary-reward-beats', '4');
        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveAttribute('data-primary-reward-distance', '2');
        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveAttribute('data-primary-reward-progress', '0/2');
        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveAttribute('data-primary-reward-urgency', 'soon');
        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveTextContent('Prime cashout');
        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveTextContent('2 matches left');
        expect(screen.getByTestId('hud-primary-reward-cue').querySelector('[data-primary-reward-progress-filled]')).toHaveAttribute(
            'data-primary-reward-progress-filled',
            '0'
        );
        expect(screen.getByTestId('hud-primary-reward-cue').querySelector('[data-primary-reward-progress-total]')).toHaveAttribute(
            'data-primary-reward-progress-total',
            '2'
        );
        expect(screen.getByTestId('hud-primary-reward-cue').querySelectorAll('[data-primary-reward-beat]')).toHaveLength(4);
        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveAccessibleName(
            /Nearest chain reward.*Prime: Soon: Prime cashout: Triple prime: x8 \+1 shard: 2 matches/i
        );
        expect(screen.getByTestId('hud-chain-meter')).toHaveAttribute('data-meter-kind', 'chain');
        expect(screen.getByTestId('hud-chain-meter')).toHaveAttribute('aria-label', 'Chain momentum meter 6 of 10');
        expect(screen.getByTestId('hud-chain-meter')).toHaveStyle({ '--hud-meter-fill': '60%' });
    });

    it('keeps the chain loop visible before the first streak starts', () => {
        const baseRun = finishMemorizePhase(createDailyRun(0, { echoFeedbackEnabled: false }));
        const run = {
            ...baseRun,
            stats: {
                ...baseRun.stats,
                comboShards: 0,
                currentStreak: 0
            },
            board: {
                ...baseRun.board!,
                tiles: baseRun.board!.tiles.map((tile) => ({ ...tile, tileTraitKind: undefined }))
            }
        } as RunState;

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={run}
            />
        );

        expect(screen.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-tier', 'building');
        expect(screen.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-lane-cue', 'Prime chain');
        expect(screen.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-lane-tone', 'setup');
        expect(screen.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-milestone-action', 'Start chain');
        expect(screen.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-milestone-target', 'x3');
        expect(screen.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-milestone-tone', 'building');
        expect(screen.getByTestId('hud-match-chain')).toHaveTextContent('Priming');
        expect(screen.getByTestId('hud-match-chain')).toHaveTextContent('3 matches to x3');
        expect(screen.getByTestId('hud-chain-lane-cue')).toHaveTextContent('Prime chain');
        expect(screen.getByTestId('hud-chain-next-target')).toHaveTextContent('3 matches to x3');
        expect(screen.getByTestId('hud-chain-next-target')).toHaveTextContent('Start chain');
        expect(screen.getByTestId('hud-chain-next-target')).toHaveAttribute(
            'data-chain-next-milestone-fill',
            '0'
        );
        expect(screen.getByTestId('hud-chain-next-target')).toHaveAttribute(
            'data-chain-next-milestone-action',
            'Start chain'
        );
        expect(screen.getByTestId('hud-chain-next-target')).toHaveAttribute(
            'data-chain-next-milestone-label',
            'Chain tier'
        );
        expect(screen.getByTestId('hud-chain-next-target')).toHaveAttribute(
            'data-chain-next-milestone-target',
            'x3'
        );
        expect(screen.getByTestId('hud-chain-next-target')).toHaveAttribute(
            'data-chain-next-milestone-tone',
            'building'
        );
        expect(screen.getByTestId('hud-chain-next-target')).toHaveAttribute(
            'data-chain-next-first',
            'First: match any safe match'
        );
        expect(screen.getByTestId('hud-chain-next-target')).toHaveAttribute(
            'data-chain-next-then',
            'Then: chase x2 +1 shard'
        );
        expect(screen.getByTestId('hud-chain-next-target')).toHaveAttribute(
            'data-chain-next-keep',
            'Keep: prime chain'
        );
        expect(screen.getByTestId('hud-match-chain')).toHaveAccessibleName(/First: match any safe match/i);
        expect(screen.getByTestId('hud-chain-reward-pips')).toHaveAttribute('data-chain-reward-progress', '0/2');
        expect(screen.getByTestId('hud-chain-reward-pips')).toHaveTextContent('2 matches left');
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveTextContent('x2 +1 shard');
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveTextContent('Prime');
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveTextContent('Prime cashout');
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveTextContent('Combo prime');
        expect(screen.getByTestId('hud-chain-meter')).toHaveAttribute('aria-label', 'Chain momentum meter 0 of 10');
        expect(screen.getByTestId('hud-chain-meter')).toHaveStyle({ '--hud-meter-fill': '0%' });
    });

    it('marks distant primary chain rewards as later tick cues', () => {
        const baseRun = finishMemorizePhase(createDailyRun(0, { echoFeedbackEnabled: false }));
        const run = {
            ...baseRun,
            lives: MAX_LIVES,
            stats: {
                ...baseRun.stats,
                comboShards: MAX_COMBO_SHARDS,
                currentStreak: 0
            },
            board: {
                ...baseRun.board!,
                tiles: baseRun.board!.tiles.map((tile) => ({ ...tile, tileTraitKind: undefined }))
            }
        } as RunState;

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={run}
            />
        );

        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveAttribute('data-primary-reward-tone', 'guard');
        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveAttribute('data-primary-reward-action', 'Hold streak');
        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveAttribute('data-primary-reward-screen-cue', 'tick');
        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveAttribute('data-primary-reward-beats', '2');
        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveAttribute('data-primary-reward-urgency', 'later');
        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveTextContent('x4 +1 guard');
        expect(screen.getByTestId('hud-primary-reward-cue').querySelectorAll('[data-primary-reward-beat]')).toHaveLength(2);
    });

    it('names the exact single chain cashout when any clean match will pay', () => {
        const baseRun = finishMemorizePhase(createDailyRun(0, { echoFeedbackEnabled: false }));
        const run = {
            ...baseRun,
            stats: {
                ...baseRun.stats,
                comboShards: 0,
                currentStreak: 5
            },
            board: {
                ...baseRun.board!,
                tiles: baseRun.board!.tiles.map((tile) => ({ ...tile, tileTraitKind: undefined }))
            }
        } as RunState;

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={run}
            />
        );

        expect(screen.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-lane-cue', 'Cashout now');
        expect(screen.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-lane-tone', 'cashout');
        expect(screen.getByTestId('hud-match-chain')).toHaveAccessibleName(/Cashout now.*Next clean match pays x6 \+1 shard/i);
        expect(screen.getByTestId('hud-chain-lane-cue')).toHaveTextContent('Cashout now');
        expect(screen.getByTestId('hud-chain-lane-cue')).toHaveAttribute('title', 'Next clean match pays x6 +1 shard');
        expect(screen.getByTestId('hud-chain-next-target')).toHaveAttribute(
            'data-chain-next-first',
            'First: cash next match'
        );
        expect(screen.getByTestId('hud-chain-next-target')).toHaveAttribute(
            'data-chain-next-then',
            'Then: chase x6 +1 shard'
        );
        expect(screen.getByTestId('hud-chain-next-target')).toHaveAttribute(
            'data-chain-next-keep',
            'Keep: cashout now'
        );
        expect(screen.getByTestId('hud-match-chain')).toHaveAccessibleName(/First: cash next match/i);
        expect(screen.queryByTestId('hud-chain-stacked-payoff')).toBeNull();
    });

    it('shows chain reward forecast chips for shard, guard, and life thresholds', () => {
        const baseRun = finishMemorizePhase(createDailyRun(0, { echoFeedbackEnabled: false }));
        const run = {
            ...baseRun,
            lives: 4,
            stats: {
                ...baseRun.stats,
                comboShards: 1,
                currentStreak: 3
            }
        } as RunState;

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={run}
            />
        );

        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveTextContent('x4 +1 shard');
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveTextContent('Hit now');
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveTextContent('Cash next');
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveTextContent('Double cashout');
        expect(screen.getByTestId('hud-chain-reward-hot')).toHaveTextContent('Reward hot');
        expect(screen.getByTestId('hud-chain-reward-hot')).toHaveTextContent('x4 +1 shard');
        expect(screen.getByTestId('hud-chain-reward-hot')).toHaveAccessibleName(
            'Chain reward hot: x4 +1 shard. Hit now.'
        );
        expect(screen.getByTestId('hud-chain-reward-hot')).toHaveAttribute('data-chain-reward-hot-beats', '4');
        expect(screen.getByTestId('hud-chain-reward-hot')).toHaveAttribute('data-chain-reward-hot-screen-cue', 'super');
        expect(screen.getByTestId('hud-chain-reward-hot')).toHaveAttribute('data-chain-reward-hot-tone', 'cashout');
        expect(screen.getByTestId('hud-chain-reward-hot')).toHaveAttribute('data-chain-reward-hot-fill', '50');
        expect(screen.getByTestId('hud-chain-reward-hot-band')).toHaveAttribute(
            'data-chain-reward-hot-band-tone',
            'cashout'
        );
        expect(screen.getByTestId('hud-chain-reward-hot-band')).toHaveAttribute(
            'data-chain-reward-hot-band-beats',
            '4'
        );
        expect(screen.getByTestId('hud-chain-reward-hot-band')).toHaveAttribute(
            'data-chain-reward-hot-band-screen-cue',
            'super'
        );
        expect(screen.getByTestId('hud-chain-reward-hot-band')).toHaveTextContent('Reward hot');
        expect(screen.getByTestId('hud-chain-reward-hot-band')).toHaveTextContent('x4 +1 shard');
        expect(screen.getByTestId('hud-chain-reward-hot-band')).toHaveTextContent('1 match left');
        expect(screen.getByTestId('hud-chain-reward-hot-band')).toHaveTextContent('Hit now');
        expect(
            screen.getByTestId('hud-chain-reward-hot-band').querySelectorAll('[data-chain-reward-hot-band-beat]')
        ).toHaveLength(4);
        expect(
            screen.getByTestId('hud-chain-reward-hot-band').querySelector('[data-chain-reward-hot-band-beat="1"]')
        ).toHaveAttribute('data-chain-reward-hot-band-beat-focus', 'primary');
        expect(screen.getByTestId('hud-chain-reward-hot-band')).toHaveAccessibleName(
            'Chain reward hot band. Reward hot. x4 +1 shard. 1 match left.'
        );
        expect(screen.getByTestId('hud-combo-shards')).toHaveAttribute('data-primary-reward-hot', 'true');
        expect(screen.getByTestId('hud-combo-shards')).toHaveTextContent('Shards');
        expect(screen.getByTestId('hud-combo-shards')).toHaveTextContent('1');
        expect(screen.getByTestId('hud-combo-shards')).toHaveTextContent('3 shards = +1 life');
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveAttribute(
            'data-chain-reward-forecast-hot',
            'true'
        );
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveTextContent('Hit now');
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveTextContent('Double cashout');
        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveAttribute('data-primary-reward-action', 'Cash next');
        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveAttribute('data-primary-reward-distance', '1');
        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveAttribute('data-primary-reward-progress', '1/2');
        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveAttribute('data-primary-reward-urgency', 'next');
        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveTextContent('Cash next');
        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveTextContent('1 match left');
        expect(screen.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-lane-cue', 'Stack cashout');
        expect(screen.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-lane-tone', 'stack');
        expect(screen.getByTestId('hud-match-chain')).toHaveAccessibleName(/Stack cashout.*2 rewards on the next clean match/i);
        expect(screen.getByTestId('hud-chain-lane-cue')).toHaveTextContent('Stack cashout');
        expect(screen.getByTestId('hud-chain-lane-cue')).toHaveAttribute('data-chain-lane-tone', 'stack');
        expect(screen.getByTestId('hud-chain-stacked-payoff')).toHaveTextContent('2x payoff');
        expect(screen.getByTestId('hud-chain-stacked-payoff')).toHaveTextContent('Cash now');
        expect(screen.getByTestId('hud-chain-stacked-payoff')).toHaveTextContent('Next match');
        expect(screen.getByTestId('hud-chain-stacked-payoff')).toHaveAttribute('data-chain-stack-action', 'Cash now');
        expect(screen.getByTestId('hud-chain-stacked-payoff')).toHaveAttribute('data-chain-stack-beats', '2');
        expect(screen.getByTestId('hud-chain-stacked-payoff')).toHaveAttribute('data-chain-stack-fill', '67');
        expect(screen.getByTestId('hud-chain-stacked-payoff').querySelectorAll('[data-chain-stack-beat]')).toHaveLength(2);
        expect(
            screen.getByTestId('hud-chain-stacked-payoff').querySelector('[data-chain-stack-beat="1"]')
        ).toHaveAttribute('data-chain-stack-beat-focus', 'primary');
        expect(screen.getByTestId('hud-chain-stacked-payoff')).toHaveAccessibleName(
            'Stacked chain payoff: Cash now. 2x payoff next: x4 +1 shard + x4 +1 guard.'
        );
        expect(screen.getByTestId('hud-chain-reward-pips')).toHaveAttribute('data-chain-reward-progress', '1/2');
        expect(screen.getByTestId('hud-chain-reward-pips').querySelectorAll('[data-pip-filled="true"]')).toHaveLength(1);
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveTextContent('x4 +1 guard');
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveTextContent('x8 +1 life');
        expect(screen.getByTestId('hud-chain-reward-ladder')).toHaveAttribute(
            'data-chain-reward-ladder',
            'reward:1/2>guard:3/4>heal:3/8'
        );
        expect(screen.getByTestId('hud-chain-reward-ladder')).toHaveAttribute(
            'data-chain-reward-ladder-actions',
            'reward:Cash next:1/2>guard:Cash next:3/4>heal:Hold streak:3/8'
        );
        expect(screen.getByTestId('hud-chain-reward-ladder')).toHaveAccessibleName(
            'Chain reward ladder. Hit now: Cash next: x4 +1 shard. 1/2. 1 match left. Hit now: Cash next: x4 +1 guard. 3/4. 1 match left. Hold streak: x8 +1 life. 3/8. 5 matches left.'
        );
        expect(screen.getByTestId('hud-chain-reward-ladder')).toHaveTextContent('Cash next');
        expect(screen.getByTestId('hud-chain-reward-ladder')).toHaveTextContent('1/2');
        expect(screen.getByTestId('hud-chain-reward-ladder')).toHaveTextContent('3/4');
        expect(screen.getByTestId('hud-chain-reward-ladder')).toHaveTextContent('3/8');
        expect(
            screen.getByTestId('hud-chain-reward-ladder').querySelector('[data-chain-reward-ladder-tone="reward"]')
        ).toHaveAttribute('data-chain-reward-ladder-urgency', 'next');
        expect(
            screen.getByTestId('hud-chain-reward-ladder').querySelector('[data-chain-reward-ladder-tone="guard"]')
        ).toHaveAttribute('data-chain-reward-ladder-total', '4');
        expect(
            screen.getByTestId('hud-chain-reward-ladder').querySelector('[data-chain-reward-ladder-tone="guard"]')
        ).toHaveAttribute('data-chain-reward-ladder-action', 'Cash next');
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveTextContent('Hold streak');
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveTextContent('Hold streak');
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveTextContent('Double cashout');
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveTextContent('Combo chase');
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveTextContent('2x stack');
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveAttribute(
            'data-chain-reward-lane-map',
            'reward:1>guard:1>heal:1'
        );
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveAttribute(
            'data-chain-reward-lane-actions',
            'reward:Cash next:1>guard:Cash next:1>heal:Hold streak:1'
        );
        expect(screen.getByTestId('hud-chain-reward-lane-map')).toHaveAttribute(
            'data-chain-reward-lane-map',
            'reward:1>guard:1>heal:1'
        );
        expect(screen.getByTestId('hud-chain-reward-lane-map')).toHaveAttribute(
            'data-chain-reward-lane-actions',
            'reward:Cash next:1>guard:Cash next:1>heal:Hold streak:1'
        );
        expect(screen.getByTestId('hud-chain-reward-lane-map')).toHaveAttribute('data-chain-reward-primary-lane', 'reward');
        expect(screen.getByTestId('hud-chain-reward-lane-map')).toHaveAttribute(
            'data-chain-reward-primary-lane-action',
            'Cash next'
        );
        expect(screen.getByTestId('hud-chain-reward-lane-map')).toHaveAttribute(
            'data-chain-reward-primary-lane-audio',
            'chain-reward-stack'
        );
        expect(screen.getByTestId('hud-chain-reward-lane-map')).toHaveAttribute('data-chain-reward-primary-lane-beats', '4');
        expect(screen.getByTestId('hud-chain-reward-lane-map')).toHaveAttribute(
            'data-chain-reward-primary-lane-cue',
            'Double cashout'
        );
        expect(screen.getByTestId('hud-chain-reward-lane-map')).toHaveAttribute(
            'data-chain-reward-primary-lane-screen-cue',
            'burst'
        );
        const chainRewardForecastSummary = screen.getByTestId('hud-chain-reward-forecast-summary');
        expect(chainRewardForecastSummary).toHaveAttribute('data-chain-reward-forecast-summary-fill', '100');
        expect(chainRewardForecastSummary).toHaveTextContent('Forecast');
        expect(chainRewardForecastSummary).toHaveTextContent('6 cues');
        expect(chainRewardForecastSummary.querySelectorAll('[data-chain-reward-forecast-summary-beat]')).toHaveLength(5);
        expect(
            chainRewardForecastSummary.querySelector('[data-chain-reward-forecast-summary-beat="1"]')
        ).toHaveAttribute('data-chain-reward-forecast-summary-beat-focus', 'primary');
        expect(screen.getByTestId('hud-chain-reward-lane-map')).toHaveTextContent('Shard');
        expect(screen.getByTestId('hud-chain-reward-lane-map')).toHaveTextContent('Guard');
        expect(screen.getByTestId('hud-chain-reward-lane-map')).toHaveTextContent('Heal');
        expect(screen.getByTestId('hud-chain-reward-lane-map')).toHaveTextContent('Cash next');
        expect(screen.getByTestId('hud-chain-reward-lane-map')).toHaveTextContent('Hold streak');
        expect(screen.getByTestId('hud-chain-reward-lane-map')).toHaveAccessibleName(
            'Chain reward lane map. Shard Cashout x1. Cash next. Double cashout. Guard Cashout x1. Cash next. Double cashout. Heal Heal x1. Hold streak. Combo chase.'
        );
        expect(screen.getByTestId('hud-chain-reward-primary-lane')).toHaveAccessibleName(
            'Primary chain reward lane. Shard: Cash next. Double cashout. 4 beats.'
        );
        expect(screen.getByTestId('hud-chain-reward-primary-lane')).toHaveAttribute('data-chain-reward-primary-lane', 'reward');
        expect(screen.getByTestId('hud-chain-reward-primary-lane')).toHaveAttribute(
            'data-chain-reward-primary-lane-action',
            'Cash next'
        );
        expect(screen.getByTestId('hud-chain-reward-primary-lane')).toHaveAttribute(
            'data-chain-reward-primary-lane-audio',
            'chain-reward-stack'
        );
        expect(screen.getByTestId('hud-chain-reward-primary-lane')).toHaveAttribute(
            'data-chain-reward-primary-lane-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('hud-chain-reward-primary-lane')).toHaveTextContent('Cash lane');
        expect(screen.getByTestId('hud-chain-reward-primary-lane').querySelectorAll('[data-chain-reward-primary-lane-beat]')).toHaveLength(4);
        expect(
            screen.getByTestId('hud-chain-reward-lane-map').querySelector('[data-chain-reward-lane="reward"]')
        ).toHaveAttribute('data-chain-reward-lane-action', 'Cash next');
        expect(
            screen.getByTestId('hud-chain-reward-lane-map').querySelector('[data-chain-reward-lane="reward"]')
        ).toHaveAttribute('data-chain-reward-lane-beats', '4');
        expect(
            screen
                .getByTestId('hud-chain-reward-lane-map')
                .querySelector('[data-chain-reward-lane="reward"]')
                ?.querySelectorAll('[data-chain-reward-lane-beat]')
        ).toHaveLength(4);
        expect(
            screen.getByTestId('hud-chain-reward-lane-map').querySelector('[data-chain-reward-lane="heal"]')
        ).toHaveAttribute('data-chain-reward-lane-action', 'Hold streak');
        expect(
            screen.getByTestId('hud-chain-reward-lane-map').querySelector('[data-chain-reward-lane="heal"]')
        ).toHaveAttribute('data-chain-reward-lane-beats', '3');
        expect(screen.getByTestId('hud-chain-reward-forecast')).toHaveAccessibleName(
            /Chain reward forecast.*Hit now: Next: Cash next: Double cashout: x4 \+1 shard: 2x stack: 1 match.*Hit now: Next: Cash next: Double cashout: x4 \+1 guard: 2x stack: 1 match.*Hold streak: Later: Hold streak: Combo chase: x8 \+1 life: 5 matches/i
        );
        expect(screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveTextContent('Next');
        expect(screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveTextContent('Hit now');
        expect(screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveTextContent('x4 +1 shard');
        expect(screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveTextContent('1 match');
        expect(screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveAttribute('data-chain-reward-urgency', 'next');
        expect(screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveAttribute(
            'data-chain-reward-lane-action',
            'Cash next'
        );
        expect(screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveAttribute(
            'data-chain-reward-arcade-cue',
            'Double cashout'
        );
        expect(screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveAttribute('data-chain-reward-distance', '1');
        expect(screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="guard"]')).toHaveTextContent('Next');
        expect(screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="guard"]')).toHaveTextContent('Hit now');
        expect(screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="guard"]')).toHaveTextContent('x4 +1 guard');
        expect(screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="guard"]')).toHaveTextContent('1 match');
        expect(screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="guard"]')).toHaveAttribute('data-chain-reward-urgency', 'next');
        expect(screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="heal"]')).toHaveTextContent('x8 +1 life');
        expect(screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="heal"]')).toHaveTextContent('Hold streak');
        expect(screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="heal"]')).toHaveTextContent('5 matches');
        expect(screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="heal"]')).toHaveAttribute('data-chain-reward-urgency', 'later');
        expect(screen.getByTestId('hud-chain-reward-forecast').querySelector('[data-chain-reward-tone="heal"]')).toHaveAttribute(
            'data-chain-reward-lane-action',
            'Hold streak'
        );
        expect(screen.getByTestId('hud-chain-reward-lead')).toHaveTextContent('Next');
        expect(screen.getByTestId('hud-chain-reward-lead')).toHaveTextContent('Hit now');
        expect(screen.getByTestId('hud-chain-reward-lead')).toHaveTextContent('x4 +1 shard');
        expect(screen.getByTestId('hud-chain-reward-lead')).toHaveAttribute('data-chain-reward-lead-tone', 'reward');
        expect(screen.getByTestId('hud-chain-reward-lead')).toHaveAttribute('data-chain-reward-lead-action', 'Cash next');
        expect(screen.getByTestId('hud-chain-reward-lead')).toHaveAttribute('data-chain-reward-lead-screen-cue', 'burst');
        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveTextContent('x4 +1 shard');
        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveAttribute('data-primary-reward-beats', '4');
        expect(screen.getByTestId('hud-primary-reward-cue').querySelectorAll('[data-primary-reward-beat]')).toHaveLength(4);
        expect(screen.getByTestId('hud-primary-reward-cue')).toHaveAccessibleName(
            /Nearest chain reward.*Hit now: Next: Cash next: Double cashout: x4 \+1 shard: 1 match/i
        );
    });

    it('surfaces a combo surge band when multiple trait routes are live', () => {
        const baseRun = finishMemorizePhase(createDailyRun(0, { echoFeedbackEnabled: false }));
        const run = {
            ...baseRun,
            board: {
                ...baseRun.board!,
                tiles: [
                    { ...baseRun.board!.tiles[0]!, pairKey: 'echo', tileTraitKind: 'echo' },
                    { ...baseRun.board!.tiles[1]!, pairKey: 'sealed', tileTraitKind: 'sealed' },
                    { ...baseRun.board!.tiles[2]!, pairKey: 'mirror', tileTraitKind: 'mirror' },
                    { ...baseRun.board!.tiles[3]!, pairKey: 'conduit', tileTraitKind: 'conduit' }
                ]
            }
        } as RunState;

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={run}
            />
        );

        expect(screen.getByTestId('hud-combo-shards')).toHaveAttribute('data-hud-combo-surge', 'true');
        expect(screen.getByTestId('hud-chain-combo-surge-band')).toHaveAttribute(
            'data-chain-combo-surge-band-tone',
            'surge'
        );
        expect(screen.getByTestId('hud-chain-combo-surge-band')).toHaveAttribute(
            'data-chain-combo-surge-band-beats',
            '4'
        );
        expect(screen.getByTestId('hud-chain-combo-surge-band')).toHaveAttribute(
            'data-chain-combo-surge-band-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('hud-chain-combo-surge-band')).toHaveTextContent('Combo surge');
        expect(screen.getByTestId('hud-chain-combo-surge-band')).toHaveTextContent('routes');
        expect(screen.getByTestId('hud-chain-combo-surge-band')).toHaveTextContent('Echo + Sealed');
        expect(
            screen.getByTestId('hud-chain-combo-surge-band').querySelectorAll('[data-chain-combo-surge-band-beat]')
        ).toHaveLength(4);
        expect(
            screen.getByTestId('hud-chain-combo-surge-band').querySelector('[data-chain-combo-surge-band-beat="1"]')
        ).toHaveAttribute('data-chain-combo-surge-band-beat-focus', 'primary');
        expect(screen.getByTestId('hud-chain-combo-surge-band')).toHaveAccessibleName(
            /Chain combo surge band\. Combo surge\..*routes\..*Echo \+ Sealed/i
        );
    });

    it('marks critical live action copy with the error tone', () => {
        const run = {
            ...finishMemorizePhase(createDailyRun(0, { echoFeedbackEnabled: false })),
            lives: 1
        } as RunState;

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement="Life lost. 1 life remains."
                politeHudAnnouncementPriority="error"
                run={run}
            />
        );

        expect(screen.getByTestId('hud-recent-action')).toHaveTextContent('Critical');
        expect(screen.getByTestId('hud-recent-action')).toHaveTextContent('Life lost');
        expect(screen.getByTestId('hud-recent-action')).toHaveAttribute('data-tone', 'danger');
    });

    it('shows active hazard tile count and shared hazard copy in the context rail', () => {
        const baseRun = finishMemorizePhase(createDailyRun(0, { echoFeedbackEnabled: false }));
        const run = {
            ...baseRun,
            board: {
                ...baseRun.board!,
                tiles: baseRun.board!.tiles.map((tile, index) =>
                    index < 2
                        ? { ...tile, tileHazardKind: 'shuffle_snare' as const }
                        : { ...tile, tileHazardKind: undefined }
                )
            }
        } as RunState;

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={run}
            />
        );

        expect(screen.getByTestId('hud-hazard-tiles')).toHaveTextContent('2');
        expect(screen.getByTestId('hud-hazard-tiles')).toHaveTextContent('Shuffle Snare x2');
        expect(screen.getByTestId('hud-hazard-tiles').getAttribute('title')).toContain('Shuffle Snare x2');
        expect(screen.getByTestId('hud-hazard-tiles').getAttribute('title')).toContain('reshuffles safe hidden tiles');
    });

    it('shows active trait routes, build labels, and routing tools in the HUD context', () => {
        const baseRun = finishMemorizePhase(createDailyRun(0, { echoFeedbackEnabled: false }));
        const run = {
            ...baseRun,
            lives: 4,
            regionShuffleCharges: 2,
            peekCharges: 1,
            traitRouteObjectiveProgressThisFloor: 0,
            traitRouteObjectiveRequiredThisFloor: 1,
            traitRouteObjectiveCompletedThisFloor: false,
            traitRouteObjectiveRewardClaimedThisFloor: false,
            traitRouteObjectiveRewardTextThisFloor: null,
            stats: {
                ...baseRun.stats,
                comboShards: 1,
                currentStreak: 3
            },
            board: {
                ...baseRun.board!,
                columns: 2,
                tiles: baseRun.board!.tiles.map((tile, index) =>
                    index === 0
                        ? { ...tile, pairKey: 'echo', tileTraitKind: 'echo' as const }
                        : index === 1
                          ? { ...tile, pairKey: 'sealed', tileTraitKind: 'sealed' as const }
                          : { ...tile, tileTraitKind: undefined }
                )
            }
        } as RunState;

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={run}
            />
        );

        expect(screen.getByTestId('hud-trait-route-panel')).toHaveTextContent('Trait routes');
        expect(screen.getByTestId('hud-trait-route-panel')).toHaveTextContent('0/1');
        expect(screen.getByTestId('hud-trait-route-panel')).toHaveTextContent('Sealed Catalyst');
        expect(screen.getByTestId('hud-trait-route-panel')).toHaveTextContent('Echo + Sealed: combo shard');
        expect(screen.getByTestId('hud-trait-route-panel')).toHaveTextContent('Visible combo cards: 2');
        expect(screen.getByTestId('hud-trait-route-panel')).toHaveAttribute('data-trait-route-urgency', 'next');
        expect(screen.getByTestId('hud-trait-route-panel')).toHaveAttribute('data-trait-combo-preview-count', '2');
        expect(screen.getByTestId('hud-trait-route-panel')).toHaveAttribute('data-trait-route-action-audio', 'trait-route-cashout');
        expect(screen.getByTestId('hud-trait-route-panel')).toHaveAttribute('data-trait-route-action-screen-cue', 'burst');
        expect(screen.getByTestId('hud-trait-route-panel')).toHaveAttribute('data-trait-chain-stack-cue', 'Trait super stack');
        expect(screen.getByTestId('hud-trait-route-action-cue')).toHaveTextContent('Cash next route');
        expect(screen.getByTestId('hud-trait-route-action-cue')).toHaveTextContent('One route to cashout');
        expect(screen.getByTestId('hud-trait-route-action-cue')).toHaveAttribute('data-trait-route-action', 'Cash next route');
        expect(screen.getByTestId('hud-trait-route-action-cue')).toHaveAttribute(
            'data-trait-route-action-audio',
            'trait-route-cashout'
        );
        expect(screen.getByTestId('hud-trait-route-action-cue')).toHaveAttribute(
            'data-trait-route-action-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('hud-trait-route-action-cue')).toHaveAttribute('data-trait-route-action-beats', '4');
        expect(screen.getByTestId('hud-trait-route-action-cue').querySelectorAll('[data-trait-route-action-beat]')).toHaveLength(4);
        expect(screen.getByTestId('hud-trait-route-action-cue')).toHaveAccessibleName(
            'Trait route action cue. Cash next route: One route to cashout. Reward: +1 combo shard.'
        );
        expect(screen.getByTestId('hud-trait-route-stack-cue')).toHaveTextContent('Trait super stack');
        expect(screen.getByTestId('hud-trait-route-stack-cue')).toHaveTextContent('Cash trait super stack');
        expect(screen.getByTestId('hud-trait-route-stack-cue')).toHaveTextContent('1 route + x4 +1 shard');
        expect(screen.getByTestId('hud-trait-route-stack-cue')).toHaveAttribute(
            'data-trait-chain-stack-action',
            'Cash trait super stack'
        );
        expect(screen.getByTestId('hud-trait-route-stack-cue')).toHaveAttribute(
            'data-trait-chain-stack-audio',
            'trait-stack-cashout'
        );
        expect(screen.getByTestId('hud-trait-route-stack-cue')).toHaveAttribute('data-trait-chain-stack-screen-cue', 'burst');
        expect(screen.getByTestId('hud-trait-route-stack-cue')).toHaveAttribute('data-trait-chain-stack-beats', '4');
        expect(screen.getByTestId('hud-trait-route-stack-cue').querySelectorAll('[data-trait-chain-stack-beat]')).toHaveLength(4);
        expect(screen.getByTestId('hud-trait-route-stack-cue')).toHaveAccessibleName(
            'Trait stack cue. Trait super stack: Cash trait super stack. 1 route + x4 +1 shard.'
        );
        expect(screen.getByTestId('hud-trait-route-panel').getAttribute('title')).toContain('Echo + Sealed: combo shard');
        expect(screen.getByTestId('hud-trait-opportunity-cards')).toHaveTextContent('Traits');
        expect(screen.getByTestId('hud-trait-opportunity-cards')).toHaveTextContent('echo, sealed');
        expect(screen.getByTestId('hud-trait-opportunity-cards').getAttribute('title')).toContain(
            'Trait combo opportunities'
        );
        expect(screen.getByTestId('hud-trait-opportunity-cards').getAttribute('title')).toContain('Types: echo, sealed');
        expect(screen.getByTestId('hud-trait-route-lane-map')).toHaveTextContent('Shard');
        expect(screen.getByTestId('hud-trait-route-lane-map')).toHaveTextContent('Cash shard');
        expect(screen.getByTestId('hud-trait-route-lane-map')).toHaveTextContent('combo shard');
        expect(screen.getByTestId('hud-trait-route-lane-map')).toHaveAttribute('data-trait-interaction-lane-map', 'shard:1');
        expect(screen.getByTestId('hud-trait-route-lane-map')).toHaveAttribute(
            'data-trait-interaction-lane-actions',
            'shard:Cash shard:1'
        );
        expect(screen.getByTestId('hud-trait-route-lane-map')).toHaveAttribute(
            'data-trait-interaction-lane-roles',
            'shard:Cashout:1'
        );
        expect(screen.getByTestId('hud-trait-route-lane-map')).toHaveAttribute(
            'data-trait-interaction-lane-role-ids',
            'shard:cashout:1'
        );
        expect(screen.getByTestId('hud-trait-route-lane-map').querySelector('[data-trait-interaction-lane="shard"]')).toHaveAttribute(
            'data-trait-interaction-lane-role-id',
            'cashout'
        );
        const traitRouteLaneMapSummary = screen.getByTestId('hud-trait-route-lane-map-summary');
        expect(traitRouteLaneMapSummary).toHaveAttribute('data-trait-interaction-lane-count', '1');
        expect(traitRouteLaneMapSummary).toHaveTextContent('Trait lanes');
        expect(traitRouteLaneMapSummary).toHaveTextContent('1 lane');
        expect(traitRouteLaneMapSummary).toHaveTextContent('Cashout Shard');
        expect(traitRouteLaneMapSummary.querySelectorAll('[data-trait-interaction-lane-summary-beat]')).toHaveLength(2);
        expect(
            traitRouteLaneMapSummary.querySelector('[data-trait-interaction-lane-summary-beat="1"]')
        ).toHaveAttribute('data-trait-interaction-lane-summary-beat-focus', 'primary');
        expect(screen.getByTestId('hud-trait-route-lane-map')).toHaveAccessibleName(
            'Trait interaction lanes. Shard Cashout x1. Cash shard. Echo + Sealed: combo shard.'
        );
        expect(screen.getByTestId('hud-trait-route-details')).toHaveTextContent('Trait Route Panel');
        expect(screen.getByTestId('hud-trait-route-details')).toHaveTextContent('Cards:');
        expect(screen.getByTestId('hud-trait-route-details')).toHaveTextContent('(echo)');
        expect(screen.getByTestId('hud-trait-route-details')).toHaveTextContent('(sealed)');
        expect(screen.getByTestId('hud-trait-route-details')).toHaveTextContent('Trait lanes');
        const traitRouteLaneMapSummaryDetails = screen.getByTestId('hud-trait-route-lane-map-summary-details');
        expect(screen.getByTestId('hud-trait-route-lane-map-details')).toHaveAttribute(
            'data-trait-interaction-lane-role-ids',
            'shard:cashout:1'
        );
        expect(screen.getByTestId('hud-trait-route-lane-map-details').querySelector('[data-trait-interaction-lane="shard"]')).toHaveAttribute(
            'data-trait-interaction-lane-role-id',
            'cashout'
        );
        expect(traitRouteLaneMapSummaryDetails).toHaveAttribute('data-trait-interaction-lane-count', '1');
        expect(traitRouteLaneMapSummaryDetails).toHaveTextContent('Trait lanes');
        expect(traitRouteLaneMapSummaryDetails).toHaveTextContent('1 lane');
        expect(traitRouteLaneMapSummaryDetails).toHaveTextContent('Cashout Shard');
        expect(screen.getByTestId('hud-trait-route-details-action')).toHaveTextContent('Now: Cash next route.');
        expect(screen.getByTestId('hud-trait-route-details-stack')).toHaveTextContent(
            'Stack: Cash trait super stack. 1 route + x4 +1 shard.'
        );
        expect(screen.getByTestId('hud-trait-route-details')).toHaveTextContent('Tools: row/swap 2, peek 1');
    });

    it('surfaces active reward perk payoff signals in the HUD context rail', () => {
        const baseRun = finishMemorizePhase(createDailyRun(0, { echoFeedbackEnabled: false }));
        const run = {
            ...baseRun,
            matchResolutionsThisFloor: 1,
            regionShuffleCharges: 0,
            regionShuffleFreeThisFloor: false,
            rewardPerkIds: ['free_first_swap_per_floor', 'trait_streak_toolkit'],
            stats: {
                ...baseRun.stats,
                currentStreak: 2
            }
        } as RunState;

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={run}
            />
        );

        const perkStrip = screen.getByTestId('hud-reward-perk-strip');
        expect(perkStrip).toHaveTextContent('Perks');
        expect(perkStrip).toHaveTextContent('2');
        expect(perkStrip).toHaveAttribute('data-reward-perk-meter-fill', '50');
        expect(perkStrip).toHaveAttribute('data-reward-perk-focus-action', 'Cash perk');
        expect(perkStrip).toHaveAttribute('data-reward-perk-focus-id', 'trait_streak_toolkit');
        expect(perkStrip).toHaveAttribute('data-reward-perk-focus-lane', 'Chain reward');
        expect(perkStrip).toHaveAttribute('data-reward-perk-focus-payoff', 'x3 trait flash');
        expect(perkStrip).toHaveAttribute('data-reward-perk-focus-readiness', 'armed');
        expect(perkStrip).toHaveAttribute('data-reward-perk-beat-cue', 'Cashout beat');
        expect(perkStrip).toHaveAttribute('data-reward-perk-beat-audio', 'perk-cashout');
        expect(perkStrip).toHaveAttribute('data-reward-perk-beat-screen-cue', 'burst');
        expect(perkStrip).toHaveAttribute('data-reward-perk-beat-tier', 'cashout');
        expect(perkStrip).toHaveAttribute('data-reward-perk-beat-count', '4');
        expect(perkStrip).toHaveAttribute('data-reward-perk-lane-map', 'Route prime:1>Chain reward:1');
        expect(perkStrip).toHaveAttribute(
            'data-reward-perk-lane-actions',
            'Route prime:Re-prime perk:1>Chain reward:Cash perk:1'
        );
        expect(perkStrip).toHaveAttribute(
            'data-reward-perk-lane-roles',
            'Route prime:Route:1>Chain reward:Cashout:1'
        );
        expect(perkStrip).toHaveAttribute(
            'data-reward-perk-lane-role-ids',
            'Route prime:route:1>Chain reward:cashout:1'
        );
        expect(screen.getByTestId('hud-reward-perk-primary-cue')).toHaveAttribute(
            'data-reward-perk-primary-action',
            'Cash perk'
        );
        expect(screen.getByTestId('hud-reward-perk-primary-cue')).toHaveAttribute(
            'data-reward-perk-primary-audio',
            'perk-cashout'
        );
        expect(screen.getByTestId('hud-reward-perk-primary-cue')).toHaveAttribute(
            'data-reward-perk-primary-lane',
            'Chain reward'
        );
        expect(screen.getByTestId('hud-reward-perk-primary-cue')).toHaveAttribute(
            'data-reward-perk-primary-payoff',
            'x3 trait flash'
        );
        expect(screen.getByTestId('hud-reward-perk-primary-cue')).toHaveAttribute(
            'data-reward-perk-primary-tone',
            'armed'
        );
        expect(screen.getByTestId('hud-reward-perk-primary-cue')).toHaveAttribute(
            'data-reward-perk-primary-beats',
            '4'
        );
        expect(screen.getByTestId('hud-reward-perk-primary-cue')).toHaveAttribute(
            'data-reward-perk-primary-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('hud-reward-perk-primary-cue')).toHaveAccessibleName(
            'Primary perk payoff. Cash perk: Chain reward. x3 trait flash. Trait cashout armed. Keep the clean chain alive; cash a trait match at x3+ for a tool.'
        );
        expect(screen.getByTestId('hud-reward-perk-primary-cue')).toHaveTextContent('Next perk');
        expect(screen.getByTestId('hud-reward-perk-primary-cue')).toHaveTextContent('Cash perk');
        expect(screen.getByTestId('hud-reward-perk-primary-cue')).toHaveTextContent('x3 trait flash');
        expect(screen.getByTestId('hud-reward-perk-primary-cue')).toHaveTextContent('Chain reward');
        expect(screen.getByTestId('hud-reward-perk-primary-cue').querySelectorAll('[data-reward-perk-primary-beat]')).toHaveLength(4);
        expect(screen.getByTestId('hud-reward-perk-focus')).toHaveAttribute('data-reward-perk-focus-tone', 'armed');
        expect(screen.getByTestId('hud-reward-perk-focus')).toHaveAttribute('data-reward-perk-focus-action', 'Cash perk');
        expect(screen.getByTestId('hud-reward-perk-focus')).toHaveAttribute('data-reward-perk-focus-audio', 'perk-cashout');
        expect(screen.getByTestId('hud-reward-perk-focus')).toHaveAttribute('data-reward-perk-focus-screen-cue', 'burst');
        expect(screen.getByTestId('hud-reward-perk-focus')).toHaveTextContent('Cash perk');
        expect(screen.getByTestId('hud-reward-perk-focus')).toHaveTextContent('Trait cash');
        expect(screen.getByTestId('hud-reward-perk-focus')).toHaveTextContent('Trait cashout armed');
        expect(screen.getByTestId('hud-reward-perk-beat')).toHaveTextContent('Cashout beat');
        expect(screen.getByTestId('hud-reward-perk-beat')).toHaveAttribute('data-reward-perk-beat-action', 'Cash perk');
        expect(screen.getByTestId('hud-reward-perk-beat')).toHaveAttribute('data-reward-perk-beat-audio', 'perk-cashout');
        expect(screen.getByTestId('hud-reward-perk-beat')).toHaveAttribute('data-reward-perk-beat-screen-cue', 'burst');
        expect(screen.getByTestId('hud-reward-perk-beat').querySelectorAll('i')).toHaveLength(4);
        expect(screen.getByTestId('hud-reward-perk-focus')).toHaveTextContent(
            'Keep the clean chain alive; cash a trait match at x3+ for a tool.'
        );
        expect(screen.getByTestId('hud-reward-perk-focus')).toHaveAccessibleName(
            /Focused perk payoff.*Cash perk: Trait cash.*Trait cashout armed.*cash a trait match at x3\+ for a tool/i
        );
        expect(perkStrip).toHaveTextContent('Route prime');
        expect(perkStrip).toHaveTextContent('Free prime');
        expect(perkStrip).toHaveTextContent('Prime spent');
        expect(perkStrip).toHaveTextContent('Free route link');
        expect(perkStrip).toHaveTextContent('First prime move');
        expect(perkStrip).toHaveTextContent('Use Swap or row shuffle to connect trait routes.');
        expect(perkStrip).toHaveTextContent('Chain reward');
        expect(perkStrip).toHaveTextContent('Trait cash');
        expect(perkStrip).toHaveTextContent('Trait cashout armed');
        expect(perkStrip).toHaveTextContent('x3 trait flash');
        expect(perkStrip).toHaveTextContent('Trait match at x3+');
        expect(perkStrip).toHaveTextContent('Keep the clean chain alive; cash a trait match at x3+ for a tool.');
        expect(screen.getByTestId('hud-reward-perk-lane-map')).toHaveAttribute(
            'data-reward-perk-lane-map',
            'Route prime:1>Chain reward:1'
        );
        expect(screen.getByTestId('hud-reward-perk-lane-map')).toHaveAttribute(
            'data-reward-perk-lane-actions',
            'Route prime:Re-prime perk:1>Chain reward:Cash perk:1'
        );
        expect(screen.getByTestId('hud-reward-perk-lane-map')).toHaveAttribute(
            'data-reward-perk-lane-roles',
            'Route prime:Route:1>Chain reward:Cashout:1'
        );
        expect(screen.getByTestId('hud-reward-perk-lane-map')).toHaveAttribute(
            'data-reward-perk-lane-role-ids',
            'Route prime:route:1>Chain reward:cashout:1'
        );
        expect(screen.getByTestId('hud-reward-perk-lane-map')).toHaveTextContent('Route prime');
        expect(screen.getByTestId('hud-reward-perk-lane-map')).toHaveTextContent('Re-prime perk');
        expect(screen.getByTestId('hud-reward-perk-lane-map')).toHaveTextContent('Chain reward');
        expect(screen.getByTestId('hud-reward-perk-lane-map')).toHaveTextContent('Cash perk');
        const rewardPerkLaneMapSummary = screen.getByTestId('hud-reward-perk-lane-map-summary');
        expect(rewardPerkLaneMapSummary).toHaveTextContent('Lanes');
        expect(rewardPerkLaneMapSummary).toHaveTextContent('2 lanes');
        expect(rewardPerkLaneMapSummary.querySelectorAll('[data-reward-perk-lane-map-summary-beat]')).toHaveLength(3);
        expect(
            rewardPerkLaneMapSummary.querySelector('[data-reward-perk-lane-map-summary-beat="1"]')
        ).toHaveAttribute('data-reward-perk-lane-map-summary-beat-focus', 'primary');
        expect(screen.getByTestId('hud-reward-perk-lane-map')).toHaveAccessibleName(
            'Reward perk lane map. Route prime Route x1. Re-prime perk. Use Swap or row shuffle to connect trait routes. Chain reward Cashout x1. Cash perk. Keep the clean chain alive; cash a trait match at x3+ for a tool.'
        );
        expect(perkStrip).toHaveAccessibleName(
            /Active perk payoff signals.*Free prime: Route prime: Free route link.*State: Prime spent.*Trait cash: Chain reward: x3 trait flash.*State: Trait cashout armed/i
        );
        expect(perkStrip.querySelector('[data-reward-perk-lane="Route prime"]')).toHaveAttribute(
            'data-reward-perk-readiness',
            'spent'
        );
        expect(
            screen
                .getByTestId('hud-reward-perk-lane-map')
                .querySelector('[data-reward-perk-lane-kind="Route prime"]')
        ).toHaveAttribute('data-reward-perk-lane-action', 'Re-prime perk');
        expect(
            screen
                .getByTestId('hud-reward-perk-lane-map')
                .querySelector('[data-reward-perk-lane-kind="Route prime"]')
        ).toHaveAttribute('data-reward-perk-lane-role', 'Route');
        expect(
            screen
                .getByTestId('hud-reward-perk-lane-map')
                .querySelector('[data-reward-perk-lane-kind="Route prime"]')
        ).toHaveAttribute('data-reward-perk-lane-role-id', 'route');
        expect(perkStrip.querySelector('[data-reward-perk-lane="Chain reward"]')).toHaveAttribute(
            'data-reward-perk-readiness',
            'armed'
        );
        expect(
            screen
                .getByTestId('hud-reward-perk-lane-map')
                .querySelector('[data-reward-perk-lane-kind="Chain reward"]')
        ).toHaveAttribute('data-reward-perk-lane-action', 'Cash perk');
        expect(
            screen
                .getByTestId('hud-reward-perk-lane-map')
                .querySelector('[data-reward-perk-lane-kind="Chain reward"]')
        ).toHaveAttribute('data-reward-perk-lane-role', 'Cashout');
        expect(
            screen
                .getByTestId('hud-reward-perk-lane-map')
                .querySelector('[data-reward-perk-lane-kind="Chain reward"]')
        ).toHaveAttribute('data-reward-perk-lane-role-id', 'cashout');
        expect(perkStrip.querySelector('[data-reward-perk-meter="armed"] span')?.getAttribute('style')).toContain(
            '--hud-meter-fill: 100%'
        );
    });

    it('calls out trait-route live state inside the chain momentum pill', () => {
        const baseRun = finishMemorizePhase(createDailyRun(0, { echoFeedbackEnabled: false }));
        const run = {
            ...baseRun,
            stats: {
                ...baseRun.stats,
                currentStreak: 4
            },
            board: {
                ...baseRun.board!,
                columns: 2,
                tiles: baseRun.board!.tiles.map((tile, index) =>
                    index === 0
                        ? { ...tile, pairKey: 'echo', tileTraitKind: 'echo' as const }
                        : index === 1
                          ? { ...tile, pairKey: 'sealed', tileTraitKind: 'sealed' as const }
                          : { ...tile, tileTraitKind: undefined }
                )
            }
        } as RunState;

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={run}
            />
        );

        expect(screen.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-tier', 'chain');
        expect(screen.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-lane-cue', 'Route chain');
        expect(screen.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-lane-tone', 'route');
        expect(screen.getByTestId('hud-match-chain')).toHaveTextContent('Trait route live');
        expect(screen.getByTestId('hud-chain-lane-cue')).toHaveTextContent('Route chain');
    });

    it('prioritizes active trait-route objective progress over raw route count', () => {
        const baseRun = finishMemorizePhase(createDailyRun(0, { echoFeedbackEnabled: false }));
        const run = {
            ...baseRun,
            traitRouteObjectiveProgressThisFloor: 1,
            traitRouteObjectiveRequiredThisFloor: 2,
            traitRouteObjectiveCompletedThisFloor: false,
            traitRouteObjectiveRewardClaimedThisFloor: false,
            traitRouteObjectiveRewardTextThisFloor: null,
            traitRouteObjectiveTriggeredTagsThisFloor: ['echo:sealed-combo'],
            board: {
                ...baseRun.board!,
                columns: 2,
                tiles: baseRun.board!.tiles.map((tile, index) =>
                    index === 0
                        ? { ...tile, pairKey: 'echo', tileTraitKind: 'echo' as const }
                        : index === 1
                          ? { ...tile, pairKey: 'sealed', tileTraitKind: 'sealed' as const }
                          : { ...tile, tileTraitKind: undefined }
                )
            }
        } as RunState;

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={run}
            />
        );

        expect(screen.getByTestId('hud-trait-route-panel')).toHaveTextContent('1/2');
        expect(screen.getByTestId('hud-trait-route-panel')).toHaveTextContent('Sealed Catalyst');
        expect(screen.getByTestId('hud-trait-route-panel')).toHaveAttribute('data-trait-route-urgency', 'next');
        expect(screen.getByTestId('hud-trait-route-action-cue')).toHaveTextContent('Cash next route');
        expect(screen.getByTestId('hud-trait-route-action-cue')).toHaveTextContent('One route to cashout');
        expect(screen.getByTestId('hud-trait-route-action-cue')).toHaveAttribute('data-trait-route-urgency', 'next');
        expect(screen.getByTestId('hud-trait-route-meter')).toHaveAttribute('data-meter-kind', 'trait');
        expect(screen.getByTestId('hud-trait-route-meter')).toHaveAttribute('aria-label', 'Trait route meter 1 of 2');
        expect(screen.getByTestId('hud-trait-route-meter')).toHaveStyle({ '--hud-meter-fill': '50%' });
    });

    it('surfaces a swap setup hint before trait adjacency exists', () => {
        const baseRun = finishMemorizePhase(createDailyRun(0, { echoFeedbackEnabled: false }));
        const run = {
            ...baseRun,
            regionShuffleCharges: 1,
            board: {
                ...baseRun.board!,
                columns: 2,
                tiles: [
                    { id: 's1', pairKey: 'sealed', symbol: 'S', label: 'Sealed', state: 'hidden', tileTraitKind: 'sealed' as const },
                    { id: 'f1', pairKey: 'filler', symbol: 'F', label: 'Filler', state: 'hidden' },
                    { id: 'x1', pairKey: 'origin', symbol: 'O', label: 'Origin', state: 'hidden' },
                    { id: 'h1', pairKey: 'heavy', symbol: 'H', label: 'Heavy', state: 'hidden', tileTraitKind: 'heavy' as const }
                ]
            }
        } as RunState;

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={run}
            />
        );

        expect(screen.getByTestId('hud-trait-route-panel')).toHaveTextContent('Route prime');
        expect(screen.getByTestId('hud-trait-route-panel')).toHaveTextContent('prime');
        expect(screen.getByTestId('hud-trait-route-panel')).toHaveTextContent(
            'Swap Sealed with Filler: Sealed + Heavy: score surge'
        );
        expect(screen.getByTestId('hud-trait-route-best-tool')).toHaveTextContent('Best tool: Swap');
        expect(screen.getByTestId('hud-trait-route-details')).toHaveTextContent(
            'Swap Sealed with Filler: Sealed + Heavy: score surge'
        );
    });

    it('shows Perfect Memory eligible when achievements track and no assist power was used', () => {
        const run = finishMemorizePhase(createDailyRun(0, { echoFeedbackEnabled: false }));

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={run}
            />
        );

        expect(screen.getByTestId('hud-perfect-memory')).toHaveTextContent('Eligible');
    });

    it('shows Perfect Memory locked after a disqualifying assist', () => {
        const base = finishMemorizePhase(createDailyRun(0, { echoFeedbackEnabled: false }));
        const run = { ...base, powersUsedThisRun: true, gambitThirdFlipUsed: true };

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={run}
            />
        );

        expect(screen.getByTestId('hud-perfect-memory')).toHaveTextContent('Locked: gambit');
        expect(screen.getByTestId('hud-perfect-memory').getAttribute('title')).toContain('locked by gambit');
    });

    it('renders shared cause strip and touch HUD detail rows', () => {
        const base = finishMemorizePhase(createDailyRun(0, { echoFeedbackEnabled: false }));
        const run = {
            ...base,
            findablesClaimedThisFloor: 1,
            findablesTotalThisFloor: 2,
            hazardTileTriggersThisFloor: 1,
            safeHazardWardsUsedThisFloor: 1,
            shopGold: 2,
            stats: {
                ...base.stats,
                comboShards: 1,
                currentStreak: 3
            }
        };

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={run}
            />
        );

        expect(screen.getByTestId('hud-in-run-cause-strip')).toHaveTextContent('Pickups');
        expect(screen.getByTestId('hud-in-run-cause-strip')).toHaveTextContent('Hazards');
        expect(screen.getByTestId('hud-in-run-cause-strip')).toHaveAttribute('data-hud-cause-primary', 'hazard-events');
        expect(screen.getByTestId('hud-in-run-cause-strip')).toHaveAttribute('data-hud-cause-primary-action', 'Stabilize hazard');
        expect(screen.getByTestId('hud-in-run-cause-strip')).toHaveAttribute('data-hud-cause-primary-audio', 'hud-cause-hazard');
        expect(screen.getByTestId('hud-in-run-cause-strip')).toHaveAttribute('data-hud-cause-primary-beats', '4');
        expect(screen.getByTestId('hud-in-run-cause-strip')).toHaveAttribute('data-hud-cause-primary-kind', 'hazard_trigger');
        expect(screen.getByTestId('hud-in-run-cause-strip')).toHaveAttribute('data-hud-cause-primary-screen-cue', 'guard');
        expect(screen.getByTestId('hud-primary-cause-cue')).toHaveAttribute('data-hud-cause-primary', 'hazard-events');
        expect(screen.getByTestId('hud-primary-cause-cue')).toHaveAttribute('data-hud-cause-primary-action', 'Stabilize hazard');
        expect(screen.getByTestId('hud-primary-cause-cue')).toHaveAttribute('data-hud-cause-primary-audio', 'hud-cause-hazard');
        expect(screen.getByTestId('hud-primary-cause-cue')).toHaveAttribute('data-hud-cause-primary-beats', '4');
        expect(screen.getByTestId('hud-primary-cause-cue')).toHaveAttribute('data-hud-cause-primary-screen-cue', 'guard');
        expect(screen.getByTestId('hud-primary-cause-cue')).toHaveAccessibleName(
            'Primary run cause. Hazards: 1 triggered, 1 warded. Stabilize hazard. 4 beats.'
        );
        expect(screen.getByTestId('hud-primary-cause-cue')).toHaveTextContent('Primary cause');
        expect(screen.getByTestId('hud-primary-cause-cue')).toHaveTextContent('Stabilize hazard');
        expect(screen.getByTestId('hud-primary-cause-cue').querySelectorAll('[data-hud-cause-primary-beat]')).toHaveLength(4);
        expect(screen.getByTestId('hud-cause-row-findables-claimed')).toHaveAttribute('data-feedback-action', 'Bank reward');
        expect(screen.getByTestId('hud-cause-row-findables-claimed')).toHaveAttribute('data-feedback-beats', '3');
        expect(screen.getByTestId('hud-cause-row-hazard-events')).toHaveAttribute('data-feedback-action', 'Stabilize hazard');
        expect(screen.getByTestId('hud-cause-row-hazard-events')).toHaveAttribute('data-feedback-beats', '4');
        expect(screen.getByTestId('hud-findables-claimed')).toHaveAttribute('data-findable-state', 'live');
        expect(screen.getByTestId('hud-findables-claimed')).toHaveTextContent('1 reward left');
        expect(screen.getByTestId('hud-pickup-reward-preview')).toHaveTextContent('+1 combo shard');
        expect(screen.getByTestId('hud-pickup-reward-preview')).toHaveTextContent('+25 score');
        expect(screen.getByTestId('hud-pickup-reward-preview')).toHaveAccessibleName(
            /Pickup reward preview 1 of 2.*\+1 combo shard.*\+25 score.*\+1 safe hazard ward/i
        );
        expect(screen.getByTestId('hud-pickup-reward-preview').querySelector('[data-pickup-reward-kind="ward_spark"]')).toHaveTextContent('+1 safe hazard ward');
        expect(screen.getByTestId('hud-pickup-stack-cue')).toHaveTextContent('Pickup super stack');
        expect(screen.getByTestId('hud-pickup-stack-cue')).toHaveTextContent('Cash pickup super stack');
        expect(screen.getByTestId('hud-pickup-stack-cue')).toHaveTextContent('1 pickup + x4 +1 shard');
        expect(screen.getByTestId('hud-pickup-stack-cue')).toHaveAttribute('data-pickup-stack-label', 'Pickup super stack');
        expect(screen.getByTestId('hud-pickup-stack-cue')).toHaveAttribute('data-pickup-stack-action', 'Cash pickup super stack');
        expect(screen.getByTestId('hud-pickup-stack-cue')).toHaveAccessibleName(
            'Pickup stack cue. Pickup super stack: Cash pickup super stack. 1 pickup + x4 +1 shard.'
        );
        expect(screen.getByTestId('hud-pickup-meter')).toHaveAttribute('data-meter-kind', 'pickup');
        expect(screen.getByTestId('hud-pickup-meter')).toHaveAttribute('aria-label', 'Pickup reward meter 1 of 2');
        expect(screen.getByTestId('hud-pickup-meter')).toHaveStyle({ '--hud-meter-fill': '50%' });
        expect(screen.getByTestId('hud-touch-detail-rows')).toHaveTextContent('Objective');
        expect(screen.getByTestId('hud-touch-detail-rows')).toHaveTextContent('Perfect Memory');
        expect(screen.getByTestId('hud-touch-detail-economy')).toHaveTextContent('2 gold');
    });

    it('marks pickup progress complete after every floor reward is claimed', () => {
        const base = finishMemorizePhase(createDailyRun(0, { echoFeedbackEnabled: false }));
        const run = {
            ...base,
            findablesClaimedThisFloor: 2,
            findablesTotalThisFloor: 2
        } as RunState;

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={run}
            />
        );

        expect(screen.getByTestId('hud-findables-claimed')).toHaveAttribute('data-findable-state', 'complete');
        expect(screen.getByTestId('hud-findables-claimed')).toHaveTextContent('All claimed');
    });

    it('hides Perfect Memory pill when achievements are off (practice)', () => {
        const run = finishMemorizePhase(
            createNewRun(0, { echoFeedbackEnabled: false, practiceMode: true, gameMode: 'puzzle' })
        );

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={run}
            />
        );

        expect(screen.queryByTestId('hud-perfect-memory')).toBeNull();
    });

    it('includes wager_surety bonus in the active wager pill', () => {
        const run = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, initialRelicIds: ['wager_surety'] })),
            endlessRiskWager: {
                acceptedOnLevel: 0,
                targetLevel: 1,
                streakAtRisk: 3,
                bonusFavorOnSuccess: 2
            }
        };

        render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={run}
            />
        );

        expect(screen.getByTestId('hud-endless-risk-wager').textContent).toContain('+3 Favor');
        expect(screen.getByTestId('hud-objective-signals')).toHaveTextContent('+3 Favor');
    });

    it('shows build identity after relics exist and hides it before the first relic', () => {
        const emptyRun = finishMemorizePhase(createDailyRun(0, { echoFeedbackEnabled: false }));
        const buildRun = {
            ...emptyRun,
            relicIds: ['peek_charge_plus_one', 'pin_cap_plus_one', 'stray_charge_plus_one']
        } as RunState;

        const { rerender } = render(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={emptyRun}
            />
        );
        expect(screen.queryByTestId('hud-build-profile')).toBeNull();

        rerender(
            <GameplayHudBar
                cameraViewportMode={false}
                gauntletRemainingMs={null}
                politeHudAnnouncement=""
                run={buildRun}
            />
        );

        expect(screen.getByTestId('hud-build-profile')).toHaveTextContent('The Seer');
        expect(screen.getByTestId('hud-build-profile')).toHaveTextContent('peek / pin / read');
        expect(screen.getByTestId('hud-build-profile').getAttribute('title')).toContain('peek, pin, read');
    });
});
