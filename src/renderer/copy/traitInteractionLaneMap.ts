import { runFilteredArray } from '../../shared/run-array-guards';

export type TraitInteractionLaneId = 'shard' | 'guard' | 'tool' | 'risk' | 'block' | 'recall' | 'score';

export interface TraitInteractionLaneMapEntry {
    id: TraitInteractionLaneId;
    label: 'Shard' | 'Guard' | 'Tool' | 'Risk' | 'Block' | 'Recall' | 'Score';
    count: number;
    cue: string;
}

const TRAIT_INTERACTION_LANE_ORDER: readonly TraitInteractionLaneId[] = [
    'shard',
    'guard',
    'tool',
    'risk',
    'block',
    'recall',
    'score'
];

export const TRAIT_INTERACTION_LANE_LABELS: Record<TraitInteractionLaneId, TraitInteractionLaneMapEntry['label']> = {
    block: 'Block',
    guard: 'Guard',
    recall: 'Recall',
    risk: 'Risk',
    score: 'Score',
    shard: 'Shard',
    tool: 'Tool'
};

const TRAIT_INTERACTION_LANE_ACTIONS: Record<TraitInteractionLaneId, string> = {
    block: 'Deny match',
    guard: 'Protect run',
    recall: 'Set memory',
    risk: 'Watch hazard',
    score: 'Cash score',
    shard: 'Cash shard',
    tool: 'Use tool'
};

export const getTraitInteractionLaneAction = (lane: TraitInteractionLaneId): string =>
    TRAIT_INTERACTION_LANE_ACTIONS[lane];

const trimTerminalPunctuation = (value: string): string => value.trim().replace(/[.!?]+$/u, '');

export const getTraitInteractionLaneId = (line: string): TraitInteractionLaneId => {
    const text = line.toLowerCase();

    if (/\b(shard|spark|combo shard|shard spark|shard engine)\b/.test(text)) {
        return 'shard';
    }
    if (/\b(guard|ward|braced|shield|armor)\b/.test(text)) {
        return 'guard';
    }
    if (/\b(row|tool|shuffle|swap|peek|pin|destroy|charge)\b/.test(text)) {
        return 'tool';
    }
    if (/\b(risk|risky|danger|curse|cursed|volatile|penalty|damage|doom)\b/.test(text)) {
        return 'risk';
    }
    if (/\b(block|blocked|buffer|buffered|seal|sealed|stasis|freeze|frozen|lock)\b/.test(text)) {
        return 'block';
    }
    if (/\b(recall|echo|mirror|focus|memory)\b/.test(text)) {
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
