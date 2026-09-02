import { expect, test, type Page } from '@playwright/test';
import { openPlayablePathFixture, expectGameplayReady, openRunMenuItem } from './playablePathHelpers';
import {
    buildVisualSaveJson,
    gotoWithSave,
    mainMenuPlayButton,
    openChooseYourPath,
    openMainMenuFromSave
} from './visualScreenHelpers';
import { dismissStartupIntro } from './startupIntroHelpers';

/** Report every element that scrolls, plus sub-12px text, for one screen. */
const audit = async (page: Page, label: string, shot: string): Promise<void> => {
    await page.waitForTimeout(600);
    await page.screenshot({ path: `tmp/ui-audit2/${shot}.png` });
    const report = await page.evaluate(() => {
        const scrollers: string[] = [];
        const all = Array.from(document.querySelectorAll('*')) as HTMLElement[];
        for (const el of all) {
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            const scrollsY = el.scrollHeight - el.clientHeight > 4 && /auto|scroll/.test(cs.overflowY);
            const scrollsX = el.scrollWidth - el.clientWidth > 4 && /auto|scroll/.test(cs.overflowX);
            if (scrollsY || scrollsX) {
                const id = el.getAttribute('data-testid') ?? el.className?.toString().slice(0, 40) ?? el.tagName;
                scrollers.push(
                    `${id}[${scrollsY ? `y:${el.scrollHeight}/${el.clientHeight}` : ''}${scrollsX ? ` x:${el.scrollWidth}/${el.clientWidth}` : ''}]`
                );
            }
        }
        const leaves = all.filter((el) => {
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') return false;
            return Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent?.trim());
        });
        const sub12 = leaves.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12);
        const docScroll = document.documentElement.scrollHeight - window.innerHeight;
        return {
            scrollers: scrollers.slice(0, 6),
            scrollerCount: scrollers.length,
            leaves: leaves.length,
            sub12: sub12.length,
            docScroll
        };
    });
    console.log(
        `AUDIT ${label} | leaves ${report.leaves} | sub12 ${report.sub12} | docScroll ${report.docScroll} | scrollers ${report.scrollerCount}: ${report.scrollers.join(' ')}`
    );
};

for (const [size, viewport] of [
    ['desktop', { width: 1440, height: 900 }],
    ['mobile', { width: 390, height: 844 }]
] as const) {
    test.describe(`ui audit ${size}`, () => {
        test.describe.configure({ retries: 0, timeout: 240_000 });

        test(`menus ${size}`, async ({ page }) => {
            await page.setViewportSize(viewport);
            await openMainMenuFromSave(page, true);
            await audit(page, `main-menu ${size}`, `main-menu-${size}`);

            await openChooseYourPath(page);
            await audit(page, `choose-path ${size}`, `choose-path-${size}`);
            await page.getByTestId('choose-path-inline-back').click();
            await expect(mainMenuPlayButton(page)).toBeVisible();

            for (const [name, pattern] of [
                ['collection', /^collection$/i],
                ['profile', /^profile$/i],
                ['inventory', /^inventory$/i],
                ['codex', /^codex$/i],
                ['settings', /^settings$/i]
            ] as const) {
                await page.getByRole('button', { name: pattern }).click();
                await page.waitForTimeout(400);
                await audit(page, `${name} ${size}`, `${name}-${size}`);
                await page
                    .getByRole('button', { name: /^back$/i })
                    .first()
                    .click({ force: true });
                await expect(mainMenuPlayButton(page)).toBeVisible({ timeout: 20_000 });
            }
        });

        test(`run loop ${size}`, async ({ page }) => {
            await page.setViewportSize(viewport);
            await openPlayablePathFixture(page, 'activeRunWithHazards');
            await expectGameplayReady(page);
            await audit(page, `in-run ${size}`, `in-run-${size}`);

            await openRunMenuItem(page, 'inventory');
            await audit(page, `in-run-inventory ${size}`, `in-run-inventory-${size}`);
            await page
                .getByRole('region', { name: /inventory/i })
                .getByRole('button', { name: /^back$/i })
                .click();
            await expectGameplayReady(page);

            await openRunMenuItem(page, 'codex');
            await audit(page, `in-run-codex ${size}`, `in-run-codex-${size}`);
            await page.getByTestId('codex-screen').getByRole('button', { name: /^back$/i }).click();
            await expectGameplayReady(page);

            await openRunMenuItem(page, 'settings');
            await audit(page, `in-run-settings ${size}`, `in-run-settings-${size}`);
        });

        test(`interludes ${size}`, async ({ page }) => {
            await page.setViewportSize(viewport);
            await openPlayablePathFixture(page, 'floorClearWithRouteChoices');
            await audit(page, `floor-clear ${size}`, `floor-clear-${size}`);

            await openPlayablePathFixture(page, 'relicDraft');
            await audit(page, `relic-draft ${size}`, `relic-draft-${size}`);

            await openPlayablePathFixture(page, 'floorClearWithShop');
            await page.getByRole('dialog', { name: /floor cleared/i }).getByRole('button', { name: /visit shop/i }).click();
            await expect(page.getByTestId('shop-screen')).toBeVisible();
            await audit(page, `shop ${size}`, `shop-${size}`);

            await openPlayablePathFixture(page, 'sideRoomSkip');
            await audit(page, `side-room ${size}`, `side-room-${size}`);

            await openPlayablePathFixture(page, 'gameOver');
            await audit(page, `game-over ${size}`, `game-over-${size}`);
        });

        test(`startup ${size}`, async ({ page }) => {
            await page.setViewportSize(viewport);
            await gotoWithSave(page, buildVisualSaveJson(false));
            await page.waitForTimeout(900);
            await audit(page, `startup-intro ${size}`, `startup-intro-${size}`);
            await dismissStartupIntro(page);
            await expect(mainMenuPlayButton(page)).toBeVisible({ timeout: 30_000 });
            await audit(page, `first-run-menu ${size}`, `first-run-menu-${size}`);
        });
    });
}
