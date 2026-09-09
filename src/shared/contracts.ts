/**
 * Cross-cutting types and constants for save payloads, runs, and UI contracts.
 *
 * **Breaking changes:** run `yarn typecheck` (or `yarn verify`), grep for renamed exports under `docs/`, extend
 * `normalizeSaveData` + `save-data.test.ts` fixtures when save shape changes, and check the PR checklist
 * (`.github/pull_request_template.md`). See docs/refinement-tasks REF-066. For optional payloads, consider aligning
 * with TypeScript `exactOptionalPropertyTypes` when feasible.
 */
export const SAVE_SCHEMA_VERSION = 8;
/** Bump when generation rules change (tile order, mutators, pair layout). */
export const GAME_RULES_VERSION = 39;
/** Hard cap on life total during a run; HUD renders this many heart slots (PLAY-004 — honest max, not mock’s three). */
export const MATCH_DELAY_MS = 850;
export const FEATURED_OBJECTIVE_STREAK_BONUS_PER_STEP = 10;
export const FEATURED_OBJECTIVE_STREAK_BONUS_MAX = 50;
export const FEATURED_OBJECTIVE_STREAK_MISS_DECAY = 2;
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
/** Memorize time drops by MEMORIZE_STEP_MS once per this many levels (so pairs and timer do not spike together every floor). */
export const MEMORIZE_DECAY_EVERY_N_LEVELS = 2;
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
export const BOSS_FLOOR_SCORE_MULTIPLIER = 1.25;

export type DisplayMode = 'windowed' | 'fullscreen';
export type TileState = 'hidden' | 'flipped' | 'matched' | 'removed';
/**
 * The suit painted on a tile's back. Both tiles of a pair share it, and it is the one thing about
 * a face-down tile the player is allowed to know — the map a chain is planned against.
 */
export type TileSuit = 'ember' | 'tide' | 'moss' | 'bone';
export type Rating = 'S++' | 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
/**
 * How a run ended (thesis §42.2). There are no lives: a run ends when the player stops, when a
 * floor is not cleared within its turn ceiling, when a contract's mismatch limit is passed, or
 * when a shared game's last floor is done. Null while the run is alive.
 */
export type RunEndReason = 'turn_ceiling' | 'quit' | 'contract' | 'pass_and_play_final_floor';
export type FeaturedObjectiveId = 'scholar_style' | 'glass_witness' | 'cursed_last' | 'flip_par';
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
    | 'codex';

/** Where sub-screens (mode select, collection, profile, inventory, codex) return on Back. */
export type SubscreenReturnView = Exclude<ViewState, 'boot' | 'settings'>;

/**
 * One mode.
 *
 * The game had five: `endless`, `daily`, `puzzle`, `gauntlet` and `meditation`. Four of them were
 * variants of a loop that is not finished, and shipping four variants of an unfinished thing is
 * shipping four unfinished things - it quadruples the surface every change has to be checked
 * against while the loop itself is still being built. The gauntlet's clock outlived the mode for a
 * while as a setup-sheet option; the thesis says no timer, so that went too.
 *
 * `daily` in particular is a good, cheap feature and it is coming back once the loop is finished:
 * see `docs/THESIS_THE_ADDICTIVE_LOOP.md` Appendix C.7, which states the precondition rather than
 * leaving it to be re-argued.
 */
export type GameMode = 'endless';

export type PuzzleDifficulty = 'starter' | 'standard' | 'advanced';
export type PuzzleGoal = 'clear_all' | 'perfect_clear' | 'flip_par';
export type PuzzlePackId = 'tutorial' | 'beginner' | 'challenge' | 'experimental';

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
    'category_letters',
    'short_memorize',
    'wide_recall',
    'silhouette_twist',
    'n_back_anchor',
    'distraction_channel',
    'findables_floor',
    'shifting_spotlight',
    'magpie_thief'
] as const;
export type MutatorId = (typeof MUTATOR_IDS)[number];

/**
 * Bonus pickups attached to some pairs during eligible runs/floors.
 *
 * There were four. The ward spark armed a ward against hazard tiles and the scout glint revealed
 * a hidden dungeon card; with no hazard and no dungeon card on any floor (Gen 176) both paid
 * nothing, and a pickup that pays nothing is a stop. Two kinds remain, both paying on the spot.
 */
export type FindableKind = 'shard_spark' | 'score_glint';

/** Flat score added on top of normal match score when a findable pair is matched. */
export const FINDABLE_MATCH_SCORE: Record<FindableKind, number> = {
    shard_spark: 0,
    score_glint: 25
};
/** Immediate combo-shard gain when a findable pair is matched. */
export const FINDABLE_MATCH_COMBO_SHARDS: Record<FindableKind, number> = {
    shard_spark: 1,
    score_glint: 0
};
/** Relative spawn weights for current-rules findable kind assignment. */
export const FINDABLE_KIND_SPAWN_WEIGHTS: Record<FindableKind, number> = {
    shard_spark: 50,
    score_glint: 50
};

