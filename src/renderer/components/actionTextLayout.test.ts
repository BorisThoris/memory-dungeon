import { describe, expect, it } from 'vitest';
import { layoutActionText } from './actionTextLayout';
const measure=(text:string,size:number)=>text.length*size*0.6;
describe('action text fits the impact envelope',()=>{
    for(const [width,height] of [[296,300],[544,170],[820,420],[1400,700]]){
        it(`keeps long action names and receipts inside ${width}x${height}`,()=>{
            for(const title of ['BLAZING!','BACK FROM THE VOID','THE DUNGEON REMEMBERS','COMBO BROKEN']){
                const layout=layoutActionText(title,'Combo ×128 · a rare one',width!,height!,true,measure);
                expect(layout.titleLines.join(' ')).toBe(title);
                expect(layout.titleLines.length).toBeLessThanOrEqual(2);
                for(const line of layout.titleLines)expect(measure(line,layout.titleSize)).toBeLessThanOrEqual(width!*0.82);
                for(const line of layout.subtitleLines)expect(measure(line,layout.subtitleSize)).toBeLessThanOrEqual(width!*0.82);
            }
        });
    }
});
