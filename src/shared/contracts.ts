/**
 * Cross-cutting types and constants for save payloads, runs, and UI contracts.
 *
 * **Breaking changes:** run `yarn typecheck` (or `yarn verify`), grep for renamed exports under `docs/`, extend
 * `normalizeSaveData` + `save-data.test.ts` fixtures when save shape changes, and check the PR checklist
 * (`.github/pull_request_template.md`). See docs/refinement-tasks REF-066. For optional payloads, consider aligning
 * with TypeScript `exactOptionalPropertyTypes` when feasible.
 */
export const SAVE_SCHEMA_VERSION = 6;
/** Bump when generation rules change (tile order, mutators, pair layout). */
export const GAME_RULES_VERSION = 33;
export const INITIAL_LIVES = 4;
/** Hard cap on life total during a run; HUD renders this many heart slots (PLAY-004 — honest max, not mock’s three). */
export const MAX_LIVES = 5;
export const MATCH_DELAY_MS = 850;
export const FEATURED_OBJECTIVE_STREAK_BONUS_PER_STEP = 10;
export const FEATURED_OBJECTIVE_STREAK_BONUS_MAX = 50;
export const FEATURED_OBJECTIVE_STREAK_MISS_DECAY = 2;
export const ENDLESS_RISK_WAGER_MIN_STREAK = 2;
export const ENDLESS_RISK_WAGER_BONUS_FAVOR = 2;
/** Timed gauntlet reward for clearing a floor before the clock expires. */
export const GAUNTLET_FLOOR_CLEAR_TIME_BONUS_MS = 30_000;
/** REG-015: temporary run-only shop wallet earned on floor clear. Never persisted outside RunState. */
export const FLOOR_CLEAR_GOLD_BASE = 2;
/** Minimum value for Settings -> Gameplay -> Resolve Delay and resolve-animation timing. */
export const RESOLVE_DELAY_MULTIPLIER_MIN = 0.5;
export const DEBUG_REVEAL_MS = 1500;
export const MEMORIZE_BASE_MS = 1300;
export const MEMORIZE_STEP_MS = 50;
export const MEMORIZE_MIN_MS = 600;
/**
 * Memorize budget per revealed tile. The window scales with the board (per-tile budget × tile
 * count) and the difficulty curve lives in the per-tile budget, so a 42-tile floor is never
 * handed the same 850ms a 10-tile floor gets. Floor 1 (4 tiles) stays at MEMORIZE_BASE_MS.
 */
export const MEMORIZE_PER_TILE_BASE_MS = 325;
export const MEMORIZE_PER_TILE_STEP_MS = 12;
export const MEMORIZE_PER_TILE_MIN_MS = 110;
export const MEMORIZE_MAX_MS = 6000;
/** Default pair count for a floor before encounter deltas: level + 1, capped by the symbol catalog. */
export const DEFAULT_PAIR_COUNT_CAP = 30;
/** Memorize time drops by MEMORIZE_STEP_MS once per this many levels (so pairs and timer do not spike together every floor). */
export const MEMORIZE_DECAY_EVERY_N_LEVELS = 2;
/** After a life is lost to a mismatch, this many ms are banked for the next level's memorize phase (capped). */
export const MEMORIZE_BONUS_PER_LIFE_LOST_MS = 160;
export const MAX_PENDING_MEMORIZE_BONUS_MS = 500;
export const COMBO_GUARD_STREAK_STEP = 4;
export const CHAIN_HEAL_STREAK_STEP = 8;
export const MAX_GUARD_TOKENS = 2;
export const MAX_COMBO_SHARDS = 2;
export const INITIAL_SHUFFLE_CHARGES = 1;
export const INITIAL_REGION_SHUFFLE_CHARGES = 1;
export const MAX_PINNED_TILES = 3;
export const RECALL_FOCUS_MAX = 3;
export const INITIAL_RECALL_FOCUS = 1;
export const RECALL_FOCUS_MATCH_SCORE = 8;
export const RECALL_CLUE_MATCH_SCORE = 12;

/** Bonus score when the floor is cleared without shuffle or destroy (per-floor). */
/** Rules v16 higher-tension rebalance: optional objectives pay harder, but missed streaks decay faster. */
export const SCHOLAR_STYLE_FLOOR_BONUS_SCORE = 50;
/** Bonus when glass_floor decoy was never involved in a mismatch this floor. */
export const GLASS_WITNESS_BONUS_SCORE = 45;
/** GP-O02: match cursed pair last among real pairs. */
export const CURSED_LAST_BONUS_SCORE = 65;
/** GP-O03: clear within flip par (match resolutions). */
export const FLIP_PAR_BONUS_SCORE = 45;
/** `shifting_spotlight`: extra score when the current bounty pair is matched. */
export const SHIFTING_BOUNTY_MATCH_BONUS = 30;
/** `shifting_spotlight`: subtracted from match score when the current ward pair is matched (floored at 0 with base match). */
export const SHIFTING_WARD_MATCH_PENALTY = 22;
/** `toll_cache`: deterministic match-score toll paid for converting a clean hazard match into shop gold. */
export const TOLL_CACHE_MATCH_SCORE_TOLL = 15;
/** `toll_cache`: temporary shop wallet awarded when its pair is matched cleanly. */
export const TOLL_CACHE_SHOP_GOLD_REWARD = 1;
/** `fuse_cache`: clean-match score paid while the cache is still fresh. */
export const FUSE_CACHE_FRESH_SCORE_REWARD = 35;
/** `fuse_cache`: temporary shop wallet awarded while the cache is still fresh. */
export const FUSE_CACHE_FRESH_SHOP_GOLD_REWARD = 2;
/** `fuse_cache`: temporary shop wallet awarded after the fuse expires. */
export const FUSE_CACHE_EXPIRED_SHOP_GOLD_REWARD = 1;
/** `fuse_cache`: number of floor resolutions before the full payout expires. */
export const FUSE_CACHE_FRESH_RESOLUTION_LIMIT = 3;
/** `mimic_cache`: controlled route-special score reward when scouted/revealed before matching. */
export const MIMIC_CACHE_CONTROLLED_SCORE_REWARD = 20;
/** `mimic_cache`: controlled route-special shop wallet when scouted/revealed before matching. */
export const MIMIC_CACHE_CONTROLLED_SHOP_GOLD_REWARD = 2;
/** `mimic_cache`: blind route-special shop wallet after the bite branch. */
export const MIMIC_CACHE_BLIND_SHOP_GOLD_REWARD = 1;
export const LOADED_GATEWAY_SCORE_REWARD = 20;
export const CATALYST_ALTAR_FALLBACK_SCORE_REWARD = 15;
export const CATALYST_ALTAR_UPGRADED_SCORE_REWARD = 45;
export const PARASITE_VESSEL_FALLBACK_SCORE_REWARD = 15;
export const PIN_LATTICE_SCORE_REWARD = 20;
export const BOSS_FLOOR_SCORE_MULTIPLIER = 1.25;

