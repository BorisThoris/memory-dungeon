import type { DungeonBossId, DungeonRunMapState, DungeonRunNode, RunState, SaveData, RunSummary } from './contracts';
import { activeEnemyHazardsForBoard } from './enemy-hazard-board-rules';
import { getRunBuildProfile } from './relics';
import { getDungeonKeyTotal } from './run-inventory';
import { getRepairedSelectedDungeonNode, repairDungeonRunMapProgression } from './run-map';
import { normalizeSessionStats } from './session-stats-rules';

export type RunHistoryPersistence = 'persisted_summary' | 'ephemeral_run' | 'derived_export';

export interface RunHistoryBuildSnapshot {
    relicIds: string[];
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

export const MAX_DUNGEON_JOURNAL_ROWS = 8;

const nonNegativeRunHistoryCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const runHistoryArrayCount = (value: unknown): number => (Array.isArray(value) ? value.length : 0);

const runHistoryArray = <T>(value: unknown): T[] => (Array.isArray(value) ? value : []);

const runRelicIds = (run: RunState): RunState['relicIds'] => runHistoryArray(run.relicIds);

const runMutatorIds = (run: RunState): RunState['activeMutators'] => runHistoryArray(run.activeMutators);

const getRunHistoryBuildProfile = (run: RunState) => getRunBuildProfile({ relicIds: runRelicIds(run) });

const getPersistedSummaryPayoffStack = (
    summary: RunSummary | null
): { label: 'Combo burst' | 'Payoff burst' | 'Payoff stack' | 'Super stack'; lanes: number } | null => {
    if (!summary) {
        return null;
    }
    const bestStreak = nonNegativeRunHistoryCount(summary.bestStreak);
    const hasChainPayoff = bestStreak >= 4;
    const hasComboPayoff = bestStreak >= 10;
    const payoffLanes = [
        hasChainPayoff,
        summary.payoffRoutePaid === true,
        nonNegativeRunHistoryCount(summary.payoffPickupTotal) > 0,
        nonNegativeRunHistoryCount(summary.perfectClears) > 0,
        runHistoryArrayCount(summary.relicIds) + nonNegativeRunHistoryCount(summary.payoffRewardPerkCount) > 0
    ].filter(Boolean).length;
    if (payoffLanes < 3) {
        return null;
    }
    return {
        label:
            payoffLanes >= 4
                ? 'Super stack'
                : hasComboPayoff
                  ? 'Combo burst'
                  : hasChainPayoff
                    ? 'Payoff burst'
                    : 'Payoff stack',
        lanes: payoffLanes
    };
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

const idLabel = (id: string | null | undefined): string | null =>
    id ? id.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : null;

const summaryScoreCopy = (summary: RunSummary): string => {
    const totalScore = nonNegativeRunHistoryCount(summary.totalScore);
    const highestLevel = nonNegativeRunHistoryCount(summary.highestLevel);
    const levelsCleared = nonNegativeRunHistoryCount(summary.levelsCleared);
    return `${totalScore} score · floor ${highestLevel} · ${levelsCleared} clears`;
};

const currentDungeonNode = (dungeonRun: DungeonRunMapState): DungeonRunNode | null =>
    dungeonRun.nodes.find((node) => node.id === dungeonRun.currentNodeId) ?? null;

const routeLabelForNode = (node: DungeonRunNode, routeType: string | null): string =>
    node.routeApproachLabel ?? routeType ?? node.routeApproachType ?? node.routeType;

const bossIdForRun = (run: RunState): DungeonBossId | null =>
    run.board?.dungeonBossId ??
    run.board?.tiles.find((tile) => tile.dungeonBossId != null)?.dungeonBossId ??
    activeEnemyHazardsForBoard(run.board).find((hazard) => hazard.bossId != null)?.bossId ??
    null;

export const buildDungeonJournalRows = (run: RunState): RunHistoryJournalRow[] => {
    if (run.gameMode !== 'endless' || !Array.isArray(run.dungeonRun?.nodes) || run.dungeonRun.nodes.length === 0) {
        return [];
    }

    const dungeonRun = repairDungeonRunMapProgression(run.dungeonRun);
    const rows: RunHistoryJournalRow[] = [];
    const stats = normalizeSessionStats(run.stats);
    const currentNode = currentDungeonNode(dungeonRun);
    const selectedNode = getRepairedSelectedDungeonNode(dungeonRun);
    const clearedNodes = dungeonRun.nodes.filter((node) => node.status === 'cleared').length;
    const skippedNodes = dungeonRun.nodes.filter((node) => node.status === 'skipped').length;
    const revealedNodes = dungeonRun.nodes.filter((node) => node.status === 'revealed').length;
    const bossId = bossIdForRun(run);
    const objectiveId = run.board?.dungeonObjectiveId ?? null;
    const featuredObjectiveId = run.lastLevelResult?.featuredObjectiveId ?? run.board?.featuredObjectiveId ?? null;
    const routeType =
        run.pendingRouteCardPlan?.routeType ??
        run.board?.selectedGatewayRouteType ??
        run.board?.routeWorldProfile?.routeType ??
        null;
    const keyCount = getDungeonKeyTotal(run.dungeonKeys) + nonNegativeRunHistoryCount(run.dungeonMasterKeys);

    rows.push({
        id: 'dungeon_node',
        label: 'Dungeon node',
        value: currentNode
            ? `${currentNode.label} (${currentNode.kind}) on floor ${currentNode.floor}`
            : `Floor ${dungeonRun.currentFloor}`,
        detail: `${clearedNodes} cleared, ${revealedNodes} revealed, ${skippedNodes} skipped in act ${dungeonRun.act}.`,
        persistence: 'derived_export',
        exportSafe: true,
        offlineOnly: true
    });

    if (routeType || selectedNode) {
        rows.push({
            id: 'dungeon_route',
            label: 'Route taken',
            value: selectedNode
                ? `${selectedNode.label} via ${routeLabelForNode(selectedNode, routeType)}`
                : `${routeType} route`,
            detail: selectedNode?.detail ?? `Selected after floor ${run.pendingRouteCardPlan?.sourceLevel ?? run.board?.level ?? 'unknown'}.`,
            persistence: 'ephemeral_run',
            exportSafe: true,
            offlineOnly: true
        });
    }

    if (bossId || nonNegativeRunHistoryCount(run.dungeonEnemiesDefeated) > 0 || run.board?.floorTag === 'boss') {
        rows.push({
            id: 'dungeon_boss',
            label: 'Boss pressure',
            value: bossId ? idLabel(bossId)! : 'No active boss identity',
            detail: `${nonNegativeRunHistoryCount(run.dungeonEnemiesDefeated)} enemies defeated this run; ${nonNegativeRunHistoryCount(run.dungeonEnemiesDefeatedThisFloor)} this floor.`,
            persistence: 'derived_export',
            exportSafe: true,
            offlineOnly: true
        });
    }

    if (objectiveId || featuredObjectiveId || run.lastLevelResult?.featuredObjectiveCompleted != null) {
        rows.push({
            id: 'dungeon_objective',
            label: 'Objective trail',
            value: [
                idLabel(objectiveId),
                idLabel(featuredObjectiveId),
                run.lastLevelResult?.featuredObjectiveCompleted === true
                    ? 'completed'
                    : run.lastLevelResult?.featuredObjectiveCompleted === false
                      ? 'missed'
                      : null
            ]
                .filter(Boolean)
                .join(' / '),
            detail: `${nonNegativeRunHistoryCount(run.dungeonTrapsResolvedThisFloor)} traps resolved this floor; ${nonNegativeRunHistoryCount(run.dungeonGatewaysUsed)} gateways used this run.`,
            persistence: 'derived_export',
            exportSafe: true,
            offlineOnly: true
        });
    }

    rows.push({
        id: 'dungeon_rewards',
        label: 'Dungeon rewards',
        value: `${nonNegativeRunHistoryCount(run.dungeonTreasuresOpened)} treasures, ${keyCount} keys, ${nonNegativeRunHistoryCount(run.shopGold)} shop gold`,
        detail: `${runHistoryArrayCount(run.relicIds)} relics carried; ${nonNegativeRunHistoryCount(run.bonusRelicPicksNextOffer) + nonNegativeRunHistoryCount(run.favorBonusRelicPicksNextOffer)} bonus relic picks banked.`,
        persistence: 'derived_export',
        exportSafe: true,
        offlineOnly: true
    });

    if (run.status === 'gameOver' || nonNegativeRunHistoryCount(run.lives) <= 0) {
        rows.push({
            id: 'dungeon_outcome',
            label: 'Run outcome',
            value: nonNegativeRunHistoryCount(run.lives) <= 0 ? 'Defeated in the dungeon' : 'Run ended',
            detail: `${nonNegativeRunHistoryCount(run.enemyHazardHitsThisFloor)} enemy hazard hits this floor; ${stats.bestStreak} best streak.`,
            persistence: 'persisted_summary',
            exportSafe: true,
            offlineOnly: true
        });
    }

    return rows.slice(0, MAX_DUNGEON_JOURNAL_ROWS);
};

export const buildRunShareKey = (run: RunState): RunShareKey => {
    const summary = run.lastRunSummary;
    const seed = summary?.runSeed ?? run.runSeed ?? null;
    const rulesVersion = summary?.runRulesVersion ?? run.runRulesVersion ?? null;
    const mode = summary?.gameMode ?? run.gameMode;
    const shareSupported = seed != null && rulesVersion != null && mode !== 'puzzle';
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
    const buildProfile = getRunHistoryBuildProfile(run);
    const relicIds = runRelicIds(run);
    const mutatorIds = runMutatorIds(run);
    const flipHistoryCount = runHistoryArrayCount(run.flipHistory);
    const matchedPairKeyCount = runHistoryArrayCount(run.matchedPairKeysThisRun);
    const build: RunHistoryBuildSnapshot = {
        relicIds: [...relicIds],
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
            value: `${buildProfile.primary?.label ?? build.mode} · ${build.contract} · ${build.relicIds.length} relics · ${build.mutatorIds.length} mutators`,
            detail: buildProfile.primary ? buildProfile.tooltip : buildProfile.summary,
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
    journalRows.push(...buildDungeonJournalRows(run));
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
    const buildProfile = getRunHistoryBuildProfile(run);
    return {
        journalId: entry.share.shareKey,
        buildSummary: buildProfile.primary
            ? `${buildProfile.primary.label} · ${entry.build.relicIds.length} relics / ${entry.build.mutatorIds.length} mutators`
            : `${entry.build.relicIds.length} relics / ${entry.build.mutatorIds.length} mutators`,
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
                ? `${summary.gameMode ?? 'classic'} · ${nonNegativeRunHistoryCount(summary.totalScore)} score · floor ${nonNegativeRunHistoryCount(summary.highestLevel)}`
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
                      detail: 'Persisted chain, route, pickup, clean-floor, relic, and perk payoff routes.',
                      persistence: 'persisted_summary' as const,
                      exportSafe: true
                  }
              ]
            : []),
        {
            id: 'encore_pairs',
            label: 'Encore pair keys',
            value: `${runHistoryArrayCount(save.playerStats?.encorePairKeysLastRun)} pair keys remembered locally`,
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
    const dungeonRows = entry.journalRows
        .filter((row) => row.id.startsWith('dungeon_') && row.exportSafe)
        .slice(0, 3)
        .map((row) => `${row.label}: ${row.value}`);
    const highestLevel = nonNegativeRunHistoryCount(summary.highestLevel);
    const totalScore = nonNegativeRunHistoryCount(summary.totalScore);
    return [
        `Run ${summary.gameMode ?? 'classic'} floor ${highestLevel}`,
        `${totalScore} local score`,
        `build ${entry.build.relicIds.length} relics/${entry.build.mutatorIds.length} mutators`,
        ...dungeonRows,
        entry.share.shareSupported ? `share ${entry.share.shareKey}` : 'share unavailable',
        'offline local journal; no account or leaderboard rank'
    ].join(' · ');
};
