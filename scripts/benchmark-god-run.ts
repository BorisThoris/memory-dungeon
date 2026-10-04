import { performance } from 'node:perf_hooks';
import { clearFieldBudget, clearFieldCircle, createCardField } from '../src/shared/card-field';
import { GOD_BUILD_FAMILIES, simulateGodRun } from '../src/shared/god-run-simulation';

for (const exponent of [21,24,26]) {
    const start=performance.now(), field=createCardField(exponent,41), created=performance.now();
    const meteor=clearFieldCircle(field,field.columns*.65,field.rows*.55,field.rows*.18), impacted=performance.now();
    const auto=clearFieldBudget(meteor.field,Math.floor(field.pairCapacity*.1),2), automated=performance.now();
    const rest=clearFieldBudget(auto.field,Infinity,3), finished=performance.now();
    if(rest.field.livePairs!==0 || meteor.removedPairs+auto.removedPairs+rest.removedPairs!==field.pairCapacity) throw new Error('Clear accounting mismatch');
    console.log(JSON.stringify({cards:2**exponent,words:field.aliveWords.length,conservativeLiveBytes:field.aliveWords.length*8,gpuBytes:field.aliveWords.length*4,createMs:created-start,meteorMs:impacted-created,autoMs:automated-impacted,fullClearMs:finished-automated,meteorPairs:meteor.removedPairs,meteorCellVisits:meteor.visitedCells}));
}
for (const [family, priorities] of Object.entries(GOD_BUILD_FAMILIES)) {
    const start=performance.now(), result=simulateGodRun(41,priorities,22);
    console.log(JSON.stringify({family,ms:performance.now()-start,wave:result.run.wave,cards:result.run.field.livePairs*2,steps:result.steps,meteors:result.meteors,perks:result.run.perks,gold:result.run.gold,cleared:result.run.clearedCards}));
}
