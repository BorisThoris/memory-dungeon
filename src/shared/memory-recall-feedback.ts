import {
    MAX_PENDING_MEMORIZE_BONUS_MS,
    RECALL_FOCUS_MATCH_SCORE,
    type RunState,
    type MutatorId,
    type Tile
} from './contracts';
import { normalizeRecallFocus } from './recall-rules';
import { runArray, runStringArray } from './run-array-guards';
import { runNonNegativeInteger } from './run-number-guards';
import { isSingletonUtilityPairKey } from './tile-identity';

export type MemoryFeedbackTone = 'stable' | 'watch' | 'danger' | 'reward';

export interface MemoryFeedbackLine {
    id: string;
    label: string;
    detail: string;
    tone: MemoryFeedbackTone;
}

export interface MemoryBurdenFeedback {
    score: number;
    label: 'light' | 'loaded' | 'taxed' | 'breaking';
    detail: string;
    tone: MemoryFeedbackTone;
}

export interface MemoryRecallFeedback {
    focus: number;
    focusLabel: 'unfocused' | 'warming' | 'locked';
    roomIdentity: string;
    atmosphericSummary: string;
    atmosphericBeat: string;
    pressureDetail: string;
    nextMemoryMove: MemoryFeedbackLine;
    nextCleanMatchBonus: number;
    forgottenTileCount: number;
    forgottenSymbols: string[];
    symbolMap: MemorySymbolMap;
    burden: MemoryBurdenFeedback;
    pressure: 'clear' | 'strained' | 'overloaded';
    path: MemoryFeedbackLine[];
    symbols: MemoryFeedbackLine[];
    recallPlan: MemoryFeedbackLine[];
    penalties: MemoryFeedbackLine[];
    upgrades: MemoryFeedbackLine[];
}

export interface MemorySymbolMap {
    knownPairCount: number;
    partialPairCount: number;
    hiddenPairCount: number;
    clearedPairCount: number;
    pinnedIntersectionCount: number;
    forgottenIntersectionCount: number;
    nextSymbolPrompt: string;
}

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

const isMemorySolvablePair = (pairKey: string, tiles: readonly Tile[]): boolean =>
    tiles.length === 2 && !isSingletonUtilityPairKey(pairKey);

const tileMemoryLabel = (tile: Tile): string => tile.label || tile.symbol || tile.id;

const tileIsCleared = (tile: Tile): boolean => tile.state === 'matched' || tile.state === 'removed';

const tileIsKnownToMemory = (tile: Tile, pinnedTileIds: ReadonlySet<string>): boolean =>
    tile.state === 'flipped' || tile.state === 'matched' || pinnedTileIds.has(tile.id);

const buildSymbolMap = (tiles: readonly Tile[], pinnedTileIds: readonly string[], forgottenTileIds: readonly string[]): MemorySymbolMap => {
    const pinnedSet = new Set(pinnedTileIds);
    const forgottenSet = new Set(forgottenTileIds);
    const groups = new Map<string, Tile[]>();
    for (const tile of tiles) {
        groups.set(tile.pairKey, [...(groups.get(tile.pairKey) ?? []), tile]);
    }

    let knownPairCount = 0;
    let partialPairCount = 0;
    let hiddenPairCount = 0;
    let clearedPairCount = 0;
    let pinnedIntersectionCount = 0;
    let forgottenIntersectionCount = 0;

    for (const [pairKey, pairTiles] of groups.entries()) {
        if (!isMemorySolvablePair(pairKey, pairTiles)) {
            continue;
        }

        if (pairTiles.every(tileIsCleared)) {
            clearedPairCount += 1;
            continue;
        }

        const unresolvedTiles = pairTiles.filter((tile) => !tileIsCleared(tile));
        const knownUnresolvedCount = unresolvedTiles.filter((tile) => tileIsKnownToMemory(tile, pinnedSet)).length;
        pinnedIntersectionCount += unresolvedTiles.filter((tile) => pinnedSet.has(tile.id)).length;
        forgottenIntersectionCount += unresolvedTiles.filter((tile) => forgottenSet.has(tile.id)).length;

        if (knownUnresolvedCount >= 2) {
            knownPairCount += 1;
        } else if (knownUnresolvedCount === 1) {
            partialPairCount += 1;
        } else {
            hiddenPairCount += 1;
        }
    }

    const nextSymbolPrompt =
        forgottenIntersectionCount > 0
            ? 'Repair forgotten intersections before spending route pressure.'
            : knownPairCount > 0
              ? 'Resolve a known pair to convert memory into score.'
              : partialPairCount > 0
                ? 'Find the mate for a partial symbol read.'
                : 'Open one safe clue and start a fresh symbol trail.';

    return {
        knownPairCount,
        partialPairCount,
        hiddenPairCount,
        clearedPairCount,
        pinnedIntersectionCount,
        forgottenIntersectionCount,
        nextSymbolPrompt
    };
};

