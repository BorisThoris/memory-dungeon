import type { RunState } from './contracts';
import {
    CORE_SAFE_MEMORY_TAX,
    perfectMemoryImpactCopy,
    type MechanicClass,
    type MechanicTokenId,
    type MemoryTaxScore,
    type PerfectMemoryImpact
} from './mechanic-feedback';

export type PowerVerbId =
    | 'shuffle'
    | 'region_shuffle'
    | 'pin'
    | 'peek'
    | 'destroy_pair'
    | 'stray_remove'
    | 'flash_pair'
    | 'undo_resolve'
    | 'gambit';

export type PowerVerbJob = 'Recall' | 'Search' | 'Damage control' | 'Risk';

export interface PowerVerbTeachingRow {
    id: PowerVerbId;
    label: string;
    job: PowerVerbJob;
    mechanicClass: MechanicClass;
    tokens: MechanicTokenId[];
    purpose: string;
    cost: string;
    consequence: string;
    perfectMemoryImpact: PerfectMemoryImpact;
    perfectMemoryCopy: string;
    memoryTax: MemoryTaxScore;
    disabledReason: string | null;
}

export const POWER_VERB_GROUPS = {
    recall: 'Recall',
    search: 'Search',
    damage_control: 'Damage control',
    risk: 'Risk'
} as const;

const onlyWhilePlaying = (run: RunState): string | null => (run.status === 'playing' ? null : 'Only while playing.');
const locksPerfectMemory = perfectMemoryImpactCopy('locks_perfect_memory');

const hasOpenFlip = (run: RunState): boolean => (run.board?.flippedTileIds.length ?? 0) > 0;

const hasDestroyTarget = (run: RunState): boolean => {
    const tiles = run.board?.tiles ?? [];
    return tiles.some((tile) => {
        if (tile.state !== 'hidden') return false;
        const pair = tiles.filter((candidate) => candidate.pairKey === tile.pairKey);
        return pair.length === 2 && pair.every((candidate) => candidate.state === 'hidden');
    });
};

const hasPeekTarget = (run: RunState): boolean =>
    (run.board?.tiles ?? []).some(
        (tile) => tile.state === 'hidden' && !run.peekRevealedTileIds.includes(tile.id)
    );

const peekDisabledReason = (run: RunState): string | null =>
    onlyWhilePlaying(run) ??
    (run.peekCharges < 1
        ? 'No peek charges.'
        : hasOpenFlip(run)
          ? 'Resolve the current flip first.'
          : !hasPeekTarget(run)
            ? 'No hidden peek targets.'
            : null);

const destroyDisabledReason = (run: RunState): string | null =>
    onlyWhilePlaying(run) ??
    (run.activeContract?.noDestroy
        ? 'Scholar contract disables destroy.'
        : run.destroyPairCharges < 1
          ? 'No destroy charges.'
          : hasOpenFlip(run)
            ? 'Resolve the current flip first.'
            : !hasDestroyTarget(run)
              ? 'No fully hidden pair to destroy.'
              : null);