export type DisplayMode = 'windowed' | 'fullscreen';
export type TileState = 'hidden' | 'flipped' | 'matched' | 'removed';
/**
 * The suit painted on a tile's back. Both tiles of a pair share it, and it is the one thing about
 * a face-down tile the player is allowed to know — the map a chain is planned against.
 */
export type TileSuit = 'ember' | 'tide' | 'moss' | 'bone';
export type Rating = 'S++' | 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
export type ClearLifeReason = 'none' | 'clean' | 'perfect';
export type FeaturedObjectiveId = 'scholar_style' | 'glass_witness' | 'cursed_last' | 'flip_par';
export type EndlessRiskWagerOutcome = 'won' | 'lost';
export type ViewState =
    | 'boot'
    | 'menu'
    | 'settings'
    | 'playing'
    | 'gameOver'
    | 'modeSelect'
    | 'collection'
    | 'profile'
    | 'inventory'
    | 'shop'
    | 'sideRoom'
    | 'codex';

/** Where sub-screens (mode select, collection, profile, inventory, codex) return on Back. */
export type SubscreenReturnView = Exclude<ViewState, 'boot' | 'settings'>;

export type GameMode = 'endless' | 'daily' | 'puzzle' | 'gauntlet' | 'meditation';
export type StartingLoadoutId = 'memory_scout' | 'route_tactician' | 'cursebreaker' | 'vaultbreaker';

export type PuzzleDifficulty = 'starter' | 'standard' | 'advanced';
export type PuzzleGoal = 'clear_all' | 'perfect_clear' | 'flip_par';
export type PuzzlePackId = 'tutorial' | 'beginner' | 'challenge' | 'experimental';

export interface PuzzleCompletionRecord {
    completed: boolean;
    bestMistakes: number | null;
    bestScore: number;
}

export interface BuiltinPuzzleDefinition {
    id: string;
    title: string;
    packId: PuzzlePackId;
    difficulty: PuzzleDifficulty;
    tags: string[];
    goal: PuzzleGoal;
    goalText: string;
    author: string;
    version: number;
    tiles: Tile[];
}

export const MUTATOR_IDS = [
    'glass_floor',
    'sticky_fingers',
    'score_parasite',
    'category_letters',
    'short_memorize',
    'wide_recall',
    'silhouette_twist',
    'n_back_anchor',
    'distraction_channel',
    'findables_floor',
    'shifting_spotlight',
    'generous_shrine',
    'magpie_thief'
] as const;
export type MutatorId = (typeof MUTATOR_IDS)[number];

/** Bonus pickups attached to some pairs during eligible runs/floors. */
export type FindableKind = 'shard_spark' | 'score_glint' | 'ward_spark' | 'scout_glint';

/** Flat score added on top of normal match score when a findable pair is matched. */
export const FINDABLE_MATCH_SCORE: Record<FindableKind, number> = {
    shard_spark: 0,
    score_glint: 25,
    ward_spark: 0,
    scout_glint: 0
};
/** Immediate combo-shard gain when a findable pair is matched. */
export const FINDABLE_MATCH_COMBO_SHARDS: Record<FindableKind, number> = {
    shard_spark: 1,
    score_glint: 0,
    ward_spark: 0,
    scout_glint: 0
};
/** Immediate safe-hazard ward charge gain when a findable pair is matched. */
export const FINDABLE_MATCH_SAFE_HAZARD_WARDS: Record<FindableKind, number> = {
    shard_spark: 0,
    score_glint: 0,
    ward_spark: 1,
    scout_glint: 0
};
/** Immediate limited scout reveal count when a findable pair is matched. */
export const FINDABLE_MATCH_SCOUT_REVEALS: Record<FindableKind, number> = {
    shard_spark: 0,
    score_glint: 0,
    ward_spark: 0,
    scout_glint: 1
};
/** Relative spawn weights for current-rules findable kind assignment. */
export const FINDABLE_KIND_SPAWN_WEIGHTS: Record<FindableKind, number> = {
    shard_spark: 35,
    score_glint: 35,
    ward_spark: 15,
    scout_glint: 15
};

/** Hidden shuffle: full Fisher–Yates vs row-preserving permute. */
export type WeakerShuffleMode = 'full' | 'rows_only';

export type RelicId =
    | 'extra_shuffle_charge'
    | 'first_shuffle_free_per_floor'
    | 'memorize_bonus_ms'
    | 'destroy_bank_plus_one'
    | 'combo_shard_plus_step'
    | 'memorize_under_short_memorize'
    | 'parasite_ward_once'
    | 'region_shuffle_free_first'
    | 'peek_charge_plus_one'
    | 'stray_charge_plus_one'
    | 'pin_cap_plus_one'
    | 'guard_token_plus_one'
    | 'shrine_echo'
    | 'chapter_compass'
    | 'wager_surety'
    | 'parasite_ledger'
    /*
     * Standing rules rather than pickup bonuses: each of these changes what a trait is worth for
     * the rest of the run, so the board you are looking at plays differently once you hold one.
     */
    | 'bulwark_plate'
    | 'tithe_conduit'
    | 'stasis_broker'
    | 'opening_ledger'
    | 'drift_appraiser'
    | 'echo_relay';

/** Active milestone relic draft (one visit may allow multiple picks). */
export interface RelicOfferState {
    /** 1-based display index for this milestone. */
    tier: number;
    options: RelicId[];
    /** Selections remaining including the next pick. */
    picksRemaining: number;
    /** Reroll counter for deterministic `rollRelicOptions` within this visit. */
    pickRound: number;
    /** REG-078: relic-offer service bookkeeping; scoped to this draft visit and never persisted. */
    serviceUses?: Partial<Record<RelicOfferServiceId, number>>;
    /** REG-078: option ids removed from the current visit by ban service. */
    bannedRelicIds?: RelicId[];
    /** REG-078: whether the current option set was upgraded toward higher rarity. */
    upgradedOffer?: boolean;
    /** REG-078: derived service rows for UI/buttons; safe to rebuild from RunState. */
    services?: RelicOfferServiceState[];
    /** Display-only source marker for bonus picks banked from endless featured-objective favor. */
    favorBonusPicks?: number;
    /** Display-only reason copy for chapter-aligned options in the current draft round. */
    contextualOptionReasons?: Partial<Record<RelicId, string>>;
    /**
     * The sealed fourth option: a real relic the draft screen refuses to name. Pickable like any
     * other option; null when the pool had nothing left to seal.
     */
    sealedRelicId?: RelicId | null;
}

export type RelicOfferServiceId = 'reroll_offer' | 'ban_option' | 'upgrade_offer';

export interface RelicOfferServiceState {
    serviceId: RelicOfferServiceId;
    label: string;
    description: string;
    cost: number;
    available: boolean;
    unavailableReason: string | null;
    usedThisRound: number;
}

export type RunShopItemId =
    | 'heal_life'
    | 'peek_charge'
    | 'region_shuffle_charge'
    | 'destroy_charge'
    | 'trait_cleanse'
    | 'trait_routing_kit'
    | 'iron_key'
    | 'treasure_key'
    | 'shrine_key'
    | 'boss_key'
    | 'trap_key'
    | 'master_key';
