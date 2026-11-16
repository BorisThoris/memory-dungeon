import { tr } from './i18n';
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
): { label: string; lanes: number } | null => {
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
    return { label: bestStreak >= 10 ? tr.s('Combo burst') : tr.s('Payoff burst'), lanes: payoffLanes };
};

const contractLabel = (run: Pick<RunState, 'activeContract' | 'practiceMode'>): string => {
    if (run.activeContract?.noShuffle) {
        return tr.s('Scholar contract');
    }
    if (run.activeContract?.maxPinsTotalRun != null) {
        return tr`Pin vow ${run.activeContract.maxPinsTotalRun}`;
    }
    if (run.practiceMode) {
        return tr.s('Practice');
    }
    return tr.s('None');
};

const summaryScoreCopy = (summary: RunSummary): string => {
    const totalScore = runNonNegativeInteger(summary.totalScore);
    const highestLevel = runNonNegativeInteger(summary.highestLevel);
    const levelsCleared = runNonNegativeInteger(summary.levelsCleared);
    return tr`${totalScore} score · floor ${highestLevel} · ${levelsCleared} clears`;
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
            ? tr.s('Local seed/rules/mode share recipe only; it does not include flip playback, route choices, or importable replay data.')
            : tr.s('Fixed or caller-supplied puzzle boards require their tile payload; do not invent a share key.'),
        seed,
        rulesVersion,
        localOnly: true,
        shareString: shareSupported ? tr`local share ${mode}:${rulesVersion}:${seed}` : tr.s('local share unavailable')
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
            label: tr.s('Run summary'),
            value: summary ? summaryScoreCopy(summary) : tr.s('No resolved summary yet'),
            persistence: 'persisted_summary',
            exportSafe: true,
            offlineOnly: true
        },
        {
            id: 'build',
            label: tr.s('Build snapshot'),
            value: tr`${build.mode} · ${build.contract} · ${build.mutatorIds.length} mutators`,
            detail: build.mutatorIds.length > 0 ? build.mutatorIds.join(', ') : tr.s('No mutators active.'),
            persistence: 'derived_export',
            exportSafe: true,
            offlineOnly: true
        },
        {
            id: 'share',
            label: tr.s('Share key'),
            value: share.shareKey,
            detail: tr`${flipHistoryCount} flip ids are local-only; ${share.reason}`,
            persistence: 'derived_export',
            exportSafe: share.shareSupported,
            offlineOnly: true
        },
        {
            id: 'encore',
            label: tr.s('Encore keys'),
            value: tr`${flipHistoryCount} tile ids kept until this run is dismissed`,
            detail: tr`${matchedPairKeyCount} matched pair keys for local encore bonus.`,
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

/*
 * Gen 215: `buildRunJournalRows` read one field off `buildRunHistoryEntry` and had no caller.
 * Its test now builds the entry instead - which promptly showed that `buildRunJournalEntry` has
 * no caller either. The one journal builder the game reaches is `buildRunJournalRowsFromSave`,
 * through `profile-summary.ts`; the run-shaped pair are still listed as debt rather than quietly
 * relabelled as design.
 */
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
        buildSummary: tr`${entry.build.mutatorIds.length} mutators`,
        shareLabel: entry.share.shareSupported ? tr.s('local share key available') : tr.s('share key unavailable'),
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
            label: tr.s('Last run summary'),
            value: summary
                ? tr`${summary.gameMode ?? 'classic'} · ${runNonNegativeInteger(summary.totalScore)} score · floor ${runNonNegativeInteger(summary.highestLevel)}`
                : tr.s('No persisted run summary'),
            persistence: 'persisted_summary',
            exportSafe: true
        },
        ...(payoffStack
            ? [
                  {
                      id: 'last_payoff_stack',
                      label: tr.s('Last payoff stack'),
                      value: tr`${payoffStack.label} · ${payoffStack.lanes} payoffs`,
                      detail: tr.s('Persisted chain, route, pickup, clean-floor, and perk payoff routes.'),
                      persistence: 'persisted_summary' as const,
                      exportSafe: true
                  }
              ]
            : []),
        {
            id: 'encore_pairs',
            label: tr.s('Encore pair keys'),
            value: tr`${runArrayCount(save.playerStats?.encorePairKeysLastRun)} pair keys remembered locally`,
            persistence: 'persisted_summary',
            exportSafe: false
        }
    ];
};

export const buildRunHistoryExportString = (run: RunState): string => {
    const entry = buildRunHistoryEntry(run);
    const summary = entry.summary;
    if (!summary) {
        return tr.s('No run history export available yet.');
    }
    const highestLevel = runNonNegativeInteger(summary.highestLevel);
    const totalScore = runNonNegativeInteger(summary.totalScore);
    return [
        tr`Run ${summary.gameMode ?? 'classic'} floor ${highestLevel}`,
        tr`${totalScore} local score`,
        tr`build ${entry.build.mutatorIds.length} mutators`,
        entry.share.shareSupported ? tr`share ${entry.share.shareKey}` : tr.s('share unavailable'),
        tr.s('offline local journal; no account or leaderboard rank')
    ].join(' · ');
};
