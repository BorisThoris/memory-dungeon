import type { SaveData } from './contracts';
import { getDailyArchiveRows } from './daily-archive';
import { getObjectiveBoardItems, type ObjectiveBoardStatus } from './objective-board';
import { getQuestCampaignRows, type QuestCampaignStatus } from './quest-campaign';

export type LocalProgressRegistrySource = 'daily_archive' | 'objective_board' | 'quest_campaign';
export type LocalProgressRegistryStatus = 'active' | 'completed' | 'locked' | 'failed';

export interface LocalProgressRegistryRow {
    id: string;
    source: LocalProgressRegistrySource;
    title: string;
    status: LocalProgressRegistryStatus;
    progressLabel: string;
    localOnly: true;
    sourceFields: string[];
}

const mapObjectiveStatus = (status: ObjectiveBoardStatus): LocalProgressRegistryStatus => status;
const mapQuestStatus = (status: QuestCampaignStatus): LocalProgressRegistryStatus => status;

export const getLocalProgressRegistryRows = (
    save: SaveData,
    nowMs: number = Date.now()
): LocalProgressRegistryRow[] => {
    const dailyRows = getDailyArchiveRows(save, nowMs).map((row): LocalProgressRegistryRow => ({
        id: `${row.scope}:${row.key}`,
        source: 'daily_archive',
        title: row.title,
        status: row.status ?? 'active',
        progressLabel: row.comparisonString,
        localOnly: true,
        sourceFields: row.sourceFields
    }));

    const objectiveRows = getObjectiveBoardItems(save).map((row): LocalProgressRegistryRow => ({
        id: row.id,
        source: 'objective_board',
        title: row.title,
        status: mapObjectiveStatus(row.status),
        progressLabel: `${row.progress.current}/${row.progress.target}`,
        localOnly: true,
        sourceFields: ['SaveData.achievements', 'SaveData.playerStats', 'SaveData.lastRunSummary']
    }));

    const questRows = getQuestCampaignRows(save).map((row): LocalProgressRegistryRow => ({
        id: row.id,
        source: 'quest_campaign',
        title: row.title,
        status: mapQuestStatus(row.status),
        progressLabel: row.progressLabel,
        localOnly: true,
        sourceFields: row.saveFields
    }));

    return [...dailyRows, ...objectiveRows, ...questRows];
};

export const getLocalProgressRegistrySummary = (
    save: SaveData,
    nowMs: number = Date.now()
): { total: number; completed: number; active: number; locked: number; failed: number; localOnly: true } => {
    const rows = getLocalProgressRegistryRows(save, nowMs);
    return {
        total: rows.length,
        completed: rows.filter((row) => row.status === 'completed').length,
        active: rows.filter((row) => row.status === 'active').length,
        locked: rows.filter((row) => row.status === 'locked').length,
        failed: rows.filter((row) => row.status === 'failed').length,
        localOnly: true
    };
};