export type RunShopItemCategory = 'consumable' | 'service';
export type RunShopOfferAvailability = 'available' | 'sold_out' | 'insufficient_funds' | 'incompatible';

export interface RunShopOfferState {
    id: string;
    itemId: RunShopItemId;
    category: RunShopItemCategory;
    label: string;
    description: string;
    cost: number;
    baseCost: number;
    stock: number;
    maxStock: number;
    stackLimit: number | null;
    compatibleWhen: 'owned' | 'not_capped';
    compatible: boolean;
    unavailableReason: string | null;
    purchased: boolean;
}

export interface EndlessRiskWagerState {
    acceptedOnLevel: number;
    targetLevel: number;
    streakAtRisk: number;
    bonusFavorOnSuccess: number;
}

export interface ContractFlags {
    noShuffle: boolean;
    noDestroy: boolean;
    maxMismatches: number | null;
    /** GP-C01: max pins allowed this run (null = default cap). */
    maxPinsTotalRun?: number | null;
    /** Scholar / menu contract: +1 relic choice at each milestone draft. */
    bonusRelicDraftPick?: boolean;
}
export type ResumableRunStatus = 'memorize' | 'playing' | 'resolving';
export type RunStatus = ResumableRunStatus | 'paused' | 'levelComplete' | 'gameOver';

export type AchievementId =
    | 'ACH_FIRST_CLEAR'
    | 'ACH_LEVEL_FIVE'
    | 'ACH_SCORE_THOUSAND'
    | 'ACH_PERFECT_CLEAR'
    | 'ACH_LAST_LIFE'
    | 'ACH_ENDLESS_TEN'
    | 'ACH_SEVEN_DAILIES'
    /*
     * The seven above are all reached by playing the first mode for a while. These point at the
     * rest of the game — the wardens, the relic roster, the traits, and the four modes that a
     * player who only ever presses Play will never open.
     */
    | 'ACH_WARDEN_FELLED'
    | 'ACH_ENDLESS_CYCLE'
    | 'ACH_ENDLESS_TWENTY'
    | 'ACH_SCORE_TEN_THOUSAND'
    | 'ACH_STREAK_TEN'
    | 'ACH_TRAIT_SCHOLAR'
    | 'ACH_RELIC_HOARD'
    | 'ACH_STANDING_ORDERS'
    | 'ACH_RELIC_LIBRARY'
    | 'ACH_NO_POWERS_TEN'
    | 'ACH_GAUNTLET_RUN'
    | 'ACH_PUZZLE_SOLVER'
    | 'ACH_MEDITATION_HOUR';

export interface DebugFlags {
    showDebugTools: boolean;
    allowBoardReveal: boolean;
    disableAchievementsOnDebug: boolean;
}

/** Experimental board framing (Wave G presentation). */
export type BoardPresentationMode = 'standard' | 'spaghetti' | 'breathing';

/**
 * HUD-012: Whether the playing shell uses full-bleed **mobile camera** layout (HUD overlays the board stage).
 * `auto` follows the same compact-touch viewport signal as `GameScreen` / `TileBoard` breakpoints; `always` /
 * `never` are explicit user overrides (Settings → Gameplay → Board).
 */
export type CameraViewportModePreference = 'auto' | 'always' | 'never';

/**
 * WebGL board edge smoothing (PERF-002). `auto` keeps the old motion preference shape:
 * native framebuffer AA unless Reduce Motion explicitly prefers MSAA. `smaa` is retained as
 * a saved setting value, but currently resolves to native framebuffer AA because post-FX is disabled.
 */
export type BoardScreenSpaceAA = 'auto' | 'smaa' | 'msaa' | 'off';

/** PERF-001: bundled caps for board DPR, menu Pixi resolution, and optional board glow tier. */
export type GraphicsQualityPreset = 'low' | 'medium' | 'high';

export interface Settings {
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
    displayMode: DisplayMode;
    uiScale: number;
    reduceMotion: boolean;
    /** PERF-001: drives board DPR cap and menu Pixi resolution cap. */
    graphicsQuality: GraphicsQualityPreset;
    boardScreenSpaceAA: BoardScreenSpaceAA;
    /**
     * FX-015: optional board-stage glow. Default off in save data. Ignored on `low` quality.
     * On `high` with this on, `GameScreen` adds a light CSS rim under the board.
     */
    boardBloomEnabled: boolean;
    debugFlags: DebugFlags;
    boardPresentation: BoardPresentationMode;
    /** HUD-012: `auto` = breakpoint-derived; see `deriveCameraViewportMode` in `cameraViewportMode.ts`. */
    cameraViewportModePreference: CameraViewportModePreference;
    /** Dim hidden tiles that are not orthogonally adjacent to the lone flipped tile (fallback board / a11y experiment). */
    tileFocusAssist: boolean;
    /** Multiplier for mismatch/match resolve delay (playing phase). */
    resolveDelayMultiplier: number;
    weakerShuffleMode: WeakerShuffleMode;
    /** After mismatch, keep tiles face-up slightly longer (Echo feedback). */
    echoFeedbackEnabled: boolean;
    /** Experimental: brief numeric pulse overlay (off by default; respect reduce motion). */
    distractionChannelEnabled: boolean;
    /** Reduce match score multiplier slightly each shuffle this run when enabled. */
    shuffleScoreTaxEnabled: boolean;
    /**
     * While face-up on a committed flip, show Manhattan grid distance to the nearest tile that can complete the pair
     * (helps on larger boards; decoys show no number).
     */
    pairProximityHintsEnabled: boolean;
}

export interface Tile {
    id: string;
    pairKey: string;
    symbol: string;
    label: string;
    state: TileState;
    /** Visible on the back from the moment the floor opens. Absent only on legacy or authored boards. */
    suit?: TileSuit;
    /** True on a tile a chunk break took off the board, so it can be told apart from a defeated enemy. */
    brokenByChunk?: boolean;
    /** Visual variant index for atomic-pairs styling (optional). */
    atomicVariant?: number;
    /** If set, matching this pair claims a pickup reward on eligible floors. */
    findableKind?: FindableKind;
    /** If set, matching this pair claims the selected route's next-floor card reward. */
    routeCardKind?: RouteCardKind;
    /** Route-world gameplay family; keeps `routeCardKind` available as the broad visual route marker. */
    routeSpecialKind?: RouteSpecialKind;
    /** True after an information tool has identified this route-world special without claiming it. */
    routeSpecialRevealed?: boolean;
    /** Source of route-special information reveal; affects player-facing copy only. */
    routeSpecialRevealSource?: 'peek' | 'lantern_ward' | 'omen_seal';
    /** Dungeon-card layer: encounter/room object carried by this card pair. */
    dungeonCardKind?: DungeonCardKind;
    /** Optional board hazard marker for generated or authored hazard tile effects. */
    tileHazardKind?: HazardTileKind;
    /** Optional lightweight pair modifier: adds match rewards or mismatch drawbacks without changing pair identity. */
    tileTraitKind?: TileTraitKind;
    /** True when Lantern Ward has identified this hidden card as safe-to-know information. */
    lanternScouted?: boolean;
    /** Source of passive scout information for hidden dungeon/hazard cards; affects player-facing copy only. */
    scoutRevealSource?: 'lantern_ward' | 'omen_seal';
    /** Boss identity when this dungeon card is the floor's boss pair. */
    dungeonBossId?: DungeonBossId;
    /** Hidden until revealed, then resolved after its one-shot or pair reward is consumed. */
    dungeonCardState?: DungeonCardState;
    /** Deterministic card effect/reward identity for rules and UI copy. */
    dungeonCardEffectId?: DungeonCardEffectId;
    /** Enemy cards use pair-shared HP; mirrored on both tiles in the pair. */
    dungeonCardHp?: number;
    dungeonCardMaxHp?: number;
    /** Gateway cards select the route that shapes the next floor. */
    dungeonRouteType?: RouteNodeType;
    /** Singleton exits can be gated by floor levers or run-local keys. */
    dungeonExitLockKind?: DungeonExitLockKind;
    dungeonExitRequiredLeverCount?: number;
    dungeonExitActivated?: boolean;
    dungeonKeyKind?: DungeonKeyKind;
    dungeonRoomUsed?: boolean;
}

