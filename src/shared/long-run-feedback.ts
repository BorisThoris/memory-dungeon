import { RECALL_FOCUS_MAX, type FindableKind, type RunState } from './contracts';
import { getFindableKindLabel, getFindableRewardCopy, getFindableSpawnWeightRows } from './findables';
import type { MechanicTokenId } from './mechanic-feedback';
import { getMemoryRecallFeedback } from './memory-recall-feedback';
import { getRunEconomyRows } from './run-economy';
import { runArrayCount } from './run-array-guards';
import { normalizeSessionStats } from './session-stats-rules';
import { getTraitRouteObjectiveStatus } from './trait-route-objectives';

export type FeedbackCauseKind =
    | 'match_reward'
    | 'route_reward'
    | 'power_use'
    | 'objective_progress'
    | 'economy_delta'
    | 'recall_feedback'
    | 'perfect_memory_locked';

export interface FeedbackCauseRow {
    id: string;
    kind: FeedbackCauseKind;
    label: string;
    summary: string;
    detail: string;
    tokens: readonly MechanicTokenId[];
    visible: true;
    ariaLive: string;
    priority: number;
}

export interface PerfectMemoryAttribution {
    locked: boolean;
    firstAction: string | null;
    latestAction: string | null;
    summary: string;
    tokens: readonly MechanicTokenId[];
}

export type TouchHudDetailKind = 'objective' | 'route' | 'memory' | 'perfect_memory' | 'economy';

export interface TouchHudDetailRow {
    id: TouchHudDetailKind;
    label: string;
    value: string;
    detail: string;
    tokens: readonly MechanicTokenId[];
}

export interface TerminologyContractRow {
    id: string;
    term: string;
    contract: string;
    stateOwner: string;
    playerCopyRule: string;
}

export interface SafeExpansionImpactRow {
    id: FindableKind | 'ward_cache';
    label: string;
    surface: 'findable' | 'hazard_reward_contract';
    objectiveImpact: string;
    perfectMemoryImpact: 'safe' | 'neutral';
    runtimeStatus: 'wired' | 'read_model_only';
}

const WARD_CACHE_SAFE_EXPANSION_IMPACT_ROW: SafeExpansionImpactRow = {
    id: 'ward_cache',
    label: 'Ward cache: future safe hazard/reward candidate',
    surface: 'hazard_reward_contract',
    objectiveImpact: 'Documented as a read-model-only candidate until hazard runtime tuning is separately versioned.',
    perfectMemoryImpact: 'neutral',
    runtimeStatus: 'read_model_only'
};

export interface FindableDistributionRow {
    id: FindableKind;
    label: string;
    spawnWeight: number;
    targetShare: number;
    claimedTotalThisFloor: number;
    totalThisFloor: number;
}

const causeRow = (
    row: Omit<FeedbackCauseRow, 'visible' | 'ariaLive'> & { ariaLive?: string }
): FeedbackCauseRow => ({
    ...row,
    visible: true,
    ariaLive: row.ariaLive ?? `${row.label}: ${row.summary}. ${row.detail}`
});

export const getPerfectMemoryAttribution = (run: RunState): PerfectMemoryAttribution => {
    if (!run.powersUsedThisRun) {
        return {
            locked: false,
            firstAction: null,
            latestAction: null,
            summary: 'Perfect Memory still available.',
            tokens: ['safe', 'objective']
        };
    }

    const stats = normalizeSessionStats(run.stats);
    const actions: string[] = [];
    if (run.gambitThirdFlipUsed) actions.push('gambit');
    if (run.shuffleUsedThisFloor || stats.shufflesUsed > 0) actions.push('shuffle or swap');
    if (stats.pairsDestroyed > 0) actions.push('destroy pair');
    if (runArrayCount(run.peekRevealedTileIds) > 0) actions.push('peek');
    const firstAction = actions[0] ?? 'assist or wild action';
    const latestAction = actions[actions.length - 1] ?? firstAction;

    return {
        locked: true,
        firstAction,
        latestAction,
        summary: `Perfect Memory locked by ${firstAction}.`,
        tokens: ['locked', 'forfeit']
    };
};

