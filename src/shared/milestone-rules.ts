import { DESCENT_FLOOR_COUNT, descentActForFloor, type DescentActId } from './floor-mutator-schedule';

/**
 * Milestones (DGE-004, 2026-10-19): what the run is walking toward, read as a fraction.
 *
 * Effort follows the share left to go, and players quit right after a reward when nothing beyond it
 * is in view (`tasks/deep-game-epic/01-research-findings.md`). So the run bar, and the floor-clear
 * beat that is the reward, always name the next milestone and how far it is. A milestone is the end
 * of a Descent act: reaching the Living Dungeon, then each act's boss. Every track has an end
 * (thesis 25.11): past floor 60 the Abyss repeats until Endless has its own rule (DGE-006), and so
 * does the Warden at its end.
 */
const DESCENT_MILESTONE_NAMES: Readonly<Record<DescentActId, string>> = {
    gate: 'The Living Dungeon',
    living_dungeon: 'The Keeper of Halls',
    deep: 'The Cartographer',
    abyss: 'The Warden'
};

export interface Milestone {
    readonly name: string;
    /** The floor the milestone stands on. */
    readonly floor: number;
    /** Floors of the act played, the current one counted, and the act's length. */
    readonly floorsDone: number;
    readonly floorsTotal: number;
    /** floorsDone / floorsTotal: proportional, never an absolute count. */
    readonly fraction: number;
}

const ABYSS_LENGTH = 20;

/** The milestone a floor is walking toward. */
export const nextMilestone = (level: number): Milestone => {
    const floor = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
    const act = descentActForFloor(floor);
    // Past the Descent the Abyss repeats, so its floors are counted from the repeat they are in.
    const offset = floor <= DESCENT_FLOOR_COUNT ? 0 : DESCENT_FLOOR_COUNT + Math.floor((floor - DESCENT_FLOOR_COUNT - 1) / ABYSS_LENGTH) * ABYSS_LENGTH - (act.firstFloor - 1);
    const firstFloor = act.firstFloor + offset;
    const floorsTotal = act.lastFloor - act.firstFloor + 1;
    const floorsDone = floor - firstFloor + 1;
    return { name: DESCENT_MILESTONE_NAMES[act.id], floor: firstFloor + floorsTotal - 1, floorsDone, floorsTotal, fraction: floorsDone / floorsTotal };
};

/** After a clear: the milestone ahead of the next floor, and the floors still to clear to reach it. */
export const milestoneAfterClear = (clearedLevel: number): Milestone & { readonly floorsToGo: number } => {
    const ahead = nextMilestone(Math.max(1, Math.floor(clearedLevel)) + 1);
    return { ...ahead, floorsToGo: ahead.floor - Math.max(1, Math.floor(clearedLevel)) };
};
