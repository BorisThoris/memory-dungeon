import type { RunState, SaveData } from './contracts';
import { getDailyArchiveSummary } from './daily-archive';
import { getMetaProgressionBoard, getMetaProgressionFeedback } from './meta-progression';
import { getObjectiveBoardItems } from './objective-board';

export type MetaScreenId = 'collection' | 'inventory' | 'codex';
export type MetaRewardSignalKind = 'progress' | 'next_goal' | 'empty_state' | 'discovery';

export interface MetaRewardSignalRow {
    id: string;
    screen: MetaScreenId;
    kind: MetaRewardSignalKind;
    title: string;
    body: string;
    cta: string;
    progress?: { current: number; target: number };
}

export const getCollectionRewardSignals = (save: SaveData): MetaRewardSignalRow[] => {
    const board = getMetaProgressionBoard(save);
    const progression = getMetaProgressionFeedback(save);
    const objective = getObjectiveBoardItems(save).find((row) => row.status === 'active' || row.status === 'locked');
    const daily = getDailyArchiveSummary(save);
    return [
        {
            id: 'collection_profile_level',
            screen: 'collection',
            kind: 'progress',
            title: `Profile level ${board.level}`,
            body: `${board.summary.honorMarks} honor marks; ${board.summary.honorsEarned} honors earned; ${board.summary.owned} visible reward(s) owned. ${progression.nextMilestoneCopy}`,
            cta: progression.nextHonorMarkSource?.nextMarkCopy ?? (board.nextReward ? `Next reward: ${board.nextReward.title}` : 'All visible rewards owned.'),
            progress: board.levelProgress
        },
        {
            id: 'collection_next_goal',
            screen: 'collection',
            kind: 'next_goal',
            title: objective?.title ?? 'Start a mastery goal',
            body: objective ? `${objective.progress.current}/${objective.progress.target} | ${objective.status}` : 'No active objective rows yet.',
            cta: objective?.reward ?? 'Play Classic or Daily to create progress.'
        },
        {
            id: 'collection_daily_archive',
            screen: 'collection',
            kind: daily.dailiesCompleted > 0 ? 'progress' : 'empty_state',
            title: 'Daily archive value',
            body: `${daily.dailiesCompleted} daily clear(s) | streak ${daily.streak}.`,
            cta: daily.dailiesCompleted > 0 ? 'Return tomorrow to extend the local streak.' : 'Try Daily Challenge to add your first archive row.'
        }
    ];
};

export const getInventoryRewardSignals = (run: RunState | null): MetaRewardSignalRow[] => {
    if (!run) {
        return [
            {
                id: 'inventory_empty_run',
                screen: 'inventory',
                kind: 'empty_state',
                title: 'No active expedition',
                body: 'Relics, mutators, charges, and run economy appear here during a descent.',
                cta: 'Start a run from Choose Your Path.'
            }
        ];
    }
    return [
        {
            id: 'inventory_build_value',
            screen: 'inventory',
            kind: run.relicIds.length > 0 ? 'discovery' : 'next_goal',
            title: run.relicIds.length > 0 ? `${run.relicIds.length} relic(s) shaping this build` : 'First relic still ahead',
            body: `${run.activeMutators.length} active mutator(s) | ${run.shopGold} shop gold | ${run.stats.comboShards} shard(s).`,
            cta: run.relicIds.length > 0 ? 'Use this snapshot to plan the next floor.' : 'Clear milestone floors to draft relics.'
        },
        {
            id: 'inventory_run_progress',
            screen: 'inventory',
            kind: 'progress',
            title: `Floor ${run.board?.level ?? run.stats.highestLevel}`,
            body: `${run.stats.totalScore.toLocaleString()} score | ${run.lives} life/lives remaining.`,
            cta: run.achievementsEnabled ? 'Achievements remain eligible.' : 'Practice/debug state: achievements disabled.'
        }
    ];
};

export const getCodexRewardSignals = (save: SaveData): MetaRewardSignalRow[] => {
    const board = getMetaProgressionBoard(save);
    const nextReward = board.nextReward ?? board.longTermGoal;
    return [
        {
            id: 'codex_learning_goal',
            screen: 'codex',
            kind: nextReward ? 'next_goal' : 'progress',
            title: nextReward ? `Learn toward: ${nextReward.title}` : 'Codex mastery',
            body: nextReward?.gate ?? 'All visible progression goals are currently satisfied.',
            cta: 'Use Guides for rules, Tables for relics/mutators/achievements.'
        },
        {
            id: 'codex_empty_filter_help',
            screen: 'codex',
            kind: 'empty_state',
            title: 'Search recovery',
            body: 'If a filter returns no topics, clear it or switch between Guides and Tables.',
            cta: 'Deep links stay local and do not change run state.'
        }
    ];
};

export const buildMetaRewardSignals = getCollectionRewardSignals;

export const getCollectionRewardSignal = (save: SaveData): MetaRewardSignalRow => getCollectionRewardSignals(save)[0]!;
export const getInventoryRewardSignal = (run: RunState | null): MetaRewardSignalRow => getInventoryRewardSignals(run)[0]!;
export const getCodexRewardSignal = (save?: SaveData): MetaRewardSignalRow =>
    save ? getCodexRewardSignals(save)[0]! : {
        id: 'codex_learning_goal',
        screen: 'codex',
        kind: 'next_goal',
        title: 'Learn toward mastery',
        body: 'Guides explain rules while tables reveal relic, mutator, mode, and achievement value.',
        cta: 'Use Guides for rules, Tables for discoveries.'
    };
