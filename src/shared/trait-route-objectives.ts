import { MAX_COMBO_SHARDS, type BoardState, type RunState } from './contracts';
import {
    formatTileTraitInteractionTags,
    getBoardTraitInteractionPreviewLines,
    type TileTraitInteractionTag
} from './tile-trait-rules';
import { getTraitOpportunitySummary } from './trait-opportunities';

export const TRAIT_ROUTE_OBJECTIVE_SCORE_REWARD = 25;

export interface TraitRouteObjectiveSeed {
    required: number;
    label: string;
    detail: string;
}

export interface TraitRouteObjectiveApplyResult {
    runPatch: Pick<
        RunState,
        | 'traitRouteObjectiveCompletedThisFloor'
        | 'traitRouteObjectiveProgressThisFloor'
        | 'traitRouteObjectiveRewardClaimedThisFloor'
        | 'traitRouteObjectiveRewardTextThisFloor'
        | 'traitRouteObjectiveTriggeredTagsThisFloor'
    >;
    comboShardGain: number;
    scoreBonus: number;
    feedback: string | null;
}

export const getTraitRouteObjectiveSeed = (board: BoardState | null | undefined): TraitRouteObjectiveSeed | null => {
    const summary = getTraitOpportunitySummary(board);
    if (!board) {
        return null;
    }
    const matchInteractionLines = getBoardTraitInteractionPreviewLines(board, 'match');
    if (matchInteractionLines.length === 0) {
        return null;
    }
    const required = Math.min(2, matchInteractionLines.length);
    const label = summary.buildLabels[0] ?? 'Trait routes';
    return {
        required,
        label,
        detail: `Trigger ${required} trait ${required === 1 ? 'route' : 'routes'} this floor.`
    };
};

export const getTraitRouteObjectiveRewardText = (run: Pick<RunState, 'stats'>): string =>
    run.stats.comboShards < MAX_COMBO_SHARDS
        ? '+1 combo shard'
        : `+${TRAIT_ROUTE_OBJECTIVE_SCORE_REWARD} score`;

export const applyTraitRouteObjectiveProgress = (
    run: RunState,
    interactionTags: readonly TileTraitInteractionTag[]
): TraitRouteObjectiveApplyResult => {
    const active = run.traitRouteObjectiveRequiredThisFloor > 0;
    const newTags = [...new Set(interactionTags)].filter(
        (tag) => !run.traitRouteObjectiveTriggeredTagsThisFloor.includes(tag)
    );
    if (!active || newTags.length === 0) {
        return {
            runPatch: {
                traitRouteObjectiveCompletedThisFloor: run.traitRouteObjectiveCompletedThisFloor,
                traitRouteObjectiveProgressThisFloor: run.traitRouteObjectiveProgressThisFloor,
                traitRouteObjectiveRewardClaimedThisFloor: run.traitRouteObjectiveRewardClaimedThisFloor,
                traitRouteObjectiveRewardTextThisFloor: run.traitRouteObjectiveRewardTextThisFloor,
                traitRouteObjectiveTriggeredTagsThisFloor: [...run.traitRouteObjectiveTriggeredTagsThisFloor]
            },
            comboShardGain: 0,
            scoreBonus: 0,
            feedback: null
        };
    }

    const progress = Math.min(
        run.traitRouteObjectiveRequiredThisFloor,
        run.traitRouteObjectiveProgressThisFloor + newTags.length
    );
    const completed = progress >= run.traitRouteObjectiveRequiredThisFloor;
    const claimReward = completed && !run.traitRouteObjectiveRewardClaimedThisFloor;
    const comboShardGain = claimReward && run.stats.comboShards < MAX_COMBO_SHARDS ? 1 : 0;
    const scoreBonus = claimReward && comboShardGain === 0 ? TRAIT_ROUTE_OBJECTIVE_SCORE_REWARD : 0;
    const routeText = formatTileTraitInteractionTags(newTags).slice(0, 1)[0] ?? 'Trait route';
    const rewardText = claimReward
        ? comboShardGain > 0
            ? '+1 combo shard'
            : `+${TRAIT_ROUTE_OBJECTIVE_SCORE_REWARD} score`
        : null;

    return {
        runPatch: {
            traitRouteObjectiveCompletedThisFloor: completed || run.traitRouteObjectiveCompletedThisFloor,
            traitRouteObjectiveProgressThisFloor: progress,
            traitRouteObjectiveRewardClaimedThisFloor: claimReward || run.traitRouteObjectiveRewardClaimedThisFloor,
            traitRouteObjectiveRewardTextThisFloor: rewardText ?? run.traitRouteObjectiveRewardTextThisFloor,
            traitRouteObjectiveTriggeredTagsThisFloor: [
                ...run.traitRouteObjectiveTriggeredTagsThisFloor,
                ...newTags
            ]
        },
        comboShardGain,
        scoreBonus,
        feedback: `Trait route ${progress}/${run.traitRouteObjectiveRequiredThisFloor}: ${routeText}${
            rewardText ? ` (${rewardText})` : ''
        }`
    };
};

export const getTraitRouteObjectiveStatus = (run: RunState): {
    active: boolean;
    completed: boolean;
    detail: string;
    label: string;
    progress: number;
    required: number;
    reward: string;
} | null => {
    if (run.traitRouteObjectiveRequiredThisFloor <= 0) {
        return null;
    }
    const progress = Math.min(run.traitRouteObjectiveProgressThisFloor, run.traitRouteObjectiveRequiredThisFloor);
    return {
        active: true,
        completed: run.traitRouteObjectiveCompletedThisFloor,
        detail: `Trigger trait routes (${progress}/${run.traitRouteObjectiveRequiredThisFloor}).`,
        label: 'Trait routes',
        progress,
        required: run.traitRouteObjectiveRequiredThisFloor,
        reward: run.traitRouteObjectiveRewardClaimedThisFloor
            ? 'Reward claimed'
            : getTraitRouteObjectiveRewardText(run)
    };
};
