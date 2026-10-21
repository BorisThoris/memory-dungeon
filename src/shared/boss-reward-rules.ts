import type { BossReward, RealmSeverity, RunState } from './contracts';
import { nextDescentLevel } from './descent-pace-rules';
import { isActBossFloor } from './floor-mutator-schedule';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * Boss rewards by the door (DGE-026, rules 75): a boss pays for the risk the player chose to meet it at.
 *
 * Doors were retired between ordinary floors - a run travels to a seeded realm - and come back on one
 * clear only: the one before an act boss (24, 40, 60, and each Endless act's). Three doors, calm, wild
 * and raging, and the door taken sets how hard the boss floor's weather blows and what the boss gives
 * when it falls:
 *
 * - **calm**: the clear, nothing more;
 * - **wild**: `BOSS_WILD_GOLD` gold on top of the clear;
 * - **raging**: the next blueprint (`BLUEPRINT_ORDER`), the evolutions DGE-014 builds on. They drop in
 *   order whichever boss drops them, so a later boss beaten first on raging still gives the first one;
 *   with every blueprint held, raging pays the wild gold.
 *
 * Why a choice and not a seed: in the replay research the pack rests on (`05-research-report-
 * engineering-addiction.md`), autonomy - a meaningful choice - predicts the wish to play again more
 * than anything else measured; Dead Cells throttles its boss blueprints by the difficulty the player
 * opts into. The owner asked for what the research favours (2026-10-21).
 *
 * Deterministic: the reward reads the boss floor's severity and the blueprints held, nothing rolled.
 */
export const BOSS_REWARD_RULES_FROM = 75;
export const BOSS_WILD_GOLD = 12;
export const BLUEPRINT_ORDER = [
    'lantern_of_recall',
    'misers_vault',
    'cartographers_thread',
    'keystone_heart',
    'unmasking_glass',
    'echo_chamber'
] as const;
export type BlueprintId = (typeof BLUEPRINT_ORDER)[number];

export const isBlueprintId = (value: unknown): value is BlueprintId => (BLUEPRINT_ORDER as readonly unknown[]).includes(value);

/** The run's blueprints, in the order they dropped, unknown ids dropped. */
export const runBlueprints = (run: Pick<RunState, 'blueprints'>): BlueprintId[] => (run.blueprints ?? []).filter(isBlueprintId);

/** Whether this clear offers doors: the next floor (on the test pace too) is an act boss. */
export const offersBossDoors = (run: Pick<RunState, 'runRulesVersion' | 'descentPace' | 'board'>): boolean =>
    (run.runRulesVersion ?? 0) >= BOSS_REWARD_RULES_FROM && !!run.board && isActBossFloor(nextDescentLevel(run));

/** What a boss gives at a severity, with the blueprints already held. */
export const bossRewardFor = (severity: RealmSeverity, held: readonly BlueprintId[]): BossReward => {
    if (severity === 'calm') return { kind: 'clear' };
    if (severity === 'raging') {
        const next = BLUEPRINT_ORDER.find((id) => !held.includes(id));
        if (next) return { kind: 'blueprint', blueprint: next };
    }
    return { kind: 'gold', gold: BOSS_WILD_GOLD };
};

/** Applied at an act boss's clear (`finalizeLevel`): the reward for the severity the floor was met at. */
export const applyBossReward = (run: RunState, level: number, severity: RealmSeverity | null): RunState => {
    if ((run.runRulesVersion ?? 0) < BOSS_REWARD_RULES_FROM || !isActBossFloor(level) || severity == null) return run;
    const reward = bossRewardFor(severity, runBlueprints(run));
    if (reward.kind === 'clear') return { ...run, lastBossReward: reward };
    if (reward.kind === 'gold') return { ...run, gold: runNonNegativeInteger(run.gold ?? 0) + reward.gold, lastBossReward: reward };
    return { ...run, blueprints: [...runBlueprints(run), reward.blueprint], lastBossReward: reward };
};