const buildRecallPlan = (tiles: readonly Tile[], pinnedTileIds: readonly string[], forgottenTileIds: readonly string[]): MemoryFeedbackLine[] => {
    const pinnedSet = new Set(pinnedTileIds);
    const forgottenSet = new Set(forgottenTileIds);
    const groups = new Map<string, Tile[]>();
    for (const tile of tiles) {
        groups.set(tile.pairKey, [...(groups.get(tile.pairKey) ?? []), tile]);
    }

    const knownPairs: string[] = [];
    const partialReads: string[] = [];
    const forgottenReads: string[] = [];

    for (const [pairKey, pairTiles] of groups.entries()) {
        if (!isMemorySolvablePair(pairKey, pairTiles) || pairTiles.every(tileIsCleared)) {
            continue;
        }

        const unresolvedTiles = pairTiles.filter((tile) => !tileIsCleared(tile));
        const knownUnresolved = unresolvedTiles.filter((tile) => tileIsKnownToMemory(tile, pinnedSet));
        const forgottenUnresolved = unresolvedTiles.filter((tile) => forgottenSet.has(tile.id));
        const labelTile = unresolvedTiles[0] ?? pairTiles[0];
        if (!labelTile) {
            continue;
        }
        const label = tileMemoryLabel(labelTile);

        if (forgottenUnresolved.length > 0) {
            forgottenReads.push(label);
        } else if (knownUnresolved.length >= 2) {
            knownPairs.push(label);
        } else if (knownUnresolved.length === 1) {
            partialReads.push(label);
        }
    }

    const plan: MemoryFeedbackLine[] = [];
    if (forgottenReads.length > 0) {
        plan.push({
            id: 'recall-plan-forget-risk',
            label: `Forgetting risk: ${forgottenReads.slice(0, 3).join(', ')}`,
            detail: 'Repair these symbols with a confirmed match before spending greed, shuffle, or peek pressure.',
            tone: 'danger'
        });
    }
    if (knownPairs.length > 0) {
        plan.push({
            id: 'recall-plan-known-pairs',
            label: `Recall now: ${knownPairs.slice(0, 3).join(', ')}`,
            detail: 'These pairs have enough remembered position data to convert recall into score immediately.',
            tone: 'reward'
        });
    }
    if (partialReads.length > 0) {
        plan.push({
            id: 'recall-plan-partial-reads',
            label: `Remember next: ${partialReads.slice(0, 3).join(', ')}`,
            detail: 'One side is anchored; search for the mate instead of opening unrelated symbols.',
            tone: 'watch'
        });
    }

    if (plan.length === 0) {
        plan.push({
            id: 'recall-plan-fresh-read',
            label: 'Start a fresh room read',
            detail: 'Open one safe symbol, pin it if the board is noisy, then build the next pair trail from that anchor.',
            tone: 'stable'
        });
    }

    return plan;
};

const focusLabelFor = (focus: number): MemoryRecallFeedback['focusLabel'] => {
    if (focus <= 0) return 'unfocused';
    if (focus <= 1) return 'warming';
    return 'locked';
};

const pressureDetailFor = (
    pressure: MemoryRecallFeedback['pressure'],
    forgottenTileCount: number
): string => {
    if (pressure === 'overloaded') {
        return `Recall is overloaded: ${forgottenTileCount} forgotten tile marker${forgottenTileCount === 1 ? '' : 's'} are competing for attention.`;
    }
    if (pressure === 'strained') {
        return `Recall is strained: recover forgotten markers before route pressure stacks higher.`;
    }
    return 'Recall is clear: the room log has room for route, clue, and symbol reads.';
};

