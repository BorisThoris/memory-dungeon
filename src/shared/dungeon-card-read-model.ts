import type { DungeonCardEffectId, Tile, RunState } from './contracts';
import { getDungeonBossDefinition } from './dungeon-boss-rules';
import { getDungeonCardKindDefinition } from './dungeon-cards';

export type DungeonRoomEffectId = Extract<DungeonCardEffectId, `room_${string}`>;
export type DungeonRoomTrigger = 'reveal' | 'reveal_or_reuse';
export type DungeonRoomResolvedState = 'one_shot_resolved' | 'reusable_revealed' | 'key_gated_until_paid';

export interface DungeonRoomEffectDefinition {
    effectId: DungeonRoomEffectId;
    label: string;
    trigger: DungeonRoomTrigger;
    costText: string;
    rewardText: string;
    resolvedState: DungeonRoomResolvedState;
    blockedText: string | null;
}

export interface DungeonRoomReadModel {
    effectId: DungeonRoomEffectId;
    label: string;
    trigger: DungeonRoomTrigger;
    costText: string;
    rewardText: string;
    resolvedState: DungeonRoomResolvedState;
    used: boolean;
    canUse: boolean;
    blockedText: string | null;
    copy: string;
}

export const DUNGEON_ROOM_EFFECT_DEFINITIONS: Record<DungeonRoomEffectId, DungeonRoomEffectDefinition> = {
    room_campfire: {
        effectId: 'room_campfire',
        label: 'Mnemonic Hearth',
        trigger: 'reveal',
        costText: 'No cost.',
        rewardText: 'Restores one life, or pays fallback score if already healthy.',
        resolvedState: 'one_shot_resolved',
        blockedText: null
    },
    room_fountain: {
        effectId: 'room_fountain',
        label: 'Stillwater Font',
        trigger: 'reveal',
        costText: 'No cost.',
        rewardText: 'Grants one guard token for safer hazard contact.',
        resolvedState: 'one_shot_resolved',
        blockedText: null
    },
    room_map: {
        effectId: 'room_map',
        label: 'Cartographer Cell',
        trigger: 'reveal',
        costText: 'No cost.',
        rewardText: 'Scouts one hidden dungeon pair and marks the route.',
        resolvedState: 'one_shot_resolved',
        blockedText: null
    },
    room_armory: {
        effectId: 'room_armory',
        label: 'Guard Armory',
        trigger: 'reveal',
        costText: 'No cost.',
        rewardText: 'Grants Guard and advances safe-hazard protection.',
        resolvedState: 'one_shot_resolved',
        blockedText: null
    },
    room_forge: {
        effectId: 'room_forge',
        label: 'Memory Forge',
        trigger: 'reveal_or_reuse',
        costText: 'Costs 2 gold each use.',
        rewardText: 'Converts gold into score and combo shards.',
        resolvedState: 'reusable_revealed',
        blockedText: 'Needs 2 shop gold.'
    },
    room_shrine: {
        effectId: 'room_shrine',
        label: 'Whisper Shrine',
        trigger: 'reveal',
        costText: 'Spends 1 gold if available.',
        rewardText: 'Grants guard when paid, or fallback score if no gold is available.',
        resolvedState: 'one_shot_resolved',
        blockedText: null
    },
    room_scrying_lens: {
        effectId: 'room_scrying_lens',
        label: 'Scrying Lens',
        trigger: 'reveal',
        costText: 'No cost.',
        rewardText: 'Reveals one hidden dungeon pair or peeks a hazard family.',
        resolvedState: 'one_shot_resolved',
        blockedText: null
    },
    room_key_cache: {
        effectId: 'room_key_cache',
        label: 'Key Cache',
        trigger: 'reveal',
        costText: 'No cost.',
        rewardText: 'Grants an iron key and a small score cache.',
        resolvedState: 'one_shot_resolved',
        blockedText: null
    },
    room_locked_cache: {
        effectId: 'room_locked_cache',
        label: 'Sealed Cache Cell',
        trigger: 'reveal_or_reuse',
        costText: 'Costs one iron or master key to claim.',
        rewardText: 'Pays a large score and gold cache.',
        resolvedState: 'key_gated_until_paid',
        blockedText: 'Needs an iron key or master key.'
    },
    room_trap_workshop: {
        effectId: 'room_trap_workshop',
        label: 'Trapwright Bench',
        trigger: 'reveal',
        costText: 'No cost.',
        rewardText: 'Resolves one armed trap pair, or reveals one hidden trap family clue.',
        resolvedState: 'one_shot_resolved',
        blockedText: null
    },
    room_omen_archive: {
        effectId: 'room_omen_archive',
        label: 'Omen Archive',
        trigger: 'reveal',
        costText: 'No cost.',
        rewardText: 'Grants Favor, score, and reveals one hidden dungeon pair.',
        resolvedState: 'one_shot_resolved',
        blockedText: null
    }
};

