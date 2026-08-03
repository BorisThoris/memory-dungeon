import { z } from 'zod';
import type {
    BonusRewardId,
    FindableKind,
    RelicId,
    RelicOfferServiceId,
    RewardPerkId,
    RouteSpecialKind,
    RunStatus,
    TileTraitKind
} from './contracts';
import { RUN_INVENTORY_ITEM_IDS } from './run-inventory-contracts';
import { RUN_PROGRESSION_REPAIR_KINDS } from './run-progression-repair';
import { TILE_TRAIT_INTERACTION_TAGS } from './tile-trait-interaction-copy';

export const GAMEPLAY_CORE_SCHEMA_VERSION = 1 as const;

export const GAMEPLAY_REWARD_PERK_IDS = [
    'free_first_swap_per_floor',
    'echo_conduit_double',
    'trait_streak_toolkit',
    'cursed_opener_greed',
    'hazard_banish_per_floor'
] as const satisfies readonly RewardPerkId[];

export const GAMEPLAY_RELIC_IDS = [
    'extra_shuffle_charge',
    'first_shuffle_free_per_floor',
    'memorize_bonus_ms',
    'peek_charge_plus_one',
    'memorize_under_short_memorize',
    'region_shuffle_free_first',
    'combo_shard_plus_step',
    'parasite_ward_once',
    'guard_token_plus_one',
    'destroy_bank_plus_one',
    'shrine_echo',
    'chapter_compass',
    'wager_surety',
    'parasite_ledger',
    'stray_charge_plus_one',
    'pin_cap_plus_one'
] as const satisfies readonly RelicId[];

export const GAMEPLAY_RELIC_OFFER_SERVICE_IDS = [
    'reroll_offer',
    'ban_option',
    'upgrade_offer'
] as const satisfies readonly RelicOfferServiceId[];

export const GAMEPLAY_BONUS_REWARD_RULES = {
    chest_gold: { maxClaims: 2, minFloor: 2, roomKind: 'treasure_chest' },
    secret_favor: { maxClaims: 1, minFloor: 3, roomKind: 'secret_room' },
    bonus_shards: { maxClaims: 2, minFloor: 2, roomKind: 'bonus_cache' },
    supply_cache: { maxClaims: 2, minFloor: 2, roomKind: 'bonus_cache' },
    trait_toolkit: { maxClaims: 2, minFloor: 2, roomKind: 'bonus_cache' },
    key_insurance: { maxClaims: 2, minFloor: 2, roomKind: 'bonus_cache' },
    hazard_ward: { maxClaims: 2, minFloor: 2, roomKind: 'bonus_cache' },
    free_swap_floor: { maxClaims: 1, minFloor: 2, roomKind: 'bonus_cache' },
    echo_conduit_lens: { maxClaims: 1, minFloor: 2, roomKind: 'bonus_cache' },
    trait_streak_lens: { maxClaims: 1, minFloor: 2, roomKind: 'bonus_cache' },
    cursed_opener_contract: { maxClaims: 1, minFloor: 2, roomKind: 'bonus_cache' },
    stasis_lockbox: { maxClaims: 1, minFloor: 2, roomKind: 'bonus_cache' },
    hazard_banisher: { maxClaims: 1, minFloor: 2, roomKind: 'bonus_cache' }
} as const satisfies Record<
    BonusRewardId,
    { maxClaims: number; minFloor: number; roomKind: 'treasure_chest' | 'secret_room' | 'bonus_cache' }
>;

export const GAMEPLAY_BONUS_REWARD_IDS = Object.keys(GAMEPLAY_BONUS_REWARD_RULES) as BonusRewardId[];

export const GAMEPLAY_RUN_EVENT_EFFECTS = [
    'gain_shop_gold',
    'gain_relic_favor',
    'heal_or_guard',
    'gain_iron_key',
    'gain_destroy_charge',
    'gain_score',
    'skip'
] as const;

export const GAMEPLAY_FINDABLE_KINDS = [
    'shard_spark',
    'score_glint',
    'ward_spark',
    'scout_glint'
] as const satisfies readonly FindableKind[];

export const GAMEPLAY_ROUTE_SPECIAL_KINDS = [
    'safe_ward',
    'greed_cache',
    'mystery_veil',
    'elite_cache',
    'final_ward',
    'greed_toll',
    'fragile_cache',
    'guard_cache',
    'lantern_ward',
    'mimic_cache',
    'anchor_seal',
    'loaded_gateway',
    'catalyst_altar',
    'parasite_vessel',
    'pin_lattice',
    'omen_seal',
    'secret_door',
    'keystone_pair'
] as const satisfies readonly RouteSpecialKind[];

export const GAMEPLAY_TILE_TRAIT_KINDS = [
    'echo',
    'volatile',
    'mirror',
    'cursed',
    'sealed',
    'heavy',
    'drift',
    'conduit',
    'stasis'
] as const satisfies readonly TileTraitKind[];

export const GAMEPLAY_RUN_STATUSES = [
    'memorize',
    'playing',
    'resolving',
    'paused',
    'levelComplete',
    'gameOver'
] as const satisfies readonly RunStatus[];

export const gameplaySourceSchema = z
    .object({
        kind: z.enum(['bonus_reward', 'relic', 'reward_perk', 'findable', 'power', 'shop', 'trait', 'system']),
        id: z.string().min(1).max(120)
    })
    .strict();

export const gameplayFactsSchema = z
    .object({
        matchedTraits: z.array(z.enum(GAMEPLAY_TILE_TRAIT_KINDS)).default([]),
        adjacentTraits: z.array(z.enum(GAMEPLAY_TILE_TRAIT_KINDS)).default([]),
        matchedFindables: z.array(z.enum(GAMEPLAY_FINDABLE_KINDS)).default([]),
        bossTrophyClaimed: z.boolean().default(false),
        riskWagerOutcome: z.enum(['none', 'won', 'lost']).default('none'),
        featuredObjectiveCompleted: z.boolean().default(false),
        scoreParasiteActive: z.boolean().default(false)
    })
    .strict();

export const gameplayConditionSchema = z.discriminatedUnion('kind', [
    z
        .object({
            kind: z.literal('run.status_is'),
            status: z.enum(GAMEPLAY_RUN_STATUSES)
        })
        .strict(),
    z
        .object({
            kind: z.literal('inventory.at_least'),
            itemId: z.enum(RUN_INVENTORY_ITEM_IDS),
            amount: z.number().int().positive()
        })
        .strict(),
    z
        .object({
            kind: z.literal('reward_perk.active'),
            perkId: z.enum(GAMEPLAY_REWARD_PERK_IDS)
        })
        .strict(),
    z
        .object({
            kind: z.literal('relic.active'),
            relicId: z.enum(GAMEPLAY_RELIC_IDS)
        })
        .strict(),
    z
        .object({
            kind: z.literal('trait.matched'),
            trait: z.enum(GAMEPLAY_TILE_TRAIT_KINDS)
        })
        .strict(),
    z
        .object({
            kind: z.literal('trait.adjacent'),
            trait: z.enum(GAMEPLAY_TILE_TRAIT_KINDS)
        })
        .strict(),
    z
        .object({
            kind: z.literal('trait.any_matched')
        })
        .strict(),
    z
        .object({
            kind: z.literal('streak.at_least'),
            amount: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            kind: z.literal('findable.matched'),
            findable: z.enum(GAMEPLAY_FINDABLE_KINDS)
        })
        .strict(),
    z
        .object({
            kind: z.literal('floor.match_resolutions_is'),
            amount: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            kind: z.literal('boss_trophy.claimed')
        })
        .strict(),
    z
        .object({
            kind: z.literal('risk_wager.outcome_is'),
            outcome: z.enum(['won', 'lost'])
        })
        .strict(),
    z
        .object({
            kind: z.literal('featured_objective.completed')
        })
        .strict(),
    z
        .object({
            kind: z.literal('score_parasite.active')
        })
        .strict()
]);

export const gameplayEffectSchema = z.discriminatedUnion('kind', [
    z
        .object({
            kind: z.literal('inventory.grant'),
            itemId: z.enum(RUN_INVENTORY_ITEM_IDS),
            amount: z.number().int().positive()
        })
        .strict(),
    z
        .object({
            kind: z.literal('inventory.consume'),
            itemId: z.enum(RUN_INVENTORY_ITEM_IDS),
            amount: z.literal(1)
        })
        .strict(),
    z
        .object({
            kind: z.literal('inventory.grant_or_score'),
            itemId: z.enum(RUN_INVENTORY_ITEM_IDS),
            amount: z.number().int().positive(),
            fallbackScore: z.number().int().positive()
        })
        .strict(),
    z
        .object({
            kind: z.literal('reward_perk.grant'),
            perkId: z.enum(GAMEPLAY_REWARD_PERK_IDS)
        })
        .strict(),
    z
        .object({
            kind: z.literal('combo_shard.request'),
            amount: z.number().int().positive()
        })
        .strict(),
    z
        .object({
            kind: z.literal('safe_hazard_ward.request'),
            amount: z.number().int().positive()
        })
        .strict(),
    z
        .object({
            kind: z.literal('currency.grant'),
            currency: z.literal('shop_gold'),
            amount: z.number().int().positive()
        })
        .strict(),
    z
        .object({
            kind: z.literal('score.grant'),
            reason: z.enum(['content_reward', 'trait_reward']),
            amount: z.number().int().positive()
        })
        .strict(),
    z
        .object({
            kind: z.literal('score.request'),
            reason: z.enum(['findable_match', 'boss_trophy']),
            amount: z.number().int().positive()
        })
        .strict(),
    z
        .object({
            kind: z.literal('bonus_relic_pick.grant'),
            amount: z.number().int().positive()
        })
        .strict(),
    z
        .object({
            kind: z.literal('relic_favor.request'),
            reason: z.literal('risk_wager_win'),
            amount: z.number().int().positive()
        })
        .strict(),
    z
        .object({
            kind: z.literal('featured_streak_floor.request'),
            reason: z.literal('risk_wager_loss'),
            amount: z.number().int().positive()
        })
        .strict(),
    z
        .object({
            kind: z.literal('parasite_relief.request'),
            reason: z.literal('featured_objective_clear'),
            amount: z.number().int().positive()
        })
        .strict(),
    z
        .object({
            kind: z.literal('parasite_ward.grant'),
            amount: z.number().int().positive()
        })
        .strict(),
    z
        .object({
            kind: z.literal('relic_favor.grant'),
            amount: z.number().int().positive()
        })
        .strict(),
    z
        .object({
            kind: z.literal('pin_capacity.request'),
            amount: z.number().int().positive()
        })
        .strict(),
    z
        .object({
            kind: z.literal('scout_reveal.request'),
            amount: z.number().int().positive()
        })
        .strict(),
    z
        .object({
            kind: z.literal('free_shuffle.grant')
        })
        .strict(),
    z
        .object({
            kind: z.literal('feedback.emit'),
            cue: z.string().min(1).max(120),
            message: z.string().min(1).max(500),
            tone: z.enum(['reward', 'information', 'warning'])
        })
        .strict()
]);

