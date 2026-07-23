import {
    MAX_PENDING_MEMORIZE_BONUS_MS,
    RECALL_CLUE_MATCH_SCORE,
    RECALL_FOCUS_MATCH_SCORE,
    type RouteChoice,
    type RunState,
    type MutatorId,
    type RelicId,
    type Tile
} from './contracts';
import { activeEnemyHazardsForBoard } from './enemy-hazard-board-rules';
import { normalizeRecallFocus, tileHasRecallClue } from './recall-rules';
import { runMutatorIds, runRelicIds } from './relics';
import { routeChoicesForResult } from './route-choice-rules';
import { getCurrentDungeonNode } from './run-map';
import { isSingletonUtilityPairKey } from './tile-identity';

export type MemoryFeedbackTone = 'stable' | 'watch' | 'danger' | 'reward';

export interface MemoryFeedbackLine {
    id: string;
    label: string;
    detail: string;
    tone: MemoryFeedbackTone;
}

export interface MemoryRouteChoiceFeedback {
    id: string;
    label: string;
    routeType: RouteChoice['routeType'];
    memoryPrompt: string;
    readiness: 'ready' | 'risky' | 'unsafe';
    readinessLabel: string;
    atmosphericCue: string;
    consequence: string;
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
    rememberedClueTileCount: number;
    forgottenTileCount: number;
    forgottenSymbols: string[];
    symbolMap: MemorySymbolMap;
    burden: MemoryBurdenFeedback;
    pressure: 'clear' | 'strained' | 'overloaded';
    path: MemoryFeedbackLine[];
    clues: MemoryFeedbackLine[];
    enemies: MemoryFeedbackLine[];
    symbols: MemoryFeedbackLine[];
    recallPlan: MemoryFeedbackLine[];
    penalties: MemoryFeedbackLine[];
    upgrades: MemoryFeedbackLine[];
    choices: MemoryRouteChoiceFeedback[];
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

const nonNegativeMemoryFeedbackCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const runTileIds = (value: unknown): string[] => Array.isArray(value) ? value : [];

const hasRunMutator = (run: RunState, mutatorId: MutatorId): boolean =>
    runMutatorIds(run.activeMutators).includes(mutatorId);

const hasRunRelic = (run: RunState, relicId: RelicId): boolean =>
    runRelicIds(run.relicIds).includes(relicId);

const isMemorySolvablePair = (pairKey: string, tiles: readonly Tile[]): boolean =>
    tiles.length === 2 && !isSingletonUtilityPairKey(pairKey);

const tileMemoryLabel = (tile: Tile): string => tile.label || tile.symbol || tile.id;

const tileIsCleared = (tile: Tile): boolean => tile.state === 'matched' || tile.state === 'removed';

const tileIsKnownToMemory = (tile: Tile, pinnedTileIds: ReadonlySet<string>): boolean =>
    tile.state === 'flipped' || tile.state === 'matched' || tileHasRecallClue(tile) || pinnedTileIds.has(tile.id);

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
    forgottenTileCount: number,
    activeThreatCount: number
): string => {
    if (pressure === 'overloaded') {
        return `Recall is overloaded: ${forgottenTileCount} forgotten tile marker${forgottenTileCount === 1 ? '' : 's'} and ${activeThreatCount} active threat read${activeThreatCount === 1 ? '' : 's'} are competing for attention.`;
    }
    if (pressure === 'strained') {
        if (forgottenTileCount <= 0 && activeThreatCount > 0) {
            return `Recall is strained: hold ${activeThreatCount} active threat read${activeThreatCount === 1 ? '' : 's'} in memory before route or patrol pressure stacks higher.`;
        }
        return `Recall is strained: recover forgotten markers before route or patrol pressure stacks higher.`;
    }
    return 'Recall is clear: the room log has room for route, clue, and symbol reads.';
};

const atmosphericSummaryFor = (
    pressure: MemoryRecallFeedback['pressure'],
    focusLabel: MemoryRecallFeedback['focusLabel'],
    rememberedClueTileCount: number
): string => {
    if (pressure === 'overloaded') {
        return 'The room log is crowded; old symbols scrape over the newest route marks.';
    }
    if (pressure === 'strained') {
        return 'The archive holds, but the next clean match needs a deliberate read.';
    }
    if (focusLabel === 'locked') {
        return rememberedClueTileCount > 0
            ? 'The route is legible and remembered clues are ready to pay out.'
            : 'The route is legible; clean recall is carrying the room.';
    }
    return 'The room is quiet enough to rebuild focus before the next branch.';
};

