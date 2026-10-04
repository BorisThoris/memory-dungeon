import type { BoardState } from '../../shared/contracts';
import type { TileBoardViewportState } from './tileBoardViewport';
import { getTileColumnSpacing, TILE_SPACING } from './tileShatter';

export const DETAILED_CARD_BUDGET = 24;
const ORIGINAL_BOARD_LIMIT = 48;
export interface CardWindow { detailed: number[]; distant: number[]; visible: number[] }

/** Grid arithmetic visits only the viewport plus two cells of overscan, preserving global indices. */
export function getTileBoardCardWindow(board: BoardState, compact: boolean, view: TileBoardViewportState,
    viewport: { width: number; height: number }, pixelHeight: number): CardWindow {
    if (board.tiles.length <= ORIGINAL_BOARD_LIMIT) {
        const visible = board.tiles.map((_, index) => index);
        return { detailed: visible, distant: [], visible };
    }
    const scale = Math.max(.000001, view.fitZoom * view.zoom);
    const spacing = getTileColumnSpacing(compact);
    const centerX = -view.panX / scale, centerY = -view.panY / scale;
    const halfWidth = viewport.width / scale / 2, halfHeight = viewport.height / scale / 2;
    const minCol = Math.max(0, Math.floor((centerX-halfWidth)/spacing+(board.columns-1)/2)-2);
    const maxCol = Math.min(board.columns-1, Math.ceil((centerX+halfWidth)/spacing+(board.columns-1)/2)+2);
    const minRow = Math.max(0, Math.floor((board.rows-1)/2-(centerY+halfHeight)/TILE_SPACING)-2);
    const maxRow = Math.min(board.rows-1, Math.ceil((board.rows-1)/2-(centerY-halfHeight)/TILE_SPACING)+2);
    const visible: number[] = [];
    for (let row=minRow; row<=maxRow; row++) for (let col=minCol; col<=maxCol; col++) {
        const index=row*board.columns+col;
        const tile=board.tiles[index];
        if (tile && tile.state!=='removed' && tile.state!=='matched') visible.push(index);
    }
    const cardPixels = scale * pixelHeight / Math.max(.01, viewport.height);
    const candidates = cardPixels < 45 ? visible.filter(index => board.tiles[index]!.state === 'flipped') : visible;
    const detailed = [...candidates].sort((a,b)=>{
        const distance=(index:number)=>{
            const tile=board.tiles[index]!;
            if (tile.state==='flipped') return -1;
            return Math.hypot((index%board.columns-(board.columns-1)/2)*spacing-centerX,
                ((board.rows-1)/2-Math.floor(index/board.columns))*TILE_SPACING-centerY);
        };
        return distance(a)-distance(b);
    }).slice(0,DETAILED_CARD_BUDGET);
    const near=new Set(detailed);
    return { detailed, distant:visible.filter(index=>!near.has(index)), visible };
}
