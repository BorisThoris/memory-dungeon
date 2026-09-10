import { runFilteredArray } from '../../shared/run-array-guards';

/*
 * Gen 201 cut two lanes and re-pointed a third.
 *
 * Four trait interactions exist (`TILE_TRAIT_INTERACTION_TAGS`): the conduit's adjacent charge, its
 * Echo peek spark, its Stasis lock pulse, and Stasis blocking a neighbour. Against those four:
 *
 *   - `shard` was reachable, and wrongly. "Conduit + Echo: peek spark" matched on the word "spark",
 *     so a payoff that hands the player a PEEK CHARGE was labelled "Shard - Cash shard" on the
 *     board. Combo shards left in Gen 184 with the life economy they fed. That line is a tool.
 *   - `guard` matched guard/ward/braced/shield/armor, and no live interaction says any of those.
 *     Guard tokens went with the hazards.
 *   - `risk` matched risk/danger/penalty/damage/doom, none of which any of the four says either.
 *     No trait carries a mismatch penalty except Heavy, which has no interaction line at all.
 *
 * What is left is the four lanes the four tags can actually produce.
 */
export type TraitInteractionLaneId = 'tool' | 'block' | 'recall' | 'score';

interface TraitInteractionLaneMapEntry {
    id: TraitInteractionLaneId;
    label: 'Tool' | 'Block' | 'Recall' | 'Score';
    count: number;
    cue: string;
}

const TRAIT_INTERACTION_LANE_ORDER: readonly TraitInteractionLaneId[] = ['tool', 'block', 'recall', 'score'];

export const TRAIT_INTERACTION_LANE_LABELS: Record<TraitInteractionLaneId, TraitInteractionLaneMapEntry['label']> = {
    block: 'Block',
    recall: 'Recall',
    score: 'Score',
    tool: 'Tool'
};

const TRAIT_INTERACTION_LANE_ACTIONS: Record<TraitInteractionLaneId, string> = {
    block: 'Deny match',
    recall: 'Set memory',
    score: 'Cash score',
    tool: 'Use tool'
};

export const getTraitInteractionLaneAction = (lane: TraitInteractionLaneId): string =>
    TRAIT_INTERACTION_LANE_ACTIONS[lane];

const trimTerminalPunctuation = (value: string): string => value.trim().replace(/[.!?]+$/u, '');

export const getTraitInteractionLaneId = (line: string): TraitInteractionLaneId => {
    const text = line.toLowerCase();

    // "peek spark" lands here now, which is what it always was: a charge handed back.
    if (/\b(row|tool|shuffle|swap|peek|pin|charge|spark)\b/.test(text)) {
        return 'tool';
    }
    if (/\b(block|blocked|buffer|buffered|stasis|freeze|frozen|lock)\b/.test(text)) {
        return 'block';
    }
    if (/\b(recall|echo|focus|memory)\b/.test(text)) {
        return 'recall';
    }

    return 'score';
};

export const buildTraitInteractionLaneMap = (
    lines: readonly string[] | undefined
): TraitInteractionLaneMapEntry[] => {
    const normalizedLines = runFilteredArray(lines, (line): line is string => typeof line === 'string' && line.trim().length > 0);
    if (normalizedLines.length === 0) {
        return [];
    }

    const lanes = new Map<TraitInteractionLaneId, { count: number; cue: string }>();
    for (const line of normalizedLines) {
        const id = getTraitInteractionLaneId(line);
        const existing = lanes.get(id);
        lanes.set(id, {
            count: (existing?.count ?? 0) + 1,
            cue: existing?.cue ?? line
        });
    }

    return TRAIT_INTERACTION_LANE_ORDER.flatMap((id) => {
        const lane = lanes.get(id);
        return lane
            ? [
                  {
                      id,
                      label: TRAIT_INTERACTION_LANE_LABELS[id],
                      count: lane.count,
                      cue: lane.cue
                  }
              ]
            : [];
    });
};

export const traitInteractionLaneMapAttr = (laneMap: readonly TraitInteractionLaneMapEntry[]): string =>
    laneMap.map((lane) => `${lane.id}:${lane.count}`).join('>');

export const traitInteractionLaneActionMapAttr = (laneMap: readonly TraitInteractionLaneMapEntry[]): string =>
    laneMap.map((lane) => `${lane.id}:${getTraitInteractionLaneAction(lane.id)}:${lane.count}`).join('>');

export const formatTraitInteractionLaneMapLabel = (
    label: string,
    laneMap: readonly TraitInteractionLaneMapEntry[]
): string => {
    const rowCopy = laneMap
        .map((lane) => `${lane.label}: ${lane.count}. ${getTraitInteractionLaneAction(lane.id)}. ${trimTerminalPunctuation(lane.cue)}`)
        .join('. ');

    return rowCopy ? `${label}. ${rowCopy}.` : label;
};
