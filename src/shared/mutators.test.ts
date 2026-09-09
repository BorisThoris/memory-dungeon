import { describe, expect, it } from 'vitest';
import type { MutatorId, RunState } from './contracts';
import { MUTATOR_CATALOG, hasMutator } from './mutators';

const MUTATOR_ID_SLUG = /^[a-z][a-z0-9_]*$/;

describe('MUTATOR_CATALOG integrity', () => {
    it('has a non-empty title and description for every mutator id', () => {
        for (const id of Object.keys(MUTATOR_CATALOG) as MutatorId[]) {
            const def = MUTATOR_CATALOG[id]!;
            expect(def.id).toBe(id);
            expect(def.title.trim().length).toBeGreaterThan(0);
            expect(def.description.trim().length).toBeGreaterThan(0);
            expect(id, 'mutator id slug').toMatch(MUTATOR_ID_SLUG);
        }
    });
});

describe('mutators', () => {
    it('hasMutator reflects activeMutators', () => {
        const run = { activeMutators: ['wide_recall'] as MutatorId[] } as RunState;
        expect(hasMutator(run, 'wide_recall')).toBe(true);
        expect(hasMutator(run, 'sticky_fingers')).toBe(false);
    });

    it('treats malformed activeMutators as empty', () => {
        const run = { activeMutators: Number.NaN as unknown as MutatorId[] } as RunState;
        expect(hasMutator(run, 'wide_recall')).toBe(false);
    });

});