export type FloorTag = 'normal' | 'breather' | 'boss';
export type FloorArchetypeId =
    | 'survey_hall'
    | 'speed_trial'
    | 'treasure_gallery'
    | 'shadow_read'
    | 'anchor_chain'
    | 'trap_hall'
    | 'script_room'
    | 'rush_recall'
    | 'parasite_tithe'
    | 'spotlight_hunt'
    | 'breather';

export interface BoardState {
    level: number;
    pairCount: number;
    columns: number;
    rows: number;
    tiles: Tile[];
    flippedTileIds: string[];
    matchedPairs: number;
    /** GP-O02: optional pair key that grants a bonus if matched last among real pairs. */
    cursedPairKey?: string | null;
    /** `shifting_spotlight`: pair that scores less if matched while it is the ward (rotates after each flip resolution). */
    wardPairKey?: string | null;
    /** `shifting_spotlight`: pair that scores more if matched while it is the bounty. */
    bountyPairKey?: string | null;
    /** GP-F03: pacing tag for this floor. */
    floorTag?: FloorTag;
    /** Endless-only authored chapter identity; null outside the schedule. */
    floorArchetypeId: FloorArchetypeId | null;
    /** Endless-only visible goal for this floor; null outside the schedule. */
    featuredObjectiveId: FeaturedObjectiveId | null;
    /** REG-077: 1-based position within the 12-floor authored endless cycle. */
    cycleFloor?: number | null;
    /** REG-077: player-facing act/biome metadata for HUD, Codex, and deterministic test routing. */
    actTitle?: string | null;
    actFloorNumber?: number | null;
    actFloorCount?: number | null;
    biomeTitle?: string | null;
    biomeTone?: string | null;
    /** GP-RW01: selected route's deterministic pressure/reward profile for this generated floor. */
    routeWorldProfile?: RouteWorldProfile | null;
    /** First gateway matched on this floor; drives board-only route selection. */
    selectedGatewayRouteType?: RouteNodeType | null;
    /** Floor-local key count for dungeon locks. */
    dungeonKeysHeld?: number;
    /** Typed floor-local key counts; legacy `dungeonKeysHeld` is treated as iron when this is absent. */
    dungeonKeysHeldByKind?: Partial<Record<DungeonKeyKind, number>>;
    dungeonExitTileId?: string | null;
    dungeonExitActivated?: boolean;
    dungeonExitLockKind?: DungeonExitLockKind;
    dungeonExitRequiredLeverCount?: number;
    dungeonLeverCount?: number;
    dungeonShopTileId?: string | null;
    dungeonShopVisited?: boolean;
    dungeonBossId?: DungeonBossId | null;
    dungeonObjectiveId?: DungeonObjectiveId | null;
    enemyHazards?: EnemyHazardState[];
    enemyHazardTurn?: number;
}

export interface SessionStats {
    totalScore: number;
    currentLevelScore: number;
    bestScore: number;
    tries: number;
    rating: Rating;
    levelsCleared: number;
    matchesFound: number;
    mismatches: number;
    highestLevel: number;
    currentStreak: number;
    bestStreak: number;
    perfectClears: number;
    guardTokens: number;
    comboShards: number;
    tileTraitMatches: Record<TileTraitKind, number>;
    tileTraitMismatches: Record<TileTraitKind, number>;
    volatileTraitShuffles: number;
    shufflesUsed: number;
    pairsDestroyed: number;
}

export interface LevelResult {
    level: number;
    scoreGained: number;
    rating: Rating;
    livesRemaining: number;
    perfect: boolean;
    mistakes: number;
    clearLifeReason: ClearLifeReason;
    clearLifeGained: number;
    /** Optional objective bonuses (e.g. scholar_style, glass_witness, cursed_last, flip_par). */
    bonusTags?: string[];
    /** Extra score from bonusTags (included in scoreGained). */
    objectiveBonusScore?: number;
    featuredObjectiveId?: FeaturedObjectiveId;
    featuredObjectiveCompleted?: boolean;
    relicFavorGained?: number;
    featuredObjectiveStreak?: number;
    featuredObjectiveStreakBonus?: number;
    endlessRiskWagerOutcome?: EndlessRiskWagerOutcome;
    endlessRiskWagerFavorGained?: number;
    endlessRiskWagerStreakLost?: number;
    bossTrophyCacheOutcome?: 'claimed' | 'forfeited';
    bossTrophyCacheScore?: number;
    hazardTileTriggers?: number;
    hazardShuffleSnares?: number;
    hazardCascadeCaches?: number;
    hazardMirrorDecoys?: number;
    hazardFragileCacheClaims?: number;
    hazardFragileCacheBreaks?: number;
    hazardTollCaches?: number;
    hazardFuseCaches?: number;
    hazardFuseCacheExpiredClaims?: number;
    lanternWardScouts?: number;
    omenSealScouts?: number;
    mimicCacheClaims?: number;
    mimicCacheBites?: number;
    anchorSealUses?: number;
    loadedGatewayPlans?: number;
    catalystAltarUpgrades?: number;
    parasiteVesselConversions?: number;
    pinLatticeRewards?: number;
    safeHazardWardsUsed?: number;
    recallMatches?: number;
    recallMistakes?: number;
    recallBonusScore?: number;
    /** REG-017: deterministic local route options for the next floor; UI-only until map/shop nodes land. */
    routeChoices?: RouteChoice[];
    traitRouteObjectiveCompleted?: boolean;
    traitRouteObjectiveProgress?: number;
    traitRouteObjectiveRequired?: number;
    traitRouteObjectiveReward?: string;
}

