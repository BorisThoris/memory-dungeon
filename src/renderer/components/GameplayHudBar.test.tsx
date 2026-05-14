import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
        expect(screen.getByTestId('hud-favor-progress').textContent).toContain('2/3');
        expect(screen.getByTestId('hud-favor-progress').getAttribute('title')).toContain('Temporary run currency');
        expect(screen.getByTestId('hud-featured-streak').textContent).toContain('x3');
        expect(screen.getByTestId('hud-endless-risk-wager').textContent).toContain('+2 Favor');
        expect(screen.getByTestId('hud-secondary-stat-drawer')).toHaveTextContent('More');
    });

    it('shows boss encounter identity on boss-tagged floors', () => {
        const baseRun = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
        const run: RunState = {
            ...baseRun,
            gameMode: 'endless' as const,
            board: {
                ...baseRun.board!,
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
        expect(screen.getByTestId('hud-encounter-identity').getAttribute('title')).toContain('Placeholder');
        expect(screen.getByTestId('hud-floor-identity-reminder')).toHaveTextContent('Boss trophy');
        expect(screen.getByTestId('hud-floor-identity-reminder').getAttribute('title')).toContain('Study the first reveal');
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
        expect(screen.getByTestId('hud-shuffle-charges').getAttribute('title')).toContain('Search');
        expect(screen.getByTestId('hud-destroy-charges').getAttribute('title')).toContain('Damage control');
        expect(screen.getByTestId('hud-peek-charges').getAttribute('title')).toContain('Recall');
        expect(screen.getByTestId('hud-difficulty-profile')).toHaveTextContent('Standard');
        expect(screen.getByTestId('hud-combo-shards').getAttribute('title')).toContain('Temporary run currency');
        expect(screen.getByTestId('hud-secondary-stat-drawer')).toHaveTextContent('Difficulty');
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
        expect(screen.getByTestId('hud-hazard-tiles').getAttribute('title')).toContain('Shuffle Snare x2');
        expect(screen.getByTestId('hud-hazard-tiles').getAttribute('title')).toContain('reshuffles safe hidden tiles');
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
            shopGold: 2
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
        expect(screen.getByTestId('hud-touch-detail-rows')).toHaveTextContent('Objective');
        expect(screen.getByTestId('hud-touch-detail-rows')).toHaveTextContent('Perfect Memory');
        expect(screen.getByTestId('hud-touch-detail-economy')).toHaveTextContent('2 gold');
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
        expect(screen.getByTestId('hud-build-profile').getAttribute('title')).toContain('peek, pin, read');
    });
});
