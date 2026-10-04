import { expect, it } from 'vitest';
import { createNewRun } from './game';
import { applyGodRunCommand } from './god-run-adapter';
import { createGodRun, flipGodCard, startNextGodWave, tickGodRun } from './god-run-engine';
import { createValidatedGameOverRunSummary } from './run-summary-rules';
import type { RunState } from './contracts';

it('records real depth and manual misses through the ordinary terminal summary',()=>{
    let god=startNextGodWave(createGodRun(42));
    while(god.studyRemainingMs)god=tickGodRun(god,250);
    const other=god.hand.findIndex(pair=>pair!==god.hand[0]);
    god=flipGodCard(flipGodCard({...god,misses:0},0),other);
    let run:RunState={...createNewRun(0,{runSeed:42}),status:'playing',godRun:god};
    for(let i=0;i<3;i++)run=applyGodRunCommand(run,{type:'tick',ms:250});
    expect(run.status).toBe('gameOver');expect(run.runEndReason).toBe('miss_budget');
    expect(run.stats.highestLevel).toBe(4);expect(run.stats.levelsCleared).toBe(3);expect(run.stats.mismatches).toBe(1);
    expect(run.stats.matchesFound).toBe(0);
    expect(createValidatedGameOverRunSummary(run,[]).lastRunSummary).toMatchObject({highestLevel:4,levelsCleared:3,runEndReason:'miss_budget'});
    expect(applyGodRunCommand(run,{type:'tick',ms:250})).toBe(run);
});
it('does not advance a paused run or count automated harvesting as remembered matches',()=>{
    const god={...startNextGodWave({...createGodRun(42),perks:{archive_swarm:1}}),studyRemainingMs:0};
    const run:RunState={...createNewRun(0,{runSeed:42}),status:'playing',godRun:god};
    const paused={...run,status:'paused' as const};expect(applyGodRunCommand(paused,{type:'tick',ms:250})).toBe(paused);
    let next=run;for(let i=0;i<8;i++)next=applyGodRunCommand(next,{type:'tick',ms:250});
    expect(next.godRun!.field.livePairs).toBeLessThan(god.field.livePairs);expect(next.stats.matchesFound).toBe(run.stats.matchesFound);
});
