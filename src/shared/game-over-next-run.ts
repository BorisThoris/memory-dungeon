import type { RunState, RunSummary, SaveData } from './contracts';
import { getChainTargetFeedback } from './chain-targets';
import { buildMetaProgressionRunDelta } from './meta-progression-delta';
import { getMetaProgressionFeedback } from './meta-progression';
import { runMutatorIds, runRelicIds } from './relics';
import { buildRunHistoryExportString } from './run-history';
import { runNonNegativeInteger } from './run-number-guards';

export interface GameOverNextRunRow {
    id: 'run_it_back' | 'chain_target' | 'build_recap' | 'local_share' | 'next_goal';
    title: string;
    value: string;
    detail: string;
    actionHint: string;
    localOnly: true;
}

const runItBackDetail = (summary: RunSummary | null, run: RunState): string => {
    if (!summary) {
        return 'Complete a run to unlock a restart recommendation.';
    }
    const pickupClaimed = runNonNegativeInteger(run.findablesClaimedThisFloor);
    const pickupTotal = runNonNegativeInteger(run.findablesTotalThisFloor);
    const totalScore = runNonNegativeInteger(summary.totalScore);
    const highestLevel = runNonNegativeInteger(summary.highestLevel);
    const levelsCleared = runNonNegativeInteger(summary.levelsCleared);
    const bestStreak = runNonNegativeInteger(summary.bestStreak);
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
    if (summary.practiceMode) {
        return 'Practice';
    }
    return 'Classic';
};

const getFallbackNextGoalRow = (summary: RunSummary | null): GameOverNextRunRow => ({
    id: 'next_goal',
    title: 'Next goal',
    value: summary && runNonNegativeInteger(summary.highestLevel) < 5 ? 'Reach floor 5' : 'Push a cleaner run',
    detail: runNonNegativeInteger(summary?.perfectClears) > 0
        ? `${runNonNegativeInteger(summary?.perfectClears)} perfect floor(s) logged.`
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
        // The goal copy already says "Next:" when the reward is still locked; do not say it twice.
        detail = delta.nextGoalCopy.startsWith('Next: ')
            ? `${delta.summaryCopy} ${delta.nextGoalCopy}`
            : `${delta.summaryCopy} Next: ${delta.nextGoalCopy}`;
    }

    return {
        id: 'next_goal',
        title: 'Next goal',
        value,
        detail,
        actionHint: 'Use Profile for reward status and Choose Your Path for the next attempt.',
        localOnly: true
    };
};

export const getGameOverNextRunRows = (run: RunState, save?: SaveData, previousSave?: SaveData): GameOverNextRunRow[] => {
    const summary = run.lastRunSummary;
    const runLabel = summary ? modeLabel(summary) : 'No completed run';
    const relicCount = summary ? runRelicIds(summary.relicIds).length : runRelicIds(run.relicIds).length;
    const mutatorCount = summary ? runMutatorIds(summary.activeMutators).length : runMutatorIds(run.activeMutators).length;
    const buildCount = `${relicCount} relic(s) / ${mutatorCount} mutator(s)`;
    const activeContract = summary?.activeContract ?? run.activeContract;
    const buildDetail = activeContract
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
            value: buildCount,
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
