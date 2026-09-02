import { expect, test } from '@playwright/test';
import { forceGameOverViaE2eHook, openPlayablePathFixture } from './playablePathHelpers';

const shots: { id: string; fixture: 'floorClearWithRouteChoices' | 'relicDraft' | 'floorClearWithShop' | 'sideRoomSkip' | 'gameOver'; wait: string }[] = [
    { id: 'floor-clear', fixture: 'floorClearWithRouteChoices', wait: '[data-testid="route-choice-panel"]' },
    { id: 'relic-draft', fixture: 'relicDraft', wait: '[data-testid="relic-offer-card"]' },
    { id: 'shop', fixture: 'floorClearWithShop', wait: '[data-testid="shop-screen"]' },
    { id: 'side-room', fixture: 'sideRoomSkip', wait: '[data-testid="side-room-screen"]' },
    { id: 'game-over', fixture: 'gameOver', wait: '[data-testid="game-over-next-run-loop"]' }
];

test.describe('retry loop capture', () => {
    test.describe.configure({ retries: 0, timeout: 180_000 });
    for (const [name, viewport] of [
        ['desktop', { width: 1440, height: 900 }],
        ['mobile', { width: 390, height: 844 }]
    ] as const) {
        for (const shot of shots) {
            test(`${shot.id} ${name}`, async ({ page }) => {
                await page.setViewportSize(viewport);
                if (shot.fixture === 'gameOver') {
                    await forceGameOverViaE2eHook(page);
                } else {
                    await openPlayablePathFixture(page, shot.fixture);
                    if (shot.id === 'shop') {
                        await page.getByRole('dialog', { name: /floor cleared/i }).getByRole('button', { name: /visit shop/i }).click();
                    }
                }
                await expect(page.locator(shot.wait).first()).toBeVisible({ timeout: 60_000 });
                await page.waitForTimeout(700);
                await page.screenshot({ path: `tmp/ui-redesign/built/${shot.id}-${name}.png`, fullPage: false });
                const probe = await page.evaluate(() => {
                    const root = document.querySelector('[role="dialog"]') ?? document.body;
                    const leaves = Array.from(root.querySelectorAll('*')).filter((el) => {
                        const cs = getComputedStyle(el);
                        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
                        return Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent?.trim());
                    });
                    return { leaves: leaves.length, sub12: leaves.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12).length };
                });
                console.log(`PROBE ${shot.id} ${name}: text leaves ${probe.leaves}, sub-12px ${probe.sub12}`);
            });
        }
    }
});
