import { expect, test } from '@playwright/test';
import { buildVisualSaveJson, gotoWithSaveAndQuery } from './visualScreenHelpers';
import AxeBuilder from '@axe-core/playwright';

test.use({headless:true,hasTouch:true,launchOptions:{args:['--mute-audio']}});
test('endless forge, real hand, million-card renderer, phone layouts and checkpoint resume',async({page})=>{
    test.setTimeout(600_000);
    const errors:string[]=[]; page.on('pageerror',error=>errors.push(error.message));
    await gotoWithSaveAndQuery(page,buildVisualSaveJson(true,false),'');
    await page.evaluate(async()=>{
        const {useAppStore}=await import('/src/renderer/store/useAppStore.ts');
        const {createNewRun,finishMemorizePhase,flipTile,resolveBoardTurn,advanceToNextLevel}=await import('/src/shared/game.ts');
        let run=createNewRun(0,{runSeed:41,gameMode:'endless'});
        for(let level=1;level<=3;level++){
            run=finishMemorizePhase(run);
            for(let guard=0;guard<80 && run.status==='playing';guard++){
                const tiles=run.board!.tiles.filter(t=>t.state!=='matched'&&t.state!=='removed');
                const a=tiles[0]!,b=tiles.find(t=>t.id!==a.id&&t.pairKey===a.pairKey)!;
                run=resolveBoardTurn(flipTile(flipTile(run,a.id),b.id));
            }
            if(run.status!=='levelComplete')throw new Error(`Opening floor ${level} did not clear`);
            if(level<3)run=advanceToNextLevel(run);
        }
        if(!run.godRun)throw new Error('Normal endless run did not reach forge');
        useAppStore.setState({run,view:'playing'});
    });
    await expect(page.getByRole('heading',{name:'The constellation forge'})).toBeVisible({timeout:90_000});
    const violations=(await new AxeBuilder({page}).include('[data-god-run]').analyze()).violations.filter(v=>v.impact==='serious'||v.impact==='critical');
    expect(violations).toEqual([]);
    for(const [name,width,height] of [['desktop',1280,800],['phone',390,844],['small-phone',320,568],['landscape',812,375]] as const){
        await page.setViewportSize({width,height});
        const geometry=await page.locator('[data-god-run]').evaluate(async root=>{
            const result=[];
            for(const button of root.querySelectorAll<HTMLButtonElement>('[data-perk] button')){
                button.scrollIntoView({block:'center'});await new Promise<void>(r=>requestAnimationFrame(()=>r()));
                const b=button.getBoundingClientRect();result.push({width:b.width,height:b.height,visible:b.top>=0&&b.bottom<=innerHeight&&b.left>=0&&b.right<=innerWidth});
            }
            root.scrollTo(0,0);return {buttons:result,overflow:root.scrollWidth>root.clientWidth+1};
        });
        expect(geometry.overflow).toBe(false);for(const b of geometry.buttons){expect(b.visible).toBe(true);expect(b.height).toBeGreaterThanOrEqual(44);}
        await page.screenshot({path:`output/playwright/god-forge-${name}.png`});
    }
    await page.setViewportSize({width:1280,height:800});
    await page.locator('[data-perk] button:enabled').first().click();
    await expect(page.getByText('Choice made',{exact:true})).toHaveCount(3);
    await page.getByRole('button',{name:'Enter wave 1'}).click();
    await expect(page.locator('canvas[data-renderer="webgl2"]')).toBeVisible({timeout:30_000});
    await page.waitForFunction(async()=> (await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().run!.godRun!.studyRemainingMs===0);
    const indices=await page.evaluate(async()=>{const g=(await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().run!.godRun!;return [0,g.hand.findIndex((p,i)=>i>0&&p===g.hand[0])];});
    await page.locator(`[data-card-index="${indices[0]}"]`).click();await page.locator(`[data-card-index="${indices[1]}"]`).click();
    await expect.poll(()=>page.evaluate(async()=>(await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().run!.godRun!.manualMatches)).toBeGreaterThan(0);
    const simulation=await page.evaluate(async()=>{
        const {useAppStore}=await import('/src/renderer/store/useAppStore.ts');
        const {simulateGodRun,GOD_BUILD_FAMILIES}=await import('/src/shared/god-run-simulation.ts');
        const result=simulateGodRun(41,GOD_BUILD_FAMILIES.comet!,16);
        useAppStore.setState(s=>({run:{...s.run!,status:'playing',godRun:result.run}}));
        return {cards:result.run.field.livePairs*2,steps:result.steps};
    });
    expect(simulation.cards).toBe(2_097_152);
    await page.getByRole('button',{name:'Pause',exact:true}).click();
    const clock=await page.evaluate(async()=>(await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().run!.godRun!.clockMs);
    await page.waitForTimeout(500);
    expect(await page.evaluate(async()=>(await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().run!.godRun!.clockMs)).toBe(clock);
    await page.getByRole('button',{name:'Keep playing'}).click();
    const budget=await page.locator('canvas[data-renderer]').evaluate(node=>({renderer:(node as HTMLElement).dataset.renderer,draws:(node as HTMLElement).dataset.drawCalls,triangles:(node as HTMLElement).dataset.triangles,dom:document.querySelectorAll('[data-god-run] *').length}));
    expect(budget).toMatchObject({renderer:'webgl2',draws:'1',triangles:'2'});expect(budget.dom).toBeLessThan(180);
    for(const [name,width,height] of [['desktop',1280,800],['phone',390,844],['small-phone',320,568],['landscape',812,375]] as const){
        await page.setViewportSize({width,height});
        await page.locator('[data-god-run]').evaluate(root=>root.scrollTo(0,0));
        await page.screenshot({path:`output/playwright/god-million-${name}.png`});
        expect(await page.locator('[data-god-run]').evaluate(root=>root.scrollWidth<=root.clientWidth+1)).toBe(true);
    }
    await page.getByRole('button',{name:'Zoom in',exact:true}).click();
    await expect(page.getByText('DETAIL ×2',{exact:true})).toBeVisible();
    await page.evaluate(async()=>{
        const {useAppStore}=await import('/src/renderer/store/useAppStore.ts');
        const {tickGodRun,canCastGodMeteor,flipGodCard}=await import('/src/shared/god-run-engine.ts');
        const {fieldPairAlive}=await import('/src/shared/card-field.ts');
        const run=useAppStore.getState().run!;let g=run.godRun!;
        for(let i=0;i<1000&&!canCastGodMeteor(g);i++){
            if(g.phase==='active'&&g.studyRemainingMs===0&&g.resolveAtMs===0){const a=g.hand.findIndex(p=>fieldPairAlive(g.field,p));const b=g.hand.findIndex((p,j)=>j!==a&&p===g.hand[a]);g=flipGodCard(flipGodCard(g,a),b);}
            g=tickGodRun(g,250);
        }
        if(!canCastGodMeteor(g))throw new Error('Could not charge meteor through real matches');
        useAppStore.setState({run:{...run,godRun:g}});
    });
    await page.getByRole('button',{name:'Aim at survivors'}).click();
    const before=await page.evaluate(async()=>(await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().run!.godRun!.clearedCards);
    await page.getByRole('button',{name:'Call meteor'}).click();
    expect(BigInt(await page.evaluate(async()=>(await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().run!.godRun!.clearedCards))).toBeGreaterThan(BigInt(before));
    await page.screenshot({path:'output/playwright/god-meteor.png'});
    await page.getByRole('button',{name:'Save & leave'}).click();
    await page.getByRole('button',{name:'Save and return to menu'}).click();
    await expect(page.getByRole('button',{name:/Resume constellation/})).toBeVisible({timeout:30_000});
    await page.getByRole('button',{name:/Resume constellation/}).click();
    await expect(page.locator('[data-god-run]')).toBeVisible();
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('button',{name:'Zoom in',exact:true}).tap();
    await expect(page.getByText('DETAIL ×2',{exact:true})).toBeVisible();
    const cards=await page.locator('[data-god-run]').evaluate(root=>Array.from(root.querySelectorAll('[data-card-index]'),node=>{const r=node.getBoundingClientRect();return {w:r.width,h:r.height};}));
    for(const card of cards){expect(card.w).toBeGreaterThanOrEqual(44);expect(card.h).toBeGreaterThanOrEqual(44);}
    await page.locator('canvas').evaluate(node=>(node as HTMLCanvasElement).getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext());
    await expect(page.locator('canvas[data-renderer="canvas2d"]')).toBeVisible();
    await page.screenshot({path:'output/playwright/god-fallback-phone.png'});
    await page.evaluate(async()=>{
        const {useAppStore}=await import('/src/renderer/store/useAppStore.ts');
        const {missGodPair,tickGodRun,flipGodCard}=await import('/src/shared/god-run-engine.ts');
        const run=useAppStore.getState().run!;let g=run.godRun!;
        while(g.studyRemainingMs)g=tickGodRun(g,250);
        while(g.misses>0)g=missGodPair(g);
        const a=g.hand.findIndex(p=>((g.field.aliveWords[p>>>5]??0)&(1<<(p&31)))!==0);
        const b=g.hand.findIndex(p=>p!==g.hand[a]&&((g.field.aliveWords[p>>>5]??0)&(1<<(p&31)))!==0);
        if(a<0||b<0)throw new Error('No mismatch pair in late hand');
        g=flipGodCard(flipGodCard({...g,flipped:[],resolveAtMs:0},a),b);
        useAppStore.setState({run:{...run,godRun:g}});
        for(let i=0;i<3;i++)useAppStore.getState().godCommand({type:'tick',ms:250});
    });
    await expect(page.getByRole('heading',{name:'A run worth remembering.'})).toBeVisible();
    expect(await page.evaluate(async()=>(await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().saveData.lastRunSummary?.highestLevel)).toBeGreaterThanOrEqual(19);
    await page.getByRole('button',{name:'Start a new run'}).click();
    await expect.poll(()=>page.evaluate(async()=>{const r=(await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().run!;return {level:r.board?.level,perks:!!r.godRun};})).toEqual({level:1,perks:false});
    expect(errors).toEqual([]);
});