/** Hidden shuffle: full Fisher–Yates vs row-preserving permute. */
export type WeakerShuffleMode = 'full' | 'rows_only';

export interface ContractFlags {
    noShuffle: boolean;
    noDestroy: boolean;
    maxMismatches: number | null;
    /** GP-C01: max pins allowed this run (null = default cap). */
    maxPinsTotalRun?: number | null;
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
    /*
     * The six above are all reached by playing for a while. These point at the rest of the game:
     * the traits and the cascade a player who only ever flips two tiles at a time will never see.
     */
    | 'ACH_ENDLESS_CYCLE'
    | 'ACH_ENDLESS_TWENTY'
    | 'ACH_SCORE_TEN_THOUSAND'
    | 'ACH_STREAK_TEN'
    | 'ACH_TRAIT_SCHOLAR'
    | 'ACH_NO_POWERS_TEN'
    | 'ACH_FIRST_FEVER'
    | 'ACH_CHUNK_SIX'
    | 'ACH_EXTREME_FEVER'
    | 'ACH_NOTHING_HELD_IT'
    | 'ACH_CHAIN_REACTION';

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
    /** The tier the break that took this tile landed at ('none' for a pop), so the shatter can play a Fever break slower. */
    brokenAtTier?: 'none' | 'clean' | 'sharp' | 'fever';
    /** Which wave of the ripple took this tile: 0 for the match's own region, 1 for what its partners popped, and so on. */
    brokenAtWave?: number;
    /** Visual variant index for atomic-pairs styling (optional). */
    atomicVariant?: number;
    /** If set, matching this pair claims a pickup reward on eligible floors. */
    findableKind?: FindableKind;
    /** Optional lightweight pair modifier: adds match rewards or mismatch drawbacks without changing pair identity. */
    tileTraitKind?: TileTraitKind;
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
    comboShards: number;
    tileTraitMatches: Record<TileTraitKind, number>;
    tileTraitMismatches: Record<TileTraitKind, number>;
    shufflesUsed: number;
    pairsDestroyed: number;
}

export interface LevelResult {
    level: number;
    scoreGained: number;
    rating: Rating;
    perfect: boolean;
    mistakes: number;
    /** Optional objective bonuses (e.g. scholar_style, glass_witness, cursed_last, flip_par). */
    bonusTags?: string[];
    /** Extra score from bonusTags (included in scoreGained). */
    objectiveBonusScore?: number;
    featuredObjectiveId?: FeaturedObjectiveId;
    featuredObjectiveCompleted?: boolean;
    featuredObjectiveStreak?: number;
    featuredObjectiveStreakBonus?: number;
    recallMatches?: number;
    recallMistakes?: number;
    recallBonusScore?: number;
    /** The chain's floor: chunks broken, pairs they took, Fever breaks, the longest chain. */
    chunkBreaks?: number;
    chunkPairsBroken?: number;
    feverBreaks?: number;
    bestChain?: number;
    /** Extreme Fever: the momentum still standing when the last pair went, and what it paid. */
    chainMomentumAtClear?: number;
    momentumBonusTier?: 'none' | 'clean' | 'sharp' | 'fever';
    momentumBonusShards?: number;
    /** The floor's par and the turns it took; the floor-end bonus and its two terms (thesis §40.5, §41.3). */
    parTurns?: number;
    turnsTaken?: number;
    /** What the floor's play paid before the clear: matches and breaks, the number the bonus is added to. */
    playScore?: number;
    floorBonus?: number;
    floorBonusTierMult?: number;
    floorEfficiencyBonus?: number;
    /** The biggest single break on the floor, in score; absent when nothing broke. */
    largestBreakScore?: number;
}

export type TileTraitKind = 'echo' | 'heavy' | 'conduit' | 'stasis';
export interface RunSummary {
    totalScore: number;
    bestScore: number;
    levelsCleared: number;
    highestLevel: number;
    achievementsEnabled: boolean;
    unlockedAchievements: AchievementId[];
    bestStreak: number;
    perfectClears: number;
    /** The biggest chunk one break took, in pairs; absent on a run before the cascade existed. */
    biggestChunk?: number;
    /** The chain's run: the longest chain held, and the cleared floors whose chain reached Sharp and Fever. */
    bestChain?: number;
    /** The longest ripple the run reached, in waves; 1 is a pop that stopped at the clump it touched. */
    bestRipple?: number;
    sharpFloors?: number;
    feverFloors?: number;
    /** Present for seeded modes (daily, shared challenge). */
    runSeed?: number;
    runRulesVersion?: number;
    gameMode?: GameMode;
    activeMutators?: MutatorId[];
    /** Archive-safe payoff lanes copied from the final run state for Profile / Collection recap surfaces. */
    payoffPickupClaimed?: number;
    payoffPickupTotal?: number;
    payoffPressureExtra?: number;
    practiceMode?: boolean;
    wildMenuRun?: boolean;
    activeContract?: ContractFlags | null;
    /** How the run ended; absent on summaries written before the turn ceiling (Gen 183). */
    runEndReason?: RunEndReason;
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
    /** Pairs this seat's chunks took, the longest chain it held, and the chain it holds right now. */
    readonly chunkPairs: number;
    readonly bestChain: number;
    readonly chain: number;
}

