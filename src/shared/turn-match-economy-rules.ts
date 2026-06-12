import {
    FUSE_CACHE_EXPIRED_SHOP_GOLD_REWARD,
    FUSE_CACHE_FRESH_SHOP_GOLD_REWARD,
    TOLL_CACHE_SHOP_GOLD_REWARD,
    type DungeonCardKind,
    type DungeonKeyKind,
    type RunState
} from './contracts';
import { addRunDungeonKey } from './dungeon-key-rules';

export interface TurnMatchEconomyResult {
    shopGold: number;
    dungeonKeys: RunState['dungeonKeys'];
}

export interface TurnMatchEconomyInput {
    run: RunState;
    routeCardShopGold: number;
    dungeonShopGold: number;
    tollCacheClaimed: boolean;
    fuseCacheClaimed: boolean;
    fuseCacheFresh: boolean;
    matchedDungeonKind: DungeonCardKind | null | undefined;
    matchedDungeonKeyKind: DungeonKeyKind;
}

export const resolveTurnMatchEconomy = ({
    run,
    routeCardShopGold,
    dungeonShopGold,
    tollCacheClaimed,
    fuseCacheClaimed,
    fuseCacheFresh,
    matchedDungeonKind,
    matchedDungeonKeyKind
}: TurnMatchEconomyInput): TurnMatchEconomyResult => ({
    shopGold:
        run.shopGold +
        routeCardShopGold +
        dungeonShopGold +
        (tollCacheClaimed ? TOLL_CACHE_SHOP_GOLD_REWARD : 0) +
        (fuseCacheClaimed
            ? fuseCacheFresh
                ? FUSE_CACHE_FRESH_SHOP_GOLD_REWARD
                : FUSE_CACHE_EXPIRED_SHOP_GOLD_REWARD
            : 0),
    dungeonKeys:
        matchedDungeonKind === 'key' ? addRunDungeonKey(run.dungeonKeys, matchedDungeonKeyKind, 1) : run.dungeonKeys
});
