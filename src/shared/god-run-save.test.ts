import { expect, it } from 'vitest';
import { restoreGodRun, serializeGodRun } from './god-run-save';
import { GOD_BUILD_FAMILIES, simulateGodRun } from './god-run-simulation';
import { flipGodCard, tickGodRun } from './god-run-engine';
it('round-trips a million-card build, currency, offers and pending hand resolution',()=>{
    let run=simulateGodRun(41,GOD_BUILD_FAMILIES.comet!,16).run;
    while(run.studyRemainingMs) run=tickGodRun(run,250);
    run=flipGodCard(run,0);
    const saved=JSON.parse(JSON.stringify(serializeGodRun(run)));
    const restored=restoreGodRun(saved)!;
    expect(restored).not.toBeNull();
    expect(restored.gold).toBe(run.gold); expect(restored.hand).toEqual(run.hand); expect(restored.flipped).toEqual([0]);
    expect(restored.field.aliveWords).toEqual(run.field.aliveWords);
    expect(tickGodRun(restored,250)).toEqual({...tickGodRun(run,250),field:{...tickGodRun(run,250).field,revision:0}});
});
it('rejects corrupted currency, ranks, pair mapping, hands and counter payloads',()=>{
    const saved=serializeGodRun(simulateGodRun(41,GOD_BUILD_FAMILIES.memory!,3).run);
    for(const patch of [{gold:'NaN'},{wave:Infinity},{perks:{unknown:1}},{perks:{focused_memory:-1}},{hand:[-1,-1]},{flipped:[30]},{misses:999}]) expect(restoreGodRun({...saved,state:{...saved.state,...patch}})).toBeNull();
    expect(restoreGodRun({...saved,state:{...saved.state,field:{...saved.state.field,aliveWords:[]}}})).toBeNull();
});
