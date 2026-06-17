import {
    GAME_RULES_VERSION,
    type DungeonRunNodeKind,
    type FloorArchetypeId,
    type FloorTag,
    type RunShopItemId,
    type RouteNodeType
} from './contracts';
import { getBalanceSimulationEconomyLedgerRows, summarizeEconomyLedger } from './economy-ledger';
import {
    ENDLESS_CYCLE_FLOOR_COUNT,
    getChapterActBiomePresentation,
    pickFloorScheduleEntry,
    type FloorScheduleEntry
} from './floor-mutator-schedule';
import { getEncounterIdentityForFloor } from './boss-encounters';
import { buildBoard } from './board-generation';
import {
    getDungeonRouteSemanticContract,
    generateRunMapChoices,
    inspectRouteProfileBudgets,
    routeChoiceToMapNode,
    type DungeonRouteDecisionRow
} from './run-map';
import {
    assertDungeonBalanceProfilesWithinBounds,
    runBalanceSimulation,
    runDungeonBalanceProfileSimulation,
    type BalanceSimulationReport,
    type BalanceSimulationRow
} from './balance-simulation';
import { getRelicRoleAuditRows, type RelicRoleAuditRow } from './relics';

export interface LongRunStatusRow {
    key: string;
    label: string;
    value: number;
    targetMin: number;
    targetMax: number;
    status: BalanceSimulationRow['status'];
    source: string;
}

export interface LongRunActBossRow {
    floor: number;
    cycleFloor: number;
    actTitle: string;
    actProgress: string;
    floorTag: FloorTag;
    floorArchetypeId: FloorArchetypeId | null;
    expectedBoss: boolean;
    generatedBossId: string | null;
    objectiveId: string;
    encounterRank: 'boss' | 'elite' | null;
    bossDistance: number;
    status: 'coherent' | 'needs_attention';
}

export interface LongRunRoutePreviewRow extends DungeonRouteDecisionRow {
    floorTag: FloorTag;
    floorArchetypeId: FloorArchetypeId | null;
    objectiveId: string;
    likelyReward: string;
    riskBand: 'safe' | 'reward' | 'danger' | 'boss' | 'mystery';
    actualNextBoardInput: string;
}

export type LongRunShopSource = 'floor_clear_shop' | 'board_shop' | 'route_shop' | 'rest_hook' | 'event_hook' | 'treasure_hook';

export interface LongRunShopStockPool {
    source: LongRunShopSource;
    routeType: RouteNodeType | null;
    nodeKind: DungeonRunNodeKind | null;
    itemIds: RunShopItemId[];
    rerollPolicy: string;
    previewCopy: string;
}

export interface LongRunRelicDecisionRow extends RelicRoleAuditRow {
    changedDecision: string;
    uiSurface: string;
    regression: string;
}

export interface LongRunSoakReport {
    rulesVersion: number;
    seeds: number[];
    floors: number;
    rows: LongRunStatusRow[];
    economySummary: ReturnType<typeof summarizeEconomyLedger>;
    ok: boolean;
    issues: string[];
    offlineOnly: true;
}

const statusFor = (value: number, targetMin: number, targetMax: number): LongRunStatusRow['status'] =>
    value < targetMin ? 'below_range' : value > targetMax ? 'above_range' : 'within_range';

const longRunRow = (
    key: string,
    label: string,
    value: number,
    targetMin: number,
    targetMax: number,
    source: string
): LongRunStatusRow => ({
    key,
    label,
    value,
    targetMin,
    targetMax,
    status: statusFor(value, targetMin, targetMax),
    source
});

const nextScheduledBossFloor = (floor: number): number => {
    for (let offset = 0; offset <= ENDLESS_CYCLE_FLOOR_COUNT; offset += 1) {
        const candidate = floor + offset;
        if (pickFloorScheduleEntry(0, GAME_RULES_VERSION, candidate, 'endless').floorTag === 'boss') {
            return candidate;
        }
    }
    return floor;
};

const riskBandFor = (nodeKind: DungeonRunNodeKind, floorTag: FloorTag): LongRunRoutePreviewRow['riskBand'] => {
    if (floorTag === 'boss' || nodeKind === 'boss') return 'boss';
    if (nodeKind === 'elite' || nodeKind === 'trap') return 'danger';
    if (nodeKind === 'treasure' || nodeKind === 'shop' || nodeKind === 'rest') return 'reward';
    if (nodeKind === 'event') return 'mystery';
    return 'safe';
};

