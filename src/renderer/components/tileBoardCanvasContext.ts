import type { BoardScreenSpaceAA } from '../../shared/contracts';

type ResolvedBoardScreenSpaceAA = Exclude<BoardScreenSpaceAA, 'auto'>;

export type TileBoardCanvasContextConfig = {
    antialias: boolean;
    key: string;
};

/**
 * Canvas context attributes are immutable after creation. Only key the Canvas by
 * the native AA flag, not by equivalent saved modes that share that flag.
 */
export const getTileBoardCanvasContextConfig = (
    resolvedAa: ResolvedBoardScreenSpaceAA,
    recoveryRevision: number
): TileBoardCanvasContextConfig => {
    const antialias = resolvedAa !== 'off';

    return {
        antialias,
        key: `tile-board-${recoveryRevision}-native-aa-${antialias ? 'on' : 'off'}`
    };
};
