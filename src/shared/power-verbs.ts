import { tr } from './i18n';
import type { RunState } from './contracts';
import {
    CORE_SAFE_MEMORY_TAX,
    perfectMemoryImpactCopy,
    type MechanicClass,
    type MechanicTokenId,
    type MemoryTaxScore,
    type PerfectMemoryImpact
} from './mechanic-feedback';
import { runArrayCount, runStringArray } from './run-array-guards';
import { runNonNegativeInteger } from './run-number-guards';

export type PowerVerbId =
    | 'shuffle'
    | 'region_shuffle'
    | 'tile_swap'
    | 'pin'
    | 'peek'
    | 'flash_pair'
    | 'undo_resolve'
    | 'gambit';

/** A display label (translated), never compared. */
export type PowerVerbJob = string;

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
    recall: tr.s('Recall'),
    search: tr.s('Search'),
    damage_control: tr.s('Damage control'),
    risk: tr.s('Risk')
} as const;

const onlyWhilePlaying = (run: RunState): string | null => (run.status === 'playing' ? null : tr.s('Only while playing.'));
const locksPerfectMemory = perfectMemoryImpactCopy('locks_perfect_memory');

const powerVerbArrayIncludes = (value: unknown, item: string): boolean => runStringArray(value).includes(item);

const hasOpenFlip = (run: RunState): boolean =>
    run.board ? !Array.isArray(run.board.flippedTileIds) || run.board.flippedTileIds.length > 0 : false;

const hasPeekTarget = (run: RunState): boolean =>
    (run.board?.tiles ?? []).some(
        (tile) => tile.state === 'hidden' && !powerVerbArrayIncludes(run.peekRevealedTileIds, tile.id)
    );

const hasRowShufflePayment = (run: RunState): boolean =>
    runNonNegativeInteger(run.regionShuffleCharges) > 0;

const hiddenTileCount = (run: RunState): number =>
    (run.board?.tiles ?? []).filter((tile) => tile.state === 'hidden').length;

const peekDisabledReason = (run: RunState, peekCharges: number): string | null =>
    onlyWhilePlaying(run) ??
    (peekCharges < 1
        ? tr.s('No peek charges.')
        : hasOpenFlip(run)
          ? tr.s('Resolve the current flip first.')
          : !hasPeekTarget(run)
            ? tr.s('No hidden peek targets.')
            : null);

