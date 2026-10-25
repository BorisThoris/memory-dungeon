import type { GateOmen } from './contracts';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';

export type { GateOmen };

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

/** The first omens, before any run is finished. */
export const GATE_OMENS: readonly GateOmen[] = ['wanderer', 'mask'];
/** The first floor the omen shows: after the Hold (5), on the Gate's first breather. */
export const GATE_OMEN_FROM_FLOOR = 6;
/** The last: the Gate's, before its families come for real. */
export const GATE_OMEN_TO_FLOOR = 12;
/** How many of the omen's family a floor before its own act deals. */
export const GATE_OMEN_COUNT = 1;

const onSignature = (rulesVersion: number): boolean => rulesVersion >= RUN_SIGNATURE_FROM;

/**
 * The dungeon remembers (rules 92, 2026-10-25): the more runs a profile finishes, the more the Gate can
 * hold. The owner's word was that the game does not change the more you play; until rules 92 run 100 dealt
 * from the same pool as run 1. A family joins the omens after the runs it names, and from
 * `TWO_OMENS_AFTER_RUNS` a run walks with two. Each is a kind of floor, never a number: the miss bank,
 * the scores and the bars are the same for the hundredth run as for the first (DGE-024's rule).
 */
export const OMEN_DISCOVERY_FROM = 92;
export const OMEN_DISCOVERIES: readonly { omen: GateOmen; afterRuns: number }[] = [
    { omen: 'wanderer', afterRuns: 0 },
    { omen: 'mask', afterRuns: 0 },
    { omen: 'sleeper', afterRuns: 3 }
];
export const TWO_OMENS_AFTER_RUNS = 8;

/** The omens a profile that has finished this many runs has discovered. */
export const omenPoolFor = (runsFinished: number): GateOmen[] =>
    OMEN_DISCOVERIES.filter((discovery) => Math.max(0, Math.floor(runsFinished)) >= discovery.afterRuns).map((discovery) => discovery.omen);

/** How many omens a run walks with. */
export const omenDrawsFor = (runsFinished: number): number => (Math.max(0, Math.floor(runsFinished)) >= TWO_OMENS_AFTER_RUNS ? 2 : 1);

/** A run's omens, drawn from its seed; before rules 92 one from the first two (rules 90's draw, unchanged). */
export const gateOmensFor = (runSeed: number, rulesVersion: number, runsFinished: number): GateOmen[] => {
    if (!onSignature(rulesVersion)) return [];
    const rng = createMulberry32(hashStringToSeed(`gateOmen:${runSeed}`));
    const pool = rulesVersion >= OMEN_DISCOVERY_FROM ? omenPoolFor(runsFinished) : [...GATE_OMENS];
    const draws = rulesVersion >= OMEN_DISCOVERY_FROM ? omenDrawsFor(runsFinished) : 1;
    const drawn: GateOmen[] = [];
    while (drawn.length < draws && pool.length > 0) drawn.push(pool.splice(pickRngIndex(rng, pool.length), 1)[0]!);
    return drawn;
};

/** The omens this run walks with: drawn when it was made, or from its seed for a run before rules 92. */
export const runGateOmens = (run: { runSeed: number; runRulesVersion?: number; gateOmens?: readonly GateOmen[] }): readonly GateOmen[] =>
    run.gateOmens ?? gateOmensFor(run.runSeed, run.runRulesVersion ?? 0, 0);

/** The run's first omen (rules 90's one). */
export const gateOmen = (runSeed: number, rulesVersion: number): GateOmen | null => gateOmensFor(runSeed, rulesVersion, 0)[0] ?? null;

/** The family a profile discovers by finishing its `runsFinished`th run, if one joins then; and whether a second omen does. */
export const discoveryAt = (runsFinished: number): { omen: GateOmen | null; secondOmen: boolean } => ({
    omen: OMEN_DISCOVERIES.find((discovery) => discovery.afterRuns > 0 && discovery.afterRuns === runsFinished)?.omen ?? null,
    secondOmen: runsFinished === TWO_OMENS_AFTER_RUNS
});

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
    { omens, scheduled, minPairs }: { omens: readonly GateOmen[]; scheduled: number; minPairs: number }
): number =>
    scheduled === 0 && board.level >= GATE_OMEN_FROM_FLOOR && board.level <= GATE_OMEN_TO_FLOOR && board.pairCount >= minPairs && omens.includes(family) ? GATE_OMEN_COUNT : 0;

/** The omens told on the floor they first show, floor 6; none in Endless. */
export const gateOmensToldOn = (run: { runSeed: number; runRulesVersion?: number; gateOmens?: readonly GateOmen[]; board?: { level: number } | null; endless?: boolean }): readonly GateOmen[] =>
    run.endless !== true && run.board?.level === GATE_OMEN_FROM_FLOOR ? runGateOmens(run) : [];
