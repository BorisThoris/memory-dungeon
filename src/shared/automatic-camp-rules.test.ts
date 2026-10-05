import { describe, expect, it } from 'vitest';
import { createNewRun, advanceToNextLevel } from './game-core';
import { finalizeLevel } from './floor-clear-transition';
import { automaticCampReward } from './automatic-camp-rules';
import { relicRank } from './run-relic-rules';
import { missesLeft } from './miss-bank';
import { createPassAndPlayState } from './pass-and-play-rules';
import { getMemorizeDurationForRun } from './scoring-rules';
import { MIN_CURIO_MEMORIZE_MS, pickFloorCurio } from './floor-curio-rules';
import type { RunState } from './contracts';

const clearedCamp = (): RunState => {
    const run=createNewRun(0,{runSeed:17,gameMode:'endless'});
    const board={...run.board!,level:3,matchedPairs:run.board!.pairCount,
        tiles:run.board!.tiles.map(tile=>({...tile,state:'matched' as const}))};
    return {...finalizeLevel({...run,board},board),gold:20,missBank:[{floor:3,misses:4}]};
};
describe('automatic camp rewards',()=>{
    it('previews one affordable upgrade without mutating or spending the input',()=>{
        const run=clearedCamp();const before=structuredClone(run);
        const reward=automaticCampReward(run);
        expect(run).toEqual(before);
        expect(reward.run.gold).toBe(12);
        expect(relicRank(reward.run,'long_look')).toBe(1);
        expect(reward.receipt).toContain('Long Look 1/3');
        expect(automaticCampReward(run)).toEqual(reward);
    });
    it('applies the reward once through real floor advancement, including study time',()=>{
        const run=clearedCamp();const next=advanceToNextLevel(run);
        expect(next.board?.level).toBe(4);expect(next.status).toBe('memorize');
        expect(next.gold).toBe(12);expect(relicRank(next,'long_look')).toBe(1);
        const curio = pickFloorCurio(next.runSeed, 4, next.runRulesVersion);
        expect(next.timerState.memorizeRemainingMs).toBe(Math.max(MIN_CURIO_MEMORIZE_MS,
            getMemorizeDurationForRun(next, 4) + curio.effect.memorizeBonusMs));
        expect(advanceToNextLevel(next)).toBe(next);
        expect(automaticCampReward(next).run).toBe(next);
    });
    it('rescues a nearly empty bank before buying an upgrade',()=>{
        const run={...clearedCamp(),missBank:[{floor:3,misses:1}]};
        const reward=automaticCampReward(run);
        expect(missesLeft(reward.run)).toBe(2);expect(reward.run.gold).toBe(16);
        expect(reward.run.relics).toEqual(run.relics);
        expect(reward.receipt).toContain('Another miss');
    });
    it('chooses an affordable upgrade and saves gold if nothing is needed or affordable',()=>{
        const run={...clearedCamp(),gold:6};
        expect(relicRank(automaticCampReward(run).run,'gilded_chain')).toBe(1);
        const poor={...run,gold:2};expect(automaticCampReward(poor).run).toBe(poor);
        expect(automaticCampReward(poor).receipt).toContain('saved');
    });
    it('does not alter older shared-run rules, active floors, or ordinary clears',()=>{
        const run=clearedCamp();
        for(const other of [{...run,runRulesVersion:60},{...run,passAndPlay:createPassAndPlayState(2)},{...run,status:'playing' as const},
            {...run,board:{...run.board!,level:2}}]) {
            expect(automaticCampReward(other)).toEqual({run:other,receipt:null});
        }
    });
});
