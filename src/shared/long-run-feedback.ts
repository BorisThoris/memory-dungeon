import { RECALL_FOCUS_MAX, type FindableKind, type RunState } from './contracts';
import { getFindableKindLabel, getFindableSpawnWeightRows } from './findables';
import type { MechanicTokenId } from './mechanic-feedback';
import { getMemoryRecallFeedback } from './memory-recall-feedback';
import { getRunEconomyRows } from './run-economy';
import { runArrayCount } from './run-array-guards';
import { runNonNegativeInteger } from './run-number-guards';
import { normalizeSessionStats } from './session-stats-rules';

export type FeedbackCauseKind =
    | 'match_reward'
    | 'power_use'
    | 'economy_delta'
    | 'recall_feedback'
    | 'perfect_memory_locked';

export interface FeedbackCauseRow {
    id: string;
    kind: FeedbackCauseKind;
    label: string;
    summary: string;
    detail: string;
    tokens: readonly MechanicTokenId[];
    visible: true;
    ariaLive: string;
    priority: number;
}

export interface PerfectMemoryAttribution {
    locked: boolean;
    firstAction: string | null;
    latestAction: string | null;
    summary: string;
    tokens: readonly MechanicTokenId[];
}

export type TouchHudDetailKind = 'objective' | 'memory' | 'perfect_memory' | 'economy';

export interface TouchHudDetailRow {
    id: TouchHudDetailKind;
    label: string;
    value: string;
    detail: string;
    tokens: readonly MechanicTokenId[];
}

export interface TerminologyContractRow {
    id: string;
    term: string;
    contract: string;
    stateOwner: string;
    playerCopyRule: string;
}

export interface FindableDistributionRow {
    id: FindableKind;
    label: string;
    spawnWeight: number;
    targetShare: number;
    claimedTotalThisFloor: number;
    totalThisFloor: number;
}

const causeRow = (
    row: Omit<FeedbackCauseRow, 'visible' | 'ariaLive'> & { ariaLive?: string }
): FeedbackCauseRow => ({
    ...row,
    visible: true,
    ariaLive: row.ariaLive ?? `${row.label}: ${row.summary}. ${row.detail}`
});

export const getPerfectMemoryAttribution = (run: RunState): PerfectMemoryAttribution => {
    if (!run.powersUsedThisRun) {
        return {
            locked: false,
            firstAction: null,
            latestAction: null,
            summary: 'Perfect Memory still available.',
            tokens: ['safe', 'objective']
        };
    }

    const stats = normalizeSessionStats(run.stats);
    const actions: string[] = [];
    if (run.gambitThirdFlipUsed) actions.push('gambit');
    if (run.shuffleUsedThisFloor || stats.shufflesUsed > 0) actions.push('shuffle or swap');
    if (stats.pairsDestroyed > 0) actions.push('destroy pair');
    if (runArrayCount(run.peekRevealedTileIds) > 0) actions.push('peek');
    const firstAction = actions[0] ?? 'assist or wild action';
    const latestAction = actions[actions.length - 1] ?? firstAction;

    return {
        locked: true,
        firstAction,
        latestAction,
        summary: `Perfect Memory locked by ${firstAction}.`,
        tokens: ['locked', 'forfeit']
    };
};

export const getInRunCauseRows = (run: RunState): FeedbackCauseRow[] => {
    const rows: FeedbackCauseRow[] = [];
    const pm = getPerfectMemoryAttribution(run);
    const forgottenTileCount = runArrayCount(run.forgottenTileIdsThisFloor);

    if (run.findablesClaimedThisFloor > 0) {
        rows.push(
            causeRow({
                id: 'findables-claimed',
                kind: 'match_reward',
                label: 'Pickups',
                summary: `${run.findablesClaimedThisFloor}/${run.findablesTotalThisFloor} claimed`,
                detail: 'Matched carrier pairs shook loose their marked archive finds.',
                tokens: ['reward', 'momentum'],
                priority: 20
            })
        );
    }

    if (
        run.recallMatchesThisFloor > 0 ||
        run.recallMistakesThisFloor > 0 ||
        run.recallBonusScoreThisFloor > 0 ||
        forgottenTileCount > 0
    ) {
        const recall = getMemoryRecallFeedback(run);
        rows.push(
            causeRow({
                id: 'recall-focus',
                kind: 'recall_feedback',
                label: 'Recall',
                summary: `Focus ${recall.focus}/${RECALL_FOCUS_MAX}, +${run.recallBonusScoreThisFloor} score`,
                detail: `${run.recallMatchesThisFloor} remembered match(es), ${run.recallMistakesThisFloor} lapse(s), ${forgottenTileCount} forgotten tile marker(s) etched into the room log. ${recall.atmosphericSummary} ${recall.atmosphericBeat} Next memory move: ${recall.nextMemoryMove.label}.`,
                tokens: ['hidden_known', run.recallMistakesThisFloor > 0 ? 'risk' : 'momentum'],
                priority: 35
            })
        );
    }

    if (pm.locked) {
        rows.push(
            causeRow({
                id: 'perfect-memory',
                kind: 'perfect_memory_locked',
                label: 'Perfect Memory',
                summary: pm.summary,
                detail: `Latest lock source: ${pm.latestAction}.`,
                tokens: pm.tokens,
                priority: 50
            })
        );
    }

    return rows.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
};

