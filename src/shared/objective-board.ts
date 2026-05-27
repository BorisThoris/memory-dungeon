import type { RunState, SaveData } from './contracts';

export type ObjectiveBoardStatus = 'active' | 'completed' | 'locked';

export interface ObjectiveBoardRow {
    id: string;
    title: string;
    description: string;
    status: ObjectiveBoardStatus;
    progress: string;
    reward: string;
}

export interface ObjectiveBoardItem {
    id: string;
    title: string;
    description: string;
    status: ObjectiveBoardStatus;
    progress: { current: number; target: number };
    reward: string;
}

const relicPickTotal = (save: SaveData): number =>
    Object.values(save.playerStats?.relicPickCounts ?? {}).reduce((sum, count) => sum + (count ?? 0), 0);

export const buildObjectiveBoardRows = (save: SaveData): ObjectiveBoardRow[] => {
    const ps = save.playerStats;
    const last = save.lastRunSummary;
    const dailies = ps?.dailiesCompleted ?? 0;
    const bestNoPowers = ps?.bestFloorNoPowers ?? 0;
    const relicPicks = relicPickTotal(save);
    const gauntletClears = last?.gameMode === 'gauntlet' ? (last.levelsCleared ?? 0) : 0;

    return [
        {
            id: 'first_clear',
            title: 'First clear',
            description: 'Complete any floor in any non-debug run.',
            status: save.achievements.ACH_FIRST_CLEAR ? 'completed' : 'active',
            progress: save.achievements.ACH_FIRST_CLEAR ? '1/1' : '0/1',
            reward: 'First Lantern achievement'
        },
        {
            id: 'no_powers_floor_5',
            title: 'No-powers floor 5',
            description: 'Reach floor 5 without disqualifying assist powers.',
            status: bestNoPowers >= 5 ? 'completed' : save.achievements.ACH_FIRST_CLEAR ? 'active' : 'locked',
            progress: `${Math.min(bestNoPowers, 5)}/5`,
            reward: 'Ascendant honor'
        },
        {
            id: 'daily_initiate',
            title: 'Daily initiate',
            description: 'Clear a Daily Challenge floor.',
            status: dailies >= 1 ? 'completed' : save.achievements.ACH_FIRST_CLEAR ? 'active' : 'locked',
            progress: `${Math.min(dailies, 1)}/1`,
            reward: 'Daily honor and streak progress'
        },
        {
            id: 'relic_habit',
            title: 'Relic habit',
            description: 'Pick relics across local runs.',
            status: relicPicks >= 10 ? 'completed' : save.achievements.ACH_FIRST_CLEAR ? 'active' : 'locked',
            progress: `${Math.min(relicPicks, 10)}/10`,
            reward: 'Relic habit honor'
        },
        {
            id: 'gauntlet_proof',
            title: 'Gauntlet proof',
            description: 'Clear at least one floor in a Gauntlet run.',
            status: gauntletClears >= 1 ? 'completed' : save.achievements.ACH_FIRST_CLEAR ? 'active' : 'locked',
            progress: `${Math.min(gauntletClears, 1)}/1`,
            reward: 'Gauntlet proof honor'
        }
    ];
};

export const getObjectiveBoardItems = (save: SaveData): ObjectiveBoardItem[] => {
    const ps = save.playerStats;
    const firstClear = save.achievements.ACH_FIRST_CLEAR;
    const dailies = ps?.dailiesCompleted ?? 0;
    const bestNoPowers = ps?.bestFloorNoPowers ?? 0;
    return [
        {
            id: 'first_clear',
            title: 'First clear',
            description: 'Complete any floor in any non-debug run.',
            status: firstClear ? 'completed' : 'active',
            progress: { current: firstClear ? 1 : 0, target: 1 },
            reward: 'First Lantern achievement'
        },
        {
            id: 'no_powers_floor_5',
            title: 'No-powers floor 5',
            description: 'Reach floor 5 without disqualifying assist powers.',
            status: bestNoPowers >= 5 ? 'completed' : 'active',
            progress: { current: Math.min(bestNoPowers, 5), target: 5 },
            reward: 'Ascendant honor'
        },
        {
            id: 'daily_three',
            title: 'Daily rhythm',
            description: 'Clear three Daily Challenge floors.',
            status: dailies >= 3 ? 'completed' : 'active',
            progress: { current: Math.min(dailies, 3), target: 3 },
            reward: 'Daily streak honor'
        },
        {
            id: 'relic_shrine_extra',
            title: 'Week of Archives',
            description: 'Clear seven daily floors to make +1 relic pick at each shrine claimable.',
            status: (ps?.relicShrineExtraPickUnlocked ?? false) ? 'completed' : dailies >= 3 ? 'active' : 'locked',
            progress: { current: Math.min(dailies, 7), target: 7 },
            reward: '+1 relic selection at milestones'
        }
    ];
};

export const objectiveBoardSummary = (
    save: SaveData
): { total: number; completed: number; active: number; locked: number } => {
    const items = getObjectiveBoardItems(save);
    return {
        total: items.length,
        completed: items.filter((item) => item.status === 'completed').length,
        active: items.filter((item) => item.status === 'active').length,
        locked: items.filter((item) => item.status === 'locked').length
    };
};

export interface RunObjectiveProgressRow {
    id: string;
    label: string;
    state: 'active' | 'complete' | 'failed';
    detail: string;
}

export const buildRunObjectiveProgressRows = (run: RunState): RunObjectiveProgressRow[] => {
    const rows: RunObjectiveProgressRow[] = [];
    if (run.board?.featuredObjectiveId) {
        rows.push({
            id: `featured_${run.board.featuredObjectiveId}`,
            label: 'Featured objective',
            state: run.lastLevelResult?.featuredObjectiveCompleted === false ? 'failed' : 'active',
            detail: run.board.featuredObjectiveId
        });
    }
    if (run.activeContract?.noShuffle && run.activeContract.noDestroy) {
        const failed = run.shuffleUsedThisFloor || run.destroyUsedThisFloor;
        rows.push({
            id: 'scholar_contract',
            label: 'Scholar contract',
            state: failed ? 'failed' : 'active',
            detail: failed ? 'Shuffle/destroy used this floor' : 'No shuffle or destroy'
        });
    }
    if (run.activeContract?.maxPinsTotalRun != null) {
        rows.push({
            id: 'pin_vow',
            label: 'Pin vow',
            state: run.pinsPlacedCountThisRun > run.activeContract.maxPinsTotalRun ? 'failed' : 'active',
            detail: `${run.pinsPlacedCountThisRun}/${run.activeContract.maxPinsTotalRun} pins`
        });
    }
    return rows;
};
