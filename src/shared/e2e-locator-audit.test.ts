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
    it('sees a test id in every shape the source writes one', () => {
        // Enumerating attribute syntax produced three separate false alarms — a `testId:` property
        // in a data catalog, a ternary picking between two ids, and a prefix passed as a prop — so
        // this asks only whether the string is written anywhere.
        const rendered = readRenderedTestIds([
            '<div data-testid="plain" />',
            '<div data-testid={"braced"} />',
            "<Shell testId='prop' />",
            "const row = { testId: 'from-a-catalog' };",
            "<b data-testid={kind === 'relic' ? 'from-a-ternary' : 'other'} />",
            '<li data-testid={`side-room-choice-${choice.id}`} />',
            '<SectionRail idPrefix="collection-tab" />'
        ]);

        for (const id of ['plain', 'braced', 'prop', 'from-a-catalog', 'from-a-ternary']) {
            expect(rendered.literals.has(id), id).toBe(true);
        }
        expect(rendered.prefixes).toContain('side-room-choice-');
        expect(rendered.prefixes).toContain('collection-tab-');
    });

    it('accepts an id whose prefix its callers supply', () => {
        const rendered = readRenderedTestIds(['<SectionRail idPrefix="collection-tab" />']);

        expect(findDeadTestIds(['collection-tab-achievements'], rendered)).toEqual([]);
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

    it('holds the baseline at zero, now that the debt it was carrying is gone', () => {
        // The baseline started at twelve because the rot predated the audit: HUD panels were
        // deleted in a rebuild and their specs were not. Every one of those specs has since been
        // repaired or answered, so anything above zero is new rot and fails immediately.
        expect(DEAD_E2E_LOCATOR_BASELINE).toBe(0);
    });

    it('leaves a locator asserted absent alone, which is the point of that assertion', () => {
        // `floor-clear-payoff-stack` is asserted toHaveCount(0) to keep a deleted coaching strip
        // deleted. Reporting it as rot would push someone to delete the guard.
        expect(readSpecTestIds("await expect(page.getByTestId('gone')).toHaveCount(0);")).toEqual([]);
    });

    it('ignores a selector built from a variable, which names no id at all', () => {
        // A helper that takes the id as an argument reported its own template as a dead locator,
        // which is the audit misreading its input rather than finding a rotted spec.
        expect(readSpecTestIds('document.querySelector(`[data-testid="${testId}"]`)')).toEqual([]);
        expect(readSpecTestIds('page.getByTestId(`hud-seat-${seat.id}`)')).toEqual([]);
        // A real literal beside one still counts.
        expect(readSpecTestIds('page.getByTestId("run-shell"); q(`[data-testid="${id}"]`)')).toEqual(['run-shell']);
        expect(readSpecTestIds("await expect(page.getByTestId('gone')).not.toBeVisible();")).toEqual([]);
        expect(readSpecTestIds("await expect(page.getByTestId('here')).toBeVisible();")).toEqual(['here']);
    });

    it('does not call an id missing just because it is not a plain attribute', () => {
        const rendered = readRenderedTestIds(["const modes = [{ testId: 'hud-mode-identity' }];"]);

        expect(findDeadTestIds(['hud-mode-identity'], rendered)).toEqual([]);
    });
});