export const gameplayContentDefinitionSchema = z
    .object({
        id: z.string().min(1).max(120),
        version: z.number().int().positive(),
        buildId: z.string().min(1).max(120),
        source: gameplaySourceSchema,
        trigger: z.enum(['content.claimed', 'trait.match', 'findable.match', 'power.used', 'floor.cleared']),
        conditions: z.array(gameplayConditionSchema),
        effects: z.array(gameplayEffectSchema).min(1)
    })
    .strict();

export const CONDUIT_CARTOGRAPHER_DEFINITIONS = z.array(gameplayContentDefinitionSchema).parse([
    {
        id: 'bonus_reward.echo_conduit_lens',
        version: 1,
        buildId: 'conduit_cartographer',
        source: { kind: 'bonus_reward', id: 'echo_conduit_lens' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'reward_perk.grant', perkId: 'echo_conduit_double' },
            { kind: 'inventory.grant', itemId: 'peek_charge', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.echo_conduit_lens.claimed',
                message: 'Echo Conduit Double unlocked; gained one Peek charge.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'relic.peek_charge_plus_one',
        version: 1,
        buildId: 'conduit_cartographer',
        source: { kind: 'relic', id: 'peek_charge_plus_one' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'inventory.grant', itemId: 'peek_charge', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.peek_relic.claimed',
                message: 'The Seer relic added one Peek charge.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'reward_perk.echo_conduit_double',
        version: 1,
        buildId: 'conduit_cartographer',
        source: { kind: 'reward_perk', id: 'echo_conduit_double' },
        trigger: 'trait.match',
        conditions: [
            { kind: 'reward_perk.active', perkId: 'echo_conduit_double' },
            { kind: 'trait.matched', trait: 'echo' },
            { kind: 'trait.adjacent', trait: 'conduit' }
        ],
        effects: [
            { kind: 'inventory.grant', itemId: 'peek_charge', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.echo_conduit_double.triggered',
                message: 'Echo touched Conduit and created an extra Peek charge.',
                tone: 'reward'
            }
        ]
    }
]);

export const WARDEN_DEFINITIONS = z.array(gameplayContentDefinitionSchema).parse([
    {
        id: 'bonus_reward.hazard_ward',
        version: 1,
        buildId: 'guard_tank',
        source: { kind: 'bonus_reward', id: 'hazard_ward' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'inventory.grant', itemId: 'destroy_charge', amount: 1 },
            { kind: 'inventory.grant', itemId: 'guard_token', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.hazard_ward.claimed',
                message: 'Hazard Ward added one destroy charge and one guard token.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'relic.guard_token_plus_one',
        version: 1,
        buildId: 'guard_tank',
        source: { kind: 'relic', id: 'guard_token_plus_one' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'inventory.grant', itemId: 'guard_token', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.warden_sigil.claimed',
                message: 'The Warden Sigil added one guard token.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'trait.volatile_heavy_guard',
        version: 1,
        buildId: 'guard_tank',
        source: { kind: 'trait', id: 'volatile_heavy_guard' },
        trigger: 'trait.match',
        conditions: [
            { kind: 'trait.matched', trait: 'volatile' },
            { kind: 'trait.adjacent', trait: 'heavy' }
        ],
        effects: [
            { kind: 'inventory.grant', itemId: 'guard_token', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.volatile_heavy_guard.triggered',
                message: 'Volatile pressure met Heavy bracing and created one guard token.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'relic.guard_token_plus_one.mirror_match',
        version: 1,
        buildId: 'guard_tank',
        source: { kind: 'relic', id: 'guard_token_plus_one' },
        trigger: 'trait.match',
        conditions: [
            { kind: 'relic.active', relicId: 'guard_token_plus_one' },
            { kind: 'trait.matched', trait: 'mirror' }
        ],
        effects: [
            { kind: 'inventory.grant_or_score', itemId: 'guard_token', amount: 1, fallbackScore: 20 },
            {
                kind: 'feedback.emit',
                cue: 'build.warden_sigil.mirror_triggered',
                message: 'Mirror invoked the Warden Sigil for guard or overflow score.',
                tone: 'reward'
            }
        ]
    }
]);

export const COMBO_SHARD_ENGINE_DEFINITIONS = z.array(gameplayContentDefinitionSchema).parse([
    {
        id: 'bonus_reward.bonus_shards',
        version: 1,
        buildId: 'combo_shard_engine',
        source: { kind: 'bonus_reward', id: 'bonus_shards' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'inventory.grant', itemId: 'combo_shard', amount: 1 },
            { kind: 'inventory.grant', itemId: 'guard_token', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.bonus_shards.claimed',
                message: 'Bonus Shards added one combo shard and one guard token.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'relic.combo_shard_plus_step',
        version: 1,
        buildId: 'combo_shard_engine',
        source: { kind: 'relic', id: 'combo_shard_plus_step' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'inventory.grant', itemId: 'combo_shard', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.combo_shard_relic.claimed',
                message: 'The Catalyst relic added one combo shard.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'relic.parasite_ward_once',
        version: 1,
        buildId: 'combo_shard_engine',
        source: { kind: 'relic', id: 'parasite_ward_once' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'parasite_ward.grant', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.parasite_ward_once.claimed',
                message: 'Parasite Ward armed one life-loss shield against score-parasite pressure.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'findable.shard_spark',
        version: 1,
        buildId: 'combo_shard_engine',
        source: { kind: 'findable', id: 'shard_spark' },
        trigger: 'findable.match',
        conditions: [{ kind: 'findable.matched', findable: 'shard_spark' }],
        effects: [
            { kind: 'combo_shard.request', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.shard_spark.matched',
                message: 'Shard Spark requested one combo shard through match reward resolution.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'relic.combo_shard_plus_step.sealed_match',
        version: 1,
        buildId: 'combo_shard_engine',
        source: { kind: 'relic', id: 'combo_shard_plus_step' },
        trigger: 'trait.match',
        conditions: [
            { kind: 'relic.active', relicId: 'combo_shard_plus_step' },
            { kind: 'trait.matched', trait: 'sealed' }
        ],
        effects: [
            { kind: 'inventory.grant_or_score', itemId: 'combo_shard', amount: 1, fallbackScore: 18 },
            {
                kind: 'feedback.emit',
                cue: 'build.combo_shard_relic.sealed_triggered',
                message: 'Sealed invoked the Catalyst relic for a combo shard or overflow score.',
                tone: 'reward'
            }
        ]
    }
]);

export const SUPPLY_CACHE_DEFINITIONS = z.array(gameplayContentDefinitionSchema).parse([
    {
        id: 'bonus_reward.supply_cache',
        version: 1,
        buildId: 'emergency_toolkit',
        source: { kind: 'bonus_reward', id: 'supply_cache' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'inventory.grant', itemId: 'destroy_charge', amount: 1 },
            { kind: 'inventory.grant', itemId: 'peek_charge', amount: 1 },
            { kind: 'score.grant', reason: 'content_reward', amount: 10 },
            {
                kind: 'feedback.emit',
                cue: 'build.supply_cache.claimed',
                message: 'Supply Cache added one Peek, one destroy charge, and 10 score.',
                tone: 'reward'
            }
        ]
    }
]);

export const SABOTEUR_DEFINITIONS = z.array(gameplayContentDefinitionSchema).parse([
    {
        id: 'bonus_reward.hazard_banisher',
        version: 1,
        buildId: 'trap_control',
        source: { kind: 'bonus_reward', id: 'hazard_banisher' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'reward_perk.grant', perkId: 'hazard_banish_per_floor' },
            { kind: 'inventory.grant', itemId: 'destroy_charge', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.hazard_banisher.claimed',
                message: 'Hazard Banisher added one destroy charge and armed a floor-start hazard erase.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'relic.destroy_bank_plus_one',
        version: 1,
        buildId: 'trap_control',
        source: { kind: 'relic', id: 'destroy_bank_plus_one' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'inventory.grant', itemId: 'destroy_charge', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.breaker_chisel.claimed',
                message: 'The Breaker Chisel added one destroy-pair charge.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'findable.ward_spark',
        version: 1,
        buildId: 'trap_control',
        source: { kind: 'findable', id: 'ward_spark' },
        trigger: 'findable.match',
        conditions: [{ kind: 'findable.matched', findable: 'ward_spark' }],
        effects: [
            { kind: 'safe_hazard_ward.request', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.ward_spark.matched',
                message: 'Ward Spark armed one safe-hazard ward for this floor.',
                tone: 'reward'
            }
        ]
    }
]);

export const BOARD_TACTICIAN_DEFINITIONS = z.array(gameplayContentDefinitionSchema).parse([
    {
        id: 'bonus_reward.trait_toolkit',
        version: 1,
        buildId: 'trap_control',
        source: { kind: 'bonus_reward', id: 'trait_toolkit' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'inventory.grant', itemId: 'region_shuffle_charge', amount: 1 },
            { kind: 'inventory.grant', itemId: 'peek_charge', amount: 1 },
            { kind: 'score.grant', reason: 'content_reward', amount: 10 },
            {
                kind: 'feedback.emit',
                cue: 'build.trait_toolkit.claimed',
                message: 'Trait Toolkit added one row/swap charge, one Peek, and 10 score.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'bonus_reward.stasis_lockbox',
        version: 1,
        buildId: 'trap_control',
        source: { kind: 'bonus_reward', id: 'stasis_lockbox' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'inventory.grant', itemId: 'region_shuffle_charge', amount: 1 },
            { kind: 'inventory.grant', itemId: 'guard_token', amount: 1 },
            { kind: 'score.grant', reason: 'content_reward', amount: 15 },
            {
                kind: 'feedback.emit',
                cue: 'build.stasis_lockbox.claimed',
                message: 'Stasis Lockbox added one row/swap charge, one guard token, and 15 score.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'bonus_reward.free_swap_floor',
        version: 1,
        buildId: 'trap_control',
        source: { kind: 'bonus_reward', id: 'free_swap_floor' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'reward_perk.grant', perkId: 'free_first_swap_per_floor' },
            { kind: 'score.grant', reason: 'content_reward', amount: 15 },
            {
                kind: 'feedback.emit',
                cue: 'build.free_swap_floor.claimed',
                message: 'Free Swap Discipline armed one free row or swap each floor and added 15 score.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'relic.extra_shuffle_charge',
        version: 1,
        buildId: 'trap_control',
        source: { kind: 'relic', id: 'extra_shuffle_charge' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'inventory.grant', itemId: 'shuffle_charge', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.extra_shuffle_charge.claimed',
                message: 'The shuffle relic added one full-board shuffle charge.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'relic.first_shuffle_free_per_floor',
        version: 1,
        buildId: 'trap_control',
        source: { kind: 'relic', id: 'first_shuffle_free_per_floor' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'free_shuffle.grant' },
            {
                kind: 'feedback.emit',
                cue: 'build.first_shuffle_free_per_floor.claimed',
                message: 'The first full-board shuffle is free now and on each new floor.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'relic.region_shuffle_free_first',
        version: 1,
        buildId: 'trap_control',
        source: { kind: 'relic', id: 'region_shuffle_free_first' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            {
                kind: 'feedback.emit',
                cue: 'build.region_shuffle_free_first.claimed',
                message: 'The first row shuffle or tile swap on each new floor is free.',
                tone: 'reward'
            }
        ]
    }
]);

export const MEMORY_SCOUT_DEFINITIONS = z.array(gameplayContentDefinitionSchema).parse([
    {
        id: 'bonus_reward.trait_streak_lens',
        version: 1,
        buildId: 'memory_scout',
        source: { kind: 'bonus_reward', id: 'trait_streak_lens' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'reward_perk.grant', perkId: 'trait_streak_toolkit' },
            { kind: 'score.grant', reason: 'content_reward', amount: 10 },
            {
                kind: 'feedback.emit',
                cue: 'build.trait_streak_lens.claimed',
                message: 'Trait Streak Lens armed a Flash Pair at clean streak x3 and added 10 score.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'reward_perk.trait_streak_toolkit',
        version: 1,
        buildId: 'memory_scout',
        source: { kind: 'reward_perk', id: 'trait_streak_toolkit' },
        trigger: 'trait.match',
        conditions: [
            { kind: 'reward_perk.active', perkId: 'trait_streak_toolkit' },
            { kind: 'trait.any_matched' },
            { kind: 'streak.at_least', amount: 2 }
        ],
        effects: [
            { kind: 'inventory.grant', itemId: 'flash_pair_charge', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.trait_streak_toolkit.triggered',
                message: 'The clean trait streak banked one Flash Pair charge.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'relic.memorize_bonus_ms',
        version: 1,
        buildId: 'memory_scout',
        source: { kind: 'relic', id: 'memorize_bonus_ms' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            {
                kind: 'feedback.emit',
                cue: 'build.memorize_bonus_ms.claimed',
                message: 'Lantern Study added 280 ms to future study windows.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'relic.memorize_under_short_memorize',
        version: 1,
        buildId: 'memory_scout',
        source: { kind: 'relic', id: 'memorize_under_short_memorize' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            {
                kind: 'feedback.emit',
                cue: 'build.memorize_under_short_memorize.claimed',
                message: 'Compressed Margins adds 220 ms whenever Short Memorize is active.',
                tone: 'reward'
            }
        ]
    }
]);

export const LOCKSMITH_DEFINITIONS = z.array(gameplayContentDefinitionSchema).parse([
    {
        id: 'bonus_reward.key_insurance',
        version: 1,
        buildId: 'locksmith',
        source: { kind: 'bonus_reward', id: 'key_insurance' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'inventory.grant', itemId: 'iron_key', amount: 1 },
            { kind: 'currency.grant', currency: 'shop_gold', amount: 1 },
            { kind: 'score.grant', reason: 'content_reward', amount: 10 },
            {
                kind: 'feedback.emit',
                cue: 'build.key_insurance.claimed',
                message: 'Key Insurance added one iron key, one shop gold, and 10 score.',
                tone: 'reward'
            }
        ]
    }
]);

export const VAULTBREAKER_DEFINITIONS = z.array(gameplayContentDefinitionSchema).parse([
    {
        id: 'bonus_reward.chest_gold',
        version: 1,
        buildId: 'treasure_greed',
        source: { kind: 'bonus_reward', id: 'chest_gold' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'inventory.grant', itemId: 'iron_key', amount: 1 },
            { kind: 'currency.grant', currency: 'shop_gold', amount: 2 },
            { kind: 'score.grant', reason: 'content_reward', amount: 25 },
            {
                kind: 'feedback.emit',
                cue: 'build.chest_gold.claimed',
                message: 'Treasure chest added one iron key, two shop gold, and 25 score.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'bonus_reward.cursed_opener_contract',
        version: 1,
        buildId: 'treasure_greed',
        source: { kind: 'bonus_reward', id: 'cursed_opener_contract' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'reward_perk.grant', perkId: 'cursed_opener_greed' },
            { kind: 'currency.grant', currency: 'shop_gold', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.cursed_opener_contract.claimed',
                message: 'Cursed Opener armed the first clean Cursed match and added one shop gold.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'reward_perk.cursed_opener_greed',
        version: 1,
        buildId: 'treasure_greed',
        source: { kind: 'reward_perk', id: 'cursed_opener_greed' },
        trigger: 'trait.match',
        conditions: [
            { kind: 'reward_perk.active', perkId: 'cursed_opener_greed' },
            { kind: 'trait.matched', trait: 'cursed' },
            { kind: 'floor.match_resolutions_is', amount: 0 }
        ],
        effects: [
            { kind: 'currency.grant', currency: 'shop_gold', amount: 1 },
            { kind: 'score.grant', reason: 'trait_reward', amount: 25 },
            {
                kind: 'feedback.emit',
                cue: 'build.cursed_opener_greed.triggered',
                message: 'The clean Cursed opener paid one shop gold and 25 score.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'relic.shrine_echo',
        version: 1,
        buildId: 'treasure_greed',
        source: { kind: 'relic', id: 'shrine_echo' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'bonus_relic_pick.grant', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.shrine_echo.claimed',
                message: 'Shrine Echo banked one extra pick for the next relic offer.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'relic.shrine_echo.treasure_claim',
        version: 1,
        buildId: 'treasure_greed',
        source: { kind: 'relic', id: 'shrine_echo' },
        trigger: 'content.claimed',
        conditions: [{ kind: 'relic.active', relicId: 'shrine_echo' }],
        effects: [
            { kind: 'relic_favor.grant', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.shrine_echo.treasure_claimed',
                message: 'Shrine Echo converted the first treasure claim into one Favor progress.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'findable.score_glint',
        version: 1,
        buildId: 'treasure_greed',
        source: { kind: 'findable', id: 'score_glint' },
        trigger: 'findable.match',
        conditions: [{ kind: 'findable.matched', findable: 'score_glint' }],
        effects: [
            { kind: 'score.request', reason: 'findable_match', amount: 25 },
            {
                kind: 'feedback.emit',
                cue: 'build.score_glint.matched',
                message: 'Score Glint requested 25 score through match resolution.',
                tone: 'reward'
            }
        ]
    }
]);

export const SLAYER_DEFINITIONS = z.array(gameplayContentDefinitionSchema).parse([
    {
        id: 'relic.chapter_compass',
        version: 1,
        buildId: 'boss_hunter',
        source: { kind: 'relic', id: 'chapter_compass' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'inventory.grant', itemId: 'peek_charge', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.chapter_compass.claimed',
                message: 'Chapter Compass added one Peek charge and aligned future boss preparation.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'relic.wager_surety',
        version: 1,
        buildId: 'boss_hunter',
        source: { kind: 'relic', id: 'wager_surety' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'inventory.grant', itemId: 'guard_token', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.wager_surety.claimed',
                message: 'Wager Surety added one guard token and insured future objective wagers.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'relic.parasite_ledger',
        version: 1,
        buildId: 'boss_hunter',
        source: { kind: 'relic', id: 'parasite_ledger' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'parasite_ward.grant', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.parasite_ledger.claimed',
                message: 'Parasite Ledger added one ward and linked featured objectives to parasite relief.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'relic.chapter_compass.boss_trophy',
        version: 1,
        buildId: 'boss_hunter',
        source: { kind: 'relic', id: 'chapter_compass' },
        trigger: 'floor.cleared',
        conditions: [
            { kind: 'relic.active', relicId: 'chapter_compass' },
            { kind: 'boss_trophy.claimed' }
        ],
        effects: [
            { kind: 'score.request', reason: 'boss_trophy', amount: 30 },
            {
                kind: 'feedback.emit',
                cue: 'build.chapter_compass.boss_trophy',
                message: 'Chapter Compass converted the claimed boss trophy into 30 bonus score.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'relic.wager_surety.wager_won',
        version: 1,
        buildId: 'boss_hunter',
        source: { kind: 'relic', id: 'wager_surety' },
        trigger: 'floor.cleared',
        conditions: [
            { kind: 'relic.active', relicId: 'wager_surety' },
            { kind: 'risk_wager.outcome_is', outcome: 'won' }
        ],
        effects: [
            { kind: 'relic_favor.request', reason: 'risk_wager_win', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.wager_surety.wager_won',
                message: 'Wager Surety added one Favor to the successful objective wager.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'relic.wager_surety.wager_lost',
        version: 1,
        buildId: 'boss_hunter',
        source: { kind: 'relic', id: 'wager_surety' },
        trigger: 'floor.cleared',
        conditions: [
            { kind: 'relic.active', relicId: 'wager_surety' },
            { kind: 'risk_wager.outcome_is', outcome: 'lost' }
        ],
        effects: [
            { kind: 'featured_streak_floor.request', reason: 'risk_wager_loss', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.wager_surety.wager_lost',
                message: 'Wager Surety preserved a one-step featured-objective streak after the loss.',
                tone: 'information'
            }
        ]
    },
    {
        id: 'relic.parasite_ledger.featured_objective',
        version: 1,
        buildId: 'boss_hunter',
        source: { kind: 'relic', id: 'parasite_ledger' },
        trigger: 'floor.cleared',
        conditions: [
            { kind: 'relic.active', relicId: 'parasite_ledger' },
            { kind: 'featured_objective.completed' },
            { kind: 'score_parasite.active' }
        ],
        effects: [
            { kind: 'parasite_relief.request', reason: 'featured_objective_clear', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.parasite_ledger.objective_clear',
                message: 'Parasite Ledger reduced score-parasite pressure by one floor.',
                tone: 'reward'
            }
        ]
    }
]);

export const SEER_DEFINITIONS = z.array(gameplayContentDefinitionSchema).parse([
    {
        id: 'bonus_reward.secret_favor',
        version: 1,
        buildId: 'reveal_scout',
        source: { kind: 'bonus_reward', id: 'secret_favor' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'relic_favor.grant', amount: 1 },
            { kind: 'inventory.grant', itemId: 'peek_charge', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.secret_favor.claimed',
                message: 'Secret Shrine added one Favor progress and one Peek charge.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'relic.stray_charge_plus_one',
        version: 1,
        buildId: 'reveal_scout',
        source: { kind: 'relic', id: 'stray_charge_plus_one' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'inventory.grant', itemId: 'stray_remove_charge', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.stray_hook.claimed',
                message: 'Stray Hook added one completion-safe stray-removal charge.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'relic.pin_cap_plus_one',
        version: 1,
        buildId: 'reveal_scout',
        source: { kind: 'relic', id: 'pin_cap_plus_one' },
        trigger: 'content.claimed',
        conditions: [],
        effects: [
            { kind: 'pin_capacity.request', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.memory_nail.claimed',
                message: 'Memory Nail expanded simultaneous pin capacity by one tile.',
                tone: 'reward'
            }
        ]
    },
    {
        id: 'findable.scout_glint',
        version: 1,
        buildId: 'reveal_scout',
        source: { kind: 'findable', id: 'scout_glint' },
        trigger: 'findable.match',
        conditions: [{ kind: 'findable.matched', findable: 'scout_glint' }],
        effects: [
            { kind: 'scout_reveal.request', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.scout_glint.matched',
                message: 'Scout Glint requested one deterministic hazard or dungeon-family reveal.',
                tone: 'information'
            }
        ]
    }
]);

export const GAMEPLAY_CONTENT_DEFINITIONS = [
    ...CONDUIT_CARTOGRAPHER_DEFINITIONS,
    ...WARDEN_DEFINITIONS,
    ...COMBO_SHARD_ENGINE_DEFINITIONS,
    ...SUPPLY_CACHE_DEFINITIONS,
    ...SABOTEUR_DEFINITIONS,
    ...BOARD_TACTICIAN_DEFINITIONS,
    ...MEMORY_SCOUT_DEFINITIONS,
    ...LOCKSMITH_DEFINITIONS,
    ...VAULTBREAKER_DEFINITIONS,
    ...SLAYER_DEFINITIONS,
    ...SEER_DEFINITIONS
] as const satisfies readonly GameplayContentDefinition[];

export type GameplaySource = z.infer<typeof gameplaySourceSchema>;
export type GameplayFacts = z.infer<typeof gameplayFactsSchema>;
export type GameplayCondition = z.infer<typeof gameplayConditionSchema>;
export type GameplayEffect = z.infer<typeof gameplayEffectSchema>;
export type GameplayContentDefinition = z.infer<typeof gameplayContentDefinitionSchema>;

const commandBase = {
    schemaVersion: z.literal(GAMEPLAY_CORE_SCHEMA_VERSION),
    commandId: z.string().min(1).max(160)
};

export const gameplayPauseTimerSnapshotSchema = z
    .object({
        memorizeRemainingMs: z.number().int().nonnegative().nullable(),
        resolveRemainingMs: z.number().int().nonnegative().nullable(),
        debugRevealRemainingMs: z.number().int().nonnegative().nullable()
    })
    .strict();

export type GameplayPauseTimerSnapshot = z.infer<typeof gameplayPauseTimerSnapshotSchema>;

export const GAMEPLAY_DEBUG_REVEAL_DEACTIVATION_REASONS = [
    'timer_elapsed',
    'resume_expired',
    'phase_ended'
] as const;

export type GameplayDebugRevealDeactivationReason =
    (typeof GAMEPLAY_DEBUG_REVEAL_DEACTIVATION_REASONS)[number];

export const gameplayCommandSchema = z.discriminatedUnion('type', [
    z
        .object({
            ...commandBase,
            type: z.literal('phase.memorize_complete')
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('run.gauntlet_expire'),
            observedAtMs: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('run.pause'),
            observedAtMs: z.number().int().nonnegative(),
            timerSnapshot: gameplayPauseTimerSnapshotSchema
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('run.resume'),
            observedAtMs: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('debug.reveal_activate'),
            disableAchievementsOnDebug: z.boolean()
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('debug.reveal_deactivate'),
            reason: z.enum(GAMEPLAY_DEBUG_REVEAL_DEACTIVATION_REASONS)
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('run.progression_repair')
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('effects.apply'),
            definitionId: z.string().min(1).max(120),
            definitionVersion: z.number().int().positive(),
            facts: gameplayFactsSchema.default({
                matchedTraits: [],
                adjacentTraits: [],
                matchedFindables: [],
                bossTrophyClaimed: false,
                riskWagerOutcome: 'none',
                featuredObjectiveCompleted: false,
                scoreParasiteActive: false
            })
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('board.peek'),
            targetTileId: z.string().min(1).max(160)
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('board.tile_flip'),
            targetTileId: z.string().min(1).max(160)
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('enemy_hazard.contact'),
            targetTileId: z.string().min(1).max(160),
            advanceHazards: z.boolean()
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('board.pin_toggle'),
            targetTileId: z.string().min(1).max(160)
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('board.stray_remove'),
            targetTileId: z.string().min(1).max(160)
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('board.destroy_pair'),
            targetTileId: z.string().min(1).max(160)
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('risk_wager.accept')
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('board.gambit_commit'),
            targetTileId: z.string().min(1).max(160)
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('board.shuffle')
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('board.region_shuffle'),
            rowIndex: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('board.tile_swap'),
            firstTileId: z.string().min(1).max(160),
            secondTileId: z.string().min(1).max(160)
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('board.flash_pair')
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('board.undo_resolve')
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('shop.purchase'),
            offerId: z.string().min(1).max(160)
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('shop.reroll')
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('dungeon.exit_activate'),
            spend: z.enum(['none', 'key', 'master_key'])
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('floor.parasite_advance')
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('floor.hazard_banish')
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('floor.advance')
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('route.choose'),
            choiceId: z.string().min(1).max(160)
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('side_room.resolve'),
            action: z.enum(['claim', 'skip']),
            choiceId: z.string().min(1).max(200).optional()
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('relic.offer_open')
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('relic.pick'),
            relicId: z.enum(GAMEPLAY_RELIC_IDS)
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('relic.offer_service_use'),
            serviceId: z.enum(GAMEPLAY_RELIC_OFFER_SERVICE_IDS),
            targetRelicId: z.enum(GAMEPLAY_RELIC_IDS).optional()
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('board.turn_resolve'),
            encorePairKeys: z.array(z.string().min(1).max(160)).max(80).default([])
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('wild_match.consume'),
            wildTileId: z.string().min(1).max(160),
            pairedTileId: z.string().min(1).max(160)
        })
        .strict()
]);

const eventBase = {
    schemaVersion: z.literal(GAMEPLAY_CORE_SCHEMA_VERSION),
    eventId: z.string().min(1).max(220),
    commandId: z.string().min(1).max(160),
    sequence: z.number().int().nonnegative(),
    source: gameplaySourceSchema
};

const boardTurnObjectiveSnapshotSchema = z
    .object({
        label: z.string().min(1).max(160),
        progress: z.number().int().nonnegative(),
        required: z.number().int().nonnegative()
    })
    .strict();

const boardTurnHazardTileCountersSchema = z
    .object({
        totalTriggers: z.number().int().nonnegative(),
        shuffleSnares: z.number().int().nonnegative(),
        cascadeCaches: z.number().int().nonnegative(),
        mirrorDecoys: z.number().int().nonnegative(),
        fragileCacheClaims: z.number().int().nonnegative(),
        fragileCacheBreaks: z.number().int().nonnegative(),
        tollCaches: z.number().int().nonnegative(),
        fuseCaches: z.number().int().nonnegative(),
        fuseExpiredClaims: z.number().int().nonnegative()
    })
    .strict();

const boardTurnScoutCountersSchema = z
    .object({
        lanternWard: z.number().int().nonnegative(),
        omenSeal: z.number().int().nonnegative()
    })
    .strict();

const boardTurnMimicCacheCountersSchema = z
    .object({
        claims: z.number().int().nonnegative(),
        bites: z.number().int().nonnegative(),
        guardBites: z.number().int().nonnegative()
    })
    .strict();

const boardTurnRouteSpecialCountersSchema = z
    .object({
        anchorSealUses: z.number().int().nonnegative(),
        loadedGatewayPlans: z.number().int().nonnegative(),
        catalystAltarUpgrades: z.number().int().nonnegative(),
        parasiteVesselConversions: z.number().int().nonnegative(),
        pinLatticeRewards: z.number().int().nonnegative()
    })
    .strict();

export const boardTurnAnnouncementFactsSchema = z
    .object({
        matchedPairsBefore: z.number().int().nonnegative(),
        matchedPairsAfter: z.number().int().nonnegative(),
        pairCountBefore: z.number().int().nonnegative(),
        pairCountAfter: z.number().int().nonnegative(),
        shopGoldBefore: z.number().int().nonnegative(),
        shopGoldAfter: z.number().int().nonnegative(),
        shuffleChargesBefore: z.number().int().nonnegative(),
        shuffleChargesAfter: z.number().int().nonnegative(),
        regionShuffleChargesBefore: z.number().int().nonnegative(),
        regionShuffleChargesAfter: z.number().int().nonnegative(),
        stickyBlockIndexBefore: z.number().int().nonnegative().nullable(),
        stickyBlockIndexAfter: z.number().int().nonnegative().nullable(),
        matchedTraitKinds: z.array(z.enum(GAMEPLAY_TILE_TRAIT_KINDS)),
        mismatchedTraitKinds: z.array(z.enum(GAMEPLAY_TILE_TRAIT_KINDS)),
        volatileTraitShufflesBefore: z.number().int().nonnegative(),
        volatileTraitShufflesAfter: z.number().int().nonnegative(),
        objectiveBefore: boardTurnObjectiveSnapshotSchema.nullable(),
        objectiveAfter: boardTurnObjectiveSnapshotSchema.nullable(),
        recallFocusBefore: z.number().int().nonnegative(),
        recallFocusAfter: z.number().int().nonnegative(),
        recallMatchesBefore: z.number().int().nonnegative(),
        recallMatchesAfter: z.number().int().nonnegative(),
        recallMistakesBefore: z.number().int().nonnegative(),
        recallMistakesAfter: z.number().int().nonnegative(),
        recallBonusScoreBefore: z.number().int().nonnegative(),
        recallBonusScoreAfter: z.number().int().nonnegative(),
        forgottenTileCountBefore: z.number().int().nonnegative(),
        forgottenTileCountAfter: z.number().int().nonnegative(),
        dungeonEnemiesDefeatedBefore: z.number().int().nonnegative(),
        dungeonEnemiesDefeatedAfter: z.number().int().nonnegative(),
        enemyHazardHitsBefore: z.number().int().nonnegative(),
        enemyHazardHitsAfter: z.number().int().nonnegative(),
        enemyHazardsDefeatedBefore: z.number().int().nonnegative(),
        enemyHazardsDefeatedAfter: z.number().int().nonnegative(),
        hazardTilesBefore: boardTurnHazardTileCountersSchema,
        hazardTilesAfter: boardTurnHazardTileCountersSchema,
        scoutsBefore: boardTurnScoutCountersSchema,
        scoutsAfter: boardTurnScoutCountersSchema,
        mimicCacheBefore: boardTurnMimicCacheCountersSchema,
        mimicCacheAfter: boardTurnMimicCacheCountersSchema,
        routeSpecialsBefore: boardTurnRouteSpecialCountersSchema,
        routeSpecialsAfter: boardTurnRouteSpecialCountersSchema,
        safeHazardWardsUsedBefore: z.number().int().nonnegative(),
        safeHazardWardsUsedAfter: z.number().int().nonnegative()
    })
    .strict();

export type BoardTurnAnnouncementFacts = z.infer<typeof boardTurnAnnouncementFactsSchema>;

export const gameplayEventSchema = z.discriminatedUnion('type', [
    z
        .object({
            ...eventBase,
            type: z.literal('phase.memorize_completed'),
            floor: z.number().int().positive(),
            memorizeRemainingMsBefore: z.number().int().nonnegative().nullable(),
            recallFocusBefore: z.number().int().nonnegative(),
            recallFocusAfter: z.number().int().nonnegative(),
            pendingMemorizeBonusMs: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('run.gauntlet_expired'),
            observedAtMs: z.number().int().nonnegative(),
            deadlineMs: z.number().int().nonnegative(),
            overdueMs: z.number().int().positive(),
            statusBefore: z.enum(['memorize', 'playing', 'resolving']),
            livesBefore: z.number().int().positive(),
            livesAfter: z.literal(0)
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('run.paused'),
            observedAtMs: z.number().int().nonnegative(),
            statusBefore: z.enum(['memorize', 'playing', 'resolving']),
            statusAfter: z.literal('paused'),
            gauntletDeadlineMs: z.number().int().nonnegative().nullable(),
            gauntletPausedAtMs: z.number().int().nonnegative().nullable(),
            timerSnapshot: gameplayPauseTimerSnapshotSchema
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('run.resumed'),
            observedAtMs: z.number().int().nonnegative(),
            pausedFromStatus: z.enum(['memorize', 'playing', 'resolving']),
            statusAfter: z.enum(['memorize', 'playing', 'resolving', 'gameOver']),
            outcome: z.enum(['resumed', 'recovered_to_playing', 'game_over']),
            gauntletDeadlineMsBefore: z.number().int().nonnegative().nullable(),
            gauntletDeadlineMsAfter: z.number().int().nonnegative().nullable(),
            gauntletPauseDurationMs: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('debug.reveal_activated'),
            outcome: z.enum(['activated', 'refreshed']),
            revealDurationMs: z.number().int().positive(),
            debugUsedBefore: z.boolean(),
            debugUsedAfter: z.literal(true),
            achievementsEnabledBefore: z.boolean(),
            achievementsEnabledAfter: z.boolean()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('debug.reveal_deactivated'),
            reason: z.enum(GAMEPLAY_DEBUG_REVEAL_DEACTIVATION_REASONS),
            debugRevealRemainingMsBefore: z.number().int().nonnegative().nullable(),
            debugPeekActiveAfter: z.literal(false)
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('run.progression_repaired'),
            repairKinds: z.array(z.enum(RUN_PROGRESSION_REPAIR_KINDS)).min(1).max(RUN_PROGRESSION_REPAIR_KINDS.length),
            exitTileId: z.string().min(1).max(160).nullable(),
            exitLockKindBefore: z.enum(['none', 'lever', 'iron', 'treasure', 'shrine', 'boss', 'trap']),
            exitLockKindAfter: z.enum(['none', 'lever', 'iron', 'treasure', 'shrine', 'boss', 'trap']),
            exitRequiredLeverCountBefore: z.number().int().nonnegative(),
            exitRequiredLeverCountAfter: z.number().int().nonnegative(),
            enemyHazardIdsDefeated: z.array(z.string().min(1).max(160)).max(32),
            dungeonEnemiesDefeatedBefore: z.number().int().nonnegative(),
            dungeonEnemiesDefeatedAfter: z.number().int().nonnegative(),
            dungeonEnemiesDefeatedThisFloorBefore: z.number().int().nonnegative(),
            dungeonEnemiesDefeatedThisFloorAfter: z.number().int().nonnegative(),
            enemyHazardsDefeatedThisFloorBefore: z.number().int().nonnegative(),
            enemyHazardsDefeatedThisFloorAfter: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('inventory.changed'),
            itemId: z.enum(RUN_INVENTORY_ITEM_IDS),
            operation: z.enum(['grant', 'consume']),
            requested: z.number().int().positive(),
            applied: z.number().int(),
            before: z.number().int().nonnegative(),
            after: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('reward_perk.granted'),
            perkId: z.enum(GAMEPLAY_REWARD_PERK_IDS),
            newlyGranted: z.boolean()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('score.changed'),
            reason: z.enum(['inventory_overflow', 'content_reward', 'trait_reward']),
            amount: z.number().int().positive(),
            totalBefore: z.number().int().nonnegative(),
            totalAfter: z.number().int().nonnegative(),
            currentLevelBefore: z.number().int().nonnegative(),
            currentLevelAfter: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('score.requested'),
            reason: z.enum(['findable_match', 'boss_trophy']),
            amount: z.number().int().positive()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('relic_favor.requested'),
            reason: z.literal('risk_wager_win'),
            amount: z.number().int().positive()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('featured_streak_floor.requested'),
            reason: z.literal('risk_wager_loss'),
            amount: z.number().int().positive()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('parasite_relief.requested'),
            reason: z.literal('featured_objective_clear'),
            amount: z.number().int().positive()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('parasite_ward.changed'),
            requested: z.number().int().positive(),
            applied: z.number().int().nonnegative(),
            before: z.number().int().nonnegative(),
            after: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('relic_favor.changed'),
            requested: z.number().int().positive(),
            progressBefore: z.number().int().nonnegative(),
            progressAfter: z.number().int().nonnegative(),
            bonusPicksBefore: z.number().int().nonnegative(),
            bonusPicksAfter: z.number().int().nonnegative(),
            favorBonusPicksBefore: z.number().int().nonnegative(),
            favorBonusPicksAfter: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('pin_capacity.requested'),
            amount: z.number().int().positive()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('scout_reveal.requested'),
            amount: z.number().int().positive()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('board.tile_flipped'),
            targetTileId: z.string().min(1).max(160),
            outcome: z.enum([
                'flipped',
                'trap_triggered',
                'exit_revealed',
                'shop_revealed',
                'room_resolved',
                'cleanup'
            ]),
            tileStateBefore: z.enum(['hidden', 'flipped', 'matched', 'removed']),
            tileStateAfter: z.enum(['hidden', 'flipped', 'matched', 'removed']),
            flippedTileIdsBefore: z.array(z.string().min(1).max(160)).max(3),
            flippedTileIdsAfter: z.array(z.string().min(1).max(160)).max(3),
            statusBefore: z.enum(GAMEPLAY_RUN_STATUSES),
            statusAfter: z.enum(GAMEPLAY_RUN_STATUSES),
            resolveDelayMs: z.number().int().nonnegative().nullable(),
            trapsTriggeredBefore: z.number().int().nonnegative(),
            trapsTriggeredAfter: z.number().int().nonnegative(),
            livesBefore: z.number().int().nonnegative(),
            livesAfter: z.number().int().nonnegative(),
            enemyHazardIdsDefeated: z.array(z.string().min(1).max(160)).max(32).default([]),
            dungeonEnemiesDefeatedBefore: z.number().int().nonnegative().default(0),
            dungeonEnemiesDefeatedAfter: z.number().int().nonnegative().default(0),
            dungeonEnemiesDefeatedThisFloorBefore: z.number().int().nonnegative().default(0),
            dungeonEnemiesDefeatedThisFloorAfter: z.number().int().nonnegative().default(0),
            enemyHazardsDefeatedThisFloorBefore: z.number().int().nonnegative().default(0),
            enemyHazardsDefeatedThisFloorAfter: z.number().int().nonnegative().default(0),
            boardComplete: z.boolean()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('enemy_hazard.contacted'),
            hazardId: z.string().min(1).max(160),
            targetTileId: z.string().min(1).max(160),
            advanceHazards: z.boolean(),
            damage: z.number().int().nonnegative(),
            guardTokensBefore: z.number().int().nonnegative(),
            guardTokensAfter: z.number().int().nonnegative(),
            livesBefore: z.number().int().nonnegative(),
            livesAfter: z.number().int().nonnegative(),
            pendingMemorizeBonusBefore: z.number().int().nonnegative(),
            pendingMemorizeBonusAfter: z.number().int().nonnegative(),
            hazardTurnBefore: z.number().int().nonnegative(),
            hazardTurnAfter: z.number().int().nonnegative(),
            enemyHazardHitsBefore: z.number().int().nonnegative(),
            enemyHazardHitsAfter: z.number().int().nonnegative(),
            gameOver: z.boolean()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('board.pin_changed'),
            targetTileId: z.string().min(1).max(160),
            pinned: z.boolean(),
            pinnedCountBefore: z.number().int().nonnegative(),
            pinnedCountAfter: z.number().int().nonnegative(),
            pinCapacity: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('board.stray_removed'),
            targetTileId: z.string().min(1).max(160),
            strayChargesBefore: z.number().int().nonnegative(),
            strayChargesAfter: z.number().int().nonnegative(),
            recallFocusBefore: z.number().int().nonnegative(),
            recallFocusAfter: z.number().int().nonnegative(),
            forgottenTileCountBefore: z.number().int().nonnegative(),
            forgottenTileCountAfter: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('board.pair_destroyed'),
            targetTileId: z.string().min(1).max(160),
            pairKey: z.string().min(1).max(160),
            destroyedTileIds: z.tuple([
                z.string().min(1).max(160),
                z.string().min(1).max(160)
            ]),
            destroyChargesBefore: z.number().int().positive(),
            destroyChargesAfter: z.number().int().nonnegative(),
            matchedPairsBefore: z.number().int().nonnegative(),
            matchedPairsAfter: z.number().int().nonnegative(),
            recallFocusBefore: z.number().int().nonnegative(),
            recallFocusAfter: z.number().int().nonnegative(),
            forgottenTileCountBefore: z.number().int().nonnegative(),
            forgottenTileCountAfter: z.number().int().nonnegative(),
            parasitePressureBefore: z.number().int().nonnegative(),
            parasitePressureAfter: z.number().int().nonnegative(),
            shiftingSpotlightNonceBefore: z.number().int().nonnegative(),
            shiftingSpotlightNonceAfter: z.number().int().nonnegative(),
            boardComplete: z.boolean()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('risk_wager.accepted'),
            acceptedOnLevel: z.number().int().positive(),
            targetLevel: z.number().int().positive(),
            streakAtRisk: z.number().int().nonnegative(),
            bonusFavorOnSuccess: z.number().int().positive()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('board.gambit_commit.requested'),
            targetTileId: z.string().min(1).max(160),
            committedTileIds: z.tuple([
                z.string().min(1).max(160),
                z.string().min(1).max(160),
                z.string().min(1).max(160)
            ])
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('free_shuffle.changed'),
            before: z.boolean(),
            after: z.literal(true)
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('board.shuffled'),
            affectedTileIds: z.array(z.string().min(1).max(160)),
            shuffleNonceBefore: z.number().int().nonnegative(),
            shuffleNonceAfter: z.number().int().nonnegative(),
            recallFocusBefore: z.number().int().nonnegative(),
            recallFocusAfter: z.number().int().nonnegative(),
            forgottenTileCountBefore: z.number().int().nonnegative(),
            forgottenTileCountAfter: z.number().int().nonnegative(),
            usedFreeCharge: z.boolean()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('board.region_shuffled'),
            rowIndex: z.number().int().nonnegative(),
            affectedTileIds: z.array(z.string().min(1).max(160)),
            shuffleNonceBefore: z.number().int().nonnegative(),
            shuffleNonceAfter: z.number().int().nonnegative(),
            recallFocusBefore: z.number().int().nonnegative(),
            recallFocusAfter: z.number().int().nonnegative(),
            forgottenTileCountBefore: z.number().int().nonnegative(),
            forgottenTileCountAfter: z.number().int().nonnegative(),
            usedFreeCharge: z.boolean()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('board.tiles_swapped'),
            firstTileId: z.string().min(1).max(160),
            secondTileId: z.string().min(1).max(160),
            shuffleNonceBefore: z.number().int().nonnegative(),
            shuffleNonceAfter: z.number().int().nonnegative(),
            recallFocusBefore: z.number().int().nonnegative(),
            recallFocusAfter: z.number().int().nonnegative(),
            forgottenTileCountBefore: z.number().int().nonnegative(),
            forgottenTileCountAfter: z.number().int().nonnegative(),
            usedFreeCharge: z.boolean()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('board.flash_pair_revealed'),
            revealedTileIds: z.tuple([z.string().min(1).max(160), z.string().min(1).max(160)]),
            flashChargesBefore: z.number().int().nonnegative(),
            flashChargesAfter: z.number().int().nonnegative(),
            shuffleNonceBefore: z.number().int().nonnegative(),
            shuffleNonceAfter: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('board.resolve_undone'),
            restoredTileIds: z.array(z.string().min(1).max(160)),
            undoUsesBefore: z.number().int().nonnegative(),
            undoUsesAfter: z.number().int().nonnegative(),
            recallFocusBefore: z.number().int().nonnegative(),
            recallFocusAfter: z.number().int().nonnegative(),
            forgottenTileCountBefore: z.number().int().nonnegative(),
            forgottenTileCountAfter: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('shop.offer_purchased'),
            offerId: z.string().min(1).max(160),
            itemId: z.string().min(1).max(120),
            cost: z.number().int().nonnegative(),
            shopGoldBefore: z.number().int().nonnegative(),
            shopGoldAfter: z.number().int().nonnegative(),
            masterKeysBefore: z.number().int().nonnegative(),
            masterKeysAfter: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('shop.stock_rerolled'),
            floor: z.number().int().positive(),
            cost: z.number().int().positive(),
            shopGoldBefore: z.number().int().nonnegative(),
            shopGoldAfter: z.number().int().nonnegative(),
            rerollsBefore: z.number().int().nonnegative(),
            rerollsAfter: z.number().int().positive(),
            offerIdsBefore: z.array(z.string().min(1).max(160)).max(16),
            offerIdsAfter: z.array(z.string().min(1).max(160)).min(1).max(16),
            itemIdsBefore: z.array(z.string().min(1).max(120)).max(16),
            itemIdsAfter: z.array(z.string().min(1).max(120)).min(1).max(16)
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('dungeon.exit_activated'),
            exitTileId: z.string().min(1).max(160),
            spend: z.enum(['none', 'key', 'master_key']),
            keyKind: z.enum(['iron', 'treasure', 'shrine', 'boss', 'trap']).nullable(),
            masterKeysBefore: z.number().int().nonnegative(),
            masterKeysAfter: z.number().int().nonnegative(),
            gatewayUsesBefore: z.number().int().nonnegative(),
            gatewayUsesAfter: z.number().int().nonnegative(),
            routeType: z.string().min(1).max(80).nullable()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('score_parasite.advanced'),
            active: z.boolean(),
            pressureBefore: z.number().int().nonnegative(),
            pressureAfter: z.number().int().nonnegative(),
            wardBefore: z.number().int().nonnegative(),
            wardAfter: z.number().int().nonnegative(),
            livesBefore: z.number().int().nonnegative(),
            livesAfter: z.number().int().nonnegative(),
            thresholdTriggered: z.boolean(),
            wardConsumed: z.boolean(),
            lifeLost: z.boolean()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('hazard_banish.resolved'),
            outcome: z.enum(['contract_blocked', 'hazard_removed', 'destroy_charge_granted']),
            floor: z.number().int().positive(),
            targetPairKey: z.string().min(1).max(160).nullable(),
            hazardKind: z.string().min(1).max(120).nullable(),
            affectedTileIds: z.array(z.string().min(1).max(160)),
            destroyChargesBefore: z.number().int().nonnegative(),
            destroyChargesAfter: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('floor.advanced'),
            fromFloor: z.number().int().nonnegative(),
            toFloor: z.number().int().positive(),
            outcome: z.enum(['memorize', 'game_over']),
            nextFloorTag: z.enum(['normal', 'breather', 'boss']).nullable(),
            nextFloorArchetypeId: z.string().min(1).max(120).nullable(),
            nextFeaturedObjectiveId: z.string().min(1).max(120).nullable(),
            selectedDungeonNodeId: z.string().min(1).max(160).nullable(),
            boardPairCount: z.number().int().nonnegative(),
            boardTileCount: z.number().int().nonnegative(),
            memorizeRemainingMs: z.number().int().nonnegative().nullable(),
            livesBefore: z.number().int().nonnegative(),
            livesAfter: z.number().int().nonnegative(),
            parasitePressureBefore: z.number().int().nonnegative(),
            parasitePressureAfter: z.number().int().nonnegative(),
            parasiteWardBefore: z.number().int().nonnegative(),
            parasiteWardAfter: z.number().int().nonnegative(),
            hazardBanishOutcome: z.enum(['contract_blocked', 'hazard_removed', 'destroy_charge_granted']).nullable(),
            destroyChargesBefore: z.number().int().nonnegative(),
            destroyChargesAfter: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('route.choice_selected'),
            choiceId: z.string().min(1).max(160),
            routeType: z.enum(['safe', 'greed', 'mystery']),
            outcome: z.enum([
                'safe_life',
                'safe_guard',
                'safe_guard_capped',
                'greed',
                'mystery_shop_gold',
                'mystery_combo_shard',
                'mystery_combo_shard_capped',
                'mystery_relic_favor'
            ]),
            summaryText: z.string().min(1).max(500),
            selectedDungeonNodeId: z.string().min(1).max(160).nullable(),
            livesBefore: z.number().int().nonnegative(),
            livesAfter: z.number().int().nonnegative(),
            shopGoldBefore: z.number().int().nonnegative(),
            shopGoldAfter: z.number().int().nonnegative(),
            totalScoreBefore: z.number().int().nonnegative(),
            totalScoreAfter: z.number().int().nonnegative(),
            guardTokensBefore: z.number().int().nonnegative(),
            guardTokensAfter: z.number().int().nonnegative(),
            comboShardsBefore: z.number().int().nonnegative(),
            comboShardsAfter: z.number().int().nonnegative(),
            relicFavorBefore: z.number().int().nonnegative(),
            relicFavorAfter: z.number().int().nonnegative(),
            memorizeBonusMsBefore: z.number().int().nonnegative(),
            memorizeBonusMsAfter: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('side_room.opened'),
            roomId: z.string().min(1).max(220),
            roomKind: z.enum(['rest_shrine', 'run_event', 'bonus_reward']),
            routeType: z.enum(['safe', 'greed', 'mystery']),
            nodeKind: z.enum(['combat', 'shop', 'elite', 'rest', 'event', 'treasure']),
            floor: z.number().int().positive(),
            payloadKind: z.enum(['rest_heal', 'event_choice', 'bonus_reward']),
            payloadId: z.string().min(1).max(240),
            eventKey: z.string().min(1).max(220).nullable(),
            choiceIds: z.array(z.string().min(1).max(200)).max(16),
            primaryChoiceId: z.string().min(1).max(200).nullable()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('side_room.resolved'),
            roomId: z.string().min(1).max(220),
            roomKind: z.enum(['rest_shrine', 'run_event', 'bonus_reward']),
            routeType: z.enum(['safe', 'greed', 'mystery']),
            nodeKind: z.enum(['combat', 'shop', 'elite', 'rest', 'event', 'treasure']),
            action: z.enum(['claim', 'skip']),
            choiceId: z.string().min(1).max(200).nullable(),
            outcome: z.enum(['rest_healed', 'event_applied', 'bonus_claimed', 'skipped']),
            rewardId: z.enum(GAMEPLAY_BONUS_REWARD_IDS).nullable(),
            eventEffect: z.enum(GAMEPLAY_RUN_EVENT_EFFECTS).nullable(),
            livesBefore: z.number().int().nonnegative(),
            livesAfter: z.number().int().nonnegative(),
            shopGoldBefore: z.number().int().nonnegative(),
            shopGoldAfter: z.number().int().nonnegative(),
            totalScoreBefore: z.number().int().nonnegative(),
            totalScoreAfter: z.number().int().nonnegative(),
            guardTokensBefore: z.number().int().nonnegative(),
            guardTokensAfter: z.number().int().nonnegative(),
            comboShardsBefore: z.number().int().nonnegative(),
            comboShardsAfter: z.number().int().nonnegative(),
            relicFavorBefore: z.number().int().nonnegative(),
            relicFavorAfter: z.number().int().nonnegative(),
            destroyChargesBefore: z.number().int().nonnegative(),
            destroyChargesAfter: z.number().int().nonnegative(),
            peekChargesBefore: z.number().int().nonnegative(),
            peekChargesAfter: z.number().int().nonnegative(),
            regionShuffleChargesBefore: z.number().int().nonnegative(),
            regionShuffleChargesAfter: z.number().int().nonnegative(),
            ironKeysBefore: z.number().int().nonnegative(),
            ironKeysAfter: z.number().int().nonnegative(),
            rewardPerkCountBefore: z.number().int().nonnegative(),
            rewardPerkCountAfter: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('relic.offer_opened'),
            outcome: z.enum(['opened', 'milestone_skipped']),
            clearedFloor: z.number().int().positive(),
            offerTier: z.number().int().positive(),
            options: z.array(z.enum(GAMEPLAY_RELIC_IDS)).max(3),
            picksRemaining: z.number().int().nonnegative().max(3),
            availableServiceIds: z.array(z.enum(GAMEPLAY_RELIC_OFFER_SERVICE_IDS)).max(3),
            contextualReasonRelicIds: z.array(z.enum(GAMEPLAY_RELIC_IDS)).max(3),
            bonusPicksBefore: z.number().int().nonnegative(),
            bonusPicksAfter: z.number().int().nonnegative(),
            favorBonusPicksBefore: z.number().int().nonnegative(),
            favorBonusPicksAfter: z.number().int().nonnegative(),
            favorBonusPicksInOffer: z.number().int().nonnegative().max(2),
            relicTiersBefore: z.number().int().nonnegative(),
            relicTiersAfter: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('relic.picked'),
            relicId: z.enum(GAMEPLAY_RELIC_IDS),
            definitionId: z.string().min(1).max(120),
            buildId: z.string().min(1).max(120).nullable(),
            offerTier: z.number().int().nonnegative(),
            pickRoundBefore: z.number().int().nonnegative(),
            pickRoundAfter: z.number().int().nonnegative(),
            picksRemainingBefore: z.number().int().nonnegative(),
            picksRemainingAfter: z.number().int().nonnegative(),
            outcome: z.enum(['offer_continues', 'advance_ready']),
            nextOptions: z.array(z.enum(GAMEPLAY_RELIC_IDS)),
            relicCountBefore: z.number().int().nonnegative(),
            relicCountAfter: z.number().int().positive(),
            relicTiersBefore: z.number().int().nonnegative(),
            relicTiersAfter: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('relic.offer_service_used'),
            serviceId: z.enum(GAMEPLAY_RELIC_OFFER_SERVICE_IDS),
            targetRelicId: z.enum(GAMEPLAY_RELIC_IDS).nullable(),
            cost: z.number().int().positive(),
            shopGoldBefore: z.number().int().nonnegative(),
            shopGoldAfter: z.number().int().nonnegative(),
            pickRoundBefore: z.number().int().nonnegative(),
            pickRoundAfter: z.number().int().nonnegative(),
            optionsBefore: z.array(z.enum(GAMEPLAY_RELIC_IDS)).min(1),
            optionsAfter: z.array(z.enum(GAMEPLAY_RELIC_IDS)).min(1),
            bannedRelicIdsBefore: z.array(z.enum(GAMEPLAY_RELIC_IDS)),
            bannedRelicIdsAfter: z.array(z.enum(GAMEPLAY_RELIC_IDS)),
            upgradedOfferBefore: z.boolean(),
            upgradedOfferAfter: z.boolean()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('board.turn_resolved'),
            outcome: z.enum(['match', 'mismatch', 'gambit_match', 'gambit_mismatch']),
            boardLevel: z.number().int().nonnegative(),
            flippedTileIds: z.array(z.string().min(1).max(160)).min(2).max(3),
            floaterTileIds: z.array(z.string().min(1).max(160)).min(2).max(3),
            matchedPairKey: z.string().min(1).max(160).nullable(),
            matchedFindableKind: z.enum(GAMEPLAY_FINDABLE_KINDS).nullable(),
            findablesClaimedBefore: z.number().int().nonnegative(),
            findablesClaimedAfter: z.number().int().nonnegative(),
            findablesTotalBefore: z.number().int().nonnegative(),
            findablesTotalAfter: z.number().int().nonnegative(),
            announcement: boardTurnAnnouncementFactsSchema,
            matchedRouteKind: z.enum(GAMEPLAY_ROUTE_SPECIAL_KINDS).nullable(),
            traitInteractionTags: z.array(z.enum(TILE_TRAIT_INTERACTION_TAGS)),
            boardComplete: z.boolean(),
            statusBefore: z.enum(['memorize', 'playing', 'resolving', 'paused', 'levelComplete', 'gameOver']),
            statusAfter: z.enum(['memorize', 'playing', 'resolving', 'paused', 'levelComplete', 'gameOver']),
            livesBefore: z.number().int().nonnegative(),
            livesAfter: z.number().int().nonnegative(),
            totalScoreBefore: z.number().int().nonnegative(),
            totalScoreAfter: z.number().int().nonnegative(),
            triesBefore: z.number().int().nonnegative(),
            triesAfter: z.number().int().nonnegative(),
            matchesBefore: z.number().int().nonnegative(),
            matchesAfter: z.number().int().nonnegative(),
            mismatchesBefore: z.number().int().nonnegative(),
            mismatchesAfter: z.number().int().nonnegative(),
            currentStreakBefore: z.number().int().nonnegative(),
            currentStreakAfter: z.number().int().nonnegative(),
            comboShardsBefore: z.number().int().nonnegative(),
            comboShardsAfter: z.number().int().nonnegative(),
            guardTokensBefore: z.number().int().nonnegative(),
            guardTokensAfter: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('wild_match.consumed'),
            wildTileId: z.string().min(1).max(160),
            pairedTileId: z.string().min(1).max(160),
            tokensBefore: z.number().int().positive(),
            tokensAfter: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('currency.changed'),
            currency: z.literal('shop_gold'),
            requested: z.number().int().positive(),
            applied: z.number().int().nonnegative(),
            before: z.number().int().nonnegative(),
            after: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('bonus_relic_pick.changed'),
            requested: z.number().int().positive(),
            applied: z.number().int().nonnegative(),
            before: z.number().int().nonnegative(),
            after: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('combo_shard.requested'),
            amount: z.number().int().positive()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('safe_hazard_ward.requested'),
            amount: z.number().int().positive()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('board.peeked'),
            targetTileId: z.string().min(1).max(160),
            peekChargesBefore: z.number().int().nonnegative(),
            peekChargesAfter: z.number().int().nonnegative(),
            recallFocusBefore: z.number().int().nonnegative(),
            recallFocusAfter: z.number().int().nonnegative(),
            forgottenTileCountBefore: z.number().int().nonnegative(),
            forgottenTileCountAfter: z.number().int().nonnegative(),
            routeSpecialRevealed: z.boolean()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('feedback.requested'),
            cue: z.string().min(1).max(120),
            message: z.string().min(1).max(500),
            tone: z.enum(['reward', 'information', 'warning'])
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('effect.skipped'),
            effectKind: z.string().min(1).max(120),
            reason: z.string().min(1).max(240)
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('command.rejected'),
            reason: z.string().min(1).max(500)
        })
        .strict()
]);

export type GameplayCommand = z.infer<typeof gameplayCommandSchema>;
export type GameplayEvent = z.infer<typeof gameplayEventSchema>;

const definitionById = new Map(GAMEPLAY_CONTENT_DEFINITIONS.map((definition) => [definition.id, definition]));

export const getGameplayContentDefinition = (id: string): GameplayContentDefinition | null =>
    definitionById.get(id) ?? null;

export const createGameplayMemorizeCompleteCommand = (commandId: string): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'phase.memorize_complete'
    });

export const createGameplayGauntletExpireCommand = (
    commandId: string,
    observedAtMs: number
): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'run.gauntlet_expire',
        observedAtMs
    });

export const createGameplayPauseCommand = (
    commandId: string,
    observedAtMs: number,
    timerSnapshot: GameplayPauseTimerSnapshot
): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'run.pause',
        observedAtMs,
        timerSnapshot
    });

export const createGameplayResumeCommand = (
    commandId: string,
    observedAtMs: number
): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'run.resume',
        observedAtMs
    });

export const createGameplayDebugRevealActivateCommand = (
    commandId: string,
    disableAchievementsOnDebug: boolean
): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'debug.reveal_activate',
        disableAchievementsOnDebug
    });

export const createGameplayDebugRevealDeactivateCommand = (
    commandId: string,
    reason: GameplayDebugRevealDeactivationReason
): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'debug.reveal_deactivate',
        reason
    });

export const createGameplayProgressionRepairCommand = (commandId: string): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'run.progression_repair'
    });

export const createGameplayDefinitionCommand = (
    commandId: string,
    definitionId: string,
    facts: Partial<GameplayFacts> = {}
): GameplayCommand => {
    const definition = getGameplayContentDefinition(definitionId);
    if (!definition) {
        throw new Error(`Unknown gameplay content definition: ${definitionId}`);
    }
    return gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'effects.apply',
        definitionId,
        definitionVersion: definition.version,
        facts
    });
};

export const createGameplayPeekCommand = (commandId: string, targetTileId: string): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'board.peek',
        targetTileId
    });

export const createGameplayTileFlipCommand = (commandId: string, targetTileId: string): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'board.tile_flip',
        targetTileId
    });

export const createGameplayEnemyHazardContactCommand = (
    commandId: string,
    targetTileId: string,
    advanceHazards: boolean
): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'enemy_hazard.contact',
        targetTileId,
        advanceHazards
    });

export const createGameplayPinToggleCommand = (commandId: string, targetTileId: string): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'board.pin_toggle',
        targetTileId
    });

export const createGameplayStrayRemoveCommand = (commandId: string, targetTileId: string): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'board.stray_remove',
        targetTileId
    });

export const createGameplayDestroyPairCommand = (commandId: string, targetTileId: string): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'board.destroy_pair',
        targetTileId
    });

export const createGameplayRiskWagerAcceptCommand = (commandId: string): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'risk_wager.accept'
    });

export const createGameplayGambitCommitCommand = (commandId: string, targetTileId: string): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'board.gambit_commit',
        targetTileId
    });

export const createGameplayShuffleCommand = (commandId: string): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'board.shuffle'
    });

export const createGameplayRegionShuffleCommand = (commandId: string, rowIndex: number): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'board.region_shuffle',
        rowIndex
    });

export const createGameplayTileSwapCommand = (
    commandId: string,
    firstTileId: string,
    secondTileId: string
): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'board.tile_swap',
        firstTileId,
        secondTileId
    });

