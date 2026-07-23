import type { BoardState, RunState, SaveData } from './contracts';
import { runArrayCount } from './run-array-guards';
import { normalizeSessionStats } from './session-stats-rules';
import { isSingletonUtilityPairKey } from './tile-identity';

export type OnboardingStepId = 'first_match' | 'recovery' | 'handoff';

export interface OnboardingStepRow {
    id: OnboardingStepId;
    title: string;
    body: string;
    status: 'active' | 'complete' | 'locked';
    targetTileIds: string[];
    mobilePlacement: 'top' | 'bottom';
}

export interface OnboardingScenario {
    replayAvailable: true;
    skipAvailable: true;
    completed: boolean;
    steps: OnboardingStepRow[];
    activeStep: OnboardingStepRow | null;
}

export interface PlayableOnboardingPrompt {
    id: OnboardingStepId;
    title: string;
    prompt: string;
    detail: string;
    targetTileIds: string[];
}

const isSafeOnboardingTile = (board: BoardState, pairKey: string, tileId: string): boolean => {
    const tile = board.tiles.find((candidate) => candidate.id === tileId);
    if (!tile || tile.state === 'matched' || isSingletonUtilityPairKey(tile.pairKey)) {
        return false;
    }
    if (board.cursedPairKey === pairKey || board.wardPairKey === pairKey || board.bountyPairKey === pairKey) {
        return false;
    }
    return (
        tile.findableKind == null &&
        tile.routeCardKind == null &&
        tile.routeSpecialKind == null &&
        tile.dungeonCardKind == null &&
        tile.tileHazardKind == null &&
        tile.dungeonBossId == null &&
        tile.dungeonCardEffectId == null &&
        tile.dungeonRouteType == null &&
        tile.dungeonExitLockKind == null &&
        tile.dungeonKeyKind == null
    );
};

const nonNegativeOnboardingCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const firstUnmatchedPair = (board: BoardState | null): string[] => {
    if (!board) {
        return [];
    }
    const byPair = new Map<string, string[]>();
    for (const tile of board.tiles) {
        if (!isSafeOnboardingTile(board, tile.pairKey, tile.id)) {
            continue;
        }
        byPair.set(tile.pairKey, [...(byPair.get(tile.pairKey) ?? []), tile.id]);
    }
    return (
        [...byPair.entries()].find(([pairKey, ids]) => ids.length === 2 && ids.every((id) => isSafeOnboardingTile(board, pairKey, id)))?.[1] ??
        []
    );
};

const getStepCopy = (
    run: RunState,
    step: OnboardingStepRow
): Pick<PlayableOnboardingPrompt, 'title' | 'prompt' | 'detail'> => {
    const stats = normalizeSessionStats(run.stats);
    if (step.id === 'recovery') {
        if (stats.mismatches > 0) {
            return {
                title: 'Recover and continue',
                prompt: 'Stabilize the next pair',
                detail: 'A miss costs tempo, not the run. Use the marked pair to rebuild streak before spending a rescue tool.'
            };
        }
        if (nonNegativeOnboardingCount(run.board?.matchedPairs) >= nonNegativeOnboardingCount(run.board?.pairCount) - 1) {
            return {
                title: 'Exit in sight',
                prompt: 'Clear the final pair',
                detail: 'The first match paid score and streak. One more clean pair clears the room and opens your first route choice.'
            };
        }
        return {
            title: 'First reward banked',
            prompt: 'Keep the streak clean',
            detail: 'The first match paid score and streak. Make one more clean pair before the guide hands control back.'
        };
    }

    if (step.id !== 'first_match') {
        return {
            title: step.title,
            prompt: step.title,
            detail: step.body
        };
    }

    const flippedCount = runArrayCount(run.board?.flippedTileIds);
    if (
        (stats.mismatches > 0 || stats.tries > 0) &&
        nonNegativeOnboardingCount(run.board?.matchedPairs) === 0
    ) {
        return {
            title: 'Recover from the miss',
            prompt: 'Use the marked pair to stabilize',
            detail: 'The miss reset the flip. Follow the marked pair, then keep matching for streak and score.'
        };
    }
    if (flippedCount === 1) {
        return {
            title: 'Find its twin',
            prompt: 'Pick the matching tile',
            detail: 'One tile is open; the guide marks the safe twin so your first action teaches score and streak.'
        };
    }
    return {
        title: step.title,
        prompt: 'Flip a marked tile',
        detail: 'The first floor starts with ordinary pairs. Match the marked pair, then use the same read on the rest of the board.'
    };
};

export const getPlayableOnboardingScenario = ({
    board,
    onboardingDismissed
}: {
    board: BoardState | null;
    onboardingDismissed: boolean;
    powersFtueSeen?: boolean;
}): OnboardingScenario => {
    const completed = onboardingDismissed;
    const matchedPairs = nonNegativeOnboardingCount(board?.matchedPairs);
    const targetTileIds = firstUnmatchedPair(board);
    const activeId: OnboardingStepId = completed
        ? 'handoff'
        : !board || board.level > 2
          ? 'handoff'
          : matchedPairs <= 0
            ? 'first_match'
            : matchedPairs === 1
              ? 'recovery'
              : 'handoff';
    const order: OnboardingStepId[] = ['first_match', 'recovery', 'handoff'];
    const stepIndex = order.indexOf(activeId);
    const steps: OnboardingStepRow[] = [
        {
            id: 'first_match',
            title: 'Make your first match',
            body: 'Flip the highlighted pair. Matching teaches score and streak faster than a rules modal.',
            status: activeId === 'first_match' ? 'active' : stepIndex > 0 ? 'complete' : 'locked',
            targetTileIds,
            mobilePlacement: 'bottom'
        },
        {
            id: 'recovery',
            title: 'Use recovery tools',
            body: 'Shards, peek, shuffle, and route rewards help you recover after the board gets harder.',
            status: activeId === 'recovery' ? 'active' : stepIndex > 1 ? 'complete' : 'locked',
            targetTileIds,
            mobilePlacement: 'bottom'
        },
        {
            id: 'handoff',
            title: 'You have control',
            body: 'Tutorial prompts stay off in normal runs. Replay or reset onboarding from the profile flow later.',
            status: activeId === 'handoff' ? 'active' : 'locked',
            targetTileIds: [],
            mobilePlacement: 'top'
        }
    ];

    return {
        replayAvailable: true,
        skipAvailable: true,
        completed,
        steps,
        activeStep: steps.find((step) => step.id === activeId) ?? null
    };
};

export const getPlayableOnboardingScenarioForSave = (save: SaveData, board: BoardState | null): OnboardingScenario =>
    getPlayableOnboardingScenario({
        board,
        onboardingDismissed: save.onboardingDismissed,
        powersFtueSeen: save.powersFtueSeen
    });

export const getPlayableOnboardingStep = (
    run: RunState,
    save: Pick<SaveData, 'onboardingDismissed' | 'powersFtueSeen'>
): PlayableOnboardingPrompt | null => {
    const scenario = getPlayableOnboardingScenario({
        board: run.board,
        onboardingDismissed: save.onboardingDismissed,
        powersFtueSeen: save.powersFtueSeen
    });
    const step = scenario.activeStep;

    if (scenario.completed || !step || step.id === 'handoff' || run.status !== 'playing') {
        return null;
    }

    const copy = getStepCopy(run, step);

    return {
        id: step.id,
        title: copy.title,
        prompt: copy.prompt,
        detail: copy.detail,
        targetTileIds: step.targetTileIds
    };
};

export const getPlayableOnboardingPrompt = getPlayableOnboardingStep;
