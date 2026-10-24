import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';

/**
 * A run's own Gate (rules 90, 2026-10-24): no two runs open the same way.
 *
 * Before rules 90 every run's floors 1 to 12 were the same rooms in the same order (300 seeds,
 * `pickFloorScheduleEntry`): only the boss floors' distraction channel varied. The owner's word
 * (2026-10-24): it does not change the more you play. From rules 90 two things are the run's own,
 * drawn from its seed:
 *
 * - The order. Each cycle of twelve keeps its first three floors (the opening the onboarding teaches),
 *   its boss slot (7) and its rotating slot (9), and deals its other rooms in the run's order, each
 *   among rooms of its own kind: the five plain rooms among floors 4, 5, 8, 11 and 12, the two breathers
 *   between 6 and 10. A run meets the restless floor on floor 4 or on 12; the next cycle draws again.
 * - The omen. One deep family walks the run's Gate early, lightly: a Wanderer pair, or a mask, on every
 *   Gate floor from 6 that can hold one. The Living Dungeon's Wanderers and the Deep's masks still come where
 *   they always did; the omen is a preview, named on the board crown the floor it first shows.
 */
export const RUN_SIGNATURE_FROM = 90;

export type GateOmen = 'wanderer' | 'mask';
export const GATE_OMENS: readonly GateOmen[] = ['wanderer', 'mask'];
/** The first floor the omen shows: after the Hold (5), on the Gate's first breather. */
export const GATE_OMEN_FROM_FLOOR = 6;
/** The last: the Gate's, before its families come for real. */
export const GATE_OMEN_TO_FLOOR = 12;
/** How many of the omen's family a floor before its own act deals. */
export const GATE_OMEN_COUNT = 1;

const onSignature = (rulesVersion: number): boolean => rulesVersion >= RUN_SIGNATURE_FROM;

/** The run's omen. */
export const gateOmen = (runSeed: number, rulesVersion: number): GateOmen | null =>
    onSignature(rulesVersion) ? GATE_OMENS[pickRngIndex(createMulberry32(hashStringToSeed(`gateOmen:${runSeed}`)), GATE_OMENS.length)]! : null;

/** The cycle positions (1-based) that keep their rooms, and the groups whose rooms trade places. */
const SHUFFLED_GROUPS: readonly (readonly number[])[] = [
    [4, 5, 8, 11, 12],
    [6, 10]
];

/** A run's room for a cycle position (1-based) in cycle `cycleIndex`: the position itself before rules 90. */
export const signatureCyclePosition = (runSeed: number, rulesVersion: number, cycleIndex: number, position: number): number => {
    if (!onSignature(rulesVersion)) return position;
    const group = SHUFFLED_GROUPS.find((candidate) => candidate.includes(position));
    if (!group) return position;
    const rng = createMulberry32(hashStringToSeed(`gateOrder:${runSeed}:${cycleIndex}:${group.join(',')}`));
    const order = [...group];
    for (let i = order.length - 1; i > 0; i -= 1) {
        const j = pickRngIndex(rng, i + 1);
        [order[i], order[j]] = [order[j]!, order[i]!];
    }
    return order[group.indexOf(position)]!;
};

/**
 * What the omen adds to a floor's deal of its family: one, on Gate floors 6 to 12, on a floor whose own schedule
 * deals none (where the family is due anyway, the omen is spent). The Dread never buys on it.
 */
export const gateOmenCount = (
    family: GateOmen,
    board: { level: number; pairCount: number },
    { runSeed, rulesVersion, scheduled, minPairs }: { runSeed: number; rulesVersion: number; scheduled: number; minPairs: number }
): number =>
    scheduled === 0 && board.level >= GATE_OMEN_FROM_FLOOR && board.level <= GATE_OMEN_TO_FLOOR && board.pairCount >= minPairs && gateOmen(runSeed, rulesVersion) === family ? GATE_OMEN_COUNT : 0;

/** The floor the omen is told on: the first it can show. */
export const gateOmenToldOn = (run: { runSeed: number; runRulesVersion?: number; board?: { level: number } | null; endless?: boolean }): GateOmen | null => {
    const omen = gateOmen(run.runSeed, run.runRulesVersion ?? 0);
    return omen && run.endless !== true && run.board?.level === GATE_OMEN_FROM_FLOOR ? omen : null;
};