export const getPowerVerbRows = (run: RunState): PowerVerbTeachingRow[] => {
    const shuffleCharges = runNonNegativeInteger(run.shuffleCharges);
    const regionShuffleCharges = runNonNegativeInteger(run.regionShuffleCharges);
    const peekCharges = runNonNegativeInteger(run.peekCharges);
    const flashPairCharges = runNonNegativeInteger(run.flashPairCharges);
    const undoUsesThisFloor = runNonNegativeInteger(run.undoUsesThisFloor);
    const pinsPlacedCountThisRun = runNonNegativeInteger(run.pinsPlacedCountThisRun);
    const maxPinsTotalRun =
        run.activeContract?.maxPinsTotalRun == null
            ? null
            : runNonNegativeInteger(run.activeContract.maxPinsTotalRun);

    return [
    {
        id: 'pin',
        label: tr.s('Pin'),
        job: tr.s('Recall'),
        mechanicClass: 'tool',
        tokens: ['hidden_known', 'build'],
        purpose: tr.s('Mark remembered locations without revealing or changing tiles.'),
        cost: tr`${runArrayCount(run.pinnedTileIds)} pinned now; pins are slot-limited.`,
        consequence: tr.s('Records your read only; it does not reveal or solve cards.'),
        perfectMemoryImpact: 'allowed',
        perfectMemoryCopy: perfectMemoryImpactCopy('allowed'),
        memoryTax: CORE_SAFE_MEMORY_TAX,
        disabledReason:
            onlyWhilePlaying(run) ??
            (maxPinsTotalRun != null &&
            pinsPlacedCountThisRun >= maxPinsTotalRun
                ? tr.s('Pin vow placement cap reached.')
                : null)
    },
    {
        id: 'peek',
        label: tr.s('Peek'),
        job: tr.s('Recall'),
        mechanicClass: 'bailout',
        tokens: ['hidden_known', 'cost', 'forfeit'],
        purpose: tr.s('Briefly reveal one hidden tile when memory needs a cue.'),
        cost: tr`${peekCharges} peek charge(s).`,
        consequence: tr.s('Spends a charge for exact information on one tile.'),
        perfectMemoryImpact: 'locks_perfect_memory',
        perfectMemoryCopy: locksPerfectMemory,
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, informationBypass: 2, uiComprehensionLoad: 1 },
        disabledReason: peekDisabledReason(run, peekCharges)
    },
    {
        id: 'flash_pair',
        label: tr.s('Flash'),
        job: tr.s('Recall'),
        mechanicClass: 'bailout',
        tokens: ['hidden_known', 'cost', 'forfeit'],
        purpose: tr.s('Reveal one random hidden pair briefly in Practice or Wild runs.'),
        cost: tr`${flashPairCharges} flash charge(s).`,
        consequence: tr.s('Temporarily shows a pair and counts as an assist.'),
        perfectMemoryImpact: 'locks_perfect_memory',
        perfectMemoryCopy: locksPerfectMemory,
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, informationBypass: 2, mistakeRecovery: 1, uiComprehensionLoad: 1 },
        disabledReason: onlyWhilePlaying(run) ?? (flashPairCharges < 1 ? tr.s('No flash charges.') : null)
    },
    {
        id: 'shuffle',
        label: tr.s('Shuffle'),
        job: tr.s('Search'),
        mechanicClass: 'bailout',
        tokens: ['cost', 'forfeit', 'locked'],
        purpose: tr.s('Re-roll hidden tile positions when the layout is no longer useful.'),
        cost: run.activeContract?.noShuffle ? tr.s('Locked by Scholar contract.') : tr`${shuffleCharges} full-board charge(s).`,
        consequence: tr.s('Breaks the current spatial read and counts as an assist.'),
        perfectMemoryImpact: 'locks_perfect_memory',
        perfectMemoryCopy: locksPerfectMemory,
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, spatialDisruption: 2, mistakeRecovery: 1, uiComprehensionLoad: 1 },
        disabledReason:
            onlyWhilePlaying(run) ??
            (run.activeContract?.noShuffle
                ? tr.s('Scholar contract disables full-board shuffle.')
                : shuffleCharges < 1
                  ? tr.s('No shuffle charges.')
                  : hasOpenFlip(run)
                    ? tr.s('Resolve the current flip first.')
                    : null)
    },
    {
        id: 'region_shuffle',
        label: tr.s('Rows'),
        job: tr.s('Search'),
        mechanicClass: 'bailout',
        tokens: ['cost', 'forfeit', 'locked'],
        purpose: tr.s('Shuffle one row while preserving the rest of your spatial read.'),
        cost: tr`${regionShuffleCharges} row/swap charge(s); build effects may make the first row shuffle or tile swap free.`,
        consequence: tr.s('Breaks memory for one row and counts as an assist.'),
        perfectMemoryImpact: 'locks_perfect_memory',
        perfectMemoryCopy: locksPerfectMemory,
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, spatialDisruption: 1, mistakeRecovery: 1, uiComprehensionLoad: 1 },
        disabledReason:
            onlyWhilePlaying(run) ??
            (run.activeContract?.noShuffle
                ? tr.s('Scholar contract disables row shuffle.')
                : hasOpenFlip(run)
                  ? tr.s('Resolve the current flip first.')
                  : !hasRowShufflePayment(run)
                    ? tr.s('No row or swap charge.')
                    : null)
    },
    {
        id: 'tile_swap',
        label: tr.s('Swap'),
        job: tr.s('Search'),
        mechanicClass: 'bailout',
        tokens: ['cost', 'forfeit', 'locked'],
        purpose: tr.s('Exchange two hidden tile positions to set up trait adjacency or repair a bad layout read.'),
        cost: tr`${regionShuffleCharges} row/swap charge(s); build effects may make the first row shuffle or tile swap free.`,
        consequence: tr.s('Invalidates memory for the two moved tiles and counts as an assist.'),
        perfectMemoryImpact: 'locks_perfect_memory',
        perfectMemoryCopy: locksPerfectMemory,
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, spatialDisruption: 1, mistakeRecovery: 1, uiComprehensionLoad: 2 },
        disabledReason:
            onlyWhilePlaying(run) ??
            (run.activeContract?.noShuffle
                ? tr.s('Scholar contract disables tile swap.')
                : hasOpenFlip(run)
                  ? tr.s('Resolve the current flip first.')
                  : !hasRowShufflePayment(run)
                    ? tr.s('No row/swap charge or free swap.')
                    : hiddenTileCount(run) < 2
                      ? tr.s('Need two hidden tiles to swap.')
                      : null)
    },
    {
        id: 'undo_resolve',
        label: tr.s('Undo'),
        job: tr.s('Damage control'),
        mechanicClass: 'bailout',
        tokens: ['cost', 'forfeit'],
        purpose: tr.s('Cancel a resolving flip before it commits.'),
        cost: tr`${undoUsesThisFloor} undo use(s) this floor.`,
        consequence: tr.s('Rewinds a pending mistake window and counts as an assist.'),
        perfectMemoryImpact: 'locks_perfect_memory',
        perfectMemoryCopy: locksPerfectMemory,
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, mistakeRecovery: 2, uiComprehensionLoad: 1 },
        disabledReason: undoUsesThisFloor < 1 ? tr.s('No undo uses this floor.') : null
    },
    {
        id: 'gambit',
        label: tr.s('Gambit'),
        job: tr.s('Risk'),
        mechanicClass: 'bailout',
        tokens: ['risk', 'cost', 'forfeit'],
        purpose: tr.s('Commit a third flip during a mismatch to look for a rescue match.'),
        cost: run.gambitAvailableThisFloor ? tr.s('One chance this floor.') : tr.s('Already spent this floor.'),
        consequence: tr.s('Turns a miss into a risky rescue attempt and counts as an assist.'),
        perfectMemoryImpact: 'locks_perfect_memory',
        perfectMemoryCopy: locksPerfectMemory,
        memoryTax: { ...CORE_SAFE_MEMORY_TAX, mistakeRecovery: 2, hiddenPunishment: 1, uiComprehensionLoad: 2 },
        disabledReason: run.gambitAvailableThisFloor ? null : tr.s('Gambit already used this floor.')
    }
    ];
};

export const getPowerVerbTeachingRows = getPowerVerbRows;

export const getPowerVerbTeachingSummary = (run: RunState): string =>
    getPowerVerbRows(run)
        .map((row) => `${row.job}: ${row.label} - ${row.purpose} ${row.perfectMemoryCopy}`)
        .join(' ');
