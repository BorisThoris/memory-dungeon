import {
    GAME_RULES_VERSION,
    type FloorArchetypeId,
    type FloorTag
} from './contracts';
import {
    ENDLESS_CYCLE_FLOOR_COUNT,
    getChapterActBiomePresentation,
    pickFloorScheduleEntry
} from './floor-mutator-schedule';
import { getEncounterIdentityForFloor } from './boss-encounters';
import {
    runBalanceSimulation,
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
    encounterRank: 'boss' | null;
    bossDistance: number;
    status: 'coherent' | 'needs_attention';
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
        const act = getChapterActBiomePresentation(schedule.cycleFloor ?? floor);
        const encounter = getEncounterIdentityForFloor(schedule);
        const expectedBoss = schedule.floorTag === 'boss';
        return {
            floor,
            cycleFloor: schedule.cycleFloor ?? floor,
            actTitle: act.actTitle,
            actProgress: act.actProgress,
            floorTag: schedule.floorTag,
            floorArchetypeId: schedule.floorArchetypeId,
            expectedBoss,
            encounterRank: encounter?.encounterRank ?? null,
            bossDistance: Math.max(0, nextScheduledBossFloor(floor) - floor),
            status: expectedBoss === (encounter?.encounterRank === 'boss') ? 'coherent' : 'needs_attention'
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
    const rows = getLongRunFatigueRows(report);
    const issues = rows
        .filter((row) => row.status !== 'within_range')
        .map((row) => `${row.key}:${row.value} outside ${row.targetMin}-${row.targetMax}`);
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
