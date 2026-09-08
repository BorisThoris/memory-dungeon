import type { MutatorId, RunState, SaveData, RunSummary } from './contracts';
import { runArray, runArrayCount } from './run-array-guards';
import { runNonNegativeInteger } from './run-number-guards';

export type RunHistoryPersistence = 'persisted_summary' | 'ephemeral_run' | 'derived_export';

export interface RunHistoryBuildSnapshot {
    mutatorIds: string[];
    contract: string;
    mode: string;
}

export interface RunShareKey {
    kind?: 'local_share_key';
    shareKey: string;
    shareSupported: boolean;
    reason: string;
    seed: number | null;
    rulesVersion: number | null;
    localOnly: true;
    shareString?: string;
}

export type RunReplayLink = RunShareKey;

export interface RunHistoryJournalRow {
    id: string;
    label: string;
    value: string;
    detail?: string;
    persistence: RunHistoryPersistence;
    exportSafe: boolean;
    offlineOnly?: true;
}

export interface RunHistoryEntry {
    runSeed?: number;
    localOnly?: true;
    summary: RunSummary | null;
    build: RunHistoryBuildSnapshot;
    share: RunShareKey;
    journalRows: RunHistoryJournalRow[];
    piiFree: true;
    onlineRequired: false;
}

const getPersistedSummaryPayoffStack = (
    summary: RunSummary | null
): { label: 'Combo burst' | 'Payoff burst'; lanes: number } | null => {
    if (!summary) {
        return null;
    }
    const bestStreak = runNonNegativeInteger(summary.bestStreak);
    const payoffLanes = [
        bestStreak >= 4,
        runNonNegativeInteger(summary.payoffPickupTotal) > 0,
        runNonNegativeInteger(summary.perfectClears) > 0
    ].filter(Boolean).length;
    if (payoffLanes < 3) {
        return null;
    }
    return { label: bestStreak >= 10 ? 'Combo burst' : 'Payoff burst', lanes: payoffLanes };
};

const contractLabel = (run: Pick<RunState, 'activeContract' | 'practiceMode'>): string => {
    if (run.activeContract?.noShuffle && run.activeContract?.noDestroy) {
        return 'Scholar contract';
    }
    if (run.activeContract?.maxPinsTotalRun != null) {
        return `Pin vow ${run.activeContract.maxPinsTotalRun}`;
    }
    if (run.practiceMode) {
        return 'Practice';
    }
    return 'None';
};

const summaryScoreCopy = (summary: RunSummary): string => {
    const totalScore = runNonNegativeInteger(summary.totalScore);
    const highestLevel = runNonNegativeInteger(summary.highestLevel);
    const levelsCleared = runNonNegativeInteger(summary.levelsCleared);
    return `${totalScore} score · floor ${highestLevel} · ${levelsCleared} clears`;
};

export const buildRunShareKey = (run: RunState): RunShareKey => {
    const summary = run.lastRunSummary;
    const seed = summary?.runSeed ?? run.runSeed ?? null;
    const rulesVersion = summary?.runRulesVersion ?? run.runRulesVersion ?? null;
    const mode = summary?.gameMode ?? run.gameMode;
    const shareSupported = seed != null && rulesVersion != null;
    return {
        kind: 'local_share_key',
        shareKey: shareSupported ? `${mode}:${rulesVersion}:${seed}` : 'local-share-unavailable',
        shareSupported,
        reason: shareSupported
            ? 'Local seed/rules/mode share recipe only; it does not include flip playback, route choices, or importable replay data.'
            : 'Fixed or caller-supplied puzzle boards require their tile payload; do not invent a share key.',
        seed,
        rulesVersion,
        localOnly: true,
        shareString: shareSupported ? `local share ${mode}:${rulesVersion}:${seed}` : 'local share unavailable'
    };
};

export const buildRunReplayLink = buildRunShareKey;

