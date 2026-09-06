import type { RunState } from './contracts';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * Who else is on this floor.
 *
 * The dungeon had mechanics and no cast. Every hazard was a rule with a spec-sheet description —
 * "Wakes when traps spring and attacks on mismatches" — and a floor was a difficulty setting rather
 * than a place. A dungeon is quirky because it is populated, not because one clever system lives
 * in it, so this is a cast: one resident per floor, rolled from the run's own seed.
 *
 * Every one of them is built from levers the run already has — guard tokens, peek charges, shop
 * gold, the memorize window, shuffle charges. That is deliberate. A resident that needed a new
 * subsystem would be a mechanic wearing a costume; these are small, real, and immediately legible,
 * and the character is in what they do and what they say about it rather than in novelty.
 *
 * They are also all *net positive or net neutral*. The floor already has hazards, wardens, traps
 * and a thieving bird to make it hard. What it did not have was anything that made a floor feel
 * like somewhere in particular, and a cast that only ever punishes is just more difficulty with
 * names on.
 */
export type FloorCurioId =
    | 'lost_sock'
    | 'nervous_torchbearer'
    | 'hoarding_rat'
    | 'gossiping_skull'
    | 'off_duty_guard'
    | 'sticky_toffee';

export interface FloorCurioEffect {
    /** Added to the memorize window for this floor. Negative shortens it. */
    readonly memorizeBonusMs: number;
    readonly guardTokens: number;
    readonly peekCharges: number;
    readonly shuffleCharges: number;
    readonly shopGold: number;
}

export interface FloorCurio {
    readonly id: FloorCurioId;
    /** What the floor calls them. */
    readonly name: string;
    /** One line, in their own register, said when the floor opens. */
    readonly line: string;
    /** What they actually do, in the terms the player will feel. */
    readonly effectSummary: string;
    readonly effect: FloorCurioEffect;
}

const NOTHING: FloorCurioEffect = {
    guardTokens: 0,
    memorizeBonusMs: 0,
    peekCharges: 0,
    shopGold: 0,
    shuffleCharges: 0
};

export const FLOOR_CURIOS: readonly FloorCurio[] = [
    {
        id: 'lost_sock',
        name: 'A lost sock',
        line: 'There is a sock down here. Just the one. It has been here longer than you have.',
        effectSummary: 'Does nothing whatsoever.',
        // Deliberately no effect at all. A cast where everyone changes a number is a stat screen
        // with names on; one resident who is simply present is what makes the others feel like
        // residents rather than modifiers.
        effect: NOTHING
    },
    {
        id: 'nervous_torchbearer',
        name: 'A nervous torchbearer',
        line: 'He will hold the light for you. He would rather not be here, and he is not hiding it.',
        effectSummary: 'A longer look at the board, and a peek you did not pay for.',
        effect: { ...NOTHING, memorizeBonusMs: 900, peekCharges: 1 }
    },
    {
        id: 'hoarding_rat',
        name: 'A hoarding rat',
        line: 'It has been collecting. It does not want the coins, exactly. It wants to have them.',
        effectSummary: 'Coins it has no use for, left where you will find them.',
        effect: { ...NOTHING, shopGold: 3 }
    },
    {
        id: 'gossiping_skull',
        name: 'A gossiping skull',
        line: 'It knew the last three people through here. It would like to tell you about all of them.',
        effectSummary: 'Talks through the memorize window. You will look away. You will regret it.',
        // The one resident that costs you something, and it costs attention rather than a life.
        effect: { ...NOTHING, memorizeBonusMs: -600, shopGold: 2 }
    },
    {
        id: 'off_duty_guard',
        name: 'An off-duty guard',
        line: 'Not paid enough to fight anything. Will absolutely lend you a token and look the other way.',
        effectSummary: 'One guard token, no questions.',
        effect: { ...NOTHING, guardTokens: 1 }
    },
    {
        id: 'sticky_toffee',
        name: 'Someone spilled toffee',
        line: 'It is on the floor. It is on the tiles. It is, now, on you.',
        effectSummary: 'The tiles stick. One extra shuffle, because you will want it.',
        effect: { ...NOTHING, shuffleCharges: 1 }
    }
];

export const getFloorCurio = (id: FloorCurioId): FloorCurio | undefined =>
    FLOOR_CURIOS.find((curio) => curio.id === id);

/**
 * Who is on this floor, decided from the run's seed so a replay meets the same resident.
 *
 * Keyed on the floor as well as the run, so a long descent is populated rather than haunted by one
 * recurring character.
 */
export const pickFloorCurio = (runSeed: number, level: number, rulesVersion: number): FloorCurio => {
    const rng = createMulberry32(hashStringToSeed(`curio:${runSeed}:${rulesVersion}:${level}`));
    return FLOOR_CURIOS[pickRngIndex(rng, FLOOR_CURIOS.length)] ?? FLOOR_CURIOS[0]!;
};

/**
 * No resident may shorten the memorize window past this. The skull is meant to be annoying, not
 * to make a floor unlearnable, and the clamp has to hold on the short windows of deep floors
 * where 600ms is a much larger fraction of the look than it is on floor two.
 */
export const MIN_CURIO_MEMORIZE_MS = 1_500;

/**
 * Applies a resident's effect to the run.
 *
 * The memorize change lands on **this floor's own timer**, not on `pendingMemorizeBonusMs`. That
 * field is consumed by the *next* floor transition, so spending it here would hand the
 * torchbearer's longer look to the floor after his — the player would get the effect on a floor
 * where somebody else is standing, and the two would never line up again.
 *
 * Clamped on the way out: a shortened window is a real cost, but no resident is allowed to leave
 * the player with a negative anything or with a window too short to read.
 */
/**
 * Puts a resident on the floor without their welcome.
 *
 * Floor one uses this. Every other floor is announced on the floor-clear screen before the stairs
 * are taken, and the arrival gift is the payoff of that announcement — you were told a hoarding rat
 * was down there and you find its coins. Nobody announces floor one, so an arrival gift there is
 * unexplained variance in the opening budget: two runs of the same mode would start with different
 * peeks and different memorize windows for no reason the player could ever see. They are still
 * there, still have a line, and still answer a greeting — which is the only channel that says who
 * they are out loud.
 */
export const seatFloorCurio = (run: RunState, curio: FloorCurio): RunState => ({
    ...run,
    floorCurioId: curio.id,
    floorCurioGreeted: false
});

export const applyFloorCurio = (run: RunState, curio: FloorCurio): RunState => ({
    ...run,
    timerState: {
        ...run.timerState,
        memorizeRemainingMs:
            run.timerState.memorizeRemainingMs === null || curio.effect.memorizeBonusMs === 0
                ? run.timerState.memorizeRemainingMs
                : Math.max(
                      MIN_CURIO_MEMORIZE_MS,
                      run.timerState.memorizeRemainingMs + curio.effect.memorizeBonusMs
                  )
    },
    peekCharges: Math.max(0, runNonNegativeInteger(run.peekCharges) + curio.effect.peekCharges),
    shuffleCharges: Math.max(0, runNonNegativeInteger(run.shuffleCharges) + curio.effect.shuffleCharges),
    shopGold: Math.max(0, runNonNegativeInteger(run.shopGold) + curio.effect.shopGold),
    stats: {
        ...run.stats,
        guardTokens: Math.max(0, runNonNegativeInteger(run.stats.guardTokens) + curio.effect.guardTokens)
    },
    floorCurioId: curio.id
});
