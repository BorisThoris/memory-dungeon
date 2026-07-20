import type {
    FloorArchetypeId,
    FloorTag,
    MutatorId,
    RouteCardKind,
    RouteCardPlan,
    RouteNodeType,
    RouteSpecialKind,
    RouteWorldProfile,
    Tile
} from './contracts';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';

export interface RouteWorldProfileInput {
    plan: RouteCardPlan | null | undefined;
    level: number;
    floorTag: FloorTag;
    floorArchetypeId: FloorArchetypeId | null;
    mutators: readonly MutatorId[];
}

export interface RouteWorldAssignmentInput {
    tiles: readonly Tile[];
    profile: RouteWorldProfile | null | undefined;
    runSeed: number;
    rulesVersion: number;
    level: number;
    forbiddenPairKeys: readonly string[];
}

export const routeCardKindForRouteType = (routeType: RouteNodeType): RouteCardKind =>
    routeType === 'safe' ? 'safe_ward' : routeType === 'greed' ? 'greed_cache' : 'mystery_veil';

const summaryForRouteType = (routeType: RouteNodeType): string => {
    if (routeType === 'safe') {
        return 'Safe route: defensive ward support and no route-added hazards.';
    }
    if (routeType === 'greed') {
        return 'Greedy route: richer cache rewards with extra reward-risk pressure.';
    }
    return 'Mystery route: deterministic veils with fair reveal counterplay.';
};

export const deriveRouteWorldProfile = ({
    plan,
    level,
    floorTag,
    floorArchetypeId,
    mutators
}: RouteWorldProfileInput): RouteWorldProfile | null => {
    if (!plan || plan.targetLevel !== level) {
        return null;
    }
    const hardFloor =
        floorTag === 'boss' ||
        floorArchetypeId === 'trap_hall' ||
        floorArchetypeId === 'rush_recall' ||
        mutators.includes('glass_floor') ||
        mutators.includes('short_memorize');

    if (plan.routeType === 'safe') {
        return {
            routeType: plan.routeType,
            intensity: 'safe',
            choiceId: plan.choiceId,
            sourceLevel: plan.sourceLevel,
            targetLevel: plan.targetLevel,
            hazardBudget: 0,
            rewardBudget: 1,
            safetyBudget: hardFloor ? 2 : 1,
            informationBudget: 0,
            routeSpecialKinds:
                floorTag === 'boss'
                    ? ['guard_cache', 'lantern_ward', 'keystone_pair']
                    : hardFloor
                      ? ['guard_cache', 'lantern_ward', 'final_ward', 'anchor_seal']
                    : ['guard_cache', 'lantern_ward', 'pin_lattice'],
            summary: summaryForRouteType(plan.routeType)
        };
    }

    if (plan.routeType === 'greed') {
        return {
            routeType: plan.routeType,
            intensity: 'greed',
            choiceId: plan.choiceId,
            sourceLevel: plan.sourceLevel,
            targetLevel: plan.targetLevel,
            hazardBudget: hardFloor ? 1 : 2,
            rewardBudget: 3,
            safetyBudget: 0,
            informationBudget: 0,
            routeSpecialKinds:
                floorTag === 'boss'
                    ? ['greed_cache', 'greed_toll', 'keystone_pair']
                    : hardFloor
                      ? ['greed_cache', 'greed_toll', 'elite_cache', 'catalyst_altar']
                    : ['greed_cache', 'greed_toll', 'fragile_cache', 'catalyst_altar'],
            summary: summaryForRouteType(plan.routeType)
        };
    }

    return {
        routeType: plan.routeType,
        intensity: 'mystery',
        choiceId: plan.choiceId,
        sourceLevel: plan.sourceLevel,
        targetLevel: plan.targetLevel,
        hazardBudget: hardFloor ? 0 : 1,
        rewardBudget: 2,
        safetyBudget: 0,
        informationBudget: hardFloor ? 1 : 2,
        routeSpecialKinds:
            floorTag === 'boss'
                ? ['mystery_veil', 'keystone_pair']
                : floorArchetypeId === 'parasite_tithe'
                  ? ['mystery_veil', 'parasite_vessel', 'loaded_gateway']
                : hardFloor
                  ? ['mystery_veil', 'omen_seal', 'loaded_gateway']
                  : ['mystery_veil', 'secret_door', 'mimic_cache', 'loaded_gateway'],
        summary: summaryForRouteType(plan.routeType)
    };
};

export const routeCardKindForSpecialKind = (
    kind: RouteSpecialKind,
    routeType: RouteNodeType
): RouteCardKind => {
    if (
        kind === 'safe_ward' ||
        kind === 'guard_cache' ||
        kind === 'lantern_ward' ||
        kind === 'final_ward' ||
        kind === 'anchor_seal' ||
        kind === 'pin_lattice'
    ) {
        return 'safe_ward';
    }
    if (
        kind === 'mystery_veil' ||
        kind === 'secret_door' ||
        kind === 'omen_seal' ||
        kind === 'mimic_cache' ||
        kind === 'loaded_gateway' ||
        kind === 'parasite_vessel'
    ) {
        return 'mystery_veil';
    }
    if (kind === 'keystone_pair') {
        return routeCardKindForRouteType(routeType);
    }
    return 'greed_cache';
};