export const getPowerVerbRows = (run: RunState): PowerVerbTeachingRow[] => [
    {
        id: 'pin',
        label: 'Pin',
        job: 'Recall',
        mechanicClass: 'tool',
        tokens: ['hidden_known', 'build'],
        purpose: 'Mark remembered locations without revealing or changing tiles.',
        cost: `${run.pinnedTileIds.length} pinned now; pins are slot-limited.`,
        consequence: 'Records your read only; it does not reveal or solve cards.',
        perfectMemoryImpact: 'allowed',
        perfectMemoryCopy: perfectMemoryImpactCopy('allowed'),
        memoryTax: CORE_SAFE_MEMORY_TAX,
        disabledReason:
            onlyWhilePlaying(run) ??
            (run.activeContract?.maxPinsTotalRun != null &&
            run.pinsPlacedCountThisRun >= run.activeContract.maxPinsTotalRun
                ? 'Pin vow placement cap reached.'
                : null)
    },
    {
        id: 'peek',
        label: 'Peek',
        job: 'Recall',
        mechanicClass: 'bailout',
        tokens: ['hidden_known', 'cost', 'forfeit'],
        purpose: 'Briefly reveal one hidden tile when memory needs a cue.',
        cost: `${run.peekCharges} peek charge(s).`,
        consequence: 'Spends a charge for exact information on one tile.',
        perfectMemoryImpact: 'locks_perfect_memory',
        perfectMemoryCopy: locksPerfectMemory,
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, informationBypass: 2, uiComprehensionLoad: 1 },
        disabledReason: peekDisabledReason(run)
    },
    {
        id: 'flash_pair',
        label: 'Flash',
        job: 'Recall',
        mechanicClass: 'bailout',
        tokens: ['hidden_known', 'cost', 'forfeit'],
        purpose: 'Reveal one random hidden pair briefly in Practice or Wild runs.',
        cost: `${run.flashPairCharges} flash charge(s).`,
        consequence: 'Temporarily shows a pair and counts as an assist.',
        perfectMemoryImpact: 'locks_perfect_memory',
        perfectMemoryCopy: locksPerfectMemory,
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, informationBypass: 2, mistakeRecovery: 1, uiComprehensionLoad: 1 },
        disabledReason: onlyWhilePlaying(run) ?? (run.flashPairCharges < 1 ? 'No flash charges.' : null)
    },
    {
        id: 'shuffle',
        label: 'Shuffle',
        job: 'Search',
        mechanicClass: 'bailout',
        tokens: ['cost', 'forfeit', 'locked'],
        purpose: 'Re-roll hidden tile positions when the layout is no longer useful.',
        cost: run.activeContract?.noShuffle ? 'Locked by Scholar contract.' : `${run.shuffleCharges} full-board charge(s).`,
        consequence: 'Breaks the current spatial read and counts as an assist.',
        perfectMemoryImpact: 'locks_perfect_memory',
        perfectMemoryCopy: locksPerfectMemory,
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, spatialDisruption: 2, mistakeRecovery: 1, uiComprehensionLoad: 1 },
        disabledReason:
            onlyWhilePlaying(run) ??
            (run.activeContract?.noShuffle
                ? 'Scholar contract disables full-board shuffle.'
                : run.shuffleCharges < 1
                  ? 'No shuffle charges.'
                  : run.board?.flippedTileIds.length
                    ? 'Resolve the current flip first.'
                    : null)
    },
    {
        id: 'region_shuffle',
        label: 'Rows',
        job: 'Search',
        mechanicClass: 'bailout',
        tokens: ['cost', 'forfeit', 'locked'],
        purpose: 'Shuffle one row while preserving the rest of your spatial read.',
        cost: `${run.regionShuffleCharges} row charge(s); relics may make the first row free.`,
        consequence: 'Breaks memory for one row and counts as an assist.',
        perfectMemoryImpact: 'locks_perfect_memory',
        perfectMemoryCopy: locksPerfectMemory,
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, spatialDisruption: 1, mistakeRecovery: 1, uiComprehensionLoad: 1 },
        disabledReason:
            onlyWhilePlaying(run) ??
            (run.activeContract?.noShuffle
                ? 'Scholar contract disables row shuffle.'
                : run.regionShuffleCharges < 1 && !run.regionShuffleFreeThisFloor
                  ? 'No row shuffle charge or free row shuffle.'
                  : null)
    },
    {
        id: 'destroy_pair',
        label: 'Destroy',
        job: 'Damage control',
        mechanicClass: 'bailout',
        tokens: ['cost', 'forfeit', 'resolved', 'locked'],
        purpose: 'Remove a fully hidden pair for no match score.',
        cost: `${run.destroyPairCharges} destroy charge(s).`,
        consequence: 'Forfeits match score and pickups/rewards on that pair.',
        perfectMemoryImpact: 'locks_perfect_memory',
        perfectMemoryCopy: locksPerfectMemory,
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, mistakeRecovery: 2, boardCompletionRisk: 1, uiComprehensionLoad: 1 },
        disabledReason: destroyDisabledReason(run)
    },
    {
        id: 'stray_remove',
        label: 'Stray',
        job: 'Damage control',
        mechanicClass: 'bailout',
        tokens: ['cost', 'forfeit', 'resolved'],
        purpose: 'Remove one completion-safe hidden singleton to reduce overload.',
        cost: `${run.strayRemoveCharges} stray-remove charge(s).`,
        consequence: 'Blocks normal pairs, removes one legal singleton tile, and counts as an assist.',
        perfectMemoryImpact: 'locks_perfect_memory',
        perfectMemoryCopy: locksPerfectMemory,
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, mistakeRecovery: 1, boardCompletionRisk: 1, uiComprehensionLoad: 1 },
        disabledReason: onlyWhilePlaying(run) ?? (run.strayRemoveCharges < 1 ? 'No stray-remove charges.' : null)
    },
    {
        id: 'undo_resolve',
        label: 'Undo',
        job: 'Damage control',
        mechanicClass: 'bailout',
        tokens: ['cost', 'forfeit'],
        purpose: 'Cancel a resolving flip before it commits.',
        cost: `${run.undoUsesThisFloor} undo use(s) this floor.`,
        consequence: 'Rewinds a pending mistake window and counts as an assist.',
        perfectMemoryImpact: 'locks_perfect_memory',
        perfectMemoryCopy: locksPerfectMemory,
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, mistakeRecovery: 2, uiComprehensionLoad: 1 },
        disabledReason: run.undoUsesThisFloor < 1 ? 'No undo uses this floor.' : null
    },
    {
        id: 'gambit',
        label: 'Gambit',
        job: 'Risk',
        mechanicClass: 'bailout',
        tokens: ['risk', 'cost', 'forfeit'],
        purpose: 'Commit a third flip during a mismatch to look for a rescue match.',
        cost: run.gambitAvailableThisFloor ? 'One chance this floor.' : 'Already spent this floor.',
        consequence: 'Turns a miss into a risky rescue attempt and counts as an assist.',
        perfectMemoryImpact: 'locks_perfect_memory',
        perfectMemoryCopy: locksPerfectMemory,
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, mistakeRecovery: 2, hiddenPunishment: 1, uiComprehensionLoad: 2 },
        disabledReason: run.gambitAvailableThisFloor ? null : 'Gambit already used this floor.'
    }
];

export const getPowerVerbTeachingRows = getPowerVerbRows;

export const getPowerVerbTeachingSummary = (run: RunState): string =>
    getPowerVerbRows(run)
        .map((row) => `${row.job}: ${row.label} - ${row.purpose} ${row.perfectMemoryCopy}`)
        .join(' ');
