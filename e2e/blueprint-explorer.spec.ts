import { expect, test, type Page } from '@playwright/test';

const installBlockingErrorChecks = (page: Page) => {
    const blockingErrors: string[] = [];

    page.on('console', (message) => {
        if (message.type() === 'error') {
            blockingErrors.push(message.text());
        }
    });
    page.on('pageerror', (error) => {
        blockingErrors.push(error.message);
    });

    return {
        expectClean() {
            expect(blockingErrors).toEqual([]);
        }
    };
};

test.describe('Blueprint explorer dev route', () => {
    test('renders system diagrams without console errors', async ({ page }) => {
        test.setTimeout(90_000);
        const errors = installBlockingErrorChecks(page);

        await page.goto('/__blueprint', { waitUntil: 'domcontentloaded' });
        await expect(page.locator('[data-e2e-blueprint-dev="1"]')).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText(/System Diagrams/i).first()).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('select').filter({ hasText: /Navigation Flow/i }).first()).toHaveValue('navigation-flow', {
            timeout: 30_000
        });
        await page.getByLabel(/open actions/i).uncheck();
        await page.getByLabel(/Diagram/i).selectOption('test-gate-architecture');
        await expect(page.getByText(/Keep live browser smoke runnable/i).first()).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText(/yarn test:e2e:browser-smoke/i).first()).toBeVisible({ timeout: 30_000 });

        errors.expectClean();
    });
});
