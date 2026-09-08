import { type DungeonCardKind, type DungeonKeyKind, type RunState } from './contracts';
import { addRunDungeonKey } from './dungeon-key-rules';
import { runFiniteIntegerDelta, runNonNegativeInteger } from './run-number-guards';

export interface TurnMatchEconomyResult {
    shopGold: number;
    dungeonKeys: RunState['dungeonKeys'];
    dungeonMasterKeys: number;
}

export interface TurnMatchEconomyInput {
    run: RunState;
    dungeonKeysDelta: number;
    dungeonMasterKeysDelta: number;
    matchedDungeonKind: DungeonCardKind | null | undefined;
    matchedDungeonKeyKind: DungeonKeyKind;
}

/*
 * A match used to pay gold four ways here - a route card, a dungeon treasure or chunk-spilled
 * treasure, a toll cache, a fuse cache. Gold is gone with the shop (Gen 174): the wallet reads
 * nought after every match, whatever the run carried in from an older save.
 */
export const resolveTurnMatchEconomy = ({
    run,
    dungeonKeysDelta,
    dungeonMasterKeysDelta,
    matchedDungeonKind,
    matchedDungeonKeyKind
}: TurnMatchEconomyInput): TurnMatchEconomyResult => ({
    shopGold: 0,
    dungeonKeys:
        runFiniteIntegerDelta(dungeonKeysDelta) !== 0 || matchedDungeonKind === 'key'
            ? addRunDungeonKey(run.dungeonKeys, matchedDungeonKeyKind, runFiniteIntegerDelta(dungeonKeysDelta))
            : run.dungeonKeys,
    dungeonMasterKeys: Math.max(0, runNonNegativeInteger(run.dungeonMasterKeys) + runFiniteIntegerDelta(dungeonMasterKeysDelta))
});
