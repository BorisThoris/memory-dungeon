import type { RunState } from './contracts';
import {
    CORE_SAFE_MEMORY_TAX,
    perfectMemoryImpactCopy,
    type MechanicClass,
    type MechanicTokenId,
    type MemoryTaxScore,
    type PerfectMemoryImpact
} from './mechanic-feedback';
import { runRelicIds } from './relics';

export type PowerVerbId =
    | 'shuffle'
    | 'region_shuffle'
    | 'tile_swap'
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

const nonNegativePowerVerbCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const powerVerbArrayCount = (value: unknown): number => (Array.isArray(value) ? value.length : 0);

const powerVerbArrayIncludes = (value: unknown, item: string): boolean => Array.isArray(value) && value.includes(item);

const hasOpenFlip = (run: RunState): boolean =>
    run.board ? !Array.isArray(run.board.flippedTileIds) || run.board.flippedTileIds.length > 0 : false;

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
        (tile) => tile.state === 'hidden' && !powerVerbArrayIncludes(run.peekRevealedTileIds, tile.id)
    );

const hasRowShufflePayment = (run: RunState): boolean =>
    nonNegativePowerVerbCount(run.regionShuffleCharges) > 0 ||
    (run.regionShuffleFreeThisFloor && runRelicIds(run.relicIds).includes('region_shuffle_free_first'));

const hiddenTileCount = (run: RunState): number =>
    (run.board?.tiles ?? []).filter((tile) => tile.state === 'hidden').length;

const peekDisabledReason = (run: RunState, peekCharges: number): string | null =>
    onlyWhilePlaying(run) ??
    (peekCharges < 1
        ? 'No peek charges.'
        : hasOpenFlip(run)
          ? 'Resolve the current flip first.'
          : !hasPeekTarget(run)
            ? 'No hidden peek targets.'
            : null);

const destroyDisabledReason = (run: RunState, destroyPairCharges: number): string | null =>
    onlyWhilePlaying(run) ??
    (run.activeContract?.noDestroy
        ? 'Scholar contract disables destroy.'
        : destroyPairCharges < 1
          ? 'No destroy charges.'
          : hasOpenFlip(run)
            ? 'Resolve the current flip first.'
            : !hasDestroyTarget(run)
              ? 'No fully hidden pair to destroy.'
              : null);

