import { describe, expect, it } from 'vitest';
import { buildBoard } from './board-generation';
import { createNewRun, finishMemorizePhase } from './game-core';
import { flipTile } from './turn-resolution';
import { getPlayableOnboardingScenario, getPlayableOnboardingStep } from './playable-onboarding';

describe('REG-026 playable onboarding', () => {
    it('guides a fresh first floor by actual board state and target tiles', () => {
        const run = finishMemorizePhase(createNewRun(0, { onboardingSafeFirstFloor: true }));
        const first = getPlayableOnboardingStep(run, { onboardingDismissed: false, powersFtueSeen: false });

        expect(first?.id).toBe('first_match');
        expect(first?.targetTileIds).toHaveLength(2);

        const afterOneFlip = flipTile(run, first!.targetTileIds[0]!);
        const second = getPlayableOnboardingStep(afterOneFlip, { onboardingDismissed: false, powersFtueSeen: false });
        expect(second?.id).toBe('first_match');
        expect(second?.title).toBe('Find its twin');
        expect(second?.prompt).toBe('Pick the matching tile');
        expect(second?.targetTileIds).toContain(first!.targetTileIds[1]);
    });

    it('surfaces first miss recovery without completing onboarding early', () => {
        const run = finishMemorizePhase(createNewRun(0, { onboardingSafeFirstFloor: true }));
        const first = getPlayableOnboardingStep(run, { onboardingDismissed: false, powersFtueSeen: false })!;
        const firstPairKey = run.board!.tiles.find((tile) => tile.id === first.targetTileIds[0])?.pairKey;
        const missTarget = run.board!.tiles.find(
            (tile) => !first.targetTileIds.includes(tile.id) && tile.pairKey !== firstPairKey
        )!;
        const miss = flipTile(flipTile(run, first.targetTileIds[0]!), missTarget.id);
        const recovered = finishMemorizePhase({ ...miss, status: 'playing' });
        const afterResolve = {
            ...recovered,
            board: recovered.board
                ? {
                      ...recovered.board,
                      flippedTileIds: [],
                      tiles: recovered.board.tiles.map((tile) =>
                          tile.id === first.targetTileIds[0] || tile.id === missTarget.id
                              ? { ...tile, state: 'hidden' as const }
                              : tile
                      )
                  }
                : null,
            stats: { ...recovered.stats, tries: 1, mismatches: 1 }
        };

        const step = getPlayableOnboardingStep(afterResolve, { onboardingDismissed: false, powersFtueSeen: false });

        expect(step?.title).toBe('Recover from the miss');
        expect(step?.detail).toMatch(/reset the flip/i);
        expect(step?.targetTileIds).toHaveLength(2);
    });

    it('marks scenario steps complete in order instead of leaving previous steps locked', () => {
        const run = finishMemorizePhase(createNewRun(0, { onboardingSafeFirstFloor: true }));
        const scenarioAfterMatch = getPlayableOnboardingScenario({
            board: run.board
                ? {
                      ...run.board,
                      matchedPairs: 1,
                      tiles: run.board.tiles.map((tile, index) =>
                          index < 2 ? { ...tile, state: 'matched' as const } : tile
                      )
                  }
                : null,
            onboardingDismissed: false
        });
        const scenarioAfterHandoff = getPlayableOnboardingScenario({
            board: run.board ? { ...run.board, matchedPairs: 2 } : null,
            onboardingDismissed: false
        });

        expect(scenarioAfterMatch.steps.map((step) => [step.id, step.status])).toEqual([
            ['first_match', 'complete'],
            ['recovery', 'active'],
            ['handoff', 'locked']
        ]);
        expect(scenarioAfterHandoff.steps.map((step) => [step.id, step.status])).toEqual([
            ['first_match', 'complete'],
            ['recovery', 'complete'],
            ['handoff', 'active']
        ]);
    });

    it('turns the first reward into the final-pair route-choice setup on the safe first room', () => {
        const run = finishMemorizePhase(createNewRun(0, { onboardingSafeFirstFloor: true }));
        const first = getPlayableOnboardingStep(run, { onboardingDismissed: false, powersFtueSeen: false })!;
        const afterFirstReward = {
            ...run,
            board: run.board
                ? {
                      ...run.board,
                      matchedPairs: 1,
                      tiles: run.board.tiles.map((tile) =>
                          first.targetTileIds.includes(tile.id) ? { ...tile, state: 'matched' as const } : tile
                      )
                  }
                : null,
            stats: {
                ...run.stats,
                matchesFound: 1,
                currentStreak: 1,
                currentLevelScore: 30,
                totalScore: 30
            }
        };

        const step = getPlayableOnboardingStep(afterFirstReward, {
            onboardingDismissed: false,
            powersFtueSeen: false
        });

        expect(step?.title).toBe('Exit in sight');
        expect(step?.prompt).toBe('Clear the final pair');
        expect(step?.detail).toMatch(/opens your first route choice/i);
    });

    it('uses onboardingDismissed as the durable completion flag', () => {
        const run = finishMemorizePhase(createNewRun(0, { onboardingSafeFirstFloor: true }));
        expect(getPlayableOnboardingStep(run, { onboardingDismissed: true, powersFtueSeen: false })).toBeNull();
        expect(getPlayableOnboardingStep(run, { onboardingDismissed: false, powersFtueSeen: true })?.id).toBe(
            'first_match'
        );
    });

    it('targets only ordinary real pairs and skips special onboarding hazards or rewards', () => {
        const generatedBoard = buildBoard(2, { runSeed: 26_008 });
        const base = {
            ...finishMemorizePhase(createNewRun(0, { onboardingSafeFirstFloor: true })),
            board: {
                ...generatedBoard,
                tiles: generatedBoard.tiles.map((tile) => ({ ...tile, findableKind: undefined }))
            }
        };
        const pairs = new Map<string, string[]>();
        for (const tile of base.board!.tiles) {
            pairs.set(tile.pairKey, [...(pairs.get(tile.pairKey) ?? []), tile.id]);
        }
        const [hazardPairKey, findablePairKey, safePairKey] = [...pairs.entries()]
            .filter(([pairKey, ids]) => ids.length === 2 && !pairKey.startsWith('__'))
            .slice(0, 3);
        const run = {
            ...base,
            board: {
                ...base.board!,
                cursedPairKey: findablePairKey![0],
                tiles: base.board!.tiles.map((tile) =>
                    hazardPairKey![1].includes(tile.id)
                        ? { ...tile, tileHazardKind: 'shuffle_snare' as const }
                        : findablePairKey![1].includes(tile.id)
                          ? { ...tile, findableKind: 'score_glint' as const }
                          : tile
                )
            }
        };

        const step = getPlayableOnboardingStep(run, { onboardingDismissed: false, powersFtueSeen: false });

        expect(step?.targetTileIds).toEqual(safePairKey![1]);
    });

    it('stops appearing after the guided floor', () => {
        const run = finishMemorizePhase(createNewRun(0, { onboardingSafeFirstFloor: true }));
        const laterRun = {
            ...run,
            board: run.board ? { ...run.board, level: 3 } : null
        };
        expect(getPlayableOnboardingStep(laterRun, { onboardingDismissed: false, powersFtueSeen: false })).toBeNull();
    });
});
