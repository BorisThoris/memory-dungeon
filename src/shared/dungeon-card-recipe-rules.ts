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
    objectiveId: DungeonFloorBlueprint['objectiveId'],
    /*
     * The objective the floor's ARCHETYPE would have chosen, when that differs from the one it
     * actually has. A boss floor overrides the archetype - `trap_hall` wants `disarm_traps` and a
     * boss `trap_hall` gets `defeat_boss` - so protecting only the live objective drops the traps
     * from a trap hall. Both are protected, which is what "cut optional before identity" means
     * when a floor has two identities.
     */
    archetypeObjectiveId?: DungeonFloorBlueprint['objectiveId'] | null
): DungeonCardAssignment[] => {
    if (cards.length <= capacity) {
        return cards;
    }
    const selected: DungeonCardAssignment[] = [];
    const selectedIndexes = new Set<number>();
    const take = (predicate: (card: DungeonCardAssignment) => boolean): void => {
        for (let index = 0; index < cards.length && selected.length < capacity; index += 1) {
            const card = cards[index];
            if (card !== undefined && !selectedIndexes.has(index) && predicate(card)) {
                selected.push(card);
                selectedIndexes.add(index);
            }
        }
    };

    // What the floor cannot finish without.
    take((card) => card.bossId != null || card.effectId === 'lever_floor');
    /*
     * Then the floor's threat, in full, before anything optional.
     *
     * The reserve takes pairs away from the dungeon, and something has to give. Letting it fall on
     * threat made every floor safer, and `build-strategy-playthrough-simulation` caught the
     * consequence immediately: `routeRiskRejections` went to zero across all nine builds, because a
     * route the risk policy would refuse had stopped existing. A reserve that buys the loop material
     * by quietly disarming the dungeon is not a trade this game wants, and it would have shown up
     * later as a whole system - route risk assessment - going silent.
     *
     * So threat is protected and the reserve is paid for out of what is genuinely optional: spare
     * rewards and utility. That is the "cut optional before identity" rule with threat counted as
     * identity, which on reflection is what a dungeon floor is.
     */
    take((card) => card.kind === 'enemy' || card.kind === 'trap');
    /*
     * What the floor's objective is about.
     *
     * `pacify_floor` and `defeat_boss` were missing here, and their absence is the "an elite floor
     * paid no reward" failure the earlier reserve attempts recorded and could not account for. An
     * elite's whole objective is its enemies, and with nothing protecting them the trim took them
     * for anything that happened to come earlier in the list. Reading `objectiveContributions` off
     * the card definitions instead was tried and is worse: `find_exit` is contributed to by almost
     * every card, so on an ordinary floor that take swallows the entire capacity.
     */
    const objectives = new Set(
        [objectiveId, archetypeObjectiveId].filter((id): id is DungeonFloorBlueprint['objectiveId'] => id != null)
    );
    /*
     * An objective made of several kinds keeps one of each before any of them gets a second copy.
     *
     * `loot_cache` is the case that proved this necessary. Its pieces are the cache, the lock on it
     * and the key to that lock, and the recipe authors the treasures first; a straight take filled
     * the whole remaining capacity with three treasures and left a treasure gallery with no lock
     * and no key, while the floor's exit still asked for a treasure key. The floor's own objective
     * had been trimmed into something that could not be completed.
     *
     * Reading it kind by kind is the same breadth-before-depth rule the generic fill below uses,
     * just applied one level earlier - inside the objective rather than only after it.
     */
    const takeAcrossKinds = (predicate: (card: DungeonCardAssignment) => boolean): void => {
        const kindsSeen = new Set<string>();
        take((card) => {
            if (!predicate(card) || kindsSeen.has(card.kind)) return false;
            kindsSeen.add(card.kind);
            return true;
        });
        take(predicate);
    };
    if (objectives.has('pacify_floor') || objectives.has('defeat_boss')) {
        takeAcrossKinds((card) => card.kind === 'enemy');
    }
    if (objectives.has('claim_route')) {
        takeAcrossKinds((card) => card.kind === 'gateway');
    }
    if (objectives.has('disarm_traps')) {
        takeAcrossKinds((card) => card.kind === 'trap' || card.effectId === 'rune_seal');
    }
    if (objectives.has('loot_cache')) {
        takeAcrossKinds((card) => card.kind === 'treasure' || card.kind === 'lock' || card.kind === 'key');
    }
    /*
     * Then one of every other kind the recipe asked for, before any kind gets a second copy.
     *
     * This is the pass the two earlier attempts at a reserve did not have, and it is why they
     * failed. With the capacity equal to the floor's whole pair count nothing was ever cut, so the
     * order below the objective did not matter; the moment pairs were held back it mattered
     * enormously, and the generic fill took three treasures onto a treasure floor while an elite
     * floor's only reward card fell off the end. The floors that broke were the ones whose
     * identity card was not named by their objective.
     *
     * Breadth before depth fixes that without teaching this function what an archetype means: a
     * floor keeps one of everything it authored, and only ever loses the second and subsequent
     * copy. That makes the reserve cut what is optional - an extra treasure, a spare key - which
     * is the distinction the earlier attempts got backwards.
     */
    const kindsTaken = new Set<string>(selected.map((card) => card.kind));
    take((card) => {
        if (kindsTaken.has(card.kind)) return false;
        kindsTaken.add(card.kind);
        return true;
    });
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

const dungeonKeyKindTitle = (keyKind: DungeonKeyKind): string => `${keyKind.charAt(0).toUpperCase()}${keyKind.slice(1)}`;

const lockCard = (keyKind: DungeonKeyKind = 'iron'): DungeonCardAssignment => ({
    kind: 'lock',
    effectId: 'lock_cache',
    symbol: 'L',
    label: keyKind === 'iron' ? 'Sealed Cache' : `${dungeonKeyKindTitle(keyKind)} Cache Lock`,
    keyKind
});
const keyLabelForKind = (keyKind: DungeonKeyKind): string =>
    keyKind === 'iron' ? 'Iron Memory Key' : `${dungeonKeyKindTitle(keyKind)} Memory Key`;
const keyCard = (keyKind: DungeonKeyKind = 'iron'): DungeonCardAssignment => ({
    kind: 'key',
    effectId: 'key_iron',
    symbol: keyKind === 'iron' ? 'K' : dungeonKeyKindTitle(keyKind).charAt(0),
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