export const getLongRunActBossRows = ({
    seed = 42_001,
    rulesVersion = GAME_RULES_VERSION,
    floors = ENDLESS_CYCLE_FLOOR_COUNT
}: {
    seed?: number;
    rulesVersion?: number;
    floors?: number;
} = {}): LongRunActBossRow[] =>
    Array.from({ length: floors }, (_, index) => {
        const floor = index + 1;
        const schedule = pickFloorScheduleEntry(seed, rulesVersion, floor, 'endless');
        const board = buildBoard(floor, {
            runSeed: seed,
            runRulesVersion: rulesVersion,
            floorTag: schedule.floorTag,
            floorArchetypeId: schedule.floorArchetypeId,
            featuredObjectiveId: schedule.featuredObjectiveId,
            cycleFloor: schedule.cycleFloor,
            activeMutators: schedule.mutators,
            dungeonNodeKind: schedule.floorTag === 'boss' ? 'boss' : null,
            gameMode: 'endless'
        });
        const act = getChapterActBiomePresentation(schedule.cycleFloor ?? floor);
        const encounter = getEncounterIdentityForFloor(schedule);
        const expectedBoss = schedule.floorTag === 'boss';
        const generatedBossId = board.dungeonBossId ?? null;
        return {
            floor,
            cycleFloor: schedule.cycleFloor ?? floor,
            actTitle: act.actTitle,
            actProgress: act.actProgress,
            floorTag: schedule.floorTag,
            floorArchetypeId: schedule.floorArchetypeId,
            expectedBoss,
            generatedBossId,
            objectiveId: board.dungeonObjectiveId ?? 'find_exit',
            encounterRank: encounter?.encounterRank ?? null,
            bossDistance: Math.max(0, nextScheduledBossFloor(floor) - floor),
            status:
                expectedBoss === Boolean(generatedBossId) &&
                (expectedBoss ? board.dungeonObjectiveId === 'defeat_boss' && encounter?.encounterRank === 'boss' : true)
                    ? 'coherent'
                    : 'needs_attention'
        };
    });

export const getLongRunRoutePreviewRows = (
    schedule: Pick<FloorScheduleEntry, 'floorTag' | 'floorArchetypeId'>,
    choices: readonly { id: string; routeType: RouteNodeType; label: string; detail: string; rewardPreview?: string; riskPreview?: string }[],
    currentFloor: number
): LongRunRoutePreviewRow[] =>
    choices.map((choice, index) => {
        const node = routeChoiceToMapNode(choice, currentFloor + 1, index - 1);
        const semantic = getDungeonRouteSemanticContract({
            routeType: choice.routeType,
            floor: node.floor,
            nodeKind: schedule.floorTag === 'boss' ? 'boss' : node.kind
        });
        return {
            id: choice.id,
            routeType: choice.routeType,
            choiceLabel: choice.label,
            nodeLabel: node.label,
            nodeKind: semantic.nodeKind,
            glyph: node.kind === 'boss' ? 'B' : node.kind === 'elite' ? 'E' : node.kind === 'shop' ? '$' : node.kind === 'treasure' ? '*' : '?',
            tone: semantic.floorTag === 'boss' ? 'boss' : choice.routeType === 'safe' ? 'safe' : choice.routeType === 'greed' ? 'danger' : 'mystery',
            risk: choice.riskPreview ?? node.riskPreview ?? 'Stable path.',
            reward: choice.rewardPreview ?? semantic.rewardPolicy,
            mechanic: semantic.rewardPolicy,
            detail: choice.detail,
            sourceNodeId: null,
            targetFloor: node.floor,
            selected: false,
            floorTag: semantic.floorTag,
            floorArchetypeId: semantic.floorArchetypeId,
            objectiveId: semantic.objectiveId,
            likelyReward: semantic.rewardPolicy,
            riskBand: riskBandFor(semantic.nodeKind, semantic.floorTag),
            actualNextBoardInput: `${semantic.nodeKind}:${semantic.floorTag}:${semantic.floorArchetypeId ?? 'none'}:${semantic.objectiveId}`
        };
    });

