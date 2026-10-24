import { describe, expect, it } from 'vitest';
import { pickFloorScheduleEntry } from './floor-mutator-schedule';
import { GATE_OMEN_FROM_FLOOR, gateOmen, gateOmenCount, gateOmenToldOn, RUN_SIGNATURE_FROM, signatureCyclePosition } from './run-signature-rules';

const gate = (seed: number, rules: number): string[] => Array.from({ length: 12 }, (_, i) => String(pickFloorScheduleEntry(seed, rules, i + 1, 'endless').floorArchetypeId));
const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

describe('a run’s own Gate (rules 90)', () => {
    it('keeps floors 1-3, the boss slot and the rotating slot, and deals the rest in the run’s order', () => {
        const before = gate(1, RUN_SIGNATURE_FROM - 1);
        for (const seed of SEEDS.slice(0, 40)) {
            const now = gate(seed, RUN_SIGNATURE_FROM);
            for (const floor of [1, 2, 3, 7, 9]) expect(now[floor - 1], `seed ${seed} floor ${floor}`).toBe(before[floor - 1]);
            // The same rooms, each among its own kind.
            expect([4, 5, 8, 11, 12].map((f) => now[f - 1]).sort()).toEqual([4, 5, 8, 11, 12].map((f) => before[f - 1]).sort());
            expect([6, 10].map((f) => now[f - 1]).sort()).toEqual([6, 10].map((f) => before[f - 1]).sort());
        }
        // Before rules 90 every run's Gate is the same; from 90 they differ.
        expect(new Set(SEEDS.map((seed) => gate(seed, RUN_SIGNATURE_FROM - 1).join())).size).toBe(1);
        expect(new Set(SEEDS.map((seed) => gate(seed, RUN_SIGNATURE_FROM).join())).size).toBeGreaterThan(100);
    });

    it('draws each cycle again, and each position maps to one room', () => {
        const cycles = [0, 1, 2].map((cycle) => [4, 5, 8, 11, 12].map((p) => signatureCyclePosition(7, RUN_SIGNATURE_FROM, cycle, p)));
        for (const order of cycles) expect([...order].sort((a, b) => a - b)).toEqual([4, 5, 8, 11, 12]);
        expect(new Set(SEEDS.slice(0, 20).map((seed) => [0, 1, 2].map((cycle) => signatureCyclePosition(seed, RUN_SIGNATURE_FROM, cycle, 4)).join())).size).toBeGreaterThan(5);
        expect(signatureCyclePosition(7, RUN_SIGNATURE_FROM - 1, 0, 4)).toBe(4);
    });

    it('gives every run one omen, both families about as often', () => {
        const omens = SEEDS.map((seed) => gateOmen(seed, RUN_SIGNATURE_FROM));
        const wanderers = omens.filter((omen) => omen === 'wanderer').length;
        expect(wanderers).toBeGreaterThan(70);
        expect(wanderers).toBeLessThan(130);
        expect(gateOmen(1, RUN_SIGNATURE_FROM - 1)).toBeNull();
    });

    it('adds one of the omen’s family from floor 6, only where the schedule deals none and the floor can hold it', () => {
        const seed = SEEDS.find((s) => gateOmen(s, RUN_SIGNATURE_FROM) === 'wanderer')!;
        const at = (level: number, pairCount = 11, scheduled = 0) => gateOmenCount('wanderer', { level, pairCount }, { runSeed: seed, rulesVersion: RUN_SIGNATURE_FROM, scheduled, minPairs: 8 });
        expect(at(GATE_OMEN_FROM_FLOOR - 1)).toBe(0);
        expect(at(GATE_OMEN_FROM_FLOOR)).toBe(1);
        expect(at(12, 7)).toBe(0);
        expect(at(13, 15, 2)).toBe(0);
        // Past the Gate the omen is spent, even where its family is not yet due.
        expect(at(15, 16)).toBe(0);
        expect(gateOmenCount('mask', { level: 6, pairCount: 11 }, { runSeed: seed, rulesVersion: RUN_SIGNATURE_FROM, scheduled: 0, minPairs: 8 })).toBe(0);
    });

    it('is told on floor 6 only, and not in Endless', () => {
        const run = { runSeed: 3, runRulesVersion: RUN_SIGNATURE_FROM };
        expect(gateOmenToldOn({ ...run, board: { level: 6 } })).toBe(gateOmen(3, RUN_SIGNATURE_FROM));
        expect(gateOmenToldOn({ ...run, board: { level: 7 } })).toBeNull();
        expect(gateOmenToldOn({ ...run, board: { level: 6 }, endless: true })).toBeNull();
    });
});
