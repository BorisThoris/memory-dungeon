import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { dismissStartupIntro } from './startupIntroHelpers';
import { buildVisualSaveJson, gotoWithSaveAndQuery } from './visualScreenHelpers';
test.use({ headless: true, launchOptions: { args: ['--mute-audio'] } });

const seriousOnly = (violations: { impact?: string | null }[]): typeof violations =>
    violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

test.describe('a11y — scoped axe (REF-094)', () => {
    test.describe.configure({ timeout: 90_000 });

    test('main menu after intro: serious violations only', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await dismissStartupIntro(page);
        const { violations } = await new AxeBuilder({ page })
            .disableRules(['color-contrast'])
            .analyze();
        expect(seriousOnly(violations)).toEqual([]);
    });

    test('settings surface: serious violations only', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await dismissStartupIntro(page);
        await page.getByRole('button', { name: /settings/i }).click();
        await expect(page.getByRole('heading', { name: /^settings$/i })).toBeVisible({ timeout: 15_000 });
        const { violations } = await new AxeBuilder({ page })
            .disableRules(['color-contrast'])
            .analyze();
        expect(seriousOnly(violations)).toEqual([]);
    });

    test('camp rewards apply once and floors continue without buying or choosing', async ({ page }) => {
        test.setTimeout(240_000);
        await page.setViewportSize({width:390,height:844});
        const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
        await gotoWithSaveAndQuery(page,buildVisualSaveJson(true),'hallRoom=store-stop');
        await expect(page.getByTestId('game-hud')).toBeVisible({timeout:120000});
        await page.evaluate(async()=>{
            const {useAppStore}=await import('/src/renderer/store/useAppStore.ts');
            useAppStore.setState(state=>({run:{...state.run!,runRulesVersion:61,realmId:'tide',realmSeverity:'calm',gold:20,missBank:[{floor:3,misses:4}]}}));
        });
        for(const pair of ['a','b']) {
            await page.evaluate(async key=>{const s=(await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState();s.pressTile(key+'-1');s.pressTile(key+'-2');},pair);
            await page.waitForTimeout(1200);
        }
        await expect(page.getByTestId('floor-clear-beat')).toContainText('used automatically',{timeout:30000});
        await page.screenshot({path:'output/playwright/flow-camp-receipt.png'});
        await expect.poll(()=>page.evaluate(async()=>{
            const run=(await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().run!;
            return {floor:run.board?.level,rank:run.storePurchases?.long_look};
        }),{timeout:60000}).toEqual({floor:4,rank:1});
        await expect(page.getByTestId('store-sheet')).toHaveCount(0);
        await expect(page.getByTestId('realm-travel')).toHaveCount(0);
        const before=await page.evaluate(async()=>{
            const {useAppStore}=await import('/src/renderer/store/useAppStore.ts');const s=useAppStore.getState();
            const gold=s.run!.gold;s.continueToNextLevel();return {gold,after:useAppStore.getState().run!.gold};
        });expect(before.gold).toBe(before.after);expect(errors).toEqual([]);
        await page.screenshot({path:'output/playwright/flow-next-floor-phone.png'});
    });

    test('Play starts immediately and optional setup stays reachable on touch screens', async ({ browser }) => {
        test.setTimeout(240_000);
        const context=await browser.newContext({hasTouch:true,isMobile:true,viewport:{width:390,height:844}});
        const page=await context.newPage();
        await page.goto('/');await dismissStartupIntro(page);
        await page.getByRole('button',{name:'Play options',exact:true}).click();
        const options=page.getByRole('dialog',{name:'Play options'});
        await expect(options).toBeVisible();
        for(const [name,width,height] of [['phone',390,844],['landscape',844,390],['desktop',1440,900]] as const){
            await page.setViewportSize({width,height});
            await page.screenshot({path:'output/playwright/flow-options-'+name+'.png'});
            const controls=await options.getByRole('button').evaluateAll(elements=>elements.map(el=>({text:el.textContent,...el.getBoundingClientRect().toJSON()})));
            for(const c of controls){expect(c.height).toBeGreaterThanOrEqual(44);expect(c.x).toBeGreaterThanOrEqual(0);expect(c.right).toBeLessThanOrEqual(width);}
        }
        await page.getByText('Customize a solo run',{exact:true}).click();
        await page.setViewportSize({width:844,height:390});
        await options.getByRole('button',{name:'Start custom run'}).scrollIntoViewIfNeeded();
        await page.screenshot({path:'output/playwright/flow-options-expanded-landscape.png'});
        const {violations}=await new AxeBuilder({page}).include('[data-testid="play-options"]').analyze();
        expect(seriousOnly(violations)).toEqual([]);
        await options.getByRole('button',{name:'Back',exact:true}).click();
        await page.screenshot({path:'output/playwright/flow-menu-landscape.png'});
        await page.setViewportSize({width:390,height:844});
        await page.screenshot({path:'output/playwright/flow-menu-phone.png'});
        await page.getByRole('button',{name:'Play',exact:true}).click();
        await expect(page.getByTestId('game-hud')).toBeVisible({timeout:120000});
        await expect(page.getByRole('dialog',{name:'Play options'})).toHaveCount(0);
        await page.screenshot({path:'output/playwright/flow-direct-play-phone.png'});
        await context.close();
    });

    test('ordinary floor clears continue automatically without a route choice', async ({ page }) => {
        test.setTimeout(180_000);
        await gotoWithSaveAndQuery(page, buildVisualSaveJson(true), 'hallRoom=store-stop');
        await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 90_000 });
        await page.evaluate(async () => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            useAppStore.setState(state => ({ run: { ...state.run!, realmId: 'tide', board: { ...state.run!.board!, level: 1 } } }));
        });
        for (const pair of ['a', 'b']) {
            await page.evaluate(async key => {
                const store = (await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState();
                store.pressTile(`${key}-1`); store.pressTile(`${key}-2`);
            }, pair);
            await page.waitForTimeout(1200);
        }
        await expect.poll(async () => page.evaluate(async () => (await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().run?.board?.level), { timeout: 45_000 }).toBe(2);
        await expect(page.getByTestId('store-sheet')).toHaveCount(0);
        await expect(page.getByTestId('realm-travel')).toHaveCount(0);
    });

    test('in-run level 1: serious violations only', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await dismissStartupIntro(page);
        await page.getByRole('button', { name: /^play$/i }).click();
        await expect(page.getByRole('heading', { name: /level 1/i })).toBeVisible({ timeout: 30_000 });
        const { violations } = await new AxeBuilder({ page })
            .disableRules(['color-contrast'])
            .analyze();
        expect(seriousOnly(violations)).toEqual([]);
    });
});
