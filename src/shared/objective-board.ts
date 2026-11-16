import { tr } from './i18n';
import type { RunState, SaveData } from './contracts';
import { runNonNegativeInteger } from './run-number-guards';

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

export const buildObjectiveBoardRows = (save: SaveData): ObjectiveBoardRow[] => {
    const ps = save.playerStats;
    const bestNoPowers = runNonNegativeInteger(ps?.bestFloorNoPowers);
    const sharpFloors = runNonNegativeInteger(ps?.sharpFloors);

    return [
        {
            id: 'first_clear',
            title: tr.s('First clear'),
            description: tr.s('Clear any floor of any run.'),
            status: save.achievements.ACH_FIRST_CLEAR ? 'completed' : 'active',
            progress: save.achievements.ACH_FIRST_CLEAR ? '1/1' : '0/1',
            reward: tr.s('First Lantern achievement')
        },
        {
            id: 'no_powers_floor_5',
            title: tr.s('No-powers floor 5'),
            description: tr.s('Reach floor 5 without disqualifying assist powers.'),
            status: bestNoPowers >= 5 ? 'completed' : save.achievements.ACH_FIRST_CLEAR ? 'active' : 'locked',
            progress: `${Math.min(bestNoPowers, 5)}/5`,
            reward: tr.s('Ascendant honor')
        },
        {
            id: 'sharp_floor',
            title: tr.s('Sharp floor'),
            description: tr.s('Clear a floor whose chain reached Sharp.'),
            status: sharpFloors >= 1 ? 'completed' : save.achievements.ACH_FIRST_CLEAR ? 'active' : 'locked',
            progress: `${Math.min(sharpFloors, 1)}/1`,
            reward: tr.s('Sharp rhythm honor progress')
        }
    ];
};

export const getObjectiveBoardItems = (save: SaveData): ObjectiveBoardItem[] => {
    const ps = save.playerStats;
    const firstClear = save.achievements.ACH_FIRST_CLEAR;
    const sharpFloors = runNonNegativeInteger(ps?.sharpFloors);
    const bestNoPowers = runNonNegativeInteger(ps?.bestFloorNoPowers);
    return [
        {
            id: 'first_clear',
            title: tr.s('First clear'),
            description: tr.s('Clear any floor of any run.'),
            status: firstClear ? 'completed' : 'active',
            progress: { current: firstClear ? 1 : 0, target: 1 },
            reward: tr.s('First Lantern achievement')
        },
        {
            id: 'no_powers_floor_5',
            title: tr.s('No-powers floor 5'),
            description: tr.s('Reach floor 5 without disqualifying assist powers.'),
            status: bestNoPowers >= 5 ? 'completed' : 'active',
            progress: { current: Math.min(bestNoPowers, 5), target: 5 },
            reward: tr.s('Ascendant honor')
        },
        {
            id: 'sharp_three',
            title: tr.s('Sharp rhythm'),
            description: tr.s('Clear three floors whose chain reached Sharp.'),
            status: sharpFloors >= 3 ? 'completed' : 'active',
            progress: { current: Math.min(sharpFloors, 3), target: 3 },
            reward: tr.s('Sharp rhythm honor progress')
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
            label: tr.s('Featured objective'),
            state: run.lastLevelResult?.featuredObjectiveCompleted === false ? 'failed' : 'active',
            detail: run.board.featuredObjectiveId
        });
    }
    if (run.activeContract?.noShuffle) {
        const failed = run.shuffleUsedThisFloor;
        rows.push({
            id: 'scholar_contract',
            label: tr.s('Scholar contract'),
            state: failed ? 'failed' : 'active',
            detail: failed ? tr.s('Shuffle/swap/destroy used this floor') : tr.s('No shuffle, swap, or destroy')
        });
    }
    if (run.activeContract?.maxPinsTotalRun != null) {
        const pinsPlacedCountThisRun = runNonNegativeInteger(run.pinsPlacedCountThisRun);
        const maxPinsTotalRun = runNonNegativeInteger(run.activeContract.maxPinsTotalRun);
        rows.push({
            id: 'pin_vow',
            label: tr.s('Pin vow'),
            state: pinsPlacedCountThisRun > maxPinsTotalRun ? 'failed' : 'active',
            detail: tr`${pinsPlacedCountThisRun}/${maxPinsTotalRun} pins`
        });
    }
    return rows;
};
