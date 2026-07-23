import { MAX_COMBO_SHARDS, type BoardState, type RunState } from './contracts';
import {
    formatTileTraitInteractionTags,
    getBoardTraitInteractionPreviewLines,
    type TileTraitInteractionTag
} from './tile-trait-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { normalizeSessionStats } from './session-stats-rules';
import { getTraitOpportunitySummary } from './trait-opportunities';

export const TRAIT_ROUTE_OBJECTIVE_SCORE_REWARD = 25;

const traitRouteTags = (value: unknown): TileTraitInteractionTag[] => Array.isArray(value) ? value : [];

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

export interface TraitRouteObjectiveStatus {
    actionLabel: string;
    active: boolean;
    completed: boolean;
    detail: string;
    label: string;
    progress: number;
    remaining: number;
    required: number;
    reward: string;
    stateLabel: string;
    urgency: 'idle' | 'building' | 'next' | 'paid';
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
    normalizeSessionStats(run.stats).comboShards < MAX_COMBO_SHARDS
        ? '+1 combo shard'
        : `+${TRAIT_ROUTE_OBJECTIVE_SCORE_REWARD} score`;

export const applyTraitRouteObjectiveProgress = (
    run: RunState,
    interactionTags: readonly TileTraitInteractionTag[]
): TraitRouteObjectiveApplyResult => {
    const required = runNonNegativeInteger(run.traitRouteObjectiveRequiredThisFloor);
    const currentProgress = runNonNegativeInteger(run.traitRouteObjectiveProgressThisFloor);
    const comboShards = normalizeSessionStats(run.stats).comboShards;
    const active = required > 0;
    const triggeredTags = traitRouteTags(run.traitRouteObjectiveTriggeredTagsThisFloor);
    const newTags = [...new Set(interactionTags)].filter(
        (tag) => !triggeredTags.includes(tag)
    );
    if (!active || newTags.length === 0) {
        return {
            runPatch: {
                traitRouteObjectiveCompletedThisFloor: run.traitRouteObjectiveCompletedThisFloor,
                traitRouteObjectiveProgressThisFloor: currentProgress,
                traitRouteObjectiveRewardClaimedThisFloor: run.traitRouteObjectiveRewardClaimedThisFloor,
                traitRouteObjectiveRewardTextThisFloor: run.traitRouteObjectiveRewardTextThisFloor,
                traitRouteObjectiveTriggeredTagsThisFloor: [...triggeredTags]
            },
            comboShardGain: 0,
            scoreBonus: 0,
            feedback: null
        };
    }

    const progress = Math.min(required, currentProgress + newTags.length);
    const completed = progress >= required;
    const claimReward = completed && !run.traitRouteObjectiveRewardClaimedThisFloor;
    const comboShardGain = claimReward && comboShards < MAX_COMBO_SHARDS ? 1 : 0;
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
                ...triggeredTags,
                ...newTags
            ]
        },
        comboShardGain,
        scoreBonus,
        feedback: `Trait route ${progress}/${required}: ${routeText}${
            rewardText ? ` (${rewardText})` : ''
        }`
    };
};

export const getTraitRouteObjectiveStatus = (run: RunState): TraitRouteObjectiveStatus | null => {
    const required = runNonNegativeInteger(run.traitRouteObjectiveRequiredThisFloor);
    if (required <= 0) {
        return null;
    }
    const progress = Math.min(runNonNegativeInteger(run.traitRouteObjectiveProgressThisFloor), required);
    const completed = run.traitRouteObjectiveCompletedThisFloor;
    const remaining = Math.max(0, required - progress);
    const urgency: TraitRouteObjectiveStatus['urgency'] = completed
        ? 'paid'
        : remaining <= 1
          ? 'next'
          : progress > 0
            ? 'building'
            : 'idle';
    const actionLabel =
        urgency === 'paid'
            ? 'Route paid'
            : urgency === 'next'
              ? 'Cash next route'
              : urgency === 'building'
                ? 'Keep routing'
                : 'Start route';
    const stateLabel =
        urgency === 'paid'
            ? 'Cashout claimed'
            : urgency === 'next'
              ? 'One route to cashout'
              : urgency === 'building'
                ? `${remaining} routes to cashout`
                : 'Find trait route';
    return {
        actionLabel,
        active: true,
        completed,
        detail: `Trigger trait routes (${progress}/${required}).`,
        label: 'Trait routes',
        progress,
        remaining,
        required,
        reward: run.traitRouteObjectiveRewardClaimedThisFloor
            ? run.traitRouteObjectiveRewardTextThisFloor ?? 'Trait route cashout'
            : getTraitRouteObjectiveRewardText(run),
        stateLabel,
        urgency
    };
};
