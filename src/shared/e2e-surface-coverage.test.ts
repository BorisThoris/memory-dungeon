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
    it('separates the two vendors, which a view-level census cannot', () => {
        // The correction the in-floor vendor forced: `shop` looked covered because the floor-clear
        // vendor reached it, and the screen opened from the board — different exit, different
        // layout, a clipped buy button on the Deck — was invisible to the count.
        const shopSurfaces = DECLARED_SURFACES.filter((surface) => surface.key.startsWith('shop opened'));
        expect(shopSurfaces).toHaveLength(2);
        expect(shopSurfaces.map((surface) => surface.fixtureId).sort()).toEqual(['floorClearWithShop', 'inFloorShop']);
    });

    it('holds every declared surface to a fixture that still lands on it', () => {
        expect(findBrokenSurfaces()).toEqual([]);
    });

    it('reports a surface whose fixture no spec names', () => {
        // The state the in-floor vendor was in before Gen 106: the fixture could exist and still
        // nothing would render it.
        expect(findUnvisitedSurfaces('a spec that names nothing')).not.toEqual([]);
        expect(findUnvisitedSurfaces('a spec that names nothing').join(' ')).toContain('inFloorShop');
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