const isDungeonRoomEffectId = (effectId: DungeonCardEffectId | null | undefined): effectId is DungeonRoomEffectId =>
    Boolean(effectId && effectId in DUNGEON_ROOM_EFFECT_DEFINITIONS);

export const getDungeonRoomEffectDefinition = (
    effectId: DungeonCardEffectId | null | undefined
): DungeonRoomEffectDefinition | null => (isDungeonRoomEffectId(effectId) ? DUNGEON_ROOM_EFFECT_DEFINITIONS[effectId] : null);

export const getDungeonRoomReadModel = (
    tile: Tile,
    run?: RunState | null
): DungeonRoomReadModel | null => {
    if (tile.dungeonCardKind !== 'room') {
        return null;
    }
    const definition = getDungeonRoomEffectDefinition(tile.dungeonCardEffectId);
    if (!definition) {
        return null;
    }
    const used = tile.dungeonRoomUsed === true || tile.dungeonCardState === 'resolved';
    const hasIronKey = (run?.dungeonKeys?.iron ?? 0) > 0;
    const hasMasterKey = (run?.dungeonMasterKeys ?? 0) > 0;
    const forgeCanPay = (run?.shopGold ?? 0) >= 2;
    const canUse =
        definition.effectId === 'room_forge'
            ? forgeCanPay
            : definition.effectId === 'room_locked_cache'
              ? hasIronKey || hasMasterKey
              : !used;
    const blockedText = canUse ? null : used ? 'Room already used.' : definition.blockedText;
    const stateCopy =
        definition.resolvedState === 'reusable_revealed'
            ? 'Reusable room.'
            : definition.resolvedState === 'key_gated_until_paid'
              ? used
                  ? 'Resolved after key spend.'
                  : 'Reveals first and stays available until paid.'
              : 'Resolves after one use.';

    return {
        effectId: definition.effectId,
        label: definition.label,
        trigger: definition.trigger,
        costText: definition.costText,
        rewardText: definition.rewardText,
        resolvedState: definition.resolvedState,
        used,
        canUse,
        blockedText,
        copy: `Dungeon room: ${tile.label}. ${definition.rewardText} ${definition.costText} ${stateCopy}${
            blockedText ? ` ${blockedText}` : ''
        }`
    };
};

export type DungeonTreasureRewardId =
    | 'treasure_gold'
    | 'treasure_cache'
    | 'treasure_shard'
    | 'lock_cache'
    | 'room_locked_cache'
    | 'secret_door';
export type DungeonTreasureTier = 'minor' | 'standard' | 'cache' | 'secret';

export interface DungeonTreasureRewardDefinition {
    rewardId: DungeonTreasureRewardId;
    label: string;
    tier: DungeonTreasureTier;
    gateText: string;
    payoutText: string;
    claimCondition: string;
}

export interface DungeonTreasureReadModel extends DungeonTreasureRewardDefinition {
    source: 'dungeon_card' | 'room' | 'route_special';
    available: boolean;
    copy: string;
}

