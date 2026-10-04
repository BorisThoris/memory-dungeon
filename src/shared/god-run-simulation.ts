import { fieldPairAlive, findLiveFieldPair } from './card-field';
import { buyGodPerk, canCastGodMeteor, castGodMeteor, createGodRun, flipGodCard, godPerkPrice, godRerollPrice, rerollGodPerks, startNextGodWave, tickGodRun, type GodRun } from './god-run-engine';
import type { GodPerkId } from './god-run-perks';

export const GOD_BUILD_FAMILIES: Record<string, GodPerkId[]> = {
    comet: ['comet_core', 'orbital_echo', 'midas_ash', 'static_lattice', 'focused_memory', 'glass_mind'],
    archive: ['archive_swarm', 'overclock', 'replicator', 'static_lattice', 'deep_memory'],
    memory: ['focused_memory', 'living_roots', 'glass_mind', 'greed_contract', 'replicator']
};

/** Perfect-memory player, using the same hand, purchases, timers and wave transitions as the UI. */
export const simulateGodRun = (seed: number, priorities: readonly GodPerkId[], targetWave = 16): { run: GodRun; steps: number; meteors: number; purchases: GodPerkId[] } => {
    let run = createGodRun(seed, 24), steps = 0, meteors = 0;
    const purchases: GodPerkId[] = [];
    while (run.wave < targetWave && steps++ < 100_000) {
        if (run.phase === 'failed') throw new Error('Perfect-memory simulation failed');
        if (run.phase === 'camp') {
            let pick = priorities.find(id => run.offers.includes(id));
            if (!pick && BigInt(run.gold) >= godRerollPrice(run) * 3n) { run = rerollGodPerks(run); pick = priorities.find(id => run.offers.includes(id)); }
            pick ??= run.offers[0];
            if (pick && BigInt(run.gold) >= godPerkPrice(run,pick)) { run = buyGodPerk(run,pick); purchases.push(pick); }
            run = startNextGodWave(run); continue;
        }
        if (run.phase === 'active' && run.studyRemainingMs === 0 && run.resolveAtMs === 0) {
            const index = run.hand.findIndex(pair => fieldPairAlive(run.field,pair));
            if (index >= 0) {
                const other = run.hand.findIndex((pair,i) => i !== index && pair === run.hand[index]);
                run = flipGodCard(flipGodCard(run,index),other);
            }
        }
        if (canCastGodMeteor(run)) {
            const pair = findLiveFieldPair(run.field,run.nextEffectId)!;
            const next = castGodMeteor(run,pair % run.field.columns,Math.floor(pair/run.field.columns));
            if (next !== run) meteors++;
            run = next;
        }
        run = tickGodRun(run,250);
    }
    if (run.wave < targetWave) throw new Error(`Stalled at wave ${run.wave} (${run.field.livePairs} pairs)`);
    return { run, steps, meteors, purchases };
};
