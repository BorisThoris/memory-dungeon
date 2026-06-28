import type {
    DungeonCardEffectId,
    DungeonCardKind,
    DungeonExitLockKind,
    DungeonFloorBlueprint,
    DungeonKeyKind,
    FloorArchetypeId,
    FloorTag,
    GameMode,
    RouteNodeType
} from './contracts';
import { getDungeonBossDefinition } from './dungeon-boss-rules';
import {
    budgetForFloor,
    dungeonBossForFloor,
    primaryExitLockKindForFloor,
    requiredLeverCountForFloor
} from './dungeon-blueprint-policy-rules';

export interface DungeonCardAssignment {
    kind: DungeonCardKind;
    effectId: DungeonCardEffectId;
    symbol: string;
    label: string;
    keyKind?: DungeonKeyKind;
    hp?: number;
    routeType?: RouteNodeType;
    bossId?: NonNullable<DungeonFloorBlueprint['bossId']>;
}

export type DungeonCardRecipeBudgets = Pick<
    DungeonFloorBlueprint,
    'threatBudget' | 'rewardBudget' | 'utilityBudget' | 'lockBudget' | 'gatewayBudget' | 'bossId'
> & {
    exitLockKinds?: DungeonExitLockKind[];
};

export const capDungeonCardRecipeForBudget = (
    cards: DungeonCardAssignment[],
    capacity: number,
    objectiveId: DungeonFloorBlueprint['objectiveId']
): DungeonCardAssignment[] => {
    if (cards.length <= capacity) {
        return cards;
    }
    const selected: DungeonCardAssignment[] = [];
    const selectedIndexes = new Set<number>();
    const take = (predicate: (card: DungeonCardAssignment) => boolean): void => {
        for (let index = 0; index < cards.length && selected.length < capacity; index += 1) {
            if (!selectedIndexes.has(index) && predicate(cards[index]!)) {
                selected.push(cards[index]!);
                selectedIndexes.add(index);
            }
        }
    };

    take((card) => card.bossId != null || card.effectId === 'lever_floor');
    if (objectiveId === 'claim_route') {
        take((card) => card.kind === 'gateway');
    }
    if (objectiveId === 'disarm_traps') {
        take((card) => card.kind === 'trap' || card.effectId === 'rune_seal');
    }
    if (objectiveId === 'loot_cache') {
        take((card) => card.kind === 'treasure' || card.kind === 'lock');
        take((card) => card.kind === 'key');
    }
    take(() => true);

    return selected;
};

const bossCardFor = (bossId: DungeonFloorBlueprint['bossId']): DungeonCardAssignment | null => {
    const definition = getDungeonBossDefinition(bossId);
    if (!definition) {
        return null;
    }
    return {
        kind: 'enemy',
        effectId: 'enemy_elite',
        symbol: definition.symbol,
        label: definition.label,
        hp: definition.hp,
        bossId: definition.id
    };
};

const sentryCard = (): DungeonCardAssignment => ({
    kind: 'enemy',
    effectId: 'enemy_sentry',
    symbol: 'e',
    label: 'Archivist Sentry',
    hp: 1
});

const eliteCard = (): DungeonCardAssignment => ({
    kind: 'enemy',
    effectId: 'enemy_elite',
    symbol: 'E',
    label: 'Mnemonic Sentinel',
    hp: 2
});

const stalkerCard = (): DungeonCardAssignment => ({
    kind: 'enemy',
    effectId: 'enemy_stalker',
    symbol: 's',
    label: 'Afterimage Stalker',
    hp: 2
});

const trapCard = (effectId: DungeonCardEffectId, floorArchetypeId: FloorArchetypeId | null): DungeonCardAssignment => ({
    kind: 'trap',
    effectId,
    symbol: '!',
    label:
        effectId === 'trap_alarm'
            ? 'Bell Trap'
            : effectId === 'trap_snare'
              ? 'Latch Snare'
              : effectId === 'trap_hex'
                ? 'Forgetful Hex'
                : effectId === 'trap_mimic'
                  ? 'Mimic Bounty'
                  : floorArchetypeId === 'shadow_read' || effectId === 'trap_curse'
                    ? 'Curse Sigil'
                    : 'Spike Plate'
});

const treasureCard = (level: number, floorArchetypeId: FloorArchetypeId | null): DungeonCardAssignment => ({
    kind: 'treasure',
    effectId: floorArchetypeId === 'treasure_gallery' || level >= 5 ? 'treasure_cache' : 'treasure_gold',
    symbol: '$',
    label: floorArchetypeId === 'treasure_gallery' || level >= 5 ? 'Gallery Cache' : 'Coin Memory'
});

const lockCard = (keyKind: DungeonKeyKind = 'iron'): DungeonCardAssignment => ({
    kind: 'lock',
    effectId: 'lock_cache',
    symbol: 'L',
    label: keyKind === 'iron' ? 'Sealed Cache' : `${keyKind[0]!.toUpperCase()}${keyKind.slice(1)} Cache Lock`,
    keyKind
});
const keyLabelForKind = (keyKind: DungeonKeyKind): string =>
    keyKind === 'iron' ? 'Iron Memory Key' : `${keyKind[0]!.toUpperCase()}${keyKind.slice(1)} Memory Key`;
