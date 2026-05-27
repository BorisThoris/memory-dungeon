import type { RunState, RunSummary, SaveData } from './contracts';
import { buildMetaProgressionRunDelta } from './meta-progression-delta';
import { getMetaProgressionFeedback } from './meta-progression';
import { buildRunHistoryExportString } from './run-history';

export interface GameOverNextRunRow {
    id: 'run_it_back' | 'build_recap' | 'local_share' | 'next_goal';
    title: string;
    value: string;
    detail: string;
    actionHint: string;
    localOnly: true;
}

const modeLabel = (summary: RunSummary): string => {
    if (summary.activeContract?.noShuffle) {
        return 'Scholar Contract';
    }
    if (summary.activeContract?.maxPinsTotalRun != null) {
        return 'Pin Vow';
    }
    if (summary.wildMenuRun) {
        return 'Wild Run';
    }
    if (summary.dungeonShowcaseRun) {
        return 'Dungeon Showcase';
    }
    switch (summary.gameMode) {
        case 'daily':
            return summary.dailyDateKeyUtc ? `Daily ${summary.dailyDateKeyUtc}` : 'Daily';
        case 'gauntlet':
            return 'Gauntlet';
        case 'meditation':
            return 'Meditation';
        case 'puzzle':
            return 'Puzzle';
        default:
            if (summary.practiceMode) {
                return 'Practice';
            }
            return 'Classic';
    }
};

const getFallbackNextGoalRow = (summary: RunSummary | null): GameOverNextRunRow => ({
    id: 'next_goal',
    title: 'Next goal',
    value: summary && summary.highestLevel < 5 ? 'Reach floor 5' : 'Push a cleaner run',
    detail: summary?.perfectClears ? `${summary.perfectClears} perfect floor(s) logged.` : 'Perfect floors and no-assist runs unlock mastery.',
    actionHint: 'Choose Classic for long-run progression or Daily for UTC archive progress.',
    localOnly: true
});

const getMetaNextGoalRow = (save: SaveData, previousSave?: SaveData): GameOverNextRunRow => {
    const progression = getMetaProgressionFeedback(save);
    const delta = previousSave ? buildMetaProgressionRunDelta(previousSave, save) : null;
    const nextReward = progression.nextReward;
    let value = nextReward?.title ?? progression.nextMilestone?.label ?? progression.difficultyTierLabel;
    let detail = `${progression.motivationCopy} ${progression.nextMilestoneCopy}`;

    if (nextReward?.status === 'available') {
        value = `${nextReward.title} ready`;
    }
    if (delta?.changed === true) {
        value = delta.headline;
        detail = `${delta.summaryCopy} Next: ${delta.nextGoalCopy}`;
    }

    return {
        id: 'next_goal',
        title: 'Next goal',
        value,
        detail,
        actionHint:
            nextReward?.modeRule === 'disabled_in_daily'
                ? 'Use Profile for reward status; choose Classic to benefit from permanent upgrades.'
                : 'Use Profile for reward status and Choose Your Path for the next attempt.',
        localOnly: true
    };
};

export const getGameOverNextRunRows = (run: RunState, save?: SaveData, previousSave?: SaveData): GameOverNextRunRow[] => {
    const summary = run.lastRunSummary;
    const runLabel = summary ? modeLabel(summary) : 'No completed run';
    const relicCount = summary?.relicIds?.length ?? run.relicIds.length;
    const mutatorCount = summary?.activeMutators?.length ?? run.activeMutators.length;
    const buildCount = `${relicCount} relic(s) / ${mutatorCount} mutator(s)`;
    const activeContract = summary?.activeContract ?? run.activeContract;
    return [
        {
            id: 'run_it_back',
            title: 'Run it back',
            value: runLabel,
            detail: summary
                ? `${summary.totalScore.toLocaleString()} score / floor ${summary.highestLevel} / ${summary.levelsCleared} clear(s)`
                : 'Complete a run to unlock a restart recommendation.',
            actionHint: 'Play Again restarts the current mode locally; Main Menu returns to the hub.',
            localOnly: true
        },
        {
            id: 'build_recap',
            title: 'Build recap',
            value: buildCount,
            detail: activeContract ? 'Contract rules shaped this run.' : 'No contract constraints on this run.',
            actionHint: 'Review Inventory/Codex for build rules before the next attempt.',
            localOnly: true
        },
        {
            id: 'local_share',
            title: 'Local share',
            value: summary ? buildRunHistoryExportString(run) : 'No export yet',
            detail: 'Share strings stay offline-safe: no account, PII, or online rank.',
            actionHint: 'Use this as a readable recap until clipboard/export UI is expanded.',
            localOnly: true
        },
        save ? getMetaNextGoalRow(save, previousSave) : getFallbackNextGoalRow(summary)
    ];
};