export type RouteNodeType = 'safe' | 'greed' | 'mystery';
export type RouteCardKind = 'safe_ward' | 'greed_cache' | 'mystery_veil';
export type RouteSpecialKind =
    | RouteCardKind
    | 'elite_cache'
    | 'final_ward'
    | 'greed_toll'
    | 'fragile_cache'
    | 'guard_cache'
    | 'lantern_ward'
    | 'mimic_cache'
    | 'anchor_seal'
    | 'loaded_gateway'
    | 'catalyst_altar'
    | 'parasite_vessel'
    | 'pin_lattice'
    | 'omen_seal'
    | 'secret_door'
    | 'keystone_pair';
export type RouteWorldIntensity = 'safe' | 'greed' | 'mystery';
export type DungeonKeyKind = 'iron' | 'treasure' | 'shrine' | 'boss' | 'trap';
export type DungeonExitLockKind = 'none' | 'lever' | DungeonKeyKind;
export type DungeonCardKind =
    | 'enemy'
    | 'trap'
    | 'treasure'
    | 'shrine'
    | 'gateway'
    | 'key'
    | 'lock'
    | 'exit'
    | 'lever'
    | 'shop'
    | 'room';
export type HazardTileKind = 'shuffle_snare' | 'cascade_cache' | 'mirror_decoy' | 'fragile_cache' | 'toll_cache' | 'fuse_cache';
export type TileTraitKind =
    | 'echo'
    | 'volatile'
    | 'mirror'
    | 'cursed'
    | 'sealed'
    | 'heavy'
    | 'drift'
    | 'conduit'
    | 'stasis';
export type DungeonCardState = 'hidden' | 'revealed' | 'resolved';
export type DungeonBossId = 'trap_warden' | 'rush_sentinel' | 'treasure_keeper' | 'spire_observer';
export type EnemyHazardKind = 'sentinel' | 'stalker' | 'warden' | 'observer';
export type EnemyHazardPattern = 'patrol' | 'stalk' | 'guard' | 'observe';
export type EnemyHazardStateKind = 'hidden' | 'revealed' | 'defeated';
export interface EnemyHazardState {
    id: string;
    kind: EnemyHazardKind;
    label: string;
    currentTileId: string;
    nextTileId: string;
    pattern: EnemyHazardPattern;
    state: EnemyHazardStateKind;
    damage: number;
    hp: number;
    maxHp: number;
    bossId?: DungeonBossId;
}
export type DungeonObjectiveId =
    | 'find_exit'
    | 'open_bonus_exit'
    | 'disarm_traps'
    | 'defeat_boss'
    | 'pacify_floor'
    | 'claim_route'
    | 'loot_cache'
    | 'reveal_unknowns';
export interface DungeonFloorBlueprint {
    level: number;
    floorTag: FloorTag;
    floorArchetypeId: FloorArchetypeId | null;
    bossId: DungeonBossId | null;
    objectiveId: DungeonObjectiveId;
    threatBudget: number;
    rewardBudget: number;
    utilityBudget: number;
    lockBudget: number;
    gatewayBudget: number;
    exitSpecs: {
        id: string;
        routeType: RouteNodeType;
        effectId: DungeonCardEffectId;
        lockKind: DungeonExitLockKind;
        requiredLeverCount: number;
        labelPrefix: string;
    }[];
    pairedCardSpecs: {
        kind: DungeonCardKind;
        effectId: DungeonCardEffectId;
        symbol: string;
        label: string;
        keyKind?: DungeonKeyKind;
        hp?: number;
        routeType?: RouteNodeType;
        bossId?: DungeonBossId;
    }[];
    roomEffectIds: DungeonCardEffectId[];
    shopTileId: string | null;
}
export type DungeonCardEffectId =
    | 'enemy_sentry'
    | 'enemy_elite'
    | 'enemy_stalker'
    | 'trap_spikes'
    | 'trap_curse'
    | 'trap_mimic'
    | 'trap_alarm'
    | 'trap_snare'
    | 'trap_hex'
    | 'treasure_gold'
    | 'treasure_cache'
    | 'treasure_shard'
    | 'shrine_guard'
    | 'gateway_safe'
    | 'gateway_greed'
    | 'gateway_mystery'
    | 'gateway_depth'
    | 'key_iron'
    | 'key_master'
    | 'lock_cache'
    | 'exit_safe'
    | 'exit_greed'
    | 'exit_mystery'
    | 'exit_boss'
    | 'lever_floor'
    | 'rune_seal'
    | 'shop_vendor'
    | 'room_campfire'
    | 'room_fountain'
    | 'room_map'
    | 'room_forge'
    | 'room_shrine'
    | 'room_scrying_lens'
    | 'room_armory'
    | 'room_locked_cache'
    | 'room_key_cache'
    | 'room_trap_workshop'
    | 'room_omen_archive';

export interface RouteWorldProfile {
    routeType: RouteNodeType;
    intensity: RouteWorldIntensity;
    choiceId: string;
    sourceLevel: number;
    targetLevel: number;
    hazardBudget: number;
    rewardBudget: number;
    safetyBudget: number;
    informationBudget: number;
    routeSpecialKinds: RouteSpecialKind[];
    summary: string;
}

export interface RouteCardPlan {
    choiceId: string;
    routeType: RouteNodeType;
    sourceLevel: number;
    targetLevel: number;
}

export interface RouteChoice {
    id: string;
    routeType: RouteNodeType;
    label: string;
    detail: string;
    rewardPreview?: string;
    riskPreview?: string;
}

export type DungeonRunNodeKind =
    | 'entrance'
    | 'combat'
    | 'elite'
    | 'trap'
    | 'treasure'
    | 'shop'
    | 'rest'
    | 'event'
    | 'boss'
    | 'exit';
export type DungeonRunNodeStatus = 'hidden' | 'revealed' | 'current' | 'cleared' | 'skipped' | 'locked';

export interface DungeonRunNode {
    id: string;
    floor: number;
    depth: number;
    lane: number;
    kind: DungeonRunNodeKind;
    status: DungeonRunNodeStatus;
    routeType: RouteNodeType;
    label: string;
    detail: string;
    rewardPreview?: string;
    riskPreview?: string;
    /** Player-facing route label that produced this node, retained when node kind normalizes to boss/exit. */
    routeApproachLabel?: string;
    /** Original choice route before node-kind normalization; useful for converged boss-gate readability. */
    routeApproachType?: RouteNodeType;
    edgeIds: string[];
    choiceId?: string;
    offlineOnly: true;
    unlocksSystems: string[];
}

export interface DungeonRunMapState {
    seed: number;
    rulesVersion: number;
    act: number;
    currentFloor: number;
    currentNodeId: string;
    selectedNodeId: string | null;
    nodes: DungeonRunNode[];
}

export type BonusRewardId =
    | 'chest_gold'
    | 'secret_favor'
    | 'bonus_shards'
    | 'supply_cache'
    | 'trait_toolkit'
    | 'key_insurance'
    | 'hazard_ward'
    | 'free_swap_floor'
    | 'echo_conduit_lens'
     | 'trait_streak_lens'
     | 'cursed_opener_contract'
     | 'stasis_lockbox'
     | 'hazard_banisher';

