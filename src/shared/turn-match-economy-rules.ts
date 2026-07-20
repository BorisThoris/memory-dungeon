import {
    FUSE_CACHE_EXPIRED_SHOP_GOLD_REWARD,
    FUSE_CACHE_FRESH_SHOP_GOLD_REWARD,
    TOLL_CACHE_SHOP_GOLD_REWARD,
    type DungeonCardKind,
    type DungeonKeyKind,
    type RunState
} from './contracts';
import { addRunDungeonKey } from './dungeon-key-rules';

const nonNegativeEconomyCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const finiteEconomyDelta = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0;

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
        nonNegativeEconomyCount(run.shopGold) +
        nonNegativeEconomyCount(routeCardShopGold) +
        nonNegativeEconomyCount(dungeonShopGold) +
        (tollCacheClaimed ? TOLL_CACHE_SHOP_GOLD_REWARD : 0) +
        (fuseCacheClaimed
            ? fuseCacheFresh
                ? FUSE_CACHE_FRESH_SHOP_GOLD_REWARD
                : FUSE_CACHE_EXPIRED_SHOP_GOLD_REWARD
            : 0),
    dungeonKeys:
        finiteEconomyDelta(dungeonKeysDelta) !== 0 || matchedDungeonKind === 'key'
            ? addRunDungeonKey(run.dungeonKeys, matchedDungeonKeyKind, finiteEconomyDelta(dungeonKeysDelta))
            : run.dungeonKeys,
    dungeonMasterKeys: Math.max(0, nonNegativeEconomyCount(run.dungeonMasterKeys) + finiteEconomyDelta(dungeonMasterKeysDelta))
});