const roomIdentityFor = (run: RunState): string => {
    const activeRoute = getCurrentDungeonNode(run.dungeonRun);
    if (activeRoute) {
        return activeRoute.label;
    }
    if (run.board?.routeWorldProfile) {
        return `${run.board.routeWorldProfile.routeType} route chamber`;
    }
    return 'Unindexed room';
};

const atmosphericBeatFor = ({
    roomIdentity,
    pressure,
    focusLabel,
    rememberedClueTileCount,
    forgottenTileCount,
    activeThreatCount
}: {
    roomIdentity: string;
    pressure: MemoryRecallFeedback['pressure'];
    focusLabel: MemoryRecallFeedback['focusLabel'];
    rememberedClueTileCount: number;
    forgottenTileCount: number;
    activeThreatCount: number;
}): string => {
    if (pressure === 'overloaded') {
        return `${roomIdentity}: the archive margins are full; ${forgottenTileCount} forgotten marker${forgottenTileCount === 1 ? '' : 's'} and ${activeThreatCount} threat read${activeThreatCount === 1 ? '' : 's'} are blurring together.`;
    }
    if (pressure === 'strained') {
        return `${roomIdentity}: the room still answers, but the next match needs one clean remembered symbol.`;
    }
    if (focusLabel === 'locked') {
        return rememberedClueTileCount > 0
            ? `${roomIdentity}: focus is locked and the learned clue is ready to pay.`
            : `${roomIdentity}: focus is locked; the route marks are holding steady.`;
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
    partialPairCount,
    activeThreatCount,
    routeChoiceCount
}: {
    label: MemoryBurdenFeedback['label'];
    forgottenTileCount: number;
    partialPairCount: number;
    activeThreatCount: number;
    routeChoiceCount: number;
}): string => {
    const burdens = [
        forgottenTileCount > 0 ? `${forgottenTileCount} forgotten mark${forgottenTileCount === 1 ? '' : 's'}` : null,
        partialPairCount > 0 ? `${partialPairCount} partial symbol read${partialPairCount === 1 ? '' : 's'}` : null,
        activeThreatCount > 0 ? `${activeThreatCount} threat memory target${activeThreatCount === 1 ? '' : 's'}` : null,
        routeChoiceCount > 0 ? `${routeChoiceCount} route decision${routeChoiceCount === 1 ? '' : 's'}` : null
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
    activeThreatCount,
    routeChoices,
    recallMistakes
}: {
    forgottenTileCount: number;
    partialPairCount: number;
    activeThreatCount: number;
    routeChoices: readonly RouteChoice[];
    recallMistakes: number;
}): MemoryBurdenFeedback => {
    const routeChoiceCount = routeChoices.length;
    const greedyOrMysteryChoiceCount = routeChoices.filter((choice) => choice.routeType !== 'safe').length;
    const score =
        forgottenTileCount * 2 +
        partialPairCount +
        activeThreatCount * 2 +
        greedyOrMysteryChoiceCount +
        Math.min(2, recallMistakes);
    const label = burdenLabelFor(score);

    return {
        score,
        label,
        detail: burdenDetailFor({
            label,
            forgottenTileCount,
            partialPairCount,
            activeThreatCount,
            routeChoiceCount
        }),
        tone: burdenToneFor(label)
    };
};

const choiceTone = (choice: RouteChoice): MemoryFeedbackTone => {
    if (choice.routeType === 'safe') return 'stable';
    if (choice.routeType === 'greed') return 'danger';
    return 'watch';
};

const choicePrompt = (choice: RouteChoice): string => {
    if (choice.routeType === 'safe') {
        return 'Use this when the last room left forgotten tiles or broken focus.';
    }
    if (choice.routeType === 'greed') {
        return 'Take only if you can remember enemy, trap, and symbol positions under pressure.';
    }
    return 'Mark the clue source before committing; mystery rewards memory of partial information.';
};

const choiceAtmosphericCue = (choice: RouteChoice): string => {
    if (choice.routeType === 'safe') {
        return 'A steadier corridor keeps its marks close to the wall.';
    }
    if (choice.routeType === 'greed') {
        return 'The louder stair promises value, but every card remembers the noise.';
    }
    return 'The unindexed door offers a clue first and an answer later.';
};

const choiceConsequence = (choice: RouteChoice): string =>
    [choice.rewardPreview, choice.riskPreview].filter(Boolean).join(' ') || choice.detail;

