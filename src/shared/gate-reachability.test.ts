import { describe, expect, it } from 'vitest';
import {
    findUnrunGates,
    isCoveredByTheFullTestRun,
    reachableFrom,
    readScripts,
    STANDALONE_GATES
} from '../../scripts/gate-reachability';

/**
 * A gate nobody runs is worse than no gate, because it looks like coverage. Two of them cost real
 * money here: gate:security sat unreferenced while sixty-four advisories piled up behind it, and
 * gate:package-hygiene sat unreferenced while five dead files did the same.
 */
describe('gate reachability', () => {
    it('leaves no gate unrun and undeclared', () => {
        const unrun = findUnrunGates(readScripts());

        expect(unrun, `add these to a composite gate or declare them standalone: ${unrun.join(', ')}`).toEqual([]);
    });

    it('follows composites more than one level deep', () => {
        const scripts = {
            deep: 'echo hi',
            fullcheck: 'yarn middle',
            middle: 'yarn deep && echo done',
            unrelated: 'echo no'
        };

        expect(reachableFrom(scripts, 'fullcheck')).toEqual(new Set(['fullcheck', 'middle', 'deep']));
    });

    it('reports a gate nothing reaches', () => {
        expect(
            findUnrunGates({ fullcheck: 'yarn lint', lint: 'eslint .', 'gate:orphan': 'node check.mjs' })
        ).toEqual(['gate:orphan']);
    });

    it('treats a pure test selector as already covered', () => {
        // `yarn test` runs every test file with no filter, so a gate that only picks a subset adds
        // no coverage — recognising that by shape keeps the exemption list from going stale.
        expect(isCoveredByTheFullTestRun('yarn typecheck:shared && yarn vitest run src/shared/a.test.ts')).toBe(true);
        expect(isCoveredByTheFullTestRun('yarn vitest run src/a.test.ts && tsx scripts/something.ts')).toBe(false);
        expect(isCoveredByTheFullTestRun('node scripts/check.mjs')).toBe(false);
    });

    it('gives every standalone gate a reason rather than a bare name', () => {
        expect(Object.keys(STANDALONE_GATES).length).toBeGreaterThan(0);
        for (const [name, reason] of Object.entries(STANDALONE_GATES)) {
            expect(reason.length, `${name} is exempt without saying why`).toBeGreaterThan(30);
        }
    });
});
