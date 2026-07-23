import { getRewardPerkRows } from '../../shared/bonus-rewards';
import { getChainTargetFeedback } from '../../shared/chain-targets';
import type { RunState, SaveData } from '../../shared/contracts';
import { getCosmeticCollectionRows } from '../../shared/cosmetics';
import { GAME_MODE_CODEX } from '../../shared/game-catalog';
import { getInventoryPrepRows } from '../../shared/inventory-prep';
import { getPerfectMemoryAttribution } from '../../shared/long-run-feedback';
import { getInventoryRewardSignal } from '../../shared/meta-reward-signals';
import { getRunEconomyRows } from '../../shared/run-economy';
import { getRunInventoryRows, getRunLoadoutSummary, type RunInventoryItemId, type RunInventoryRow } from '../../shared/run-inventory';
import { getRunBuildProfile } from '../../shared/relics';
import { getRunStartingLoadoutRow } from '../../shared/starting-loadouts';
import {
    getTraitBuildRewardRows,
    getTraitBuildRewardRowsForLoadout
} from '../../shared/trait-build-rewards';
import { getTraitRouteObjectiveStatus } from '../../shared/trait-route-objectives';

export const modeTitle = (gameMode: string): string =>
    GAME_MODE_CODEX.find((mode) => mode.id === gameMode)?.title ?? gameMode;

export const createInventoryQuantityMap = (run: RunState): Map<string, number> => {
    const inventoryRows = getRunInventoryRows(run);
    return new Map(inventoryRows.map((row) => [row.id, row.quantity]));
};

const finiteNonNegativeInteger = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export const getActiveTraitBuildRows = (run: RunState) => {
    const relicTraitBuildRows = getTraitBuildRewardRows().filter((row) =>
        row.relicIds.some((relicId) => run.relicIds.includes(relicId))
    );
    return [...getTraitBuildRewardRowsForLoadout(run.startingLoadoutId), ...relicTraitBuildRows].filter(
        (row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id) === index
    );
};

type InventoryRunLoopSignal = {
    id: 'chain' | 'pickup' | 'resource' | 'trait';
    label: string;
    value: string;
    detail: string;
    nextCue: string;
    tone: 'chain' | 'reward' | 'resource' | 'trait';
};

type InventoryPayoffEngineSignal = {
    label: 'Super stack' | 'Payoff engine' | 'Prime payoff';
    value: string;
    detail: string;
    nextCue: string;
    tone: 'super' | 'burst' | 'setup';
};

export const getInventoryRunLoopSignals = (run: RunState): InventoryRunLoopSignal[] => {
    const pickupClaimed = finiteNonNegativeInteger(run.findablesClaimedThisFloor);
    const pickupTotal = finiteNonNegativeInteger(run.findablesTotalThisFloor);
    const traitRequired = finiteNonNegativeInteger(run.traitRouteObjectiveRequiredThisFloor);
    const traitProgress = finiteNonNegativeInteger(run.traitRouteObjectiveProgressThisFloor);
    const traitComplete = run.traitRouteObjectiveCompletedThisFloor || run.traitRouteObjectiveRewardClaimedThisFloor;
    const traitRouteStatus = getTraitRouteObjectiveStatus(run);
    const comboShards = finiteNonNegativeInteger(run.stats.comboShards);
    const currentStreak = finiteNonNegativeInteger(run.stats.currentStreak);
    const bestStreak = finiteNonNegativeInteger(run.stats.bestStreak);
    const guardTokens = finiteNonNegativeInteger(run.stats.guardTokens);
    const chainTarget = getChainTargetFeedback(Math.max(currentStreak, bestStreak));
    return [
        {
            id: 'chain',
            label: 'Chain loop',
            value: currentStreak > 0 ? `x${currentStreak}` : bestStreak > 0 ? `best x${bestStreak}` : 'ready',
            detail:
                currentStreak >= 3
                    ? 'Clean matches are actively feeding reward thresholds.'
                    : bestStreak >= 3
                      ? 'Previous chain showed the reward cadence; rebuild it on this board.'
                      : 'Start with a safe match to light the chain.',
            nextCue: chainTarget.value,
            tone: 'chain'
        },
        {
            id: 'pickup',
            label: 'Pickup loop',
            value: pickupTotal > 0 ? `${pickupClaimed}/${pickupTotal}` : `${pickupClaimed}`,
            detail: pickupTotal > 0 ? 'Claim marked reward pairs before the floor ends.' : 'No live pickup route on this floor yet.',
            nextCue:
                pickupTotal > pickupClaimed
                    ? `${pickupTotal - pickupClaimed} marked pickup${pickupTotal - pickupClaimed === 1 ? '' : 's'} left`
                    : 'Watch for the next marked carrier',
            tone: 'reward'
        },
        {
            id: 'resource',
            label: 'Burst bank',
            value: `${comboShards} shards / ${guardTokens} guards`,
            detail: 'Shards push burst rewards; guards preserve tempo after misses.',
            nextCue: comboShards >= 2 ? 'Shard burst is primed' : 'Build x6 chain pressure',
            tone: 'resource'
        },
        {
            id: 'trait',
            label: 'Trait route',
            value:
                traitRequired > 0
                    ? `${Math.min(traitProgress, traitRequired)}/${traitRequired}`
                    : traitComplete
                      ? 'paid'
                      : 'scout',
            detail: traitRouteStatus
                ? `${traitRouteStatus.stateLabel}: ${traitRouteStatus.reward}.`
                : traitComplete
                  ? `Route paid: ${run.traitRouteObjectiveRewardTextThisFloor ?? 'trait route cashout'}.`
                  : traitRequired > 0
                    ? 'Move and match trait cards to cash the route objective.'
                    : 'Look for adjacency routes that turn traits into payoff.',
            nextCue: traitRouteStatus
                ? traitRouteStatus.actionLabel
                : traitComplete
                  ? 'Bank the route payoff'
                  : traitRequired > 0
                    ? 'Cash trait route'
                    : 'Scout adjacent trait pairs',
            tone: 'trait'
        }
    ];
};

