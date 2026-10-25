import type { DescentRecordPersisted, RunState } from './contracts';
import { DESCENT_ACTS, descentActForLevel } from './floor-mutator-schedule';
import { DREAD_TIERS, dreadForRun, dreadTier } from './dread-rules';
import { nextMilestone } from './milestone-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { MAX_DEPTH, runDepth } from './depth-rules';

/**
 * Where a run ended, in the Descent's words (DGE-007): the act, the Dread tier, the next milestone
 * and how far it was, and what was new this run against the profile's record when it began.
 *
 * A near-miss motivates when it carries information (`01-research-findings.md`, the Wordle finding),
 * so a death at floor 38 reads "two floors from the Cartographer, in the Deep, at Watching" rather
 * than as a number. The firsts are measured against the record at the run's start, so the run that
 * first reached the Deep says so, and the tenth does not.
 */
export interface DescentRunSummary {
    readonly floor: number;
    readonly actTitle: string;
    readonly tierName: string;
    /** The boss the run was walking toward and the floors it fell short; null for a won run. */
    readonly next: { readonly name: string; readonly floorsShort: number } | null;
    readonly firsts: readonly string[];
    /** The run's Depth (`depth-rules.ts`), 0 for the game as it was. */
    readonly depth: number;
}

const actIndex = (id: string | null | undefined): number => DESCENT_ACTS.findIndex((act) => act.id === id);
const tierIndex = (id: string | null | undefined): number => DREAD_TIERS.findIndex((tier) => tier.id === id);

export const summarizeDescent = (
    run: Pick<RunState, 'board' | 'stats' | 'runEndReason' | 'dreadRagingFloors' | 'dreadWildFloors'> & Partial<Pick<RunState, 'depth' | 'runRulesVersion'>>,
    recordAtStart: DescentRecordPersisted | null
): DescentRunSummary => {
    const floor = Math.max(1, runNonNegativeInteger(run.stats.highestLevel), runNonNegativeInteger(run.board?.level));
    const act = descentActForLevel(floor, run.runRulesVersion);
    const tier = dreadTier(dreadForRun(run)).tier;
    const won = run.runEndReason === 'warden_cleared';
    const ahead = nextMilestone(floor, run.runRulesVersion);
    const firsts: string[] = [];
    if (recordAtStart) {
        if (actIndex(act.id) > 0 && actIndex(act.id) > actIndex(recordAtStart.deepestActId)) firsts.push(`first time in ${act.title}`);
        if (won && recordAtStart.wardenClears === 0) firsts.push('the first Warden felled');
        if (tierIndex(tier.id) > 0 && tierIndex(tier.id) > tierIndex(recordAtStart.deepestDreadTierId)) firsts.push(`first time at ${tier.name}`);
        if (floor > recordAtStart.deepestFloor && recordAtStart.deepestFloor > 0) firsts.push(`deepest yet, past floor ${recordAtStart.deepestFloor}`);
        if (won && runDepth(run) < MAX_DEPTH && runDepth(run) + 1 > recordAtStart.bestDepth) firsts.push(`Depth ${runDepth(run) + 1} opened`);
    }
    return {
        floor,
        actTitle: act.title,
        tierName: tier.name,
        next: won ? null : { name: ahead.name, floorsShort: Math.max(0, ahead.floor - floor) },
        firsts,
        depth: runDepth(run)
    };
};
