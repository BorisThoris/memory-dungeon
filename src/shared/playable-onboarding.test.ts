import { describe, expect, it } from 'vitest';
import { buildBoard } from './board-generation';
import { createNewRun, finishMemorizePhase } from './game-core';
import { flipTile } from './turn-resolution';
import { getPlayableOnboardingStep } from './playable-onboarding';

describe('REG-026 playable onboarding', () => {
    it('guides a fresh first floor by actual board state and target tiles', () => {
        const run = finishMemorizePhase(createNewRun(0, { onboardingSafeFirstFloor: true }));
        const first = getPlayableOnboardingStep(run, { onboardingDismissed: false, powersFtueSeen: false });

        expect(first?.id).toBe('first_match');
        expect(first?.targetTileIds).toHaveLength(2);

        const afterOneFlip = flipTile(run, first!.targetTileIds[0]!);
        const second = getPlayableOnboardingStep(afterOneFlip, { onboardingDismissed: false, powersFtueSeen: false });
        expect(second?.id).toBe('first_match');
        expect(second?.targetTileIds).toContain(first!.targetTileIds[1]);
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