export const DUNGEON_TREASURE_REWARD_DEFINITIONS: Record<DungeonTreasureRewardId, DungeonTreasureRewardDefinition> = {
    treasure_gold: {
        rewardId: 'treasure_gold',
        label: 'Coin Memory',
        tier: 'standard',
        gateText: 'Ungated.',
        payoutText: 'Pays shop gold and score.',
        claimCondition: 'Match the treasure pair.'
    },
    treasure_cache: {
        rewardId: 'treasure_cache',
        label: 'Gallery Cache',
        tier: 'cache',
        gateText: 'Ungated, but weighted toward treasure floors.',
        payoutText: 'Pays increased shop gold and score.',
        claimCondition: 'Match the cache pair.'
    },
    treasure_shard: {
        rewardId: 'treasure_shard',
        label: 'Supply Niche',
        tier: 'minor',
        gateText: 'Ungated supply reward.',
        payoutText: 'Pays a small shop gold and score reward.',
        claimCondition: 'Match the supply pair.'
    },
    lock_cache: {
        rewardId: 'lock_cache',
        label: 'Sealed Cache',
        tier: 'cache',
        gateText: 'Can spend an iron/master key for full value.',
        payoutText: 'Pays cache score and treasure progress, or a small consolation when matched.',
        claimCondition: 'Spend a key on activation or match the lock pair.'
    },
    room_locked_cache: {
        rewardId: 'room_locked_cache',
        label: 'Sealed Cache Cell',
        tier: 'cache',
        gateText: 'Requires an iron key or master key.',
        payoutText: 'Pays shop gold and score.',
        claimCondition: 'Reveal the room, then reopen it after finding a key.'
    },
    secret_door: {
        rewardId: 'secret_door',
        label: 'Secret Door',
        tier: 'secret',
        gateText: 'Mystery route special; revealed by peek/scout pressure.',
        payoutText: 'Pays relic Favor progress.',
        claimCondition: 'Reveal or remember the secret pair, then match it.'
    }
};

const treasureRewardIdForTile = (tile: Tile): DungeonTreasureRewardId | null => {
    if (tile.routeSpecialKind === 'secret_door') return 'secret_door';
    if (tile.dungeonCardEffectId === 'treasure_gold') return 'treasure_gold';
    if (tile.dungeonCardEffectId === 'treasure_cache') return 'treasure_cache';
    if (tile.dungeonCardEffectId === 'treasure_shard') return 'treasure_shard';
    if (tile.dungeonCardEffectId === 'lock_cache') return 'lock_cache';
    if (tile.dungeonCardEffectId === 'room_locked_cache') return 'room_locked_cache';
    return null;
};

export const getDungeonTreasureRewardDefinition = (
    rewardId: DungeonTreasureRewardId
): DungeonTreasureRewardDefinition => DUNGEON_TREASURE_REWARD_DEFINITIONS[rewardId];

export const getDungeonTreasureReadModel = (tile: Tile): DungeonTreasureReadModel | null => {
    const rewardId = treasureRewardIdForTile(tile);
    if (!rewardId) {
        return null;
    }
    const definition = getDungeonTreasureRewardDefinition(rewardId);
    const source =
        tile.routeSpecialKind === 'secret_door'
            ? 'route_special'
            : tile.dungeonCardKind === 'room'
              ? 'room'
              : 'dungeon_card';
    const available = tile.state !== 'matched' && tile.state !== 'removed' && tile.dungeonCardState !== 'resolved';
    return {
        ...definition,
        source,
        available,
        copy: `${definition.label}: ${definition.payoutText} ${definition.gateText} ${definition.claimCondition}`
    };
};