export type RewardPerkId =
    | 'free_first_swap_per_floor'
    | 'echo_conduit_double'
    | 'trait_streak_toolkit'
    | 'cursed_opener_greed'
    | 'hazard_banish_per_floor';

export interface BonusRewardLedger {
    claimedInstanceIds: string[];
    claimedRewardIds: Partial<Record<BonusRewardId, number>>;
    discoveredSecretRooms: number;
    openedTreasureRooms: number;
}

export type RouteSideRoomKind = 'rest_shrine' | 'run_event' | 'bonus_reward';

export interface RouteSideRoomChoiceState {
    id: string;
    label: string;
    detail: string;
    primary?: boolean;
    traitBuildLabels?: string[];
    traitBuildReason?: string;
    rewardPerkNextCue?: string;
    nextCue?: string;
    rewardImpactKind?: 'build' | 'resource' | 'risk' | 'unlock';
    rewardImpactCue?: string;
    rewardImpactDetail?: string;
    rewardImpactBeats?: 2 | 3 | 4;
}

export interface RouteSideRoomState {
    id: string;
    kind: RouteSideRoomKind;
    routeType: RouteNodeType;
    nodeKind: 'combat' | 'shop' | 'elite' | 'rest' | 'event' | 'treasure';
    floor: number;
    title: string;
    body: string;
    primaryLabel: string;
    primaryDetail: string;
    skipLabel: string;
    choices?: RouteSideRoomChoiceState[];
    payload:
        | { kind: 'rest_heal'; serviceId: string }
        | { kind: 'event_choice'; eventKey: string; choiceId: string }
        | { kind: 'bonus_reward'; instanceId: string };
}

export interface RunSummary {
    totalScore: number;
    bestScore: number;
    levelsCleared: number;
    highestLevel: number;
    achievementsEnabled: boolean;
    unlockedAchievements: AchievementId[];
    bestStreak: number;
    perfectClears: number;
    /** Present for seeded modes (daily, shared challenge). */
    runSeed?: number;
    runRulesVersion?: number;
    gameMode?: GameMode;
    dailyDateKeyUtc?: string;
    activeMutators?: MutatorId[];
    relicIds?: RelicId[];
    /** Archive-safe payoff lanes copied from the final run state for Profile / Collection recap surfaces. */
    payoffPickupClaimed?: number;
    payoffPickupTotal?: number;
    payoffPressureExtra?: number;
    payoffRewardPerkCount?: number;
    payoffRoutePaid?: boolean;
    payoffRouteRewardText?: string | null;
    startingLoadoutId?: StartingLoadoutId | null;
    practiceMode?: boolean;
    wildMenuRun?: boolean;
    dungeonShowcaseRun?: boolean;
    activeContract?: ContractFlags | null;
    /** Bounded, schema-validated command evidence from the completed run. */
    gameplayCommandJournal?: GameplayCommandJournalEntry[];
    /** Bounded, schema-validated event evidence from the completed run. */
    gameplayEventJournal?: GameplayEventJournalEntry[];
}

export interface GameplayCommandJournalEntry {
    schemaVersion: number;
    commandId: string;
    type: string;
}

export interface GameplayEventJournalEntry {
    schemaVersion: number;
    eventId: string;
    commandId: string;
    sequence: number;
    type: string;
    source: {
        kind: string;
        id: string;
    };
}

export interface RunTimerState {
    memorizeRemainingMs: number | null;
    resolveRemainingMs: number | null;
    debugRevealRemainingMs: number | null;
    pausedFromStatus: ResumableRunStatus | null;
    gauntletPausedAtMs?: number | null;
}

/**
 * One person at a same-device table. Defined here rather than beside its rules for the same reason
 * `RunHistoryRecord` is: `RunState` cannot import from a module that imports `RunState`.
 */
export interface PassAndPlaySeat {
    /** Stable across a run; used for test ids and for keying the HUD. */
    readonly id: string;
    readonly label: string;
    readonly score: number;
    readonly matches: number;
    /** Completed turns, so a standings line can say who has had fewer. */
    readonly turns: number;
}

export interface PassAndPlayState {
    readonly seats: readonly PassAndPlaySeat[];
    readonly activeSeatIndex: number;
    /**
     * True from the moment a turn is lost until the next player acts. The board is face down at
     * that instant, which is the only safe moment to hand a device over.
     */
    readonly handoffPending: boolean;
}

