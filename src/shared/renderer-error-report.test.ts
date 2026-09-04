import { describe, expect, it } from 'vitest';
import { normalizeRendererErrorReport } from './desktop-api-boundary';

/**
 * This payload arrives over IPC from a renderer that has just failed, which makes it exactly the
 * kind of input worth distrusting: whatever state produced the crash also produced this.
 */
describe('normalizing a render-error report', () => {
    it('keeps a well-formed report', () => {
        expect(
            normalizeRendererErrorReport({
                componentStack: '\n    at ShopScreen',
                message: 'cannot read properties of null',
                stack: 'Error: cannot read properties of null\n    at x'
            })
        ).toEqual({
            componentStack: '\n    at ShopScreen',
            message: 'cannot read properties of null',
            stack: 'Error: cannot read properties of null\n    at x'
        });
    });

    it('gives a nameless failure something recordable rather than dropping it', () => {
        for (const input of [null, undefined, 42, 'a string', {}, { message: 7 }]) {
            const report = normalizeRendererErrorReport(input);

            expect(report.message.length).toBeGreaterThan(0);
            expect(report.componentStack).toBeNull();
            expect(report.stack).toBeNull();
        }
    });

    it('caps a runaway stack so it cannot fill the crash log', () => {
        const report = normalizeRendererErrorReport({
            componentStack: 'c'.repeat(50_000),
            message: 'm'.repeat(50_000),
            stack: 's'.repeat(50_000)
        });

        expect(report.message.length).toBeLessThanOrEqual(500);
        expect(report.stack?.length).toBeLessThanOrEqual(4000);
        expect(report.componentStack?.length).toBeLessThanOrEqual(4000);
    });
});
