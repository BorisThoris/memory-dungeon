import type { RunState, SaveData } from './contracts';
import { normalizeSessionStats } from './session-stats-rules';

export type QuestCampaignStepId =
    | 'first_lantern'
    | 'scholar_oath'
    | 'gauntlet_proof'
    | 'daily_rhythm'
    | 'relic_apprentice';

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
        id: 'gauntlet_proof',
        order: 3,
        title: 'Gauntlet Proof',
        description: 'Clear one floor in a timed Gauntlet run.',
        target: 1,
        saveFields: ['lastRunSummary.gameMode', 'lastRunSummary.levelsCleared'],
        contractFlag: 'gauntletDeadlineMs',
        retryPolicy: 'retry_same_mode',
        reward: 'Gauntlet proof honor.',
        offlineOnly: true
    },
    {
        id: 'relic_apprentice',
        order: 5,
        title: 'Relic Apprentice',
        description: 'Pick ten relics across local runs.',
        target: 10,
        saveFields: ['playerStats.relicPickCounts'],
        contractFlag: null,
        retryPolicy: 'persistent',
        reward: 'Relic habit honor and cosmetic track progress.',
        offlineOnly: true
    },
    {
        id: 'daily_rhythm',
        order: 4,
        title: 'Daily Rhythm',
        description: 'Clear three Daily Challenge floors across local UTC days.',
        target: 3,
        saveFields: ['playerStats.dailiesCompleted', 'playerStats.lastDailyDateKeyUtc'],
        contractFlag: 'dailyDateKeyUtc',
        retryPolicy: 'persistent',
        reward: 'Daily streak honor and future campaign branch.',
        offlineOnly: true
    }
] as const;

const relicPickTotal = (save: SaveData): number =>
    Object.values(save.playerStats?.relicPickCounts ?? {}).reduce((sum, count) => sum + nonNegativeQuestCount(count), 0);

const nonNegativeQuestCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const progressFor = (save: SaveData, id: QuestCampaignStepId): number => {
    switch (id) {
        case 'first_lantern':
            return save.achievements.ACH_FIRST_CLEAR ? 1 : 0;
        case 'scholar_oath':
            return nonNegativeQuestCount(save.playerStats?.bestFloorNoPowers);
        case 'gauntlet_proof':
            return save.lastRunSummary?.gameMode === 'gauntlet' ? nonNegativeQuestCount(save.lastRunSummary.levelsCleared) : 0;
        case 'daily_rhythm':
            return nonNegativeQuestCount(save.playerStats?.dailiesCompleted);
        case 'relic_apprentice':
            return relicPickTotal(save);
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
        const pinsPlacedCountThisRun = nonNegativeQuestCount(run.pinsPlacedCountThisRun);
        const maxPinsTotalRun = nonNegativeQuestCount(run.activeContract.maxPinsTotalRun);
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
    if (run.gameMode === 'gauntlet') {
        const levelsCleared = stats.levelsCleared;
        rows.push({
            id: 'gauntlet_proof',
            label: 'Gauntlet Proof',
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

export const getQuestContractForRunSummary = (summary: { gameMode?: string; levelsCleared?: number } | null): QuestCampaignStepId | null => {
    const levelsCleared = nonNegativeQuestCount(summary?.levelsCleared);
    if (summary?.gameMode === 'gauntlet' && levelsCleared >= 1) {
        return 'gauntlet_proof';
    }
    if (summary?.gameMode === 'daily' && levelsCleared >= 1) {
        return 'daily_rhythm';
    }
    if (levelsCleared >= 1) {
        return 'first_lantern';
    }
    return null;
};