export interface RunState {
    status: RunStatus;
    lives: number;
    /**
     * Same-device multiplayer seats, or null on every single-player run. Lives and the board stay
     * shared — only the credit is split — so nothing else in the run has to know this is here.
     */
    passAndPlay?: PassAndPlayState | null;
    board: BoardState | null;
    stats: SessionStats;
    achievementsEnabled: boolean;
    debugUsed: boolean;
    debugPeekActive: boolean;
    /** Banked extra memorize time (ms) applied on the next level's memorize phase, then cleared. */
    pendingMemorizeBonusMs: number;
    shuffleCharges: number;
    destroyPairCharges: number;
    pinnedTileIds: string[];
    /**
     * Set when the player uses a **meta power or assist** that disqualifies the perfect-clear achievement
     * (`ACH_PERFECT_CLEAR`): full-board shuffle, row shuffle, tile swap, destroy, peek, undo resolving,
     * gambit third pick, stray remove, flash pair, wild match, etc. Pins do **not** set this flag.
     */
    powersUsedThisRun: boolean;
    timerState: RunTimerState;
    lastLevelResult: LevelResult | null;
    lastRunSummary: RunSummary | null;
    /** Master seed for this run; drives per-level tile order and shuffles. */
    runSeed: number;
    runRulesVersion: number;
    gameMode: GameMode;
    /** Optional starting archetype that shapes early resources and first-floor decisions. */
    startingLoadoutId?: StartingLoadoutId | null;
    /** Increments each time the player shuffles (deterministic shuffle order). */
    shuffleNonce: number;
    activeMutators: MutatorId[];
    relicIds: RelicId[];
    /** How many relic milestone visits have been completed this run (every 3 floors from floor 3, capped). One visit may grant multiple relics. */
    relicTiersClaimed: number;
    /**
     * Extra relic selections for the **next** milestone draft only (consumed when `openRelicOffer` runs).
     * Sources: `grantBonusRelicPickNextOffer` (future relics/meta/mutators).
     */
    bonusRelicPicksNextOffer: number;
    /** Subset of `bonusRelicPicksNextOffer` sourced specifically from endless featured-objective favor. */
    favorBonusRelicPicksNextOffer: number;
    /** Endless-only favor bank from featured objectives; every 3 converts to +1 extra relic pick. */
    relicFavorProgress: number;
    /** REG-015: temporary run-only vendor currency; resets on new run and never persists to SaveData. */
    shopGold: number;
    /** REG-015/070/071: deterministic local vendor offers available from floor-clear overlays. */
    shopOffers: RunShopOfferState[];
    /** REG-070: one local reroll per floor-clear shop visit. */
    shopRerolls: number;
    /** Endless-only consecutive featured-objective clears. Normal misses decay this; risk-wager misses reset it. */
    featuredObjectiveStreak: number;
    /** Endless-only risk wager armed from a level-complete modal for the next floor. */
    endlessRiskWager: EndlessRiskWagerState | null;
    /** Run-local selected route payload consumed by the next board generation. */
    pendingRouteCardPlan: RouteCardPlan | null;
    /** Run-local route side-room stop offered after route choice and before the next floor. */
    sideRoom: RouteSideRoomState | null;
    /** Persistent roguelite dungeon graph for the current run. Boards resolve the current node. */
    dungeonRun: DungeonRunMapState;
    /** Anti-grind ledger for route side-room bonus rewards. */
    bonusRewardLedger: BonusRewardLedger;
    /** Floor-local trait-route objective progress. Active when required > 0. */
    traitRouteObjectiveProgressThisFloor: number;
    traitRouteObjectiveRequiredThisFloor: number;
    traitRouteObjectiveCompletedThisFloor: boolean;
    traitRouteObjectiveRewardClaimedThisFloor: boolean;
    traitRouteObjectiveRewardTextThisFloor: string | null;
    traitRouteObjectiveTriggeredTagsThisFloor: string[];
    /** Durable perks claimed from route reward drafts; optional for old run snapshots/tests. */
    rewardPerkIds?: RewardPerkId[];
    /** Run-local deterministic command journal; persisted only through the bounded final summary. */
    gameplayCommandJournal?: GameplayCommandJournalEntry[];
    /** Run-local deterministic event journal; persisted only through the bounded final summary. */
    gameplayEventJournal?: GameplayEventJournalEntry[];
    /**
     * Copied from save at run start: meta unlock grants +1 relic pick at **each** milestone (`relicShrineExtraPickUnlocked`).
     */
    metaRelicDraftExtraPerMilestone: number;
    /** Milestone relic draft before advancing (see `relics.ts` cadence). */
    relicOffer: null | RelicOfferState;
    activeContract: ContractFlags | null;
    /** Practice runs disable achievements (optional ranked split). */
    practiceMode: boolean;
    dailyDateKeyUtc: string | null;
    puzzleId: string | null;
    /** Sticky fingers: flat index blocked for the next opening flip after a match. */
    stickyBlockIndex: number | null;
    /** Score parasite: floors advanced since last life loss from mutator. */
    parasiteFloors: number;
    /** Relic: free shuffle once per floor (consumed on use). */
    freeShuffleThisFloor: boolean;
    /** Gauntlet: ms remaining for whole run; null = off. */
    gauntletDeadlineMs: number | null;
    /** Gauntlet: configured session length (ms) at run start; used for restart and diagnostics. */
    gauntletSessionDurationMs: number | null;
    /** Last run flip tile ids (local ghost / export). */
    flipHistory: string[];
    /** H1 Peek: charges and ephemeral reveals (do not count as committed flips). */
    peekCharges: number;
    peekRevealedTileIds: string[];
    /** H2 Undo: remaining undos this floor (cancel resolving before timer). */
    undoUsesThisFloor: number;
    /** H3 Gambit: one third-flip attempt per floor. */
    gambitAvailableThisFloor: boolean;
    gambitThirdFlipUsed: boolean;
    wildMatchesRemaining: number;
    /** Stray remover power charges (remove one completion-safe hidden singleton from play). */
    strayRemoveCharges: number;
    /** Match score multiplier (shuffle tax stacks). */
    matchScoreMultiplier: number;
    /** N-back mutator: matches since last anchor highlight. */
    nBackMatchCounter: number;
    nBackAnchorPairKey: string | null;
    /** Pair keys matched this run (spaced encore bookkeeping). */
    matchedPairKeysThisRun: string[];
    weakerShuffleMode: WeakerShuffleMode;
    shuffleScoreTaxActive: boolean;
    /** Copied from settings at run start for resolve timing. */
    resolveDelayMultiplier: number;
    echoFeedbackEnabled: boolean;
    /** Started from Wild / Joker menu (restart routing). */
    wildMenuRun: boolean;
    /** Started from the dungeon showcase entry; retry should return to the authored combat-room setup. */
    dungeonShowcaseRun: boolean;
    /** GP-O04: shuffle used this floor (for scholar-style bonus). */
    shuffleUsedThisFloor: boolean;
    /** GP-O04: destroy used this floor. */
    destroyUsedThisFloor: boolean;
    /** GP-O01: decoy tile was part of a mismatch resolution this floor. */
    decoyFlippedThisFloor: boolean;
    /** True when current board includes the glass decoy tile. */
    glassDecoyActiveThisFloor: boolean;
    /** GP-O02: cursed pair matched before all other real pairs cleared. */
    cursedMatchedEarlyThisFloor: boolean;
    /** GP-O03: number of successful match resolutions (two flips → match) this floor. */
    matchResolutionsThisFloor: number;
    /** GP-R02: ignore next parasite life loss once. */
    parasiteWardRemaining: number;
    /** GP-H02: flash-pair charges (practice / wild). */
    flashPairCharges: number;
    /** Tile ids temporarily shown by flash pair (ms handled in renderer/timer). */
    flashPairRevealedTileIds: string[];
    /** GP-H01: charges for shuffling a single row or swapping two hidden tiles. */
    regionShuffleCharges: number;
    /** First region shuffle or tile swap this floor free when relic (GP-R03). */
    regionShuffleFreeThisFloor: boolean;
    /** GP-C01: cumulative pins placed this run (for maxPinsTotalRun contract). */
    pinsPlacedCountThisRun: number;
    /** Findables: successful match claims this floor (resets on advance). */
    findablesClaimedThisFloor: number;
    /** Findables: total pickup pairs that spawned this floor (claimed or forfeited). */
    findablesTotalThisFloor: number;
    /** Memory loop: current clean-recall momentum. Matches raise it, misses and disruptive assists lower it. */
    recallFocus: number;
    recallMatchesThisFloor: number;
    recallMistakesThisFloor: number;
    recallBonusScoreThisFloor: number;
    /** Tile ids whose remembered position was invalidated by a miss, peek, shuffle, or route pressure this floor. */
    forgottenTileIdsThisFloor: string[];
    /** Hazard tiles: total normal-run hazard triggers this floor. */
    hazardTileTriggersThisFloor: number;
    /** Who is resident on this floor; null before the first floor opens. */
    floorCurioId?: string | null;
    /** True once the player has greeted this floor's resident. One greeting per floor. */
    floorCurioGreeted?: boolean;
    /** Chunk breaks a chain has bought on this floor, and the pairs they took with them. */
    chunkBreaksThisFloor: number;
    chunkPairsBrokenThisFloor: number;
    /** Pairs the magpie has taken back on this floor. */
    magpieTheftsThisFloor: number;
    /** Times a guard token drove the magpie off on this floor. */
    magpieScaredOffThisFloor: number;
    hazardShuffleSnaresThisFloor: number;
    hazardCascadeCachesThisFloor: number;
    hazardMirrorDecoysThisFloor: number;
    hazardFragileCacheClaimsThisFloor: number;
    hazardFragileCacheBreaksThisFloor: number;
    hazardTollCachesThisFloor: number;
    hazardFuseCachesThisFloor: number;
    hazardFuseCacheExpiredClaimsThisFloor: number;
    lanternWardScoutsThisFloor: number;
    omenSealScoutsThisFloor: number;
    mimicCacheClaimsThisFloor: number;
    mimicCacheBitesThisFloor: number;
    mimicCacheGuardBitesThisFloor: number;
    anchorSealChargesThisFloor: number;
    anchorSealUsesThisFloor: number;
    loadedGatewayPlansThisFloor: number;
    catalystAltarUpgradesThisFloor: number;
    parasiteVesselConversionsThisFloor: number;
    pinLatticeRewardsThisFloor: number;
    safeHazardWardChargesThisFloor: number;
    safeHazardWardsUsedThisFloor: number;
    /** `shifting_spotlight`: increments each time ward/bounty rotates this floor (seed step for next pick). */
    shiftingSpotlightNonce: number;
    dungeonEnemiesDefeated: number;
    dungeonEnemiesDefeatedThisFloor: number;
    dungeonTrapsTriggered: number;
    dungeonTrapsResolvedThisFloor: number;
    dungeonTreasuresOpened: number;
    dungeonTreasuresOpenedThisFloor: number;
    dungeonGatewaysUsed: number;
    dungeonGatewaysUsedThisFloor: number;
    dungeonKeys: Partial<Record<DungeonKeyKind, number>>;
    dungeonMasterKeys: number;
    enemyHazardHitsThisFloor: number;
    enemyHazardsDefeatedThisFloor: number;
}