export const getInRunCauseRows = (run: RunState): FeedbackCauseRow[] => {
    const rows: FeedbackCauseRow[] = [];
    const stats = normalizeSessionStats(run.stats);
    const objective = getTraitRouteObjectiveStatus(run);
    const pm = getPerfectMemoryAttribution(run);
    const forgottenTileCount = runArrayCount(run.forgottenTileIdsThisFloor);
    const matchedPairCount = runArrayCount(run.matchedPairKeysThisRun);

    if (objective && (objective.progress > 0 || objective.completed)) {
        rows.push(
            causeRow({
                id: 'objective-progress',
                kind: 'objective_progress',
                label: 'Objective',
                summary: `${objective.progress}/${objective.required} ${objective.label}`,
                detail: objective.completed ? 'Trait route objective paid out.' : 'Trait routes triggered this floor count toward the objective.',
                tokens: ['objective', objective.completed ? 'resolved' : 'momentum'],
                priority: 10
            })
        );
    }

    if (run.findablesClaimedThisFloor > 0) {
        rows.push(
            causeRow({
                id: 'findables-claimed',
                kind: 'match_reward',
                label: 'Pickups',
                summary: `${run.findablesClaimedThisFloor}/${run.findablesTotalThisFloor} claimed`,
                detail: 'Matched carrier pairs shook loose their marked archive finds.',
                tokens: ['reward', 'momentum'],
                priority: 20
            })
        );
    }

    if (
        run.recallMatchesThisFloor > 0 ||
        run.recallMistakesThisFloor > 0 ||
        run.recallBonusScoreThisFloor > 0 ||
        forgottenTileCount > 0
    ) {
        const recall = getMemoryRecallFeedback(run);
        rows.push(
            causeRow({
                id: 'recall-focus',
                kind: 'recall_feedback',
                label: 'Recall',
                summary: `Focus ${recall.focus}/${RECALL_FOCUS_MAX}, +${run.recallBonusScoreThisFloor} score`,
                detail: `${run.recallMatchesThisFloor} remembered match(es), ${run.recallMistakesThisFloor} lapse(s), ${forgottenTileCount} forgotten tile marker(s) etched into the room log. ${recall.atmosphericSummary} ${recall.atmosphericBeat} Next memory move: ${recall.nextMemoryMove.label}.`,
                tokens: ['hidden_known', run.recallMistakesThisFloor > 0 ? 'risk' : 'momentum'],
                priority: 35
            })
        );
    }

    if (matchedPairCount > 0) {
        rows.push(
            causeRow({
                id: 'latest-match-route',
                kind: 'route_reward',
                label: 'Route',
                summary: `${matchedPairCount} pair(s) resolved this run`,
                detail:
                    run.pendingRouteCardPlan?.routeType != null
                        ? `${run.pendingRouteCardPlan.routeType} route plan is pending.`
                        : 'Resolved matches may open route cards, exits, or local archive rewards.',
                tokens: ['reward', 'objective'],
                priority: 40
            })
        );
    }

    if (pm.locked) {
        rows.push(
            causeRow({
                id: 'perfect-memory',
                kind: 'perfect_memory_locked',
                label: 'Perfect Memory',
                summary: pm.summary,
                detail: `Latest lock source: ${pm.latestAction}.`,
                tokens: pm.tokens,
                priority: 50
            })
        );
    }

    if (run.shopGold > 0 || stats.comboShards > 0 || stats.guardTokens > 0) {
        rows.push(
            causeRow({
                id: 'economy',
                kind: 'economy_delta',
                label: 'Economy',
                summary: `${run.shopGold} gold, ${stats.comboShards}/2 shards, ${stats.guardTokens}/2 guard`,
                detail: 'Temporary run resources shifted as caches, route cards, shops, and pickups resolved.',
                tokens: ['reward', 'cost'],
                priority: 60
            })
        );
    }

    return rows.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
};