const keyCard = (keyKind: DungeonKeyKind = 'iron'): DungeonCardAssignment => ({
    kind: 'key',
    effectId: 'key_iron',
    symbol: keyKind === 'iron' ? 'K' : keyKind[0]!.toUpperCase(),
    label: keyLabelForKind(keyKind),
    keyKind
});
const shrineCard = (): DungeonCardAssignment => ({ kind: 'shrine', effectId: 'shrine_guard', symbol: '+', label: 'Guard Shrine' });
const gatewayCard = (routeType: RouteNodeType = 'greed'): DungeonCardAssignment => ({
    kind: 'gateway',
    effectId: routeType === 'safe' ? 'gateway_safe' : routeType === 'mystery' ? 'gateway_mystery' : 'gateway_depth',
    symbol: routeType === 'mystery' ? '?' : '>',
    label: routeType === 'mystery' ? 'Mystery Gateway' : routeType === 'safe' ? 'Safe Gateway' : 'Depth Gateway',
    routeType
});

export const minorSupplyCard = (): DungeonCardAssignment => ({
    kind: 'treasure',
    effectId: 'treasure_shard',
    symbol: '.',
    label: 'Supply Niche'
});

export const dungeonCardRecipeForFloor = (
    level: number,
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null,
    gameMode?: GameMode,
    blueprint?: DungeonCardRecipeBudgets
): DungeonCardAssignment[] => {
    const budgets = blueprint ?? {
        ...budgetForFloor(level, floorTag, floorArchetypeId),
        bossId: dungeonBossForFloor(floorTag, floorArchetypeId)
    };
    const cards: DungeonCardAssignment[] = [];
    const neededKeyKinds = [...new Set((budgets.exitLockKinds ?? []).filter(
        (lockKind): lockKind is DungeonKeyKind => lockKind !== 'none' && lockKind !== 'lever'
    ))];
    const preferredKeyKind = neededKeyKinds[0] ?? 'iron';
    const exitLockKind = primaryExitLockKindForFloor(level, floorArchetypeId);
    const leverCount = requiredLeverCountForFloor(level, exitLockKind);
    for (let i = 0; i < leverCount; i++) {
        cards.push({ kind: 'lever', effectId: 'lever_floor', symbol: 'V', label: i === 0 ? 'Exit Lever' : `Exit Lever ${i + 1}` });
    }

    const bossCard = bossCardFor(budgets.bossId);
    if (bossCard) {
        cards.push(bossCard);
    }

    let threatsAdded = bossCard ? 1 : 0;
    if (threatsAdded < budgets.threatBudget && level >= 2 && gameMode !== 'meditation') {
        cards.push(
            floorArchetypeId === 'shadow_read'
                ? trapCard('trap_hex', floorArchetypeId)
                : floorTag === 'boss' || floorArchetypeId === 'trap_hall'
                  ? stalkerCard()
                  : floorArchetypeId === 'rush_recall'
                    ? eliteCard()
                    : sentryCard()
        );
        threatsAdded += 1;
    }

    while (threatsAdded < budgets.threatBudget) {
        const trapEffectId: DungeonCardEffectId =
            floorArchetypeId === 'shadow_read'
                ? threatsAdded % 2 === 0
                    ? 'trap_hex'
                    : 'trap_curse'
                : floorArchetypeId === 'trap_hall'
                  ? threatsAdded === 1
                      ? 'trap_mimic'
                      : threatsAdded % 2 === 0
                        ? 'trap_snare'
                        : 'trap_hex'
                  : level >= 6
                    ? 'trap_mimic'
                    : 'trap_spikes';
        cards.push(trapCard(trapEffectId, floorArchetypeId));
        threatsAdded += 1;
    }

    for (let i = 0; i < budgets.rewardBudget; i++) {
        cards.push(treasureCard(level, floorArchetypeId));
    }

    for (let i = 0; i < budgets.utilityBudget; i++) {
        if (floorArchetypeId === 'trap_hall' && level >= 4 && i === 0) {
            cards.push({ kind: 'lever', effectId: 'rune_seal', symbol: 'R', label: 'Rune Seal' });
        } else if (floorTag === 'boss' && i === 0) {
            cards.push(shrineCard());
        } else if (floorTag === 'breather') {
            cards.push(shrineCard());
        } else if (floorArchetypeId === 'script_room' || floorArchetypeId === 'spotlight_hunt' || floorArchetypeId === 'parasite_tithe') {
            cards.push(shrineCard());
        } else if (level >= 3 && floorArchetypeId !== 'breather') {
            cards.push(keyCard(preferredKeyKind));
        }
    }

    for (let i = 0; i < budgets.lockBudget; i++) {
        cards.push(i % 2 === 0 && level >= 3 ? keyCard(preferredKeyKind) : lockCard(preferredKeyKind));
    }

    for (let i = 0; i < budgets.gatewayBudget; i++) {
        cards.push(gatewayCard(floorArchetypeId === 'script_room' || floorArchetypeId === 'shadow_read' ? 'mystery' : 'greed'));
    }

    return cards;
};