export type AchievementState = Record<AchievementId, boolean>;

export interface PlayerStatsPersisted {
    bestFloorNoPowers: number;
    dailiesCompleted: number;
    lastDailyDateKeyUtc: string | null;
    /** Cosmetic streak: consecutive UTC days with at least one daily completed. */
    dailyStreakCosmetic: number;
    /**
     * Whether the streak's one grace day is unspent. A single missed UTC day is forgiven while it
     * is, and clearing on a consecutive day earns it back — so a genuine miss costs nothing and
     * clearing every other day still cannot hold a streak open forever.
     */
    dailyStreakGraceAvailable?: boolean;
    relicPickCounts: Partial<Record<RelicId, number>>;
    /** REG-022: local puzzle completion records by builtin/import puzzle id. */
    puzzleCompletions?: Record<string, PuzzleCompletionRecord>;
    /** Spaced encore: pairKeys seen on previous completed run (no PII). */
    encorePairKeysLastRun: string[];
    /** Meta: +1 relic pick at each milestone draft after the Profile reward is claimed. */
    relicShrineExtraPickUnlocked?: boolean;
}

/**
 * One finished run, kept so a player has a record of more than the run they just played. Defined
 * here rather than beside its helpers because `SaveData` cannot import from a module that imports
 * `SaveData`.
 */
export interface RunHistoryRecord {
    /** The mode as the player picked it, not the game mode underneath it. */
    readonly mode: string;
    readonly highestLevel: number;
    readonly totalScore: number;
    /** ISO instant the run ended. */
    readonly endedAtIso: string;
    /** The key that replays this run, or null for a run that cannot be handed over. */
    readonly shareKey: string | null;
}

export interface SaveData {
    schemaVersion: number;
    bestScore: number;
    achievements: AchievementState;
    settings: Settings;
    onboardingDismissed: boolean;
    /** Menu-only explainer panel state; does not suppress playable first-run prompts. */
    firstRunHelpDismissed?: boolean;
    lastRunSummary: RunSummary | null;
    /**
     * The last few finished runs, newest first, bounded. `lastRunSummary` is the run you just
     * played; this is the record of the ones before it. Optional so an older save reads as an
     * empty history rather than as an invalid one.
     */
    runHistory?: RunHistoryRecord[];
    /** v3+ meta */
    playerStats?: PlayerStatsPersisted;
    unlocks?: string[];
    powersFtueSeen?: boolean;
}

/**
 * Steam Rich Presence, as sent to the friends list. Declared here rather than in `rich-presence.ts`
 * so `DesktopApi` can name it without contracts importing a module that imports contracts back.
 */
export type RichPresenceToken = '#Status_Menu' | '#Status_Run' | '#Status_Endless' | '#Status_Daily' | '#Status_Puzzle';

export interface RichPresenceState {
    readonly display: RichPresenceToken;
    readonly floor?: string;
    readonly mode?: string;
}

/** Result of a Steam achievement activation attempt (renderer + main). */
export type AchievementUnlockResult =
    | { ok: true }
    | { ok: false; reason: 'not_connected' | 'steam_rejected' | 'persistence_error'; detail?: string };

/**
 * What earlier sessions left behind, so the player can find it. Crash logs never leave the machine,
 * which only helps if somebody can be told where they are.
 */
export interface CrashReportSummary {
    readonly count: number;
    /** Absolute path to the folder holding the logs. */
    readonly directory: string;
    readonly latestFileName: string | null;
}

/** Which renderer failure a report describes; mirrors the crash kinds the main process writes. */
export type RendererErrorKind = 'renderer_error' | 'renderer_window_error' | 'renderer_unhandled_rejection';

/** What the renderer knows about an error it just caught. Message and stack only; no paths. */
export interface RendererErrorReport {
    readonly message: string;
    readonly stack: string | null;
    /** React's component stack, which names the screen that failed. */
    readonly componentStack: string | null;
}

export interface DesktopApi {
    saveSettings: (settings: Settings) => Promise<unknown>;
    getSaveData: () => Promise<unknown>;
    saveGame: (data: SaveData) => Promise<unknown>;
    /**
     * Sets an unreadable save aside and starts a fresh profile. Only reachable from the notice the
     * player sees when their save could not be read, and never destructive: the old file is kept.
     */
    recoverUnreadableSave: () => Promise<unknown>;
    /**
     * Records a render error the top-level boundary caught. Never throws to the caller: a failure
     * to write the report must not take out the screen that is already apologising for one.
     */
    reportRendererError: (report: RendererErrorReport, kind?: RendererErrorKind) => Promise<void>;
    /** Crash reports from earlier sessions, so Settings can say where to find them. */
    getCrashReportSummary: () => Promise<unknown>;
    /**
     * Opens the save file in the desktop's file manager, selected. Export, import and backup are
     * all "copy the file yourself", which needs the player to be able to find the file.
     */
    revealSaveFile: () => Promise<unknown>;
    unlockAchievement: (id: AchievementId) => Promise<unknown>;
    /** Publishes what the player is doing to their friends list; cosmetic and never awaited for correctness. */
    setRichPresence: (state: RichPresenceState) => Promise<void>;
    isSteamConnected: () => Promise<unknown>;
    quitApp: () => Promise<void>;
}
