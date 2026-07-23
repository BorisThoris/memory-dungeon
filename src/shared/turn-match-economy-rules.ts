import {
    FUSE_CACHE_EXPIRED_SHOP_GOLD_REWARD,
    FUSE_CACHE_FRESH_SHOP_GOLD_REWARD,
    TOLL_CACHE_SHOP_GOLD_REWARD,
    type DungeonCardKind,
    type DungeonKeyKind,
    type RunState
} from './contracts';
import { addRunDungeonKey } from './dungeon-key-rules';
import { runFiniteIntegerDelta, runNonNegativeInteger } from './run-number-guards';

export interface TurnMatchEconomyResult {
    shopGold: number;
    dungeonKeys: RunState['dungeonKeys'];
    dungeonMasterKeys: number;
}

export interface TurnMatchEconomyInput {
    run: RunState;
    routeCardShopGold: number;
    dungeonShopGold: number;
    dungeonKeysDelta: number;
    dungeonMasterKeysDelta: number;
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
    dungeonKeysDelta,
    dungeonMasterKeysDelta,
    tollCacheClaimed,
    fuseCacheClaimed,
    fuseCacheFresh,
    matchedDungeonKind,
    matchedDungeonKeyKind
}: TurnMatchEconomyInput): TurnMatchEconomyResult => ({
    shopGold:
        runNonNegativeInteger(run.shopGold) +
        runNonNegativeInteger(routeCardShopGold) +
        runNonNegativeInteger(dungeonShopGold) +
        (tollCacheClaimed ? TOLL_CACHE_SHOP_GOLD_REWARD : 0) +
        (fuseCacheClaimed
            ? fuseCacheFresh
                ? FUSE_CACHE_FRESH_SHOP_GOLD_REWARD
                : FUSE_CACHE_EXPIRED_SHOP_GOLD_REWARD
            : 0),
    dungeonKeys:
        runFiniteIntegerDelta(dungeonKeysDelta) !== 0 || matchedDungeonKind === 'key'
            ? addRunDungeonKey(run.dungeonKeys, matchedDungeonKeyKind, runFiniteIntegerDelta(dungeonKeysDelta))
            : run.dungeonKeys,
    dungeonMasterKeys: Math.max(0, runNonNegativeInteger(run.dungeonMasterKeys) + runFiniteIntegerDelta(dungeonMasterKeysDelta))
});
