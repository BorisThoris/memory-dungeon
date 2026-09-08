import type { RunState, SaveData } from './contracts';
import { runNonNegativeInteger } from './run-number-guards';
import { normalizeSessionStats } from './session-stats-rules';

export type QuestCampaignStepId =
    | 'first_lantern'
    | 'scholar_oath'
    | 'timed_proof'
    | 'chain_rhythm';

export type QuestCampaignStatus = 'completed' | 'active' | 'locked' | 'failed';
export type QuestContractRetryPolicy = 'retry_next_run' | 'retry_same_mode' | 'persistent';

export interface QuestCampaignDefinition {
    id: QuestCampaignStepId;
    order: number;
    title: string;
    description: string;
    target: number;
    saveFields: string[];
    contractFlag: string | null;
    retryPolicy: QuestContractRetryPolicy;
    reward: string;
    offlineOnly: true;
}

export interface QuestCampaignRow extends QuestCampaignDefinition {
    status: QuestCampaignStatus;
    progress: { current: number; target: number };
    progressLabel: string;
    failureReason: string | null;
    retryRule: string;
}

export const QUEST_CAMPAIGN_LADDER: readonly QuestCampaignDefinition[] = [
    {
        id: 'first_lantern',
        order: 1,
        title: 'First Lantern',
        description: 'Clear any floor to prove the core loop.',
        target: 1,
        saveFields: ['achievements.ACH_FIRST_CLEAR'],
        contractFlag: null,
        retryPolicy: 'persistent',
        reward: 'Unlocks the local challenge ladder.',
        offlineOnly: true
    },
    {
        id: 'scholar_oath',
        order: 2,
        title: 'Scholar Oath',
        description: 'Reach floor 5 without disqualifying assist powers.',
        target: 5,
        saveFields: ['playerStats.bestFloorNoPowers'],
        contractFlag: 'noShuffle+noDestroy',
        retryPolicy: 'retry_next_run',
        reward: 'Ascendant honor progress.',
        offlineOnly: true
    },
    {
        id: 'timed_proof',
        order: 3,
        title: 'Timed Proof',
        description: 'Clear one floor in a run started with a clock.',
        target: 1,
        saveFields: ['lastRunSummary.gauntletSessionDurationMs', 'lastRunSummary.levelsCleared'],
        contractFlag: 'gauntletDeadlineMs',
        retryPolicy: 'retry_same_mode',
        reward: 'Timed proof progress.',
        offlineOnly: true
    },
    {
        id: 'chain_rhythm',
        order: 5,
        title: 'Chain Rhythm',
        description: 'Reach a Sharp chain on three cleared floors.',
        target: 3,
        saveFields: ['playerStats.sharpFloors'],
        contractFlag: null,
        retryPolicy: 'persistent',
        reward: 'Chain honor progress.',
        offlineOnly: true
    }
] as const;

const progressFor = (save: SaveData, id: QuestCampaignStepId): number => {
    switch (id) {
        case 'first_lantern':
            return save.achievements.ACH_FIRST_CLEAR ? 1 : 0;
        case 'scholar_oath':
            return runNonNegativeInteger(save.playerStats?.bestFloorNoPowers);
        case 'timed_proof':
            return save.lastRunSummary?.gauntletSessionDurationMs != null
                ? runNonNegativeInteger(save.lastRunSummary.levelsCleared)
                : 0;
        case 'chain_rhythm':
            return runNonNegativeInteger(save.playerStats?.sharpFloors);
        default:
            return 0;
    }
};

export const buildQuestCampaignRows = (save: SaveData): QuestCampaignRow[] => {
    return QUEST_CAMPAIGN_LADDER.map((definition) => {
        const current = Math.min(progressFor(save, definition.id), definition.target);
        const completed = current >= definition.target;
        const status: QuestCampaignStatus = completed ? 'completed' : current > 0 || save.achievements.ACH_FIRST_CLEAR ? 'active' : 'locked';
        return {
            ...definition,
            status,
            progress: { current, target: definition.target },
            progressLabel: `${current}/${definition.target}`,
            retryRule: `${definition.retryPolicy} · local save only`,
            failureReason: null
        };
    });
};

export const getQuestCampaignSummary = (
    save: SaveData
): { total: number; completed: number; active: number; locked: number; offlineOnly: true } => {
    const rows = buildQuestCampaignRows(save);
    return {
        total: rows.length,
        completed: rows.filter((row) => row.status === 'completed').length,
        active: rows.filter((row) => row.status === 'active').length,
        locked: rows.filter((row) => row.status === 'locked').length,
        offlineOnly: true
    };
};

export interface ActiveQuestContractRow {
    id: QuestCampaignStepId | 'pin_vow';
    label: string;
    status: QuestCampaignStatus;
    progressLabel: string;
    failureReason: string | null;
    retryPolicy: QuestContractRetryPolicy;
    offlineOnly: true;
}

export const buildActiveQuestContractRows = (run: RunState): ActiveQuestContractRow[] => {
    const rows: ActiveQuestContractRow[] = [];
    const stats = normalizeSessionStats(run.stats);
    if (run.activeContract?.noShuffle && run.activeContract.noDestroy) {
        const failed = run.shuffleUsedThisFloor || run.destroyUsedThisFloor;
        rows.push({
            id: 'scholar_oath',
            label: 'Scholar Oath',
            status: failed ? 'failed' : 'active',
            progressLabel: failed ? 'Contract broken this floor' : 'No shuffle / swap / destroy',
            failureReason: failed ? 'Shuffle, swap, or destroy was used; retry on the next run.' : null,
            retryPolicy: 'retry_next_run',
            offlineOnly: true
        });
    }
    if (run.activeContract?.maxPinsTotalRun != null) {
        const pinsPlacedCountThisRun = runNonNegativeInteger(run.pinsPlacedCountThisRun);
        const maxPinsTotalRun = runNonNegativeInteger(run.activeContract.maxPinsTotalRun);
        const failed = pinsPlacedCountThisRun > maxPinsTotalRun;
        rows.push({
            id: 'pin_vow',
            label: 'Pin Vow',
            status: failed ? 'failed' : 'active',
            progressLabel: `${pinsPlacedCountThisRun}/${maxPinsTotalRun} pins`,
            failureReason: failed ? 'Pin placement cap exceeded; retry on the next run.' : null,
            retryPolicy: 'retry_next_run',
            offlineOnly: true
        });
    }
    if (run.gauntletDeadlineMs != null) {
        const levelsCleared = stats.levelsCleared;
        rows.push({
            id: 'timed_proof',
            label: 'Timed Proof',
            status: levelsCleared >= 1 ? 'completed' : 'active',
            progressLabel: `${Math.min(levelsCleared, 1)}/1 timed clears`,
            failureReason: run.gauntletDeadlineMs != null && Date.now() > run.gauntletDeadlineMs ? 'Timer expired; retry the same preset.' : null,
            retryPolicy: 'retry_same_mode',
            offlineOnly: true
        });
    }
    return rows;
};

export const getQuestCampaignRows = buildQuestCampaignRows;

export const questCampaignSummary = getQuestCampaignSummary;

export const getQuestContractForRunSummary = (
    summary: { gauntletSessionDurationMs?: number | null; levelsCleared?: number } | null
): QuestCampaignStepId | null => {
    const levelsCleared = runNonNegativeInteger(summary?.levelsCleared);
    if (summary?.gauntletSessionDurationMs != null && levelsCleared >= 1) {
        return 'timed_proof';
    }
    if (levelsCleared >= 1) {
        return 'first_lantern';
    }
    return null;
};