const atmosphericSummaryFor = (
    pressure: MemoryRecallFeedback['pressure'],
    focusLabel: MemoryRecallFeedback['focusLabel']
): string => {
    if (pressure === 'overloaded') {
        return 'The room log is crowded; old symbols scrape over the newest route marks.';
    }
    if (pressure === 'strained') {
        return 'The archive holds, but the next clean match needs a deliberate read.';
    }
    if (focusLabel === 'locked') {
        return 'The route is legible; clean recall is carrying the room.';
    }
    return 'The room is quiet enough to rebuild focus before the next branch.';
};

const roomIdentityFor = (run: RunState): string => (run.board ? `Floor ${run.board.level}` : 'Unindexed room');

const atmosphericBeatFor = ({
    roomIdentity,
    pressure,
    focusLabel,
    forgottenTileCount
}: {
    roomIdentity: string;
    pressure: MemoryRecallFeedback['pressure'];
    focusLabel: MemoryRecallFeedback['focusLabel'];
    forgottenTileCount: number;
}): string => {
    if (pressure === 'overloaded') {
        return `${roomIdentity}: the archive margins are full; ${forgottenTileCount} forgotten marker${forgottenTileCount === 1 ? '' : 's'} are blurring together.`;
    }
    if (pressure === 'strained') {
        return `${roomIdentity}: the room still answers, but the next match needs one clean remembered symbol.`;
    }
    if (focusLabel === 'locked') {
        return `${roomIdentity}: focus is locked; the route marks are holding steady.`;
    }
    return `${roomIdentity}: quiet enough to rebuild focus before the archive changes shape.`;
};

const pressureToneFor = (pressure: MemoryRecallFeedback['pressure']): MemoryFeedbackTone => {
    if (pressure === 'overloaded') return 'danger';
    if (pressure === 'strained') return 'watch';
    return 'stable';
};

const burdenLabelFor = (score: number): MemoryBurdenFeedback['label'] => {
    if (score >= 7) return 'breaking';
    if (score >= 5) return 'taxed';
    if (score >= 3) return 'loaded';
    return 'light';
};

const burdenToneFor = (label: MemoryBurdenFeedback['label']): MemoryFeedbackTone => {
    if (label === 'breaking') return 'danger';
    if (label === 'taxed' || label === 'loaded') return 'watch';
    return 'stable';
};

const burdenDetailFor = ({
    label,
    forgottenTileCount,
    partialPairCount
}: {
    label: MemoryBurdenFeedback['label'];
    forgottenTileCount: number;
    partialPairCount: number;
}): string => {
    const burdens = [
        forgottenTileCount > 0 ? `${forgottenTileCount} forgotten mark${forgottenTileCount === 1 ? '' : 's'}` : null,
        partialPairCount > 0 ? `${partialPairCount} partial symbol read${partialPairCount === 1 ? '' : 's'}` : null
    ].filter(Boolean);

    if (burdens.length === 0) {
        return 'The room log is light; use the next flip to create a reliable recall anchor.';
    }

    const burdenList = burdens.join(', ');
    if (label === 'breaking') {
        return `Memory burden is breaking under ${burdenList}; repair known information before adding new risk.`;
    }
    if (label === 'taxed') {
        return `Memory burden is taxed by ${burdenList}; cash in a known pair or choose the safer route.`;
    }
    if (label === 'loaded') {
        return `Memory burden is loaded with ${burdenList}; keep the next action tied to an existing clue.`;
    }
    return `Memory burden is light despite ${burdenList}; one deliberate recall action can keep control.`;
};

const buildMemoryBurden = ({
    forgottenTileCount,
    partialPairCount,
    recallMistakes
}: {
    forgottenTileCount: number;
    partialPairCount: number;
    recallMistakes: number;
}): MemoryBurdenFeedback => {
    const score = forgottenTileCount * 2 + partialPairCount + Math.min(2, recallMistakes);
    const label = burdenLabelFor(score);

    return {
        score,
        label,
        detail: burdenDetailFor({ label, forgottenTileCount, partialPairCount }),
        tone: burdenToneFor(label)
    };
};