export const getLongRunShopStockPools = (): LongRunShopStockPool[] => [
    {
        source: 'floor_clear_shop',
        routeType: null,
        nodeKind: null,
        itemIds: ['heal_life', 'peek_charge', 'region_shuffle_charge', 'destroy_charge', 'iron_key'],
        rerollPolicy: 'one deterministic reroll per visit',
        previewCopy: 'Floor-clear shops sell recovery, trait routing, and basic run tools.'
    },
    {
        source: 'board_shop',
        routeType: null,
        nodeKind: 'shop',
        itemIds: ['heal_life', 'peek_charge', 'region_shuffle_charge', 'destroy_charge', 'iron_key', 'master_key'],
        rerollPolicy: 'one deterministic reroll per board vendor',
        previewCopy: 'Board vendors add trait-routing and master-key depth after early floors.'
    },
    {
        source: 'route_shop',
        routeType: 'greed',
        nodeKind: 'elite',
        itemIds: ['destroy_charge', 'iron_key', 'master_key'],
        rerollPolicy: 'route-stock variation; no extra reroll count',
        previewCopy: 'Greed route shops lean toward extraction and bypass tools.'
    },
    {
        source: 'rest_hook',
        routeType: 'safe',
        nodeKind: 'rest',
        itemIds: ['heal_life', 'peek_charge', 'iron_key'],
        rerollPolicy: 'rest services do not reroll stock',
        previewCopy: 'Rest hooks rebuild life, scout information, and basic keys.'
    },
    {
        source: 'event_hook',
        routeType: 'mystery',
        nodeKind: 'event',
        itemIds: ['peek_charge', 'region_shuffle_charge', 'destroy_charge', 'iron_key'],
        rerollPolicy: 'event choices are deterministic by seed',
        previewCopy: 'Event hooks trade uncertainty for information and tactical charges.'
    },
    {
        source: 'treasure_hook',
        routeType: 'mystery',
        nodeKind: 'treasure',
        itemIds: ['iron_key', 'master_key', 'destroy_charge'],
        rerollPolicy: 'treasure stock is claim-based, not a vendor reroll',
        previewCopy: 'Treasure hooks bias toward keys and cache extraction.'
    }
];

export const getLongRunRelicDecisionRows = (): LongRunRelicDecisionRow[] =>
    getRelicRoleAuditRows().map((row) => ({
        ...row,
        changedDecision: row.impactCopy,
        uiSurface: row.decisionImpact.includes('draft_shaping')
            ? 'relic draft context'
            : row.decisionImpact.includes('route_risk')
              ? 'route choice and floor preview'
              : row.decisionImpact.includes('information_scope')
                ? 'action dock and board HUD'
                : 'run inventory and level result',
        regression: `relic-decision:${row.relicId}`
    }));

const average = (values: readonly number[]): number =>
    values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

export const getLongRunFatigueRows = (report: BalanceSimulationReport): LongRunStatusRow[] => {
    const samples = report.samples;
    const avgHazards = average(samples.map((sample) => sample.hazardTileCount + sample.movingEnemyHazards));
    const avgPressure = average(samples.map((sample) => sample.contactRisk + sample.enemyThreatPairs));
    const breatherSpacing =
        report.aggregate.breatherFloors > 0 ? Number((samples.length / report.aggregate.breatherFloors).toFixed(2)) : samples.length;
    const relicCadence =
        report.aggregate.relicOfferAvailable > 0
            ? Number((samples.length / report.aggregate.relicOfferAvailable).toFixed(2))
            : samples.length;
    const rewardInflation = average(samples.map((sample) => sample.shopGoldInflowPotential + sample.keyInflowPotential));
    return [
        longRunRow('avg_long_run_hazard_pressure', 'Average hazard and patrol pressure per floor', Number(avgHazards.toFixed(2)), 2.5, 7, 'hazard tiles + moving hazards'),
        longRunRow('avg_long_run_contact_pressure', 'Average contact and enemy pressure per floor', Number(avgPressure.toFixed(2)), 1.5, 6, 'contact risk + enemy pairs'),
        longRunRow('breather_spacing', 'Average floors between breather floors', breatherSpacing, 3, 5, 'scheduled breather count'),
        longRunRow('relic_offer_spacing', 'Average floors between relic offers', relicCadence, 2.5, 4.5, 'relic milestone cadence'),
        longRunRow('avg_reward_inflation', 'Average live currency inflow pressure per floor', Number(rewardInflation.toFixed(2)), 10, 40, 'shop gold + key inflow')
    ];
};