export const getTouchHudDetailRows = (run: RunState): TouchHudDetailRow[] => {
    const economy = getRunEconomyRows(run)
        .filter((row) => row.id === 'findable_pickups')
        .map((row) => `${row.label} ${row.value}`)
        .join(', ');
    const pm = getPerfectMemoryAttribution(run);
    const recall = getMemoryRecallFeedback(run);

    return [
        {
            id: 'memory',
            label: 'Recall',
            value: `${recall.focus}/${RECALL_FOCUS_MAX}`,
            detail: `${run.recallMatchesThisFloor} remembered match(es), ${run.recallMistakesThisFloor} lapse(s), +${run.recallBonusScoreThisFloor} recall score recorded in the room log. ${recall.pressureDetail} ${recall.atmosphericBeat} Next memory move: ${recall.nextMemoryMove.detail}`,
            tokens: ['hidden_known', run.recallMistakesThisFloor > 0 ? 'risk' : 'momentum']
        },
        {
            id: 'perfect_memory',
            label: 'Perfect Memory',
            value: pm.locked ? 'locked' : 'available',
            detail: pm.summary,
            tokens: pm.tokens
        },
        {
            id: 'economy',
            label: 'Economy',
            value: `${runNonNegativeInteger(run.findablesClaimedThisFloor)}/${runNonNegativeInteger(run.findablesTotalThisFloor)} pickups`,
            detail: economy,
            tokens: ['reward', 'cost']
        }
    ];
};

export const getFindableDistributionRows = (run: RunState): FindableDistributionRow[] => {
    const findableSpawnWeightRows = getFindableSpawnWeightRows();
    const totalWeight = findableSpawnWeightRows.reduce((sum, row) => sum + row.weight, 0);
    const totalKinds = new Map<FindableKind, number>();
    const tilesByPair = new Map<string, FindableKind>();

    for (const tile of run.board?.tiles ?? []) {
        if (tile.findableKind == null) {
            continue;
        }
        tilesByPair.set(tile.pairKey, tile.findableKind);
    }
    for (const kind of tilesByPair.values()) {
        totalKinds.set(kind, (totalKinds.get(kind) ?? 0) + 1);
    }

    return findableSpawnWeightRows.map((row) => ({
        id: row.id,
        label: getFindableKindLabel(row.id),
        spawnWeight: row.weight,
        targetShare: totalWeight > 0 ? row.weight / totalWeight : 0,
        claimedTotalThisFloor: run.findablesClaimedThisFloor,
        totalThisFloor: totalKinds.get(row.id) ?? 0
    }));
};

export const LONG_RUN_TERMINOLOGY_ROWS: readonly TerminologyContractRow[] = [
    {
        id: 'decoy',
        term: 'Decoy',
        contract: 'Non-matching pressure tile or mutator fakeout that changes memory routing.',
        stateOwner: 'pairKey or mutator-specific board fields',
        playerCopyRule: 'Use decoy for fake pair pressure, not for hidden rewards.'
    },
    {
        id: 'objective',
        term: 'Objective',
        contract: 'Floor goal with progress, completion, and HUD detail.',
        stateOwner: 'BoardState.featuredObjectiveId plus getSecondaryObjectiveProgress',
        playerCopyRule: 'Use objective for goals only, not incidental rewards.'
    }
] as const;