export const getInventoryPayoffEngineSignal = (
    run: RunState,
    runLoopSignals = getInventoryRunLoopSignals(run),
    rewardPerkRows = getRewardPerkRows(run)
): InventoryPayoffEngineSignal => {
    const activeLanes = runLoopSignals.filter((signal) => {
        if (signal.id === 'chain') {
            return (
                finiteNonNegativeInteger(run.stats.currentStreak) >= 3 ||
                finiteNonNegativeInteger(run.stats.bestStreak) >= 3
            );
        }
        if (signal.id === 'pickup') {
            return (
                finiteNonNegativeInteger(run.findablesTotalThisFloor) >
                finiteNonNegativeInteger(run.findablesClaimedThisFloor)
            );
        }
        if (signal.id === 'resource') {
            return (
                finiteNonNegativeInteger(run.stats.comboShards) >= 2 ||
                finiteNonNegativeInteger(run.stats.guardTokens) > 0
            );
        }
        return (
            finiteNonNegativeInteger(run.traitRouteObjectiveRequiredThisFloor) > 0 ||
            run.traitRouteObjectiveCompletedThisFloor ||
            run.traitRouteObjectiveRewardClaimedThisFloor
        );
    });
    const durablePerkCount = rewardPerkRows.length;
    const activeCount = activeLanes.length + (durablePerkCount > 0 ? 1 : 0);
    const topLaneNames = [
        ...activeLanes.map((signal) => signal.label.replace(' loop', '').replace(' bank', '')),
        durablePerkCount > 0 ? 'Reward perks' : null
    ].filter((label): label is string => label != null);

    if (activeCount >= 4) {
        return {
            label: 'Super stack',
            value: `${activeCount} payoffs live`,
            detail: topLaneNames.slice(0, 4).join(' + '),
            nextCue: activeLanes[0]?.nextCue ?? rewardPerkRows[0]?.nextCue ?? 'Keep stacking reward payoffs',
            tone: 'super'
        };
    }

    if (activeCount >= 2) {
        return {
            label: 'Payoff engine',
            value: `${activeCount} payoffs live`,
            detail: topLaneNames.slice(0, 3).join(' + '),
            nextCue: activeLanes[0]?.nextCue ?? rewardPerkRows[0]?.nextCue ?? 'Keep stacking reward payoffs',
            tone: 'burst'
        };
    }

    return {
        label: 'Prime payoff',
        value: activeCount === 1 ? '1 payoff primed' : 'Prime beat',
        detail: topLaneNames[0] ?? 'Open with a safe match to light chain, pickup, or trait payoffs.',
        nextCue: runLoopSignals.find((signal) => signal.id === 'chain')?.nextCue ?? 'Start x3 loop',
        tone: 'setup'
    };
};

type InventoryToolActionCueTone = 'chain' | 'route' | 'recovery' | 'key' | 'build';

interface InventoryToolActionCue {
    label: string;
    detail: string;
    tone: InventoryToolActionCueTone;
}