const nextMemoryMoveFor = ({
    forgottenTileCount,
    nextCleanMatchBonus
}: {
    forgottenTileCount: number;
    nextCleanMatchBonus: number;
}): MemoryFeedbackLine => {
    if (forgottenTileCount > 0) {
        return {
            id: 'next-memory-move-forgotten',
            label: 'Recover forgotten marks',
            detail: `Confirm a known pair before chasing route value; ${forgottenTileCount} tile memory marker${forgottenTileCount === 1 ? ' is' : 's are'} unstable.`,
            tone: 'danger'
        };
    }
    if (nextCleanMatchBonus > 0) {
        return {
            id: 'next-memory-move-cash-in',
            label: 'Cash in clean recall',
            detail: `Resolve the safest known pair now to bank +${nextCleanMatchBonus} recall score.`,
            tone: 'reward'
        };
    }
    return {
        id: 'next-memory-move-build-focus',
        label: 'Build recall focus',
        detail: 'Choose the clearest symbol pair and rebuild the room log before spending assists.',
        tone: 'stable'
    };
};

const MEMORY_TAX_MUTATOR_COPY: Partial<Record<MutatorId, { label: string; detail: string; tone: MemoryFeedbackTone }>> = {
    short_memorize: {
        label: 'Short study tax',
        detail: 'The next route asks you to encode positions faster; use pins or known pairs before widening the search.',
        tone: 'danger'
    },
    wide_recall: {
        label: 'Wide recall tax',
        detail: 'More simultaneous symbols are in play, so partial reads decay faster unless they become confirmed pairs.',
        tone: 'watch'
    },
    silhouette_twist: {
        label: 'Silhouette tax',
        detail: 'Shape memory is less reliable; lean on labels, clue sources, and pinned intersections.',
        tone: 'watch'
    },
    n_back_anchor: {
        label: 'Anchor tax',
        detail: 'Track the previous anchor alongside the current pair so the room log does not split attention.',
        tone: 'watch'
    },
    distraction_channel: {
        label: 'Distraction tax',
        detail: 'Score pulses compete with symbol recall; resolve one known pair before chasing fresh information.',
        tone: 'watch'
    },
    category_letters: {
        label: 'Letter band tax',
        detail: 'Similar-looking letters raise confusion risk; call out the label before committing the mate.',
        tone: 'watch'
    },
    sticky_fingers: {
        label: 'Blocked flip tax',
        detail: 'A blocked index can break a remembered path; keep one alternate symbol trail available.',
        tone: 'watch'
    },
    shifting_spotlight: {
        label: 'Spotlight tax',
        detail: 'Bounty and ward rotation turn timing into a memory problem; remember which pair is safe to cash in.',
        tone: 'danger'
    }
};

const buildMemoryTaxLines = (run: RunState): MemoryFeedbackLine[] =>
    unique(runArray<MutatorId>(run.activeMutators))
        .flatMap((mutator) => {
            const copy = MEMORY_TAX_MUTATOR_COPY[mutator];
            return copy
                ? [
                      {
                          id: `memory-tax-${mutator}`,
                          ...copy
                      }
                  ]
                : [];
        })
        .slice(0, 4);

