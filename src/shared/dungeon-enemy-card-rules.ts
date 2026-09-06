import type { BoardState, Tile } from './contracts';
import { DUNGEON_ENEMY_DEFEAT_SCORE } from './dungeon-match-reward-rules';
import { runNonNegativeInteger } from './run-number-guards';

export const clearDungeonCardFields = (tile: Tile): Tile => ({
    ...tile,
    dungeonCardKind: undefined,
    dungeonBossId: undefined,
    dungeonCardState: undefined,
    dungeonCardEffectId: undefined,
    dungeonCardHp: undefined,
    dungeonCardMaxHp: undefined,
    dungeonRouteType: undefined,
    lanternScouted: undefined,
    scoutRevealSource: undefined
});

export const activeDungeonEnemyPairKeys = (board: BoardState): string[] => [
    ...new Set(
        board.tiles
            .filter(
                (tile) =>
                    tile.dungeonCardKind === 'enemy' &&
                    tile.dungeonCardState === 'revealed' &&
                    tile.state !== 'matched' &&
                    tile.state !== 'removed' &&
                    runNonNegativeInteger(tile.dungeonCardHp) > 0
            )
            .map((tile) => tile.pairKey)
    )
];

/** Damages one enemy pair by key: the chunk break hits the enemy it broke over, not the first one. */
export const damageDungeonEnemyPair = (
    board: BoardState,
    pairKey: string,
    amount: number
): { board: BoardState; defeated: number; score: number } => {
    const damage = runNonNegativeInteger(amount);
    if (damage <= 0 || !activeDungeonEnemyPairKeys(board).includes(pairKey)) {
        return { board, defeated: 0, score: 0 };
    }
    const currentHp = runNonNegativeInteger(
        board.tiles.find((tile) => tile.pairKey === pairKey && tile.dungeonCardKind === 'enemy')?.dungeonCardHp
    );
    if (currentHp <= 0) {
        return { board, defeated: 0, score: 0 };
    }
    const nextHp = Math.max(0, currentHp - damage);
    const defeated = currentHp > 0 && nextHp === 0 ? 1 : 0;
    return {
        board: {
            ...board,
            matchedPairs: defeated ? Math.min(board.pairCount, board.matchedPairs + 1) : board.matchedPairs,
            tiles: board.tiles.map((tile) =>
                tile.pairKey === pairKey && tile.dungeonCardKind === 'enemy'
                    ? defeated
                        ? clearDungeonCardFields({
                              ...tile,
                              state: 'removed',
                              dungeonCardHp: nextHp,
                              dungeonCardState: 'resolved'
                          })
                        : {
                              ...tile,
                              dungeonCardHp: nextHp,
                              dungeonCardState: 'revealed'
                          }
                    : tile
            )
        },
        defeated,
        score: defeated ? DUNGEON_ENEMY_DEFEAT_SCORE : 0
    };
};

export const damageFirstActiveDungeonEnemy = (
    board: BoardState,
    amount: number
): { board: BoardState; defeated: number; score: number } => {
    const pairKey = activeDungeonEnemyPairKeys(board)[0];
    return pairKey ? damageDungeonEnemyPair(board, pairKey, amount) : { board, defeated: 0, score: 0 };
};

export const applyDungeonEnemyAttack = (
    lives: number,
    guardTokens: number,
    activeBoard: BoardState
): { lives: number; guardTokens: number; attacked: boolean } => {
    if (activeDungeonEnemyPairKeys(activeBoard).length === 0) {
        return { lives, guardTokens, attacked: false };
    }
    if (guardTokens > 0) {
        return { lives, guardTokens: guardTokens - 1, attacked: true };
    }
    return { lives: lives - 1, guardTokens, attacked: true };
};

export const revealOneHiddenDungeonHazardPair = (tiles: readonly Tile[]): Set<string> => {
    const target = tiles.find(
        (tile) =>
            (tile.dungeonCardKind === 'enemy' || tile.dungeonCardKind === 'trap') &&
            tile.dungeonCardState === 'hidden' &&
            tile.state !== 'matched' &&
            tile.state !== 'removed'
    );
    if (!target) {
        return new Set();
    }
    return new Set(
        tiles
            .filter(
                (tile) =>
                    tile.pairKey === target.pairKey &&
                    tile.dungeonCardKind === target.dungeonCardKind &&
                    tile.dungeonCardState === 'hidden'
            )
            .map((tile) => tile.id)
    );
};