export interface PassAndPlayState {
    readonly seats: readonly PassAndPlaySeat[];
    readonly activeSeatIndex: number;
    /**
     * True from the moment a turn is lost until the next player acts. The board is face down at
     * that instant, which is the only safe moment to hand a device over.
     */
    readonly handoffPending: boolean;
    /**
     * The chain the seat that just lost the device was holding when it missed, so the handoff can
     * say what the table just watched end. Zero when the miss ended nothing worth naming.
     */
    readonly handoffChainLost: number;
}

export interface RunState {
    status: RunStatus;
    /** Set once the run is over, and only then: what ended it. */
    runEndReason: RunEndReason | null;
    /**
     * Same-device multiplayer seats, or null on every single-player run. The board stays shared —
     * only the credit is split — so nothing else in the run has to know this is here.
     */
    passAndPlay?: PassAndPlayState | null;
    board: BoardState | null;
    stats: SessionStats;
    achievementsEnabled: boolean;
    debugUsed: boolean;
    debugPeekActive: boolean;
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
    /** Increments each time the player shuffles (deterministic shuffle order). */
    shuffleNonce: number;
    activeMutators: MutatorId[];
    /** Consecutive featured-objective clears; a miss decays it. */
    featuredObjectiveStreak: number;
    /** Run-local deterministic command journal; persisted only through the bounded final summary. */
    gameplayCommandJournal?: GameplayCommandJournalEntry[];
    /** Run-local deterministic event journal; persisted only through the bounded final summary. */
    gameplayEventJournal?: GameplayEventJournalEntry[];
    activeContract: ContractFlags | null;
    /** Practice runs disable achievements (optional ranked split). */
    practiceMode: boolean;
    dailyDateKeyUtc: string | null;
    puzzleId: string | null;
    /** Sticky fingers: flat index blocked for the next opening flip after a match. */
    stickyBlockIndex: number | null;
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
    /** GP-H02: flash-pair charges (practice / wild). */
    flashPairCharges: number;
    /** Tile ids temporarily shown by flash pair (ms handled in renderer/timer). */
    flashPairRevealedTileIds: string[];
    /** GP-H01: charges for shuffling a single row or swapping two hidden tiles. */
    regionShuffleCharges: number;
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
    /** Who is resident on this floor; null before the first floor opens. */
    floorCurioId?: string | null;
    /** True once the player has greeted this floor's resident. One greeting per floor. */
    floorCurioGreeted?: boolean;
    /** Chunk breaks a chain has bought on this floor, and the pairs they took with them. */
    chunkBreaksThisFloor: number;
    chunkPairsBrokenThisFloor: number;
    /** Score the chunks paid this floor, findables and spilled treasure included; the sim's honest ledger. */
    chunkScoreThisFloor: number;
    /** Pairs chunks broke since the chain last dropped: momentum the tier ladder counts, the score streak does not. */
    chunkPairsThisChain: number;
    /** Breaks that landed at the Fever rung this floor, and the longest chain the floor saw. */
    feverBreaksThisFloor: number;
    bestChainThisFloor: number;
    /** Run-wide: Fever breaks and the biggest single chunk in pairs. Records and achievements read these. */
    feverBreaksThisRun: number;
    biggestChunkPairs: number;
    /** Run-wide chain records: the longest chain, and cleared floors whose chain reached Sharp or Fever. */
    bestChainThisRun: number;
    sharpFloorsThisRun: number;
    feverFloorsThisRun: number;
    /** The drop: pairs that fell because a break left their suit with too few to hold, this floor and this run's count of drops. */
    chunkPairsDroppedThisFloor: number;
    chunkDropsThisRun: number;
    /** The longest ripple this floor and this run, in waves: 1 is a pop that stopped at its clump. */
    bestRippleThisFloor: number;
    bestRippleThisRun: number;
    /** Turns resolved on this floor, match or miss, against the floor's par (`floor-par.ts`). */
    turnsThisFloor: number;
    /** The biggest single break's score this floor: what band N5 reads the largest break's share from. */
    largestChunkScoreThisFloor: number;
    /** Pairs the magpie has taken back on this floor. */
    magpieTheftsThisFloor: number;
    /** `shifting_spotlight`: increments each time ward/bounty rotates this floor (seed step for next pick). */
    shiftingSpotlightNonce: number;
}

export type AchievementState = Record<AchievementId, boolean>;

export interface PlayerStatsPersisted {
    bestFloorNoPowers: number;
    /** Spaced encore: pairKeys seen on previous completed run (no PII). */
    encorePairKeysLastRun: string[];
    /** Cleared floors whose chain reached Sharp, and Fever, across local runs. The chain quest reads the first. */
    sharpFloors?: number;
    feverFloors?: number;
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
    /** The chain's records for this run: longest chain and biggest chunk in pairs. Absent on older rows. */
    readonly bestChain?: number;
    readonly biggestChunk?: number;
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