export const runLongRunSoak = ({
    seeds = [42_001, 42_077, 42_123],
    floors = 48,
    rulesVersion = GAME_RULES_VERSION
}: {
    seeds?: readonly number[];
    floors?: number;
    rulesVersion?: number;
} = {}): LongRunSoakReport => {
    const report = runBalanceSimulation({ seeds, floors, rulesVersion });
    const profileReport = runDungeonBalanceProfileSimulation({ seeds, floors, rulesVersion });
    const routeBudget = inspectRouteProfileBudgets(
        seeds.flatMap((seed) =>
            Array.from({ length: floors }, (_, index) =>
                generateRunMapChoices({ runSeed: seed, rulesVersion, currentFloor: index + 1 })
            ).flat()
        )
    );
    const fatigueRows = getLongRunFatigueRows(report);
    const profileRows = [
        longRunRow(
            'min_profile_lives_remaining',
            'Lowest carried-life balance profile floor',
            Math.min(...profileReport.profiles.map((profile) => profile.minLivesRemaining)),
            profileReport.bounds.minLivesRemaining,
            5,
            'runDungeonBalanceProfileSimulation'
        ),
        longRunRow(
            'max_profile_run_falls',
            'Most run falls in any balance profile',
            Math.max(...profileReport.profiles.map((profile) => profile.runFalls)),
            0,
            profileReport.bounds.maxRunFalls,
            'runDungeonBalanceProfileSimulation'
        ),
        longRunRow(
            'max_profile_healing_purchase_share',
            'Largest heal spend share in any balance profile',
            Math.max(...profileReport.profiles.map((profile) => profile.healingPurchaseShare)),
            0,
            profileReport.bounds.maxHealingPurchaseShare,
            'runDungeonBalanceProfileSimulation'
        ),
        longRunRow(
            'max_profile_at_risk_streak',
            'Longest repeated at-risk floor streak in any balance profile',
            Math.max(...profileReport.profiles.map((profile) => profile.maxAtRiskStreak)),
            0,
            profileReport.bounds.maxAtRiskStreak,
            'runDungeonBalanceProfileSimulation'
        ),
        longRunRow(
            'max_profile_ending_gold_per_floor',
            'Largest carried ending wallet per simulated floor',
            Number(
                Math.max(
                    ...profileReport.profiles.map((profile) => profile.endingShopGold / profileReport.base.samples.length)
                ).toFixed(2)
            ),
            0,
            profileReport.bounds.maxEndingShopGoldPerFloor,
            'runDungeonBalanceProfileSimulation'
        ),
        longRunRow(
            'max_profile_gold_held_per_floor',
            'Largest peak wallet held per seed-floor span',
            Number(
                Math.max(
                    ...profileReport.profiles.map((profile) => profile.maxShopGoldHeld / profileReport.base.floors)
                ).toFixed(2)
            ),
            0,
            profileReport.bounds.maxShopGoldHeldPerFloor,
            'runDungeonBalanceProfileSimulation'
        ),
        longRunRow(
            'min_profile_worst_seed_clear_share',
            'Lowest per-seed clear share across balance profiles',
            Number(Math.min(...profileReport.profiles.map((profile) => profile.worstSeedFloorsClearedShare)).toFixed(2)),
            profileReport.bounds.minWorstSeedFloorsClearedShare,
            1,
            'runDungeonBalanceProfileSimulation'
        ),
        longRunRow(
            'max_profile_worst_seed_low_life_share',
            'Largest per-seed low-life exposure share across balance profiles',
            Number(Math.max(...profileReport.profiles.map((profile) => profile.worstSeedLowLifeFloorShare)).toFixed(2)),
            0,
            profileReport.bounds.maxWorstSeedLowLifeFloorShare,
            'runDungeonBalanceProfileSimulation'
        ),
        longRunRow(
            'max_profile_worst_seed_unhealed_low_life_share',
            'Largest per-seed low-life exposure without immediate healing access',
            Number(
                Math.max(...profileReport.profiles.map((profile) => profile.worstSeedUnhealedLowLifeFloorShare)).toFixed(2)
            ),
            0,
            profileReport.bounds.maxWorstSeedUnhealedLowLifeFloorShare,
            'runDungeonBalanceProfileSimulation'
        ),
        longRunRow(
            'max_profile_unhealed_low_life_streak',
            'Longest low-life streak without immediate healing access',
            Math.max(...profileReport.profiles.map((profile) => profile.maxUnhealedLowLifeStreak)),
            0,
            profileReport.bounds.maxUnhealedLowLifeStreak,
            'runDungeonBalanceProfileSimulation'
        ),
        longRunRow(
            'max_profile_seed_clear_spread',
            'Largest best-versus-worst seed clear spread across balance profiles',
            Number(Math.max(...profileReport.profiles.map((profile) => profile.seedFloorClearShareSpread)).toFixed(2)),
            0,
            profileReport.bounds.maxSeedFloorClearShareSpread,
            'runDungeonBalanceProfileSimulation'
        )
    ];
    const routeRows = routeBudget.rows.map((row) =>
        longRunRow(
            `route_share_${row.routeType}`,
            `${row.routeType} route share in long-run sample`,
            Number(row.actualShare.toFixed(2)),
            row.minShare,
            row.maxShare,
            'inspectRouteProfileBudgets'
        )
    );
    const rows = [...fatigueRows, ...profileRows, ...routeRows];
    const economySummary = summarizeEconomyLedger(getBalanceSimulationEconomyLedgerRows(report));
    const profileBounds = assertDungeonBalanceProfilesWithinBounds(profileReport);
    const issues = [
        ...rows.filter((row) => row.status !== 'within_range').map((row) => `${row.key}:${row.value} outside ${row.targetMin}-${row.targetMax}`),
        ...profileBounds.issues
    ];
    return {
        rulesVersion,
        seeds: [...seeds],
        floors,
        rows,
        economySummary,
        ok: issues.length === 0,
        issues,
        offlineOnly: true
    };
};
