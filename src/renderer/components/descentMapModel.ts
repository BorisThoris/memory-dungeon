import type { RunState } from '../../shared/contracts';
import { descentLengthFor } from '../../shared/descent-length-rules';
import { actLevelsFor, DESCENT_ACTS, type DescentActId } from '../../shared/floor-mutator-schedule';
import { descentActBossName, nextMilestone } from '../../shared/milestone-rules';
import { runNonNegativeInteger } from '../../shared/run-number-guards';

/**
 * The Descent as a map (docs/MARKET_FLOW_REVIEW_WIDER.md, P2): the four acts in order, how far
 * into them the run is, the act bosses and the Warden ahead. Market leaders with a long run show
 * the road (a level map, a path of nodes); this game named only the next milestone, on the run bar.
 *
 * Read from the same rules the run uses (`actLevelsFor`, `descentLengthFor`, `nextMilestone`),
 * so the shorter Descent of rules 93 draws as forty floors and an older run as sixty, and the fast
 * test pace needs nothing of its own.
 */
export type DescentMapActState = 'cleared' | 'current' | 'ahead';

export interface DescentMapAct {
    readonly id: DescentActId;
    readonly title: string;
    readonly firstLevel: number;
    readonly lastLevel: number;
    /** The boss on the act's last floor; null for the Gate. */
    readonly bossName: string | null;
    readonly state: DescentMapActState;
    /** The share of the act's floors already cleared, 0..1. */
    readonly cleared: number;
}

export interface DescentMapModel {
    readonly acts: readonly DescentMapAct[];
    readonly floor: number;
    /** The Warden's floor: the Descent's length for this run. */
    readonly wardenFloor: number;
    /** Past the Warden, in Endless. */
    readonly endless: boolean;
    /** The next milestone and how many floors past this one it stands: 0 when it is this floor. */
    readonly next: { readonly name: string; readonly floorsAway: number };
}

export const descentMapFor = (run: Pick<RunState, 'board' | 'stats'> & Partial<Pick<RunState, 'runRulesVersion'>>): DescentMapModel => {
    const floor = Math.max(1, runNonNegativeInteger(run.board?.level ?? run.stats.highestLevel));
    const rulesVersion = run.runRulesVersion;
    const wardenFloor = descentLengthFor(rulesVersion);
    const acts = DESCENT_ACTS.map((act): DescentMapAct => {
        const { firstLevel, lastLevel } = actLevelsFor(act, rulesVersion);
        const state: DescentMapActState = floor > lastLevel ? 'cleared' : floor >= firstLevel ? 'current' : 'ahead';
        const length = lastLevel - firstLevel + 1;
        const cleared = state === 'cleared' ? 1 : state === 'ahead' ? 0 : (floor - firstLevel) / length;
        return { id: act.id, title: act.title, firstLevel, lastLevel, bossName: descentActBossName(act.id), state, cleared };
    });
    const ahead = nextMilestone(floor, rulesVersion);
    // A boss stands on its act's last floor; the Gate's milestone, the Living Dungeon, is the floor after it.
    const current = acts.find((act) => act.state === 'current');
    const arrivesOn = current?.id === 'gate' ? ahead.floor + 1 : ahead.floor;
    return {
        acts,
        floor,
        wardenFloor,
        endless: floor > wardenFloor,
        next: { name: ahead.name, floorsAway: Math.max(0, arrivesOn - floor) }
    };
};