export const getPowerVerbRows = (run: RunState): PowerVerbTeachingRow[] => {
    const shuffleCharges = nonNegativePowerVerbCount(run.shuffleCharges);
    const regionShuffleCharges = nonNegativePowerVerbCount(run.regionShuffleCharges);
    const peekCharges = nonNegativePowerVerbCount(run.peekCharges);
    const destroyPairCharges = nonNegativePowerVerbCount(run.destroyPairCharges);
    const strayRemoveCharges = nonNegativePowerVerbCount(run.strayRemoveCharges);
    const flashPairCharges = nonNegativePowerVerbCount(run.flashPairCharges);
    const undoUsesThisFloor = nonNegativePowerVerbCount(run.undoUsesThisFloor);
    const pinsPlacedCountThisRun = nonNegativePowerVerbCount(run.pinsPlacedCountThisRun);
    const maxPinsTotalRun =
        run.activeContract?.maxPinsTotalRun == null
            ? null
            : nonNegativePowerVerbCount(run.activeContract.maxPinsTotalRun);

    return [
    {
        id: 'pin',
        label: 'Pin',
        job: 'Recall',
        mechanicClass: 'tool',
        tokens: ['hidden_known', 'build'],
        purpose: 'Mark remembered locations without revealing or changing tiles.',
        cost: `${powerVerbArrayCount(run.pinnedTileIds)} pinned now; pins are slot-limited.`,
        consequence: 'Records your read only; it does not reveal or solve cards.',
        perfectMemoryImpact: 'allowed',
        perfectMemoryCopy: perfectMemoryImpactCopy('allowed'),
        memoryTax: CORE_SAFE_MEMORY_TAX,
        disabledReason:
            onlyWhilePlaying(run) ??
            (maxPinsTotalRun != null &&
            pinsPlacedCountThisRun >= maxPinsTotalRun
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
        cost: `${peekCharges} peek charge(s).`,
        consequence: 'Spends a charge for exact information on one tile.',
        perfectMemoryImpact: 'locks_perfect_memory',
        perfectMemoryCopy: locksPerfectMemory,
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, informationBypass: 2, uiComprehensionLoad: 1 },
        disabledReason: peekDisabledReason(run, peekCharges)
    },
    {
        id: 'flash_pair',
        label: 'Flash',
        job: 'Recall',
        mechanicClass: 'bailout',
        tokens: ['hidden_known', 'cost', 'forfeit'],
        purpose: 'Reveal one random hidden pair briefly in Practice or Wild runs.',
        cost: `${flashPairCharges} flash charge(s).`,
        consequence: 'Temporarily shows a pair and counts as an assist.',
        perfectMemoryImpact: 'locks_perfect_memory',
        perfectMemoryCopy: locksPerfectMemory,
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, informationBypass: 2, mistakeRecovery: 1, uiComprehensionLoad: 1 },
        disabledReason: onlyWhilePlaying(run) ?? (flashPairCharges < 1 ? 'No flash charges.' : null)
    },
    {
        id: 'shuffle',
        label: 'Shuffle',
        job: 'Search',
        mechanicClass: 'bailout',
        tokens: ['cost', 'forfeit', 'locked'],
        purpose: 'Re-roll hidden tile positions when the layout is no longer useful.',
        cost: run.activeContract?.noShuffle ? 'Locked by Scholar contract.' : `${shuffleCharges} full-board charge(s).`,
        consequence: 'Breaks the current spatial read and counts as an assist.',
        perfectMemoryImpact: 'locks_perfect_memory',
        perfectMemoryCopy: locksPerfectMemory,
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, spatialDisruption: 2, mistakeRecovery: 1, uiComprehensionLoad: 1 },
        disabledReason:
            onlyWhilePlaying(run) ??
            (run.activeContract?.noShuffle
                ? 'Scholar contract disables full-board shuffle.'
                : shuffleCharges < 1
                  ? 'No shuffle charges.'
                  : hasOpenFlip(run)
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
        cost: `${regionShuffleCharges} row/swap charge(s); relics may make the first row shuffle or tile swap free.`,
        consequence: 'Breaks memory for one row and counts as an assist.',
        perfectMemoryImpact: 'locks_perfect_memory',
        perfectMemoryCopy: locksPerfectMemory,
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, spatialDisruption: 1, mistakeRecovery: 1, uiComprehensionLoad: 1 },
        disabledReason:
            onlyWhilePlaying(run) ??
            (run.activeContract?.noShuffle
                ? 'Scholar contract disables row shuffle.'
                : hasOpenFlip(run)
                  ? 'Resolve the current flip first.'
                  : !hasRowShufflePayment(run)
                    ? 'No row/swap charge or free row shuffle.'
                    : null)
    },
    {
        id: 'tile_swap',
        label: 'Swap',
        job: 'Search',
        mechanicClass: 'bailout',
        tokens: ['cost', 'forfeit', 'locked'],
        purpose: 'Exchange two hidden tile positions to set up trait adjacency or repair a bad layout read.',
        cost: `${regionShuffleCharges} row/swap charge(s); relics may make the first row shuffle or tile swap free.`,
        consequence: 'Invalidates memory for the two moved tiles and counts as an assist.',
        perfectMemoryImpact: 'locks_perfect_memory',
        perfectMemoryCopy: locksPerfectMemory,
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, spatialDisruption: 1, mistakeRecovery: 1, uiComprehensionLoad: 2 },
        disabledReason:
            onlyWhilePlaying(run) ??
            (run.activeContract?.noShuffle
                ? 'Scholar contract disables tile swap.'
                : hasOpenFlip(run)
                  ? 'Resolve the current flip first.'
                  : !hasRowShufflePayment(run)
                    ? 'No row/swap charge or free swap.'
                    : hiddenTileCount(run) < 2
                      ? 'Need two hidden tiles to swap.'
                      : null)
    },
    {
        id: 'destroy_pair',
        label: 'Destroy',
        job: 'Damage control',
        mechanicClass: 'bailout',
        tokens: ['cost', 'forfeit', 'resolved', 'locked'],
        purpose: 'Remove a fully hidden pair for no match score.',
        cost: `${destroyPairCharges} destroy charge(s).`,
        consequence: 'Forfeits match score and pickups/rewards on that pair.',
        perfectMemoryImpact: 'locks_perfect_memory',
        perfectMemoryCopy: locksPerfectMemory,
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, mistakeRecovery: 2, boardCompletionRisk: 1, uiComprehensionLoad: 1 },
        disabledReason: destroyDisabledReason(run, destroyPairCharges)
    },
    {
        id: 'stray_remove',
        label: 'Stray',
        job: 'Damage control',
        mechanicClass: 'bailout',
        tokens: ['cost', 'forfeit', 'resolved'],
        purpose: 'Remove one completion-safe hidden singleton to reduce overload.',
        cost: `${strayRemoveCharges} stray-remove charge(s).`,
        consequence: 'Blocks normal pairs, removes one legal singleton tile, and counts as an assist.',
        perfectMemoryImpact: 'locks_perfect_memory',
        perfectMemoryCopy: locksPerfectMemory,
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, mistakeRecovery: 1, boardCompletionRisk: 1, uiComprehensionLoad: 1 },
        disabledReason: onlyWhilePlaying(run) ?? (strayRemoveCharges < 1 ? 'No stray-remove charges.' : null)
    },
    {
        id: 'undo_resolve',
        label: 'Undo',
        job: 'Damage control',
        mechanicClass: 'bailout',
        tokens: ['cost', 'forfeit'],
        purpose: 'Cancel a resolving flip before it commits.',
        cost: `${undoUsesThisFloor} undo use(s) this floor.`,
        consequence: 'Rewinds a pending mistake window and counts as an assist.',
        perfectMemoryImpact: 'locks_perfect_memory',
        perfectMemoryCopy: locksPerfectMemory,
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, mistakeRecovery: 2, uiComprehensionLoad: 1 },
        disabledReason: undoUsesThisFloor < 1 ? 'No undo uses this floor.' : null
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
};

export const getPowerVerbTeachingRows = getPowerVerbRows;

export const getPowerVerbTeachingSummary = (run: RunState): string =>
    getPowerVerbRows(run)
        .map((row) => `${row.job}: ${row.label} - ${row.purpose} ${row.perfectMemoryCopy}`)
        .join(' ');