const choiceReadiness = ({
    choice,
    pressure,
    focusLabel,
    forgottenTileCount,
    activeThreatCount,
    rememberedClueTileCount
}: {
    choice: RouteChoice;
    pressure: MemoryRecallFeedback['pressure'];
    focusLabel: MemoryRecallFeedback['focusLabel'];
    forgottenTileCount: number;
    activeThreatCount: number;
    rememberedClueTileCount: number;
}): Pick<MemoryRouteChoiceFeedback, 'readiness' | 'readinessLabel'> => {
    if (choice.routeType === 'safe') {
        if (pressure === 'overloaded') {
            return {
                readiness: 'risky',
                readinessLabel: 'Safe route recommended, but recall is overloaded.'
            };
        }
        return {
            readiness: 'ready',
            readinessLabel: 'Safe route fits the current recall state.'
        };
    }

    if (choice.routeType === 'greed') {
        if (pressure === 'overloaded' || forgottenTileCount > 0) {
            return {
                readiness: 'unsafe',
                readinessLabel: 'Greed is unsafe until forgotten markers are repaired.'
            };
        }
        if (focusLabel !== 'locked' || activeThreatCount > 0) {
            return {
                readiness: 'risky',
                readinessLabel: 'Greed asks for locked focus and clean patrol memory.'
            };
        }
        return {
            readiness: 'ready',
            readinessLabel: 'Greed is supportable while focus is locked.'
        };
    }

    if (rememberedClueTileCount === 0) {
        return {
            readiness: pressure === 'overloaded' ? 'unsafe' : 'risky',
            readinessLabel: 'Mystery is thin until one clue source is remembered.'
        };
    }
    if (pressure === 'overloaded') {
        return {
            readiness: 'risky',
            readinessLabel: 'Mystery has a clue, but recall pressure is overloaded.'
        };
    }
    return {
        readiness: 'ready',
        readinessLabel: 'Mystery has a remembered clue to anchor the unknown.'
    };
};