export const createGameplayFlashPairCommand = (commandId: string): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'board.flash_pair'
    });

export const createGameplayUndoResolveCommand = (commandId: string): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'board.undo_resolve'
    });

export const createGameplayShopPurchaseCommand = (commandId: string, offerId: string): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'shop.purchase',
        offerId
    });

export const createGameplayShopRerollCommand = (commandId: string): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'shop.reroll'
    });

export const createGameplayDungeonExitActivateCommand = (
    commandId: string,
    spend: 'none' | 'key' | 'master_key'
): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'dungeon.exit_activate',
        spend
    });

export const createGameplayParasiteAdvanceCommand = (commandId: string): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'floor.parasite_advance'
    });

export const createGameplayHazardBanishCommand = (commandId: string): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'floor.hazard_banish'
    });

export const createGameplayFloorAdvanceCommand = (commandId: string): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'floor.advance'
    });

export const createGameplayRouteChooseCommand = (commandId: string, choiceId: string): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'route.choose',
        choiceId
    });

export const createGameplaySideRoomResolveCommand = (
    commandId: string,
    action: 'claim' | 'skip',
    choiceId?: string
): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'side_room.resolve',
        action,
        ...(choiceId ? { choiceId } : {})
    });

export const createGameplayRelicPickCommand = (commandId: string, relicId: RelicId): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'relic.pick',
        relicId
    });

export const createGameplayRelicOfferOpenCommand = (commandId: string): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'relic.offer_open'
    });

export const createGameplayRelicOfferServiceCommand = (
    commandId: string,
    serviceId: RelicOfferServiceId,
    targetRelicId?: RelicId
): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'relic.offer_service_use',
        serviceId,
        ...(targetRelicId ? { targetRelicId } : {})
    });

export const createGameplayBoardTurnResolveCommand = (
    commandId: string,
    encorePairKeys: readonly string[] = []
): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'board.turn_resolve',
        encorePairKeys: [...encorePairKeys]
    });

export const createGameplayWildMatchConsumeCommand = (
    commandId: string,
    wildTileId: string,
    pairedTileId: string
): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'wild_match.consume',
        wildTileId,
        pairedTileId
    });
