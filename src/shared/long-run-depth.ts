import {
    GAME_RULES_VERSION,
    type DungeonRunNodeKind,
    type FloorArchetypeId,
    type FloorTag,
    type RouteNodeType
} from './contracts';
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

export interface LongRunSoakReport {
    rulesVersion: number;
    seeds: number[];
    floors: number;
    rows: LongRunStatusRow[];
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

export const getLongRunFatigueRows = (report: BalanceSimulationReport): LongRunStatusRow[] => {
    const samples = report.samples;
    const breatherSpacing =
        report.aggregate.breatherFloors > 0 ? Number((samples.length / report.aggregate.breatherFloors).toFixed(2)) : samples.length;
    /*
     * Fatigue used to be measured two ways here that it no longer can be: hazard-and-patrol
     * pressure, and contact-and-enemy pressure. Both summed counters the dungeon layer wrote, and
     * both would read nought against minimums of 2.5 and 1.5 on every floor of every seed forever.
     *
     * Their question is still the right one - does a long run get monotonous - and Phase 2 answers
     * it with par and the pair curve rather than with things that bite. Until then, what is left
     * measures the one cadence a long run still has: breathers. The currency-inflow row went in
     * Gen 174 with the gold it was watching, the relic-offer row in Gen 175 with the draft, and
     * keys had already gone with the dungeon cards.
     */
    return [
        longRunRow('breather_spacing', 'Average floors between breather floors', breatherSpacing, 3, 5, 'scheduled breather count')
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
            'max_profile_at_risk_streak',
            'Longest repeated at-risk floor streak in any balance profile',
            Math.max(...profileReport.profiles.map((profile) => profile.maxAtRiskStreak)),
            0,
            profileReport.bounds.maxAtRiskStreak,
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
        ok: issues.length === 0,
        issues,
        offlineOnly: true
    };
};
