import { test, expect } from '@playwright/test';
import { buildVisualSaveJson, gotoWithSaveAndQuery } from './visualScreenHelpers';
import { readTileClientRectAtGrid } from './tileBoardGameFlow';
test.afterEach(({page}, info) => { for (const error of info.errors) console.log('TEST FAILURE', page.url(), error.message); });
const mobileSave = () => { const save=JSON.parse(buildVisualSaveJson(true,true)); save.settings.graphicsQuality='low'; return JSON.stringify(save); };

test.describe('touch phone',()=>{
test.use({hasTouch:true,isMobile:true});
test('original cards, stored meteor targeting, cancellation, and inventory on a phone',async({page})=>{
    test.setTimeout(240000);
    await page.setViewportSize({width:390,height:844});
    const errors:string[]=[]; page.on('pageerror',error=>{errors.push(error.message);console.log('PAGE ERROR',error.message);});
    page.on('console',message=>{if(message.type()==='error') console.log('BROWSER ERROR',message.text());});
    await gotoWithSaveAndQuery(page,mobileSave(),'hallRoom=store-stop');
    await expect(page.getByTestId('game-hud')).toBeVisible({timeout:150000});
    await page.evaluate(async()=>{
        const {useAppStore}=await import('/src/renderer/store/useAppStore.ts');
        const {buildBoard}=await import('/src/shared/board-build-rules.ts');
        useAppStore.setState({run:{...useAppStore.getState().run!,board:buildBoard(12),status:'playing',meteorCharges:2}});
        useAppStore.getState().openInventoryFromPlaying();
    });
    await page.getByRole('button',{name:'Call meteor · 2',exact:true}).click();
    await expect(page.getByTestId('run-shell-line')).toContainText('Select a card for your meteor');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(async()=>{const {useAppStore}=await import('/src/renderer/store/useAppStore.ts');return useAppStore.getState().run?.meteorCharges;})).toBe(2);
    await page.screenshot({path:'output/playwright/original-cards-phone.png'});
    await page.evaluate(async()=>{const {useAppStore}=await import('/src/renderer/store/useAppStore.ts');useAppStore.getState().armMeteor();});
    await expect(page.getByTestId('run-shell-line')).toContainText('Select a card for your meteor');
    await expect(page.getByTestId('tile-board-frame')).toHaveAttribute('data-selection-suppressed','false');
    const target=await readTileClientRectAtGrid(page,1,1);
    await page.touchscreen.tap(target.left+target.width/2,target.top+target.height/2);
    await expect.poll(()=>page.evaluate(async()=>{const {useAppStore}=await import('/src/renderer/store/useAppStore.ts');return useAppStore.getState().run?.meteorCharges;}),{timeout:45000}).toBe(1);
    const result=await page.evaluate(async()=>{
        const {useAppStore}=await import('/src/renderer/store/useAppStore.ts');const run=useAppStore.getState().run!;
        return {armed:run.meteorArmed,cards:run.board?.meteorImpact?.cards,god:'godRun' in run};
    });
    expect(result.armed).toBe(false); expect(result.cards).toBeGreaterThan(0); expect(result.god).toBe(false);
    expect(errors).toEqual([]);
});
});

test('large original board uses real cards and bounded detail, then zooms and pans',async({page})=>{
    test.setTimeout(240000);
    const errors:string[]=[]; page.on('pageerror',error=>{errors.push(error.message);console.log('PAGE ERROR',error.message);});
    page.on('console',message=>{if(message.type()==='error') console.log('BROWSER ERROR',message.text());});
    await gotoWithSaveAndQuery(page,mobileSave(),'hallRoom=store-stop');
    await expect(page.getByTestId('game-hud')).toBeVisible({timeout:150000});
    await page.evaluate(async()=>{
        const {useAppStore}=await import('/src/renderer/store/useAppStore.ts');
        const {buildBoard}=await import('/src/shared/board-build-rules.ts');
        useAppStore.setState({run:{...useAppStore.getState().run!,board:buildBoard(330),status:'playing',meteorCharges:1}});
    });
    const canvas=page.getByTestId('tile-board-stage').locator('canvas');
    await expect(canvas).toHaveAttribute('data-logical-cards','8192',{timeout:120000});
    expect(Number(await canvas.getAttribute('data-detailed-cards'))).toBeLessThanOrEqual(24);
    expect(Number(await canvas.getAttribute('data-visible-cards'))).toBe(8192);
    await page.screenshot({path:'output/playwright/original-cards-large-overview.png'});
    const target=await readTileClientRectAtGrid(page,45,45);
    await page.mouse.click(target.left+target.width/2,target.top+target.height/2);
    await expect.poll(()=>page.evaluate(async()=>{
        const {useAppStore}=await import('/src/renderer/store/useAppStore.ts');const board=useAppStore.getState().run!.board!;
        return board.flippedTileIds.includes(board.tiles[44*board.columns+44]!.id);
    }),{timeout:45000}).toBe(true);
    const box=await canvas.boundingBox();
    await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);
    await page.mouse.wheel(0,-2200);
    await expect.poll(async()=>Number(await canvas.getAttribute('data-detailed-cards')),{timeout:30000}).toBeGreaterThan(0);
    await expect.poll(async()=>Number(await canvas.getAttribute('data-visible-cards')),{timeout:30000}).toBeLessThan(400);
    await page.screenshot({path:'output/playwright/original-cards-large-zoom.png'});
    const before=await page.getByTestId('tile-board-frame').getAttribute('data-board-pan-x');
    await page.mouse.down({button:'middle'});
    await page.mouse.move(box!.x+box!.width/2+80,box!.y+box!.height/2,{steps:2});
    await page.mouse.up({button:'middle'});
    await expect(page.getByTestId('tile-board-frame')).not.toHaveAttribute('data-board-pan-x',before!);
    expect(errors).toEqual([]);
});
