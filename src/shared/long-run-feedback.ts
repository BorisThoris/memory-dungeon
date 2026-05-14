import { FINDABLE_KIND_SPAWN_WEIGHTS, type FindableKind, type RunState } from './contracts';
import { getFindableKindLabel, getFindableRewardCopy } from './findables';
import {
    getDungeonBoardPresentation,
    getDungeonBoardStatus,
    getDungeonBossReadModel,
    getDungeonObjectiveStatus
} from './game';
import type { MechanicTokenId } from './mechanic-feedback';
import { getRunEconomyRows } from './run-economy';

export type FeedbackCauseKind =
    | 'match_reward'
    | 'hazard_trigger'
    | 'route_reward'
    | 'power_use'
    | 'objective_progress'
    | 'boss_pressure'
    | 'economy_delta'
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

export type TouchHudDetailKind = 'objective' | 'hazard' | 'boss' | 'route' | 'perfect_memory' | 'economy';

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

    const actions: string[] = [];
    if (run.gambitThirdFlipUsed) actions.push('gambit');
    if (run.shuffleUsedThisFloor || run.stats.shufflesUsed > 0) actions.push('shuffle');
    if (run.stats.pairsDestroyed > 0) actions.push('destroy pair');
    if (run.peekRevealedTileIds.length > 0) actions.push('peek');
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
    const objective = getDungeonObjectiveStatus(run);
    const dungeon = getDungeonBoardPresentation(run);
    const pm = getPerfectMemoryAttribution(run);

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
                detail: 'Matched carrier pairs paid their findable rewards.',
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
                detail: dungeon.alertText ?? 'Hazard events changed board pressure this floor.',
                tokens: ['risk', run.safeHazardWardsUsedThisFloor > 0 ? 'safe' : 'armed'],
                priority: 30
            })
        );
    }

    if (run.matchedPairKeysThisRun.length > 0) {
        rows.push(
            causeRow({
                id: 'latest-match-route',
                kind: 'route_reward',
                label: 'Route',
                summary: `${run.matchedPairKeysThisRun.length} pair(s) resolved this run`,
                detail:
                    run.pendingRouteCardPlan?.routeType != null
                        ? `${run.pendingRouteCardPlan.routeType} route plan is pending.`
                        : 'Resolved matches may advance route cards, exits, or local rewards.',
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

    if (run.shopGold > 0 || run.stats.comboShards > 0 || run.stats.guardTokens > 0) {
        rows.push(
            causeRow({
                id: 'economy',
                kind: 'economy_delta',
                label: 'Economy',
                summary: `${run.shopGold} gold, ${run.stats.comboShards}/2 shards, ${run.stats.guardTokens}/2 guard`,
                detail: 'Temporary run resources changed through matches, route cards, shops, or pickups.',
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
            detail: `${status.armedTrapCount} armed trap card(s), ${status.enemyHazardCount} patrol(s), ${run.safeHazardWardChargesThisFloor} ward charge(s).`,
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
    const totalWeight = Object.values(FINDABLE_KIND_SPAWN_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
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

    return (Object.keys(FINDABLE_KIND_SPAWN_WEIGHTS) as FindableKind[]).map((kind) => ({
        id: kind,
        label: getFindableKindLabel(kind),
        spawnWeight: FINDABLE_KIND_SPAWN_WEIGHTS[kind],
        targetShare: totalWeight > 0 ? FINDABLE_KIND_SPAWN_WEIGHTS[kind] / totalWeight : 0,
        claimedTotalThisFloor: run.findablesClaimedThisFloor,
        totalThisFloor: totalKinds.get(kind) ?? 0
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
    {
        id: 'ward_cache',
        label: 'Ward cache: future safe hazard/reward candidate',
        surface: 'hazard_reward_contract',
        objectiveImpact: 'Documented as a read-model-only candidate until hazard runtime tuning is separately versioned.',
        perfectMemoryImpact: 'neutral',
        runtimeStatus: 'read_model_only'
    }
] as const;

export const WARD_CACHE_CONTRACT_ROW = SAFE_EXPANSION_IMPACT_ROWS.find((row) => row.id === 'ward_cache')!;
