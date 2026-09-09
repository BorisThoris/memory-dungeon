import { z } from 'zod';
import type { FindableKind, RunStatus, TileTraitKind } from './contracts';
import { RUN_INVENTORY_ITEM_IDS } from './run-inventory-contracts';

export const GAMEPLAY_CORE_SCHEMA_VERSION = 1 as const;

export const GAMEPLAY_FINDABLE_KINDS = ['shard_spark', 'score_glint'] as const satisfies readonly FindableKind[];

export const GAMEPLAY_TILE_TRAIT_KINDS = ['echo', 'heavy', 'conduit', 'stasis'] as const satisfies readonly TileTraitKind[];

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
        kind: z.enum(['findable', 'power', 'trait', 'system']),
        id: z.string().min(1).max(120)
    })
    .strict();

export const gameplayFactsSchema = z
    .object({
        matchedTraits: z.array(z.enum(GAMEPLAY_TILE_TRAIT_KINDS)).default([]),
        adjacentTraits: z.array(z.enum(GAMEPLAY_TILE_TRAIT_KINDS)).default([]),
        matchedFindables: z.array(z.enum(GAMEPLAY_FINDABLE_KINDS)).default([]),
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
            kind: z.literal('combo_shard.request'),
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
            reason: z.literal('findable_match'),
            amount: z.number().int().positive()
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

/*
 * What the effects engine still resolves. Twelve definition sets stood here: the relic claims, the
 * bonus rewards, the build perks and the standing-rule relics. Their sources are gone (Gen 175 and
 * 176), so what remains is the one trait interaction that pays through the engine and the two
 * findable pickups.
 */
export const GAMEPLAY_CONTENT_DEFINITIONS = z.array(gameplayContentDefinitionSchema).parse([
    /*
     * Volatile beside Heavy held this slot until the trait triage cut Volatile. Conduit beside
     * Echo is the kept interaction with the same shape - a match, a neighbour, one charge granted -
     * so it is the one that pays through the engine now.
     */
    {
        id: 'trait.conduit_echo_peek',
        version: 1,
        buildId: 'peek_relay',
        source: { kind: 'trait', id: 'conduit_echo_peek' },
        trigger: 'trait.match',
        conditions: [
            { kind: 'trait.matched', trait: 'conduit' },
            { kind: 'trait.adjacent', trait: 'echo' }
        ],
        effects: [
            { kind: 'inventory.grant', itemId: 'peek_charge', amount: 1 },
            {
                kind: 'feedback.emit',
                cue: 'build.conduit_echo_peek.triggered',
                message: 'Conduit relayed the Echo beside it into one peek charge.',
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

export type GameplaySource = z.infer<typeof gameplaySourceSchema>;
export type GameplayFacts = z.infer<typeof gameplayFactsSchema>;
export type GameplayCondition = z.infer<typeof gameplayConditionSchema>;
export type GameplayEffect = z.infer<typeof gameplayEffectSchema>;
export type GameplayContentDefinition = z.infer<typeof gameplayContentDefinitionSchema>;

const commandBase = {
    schemaVersion: z.literal(GAMEPLAY_CORE_SCHEMA_VERSION),
    commandId: z.string().min(1).max(160)
};

/**
 * Timer values captured at the moment a run is paused, so resume can restore them
 * without trusting wall-clock arithmetic across the pause boundary. Null means the
 * corresponding timer was not running.
 */
export const gameplayPauseTimerSnapshotSchema = z
    .object({
        memorizeRemainingMs: z.number().int().nonnegative().nullable(),
        resolveRemainingMs: z.number().int().nonnegative().nullable(),
        debugRevealRemainingMs: z.number().int().nonnegative().nullable()
    })
    .strict();

export type GameplayPauseTimerSnapshot = z.infer<typeof gameplayPauseTimerSnapshotSchema>;

/**
 * Presentation facts stamped onto board.turn_resolved so the renderer can project
 * feedback from the event alone instead of re-deriving it from board snapshots.
 */
export const boardTurnAnnouncementFactsSchema = z
    .object({
        anchorTileIds: z.array(z.string().min(1).max(160)).max(3),
        level: z.number().int().nonnegative(),
        currentStreakBefore: z.number().int().nonnegative(),
        currentStreakAfter: z.number().int().nonnegative(),
        comboShardsBefore: z.number().int().nonnegative(),
        comboShardsAfter: z.number().int().nonnegative(),
        guardTokensBefore: z.number().int().nonnegative(),
        guardTokensAfter: z.number().int().nonnegative(),
        livesBefore: z.number().int().nonnegative(),
        livesAfter: z.number().int().nonnegative(),
        findablesClaimedBefore: z.number().int().nonnegative(),
        findablesClaimedAfter: z.number().int().nonnegative(),
        chunkBreaksBefore: z.number().int().nonnegative().default(0),
        chunkBreaksAfter: z.number().int().nonnegative().default(0),
        chunkPairsBrokenBefore: z.number().int().nonnegative().default(0),
        chunkPairsBrokenAfter: z.number().int().nonnegative().default(0),
        chainAfter: z.number().int().nonnegative().default(0),
        chainTierAfter: z.enum(['none', 'clean', 'sharp', 'fever']).default('none'),

        chainTierBefore: z.enum(['none', 'clean', 'sharp', 'fever']).default('none'),
        chunkPartnerSpanMax: z.number().int().nonnegative().default(0),
        chunkHaloPairs: z.number().int().nonnegative().default(0),
        chunkSuitCleared: z.boolean().default(false),
        chunkDroppedPairs: z.number().int().nonnegative().default(0),
        chunkRippleWaves: z.number().int().nonnegative().default(0),
        magpieTheftsBefore: z.number().int().nonnegative().default(0),
        magpieTheftsAfter: z.number().int().nonnegative().default(0),
        magpieScaredOffBefore: z.number().int().nonnegative().default(0),
        magpieScaredOffAfter: z.number().int().nonnegative().default(0),
        findablesTotalBefore: z.number().int().nonnegative(),
        findablesTotalAfter: z.number().int().nonnegative(),
        matchedTraitKinds: z.array(z.string().min(1).max(40)).default([]),
        shuffleChargesBefore: z.number().int().nonnegative().default(0),
        shuffleChargesAfter: z.number().int().nonnegative().default(0),
        regionShuffleChargesBefore: z.number().int().nonnegative().default(0),
        regionShuffleChargesAfter: z.number().int().nonnegative().default(0),
        stickyBlockIndexBefore: z.number().int().nullable().default(null),
        stickyBlockIndexAfter: z.number().int().nullable().default(null),
        matchedPairsBefore: z.number().int().nonnegative().default(0),
        matchedPairsAfter: z.number().int().nonnegative().default(0),
        pairTotal: z.number().int().nonnegative().default(0),
        mismatchesBefore: z.number().int().nonnegative().default(0),
        mismatchesAfter: z.number().int().nonnegative().default(0)
    })
    .strict();

export const gameplayCommandSchema = z.discriminatedUnion('type', [
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
            type: z.literal('board.curio_greet')
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
            type: z.literal('floor.advance')
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
            type: z.literal('phase.memorize_complete')
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('run.pause'),
            pausedAtMs: z.number().int().nonnegative(),
            timerSnapshot: gameplayPauseTimerSnapshotSchema
        })
        .strict(),
    z
        .object({
            ...commandBase,
            type: z.literal('run.resume'),
            resumedAtMs: z.number().int().nonnegative()
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
            reason: z.enum(['timer_elapsed', 'resume_expired', 'phase_ended'])
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
            reason: z.literal('findable_match'),
            amount: z.number().int().positive()
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
            recallFocusAfter: z.number().int().nonnegative()
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
            type: z.literal('board.shuffled'),
            affectedTileIds: z.array(z.string().min(1).max(160)),
            shuffleNonceBefore: z.number().int().nonnegative(),
            shuffleNonceAfter: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('board.region_shuffled'),
            rowIndex: z.number().int().nonnegative(),
            affectedTileIds: z.array(z.string().min(1).max(160)),
            shuffleNonceBefore: z.number().int().nonnegative(),
            shuffleNonceAfter: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('board.tiles_swapped'),
            firstTileId: z.string().min(1).max(160),
            secondTileId: z.string().min(1).max(160),
            shuffleNonceBefore: z.number().int().nonnegative(),
            shuffleNonceAfter: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('board.curio_greeted'),
            curioId: z.string().min(1).max(64),
            peekChargesBefore: z.number().int().nonnegative(),
            peekChargesAfter: z.number().int().nonnegative(),
            guardTokensBefore: z.number().int().nonnegative(),
            guardTokensAfter: z.number().int().nonnegative(),
            strayChargesBefore: z.number().int().nonnegative(),
            strayChargesAfter: z.number().int().nonnegative(),
            undoUsesBefore: z.number().int().nonnegative(),
            undoUsesAfter: z.number().int().nonnegative()
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
            recallFocusAfter: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('score_parasite.advanced'),
            active: z.boolean(),
            pressureBefore: z.number().int().nonnegative(),
            pressureAfter: z.number().int().nonnegative(),
            livesBefore: z.number().int().nonnegative(),
            livesAfter: z.number().int().nonnegative(),
            thresholdTriggered: z.boolean(),
            lifeLost: z.boolean()
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
            boardPairCount: z.number().int().nonnegative(),
            boardTileCount: z.number().int().nonnegative(),
            memorizeRemainingMs: z.number().int().nonnegative().nullable(),
            livesBefore: z.number().int().nonnegative(),
            livesAfter: z.number().int().nonnegative(),
            parasitePressureBefore: z.number().int().nonnegative(),
            parasitePressureAfter: z.number().int().nonnegative(),
            destroyChargesBefore: z.number().int().nonnegative(),
            destroyChargesAfter: z.number().int().nonnegative()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('board.turn_resolved'),
            outcome: z.enum(['match', 'mismatch', 'gambit_match', 'gambit_mismatch']),
            flippedTileIds: z.array(z.string().min(1).max(160)).min(2).max(3),
            matchedPairKey: z.string().min(1).max(160).nullable(),
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
            comboShardsBefore: z.number().int().nonnegative().default(0),
            comboShardsAfter: z.number().int().nonnegative().default(0),
            currentStreakAfter: z.number().int().nonnegative().default(0),
            findablesClaimedBefore: z.number().int().nonnegative().default(0),
            findablesClaimedAfter: z.number().int().nonnegative().default(0),
            findablesTotalBefore: z.number().int().nonnegative().default(0),
            findablesTotalAfter: z.number().int().nonnegative().default(0),
            announcement: boardTurnAnnouncementFactsSchema,
            matchedFindableKind: z.enum(GAMEPLAY_FINDABLE_KINDS).nullable().default(null),
            floaterTileIds: z.array(z.string().min(1).max(160)).max(3).default([]),
            traitInteractionTags: z.array(z.string().min(1).max(120)).default([])
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
            type: z.literal('combo_shard.requested'),
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
            recallFocusAfter: z.number().int().nonnegative()
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
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('board.tile_flipped'),
            tileId: z.string().min(1).max(160),
            outcome: z.literal('flipped'),
            flippedCountAfter: z.number().int().nonnegative(),
            statusAfter: z.enum(['memorize', 'playing', 'resolving', 'paused', 'levelComplete', 'gameOver'])
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('phase.memorize_completed'),
            statusAfter: z.enum(['memorize', 'playing', 'resolving', 'paused', 'levelComplete', 'gameOver'])
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('run.paused'),
            statusBefore: z.enum(['memorize', 'playing', 'resolving', 'paused', 'levelComplete', 'gameOver']),
            timerSnapshot: gameplayPauseTimerSnapshotSchema
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('run.resumed'),
            statusAfter: z.enum(['memorize', 'playing', 'resolving', 'paused', 'levelComplete', 'gameOver']),
            outcome: z.enum(['resumed', 'game_over']).default('resumed')
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('debug.reveal_activated'),
            outcome: z.enum(['activated']),
            disableAchievementsOnDebug: z.boolean()
        })
        .strict(),
    z
        .object({
            ...eventBase,
            type: z.literal('debug.reveal_deactivated'),
            reason: z.enum(['timer_elapsed', 'resume_expired', 'phase_ended'])
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

export const createGameplayGreetCurioCommand = (commandId: string): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'board.curio_greet'
    });

export const createGameplayUndoResolveCommand = (commandId: string): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'board.undo_resolve'
    });

export const createGameplayParasiteAdvanceCommand = (commandId: string): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'floor.parasite_advance'
    });

export const createGameplayFloorAdvanceCommand = (commandId: string): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'floor.advance'
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

export const createGameplayTileFlipCommand = (commandId: string, targetTileId: string): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'board.tile_flip',
        targetTileId
    });

export const createGameplayMemorizeCompleteCommand = (commandId: string): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'phase.memorize_complete'
    });

export const createGameplayPauseCommand = (
    commandId: string,
    pausedAtMs: number,
    timerSnapshot: GameplayPauseTimerSnapshot
): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'run.pause',
        pausedAtMs,
        timerSnapshot
    });

export const createGameplayResumeCommand = (commandId: string, resumedAtMs: number): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'run.resume',
        resumedAtMs
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
    reason: 'timer_elapsed' | 'resume_expired' | 'phase_ended'
): GameplayCommand =>
    gameplayCommandSchema.parse({
        schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
        commandId,
        type: 'debug.reveal_deactivate',
        reason
    });
