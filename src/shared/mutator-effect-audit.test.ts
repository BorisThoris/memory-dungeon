import { describe, expect, it } from 'vitest';

import { MUTATOR_IDS } from './contracts';
import { auditMutatorEffects, findMutatorFloor, playMutatorFloor } from '../../scripts/mutator-effect-audit';

/**
 * A mutator is a promise on the floor card. The occupancy censuses ask whether a system ever
 * happens; nothing asked whether a mutator that happens does anything, which is the same failure one
 * layer up - and this repository has shipped that failure twice, in the pop (Gen 148) and in the
 * magpie (Gen 208).
 */
describe('every mutator changes the game', () => {
    const { findings, observed } = auditMutatorEffects();

    it('finds nothing decorative on the repository as it stands', () => {
        expect(findings).toEqual([]);
    });

    it('names, for every mutator, a channel a player could notice it in', () => {
        for (const id of MUTATOR_IDS) {
            expect(observed[id], id).toBeTruthy();
        }
    });

    it('deals every mutator inside the first twenty-four floors', () => {
        // A mutator the schedule never reaches is content nobody meets, whatever it does when it
        // fires; `floor-mutator-schedule.ts` is where that would go wrong.
        for (const id of MUTATOR_IDS) {
            expect(findMutatorFloor(id), id).toBeTruthy();
        }
    });

    it('reads the same floor the same way twice, so a difference is the mutator', () => {
        const floor = findMutatorFloor('sticky_fingers')!;
        expect(playMutatorFloor(floor.seed, floor.floor, ['sticky_fingers'])).toEqual(
            playMutatorFloor(floor.seed, floor.floor, ['sticky_fingers'])
        );
    });

    it('would catch a mutator that did nothing, which is the only reason to keep it', () => {
        /*
         * The bar has to fail on something. A floor played with no mutator against itself moves no
         * channel at all - that is the shape of a decorative mutator, and it is what this audit
         * reports when one turns up.
         */
        const floor = findMutatorFloor('n_back_anchor')!;
        const plain = playMutatorFloor(floor.seed, floor.floor, []);
        expect(playMutatorFloor(floor.seed, floor.floor, [])).toEqual(plain);
        expect(playMutatorFloor(floor.seed, floor.floor, ['n_back_anchor'])).not.toEqual(plain);
    });
});