export const routeSpecialLabel = (kind: RouteSpecialKind): string => {
    if (kind === 'safe_ward') {
        return 'Safe Ward';
    }
    if (kind === 'guard_cache') {
        return 'Guard Cache';
    }
    if (kind === 'greed_cache') {
        return 'Greed Cache';
    }
    if (kind === 'elite_cache') {
        return 'Elite Cache';
    }
    if (kind === 'final_ward') {
        return 'Final Ward';
    }
    if (kind === 'greed_toll') {
        return 'Toll Cache';
    }
    if (kind === 'fragile_cache') {
        return 'Fragile Cache';
    }
    if (kind === 'lantern_ward') {
        return 'Lantern Ward';
    }
    if (kind === 'anchor_seal') {
        return 'Anchor Seal';
    }
    if (kind === 'loaded_gateway') {
        return 'Loaded Gateway';
    }
    if (kind === 'catalyst_altar') {
        return 'Catalyst Altar';
    }
    if (kind === 'parasite_vessel') {
        return 'Parasite Vessel';
    }
    if (kind === 'pin_lattice') {
        return 'Pin Lattice';
    }
    if (kind === 'mimic_cache') {
        return 'Mimic Cache';
    }
    if (kind === 'secret_door') {
        return 'Secret Door';
    }
    if (kind === 'omen_seal') {
        return 'Omen Seal';
    }
    if (kind === 'keystone_pair') {
        return 'Keystone Pair';
    }
    return 'Mystery Veil';
};

export const routeSpecialRewardLine = (kind: RouteSpecialKind): string => {
    if (kind === 'safe_ward') {
        return '+1 guard token';
    }
    if (kind === 'guard_cache') {
        return '+1 guard token; capped guard banks one hazard ward';
    }
    if (kind === 'greed_cache') {
        return '+2 gold +25 score';
    }
    if (kind === 'elite_cache') {
        return '+4 gold +55 score if matched; destroy denies it';
    }
    if (kind === 'final_ward') {
        return '+1 guard token +1 combo shard';
    }
    if (kind === 'greed_toll') {
        return '+3 gold +40 score if matched; destroy denies it';
    }
    if (kind === 'fragile_cache') {
        return '+1 gold +20 score if matched; destroy denies it';
    }
    if (kind === 'lantern_ward') {
        return '+1 guard token +10 score; scouts one hidden threat';
    }
    if (kind === 'anchor_seal') {
        return 'banks one seal that freezes the next rotating pressure';
    }
    if (kind === 'loaded_gateway') {
        return '+20 score; sets a deterministic Mystery route branch';
    }
    if (kind === 'catalyst_altar') {
        return 'spend 1 combo shard for upgraded score; fallback score if empty';
    }
    if (kind === 'parasite_vessel') {
        return 'converts parasite pressure into Favor; fallback score if calm';
    }
    if (kind === 'pin_lattice') {
        return '+20 score if both matched tiles were pinned; one payoff per floor';
    }
    if (kind === 'mimic_cache') {
        return 'scout first for full loot; blind match bites for reduced loot';
    }
    if (kind === 'secret_door') {
        return '+1 relic Favor if discovered';
    }
    if (kind === 'omen_seal') {
        return '+1 relic Favor +1 combo shard; scouts one hidden danger';
    }
    if (kind === 'keystone_pair') {
        return '+1 relic Favor +45 boss score';
    }
    return 'Seeded reward: gold, shard, or relic Favor';
};

export const assignRouteWorldSpecials = ({
    tiles,
    profile,
    runSeed,
    rulesVersion,
    level,
    forbiddenPairKeys
}: RouteWorldAssignmentInput): Tile[] => {
    if (!profile || profile.targetLevel !== level) {
        return tiles.map((tile) => ({ ...tile }));
    }
    const forbidden = new Set(forbiddenPairKeys);
    const eligibleKeys = [
        ...new Set(tiles.map((tile) => tile.pairKey).filter((pairKey) => !forbidden.has(pairKey)))
    ];
    if (eligibleKeys.length === 0) {
        return tiles.map((tile) => ({ ...tile }));
    }
    const rng = createMulberry32(
        hashStringToSeed(`routeWorld:${rulesVersion}:${runSeed}:${level}:${profile.choiceId}`)
    );
    const keys = [...eligibleKeys];
    for (let i = keys.length - 1; i > 0; i--) {
        const j = pickRngIndex(rng, i + 1);
        const tmp = keys[i]!;
        keys[i] = keys[j]!;
        keys[j] = tmp;
    }

    const kindByPairKey = new Map<string, RouteSpecialKind>();
    const count = Math.min(profile.routeSpecialKinds.length, keys.length);
    for (let i = 0; i < count; i++) {
        kindByPairKey.set(keys[i]!, profile.routeSpecialKinds[i]!);
    }

    return tiles.map((tile) => {
        const specialKind = kindByPairKey.get(tile.pairKey);
        return specialKind
            ? {
                  ...tile,
                  routeCardKind: routeCardKindForSpecialKind(specialKind, profile.routeType),
                  routeSpecialKind: specialKind,
                  routeSpecialRevealed:
                      specialKind !== 'mystery_veil' && specialKind !== 'secret_door' && specialKind !== 'omen_seal'
                          ? true
                          : undefined
              }
            : { ...tile };
    });
};
