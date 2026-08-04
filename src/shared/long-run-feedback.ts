import { RECALL_FOCUS_MAX, type FindableKind, type RunState } from './contracts';
import { getFindableKindLabel, getFindableRewardCopy, getFindableSpawnWeightRows } from './findables';
import {
    getDungeonBoardPresentation,
    getDungeonBoardStatus,
    getDungeonBossReadModel,
    getDungeonObjectiveStatus
} from './dungeon-board-status';
import type { MechanicTokenId } from './mechanic-feedback';
import { getMemoryRecallFeedback } from './memory-recall-feedback';
import { getRunEconomyRows } from './run-economy';
import { runArrayCount } from './run-array-guards';
import { normalizeSessionStats } from './session-stats-rules';

export type FeedbackCauseKind =
    | 'match_reward'
    | 'hazard_trigger'
    | 'route_reward'
    | 'power_use'
    | 'objective_progress'
    | 'boss_pressure'
    | 'economy_delta'
    | 'recall_feedback'
    | 'combat_feedback'
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

export type TouchHudDetailKind = 'objective' | 'hazard' | 'boss' | 'route' | 'memory' | 'perfect_memory' | 'economy';

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
    const objective = getDungeonObjectiveStatus(run);
    const dungeon = getDungeonBoardPresentation(run);
    const pm = getPerfectMemoryAttribution(run);
    const forgottenTileCount = runArrayCount(run.forgottenTileIdsThisFloor);
    const matchedPairCount = runArrayCount(run.matchedPairKeysThisRun);

    if (objective.progress > 0 || objective.completed) {
        rows.push(
            causeRow({
                id: 'objective-progress',
                kind: 'objective_progress',
                label: 'Objective',
                summary: `${objective.progress}/${objective.required} ${objective.label}`,
                detail: objective.detail,
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

    if (run.hazardTileTriggersThisFloor > 0 || run.safeHazardWardsUsedThisFloor > 0) {
        rows.push(
            causeRow({
                id: 'hazard-events',
                kind: 'hazard_trigger',
                label: 'Hazards',
                summary: `${run.hazardTileTriggersThisFloor} triggered, ${run.safeHazardWardsUsedThisFloor} warded`,
                detail: dungeon.alertText ?? 'Hazard marks woke under the cards and changed the room pressure.',
                tokens: ['risk', run.safeHazardWardsUsedThisFloor > 0 ? 'safe' : 'armed'],
                priority: 30
            })
        );
    }

    if (run.enemyHazardHitsThisFloor > 0 || run.enemyHazardsDefeatedThisFloor > 0) {
        rows.push(
            causeRow({
                id: 'enemy-contact',
                kind: 'combat_feedback',
                label: 'Combat',
                summary: `${run.enemyHazardHitsThisFloor} contact hit(s), ${run.enemyHazardsDefeatedThisFloor} patrol(s) defeated`,
                detail:
                    run.enemyHazardHitsThisFloor > 0
                        ? 'Enemy patrol contact spent guard first, then life if no guard was available.'
                        : 'Revealed patrol pressure was cleared by safe match damage or floor completion.',
                tokens: ['risk', run.enemyHazardsDefeatedThisFloor > 0 ? 'resolved' : 'cost'],
                priority: 32
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
    const objective = getDungeonObjectiveStatus(run);
    const status = getDungeonBoardStatus(run);
    const boss = getDungeonBossReadModel(run);
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
            value: `${objective.progress}/${objective.required}`,
            detail: `${objective.label}: ${objective.detail}`,
            tokens: ['objective']
        },
        {
            id: 'hazard',
            label: 'Hazards',
            value: `${run.hazardTileTriggersThisFloor} events`,
            detail: `${status.armedTrapCount} armed trap card(s), ${status.enemyHazardCount} patrol(s), ${run.enemyHazardHitsThisFloor} contact hit(s), ${run.enemyHazardsDefeatedThisFloor} patrol defeat(s), ${run.safeHazardWardChargesThisFloor} ward charge(s) holding the room line.`,
            tokens: ['risk', 'safe']
        },
        {
            id: 'boss',
            label: 'Boss',
            value: boss ? boss.phase : 'none',
            detail: boss?.phaseCopy ?? 'No active boss read model on this floor.',
            tokens: boss ? ['risk', 'objective'] : ['safe']
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
        id: 'trap_card',
        term: 'Trap card',
        contract: 'Dungeon card pair that arms, springs on mismatches, and resolves through matching or card rules.',
        stateOwner: 'Tile.dungeonCardKind=dungeon trap',
        playerCopyRule: 'Use trap card only for dungeon-card traps, not moving hazards or tile hazards.'
    },
    {
        id: 'hazard_tile',
        term: 'Hazard tile',
        contract: 'Board tile modifier such as cascade, fragile, toll, fuse, or shuffle-snare cache.',
        stateOwner: 'Tile.tileHazardKind',
        playerCopyRule: 'Use hazard tile when the danger is attached to a normal pair.'
    },
    {
        id: 'decoy',
        term: 'Decoy',
        contract: 'Non-matching pressure tile or mutator fakeout that changes memory routing.',
        stateOwner: 'pairKey or mutator-specific board fields',
        playerCopyRule: 'Use decoy for fake pair pressure, not for hidden rewards.'
    },
    {
        id: 'enemy_patrol',
        term: 'Enemy patrol',
        contract: 'Moving enemy hazard that advances after actions and can occupy cards.',
        stateOwner: 'BoardState.enemyHazards',
        playerCopyRule: 'Use patrol for moving board hazards, not enemy card pairs.'
    },
    {
        id: 'route_special',
        term: 'Route special',
        contract: 'Route-world modifier or reward carried by a pair.',
        stateOwner: 'Tile.routeSpecialKind or Tile.routeCardKind',
        playerCopyRule: 'Use route special for route rewards and route risks.'
    },
    {
        id: 'dungeon_card',
        term: 'Dungeon card',
        contract: 'Dungeon-specific exit, key, shop, room, trap, enemy, treasure, lock, lever, or gateway card.',
        stateOwner: 'Tile.dungeonCardKind',
        playerCopyRule: 'Use dungeon card for card-family identity before naming a subtype.'
    },
    {
        id: 'objective',
        term: 'Objective',
        contract: 'Floor goal with progress, completion, and HUD detail.',
        stateOwner: 'BoardState.dungeonObjectiveId plus getDungeonObjectiveStatus',
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
