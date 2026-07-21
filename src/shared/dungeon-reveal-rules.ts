import { type BoardState, type RunShopOfferState, type RunState, type Tile } from './contracts';
import { advanceEnemyHazardsOnBoard } from './dungeon-enemy-hazard-rules';
import { createRunShopOffers } from './shop-rules';
import { EXIT_PAIR_KEY, SHOP_PAIR_KEY } from './tile-identity';

const dungeonRevealShopOffers = (value: unknown): RunShopOfferState[] => Array.isArray(value) ? value : [];

export const revealDungeonExit = (run: RunState, tileId: string): RunState => {
    if (run.status !== 'playing' || !run.board) {
        return run;
    }
    const tile = run.board.tiles.find((candidate) => candidate.id === tileId);
    if (!tile || tile.pairKey !== EXIT_PAIR_KEY) {
        return run;
    }
    return {
        ...run,
        board: advanceEnemyHazardsOnBoard({
            ...run.board,
            tiles: run.board.tiles.map((candidate): Tile =>
                candidate.id === tileId
                    ? {
                          ...candidate,
                          state: candidate.state === 'hidden' ? 'flipped' : candidate.state,
                          dungeonCardState: 'revealed'
                      }
                    : candidate
            )
        })
    };
};

export const revealDungeonShop = (run: RunState, tileId: string): RunState => {
    if (run.status !== 'playing' || !run.board) {
        return run;
    }
    const tile = run.board.tiles.find((candidate) => candidate.id === tileId);
    if (!tile || tile.pairKey !== SHOP_PAIR_KEY) {
        return run;
    }
    const nextBoard: BoardState = advanceEnemyHazardsOnBoard({
        ...run.board,
        dungeonShopVisited: true,
        tiles: run.board.tiles.map((candidate): Tile =>
            candidate.id === tileId
                ? {
                      ...candidate,
                      state: candidate.state === 'hidden' ? 'flipped' : candidate.state,
                      dungeonCardState: 'resolved'
                  }
                : candidate
        )
    });
    const nextRun: RunState = {
        ...run,
        board: nextBoard,
        dungeonShopVisitedThisFloor: true
    };
    const existingShopOffers = dungeonRevealShopOffers(run.shopOffers);
    return {
        ...nextRun,
        shopOffers: existingShopOffers.length > 0 ? existingShopOffers : createRunShopOffers(nextRun)
    };
};