export const getMemoryRecallFeedback = (run: RunState): MemoryRecallFeedback => {
    const board = run.board;
    const tiles = board?.tiles ?? [];
    const forgottenTileIds = runStringArray(run.forgottenTileIdsThisFloor);
    const pinnedTileIds = runStringArray(run.pinnedTileIds);
    const forgottenSet = new Set(forgottenTileIds);
    const forgottenSymbols = unique(
        tiles
            .filter((tile) => forgottenSet.has(tile.id))
            .map(tileMemoryLabel)
    ).slice(0, 6);
    const focus = normalizeRecallFocus(run.recallFocus);
    const nextCleanMatchBonus = focus * RECALL_FOCUS_MATCH_SCORE;
    const symbolMap = buildSymbolMap(tiles, pinnedTileIds, forgottenTileIds);
    const recallPlan = buildRecallPlan(tiles, pinnedTileIds, forgottenTileIds);
    const overloadScore =
        run.recallMistakesThisFloor +
        Math.ceil(forgottenTileIds.length / 2);

    const pressure: MemoryRecallFeedback['pressure'] =
        overloadScore >= 4 ? 'overloaded' : overloadScore >= 2 ? 'strained' : 'clear';
    const focusLabel = focusLabelFor(focus);
    const roomIdentity = roomIdentityFor(run);
    const burden = buildMemoryBurden({
        forgottenTileCount: forgottenTileIds.length,
        partialPairCount: symbolMap.partialPairCount,
        recallMistakes: run.recallMistakesThisFloor
    });

    const path: MemoryFeedbackLine[] = [
        {
            id: 'room-atmosphere',
            label:
                pressure === 'overloaded'
                    ? 'Room log overloaded'
                    : pressure === 'strained'
                      ? 'Room log strained'
                      : 'Room log clear',
            detail: atmosphericSummaryFor(pressure, focusLabel),
            tone: pressureToneFor(pressure)
        }
    ];

    const symbols: MemoryFeedbackLine[] = [];
    const hiddenPairNoun = symbolMap.hiddenPairCount === 1 ? 'hidden pair remains' : 'hidden pairs remain';
    symbols.push({
        id: 'symbol-memory-map',
        label: `${symbolMap.knownPairCount} known pair${symbolMap.knownPairCount === 1 ? '' : 's'} / ${symbolMap.partialPairCount} partial read${symbolMap.partialPairCount === 1 ? '' : 's'}`,
        detail: `${symbolMap.nextSymbolPrompt} ${symbolMap.hiddenPairCount} ${hiddenPairNoun} unindexed.`,
        tone: symbolMap.forgottenIntersectionCount > 0 ? 'danger' : symbolMap.knownPairCount > 0 ? 'reward' : 'watch'
    });
    if (forgottenSymbols.length > 0) {
        symbols.push({
            id: 'forgotten-symbols',
            label: 'Forgotten symbols',
            detail: forgottenSymbols.join(', '),
            tone: 'watch'
        });
    }
    if (pinnedTileIds.length > 0) {
        symbols.push({
            id: 'pinned-symbols',
            label: `${pinnedTileIds.length} pinned tile${pinnedTileIds.length === 1 ? '' : 's'}`,
            detail: 'Pins preserve player-authored memory without locking Perfect Memory.',
            tone: 'stable'
        });
    }

    const penalties: MemoryFeedbackLine[] = [];
    if (run.recallMistakesThisFloor > 0) {
        penalties.push({
            id: 'recall-mistakes',
            label: `${run.recallMistakesThisFloor} recall lapse${run.recallMistakesThisFloor === 1 ? '' : 's'}`,
            detail: 'Lapses lower focus and mark tiles as forgotten until recovered by a match.',
            tone: 'danger'
        });
    }
    const pendingMemorizeBonusMs = runNonNegativeInteger(run.pendingMemorizeBonusMs);
    if (pendingMemorizeBonusMs > 0) {
        penalties.push({
            id: 'memorize-recovery',
            label: 'Recovery memorize time banked',
            detail: `+${Math.min(pendingMemorizeBonusMs, MAX_PENDING_MEMORIZE_BONUS_MS)}ms will soften the next memorization phase.`,
            tone: 'stable'
        });
    }
    penalties.push(...buildMemoryTaxLines(run));

    const upgrades: MemoryFeedbackLine[] = [
        {
            id: 'next-clean-match',
            label: `Next clean match +${nextCleanMatchBonus}`,
            detail: `Current focus is worth +${nextCleanMatchBonus} recall score.`,
            tone: nextCleanMatchBonus > 0 ? 'reward' : 'watch'
        }
    ];

    return {
        focus,
        focusLabel,
        roomIdentity,
        atmosphericSummary: atmosphericSummaryFor(pressure, focusLabel),
        atmosphericBeat: atmosphericBeatFor({
            roomIdentity,
            pressure,
            focusLabel,
            forgottenTileCount: forgottenTileIds.length
        }),
        pressureDetail: pressureDetailFor(pressure, forgottenTileIds.length),
        nextMemoryMove: nextMemoryMoveFor({
            forgottenTileCount: forgottenTileIds.length,
            nextCleanMatchBonus
        }),
        nextCleanMatchBonus,
        forgottenTileCount: forgottenTileIds.length,
        forgottenSymbols,
        symbolMap,
        burden,
        pressure,
        path,
        symbols,
        recallPlan,
        penalties,
        upgrades
    };
};
