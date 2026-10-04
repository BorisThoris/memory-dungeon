import { describe, expect, it } from 'vitest';
import { GOD_PERK_IDS, godBuildEffects, godBuildSynergies, rollGodPerks } from './god-run-perks';
import { buyGodPerk, castGodMeteor, createGodRun, flipGodCard, matchGodPair, missGodPair, startNextGodWave, tickGodRun, type GodRun } from './god-run-engine';
import { GOD_BUILD_FAMILIES, simulateGodRun } from './god-run-simulation';
import { fieldPairAlive } from './card-field';
import { createNewRun } from './game';
import { finalizeLevel } from './floor-clear-transition';

describe('endless constellation rules', () => {
    it('offers three distinct seeded perks with an engine; choices vary across stops', () => {
        const seen = new Set<string>();
        for (let seed=0;seed<100;seed++) {
            const offers=rollGodPerks(seed,3,0); expect(offers).toEqual(rollGodPerks(seed,3,0));
            expect(new Set(offers).size).toBe(3); expect(['archive_swarm','focused_memory','comet_core']).toContain(offers[0]);
            offers.forEach(id=>seen.add(id));
        }
        expect(seen.size).toBe(GOD_PERK_IDS.length);
    });
    it('applies meaningful tradeoffs and combos, with ranks beyond three', () => {
        const base=godBuildEffects({});
        expect(godBuildEffects({archive_swarm:4}).chargePerMatch).toBeLessThan(base.chargePerMatch);
        expect(godBuildEffects({glass_mind:9}).missCapacity).toBe(1);
        expect(godBuildEffects({focused_memory:5}).manualPower).toBeGreaterThan(godBuildEffects({focused_memory:3}).manualPower);
        expect(godBuildEffects({archive_swarm:2,focused_memory:1}).overdriveMultiplier).toBeGreaterThan(1);
        expect(godBuildEffects({comet_core:1,midas_ash:1}).burstGoldMultiplier).toBe(2.5);
        expect(godBuildEffects({replicator:3}).populationExtraExponent).toBe(2);
        expect(godBuildSynergies({comet_core:1,static_lattice:1,orbital_echo:1})).toHaveLength(2);
    });
    it('charges once per camp and preserves exact big integer currency', () => {
        const run={...createGodRun(4,'9007199254740993123456789'),offers:['focused_memory' as const]};
        const bought=buyGodPerk(run,'focused_memory');
        expect(bought.gold).toBe('9007199254740993123456781');
        expect(buyGodPerk(bought,'focused_memory')).toBe(bought);
        expect(buyGodPerk({...run,gold:'0'},'focused_memory').gold).toBe('0');
    });
    it('only permits living, distinct hand cards after study and resolves a real pair', () => {
        let run=startNextGodWave(createGodRun(5));
        expect(flipGodCard(run,0)).toBe(run);
        while(run.studyRemainingMs) run=tickGodRun(run,250);
        const pair=run.hand[0]!, other=run.hand.findIndex((p,i)=>i>0&&p===pair);
        run=flipGodCard(run,0); expect(flipGodCard(run,0)).toBe(run);
        run=flipGodCard(run,other); const before=run.field.livePairs;
        for(let i=0;i<3;i++) run=tickGodRun(run,250);
        expect(fieldPairAlive(run.field,pair)).toBe(false); expect(run.field.livePairs).toBeLessThan(before);
        expect(run.combo).toBe(1); expect(run.charge).toBeGreaterThan(0);
        expect(matchGodPair(run,pair)).toBe(run);
    });
    it('pauses without catch-up, bounds effects and refuses empty meteor rewards', () => {
        let run=startNextGodWave({...createGodRun(7),perks:{comet_core:1,archive_swarm:1}});
        expect(tickGodRun(run,1000,false)).toBe(run);
        expect(tickGodRun(run,100000).clockMs-run.clockMs).toBe(250);
        run={...run,studyRemainingMs:0,charge:1000};
        const hit=castGodMeteor(run,2,2); expect(hit.field.livePairs).toBeLessThan(run.field.livePairs);
        expect(castGodMeteor(hit,2,2)).toBe(hit);
        for(let i=0;i<400;i++) run=tickGodRun(run,250);
        expect(run.effects.length).toBeLessThanOrEqual(8);
    });
    it('mismatches spend misses, lose greed gold and end the run after its bank is exhausted', () => {
        let run: GodRun={...startNextGodWave(createGodRun(9,1000)),studyRemainingMs:0,perks:{greed_contract:2},misses:1};
        run=missGodPair(run); expect(run.misses).toBe(0); expect(BigInt(run.gold)).toBeLessThan(1000n);
        expect(missGodPair(run).phase).toBe('failed');
    });
    for(const [family,priorities] of Object.entries(GOD_BUILD_FAMILIES)) it(`${family} reaches actual million-card fields through purchases and real hand play`, () => {
        const result=simulateGodRun(41,priorities,16);
        expect(result.run.wave).toBe(16); expect(result.run.field.livePairs*2).toBeGreaterThanOrEqual(2_097_152);
        expect(result.purchases.length).toBeGreaterThanOrEqual(4);
        expect(BigInt(result.run.clearedCards)).toBeGreaterThan(1_000_000n);
        expect(result.run.manualMatches).toBeGreaterThan(0);
        expect(result.run.effects.length).toBeLessThanOrEqual(8);
        console.info(family,JSON.stringify({steps:result.steps,meteors:result.meteors,perks:result.run.perks,gold:result.run.gold,cards:result.run.field.livePairs*2}));
    },30000);
    it('enters the new forge after floor three only for current solo endless rules', () => {
        const run=createNewRun(0,{runSeed:42,gameMode:'endless'});
        const board={...run.board!,level:3};
        expect(finalizeLevel(run,board).godRun?.phase).toBe('camp');
        expect(finalizeLevel({...run,runRulesVersion:58},board).godRun).toBeUndefined();
        expect(finalizeLevel(run,{...board,level:2}).godRun).toBeUndefined();
    });
});
