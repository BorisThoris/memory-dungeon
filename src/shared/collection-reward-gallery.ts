import type { SaveData } from './contracts';
import { getCosmeticRows, getOwnedCosmeticIds } from './cosmetics';
import { getMetaProgressionBoard } from './meta-progression';
import { buildRunJournalRowsFromSave } from './run-history';
import { getRelicPickTotal } from './save-data';

export type CollectionRewardGalleryStatus = 'owned' | 'in_progress' | 'missing';
export type CollectionRewardGalleryTone = 'Gold' | 'Cyan' | 'Violet' | 'Muted';

export interface CollectionRewardGalleryRow {
    id: 'achievements' | 'profile_goal' | 'cosmetics' | 'relics' | 'history';
    title: string;
    description: string;
    owned: number;
    status: CollectionRewardGalleryStatus;
    total: number;
    progressLabel: string;
    unlockHint: string;
    nextAction: string;
    gameplayImpact: string;
    icon: string;
    tone: CollectionRewardGalleryTone;
    localOnly: true;
}

const statusFor = (current: number, target: number): CollectionRewardGalleryStatus => {
    if (current >= target) return 'owned';
    if (current > 0) return 'in_progress';
    return 'missing';
};

const statusForMetaReward = (
    row: ReturnType<typeof getMetaProgressionBoard>['nextReward']
): CollectionRewardGalleryStatus => {
    if (!row) {
        return 'owned';
    }
    if (row.status === 'owned') {
        return 'owned';
    }
    if (row.status === 'available' || row.progress.current > 0) {
        return 'in_progress';
    }
    return 'missing';
};

export const getCollectionRewardGalleryRows = (save: SaveData): CollectionRewardGalleryRow[] => {
    const achievements = Object.values(save.achievements);
    const meta = getMetaProgressionBoard(save);
    const cosmeticsOwned = getOwnedCosmeticIds(save).length;
    const cosmeticsTotal = getCosmeticRows(save).length;
    const relicPickTotal = getRelicPickTotal(save.playerStats?.relicPickCounts);
    const historyRows = buildRunJournalRowsFromSave(save);

    return [
        {
            id: 'achievements',
            title: 'Achievement gallery',
            description: 'Steam/local achievements earned from mastery milestones.',
            owned: achievements.filter(Boolean).length,
            status: statusFor(achievements.filter(Boolean).length, achievements.length),
            total: achievements.length,
            progressLabel: `${achievements.filter(Boolean).length}/${achievements.length} lit`,
            unlockHint: 'Clear floors, protect lives, and chase score milestones.',
            nextAction: 'Clear floors, protect lives, and chase score milestones.',
            gameplayImpact: 'Mastery goals push clean chains, safer clears, and higher-score routes.',
            icon: '★',
            tone: 'Gold',
            localOnly: true
        },
        {
            id: 'profile_goal',
            title: meta.nextReward?.title ?? meta.longTermGoal?.title ?? 'Profile mastery',
            description: meta.nextReward?.description ?? meta.longTermGoal?.description ?? 'All visible local rewards are owned.',
            owned: meta.nextReward?.progress.current ?? meta.summary.owned,
            status: statusForMetaReward(meta.nextReward),
            total: meta.nextReward?.progress.target ?? Math.max(1, meta.summary.owned),
            progressLabel: meta.nextReward
                ? `${meta.nextReward.progress.current}/${meta.nextReward.progress.target}`
                : `${meta.summary.owned} owned`,
            unlockHint: meta.nextReward?.gate ?? 'Keep playing local modes to build mastery.',
            nextAction: meta.nextReward?.gate ?? 'Keep playing local modes to build mastery.',
            gameplayImpact: meta.nextReward?.gameplayAffecting
                ? 'Permanent upgrade changes a future board or draft decision.'
                : 'Archive reward changes identity without adding run power.',
            icon: '◆',
            tone: 'Violet',
            localOnly: true
        },
        {
            id: 'cosmetics',
            title: 'Cosmetic gallery',
            description: 'Visual-only profile titles, crests, and the shared card-back record.',
            owned: cosmeticsOwned,
            status: statusFor(cosmeticsOwned, cosmeticsTotal),
            total: cosmeticsTotal,
            progressLabel: `${cosmeticsOwned}/${cosmeticsTotal} owned`,
            unlockHint: 'Earned from honors and local progress; never pay-to-win.',
            nextAction: 'Earned from honors and local progress; never pay-to-win.',
            gameplayImpact: 'Visual-only rewards keep gameplay power readable and fair.',
            icon: '◇',
            tone: 'Cyan',
            localOnly: true
        },
        {
            id: 'relics',
            title: 'Relic discovery',
            description: 'Relic pick history turns run builds into a collection trail.',
            owned: Math.min(relicPickTotal, 10),
            status: statusFor(relicPickTotal, 10),
            total: 10,
            progressLabel: `${Math.min(relicPickTotal, 10)}/10 discovery marks`,
            unlockHint: 'Reach milestone floors and draft relics.',
            nextAction: 'Reach milestone floors and draft relics.',
            gameplayImpact: 'Relic discovery teaches which builds create stronger chain tools.',
            icon: '✦',
            tone: relicPickTotal > 0 ? 'Gold' : 'Muted',
            localOnly: true
        },
        {
            id: 'history',
            title: 'Run journal',
            description: 'Last-run summary and local share-key hints.',
            owned: save.lastRunSummary ? 1 : 0,
            status: save.lastRunSummary ? 'owned' : 'missing',
            total: historyRows.length,
            progressLabel: `${save.lastRunSummary ? 1 : 0}/${historyRows.length} summary`,
            unlockHint: save.lastRunSummary ? 'Review your latest descent.' : 'Finish a run to add a journal summary.',
            nextAction: save.lastRunSummary ? 'Review your latest descent.' : 'Finish a run to add a journal summary.',
            gameplayImpact: save.lastRunSummary
                ? 'Recent run recap shows which chain and reward payoffs fired.'
                : 'Finish a run to reveal chain, reward, and build takeaways.',
            icon: '☰',
            tone: save.lastRunSummary ? 'Cyan' : 'Muted',
            localOnly: true
        }
    ];
};

export const getCollectionGalleryRows = getCollectionRewardGalleryRows;