export const getDungeonCardCopy = (tile: Tile): string => {
    if (!tile.dungeonCardKind) {
        return '';
    }
    if (tile.dungeonCardKind === 'exit') {
        const lock =
            tile.dungeonExitLockKind && tile.dungeonExitLockKind !== 'none'
                ? ` Requires ${
                      tile.dungeonExitLockKind === 'lever'
                          ? `${tile.dungeonExitRequiredLeverCount ?? 1} lever(s)`
                          : `${tile.dungeonExitLockKind} key`
                  }.`
                : ' Can be opened once revealed.';
        const route = tile.dungeonRouteType ? ` Leads to a ${tile.dungeonRouteType} route.` : '';
        return `Dungeon exit: ${tile.label}.${lock}${route} The descent continues only after this memory is confirmed.`;
    }
    if (tile.dungeonCardKind === 'trap' && tile.dungeonCardState === 'resolved') {
        return `Resolved trap: ${tile.label}. Its effect has sprung, no second card is pending, and your next action is ready.`;
    }
    if (tile.dungeonCardKind === 'trap' && tile.dungeonCardState === 'revealed') {
        if (tile.dungeonCardEffectId === 'trap_alarm') {
            return `Armed trap: ${tile.label}. Match its pair to silence the bell. Mismatches wake hidden enemies.`;
        }
        if (tile.dungeonCardEffectId === 'trap_snare') {
            return `Armed trap: ${tile.label}. Match its pair to release the latch. Mismatches consume guard or disable free shuffles this floor.`;
        }
        if (tile.dungeonCardEffectId === 'trap_hex') {
            return `Armed trap: ${tile.label}. Match its pair to break the hex. Mismatches cut score and reveal a hidden hazard.`;
        }
        if (tile.dungeonCardEffectId === 'trap_mimic') {
            return `Armed trap: ${tile.label}. Match its pair for bounty loot. Mismatches cost life and gold.`;
        }
        return `Armed trap: ${tile.label}. Match its pair to disarm before the room remembers your mistake.`;
    }
    if (tile.dungeonCardKind === 'room') {
        return getDungeonRoomReadModel(tile)?.copy ?? `Dungeon room: ${tile.label}.`;
    }
    if (tile.dungeonCardKind === 'shop') {
        return `Dungeon shop: ${tile.label}. Opens the vendor alcove and can be revisited on this floor.`;
    }
    if (tile.dungeonCardKind === 'key') {
        return `Dungeon key: ${tile.label}. Matching it banks an iron key for sealed caches, locked rooms, or bonus exits.`;
    }
    if (tile.dungeonCardKind === 'lock') {
        const treasure = getDungeonTreasureReadModel(tile);
        return treasure
            ? `Dungeon lock: ${tile.label}. ${treasure.payoutText} ${treasure.gateText}`
            : `Dungeon lock: ${tile.label}. Spend a key to open the remembered cache, or match it for a small consolation.`;
    }
    if (tile.dungeonCardKind === 'lever') {
        return tile.dungeonCardEffectId === 'rune_seal'
            ? `Dungeon lever: ${tile.label}. Matching it seals revealed traps.`
            : `Dungeon lever: ${tile.label}. Matching it wakes the exit mechanism.`;
    }
    if (tile.dungeonCardKind === 'treasure') {
        const treasure = getDungeonTreasureReadModel(tile);
        return treasure
            ? `Dungeon treasure: ${tile.label}. ${treasure.payoutText} ${treasure.claimCondition}`
            : `Dungeon treasure: ${tile.label}. Matching it recovers gold and score from the archive.`;
    }
    if (tile.dungeonCardKind === 'shrine') {
        return `Dungeon shrine: ${tile.label}. Matching it grants guard and Favor.`;
    }
    if (tile.dungeonCardKind === 'gateway') {
        const route = tile.dungeonRouteType ? ` Selects ${tile.dungeonRouteType} route.` : '';
        return `${getDungeonCardKindDefinition('gateway').copyLabel}: ${tile.label}.${route}`;
    }
    const bossDefinition = getDungeonBossDefinition(tile.dungeonBossId);
    if (bossDefinition) {
        return `Dungeon boss: ${tile.label}. ${bossDefinition.cardCopy} HP ${tile.dungeonCardHp ?? 0}.`;
    }
    if (tile.dungeonCardEffectId === 'enemy_stalker') {
        return `Dungeon enemy: ${tile.label}. Wakes when traps spring and attacks on mismatches. HP ${tile.dungeonCardHp ?? 0}.`;
    }
    const kindCopy = getDungeonCardKindDefinition(tile.dungeonCardKind).copyLabel;
    const hp = tile.dungeonCardKind === 'enemy' && tile.dungeonCardHp != null ? ` HP ${tile.dungeonCardHp}.` : '';
    const boss = tile.dungeonBossId ? ' Boss pair.' : '';
    return `${kindCopy}: ${tile.label}.${boss}${hp}`;
};
