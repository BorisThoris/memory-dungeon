import type { RunState } from './contracts';
import { getFloorCurio, type FloorCurioId } from './floor-curio-rules';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * Saying hello to whoever is on the floor.
 *
 * The cast arrived as modifiers with captions: a line on the floor-clear screen, a number quietly
 * changed, and then nothing for the rest of the floor. That is a bestiary, not a dungeon. What
 * makes an odd thing funny is that you can poke it and it reacts — the reaction is the joke, and
 * without one a resident is indistinguishable from a buff icon with a good name.
 *
 * So: one verb, once per floor, free. It cannot be the wrong move — there is no failure branch and
 * nothing is ever taken — because a greeting that might cost you something is not a greeting, it is
 * a gamble, and the player would stop pressing it and the cast would go quiet again.
 *
 * Every reply moves a different lever. Two residents handing over the same +1 would make the verb
 * feel like one button with six labels.
 */
export interface FloorCurioGreetingEffect {
    readonly peekCharges: number;
    readonly shopGold: number;
    readonly guardTokens: number;
    readonly strayRemoveCharges: number;
    readonly undoUses: number;
}

export interface FloorCurioGreeting {
    readonly curioId: FloorCurioId;
    /** What they say back, in their own register. */
    readonly reply: string;
    /** What the player actually walks away with, said plainly. */
    readonly gained: string;
    readonly effect: FloorCurioGreetingEffect;
}

const NOTHING: FloorCurioGreetingEffect = {
    guardTokens: 0,
    peekCharges: 0,
    shopGold: 0,
    strayRemoveCharges: 0,
    undoUses: 0
};

export const FLOOR_CURIO_GREETINGS: Readonly<Record<FloorCurioId, FloorCurioGreeting>> = {
    lost_sock: {
        curioId: 'lost_sock',
        reply: 'You say hello to the sock. The sock does not say hello back. You both let it go.',
        gained: 'Nothing. It is a sock.',
        // The one greeting that pays nothing, and the reason the others land. If every resident
        // handed something over, the verb would be a vending machine with faces on it.
        effect: NOTHING
    },
    nervous_torchbearer: {
        curioId: 'nervous_torchbearer',
        reply: 'He jumps, apologises, points at a tile, apologises for pointing, and holds the light steady for a moment.',
        gained: 'A peek, from a man who would rather you did not mention it.',
        effect: { ...NOTHING, peekCharges: 1 }
    },
    hoarding_rat: {
        curioId: 'hoarding_rat',
        reply: 'It considers you at length, then pushes two coins across the floor with its nose and immediately regrets it.',
        gained: 'Two coins, grudgingly.',
        effect: { ...NOTHING, shopGold: 2 }
    },
    gossiping_skull: {
        curioId: 'gossiping_skull',
        reply: 'It tells you, in detail, about the last person who came through here and exactly which tile finished them.',
        gained: 'One more chance to take a flip back — someone else already made that mistake for you.',
        effect: { ...NOTHING, undoUses: 1 }
    },
    off_duty_guard: {
        curioId: 'off_duty_guard',
        reply: '"Bird about," he says, without looking up. "Takes things. Have one of these, I have plenty."',
        gained: 'A guard token, and a warning about the magpie you were going to need anyway.',
        effect: { ...NOTHING, guardTokens: 1 }
    },
    sticky_toffee: {
        curioId: 'sticky_toffee',
        reply: 'You address the toffee. The toffee does not answer, but a tile comes away on your boot.',
        gained: 'A stray tile, removed by accident.',
        effect: { ...NOTHING, strayRemoveCharges: 1 }
    }
};

export const getFloorCurioGreeting = (curioId: string | null | undefined): FloorCurioGreeting | null =>
    curioId != null && curioId in FLOOR_CURIO_GREETINGS
        ? FLOOR_CURIO_GREETINGS[curioId as FloorCurioId]
        : null;

/** The resident on the run's current floor, or null when there is nobody to talk to. */
export const runFloorCurioGreeting = (run: RunState): FloorCurioGreeting | null =>
    getFloorCurio((run.floorCurioId ?? '') as FloorCurioId) ? getFloorCurioGreeting(run.floorCurioId) : null;

/**
 * Greeting is legal while the floor is being played and nobody has been greeted on it yet.
 *
 * Deliberately not during memorize: the window is short and the resident would be competing with
 * the board for the only seconds that matter.
 */
export const canGreetFloorCurio = (run: RunState): boolean =>
    run.status === 'playing' && run.floorCurioGreeted !== true && runFloorCurioGreeting(run) !== null;

/** Applies a greeting, or returns the run untouched when there is nobody to greet. */
export const greetFloorCurio = (run: RunState): RunState => {
    const greeting = canGreetFloorCurio(run) ? runFloorCurioGreeting(run) : null;
    if (!greeting) {
        return run;
    }
    return {
        ...run,
        floorCurioGreeted: true,
        peekCharges: runNonNegativeInteger(run.peekCharges) + greeting.effect.peekCharges,
        shopGold: runNonNegativeInteger(run.shopGold) + greeting.effect.shopGold,
        strayRemoveCharges: runNonNegativeInteger(run.strayRemoveCharges) + greeting.effect.strayRemoveCharges,
        undoUsesThisFloor: runNonNegativeInteger(run.undoUsesThisFloor) + greeting.effect.undoUses,
        stats: {
            ...run.stats,
            guardTokens: runNonNegativeInteger(run.stats.guardTokens) + greeting.effect.guardTokens
        }
    };
};
