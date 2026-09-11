import { describe, expect, it } from 'vitest';

import {
    MECHANIC_CENSUS_COUNTERS,
    MECHANIC_CENSUS_EXEMPTION_SWEEP_GENERATION,
    MECHANIC_CENSUS_EXEMPTIONS,
    auditMechanicAccountability
} from '../../scripts/mechanic-accountability';
import { gameplayInteractionGraph } from './gameplay-interaction-graph';
import { SYSTEM_OCCUPANCY_COUNTERS } from './system-occupancy-simulation';

describe('every mechanic answers for itself', () => {
    it('finds nothing on the repository as it stands', () => {
        expect(auditMechanicAccountability()).toEqual([]);
    });

    it('holds every mechanic in the graph to one of the two answers', () => {
        const answered = new Set<string>([...Object.keys(MECHANIC_CENSUS_COUNTERS), ...Object.keys(MECHANIC_CENSUS_EXEMPTIONS)]);
        const blind = /^(power|inventory|trait)\./u;
        for (const mechanic of gameplayInteractionGraph.mechanics) {
            expect(answered.has(mechanic.id) || blind.test(mechanic.id), mechanic.id).toBe(true);
        }
    });

    it('gives every exemption a reason worth reading, not a shrug', () => {
        for (const [id, exemption] of Object.entries(MECHANIC_CENSUS_EXEMPTIONS)) {
            expect(exemption.reason.length, id).toBeGreaterThan(40);
            expect(exemption.reason.endsWith('.'), id).toBe(true);
        }
    });

    it('has re-read every exemption against the game as it stands', () => {
        /*
         * Gen 217. An exemption is an argument, and an argument goes stale without saying so:
         * `objective.featured_streak` named the run-level census as its blocker, that census
         * shipped at Gen 207, and the line went on excusing the mechanic for eight generations
         * until Gen 216 read it. The summary counts exemptions, and a count cannot tell a live
         * argument from a dead one.
         *
         * So every line carries the generation it was last read, and raising the sweep constant is
         * the act of re-reading all of them. Two of the ten were describing a game that had moved
         * when Gen 217 looked - the mutator loadout called itself a run setup while the schedule
         * hands a different mutator to every floor, and the run summary said the census plays
         * floors rather than runs, which stopped being true at Gen 207.
         */
        for (const [id, exemption] of Object.entries(MECHANIC_CENSUS_EXEMPTIONS)) {
            expect(exemption.generation, `${id} predates the current sweep`).toBeGreaterThanOrEqual(
                MECHANIC_CENSUS_EXEMPTION_SWEEP_GENERATION
            );
        }
    });

    it('catches a mechanic that names a counter the census does not watch', () => {
        const named = new Set(Object.values(MECHANIC_CENSUS_COUNTERS).flat());
        for (const key of named) {
            expect(SYSTEM_OCCUPANCY_COUNTERS.some((counter) => counter.id === key), key).toBe(true);
        }
        // And the other way: a counter nobody claims is a counter measuring nothing.
        for (const counter of SYSTEM_OCCUPANCY_COUNTERS) {
            expect(named.has(counter.id), counter.id).toBe(true);
        }
    });

    it('records how much of the game the census can actually see', () => {
        // Not a target, a measurement, and the one that says whether "every system in the game
        // answers for itself" is a claim or a slogan. Gen 194 measured seven of forty-five. Gen 195
        // took it to fifteen by spending what a plain endless run hands out. Gen 199 took it to
        // thirty-two by giving the census a player that starts from a run setup. Gen 200 removed
        // Destroy and Stray outright, so the graph is forty-one and the two UNREACHABLE lines are
        // gone with the powers they described - the ratio went up by deleting the debt, not by
        // covering it. Gen 208 added the magpie, which had been on this file's own list of
        // uncounted mechanics since Gen 194: thirty-one of forty-two. Gen 216 took it to
        // thirty-two by counting the featured objective, whose exemption had said it needed the
        // run-level census - which shipped at Gen 207, eight generations before anyone re-read the
        // line.
        const censused = Object.keys(MECHANIC_CENSUS_COUNTERS).length;
        expect(censused).toBe(32);
        expect(gameplayInteractionGraph.mechanics.length).toBe(42);
        /*
         * Nothing is blind by family any more: every remaining mechanic carries its own argued
         * exemption. Ten of them.
         *
         * This comment used to add "and every one is a real exemption rather than a debt: no line
         * here says a mechanic cannot be reached". That was not true when it was written - the
         * featured objective's line named a census that already existed - and the sentence is gone
         * rather than re-asserted about the ten that remain. Nothing has re-read them either.
         */
        const stillBlind = gameplayInteractionGraph.mechanics.filter(
            (mechanic) =>
                MECHANIC_CENSUS_COUNTERS[mechanic.id] == null && MECHANIC_CENSUS_EXEMPTIONS[mechanic.id] == null
        ).length;
        expect(stillBlind).toBe(0);
        expect(censused + Object.keys(MECHANIC_CENSUS_EXEMPTIONS).length).toBe(gameplayInteractionGraph.mechanics.length);
    });
});
