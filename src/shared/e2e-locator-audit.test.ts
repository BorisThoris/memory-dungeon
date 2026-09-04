import { describe, expect, it } from 'vitest';
import {
    DEAD_E2E_LOCATOR_BASELINE,
    findDeadTestIds,
    readRenderedTestIds,
    readSpecTestIds
} from '../../scripts/e2e-locator-audit';

/**
 * A spec pointing at an element that no longer exists does not fail loudly — it waits for the
 * element until the whole test times out, which reads like a slow machine rather than a broken
 * test. That is why the e2e suite could rot this far without anyone noticing.
 */
describe('the e2e locator audit', () => {
    it('reads test ids from every form the renderer writes them in', () => {
        const rendered = readRenderedTestIds([
            '<div data-testid="plain" />',
            '<div data-testid={"braced"} />',
            "<Shell testId='prop' />",
            '<li data-testid={`side-room-choice-${choice.id}`} />'
        ]);

        expect([...rendered.literals].sort()).toEqual(['braced', 'plain', 'prop']);
        expect(rendered.prefixes).toEqual(['side-room-choice-']);
    });

    it('reads the ids a spec asks for', () => {
        expect(
            readSpecTestIds(`page.getByTestId('one'); page.locator('[data-testid="two"]');`).sort()
        ).toEqual(['one', 'two']);
    });

    it('accepts an id built from a template rather than calling it missing', () => {
        const rendered = readRenderedTestIds(['<li data-testid={`side-room-choice-${choice.id}`} />']);

        expect(findDeadTestIds(['side-room-choice-speak_name'], rendered)).toEqual([]);
    });

    it('reports an id nothing renders', () => {
        const rendered = readRenderedTestIds(['<div data-testid="present" />']);

        expect(findDeadTestIds(['present', 'deleted-in-a-rebuild'], rendered)).toEqual([
            'deleted-in-a-rebuild'
        ]);
    });

    it('holds a baseline that fails on growth rather than on the debt', () => {
        // The rot predates the audit: HUD panels were deleted in a rebuild and their specs were
        // not. Failing on the existing count would make this another gate nobody runs.
        expect(DEAD_E2E_LOCATOR_BASELINE).toBeGreaterThan(0);
    });
});
