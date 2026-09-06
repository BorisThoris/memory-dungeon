import { describe, expect, it } from 'vitest';
import { createNewRun } from './run-creation-rules';
import { FLOOR_CURIOS, type FloorCurioId } from './floor-curio-rules';
import {
    canGreetFloorCurio,
    FLOOR_CURIO_GREETINGS,
    getFloorCurioGreeting,
    greetFloorCurio,
    runFloorCurioGreeting
} from './floor-curio-greeting-rules';
import { createGameplayGreetCurioCommand } from './gameplay-core-contracts';
import { reduceGameplayCommand } from './gameplay-core';

/** A run standing on a floor, with a chosen resident on it and the board in play. */
const standingOn = (curioId: FloorCurioId) => ({
    ...createNewRun(0, { runSeed: 4_242 }),
    status: 'playing' as const,
    floorCurioId: curioId,
    floorCurioGreeted: false
});

describe('who you can say hello to', () => {
    it('has a greeting for every resident, so nobody is a modifier with no reply', () => {
        for (const resident of FLOOR_CURIOS) {
            const greeting = getFloorCurioGreeting(resident.id);
            expect(greeting, `${resident.id} has nothing to say`).toBeTruthy();
            expect(greeting!.reply.trim().length).toBeGreaterThan(20);
            expect(greeting!.gained.trim().length).toBeGreaterThan(0);
        }
    });

    it('never takes anything, because a greeting that might cost you is a gamble', () => {
        for (const greeting of Object.values(FLOOR_CURIO_GREETINGS)) {
            for (const amount of Object.values(greeting.effect)) {
                expect(amount).toBeGreaterThanOrEqual(0);
            }
        }
    });

    it('moves a different lever for each resident who does anything at all', () => {
        const levers = Object.values(FLOOR_CURIO_GREETINGS)
            .map((greeting) =>
                Object.entries(greeting.effect)
                    .filter(([, amount]) => amount !== 0)
                    .map(([lever]) => lever)
                    .join('+')
            )
            .filter((lever) => lever.length > 0);

        // One button with six labels would not be a cast.
        expect(new Set(levers).size).toBe(levers.length);
    });

    it('leaves the sock saying nothing, which is what makes the others land', () => {
        expect(Object.values(FLOOR_CURIO_GREETINGS.lost_sock.effect).every((amount) => amount === 0)).toBe(true);
    });
});

describe('when you can say it', () => {
    it('is offered on a floor being played, once', () => {
        const run = standingOn('off_duty_guard');
        expect(canGreetFloorCurio(run)).toBe(true);

        const greeted = greetFloorCurio(run);
        expect(greeted.floorCurioGreeted).toBe(true);
        expect(canGreetFloorCurio(greeted)).toBe(false);
        expect(greetFloorCurio(greeted)).toBe(greeted);
    });

    it('is not offered during the memorize window, which is short enough already', () => {
        expect(canGreetFloorCurio({ ...standingOn('hoarding_rat'), status: 'memorize' })).toBe(false);
    });

    it('is not offered when nobody is on the floor', () => {
        expect(canGreetFloorCurio({ ...standingOn('lost_sock'), floorCurioId: null })).toBe(false);
        expect(runFloorCurioGreeting({ ...standingOn('lost_sock'), floorCurioId: 'a_ghost' })).toBeNull();
    });
});

describe('what the greeting actually hands over', () => {
    it('the guard lends a token', () => {
        const run = standingOn('off_duty_guard');
        expect(greetFloorCurio(run).stats.guardTokens).toBe(run.stats.guardTokens + 1);
    });

    it('the rat parts with two coins', () => {
        const run = standingOn('hoarding_rat');
        expect(greetFloorCurio(run).shopGold).toBe(run.shopGold + 2);
    });

    it('the torchbearer points at something', () => {
        const run = standingOn('nervous_torchbearer');
        expect(greetFloorCurio(run).peekCharges).toBe(run.peekCharges + 1);
    });

    it('the skull buys back a flip with somebody else’s mistake', () => {
        const run = standingOn('gossiping_skull');
        expect(greetFloorCurio(run).undoUsesThisFloor).toBe(run.undoUsesThisFloor + 1);
    });

    it('the toffee removes a stray tile by accident', () => {
        const run = standingOn('sticky_toffee');
        expect(greetFloorCurio(run).strayRemoveCharges).toBe(run.strayRemoveCharges + 1);
    });

    it('the sock changes nothing but the fact that you tried', () => {
        const run = standingOn('lost_sock');
        const after = greetFloorCurio(run);
        expect(after.floorCurioGreeted).toBe(true);
        expect({ ...after, floorCurioGreeted: false }).toEqual(run);
    });
});

describe('the command a button actually sends', () => {
    it('is accepted once and says what was said', () => {
        const run = standingOn('off_duty_guard');
        const result = reduceGameplayCommand(run, createGameplayGreetCurioCommand('greet:test:1'));

        expect(result.accepted).toBe(true);
        expect(result.events.map((event) => event.type)).toContain('board.curio_greeted');
        // The reply has to reach the player, not just the run state: an unspoken greeting is
        // indistinguishable from a button that does nothing.
        expect(
            result.events.some(
                (event) =>
                    event.type === 'feedback.requested' &&
                    event.message === FLOOR_CURIO_GREETINGS.off_duty_guard.reply
            )
        ).toBe(true);
    });

    it('is refused on a floor already greeted, rather than quietly doing it twice', () => {
        const greeted = greetFloorCurio(standingOn('hoarding_rat'));
        expect(reduceGameplayCommand(greeted, createGameplayGreetCurioCommand('greet:test:2')).accepted).toBe(false);
    });
});

describe('a run can reach the verb at all', () => {
    it('opens floor one with somebody on it, so the control is not born disabled', () => {
        const run = createNewRun(0, { runSeed: 8_811 });
        expect(FLOOR_CURIOS.map((resident) => resident.id)).toContain(run.floorCurioId);
        expect(run.floorCurioGreeted).toBe(false);
    });

    it('gives floor one no arrival gift, because nothing announced who was down there', () => {
        // Two runs of the same mode must open with the same budget. A resident nobody was told
        // about, quietly changing the starting peeks, is variance the player can never account for.
        const seeds = [1, 2, 3, 4, 5, 6, 7, 8].map((runSeed) => createNewRun(0, { runSeed }));
        const budgets = seeds.map(
            (run) => `${run.peekCharges}:${run.shuffleCharges}:${run.shopGold}:${run.stats.guardTokens}`
        );

        expect(new Set(budgets).size).toBe(1);
    });

    it('gives the next floor a fresh hello', async () => {
        const { createNextFloorRunState } = await import('./next-floor-run-state-rules');
        const base = greetFloorCurio(standingOn('off_duty_guard'));
        expect(base.floorCurioGreeted).toBe(true);

        const next = createNextFloorRunState(base, {
            board: { ...base.board!, level: 3 },
            lives: base.lives,
            activeMutators: [],
            dungeonRun: base.dungeonRun,
            parasiteFloors: 0,
            parasiteWardRemaining: 0
        } as unknown as Parameters<typeof createNextFloorRunState>[1]);

        expect(next.floorCurioGreeted).toBe(false);
    });
});
