import { describe, expect, it } from 'vitest';
import { callMeteor, canAimMeteor } from './meteor-rules';
import { makeBoard, makePair, makeRun, playPair } from './test/game-fixtures';
import { buildBoard } from './board-build-rules';
import { advanceToNextLevel } from './next-floor-transition-rules';
import { finalizeLevel } from './floor-clear-transition';
import { createGameplayMeteorCommand } from './gameplay-core-contracts';
import { reduceGameplayCommand } from './gameplay-core';

describe('stored, player-called meteors on the original cards',()=>{
    const tiles=()=>Array.from({length:12},(_,i)=>makePair(String(i),String(i))).flat();
    it('replays a validated target command deterministically and emits player feedback',()=>{
        const run=makeRun(tiles(),{meteorCharges:1});
        const command=createGameplayMeteorCommand('meteor-replay','3-a');
        const result=reduceGameplayCommand(run,command);
        expect(result.accepted).toBe(true);
        expect(result).toEqual(reduceGameplayCommand(structuredClone(run),structuredClone(command)));
        expect(result.events).toEqual(expect.arrayContaining([expect.objectContaining({type:'feedback.requested',cue:'power.meteor.used'})]));
    });
    it('collects a meteor pickup into inventory without firing it',()=>{
        const cards=tiles().map(tile=>tile.pairKey==='0'?{...tile,findableKind:'meteor_shard' as const}:tile);
        const before=makeRun(cards);
        const next=playPair(before,'0-a','0-b');
        expect(next.meteorCharges).toBe(1);
        expect(next.meteorArmed).not.toBe(true);
        expect(next.board?.meteorImpact).toBeUndefined();
    });
    it('refuses empty inventory, inactive phases and invalid targets without spending',()=>{
        const run=makeRun(tiles(),{meteorCharges:1});
        expect(callMeteor({...run,meteorCharges:0},'0-a').meteorCharges).toBe(0);
        const paused={...run,status:'paused' as const};expect(callMeteor(paused,'0-a')).toBe(paused);
        expect(callMeteor(run,'missing')).toBe(run);
        expect(canAimMeteor({...run,status:'resolving'})).toBe(false);
    });
    it('spends one charge, clears an area and all partners, preserving every surviving pair',()=>{
        const run=makeRun(tiles(),{meteorCharges:3,meteorArmed:true});
        run.board=makeBoard(run.board!.tiles,{columns:6,rows:4});
        const next=callMeteor(run,'4-a');
        expect(next.meteorCharges).toBe(2);expect(next.meteorArmed).toBe(false);
        expect(next.board!.meteorImpact?.cards).toBeGreaterThan(2);
        expect(next.stats.matchesFound).toBe(run.stats.matchesFound);
        expect(next.powersUsedThisRun).toBe(true);
        for(const pair of new Set(next.board!.tiles.map(t=>t.pairKey))) {
            const states=next.board!.tiles.filter(t=>t.pairKey===pair).map(t=>t.state);
            expect(states[0]).toBe(states[1]);
        }
        expect(run.board!.tiles.every(t=>t.state==='hidden')).toBe(true);
    });
    it('can clear the last cards through the normal floor-clear transition without refunding shards',()=>{
        const cards=makePair('a','A').map(t=>({...t,findableKind:'meteor_shard' as const}));
        const run=makeRun(cards,{meteorCharges:1});
        const next=callMeteor(run,'a-a');
        expect(next.status).toBe('levelComplete');expect(next.meteorCharges).toBe(0);
        expect(next.lastLevelResult?.level).toBe(1);expect(next.board?.tiles).toHaveLength(2);
        expect(callMeteor(next,'a-a')).toBe(next);
    });
    it('uses original cards after floor three and carries unused meteors between floors',()=>{
        const run=makeRun(tiles(),{meteorCharges:2,meteorArmed:true});
        const cleared=finalizeLevel(run,{...run.board!,level:3});
        const next=advanceToNextLevel(cleared);
        expect(next.board?.level).toBe(4);expect(next.meteorCharges).toBe(2);expect(next.meteorArmed).toBe(false);
        expect('godRun' in next).toBe(false);expect(next.board?.tiles.length).toBeGreaterThan(0);
    });
    it('spawns shards on current boards and preserves the historical pickup kind',()=>{
        let shards=0;
        for(let seed=0;seed<40;seed++) {
            shards+=buildBoard(7,{runSeed:seed,runRulesVersion:60}).tiles.filter(t=>t.findableKind==='meteor_shard').length;
            expect(buildBoard(7,{runSeed:seed,runRulesVersion:58}).tiles.some(t=>t.findableKind==='meteor_shard')).toBe(false);
        }
        expect(shards).toBeGreaterThan(0);
    });
});