export const getTouchHudDetailRows = (run: RunState): TouchHudDetailRow[] => {
    const objective = getTraitRouteObjectiveStatus(run);
    const economy = getRunEconomyRows(run)
        .filter((row) => ['shop_gold', 'combo_shards', 'guard_tokens', 'findable_pickups'].includes(row.id))
        .map((row) => `${row.label} ${row.value}`)
        .join(', ');
    const pm = getPerfectMemoryAttribution(run);
    const routeType = run.board?.routeWorldProfile?.routeType ?? run.pendingRouteCardPlan?.routeType ?? 'none';
    const recall = getMemoryRecallFeedback(run);

    return [
        {
            id: 'objective',
            label: 'Objective',
            value: objective ? `${objective.progress}/${objective.required}` : 'none',
            detail: objective ? `${objective.label}: ${objective.detail}` : 'No trait route objective on this floor.',
            tokens: ['objective']
        },
        {
            id: 'route',
            label: 'Route',
            value: routeType,
            detail:
                run.pendingRouteCardPlan != null
                    ? `${run.pendingRouteCardPlan.routeType} route plan queued.`
                    : 'No pending route card plan.',
            tokens: ['objective', 'reward']
        },
        {
            id: 'memory',
            label: 'Recall',
            value: `${recall.focus}/${RECALL_FOCUS_MAX}`,
            detail: `${run.recallMatchesThisFloor} remembered match(es), ${run.recallMistakesThisFloor} lapse(s), +${run.recallBonusScoreThisFloor} recall score recorded in the room log. ${recall.pressureDetail} ${recall.atmosphericBeat} Next memory move: ${recall.nextMemoryMove.detail}`,
            tokens: ['hidden_known', run.recallMistakesThisFloor > 0 ? 'risk' : 'momentum']
        },
        {
            id: 'perfect_memory',
            label: 'Perfect Memory',
            value: pm.locked ? 'locked' : 'available',
            detail: pm.summary,
            tokens: pm.tokens
        },
        {
            id: 'economy',
            label: 'Economy',
            value: `${run.shopGold} gold`,
            detail: economy,
            tokens: ['reward', 'cost']
        }
    ];
};

export const getFindableDistributionRows = (run: RunState): FindableDistributionRow[] => {
    const findableSpawnWeightRows = getFindableSpawnWeightRows();
    const totalWeight = findableSpawnWeightRows.reduce((sum, row) => sum + row.weight, 0);
    const totalKinds = new Map<FindableKind, number>();
    const tilesByPair = new Map<string, FindableKind>();

    for (const tile of run.board?.tiles ?? []) {
        if (tile.findableKind == null) {
            continue;
        }
        tilesByPair.set(tile.pairKey, tile.findableKind);
    }
    for (const kind of tilesByPair.values()) {
        totalKinds.set(kind, (totalKinds.get(kind) ?? 0) + 1);
    }

    return findableSpawnWeightRows.map((row) => ({
        id: row.id,
        label: getFindableKindLabel(row.id),
        spawnWeight: row.weight,
        targetShare: totalWeight > 0 ? row.weight / totalWeight : 0,
        claimedTotalThisFloor: run.findablesClaimedThisFloor,
        totalThisFloor: totalKinds.get(row.id) ?? 0
    }));
};

export const LONG_RUN_TERMINOLOGY_ROWS: readonly TerminologyContractRow[] = [
    {
        id: 'decoy',
        term: 'Decoy',
        contract: 'Non-matching pressure tile or mutator fakeout that changes memory routing.',
        stateOwner: 'pairKey or mutator-specific board fields',
        playerCopyRule: 'Use decoy for fake pair pressure, not for hidden rewards.'
    },
    {
        id: 'route_special',
        term: 'Route special',
        contract: 'Route-world modifier or reward carried by a pair.',
        stateOwner: 'Tile.routeSpecialKind or Tile.routeCardKind',
        playerCopyRule: 'Use route special for route rewards and route risks.'
    },
    {
        id: 'objective',
        term: 'Objective',
        contract: 'Floor goal with progress, completion, and HUD detail.',
        stateOwner: 'RunState.traitRouteObjective* counters plus getTraitRouteObjectiveStatus',
        playerCopyRule: 'Use objective for goals only, not incidental rewards.'
    }
] as const;

export const SAFE_EXPANSION_IMPACT_ROWS: readonly SafeExpansionImpactRow[] = [
    {
        id: 'ward_spark',
        label: `${getFindableKindLabel('ward_spark')}: ${getFindableRewardCopy('ward_spark')}`,
        surface: 'findable',
        objectiveImpact: 'Adds one capped safe-hazard ward charge; does not complete objectives by itself.',
        perfectMemoryImpact: 'safe',
        runtimeStatus: 'wired'
    },
    {
        id: 'scout_glint',
        label: `${getFindableKindLabel('scout_glint')}: ${getFindableRewardCopy('scout_glint')}`,
        surface: 'findable',
        objectiveImpact: 'Reveals one hazard, dungeon, or route family through the existing scout path; objective progress remains rule-driven.',
        perfectMemoryImpact: 'safe',
        runtimeStatus: 'wired'
    },
    WARD_CACHE_SAFE_EXPANSION_IMPACT_ROW
] as const;

export const WARD_CACHE_CONTRACT_ROW = WARD_CACHE_SAFE_EXPANSION_IMPACT_ROW;
