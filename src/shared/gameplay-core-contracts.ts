import { z } from 'zod';
import type { RelicId, RewardPerkId, RunStatus, TileTraitKind } from './contracts';
import { RUN_INVENTORY_ITEM_IDS } from './run-inventory-contracts';

export const GAMEPLAY_CORE_SCHEMA_VERSION = 1 as const;

export const GAMEPLAY_REWARD_PERK_IDS = [
    'free_first_swap_per_floor',
    'echo_conduit_double',
    'trait_streak_toolkit',
    'cursed_opener_greed',
    'hazard_banish_per_floor'
] as const satisfies readonly RewardPerkId[];

export const GAMEPLAY_RELIC_IDS = [
    'guard_token_plus_one'
] as const satisfies readonly RelicId[];

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
        kind: z.enum(['bonus_reward', 'relic', 'reward_perk', 'power', 'trait', 'system']),
        id: z.string().min(1).max(120)
    })
    .strict();

export const gameplayFactsSchema = z
    .object({
        matchedTraits: z.array(z.enum(GAMEPLAY_TILE_TRAIT_KINDS)).default([]),
        adjacentTraits: z.array(z.enum(GAMEPLAY_TILE_TRAIT_KINDS)).default([])
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
        trigger: z.enum(['content.claimed', 'trait.match', 'power.used']),
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

export const GAMEPLAY_CONTENT_DEFINITIONS = [
    ...CONDUIT_CARTOGRAPHER_DEFINITIONS,
    ...WARDEN_DEFINITIONS
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

export const gameplayCommandSchema = z.discriminatedUnion('type', [
    z
        .object({
            ...commandBase,
            type: z.literal('effects.apply'),
            definitionId: z.string().min(1).max(120),
            definitionVersion: z.number().int().positive(),
            facts: gameplayFactsSchema.default({ matchedTraits: [], adjacentTraits: [] })
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('board.peek'),
            targetTileId: z.string().min(1).max(160)
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

export const gameplayEventSchema = z.discriminatedUnion('type', [
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
            reason: z.enum(['inventory_overflow']),
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
            type: z.literal('board.peeked'),
            targetTileId: z.string().min(1).max(160),
            peekChargesBefore: z.number().int().nonnegative(),
            peekChargesAfter: z.number().int().nonnegative(),
            recallFocusBefore: z.number().int().nonnegative(),
            recallFocusAfter: z.number().int().nonnegative(),
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
