import type { RunState, RunSummary, SaveData } from './contracts';
import { getChainTargetFeedback } from './chain-targets';
import { buildMetaProgressionRunDelta } from './meta-progression-delta';
import { getMetaProgressionFeedback } from './meta-progression';
import { buildRunHistoryExportString } from './run-history';
import { getStartingLoadoutDefinition } from './starting-loadouts';

export interface GameOverNextRunRow {
    id: 'run_it_back' | 'chain_target' | 'build_recap' | 'local_share' | 'next_goal';
    title: string;
    value: string;
    detail: string;
    actionHint: string;
    localOnly: true;
}

const nonNegativeNextRunCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const itemCount = (value: unknown): number => (Array.isArray(value) ? value.length : 0);

const runItBackDetail = (summary: RunSummary | null, run: RunState): string => {
    if (!summary) {
        return 'Complete a run to unlock a restart recommendation.';
    }
    const pickupClaimed = nonNegativeNextRunCount(run.findablesClaimedThisFloor);
    const pickupTotal = nonNegativeNextRunCount(run.findablesTotalThisFloor);
    const totalScore = nonNegativeNextRunCount(summary.totalScore);
    const highestLevel = nonNegativeNextRunCount(summary.highestLevel);
    const levelsCleared = nonNegativeNextRunCount(summary.levelsCleared);
    const bestStreak = nonNegativeNextRunCount(summary.bestStreak);
    const pickupCopy = pickupTotal > 0 ? ` / pickups ${pickupClaimed}/${pickupTotal}` : '';
    const chainCopy = bestStreak > 0 ? ` / best chain x${bestStreak}` : ' / chain not started';
    return `${totalScore.toLocaleString()} score / floor ${highestLevel} / ${levelsCleared} clear(s)${chainCopy}${pickupCopy}`;
};

const getChainTargetRow = (summary: RunSummary | null): GameOverNextRunRow => {
    const target = getChainTargetFeedback(summary?.bestStreak);
    return {
        id: 'chain_target',
        title: 'Chain target',
        value: target.value,
        detail: target.detail,
        actionHint: target.actionHint,
        localOnly: true
    };
};

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
    value: summary && nonNegativeNextRunCount(summary.highestLevel) < 5 ? 'Reach floor 5' : 'Push a cleaner run',
    detail: nonNegativeNextRunCount(summary?.perfectClears) > 0
        ? `${nonNegativeNextRunCount(summary?.perfectClears)} perfect floor(s) logged.`
        : 'Perfect floors and no-assist runs unlock mastery.',
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
    const relicCount = summary ? itemCount(summary.relicIds) : itemCount(run.relicIds);
    const mutatorCount = summary ? itemCount(summary.activeMutators) : itemCount(run.activeMutators);
    const buildCount = `${relicCount} relic(s) / ${mutatorCount} mutator(s)`;
    const activeContract = summary?.activeContract ?? run.activeContract;
    const startingLoadout = getStartingLoadoutDefinition(summary?.startingLoadoutId ?? run.startingLoadoutId);
    const buildDetail = startingLoadout
        ? `${startingLoadout.label}: ${startingLoadout.summary} ${startingLoadout.impactSignals
              .map((signal) => `${signal.label}: ${signal.value}`)
              .join('; ')}.`
        : activeContract
          ? 'Contract rules shaped this run.'
          : 'No contract constraints on this run.';
    return [
        {
            id: 'run_it_back',
            title: 'Run it back',
            value: runLabel,
            detail: runItBackDetail(summary, run),
            actionHint: 'Play Again restarts the current mode locally; Main Menu returns to the hub.',
            localOnly: true
        },
        getChainTargetRow(summary),
        {
            id: 'build_recap',
            title: 'Build recap',
            value: startingLoadout ? `${startingLoadout.label} / ${buildCount}` : buildCount,
            detail: buildDetail,
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
