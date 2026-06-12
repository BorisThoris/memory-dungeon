import type { Tile } from './contracts';
import { isSingletonUtilityPairKey } from './tile-identity';

const hiddenDungeonTargetIds = (tiles: readonly Tile[], sourceTileId: string): Set<string> => {
    const target = tiles.find(
        (candidate) =>
            candidate.id !== sourceTileId &&
            candidate.state === 'hidden' &&
            candidate.dungeonCardKind != null &&
            candidate.dungeonCardState === 'hidden'
    );
    if (!target) {
        return new Set();
    }
    if (isSingletonUtilityPairKey(target.pairKey)) {
        return new Set([target.id]);
    }
    return new Set(
        tiles
            .filter(
                (candidate) =>
                    candidate.pairKey === target.pairKey &&
                    candidate.dungeonCardKind === target.dungeonCardKind &&
                    candidate.dungeonCardState === 'hidden'
            )
            .map((candidate) => candidate.id)
    );
};

export const scryDungeonCardTiles = hiddenDungeonTargetIds;

export const revealFirstHiddenDungeonPair = hiddenDungeonTargetIds;

export const trapWorkshopTileUpdates = (tiles: readonly Tile[]): { ids: Set<string>; resolved: boolean } => {
    const armed = tiles.find((candidate) => candidate.dungeonCardKind === 'trap' && candidate.dungeonCardState === 'revealed');
    if (armed) {
        return {
            ids: new Set(tiles.filter((candidate) => candidate.pairKey === armed.pairKey).map((candidate) => candidate.id)),
            resolved: true
        };
    }
    const hidden = tiles.find((candidate) => candidate.dungeonCardKind === 'trap' && candidate.dungeonCardState === 'hidden');
    if (!hidden) {
        return { ids: new Set(), resolved: false };
    }
    return {
        ids: new Set(tiles.filter((candidate) => candidate.pairKey === hidden.pairKey).map((candidate) => candidate.id)),
        resolved: false
    };
};
