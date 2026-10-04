import { describe, expect, it } from 'vitest';
import { getTileBoardCardWindow, DETAILED_CARD_BUDGET } from './tileBoardCardWindow';
import { makeBoard, makePair } from '../../shared/test/game-fixtures';
import { firstTileIdFromPickIntersections } from './tileBoardPointerPick';

describe('original card viewport working set', () => {
    const board = makeBoard(Array.from({length:4096},(_,index)=>makePair(String(index),String(index))).flat(),{columns:128,rows:64});
    it('keeps every real card in the distant overview with no fake population count',()=>{
        const result=getTileBoardCardWindow(board,false,{fitZoom:.04,zoom:1,panX:0,panY:0},{width:8,height:6},720);
        expect(result.visible).toHaveLength(8192); expect(result.detailed).toHaveLength(0);
        expect(new Set(result.distant).size).toBe(8192);
    });
    it('limits detailed cards while panning to a different real region',()=>{
        const view={fitZoom:.04,zoom:20,panX:0,panY:0};
        const first=getTileBoardCardWindow(board,false,view,{width:8,height:6},720);
        const panned=getTileBoardCardWindow(board,false,{...view,panX:-35},{width:8,height:6},720);
        expect(first.detailed.length).toBeLessThanOrEqual(DETAILED_CARD_BUDGET);
        expect(first.visible.length).toBeLessThan(220);
        expect(panned.visible).not.toEqual(first.visible);
        expect(panned.visible.every(index=>index%128>90)).toBe(true);
    });
    it('does not resurrect removed cards when they enter a new viewport',()=>{
        const cleared={...board,tiles:board.tiles.map(tile=>({...tile,state:'removed' as const}))};
        expect(getTileBoardCardWindow(cleared,false,{fitZoom:.04,zoom:20,panX:0,panY:0},{width:8,height:6},720).visible).toEqual([]);
    });
    it('picks the actual instanced card instead of a whole atlas page',()=>{
        expect(firstTileIdFromPickIntersections([{instanceId:1,object:{userData:{tileIds:['first','second']}}}])).toBe('second');
        expect(firstTileIdFromPickIntersections([{instanceId:3,object:{userData:{tileIds:['first','second']}}}])).toBeNull();
    });
});