const nextMemoryMoveFor = ({
    focusLabel,
    forgottenTileCount,
    activeThreatCount,
    rememberedClueTileCount,
    hasGreedChoice,
    hasMysteryChoice,
    nextCleanMatchBonus
}: {
    focusLabel: MemoryRecallFeedback['focusLabel'];
    forgottenTileCount: number;
    activeThreatCount: number;
    rememberedClueTileCount: number;
    hasGreedChoice: boolean;
    hasMysteryChoice: boolean;
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
    if (activeThreatCount > 0) {
        return {
            id: 'next-memory-move-threat',
            label: 'Read patrol positions',
            detail: `Hold the current and next threat tile in memory before flipping adjacent cards.`,
            tone: 'watch'
        };
    }
    if (hasGreedChoice && focusLabel !== 'locked') {
        return {
            id: 'next-memory-move-greed',
            label: 'Delay greed route',
            detail: 'Build locked focus before taking a route that taxes enemy, trap, and symbol memory.',
            tone: 'watch'
        };
    }
    if (hasMysteryChoice && rememberedClueTileCount === 0) {
        return {
            id: 'next-memory-move-mystery',
            label: 'Mark one clue source',
            detail: 'Mystery routes pay cleaner when at least one scout, reveal, or route clue is remembered.',
            tone: 'watch'
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

const MEMORY_ASSIST_RELIC_COPY: Partial<Record<RelicId, (run: RunState) => MemoryFeedbackLine>> = {
    memorize_under_short_memorize: (run) => ({
        id: 'memory-assist-short-memorize-answer',
        label: 'Short-study answer',
        detail: hasRunMutator(run, 'short_memorize')
            ? 'This relic directly answers the active short-study tax.'
            : 'Banked for the next short-study floor so fast encoding stays fair.',
        tone: hasRunMutator(run, 'short_memorize') ? 'reward' : 'stable'
    }),
    peek_charge_plus_one: (run) => ({
        id: 'memory-assist-peek-charge',
        label: `${run.peekCharges} peek read${run.peekCharges === 1 ? '' : 's'} ready`,
        detail: 'Peeks can confirm one uncertain symbol or dungeon card without spending a committed flip.',
        tone: run.peekCharges > 0 ? 'reward' : 'stable'
    }),
    pin_cap_plus_one: (run) => ({
        id: 'memory-assist-pin-cap',
        label: `Pin capacity ${runTileIds(run.pinnedTileIds).length}/${run.activeContract?.maxPinsTotalRun ?? 'expanded'}`,
        detail: 'Expanded pin space lets the player author a safer path through noisy symbol bands.',
        tone: 'stable'
    }),
    chapter_compass: () => ({
        id: 'memory-assist-chapter-compass',
        label: 'Chapter compass',
        detail: 'Future drafts can answer upcoming memory taxes instead of only reacting after a lapse.',
        tone: 'reward'
    })
};

const buildMemoryTaxLines = (run: RunState): MemoryFeedbackLine[] =>
    unique(runMutatorIds(run.activeMutators))
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

const buildMemoryAssistLines = (run: RunState): MemoryFeedbackLine[] =>
    unique(runRelicIds(run.relicIds))
        .flatMap((relicId) => {
            const makeLine = MEMORY_ASSIST_RELIC_COPY[relicId];
            return makeLine ? [makeLine(run)] : [];
        })
        .slice(0, 4);

export const getMemoryRecallFeedback = (run: RunState): MemoryRecallFeedback => {
    const board = run.board;
    const tiles = board?.tiles ?? [];
    const rememberedClueTiles = tiles.filter(tileHasRecallClue);
    const forgottenTileIds = runTileIds(run.forgottenTileIdsThisFloor);
    const pinnedTileIds = runTileIds(run.pinnedTileIds);
    const forgottenSet = new Set(forgottenTileIds);
    const forgottenSymbols = unique(
        tiles
            .filter((tile) => forgottenSet.has(tile.id))
            .map(tileMemoryLabel)
    ).slice(0, 6);
    const activeEnemyHazards = activeEnemyHazardsForBoard(board);
    const revealedEnemyTiles = tiles.filter(
        (tile) => tile.dungeonCardKind === 'enemy' && tile.dungeonCardState === 'revealed'
    );
    const activeRoute = getCurrentDungeonNode(run.dungeonRun);
    const focus = normalizeRecallFocus(run.recallFocus);
    const nextCleanMatchBonus = focus * RECALL_FOCUS_MATCH_SCORE;
    const clueBonus = rememberedClueTiles.length > 0 ? RECALL_CLUE_MATCH_SCORE : 0;
    const symbolMap = buildSymbolMap(tiles, pinnedTileIds, forgottenTileIds);
    const recallPlan = buildRecallPlan(tiles, pinnedTileIds, forgottenTileIds);
    const overloadScore =
        run.recallMistakesThisFloor +
        Math.ceil(forgottenTileIds.length / 2) +
        activeEnemyHazards.length +
        revealedEnemyTiles.length;

    const pressure: MemoryRecallFeedback['pressure'] =
        overloadScore >= 4 ? 'overloaded' : overloadScore >= 2 ? 'strained' : 'clear';
    const focusLabel = focusLabelFor(focus);
    const activeThreatCount = activeEnemyHazards.length + revealedEnemyTiles.length;
    const roomIdentity = roomIdentityFor(run);
    const routeChoices = routeChoicesForResult(run.lastLevelResult);
    const totalNextCleanMatchBonus = nextCleanMatchBonus + clueBonus;
    const burden = buildMemoryBurden({
        forgottenTileCount: forgottenTileIds.length,
        partialPairCount: symbolMap.partialPairCount,
        activeThreatCount,
        routeChoices,
        recallMistakes: run.recallMistakesThisFloor
    });

    const path: MemoryFeedbackLine[] = [];
    if (board?.routeWorldProfile) {
        path.push({
            id: 'route-world-profile',
            label: `${board.routeWorldProfile.routeType} route memory`,
            detail: board.routeWorldProfile.summary,
            tone: board.routeWorldProfile.routeType === 'greed' ? 'danger' : 'watch'
        });
    }
    if (activeRoute) {
        path.push({
            id: 'current-dungeon-node',
            label: activeRoute.label,
            detail: activeRoute.detail,
            tone: activeRoute.routeType === 'greed' || activeRoute.kind === 'elite' ? 'danger' : 'stable'
        });
    }
    path.push({
        id: 'room-atmosphere',
        label:
            pressure === 'overloaded'
                ? 'Room log overloaded'
                : pressure === 'strained'
                  ? 'Room log strained'
                  : 'Room log clear',
        detail: atmosphericSummaryFor(pressure, focusLabel, rememberedClueTiles.length),
        tone: pressureToneFor(pressure)
    });

    const clues: MemoryFeedbackLine[] = [];
    if (rememberedClueTiles.length > 0) {
        clues.push({
            id: 'remembered-clues',
            label: `${rememberedClueTiles.length} learned clue${rememberedClueTiles.length === 1 ? '' : 's'}`,
            detail: `Matching one pays +${RECALL_CLUE_MATCH_SCORE} recall score on top of focus.`,
            tone: 'reward'
        });
    }
    const lanternWardScouts = nonNegativeMemoryFeedbackCount(run.lanternWardScoutsThisFloor);
    const omenSealScouts = nonNegativeMemoryFeedbackCount(run.omenSealScoutsThisFloor);
    if (lanternWardScouts > 0 || omenSealScouts > 0) {
        clues.push({
            id: 'scout-sources',
            label: 'Scout trail active',
            detail: `${lanternWardScouts} Lantern Ward and ${omenSealScouts} Omen Seal clue reads this floor.`,
            tone: 'stable'
        });
    }

    const enemies: MemoryFeedbackLine[] = [];
    if (activeEnemyHazards.length > 0) {
        enemies.push({
            id: 'enemy-hazard-memory',
            label: `${activeEnemyHazards.length} patrol memory target${activeEnemyHazards.length === 1 ? '' : 's'}`,
            detail: 'Remember current and next enemy tiles before flipping near them.',
            tone: 'danger'
        });
    }
    if (revealedEnemyTiles.length > 0) {
        enemies.push({
            id: 'revealed-enemy-cards',
            label: `${revealedEnemyTiles.length} revealed enemy card${revealedEnemyTiles.length === 1 ? '' : 's'}`,
            detail: 'Pair enemy symbols deliberately to convert threat memory into progress.',
            tone: 'watch'
        });
    }

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
    const pendingMemorizeBonusMs = nonNegativeMemoryFeedbackCount(run.pendingMemorizeBonusMs);
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
            label: `Next clean match +${totalNextCleanMatchBonus}`,
            detail:
                clueBonus > 0
                    ? `Focus is worth +${nextCleanMatchBonus}; remembered clues can add +${clueBonus}.`
                    : `Current focus is worth +${nextCleanMatchBonus} recall score.`,
            tone: totalNextCleanMatchBonus > 0 ? 'reward' : 'watch'
        }
    ];
    if (hasRunRelic(run, 'memorize_bonus_ms')) {
        upgrades.push({
            id: 'memorize-relic',
            label: 'Memorize upgrade owned',
            detail: 'Extra memorization time makes route and symbol recall more reliable.',
            tone: 'stable'
        });
    }
    upgrades.push(...buildMemoryAssistLines(run).filter((line) => !upgrades.some((upgrade) => upgrade.id === line.id)));

    return {
        focus,
        focusLabel,
        roomIdentity,
        atmosphericSummary: atmosphericSummaryFor(pressure, focusLabel, rememberedClueTiles.length),
        atmosphericBeat: atmosphericBeatFor({
            roomIdentity,
            pressure,
            focusLabel,
            rememberedClueTileCount: rememberedClueTiles.length,
            forgottenTileCount: forgottenTileIds.length,
            activeThreatCount
        }),
        pressureDetail: pressureDetailFor(pressure, forgottenTileIds.length, activeThreatCount),
        nextMemoryMove: nextMemoryMoveFor({
            focusLabel,
            forgottenTileCount: forgottenTileIds.length,
            activeThreatCount,
            rememberedClueTileCount: rememberedClueTiles.length,
            hasGreedChoice: routeChoices.some((choice) => choice.routeType === 'greed'),
            hasMysteryChoice: routeChoices.some((choice) => choice.routeType === 'mystery'),
            nextCleanMatchBonus: totalNextCleanMatchBonus
        }),
        nextCleanMatchBonus: totalNextCleanMatchBonus,
        rememberedClueTileCount: rememberedClueTiles.length,
        forgottenTileCount: forgottenTileIds.length,
        forgottenSymbols,
        symbolMap,
        burden,
        pressure,
        path,
        clues,
        enemies,
        symbols,
        recallPlan,
        penalties,
        upgrades,
        choices: routeChoices.map((choice) => ({
            id: choice.id,
            label: choice.label,
            routeType: choice.routeType,
            memoryPrompt: choicePrompt(choice),
            ...choiceReadiness({
                choice,
                pressure,
                focusLabel,
                forgottenTileCount: forgottenTileIds.length,
                activeThreatCount,
                rememberedClueTileCount: rememberedClueTiles.length
            }),
            atmosphericCue: choiceAtmosphericCue(choice),
            consequence: choiceConsequence(choice),
            tone: choiceTone(choice)
        }))
    };
};