const TOOL_ACTION_CUES: Record<RunInventoryItemId, InventoryToolActionCue> = {
    shuffle_charge: {
        label: 'Route reset',
        detail: 'Spend when the board shape blocks a chain or trait adjacency route.',
        tone: 'route'
    },
    region_shuffle_charge: {
        label: 'Adjacency setup',
        detail: 'Move one row or swap two hidden cards to line up trait interactions.',
        tone: 'route'
    },
    destroy_charge: {
        label: 'Cashout save',
        detail: 'Remove a bad hidden pair when it would break reward tempo.',
        tone: 'chain'
    },
    peek_charge: {
        label: 'Confirm pair',
        detail: 'Reveal safely before committing the next chain or pickup match.',
        tone: 'chain'
    },
    stray_remove_charge: {
        label: 'Clean route',
        detail: 'Delete a stray blocker so real pairs and trait routes stay readable.',
        tone: 'route'
    },
    flash_pair_charge: {
        label: 'Find target',
        detail: 'Flash one pair when the next chain step needs a confirmed anchor.',
        tone: 'chain'
    },
    undo_charge: {
        label: 'Recover tempo',
        detail: 'Cancel a bad result before it spends the floor momentum.',
        tone: 'recovery'
    },
    gambit_token: {
        label: 'Third-flip rescue',
        detail: 'Use the risk window to turn a miss into one more matching chance.',
        tone: 'recovery'
    },
    wild_match_token: {
        label: 'Wildcard bridge',
        detail: 'Bridge an awkward symbol into a valid match when joker pressure appears.',
        tone: 'chain'
    },
    iron_key: {
        label: 'Open route',
        detail: 'Spend on locked exits, caches, or treasure doors before they block progress.',
        tone: 'key'
    },
    master_key: {
        label: 'Bypass lock',
        detail: 'Save for the door that would otherwise end the dungeon route.',
        tone: 'key'
    },
    guard_token: {
        label: 'Miss shield',
        detail: 'Automatically protects lives so a chain miss does not end the run.',
        tone: 'recovery'
    },
    combo_shard: {
        label: 'Burst payoff',
        detail: 'Stack shards until the sustain threshold converts chain pressure into survival.',
        tone: 'chain'
    },
    relic_loadout: {
        label: 'Build engine',
        detail: 'Relics define the durable combo rules for this run.',
        tone: 'build'
    },
    mutator_loadout: {
        label: 'Pressure rule',
        detail: 'Mutators change what the board asks you to solve next.',
        tone: 'build'
    },
    contract_loadout: {
        label: 'Constraint plan',
        detail: 'Contract limits decide which tools and rewards matter most.',
        tone: 'build'
    }
};

export const getInventoryToolActionCue = (row: RunInventoryRow): InventoryToolActionCue => {
    const cue = TOOL_ACTION_CUES[row.id];
    if (row.available || row.kind === 'loadout') {
        return cue;
    }
    return {
        ...cue,
        label: 'Restock first',
        detail: row.unavailableReason ?? cue.detail
    };
};

type InventoryScreenInventoryRow = RunInventoryRow & {
    actionCue: InventoryToolActionCue;
};

export const createInventoryScreenModel = (run: RunState, saveData: SaveData) => {
    const inventoryRows: InventoryScreenInventoryRow[] = getRunInventoryRows(run).map((row) => ({
        ...row,
        actionCue: getInventoryToolActionCue(row)
    }));
    const rewardPerkRows = getRewardPerkRows(run);
    const runLoopSignals = getInventoryRunLoopSignals(run);

    return {
        activeTraitBuildRows: getActiveTraitBuildRows(run),
        buildProfile: getRunBuildProfile(run),
        economyRows: getRunEconomyRows(run),
        equippedCosmetic: getCosmeticCollectionRows(saveData).find((row) => row.equipped) ?? null,
        inventoryQuantityById: new Map(inventoryRows.map((row) => [row.id, row.quantity])),
        inventoryRows,
        loadoutSummary: getRunLoadoutSummary(run),
        perfectMemoryAttribution: getPerfectMemoryAttribution(run),
        prepRows: getInventoryPrepRows(run),
        payoffEngineSignal: getInventoryPayoffEngineSignal(run, runLoopSignals, rewardPerkRows),
        rewardPerkRows,
        rewardSignal: getInventoryRewardSignal(run),
        runLoopSignals,
        startingLoadoutRow: getRunStartingLoadoutRow(run)
    };
};
