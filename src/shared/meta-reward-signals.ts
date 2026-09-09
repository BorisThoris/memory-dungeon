import type { MutatorId, RunState, SaveData } from './contracts';
import { getMetaProgressionBoard, getMetaProgressionFeedback } from './meta-progression';
import { getObjectiveBoardItems } from './objective-board';
import { runArray } from './run-array-guards';
import { runNonNegativeInteger } from './run-number-guards';
import { normalizeSessionStats } from './session-stats-rules';

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

export type MetaProgressionRunImpactTone = 'ready' | 'owned' | 'locked' | 'cosmetic' | 'deferred';

export interface MetaProgressionRunImpactRow {
    id: string;
    title: string;
    lane: string;
    impact: string;
    boardMoment: string;
    nextAction: string;
    tone: MetaProgressionRunImpactTone;
}

const metaRowTone = (row: ReturnType<typeof getMetaProgressionBoard>['rows'][number]): MetaProgressionRunImpactTone => {
    if (row.modeRule === 'cosmetic_only') {
        return 'cosmetic';
    }
    if (row.gate.toLowerCase().startsWith('deferred:')) {
        return 'deferred';
    }
    if (row.status === 'available') {
        return 'ready';
    }
    if (row.status === 'owned') {
        return 'owned';
    }
    return 'locked';
};

const metaRowImpact = (row: ReturnType<typeof getMetaProgressionBoard>['rows'][number]): { lane: string; impact: string } => {
    if (row.id === 'upgrade_scholar_prep_slot') {
        return {
            lane: 'Run setup',
            impact: 'future pre-run assist slot'
        };
    }
    return {
        lane: 'Identity',
        impact: row.reward
    };
};

const metaRowNextAction = (row: ReturnType<typeof getMetaProgressionBoard>['rows'][number]): string => {
    if (row.gate.toLowerCase().startsWith('deferred:')) {
        return 'Visible for planning';
    }
    if (row.status === 'owned') {
        return row.gameplayAffecting ? 'Active in Classic runs' : 'Owned cosmetic';
    }
    if (row.status === 'available') {
        return 'Claim now';
    }
    return `${row.progress.current}/${row.progress.target} from ${row.source}`;
};

const metaRowBoardMoment = (row: ReturnType<typeof getMetaProgressionBoard>['rows'][number]): string => {
    if (row.id === 'upgrade_scholar_prep_slot') {
        return 'Plan a future pre-run assist';
    }
    if (row.modeRule === 'cosmetic_only') {
        return 'Style changes, board rules stay stable';
    }
    if (row.gate.toLowerCase().startsWith('deferred:')) {
        return 'Preview future run-shaping systems';
    }
    return row.gameplayAffecting ? 'Changes a future board decision' : 'Archive identity reward';
};

export const getMetaProgressionRunImpactRows = (save: SaveData): MetaProgressionRunImpactRow[] => {
    const board = getMetaProgressionBoard(save);
    return board.rows.slice(0, 6).map((row) => {
        const impact = metaRowImpact(row);
        return {
            id: row.id,
            title: row.title,
            lane: impact.lane,
            impact: impact.impact,
            boardMoment: metaRowBoardMoment(row),
            nextAction: metaRowNextAction(row),
            tone: metaRowTone(row)
        };
    });
};

export const getCollectionRewardSignals = (save: SaveData): MetaRewardSignalRow[] => {
    const board = getMetaProgressionBoard(save);
    const progression = getMetaProgressionFeedback(save);
    const objective = getObjectiveBoardItems(save).find((row) => row.status === 'active' || row.status === 'locked');
    const sharpFloors = runNonNegativeInteger(save.playerStats?.sharpFloors);
    const feverFloors = runNonNegativeInteger(save.playerStats?.feverFloors);
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
            cta: objective?.reward ?? 'Play a run to create progress.'
        },
        {
            id: 'collection_chain_archive',
            screen: 'collection',
            kind: sharpFloors > 0 ? 'progress' : 'empty_state',
            title: 'Chain archive value',
            body: `${sharpFloors} Sharp floor(s) | ${feverFloors} Fever floor(s).`,
            cta:
                sharpFloors > 0
                    ? 'Seven Sharp floors make the Week of Archives upgrade claimable.'
                    : 'Break four pairs at once to reach Sharp and add your first archive row.'
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
                body: 'Mutators, charges, and run economy appear here during a descent.',
                cta: 'Start a run from Choose Your Path.'
            }
        ];
    }
    const mutatorCount = runArray<MutatorId>(run.activeMutators).length;
    const stats = normalizeSessionStats(run.stats);
    return [
        {
            id: 'inventory_build_value',
            screen: 'inventory',
            kind: 'progress',
            title: `${mutatorCount} active mutator(s) shaping this build`,
            body: `${mutatorCount} active mutator(s) shaping the next floor.`,
            cta: 'Use this snapshot to plan the next floor.'
        },
        {
            id: 'inventory_run_progress',
            screen: 'inventory',
            kind: 'progress',
            title: `Floor ${run.board?.level ?? stats.highestLevel}`,
            body: `${stats.totalScore.toLocaleString()} score.`,
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

const DEFAULT_COLLECTION_REWARD_SIGNAL: MetaRewardSignalRow = {
    id: 'collection_profile_level',
    screen: 'collection',
    kind: 'progress',
    title: 'Profile level 1',
    body: '0 honor marks; 0 honors earned; 0 visible reward(s) owned.',
    cta: 'Play Classic or Daily to create progress.',
    progress: { current: 0, target: 1 }
};

const DEFAULT_INVENTORY_REWARD_SIGNAL: MetaRewardSignalRow = {
    id: 'inventory_empty_run',
    screen: 'inventory',
    kind: 'empty_state',
    title: 'No active expedition',
    body: 'Relics, mutators, charges, and run economy appear here during a descent.',
    cta: 'Start a run from Choose Your Path.'
};

const DEFAULT_CODEX_REWARD_SIGNAL: MetaRewardSignalRow = {
    id: 'codex_learning_goal',
    screen: 'codex',
    kind: 'next_goal',
    title: 'Learn toward mastery',
    body: 'Guides explain rules while tables reveal relic, mutator, mode, and achievement value.',
    cta: 'Use Guides for rules, Tables for discoveries.'
};

export const getCollectionRewardSignal = (save: SaveData): MetaRewardSignalRow =>
    getCollectionRewardSignals(save)[0] ?? DEFAULT_COLLECTION_REWARD_SIGNAL;
export const getInventoryRewardSignal = (run: RunState | null): MetaRewardSignalRow =>
    getInventoryRewardSignals(run)[0] ?? DEFAULT_INVENTORY_REWARD_SIGNAL;
export const getCodexRewardSignal = (save?: SaveData): MetaRewardSignalRow =>
    save ? getCodexRewardSignals(save)[0] ?? DEFAULT_CODEX_REWARD_SIGNAL : DEFAULT_CODEX_REWARD_SIGNAL;
