import { describe, expect, it } from 'vitest';
import {
    DECLARED_SURFACES,
    findBrokenSurfaces,
    findUnvisitedFixtures,
    findUnvisitedSurfaces,
    findViewsNoFixtureReaches,
    UNREACHED_VIEW_EXEMPTIONS,
    UNVISITED_FIXTURE_EXEMPTIONS
} from '../../scripts/e2e-surface-coverage';

describe('surfaces no test visits', () => {

    it('holds every declared surface to a fixture that still lands on it', () => {
        expect(findBrokenSurfaces()).toEqual([]);
    });

    it('reports a surface whose fixture no spec names', () => {
        // The state the in-floor vendor was in before Gen 106 (the vendor went in Gen 174, the
        // lesson stayed): the fixture could exist and still nothing would render it.
        expect(findUnvisitedSurfaces('a spec that names nothing')).not.toEqual([]);
        expect(findUnvisitedSurfaces('a spec that names nothing').join(' ')).toContain('cascadeClump');
    });

    it('reports a fixture no spec names', () => {
        expect(findUnvisitedFixtures('')).not.toEqual([]);
    });

    it('says nothing when a spec names every fixture', () => {
        const namesEverything = DECLARED_SURFACES.map((surface) => `'${surface.fixtureId}'`).join(' ');
        expect(findUnvisitedSurfaces(namesEverything)).toEqual([]);
    });

    it('has no unexplained view a fixture cannot reach', () => {
        expect(findViewsNoFixtureReaches()).toEqual([]);
    });

    it('gives every exemption a reason rather than a bare count', () => {
        for (const [key, reason] of Object.entries({ ...UNVISITED_FIXTURE_EXEMPTIONS, ...UNREACHED_VIEW_EXEMPTIONS })) {
            expect(reason.length, key).toBeGreaterThan(20);
        }
    });
});