export const buildRunHistoryEntry = (run: RunState): RunHistoryEntry => {
    const summary = run.lastRunSummary;
    const mutatorIds = runArray<MutatorId>(run.activeMutators);
    const flipHistoryCount = runArrayCount(run.flipHistory);
    const matchedPairKeyCount = runArrayCount(run.matchedPairKeysThisRun);
    const build: RunHistoryBuildSnapshot = {
        mutatorIds: [...mutatorIds],
        contract: contractLabel(run),
        mode: run.gameMode
    };
    const share = buildRunShareKey(run);
    const journalRows: RunHistoryJournalRow[] = [
        {
            id: 'summary',
            label: 'Run summary',
            value: summary ? summaryScoreCopy(summary) : 'No resolved summary yet',
            persistence: 'persisted_summary',
            exportSafe: true,
            offlineOnly: true
        },
        {
            id: 'build',
            label: 'Build snapshot',
            value: `${build.mode} · ${build.contract} · ${build.mutatorIds.length} mutators`,
            detail: build.mutatorIds.length > 0 ? build.mutatorIds.join(', ') : 'No mutators active.',
            persistence: 'derived_export',
            exportSafe: true,
            offlineOnly: true
        },
        {
            id: 'share',
            label: 'Share key',
            value: share.shareKey,
            detail: `${flipHistoryCount} flip ids are local-only; ${share.reason}`,
            persistence: 'derived_export',
            exportSafe: share.shareSupported,
            offlineOnly: true
        },
        {
            id: 'encore',
            label: 'Encore keys',
            value: `${flipHistoryCount} tile ids kept until this run is dismissed`,
            detail: `${matchedPairKeyCount} matched pair keys for local encore bonus.`,
            persistence: 'ephemeral_run',
            exportSafe: false,
            offlineOnly: true
        }
    ];
    return {
        runSeed: share.seed ?? undefined,
        localOnly: true,
        summary,
        build,
        share,
        journalRows,
        piiFree: true,
        onlineRequired: false
    };
};

export const buildRunJournalRows = (run: RunState): RunHistoryJournalRow[] =>
    buildRunHistoryEntry(run).journalRows;

export const buildRunJournalEntry = (run: RunState): {
    journalId: string;
    buildSummary: string;
    shareLabel: string;
    rows: RunHistoryJournalRow[];
    localOnly: true;
} => {
    const entry = buildRunHistoryEntry(run);
    return {
        journalId: entry.share.shareKey,
        buildSummary: `${entry.build.mutatorIds.length} mutators`,
        shareLabel: entry.share.shareSupported ? 'local share key available' : 'share key unavailable',
        rows: entry.journalRows,
        localOnly: true
    };
};

export const buildRunJournalRowsFromSave = (save: SaveData): RunHistoryJournalRow[] => {
    const summary = save.lastRunSummary;
    const payoffStack = getPersistedSummaryPayoffStack(summary);
    return [
        {
            id: 'last_summary',
            label: 'Last run summary',
            value: summary
                ? `${summary.gameMode ?? 'classic'} · ${runNonNegativeInteger(summary.totalScore)} score · floor ${runNonNegativeInteger(summary.highestLevel)}`
                : 'No persisted run summary',
            persistence: 'persisted_summary',
            exportSafe: true
        },
        ...(payoffStack
            ? [
                  {
                      id: 'last_payoff_stack',
                      label: 'Last payoff stack',
                      value: `${payoffStack.label} · ${payoffStack.lanes} payoffs`,
                      detail: 'Persisted chain, route, pickup, clean-floor, and perk payoff routes.',
                      persistence: 'persisted_summary' as const,
                      exportSafe: true
                  }
              ]
            : []),
        {
            id: 'encore_pairs',
            label: 'Encore pair keys',
            value: `${runArrayCount(save.playerStats?.encorePairKeysLastRun)} pair keys remembered locally`,
            persistence: 'persisted_summary',
            exportSafe: false
        }
    ];
};

export const buildRunHistoryExportString = (run: RunState): string => {
    const entry = buildRunHistoryEntry(run);
    const summary = entry.summary;
    if (!summary) {
        return 'No run history export available yet.';
    }
    const highestLevel = runNonNegativeInteger(summary.highestLevel);
    const totalScore = runNonNegativeInteger(summary.totalScore);
    return [
        `Run ${summary.gameMode ?? 'classic'} floor ${highestLevel}`,
        `${totalScore} local score`,
        `build ${entry.build.mutatorIds.length} mutators`,
        entry.share.shareSupported ? `share ${entry.share.shareKey}` : 'share unavailable',
        'offline local journal; no account or leaderboard rank'
    ].join(' · ');
};
