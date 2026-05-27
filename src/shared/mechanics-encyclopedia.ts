/**
 * Mechanics encyclopedia — **single source of truth** for player-facing reference copy tied to game IDs
 * (relics, mutators, modes, achievements) plus explicit articles for powers, pickups, board specials, and contracts.
 *
 * **Version** bumps when entries are added, removed, or meaningfully rewritten (helps audits and saves).
 * Gameplay rules remain in `game.ts`; this file is **labels + reference only**.
 */
import type { AchievementId, GameMode, MutatorId, RelicId } from './contracts';

/** Monotonic reference doc version (increment when the encyclopedia meaningfully changes). */
export const ENCYCLOPEDIA_VERSION = 15 as const;

export interface RelicDefinition {
    id: RelicId;
    title: string;
    description: string;
}

export interface MutatorDefinition {
    id: MutatorId;
    title: string;
    description: string;
}

/** Steam + in-app achievement copy — must include **every** `AchievementId`. */
export interface AchievementCodexEntry {
    id: AchievementId;
    title: string;
    description: string;
}

export interface GameModeCodexEntry {
    id: GameMode;
    title: string;
    description: string;
}

export interface CodexCoreTopic {
    id: string;
    title: string;
    description: string;
}

/** Same shape as core topics — used for powers, pickups, board, contracts in Codex. */
export type EncyclopediaTopic = CodexCoreTopic;

export interface MechanicsGlossaryTerm {
    id:
        | 'lives'
        | 'guard_tokens'
        | 'combo_shards'
        | 'relic_favor'
        | 'shop_gold'
        | 'relics'
        | 'mutators'
        | 'contracts'
        | 'findables'
        | 'recall_focus'
        | 'perfect_memory'
        | 'daily_challenge'
        | 'powers'
        | 'dungeon_enemies'
        | 'enemy_patrols'
        | 'trap_cards'
        | 'dungeon_keys'
        | 'locked_exits'
        | 'dungeon_rooms'
        | 'rest_shrines'
        | 'treasure_caches'
        | 'route_cards'
        | 'boss_floors'
        | 'elite_anchors'
        | 'dungeon_objectives';
    preferredLabel: string;
    shortDefinition: string;
    avoidLabels: string[];
    surfaces: string[];
}

export const MECHANICS_GLOSSARY_TERMS: readonly MechanicsGlossaryTerm[] = [
    {
        id: 'lives',
        preferredLabel: 'Lives',
        shortDefinition: 'Run-wide health. Lives carry between floors; mismatches can remove them after grace/guard protection.',
        avoidLabels: ['hearts as currency', 'energy'],
        surfaces: ['HUD', 'Game over', 'Settings']
    },
    {
        id: 'guard_tokens',
        preferredLabel: 'Guard tokens',
        shortDefinition: 'Mismatch protection earned from long match streaks; capped and run-scoped.',
        avoidLabels: ['shield currency', 'premium shield'],
        surfaces: ['HUD', 'Inventory', 'Codex']
    },
    {
        id: 'combo_shards',
        preferredLabel: 'Combo shards',
        shortDefinition: 'Temporary streak resource that can convert into life recovery in eligible modes.',
        avoidLabels: ['gems', 'paid shards'],
        surfaces: ['HUD', 'Inventory', 'Findables']
    },
    {
        id: 'relic_favor',
        preferredLabel: 'Relic Favor',
        shortDefinition: 'Run-only progress toward relic milestone choices and shrine/reward momentum.',
        avoidLabels: ['favor currency pack', 'premium favor'],
        surfaces: ['HUD', 'Events', 'Bonus rewards']
    },
    {
        id: 'shop_gold',
        preferredLabel: 'shop gold',
        shortDefinition: 'Temporary run wallet spent on vendor/rest/relic services; never durable or purchasable.',
        avoidLabels: ['coins', 'premium gold', 'cash'],
        surfaces: ['Shop', 'Inventory', 'Economy copy']
    },
    {
        id: 'relics',
        preferredLabel: 'Relics',
        shortDefinition: 'Run build modifiers drafted at milestones; not permanent equipment unless a meta row says so.',
        avoidLabels: ['items', 'gear'],
        surfaces: ['Relic draft', 'Inventory', 'Codex']
    },
    {
        id: 'mutators',
        preferredLabel: 'Mutators',
        shortDefinition: 'Rule modifiers that change floor pressure, presentation, scoring, or board constraints.',
        avoidLabels: ['debuffs only', 'mods'],
        surfaces: ['HUD', 'Codex', 'Choose Path']
    },
    {
        id: 'contracts',
        preferredLabel: 'Contracts',
        shortDefinition: 'Optional mode constraints with explicit retry/failure rules.',
        avoidLabels: ['quests when constraint is active'],
        surfaces: ['Choose Path', 'Inventory', 'Codex']
    },
    {
        id: 'findables',
        preferredLabel: 'Findables',
        shortDefinition: 'Bonus pickup pairs on the board; match to claim, Destroy forfeits.',
        avoidLabels: ['loot boxes', 'random drops'],
        surfaces: ['Tile a11y', 'HUD', 'Codex']
    },
    {
        id: 'recall_focus',
        preferredLabel: 'Recall Focus',
        shortDefinition: 'Run-floor memory meter: clean remembered matches build it, mistakes and memory aids break it, and forgotten tile markers settle when recalled pairs are matched.',
        avoidLabels: ['mana', 'energy', 'combo only'],
        surfaces: ['HUD', 'Results', 'Codex']
    },
    {
        id: 'perfect_memory',
        preferredLabel: 'Perfect Memory',
        shortDefinition: 'Achievement gate: clear without mismatches and without disallowed powers that run.',
        avoidLabels: ['perfect floor score', 'S++ only'],
        surfaces: ['HUD', 'Game over', 'Codex']
    },
    {
        id: 'daily_challenge',
        preferredLabel: 'Daily Challenge',
        shortDefinition: 'UTC-seeded local challenge with share strings; online rankings are deferred.',
        avoidLabels: ['online daily leaderboard'],
        surfaces: ['Choose Path', 'Collection', 'Game over']
    },
    {
        id: 'powers',
        preferredLabel: 'Powers',
        shortDefinition: 'Player-triggered board tools such as shuffle, peek, destroy, pin, stray remove, and flash pair.',
        avoidLabels: ['boosters for sale'],
        surfaces: ['Toolbar', 'Inventory', 'Codex']
    },
    {
        id: 'dungeon_enemies',
        preferredLabel: 'Enemies',
        shortDefinition: 'Dungeon threats tied to cards, moving patrol overlays, or floor objectives.',
        avoidLabels: ['monsters as cards', 'random attackers'],
        surfaces: ['HUD', 'Tile a11y', 'Codex']
    },
    {
        id: 'enemy_patrols',
        preferredLabel: 'enemy patrols',
        shortDefinition: 'Moving threat overlays with an occupied tile and a telegraphed next target.',
        avoidLabels: ['roaming mobs', 'unshown movement'],
        surfaces: ['Board', 'Tile a11y', 'HUD']
    },
    {
        id: 'trap_cards',
        preferredLabel: 'Trap cards',
        shortDefinition: 'Dungeon card pairs that resolve as hazards through normal reveal and matching rules.',
        avoidLabels: ['trap enemies', 'unfair traps'],
        surfaces: ['Board', 'HUD', 'Codex']
    },
    {
        id: 'dungeon_keys',
        preferredLabel: 'dungeon keys',
        shortDefinition: 'Run-only keys and master keys used for lock and route interactions.',
        avoidLabels: ['premium keys', 'permanent keys'],
        surfaces: ['Inventory', 'HUD', 'Codex']
    },
    {
        id: 'locked_exits',
        preferredLabel: 'locked exits',
        shortDefinition: 'Exit cards blocked by locks, levers, bosses, or objective requirements until rules are satisfied.',
        avoidLabels: ['paywalls', 'random locks'],
        surfaces: ['Board', 'HUD', 'Tile a11y']
    },
    {
        id: 'dungeon_rooms',
        preferredLabel: 'rooms',
        shortDefinition: 'One-shot board or route interactions such as shops, rest shrines, events, and utility rooms.',
        avoidLabels: ['menus only', 'repeat farms'],
        surfaces: ['Board', 'Route', 'Codex']
    },
    {
        id: 'rest_shrines',
        preferredLabel: 'rest shrines',
        shortDefinition: 'Room services for healing, guard, Favor bargains, or boss preparation with clear costs.',
        avoidLabels: ['healing shop', 'paid rest'],
        surfaces: ['Room UI', 'Inventory', 'Codex']
    },
    {
        id: 'treasure_caches',
        preferredLabel: 'treasure caches',
        shortDefinition: 'Reward sources that can be claimed through treasure, cache, supply, lock, or secret-door hooks.',
        avoidLabels: ['loot boxes', 'cash chests'],
        surfaces: ['Board', 'Route', 'Results']
    },
    {
        id: 'route_cards',
        preferredLabel: 'Route cards',
        shortDefinition: 'Safe, Greed, or Mystery card families stamped onto the next floor after a route choice.',
        avoidLabels: ['random route cards', 'route loot boxes'],
        surfaces: ['Choose Path', 'Board', 'Codex']
    },
    {
        id: 'boss_floors',
        preferredLabel: 'boss floors',
        shortDefinition: 'Dungeon floors with a named boss identity, special threat hook, and defeat-gated rewards or exits.',
        avoidLabels: ['boss rounds', 'raid bosses'],
        surfaces: ['HUD', 'Board', 'Results']
    },
    {
        id: 'elite_anchors',
        preferredLabel: 'elite anchors',
        shortDefinition: 'Hard-route non-boss anchors such as Elite Cache, Final Ward, and Omen Seal.',
        avoidLabels: ['mini bosses', 'elite loot boxes'],
        surfaces: ['Board', 'Route', 'Codex']
    },
    {
        id: 'dungeon_objectives',
        preferredLabel: 'dungeon objectives',
        shortDefinition: 'Floor goals such as find exit, disarm traps, defeat boss, pacify floor, loot cache, or reveal unknowns.',
        avoidLabels: ['quests with rewards store', 'hidden chores'],
        surfaces: ['HUD', 'Results', 'Codex']
    }
];

export const glossaryTermById = (id: MechanicsGlossaryTerm['id']): MechanicsGlossaryTerm =>
    MECHANICS_GLOSSARY_TERMS.find((term) => term.id === id)!;

export const MECHANICS_GLOSSARY = MECHANICS_GLOSSARY_TERMS;

/** Product “Endless Mode” card — not yet a live ruleset; distinct from internal classic/endless. */
export const VISUAL_ENDLESS_MODE_LOCKED = {
    title: 'Endless Mode',
    description:
        'A staged future ruleset for ultra-long descents. Classic already uses endless-style floors; this separate mode stays locked until its distinct scoring and reward cadence are tuned.'
} as const;

/**
 * Achievements — single source for `achievements.ts` blurbs and Codex “Achievements” section.
 */
export const ACHIEVEMENT_CATALOG: Record<AchievementId, AchievementCodexEntry> = {
    ACH_FIRST_CLEAR: {
        id: 'ACH_FIRST_CLEAR',
        title: 'First Lantern',
        description: 'Complete your first level.'
    },
    ACH_LEVEL_FIVE: {
        id: 'ACH_LEVEL_FIVE',
        title: 'Deep Delver',
        description: 'Reach level five in a single run.'
    },
    ACH_SCORE_THOUSAND: {
        id: 'ACH_SCORE_THOUSAND',
        title: 'Gold Mind',
        description: 'Score 1000 total points in one run.'
    },
    ACH_PERFECT_CLEAR: {
        id: 'ACH_PERFECT_CLEAR',
        title: 'Perfect Memory',
        description:
            'Unlocks when your last cleared level had zero mismatches and you never used disallowed powers that run: shuffle (full-board or row/region), destroy pair, peek, undo resolve, gambit, stray remove, flash pair, or wild match. Pins are allowed.'
    },
    ACH_LAST_LIFE: {
        id: 'ACH_LAST_LIFE',
        title: 'One Heart Wonder',
        description: 'Finish a level with exactly one life remaining.'
    },
    ACH_ENDLESS_TEN: {
        id: 'ACH_ENDLESS_TEN',
        title: 'Abyssal Ten',
        description: 'Reach floor 10 in a single Endless run.'
    },
    ACH_SEVEN_DAILIES: {
        id: 'ACH_SEVEN_DAILIES',
        title: 'Week of Archives',
        description: 'Complete seven Daily runs (UTC calendar days, cumulative).'
    }
};

/**
 * Relics — milestone drafts every 3 floors from floor 3 (see `relics.ts`). Must include **every** `RelicId`.
 */
export const RELIC_CATALOG: Record<RelicId, RelicDefinition> = {
    extra_shuffle_charge: {
        id: 'extra_shuffle_charge',
        title: 'Archive Shuffle',
        description: 'Begin the run with one additional full-board shuffle charge for trap halls and dense archive layouts.'
    },
    first_shuffle_free_per_floor: {
        id: 'first_shuffle_free_per_floor',
        title: 'Free First Shuffle',
        description: 'The first full-board shuffle each dungeon floor costs no charge (once per floor).'
    },
    memorize_bonus_ms: {
        id: 'memorize_bonus_ms',
        title: 'Lantern Study',
        description: 'Adds study time before dungeon cards, patrol reads, rooms, and traps hide again.'
    },
    destroy_bank_plus_one: {
        id: 'destroy_bank_plus_one',
        title: 'Breaker Chisel',
        description: 'Adds one destroy-pair charge to the uncapped run bank for trap-control routes.'
    },
    combo_shard_plus_step: {
        id: 'combo_shard_plus_step',
        title: 'Catalyst Thread',
        description: 'Combo-shard streak thresholds start slightly closer for clean dungeon floors.'
    },
    memorize_under_short_memorize: {
        id: 'memorize_under_short_memorize',
        title: 'Compressed Margins',
        description: 'Adds dungeon scout time while Short memorize is active.'
    },
    parasite_ward_once: {
        id: 'parasite_ward_once',
        title: 'Parasite Ward',
        description: 'Ignore the next score-parasite life loss once.'
    },
    region_shuffle_free_first: {
        id: 'region_shuffle_free_first',
        title: 'Row Compass',
        description: 'The first row shuffle each dungeon floor costs no charge.'
    },
    peek_charge_plus_one: {
        id: 'peek_charge_plus_one',
        title: 'Scrying Spark',
        description: 'Gain one additional peek charge for Mystery rooms and hidden dungeon cards.'
    },
    stray_charge_plus_one: {
        id: 'stray_charge_plus_one',
        title: 'Stray Hook',
        description: 'Gain one additional stray-remover charge for scout routes and awkward dungeon layouts.'
    },
    pin_cap_plus_one: {
        id: 'pin_cap_plus_one',
        title: 'Memory Nail',
        description: 'Place one extra pinned tile at a time for dungeon card reads (run-wide).'
    },
    guard_token_plus_one: {
        id: 'guard_token_plus_one',
        title: 'Warden Sigil',
        description: 'Gain one guard token toward mismatch and enemy-contact protection (capped like normal play).'
    },
    shrine_echo: {
        id: 'shrine_echo',
        title: 'Shrine Echo',
        description:
            'The **next** relic milestone offers **one extra selection** for Greed and treasure-route builds (reroll after each pick until spent).'
    },
    chapter_compass: {
        id: 'chapter_compass',
        title: 'Chapter Compass',
        description:
            'In scheduled Endless runs, future relic drafts lean harder into relics that answer the current or next chapter, including boss floors.'
    },
    wager_surety: {
        id: 'wager_surety',
        title: 'Wager Surety',
        description:
            'Won Endless risk wagers grant +1 extra Favor. Lost boss-route wagers keep the featured-objective streak at x1 instead of x0.'
    },
    parasite_ledger: {
        id: 'parasite_ledger',
        title: 'Parasite Ledger',
        description:
            'On scheduled Endless parasite floors, completing the featured objective slows score-parasite pressure by one step.'
    }
};

/**
 * Mutators — must include **every** `MutatorId`.
 */
export const MUTATOR_CATALOG: Record<MutatorId, MutatorDefinition> = {
    glass_floor: {
        id: 'glass_floor',
        title: 'Glass floor',
        description:
            'Adds a fragile **singleton decoy trap** tile that never pairs; avoid dragging it into a mismatch for the glass-witness bonus. Distinct from reward pickups on normal pairs.'
    },
    sticky_fingers: {
        id: 'sticky_fingers',
        title: 'Sticky fingers',
        description:
            'After a match, **one board slot** is reserved so your **next opening flip** must start elsewhere—flip-order pressure only (often highlighted in the HUD).'
    },
    score_parasite: {
        id: 'score_parasite',
        title: 'Score parasite',
        description:
            'While active, each **floor advance** counts toward parasite pressure; roughly every **fourth** advance, you lose **one life** unless a **Parasite ward** (relic charge) absorbs the hit—pace long runs accordingly.'
    },
    category_letters: {
        id: 'category_letters',
        title: 'Letters only',
        description: 'Tile faces draw from the letter/number hybrid set instead of rotating symbol bands.'
    },
    short_memorize: {
        id: 'short_memorize',
        title: 'Short memorize',
        description: 'Less time to study the board before pairs go hidden.'
    },
    wide_recall: {
        id: 'wide_recall',
        title: 'Wide recall',
        description:
            'Play phase de-emphasizes symbols vs labels on flipped tiles; each successful match scores slightly less.'
    },
    silhouette_twist: {
        id: 'silhouette_twist',
        title: 'Silhouette twist',
        description: 'Silhouette-style face reads during play; each successful match scores slightly less.'
    },
    n_back_anchor: {
        id: 'n_back_anchor',
        title: 'N-back anchor',
        description:
            'Every second match updates an **anchor** pair key; later openings can reference that anchor for spaced-recall pressure.'
    },
    distraction_channel: {
        id: 'distraction_channel',
        title: 'Distraction channel',
        description:
            'Optional cycling digit HUD during play (settings; off by default; hidden when reduced motion). Cosmetic only—each successful match still scores slightly less while the mutator is active.'
    },
    findables_floor: {
        id: 'findables_floor',
        title: 'Dense pickups',
        description:
            'Baseline procedural floors already spawn pickups. This mutator makes the floor denser by guaranteeing **two** pickup pairs; Destroy still forfeits the reward.'
    },
    shifting_spotlight: {
        id: 'shifting_spotlight',
        title: 'Shifting spotlight',
        description:
            'Each flip sequence (match, miss, gambit, or destroy) moves a Ward pair (lower match score) and a Bounty pair (bonus score) among remaining pairs. Distinct from the cursed “match last” pair.'
    },
    generous_shrine: {
        id: 'generous_shrine',
        title: 'Generous shrine',
        description:
            'While active, each **relic milestone draft** grants **one extra selection** (same visit; stacks with other bonuses).'
    }
};

export const GAME_MODE_CODEX: GameModeCodexEntry[] = [
    {
        id: 'endless',
        title: 'Classic Run',
        description:
            'Standard descent: procedural floors, named endless chapters, one featured objective per floor, and relic offers every three clears. Completing featured objectives builds Favor; every 3 Favor banks +1 extra relic selection for the next shrine. Endless shrine drafts can now surface chapter-aligned relics. (Internal mode id: endless.)'
    },
    {
        id: 'daily',
        title: 'Daily Challenge',
        description:
            'Everyone plays the **same seed** for the **UTC calendar day**. Daily mutators come from a **fixed rotation table** keyed off the date so the challenge is shared worldwide.'
    },
    {
        id: 'puzzle',
        title: 'Puzzle',
        description: 'Fixed handcrafted boards from the built-in puzzle set; optional JSON import for local playtests.'
    },
    {
        id: 'gauntlet',
        title: 'Gauntlet',
        description:
            'A **run-wide wall-clock deadline** from the menu duration preset (commonly **5 / 10 / 15** minutes). When time runs out you hit **game over** even with lives left—pace your clears against the clock.'
    },
    {
        id: 'meditation',
        title: 'Meditation',
        description: 'Longer memorize windows and calmer pacing for practice-style runs.'
    }
];

/** High-level topics — see also granular `ENCYCLOPEDIA_POWER_TOPICS` etc. */
export const CODEX_CORE_TOPICS: CodexCoreTopic[] = [
    {
        id: 'pairs',
        title: 'Pairs and matching',
        description:
            'Flip two hidden tiles; a match clears the pair for score. Wild and contract rules can change what counts as a match.'
    },
    {
        id: 'memorize',
        title: 'Memorize phase',
        description:
            'Each floor begins with tiles face-up briefly, then play continues hidden. Mutators and relics can shorten or extend this window.'
    },
    {
        id: 'lives',
        title: 'Lives and clears',
        description: 'Mismatches cost lives. Lives carry across the run instead of resetting each floor; clears advance the floor and may trigger relic offers on milestone floors.'
    },
    {
        id: 'scoring',
        title: 'Score, flip par, and perfect clears',
        description:
            'Match score, floor clear bonuses, streak systems, and optional shuffle tax are summarized under **Scoring & survival** in this Codex. **Perfect Memory** (achievement) requires a flawless **floor** (zero tries) **and** no disallowed powers this **run**—see that section for the split between “perfect floor” and “no-assist run.”'
    },
    {
        id: 'powers',
        title: 'Powers and charges (overview)',
        description:
            'Board tools (shuffle, destroy, peek, pins, stray, region shuffle, flash) and meta-actions (undo resolve, gambit third flip) use charges or per-floor budgets. See **Powers & tools** in this Codex for each one. Scholar contracts can disable shuffle and destroy.'
    },
    {
        id: 'relics',
        title: 'Relics',
        description:
            'Offered at milestone floors **during the current run** (every **three** cleared floors starting at floor **3**, with a cap on how many visits per run). Picks apply **for the rest of that run only**. After the **Week of Archives** achievement, meta progression can grant **+1 selection at each milestone**. **Shrine echo**, **Generous shrine**, endless-floor **Favor**, and occasional bonus drafts can add extra picks in specific visits.'
    },
    {
        id: 'mutators',
        title: 'Mutators',
        description:
            'Classic chapters telegraph mutators before play: the banner names the chapter theme, active pressure, featured objective, and pacing tag so the player knows how to adapt.'
    },
    {
        id: 'route_world',
        title: 'Route-world cards',
        description:
            'Choosing Safe, Greed, or Mystery after a clear stores a route plan for the next floor. That next board gains route-specific card families, hard-route elite anchors, side-room pacing, and relic draft weighting tied to the route you selected.'
    }
];

/** Toolbar / store powers and related actions (one entry per major mechanic). */
export const ENCYCLOPEDIA_POWER_TOPICS: readonly EncyclopediaTopic[] = [
    {
        id: 'power_full_shuffle',
        title: 'Full-board shuffle',
        description:
            'Spends a shuffle charge to permute hidden tiles (rules may use weaker “rows only” shuffle). May incur shuffle score tax when enabled. Relics can grant extra charges or a free first shuffle per floor.'
    },
    {
        id: 'power_region_shuffle',
        title: 'Row / region shuffle',
        description:
            'Shuffles tiles within a single row (charges per run; relic may make the first row shuffle free). Distinct from full-board shuffle.'
    },
    {
        id: 'power_destroy_pair',
        title: 'Destroy pair',
        description:
            'Spends destroy charges to remove a fully hidden **pair** without match score—counts as a power for perfect-clear rules. Findable bonus pickups and destroy-denied route rewards on that pair are **forfeited**. Cannot target the glass decoy tile.'
    },
    {
        id: 'power_peek',
        title: 'Peek',
        description:
            'Reveals a hidden tile briefly without committing a full flip sequence (charges). Peek also marks Mystery Veil, Secret Door, and Omen Seal route families as revealed without claiming their reward. Useful for verification; still counts as a power where perfect-clear rules apply.'
    },
    {
        id: 'power_pin',
        title: 'Pin tiles',
        description:
            'Marks tiles to track mentally (pin budget per run; scholar contracts may cap total pins). Pins do **not** disqualify perfect clear by themselves.'
    },
    {
        id: 'power_stray_remove',
        title: 'Stray remove',
        description:
            'Arms removal of **one** hidden completion-safe singleton tile, such as a wild joker or optional shop/room marker; does not score. Normal matched pairs are blocked so Stray cannot orphan a partner. Cannot remove the glass decoy trap tile, exit tile, Keystone Pair, Final Ward, or Omen Seal route anchors.'
    },
    {
        id: 'power_flash_pair',
        title: 'Flash pair',
        description:
            'Briefly reveals a pair (practice / wild-style paths). Treated as a power for perfect-clear and FTUE tracking where applicable.'
    },
    {
        id: 'power_undo_resolve',
        title: 'Undo (during resolve)',
        description:
            'Cancels the pending mismatch/match window before it resolves, restoring flips (limited undos per floor). Counts as a power for perfect clear.'
    },
    {
        id: 'power_gambit',
        title: 'Gambit (third flip)',
        description:
            'Once per floor, after two flips, you may try a third card to complete a pair; wrong gambit still counts against tries. Counts as a power for perfect clear when used. Resolve **feel** can differ from a normal two-flip miss when **Echo** is on—see **Resolve timing & echo**.'
    },
    {
        id: 'power_wild',
        title: 'Wild / joker match',
        description:
            'Special wild tile can pair with a real symbol under rules shown on the board. Wild use counts as a power for perfect-clear tracking.'
    }
];

/**
 * Floor bonuses, streak rewards, and optional rules that affect score/lives — mirrors `finalizeLevel` / match resolution in `game.ts`.
 */
export const ENCYCLOPEDIA_SCORING_AND_SURVIVAL_TOPICS: readonly EncyclopediaTopic[] = [
    {
        id: 'sys_endless_chapters_and_favor',
        title: 'Endless chapters, featured objectives, streaks, and Favor',
        description:
            'Modern **Classic Run** uses a repeating chapter schedule: each endless floor has a **name**, a short **hint**, and **one featured objective** instead of the old hidden objective stack. Completing consecutive featured objectives builds an **objective streak**: the first clear starts the chain, then each continued clear adds a small capped score kicker. A normal miss decays the streak by 1. At streak x2 or higher, you can arm a **risk wager** for the next floor: complete that featured objective for bonus Favor, or miss it and reset the streak. Completing featured objectives also grants **Favor** (+1 on normal or breather floors, +2 on boss floors). Every **3 Favor** banks **+1 extra relic selection** for the next shrine. Scheduled Endless shrine drafts guarantee one chapter-aligned option when an eligible answer exists, then fill the other options from the normal weighted pool.'
    },
    {
        id: 'sys_perfect_floor_vs_achievement',
        title: 'Perfect floor vs Perfect Memory (achievement)',
        description:
            'A **perfect floor** means **zero tries** (no failed mismatches) on that level: you get the perfect-clear **score** bonus and a top **rating** tier. The **Perfect Memory** achievement additionally requires you **never used disallowed powers in that run**—no **shuffle** (full-board or row/region), destroy, peek, undo resolve, gambit, stray, flash, or wild match (pins are still fine). Do not confuse “perfect floor score” with the achievement gate.'
    },
    {
        id: 'sys_recall_focus',
        title: 'Recall Focus and forgotten tiles',
        description:
            '**Recall Focus** is the floor-level memory readout. Clean remembered matches raise focus and can add memory score; mismatches, shuffles, peeks, destroy, stray, and other memory aids can lower focus and mark affected tile memories as unstable. If you later match a pair containing those tiles, the forgotten markers are removed, so the HUD distinguishes a lapse from a recovered route through the room.'
    },
    {
        id: 'sys_scholar_style_floor',
        title: 'Scholar-style floor bonus (not only the contract)',
        description:
            'The **scholar-style** objective is worth **+40**. Outside scheduled endless chapters, it still behaves like a normal stackable floor objective: clear the floor **without using full-board shuffle or destroy pair on that floor** and you get the bonus. In modern endless chapters, you earn it only on floors where **Scholar style** is the **featured objective**.'
    },
    {
        id: 'sys_flip_par_floor',
        title: 'Flip par (match-resolution budget)',
        description:
            'The **flip par** objective is worth **+30**. If you finish the floor within a **match-resolution budget** based on pair count, you get the bonus. It counts **pair clears** (matches, gambit hits), not every tile flip. Outside scheduled endless chapters this can stack with other floor objectives; in modern endless chapters it pays out only when **Flip par** is the **featured objective** for that floor.'
    },
    {
        id: 'sys_glass_witness_and_cursed_last',
        title: 'Glass witness & cursed last objectives',
        description:
            '**Glass witness** is worth **+35**: with a glass decoy on the board, you keep the bonus only if the decoy is **never involved in a mismatch**. **Cursed last** is worth **+50**: one pair is marked cursed, and you must match it **last** among real pairs. Outside scheduled endless chapters these behave like normal floor objectives. In modern endless chapters, they only appear when they are the floor\'s **featured objective**; endless floors also generate the cursed pair only on **Cursed last** chapters.'
    },
    {
        id: 'sys_boss_floor_multiplier',
        title: 'Boss floors',
        description:
            'Floors tagged **boss** apply a **score multiplier** (~1.15×) to the pre-boss subtotal for that clear (level bonus, perfect bonus, and stacked objective bonuses included before the multiply).'
    },
    {
        id: 'sys_combo_shards',
        title: 'Combo shards → extra life',
        description:
            'Each **even-numbered** consecutive match adds a **combo shard** (bank capped low). At **three** shards, if you are below max lives, shards convert to **+1 life** (remainder stays in the bank). **Meditation** disables shard→life. The **Combo shard head start** relic shifts thresholds—it does not replace the base system.'
    },
    {
        id: 'sys_chain_heal_and_guard',
        title: 'Chain heal & combo guard tokens',
        description:
            'Long **match streaks** can **restore a life** (every 8th consecutive match in non-Meditation runs) and earn **guard tokens** (every 4th consecutive match, capped). The **first mismatch of a floor** is free (no life); after that, a **guard token** can absorb a mismatch instead of losing a life when available.'
    },
    {
        id: 'sys_shuffle_score_tax',
        title: 'Shuffle score tax (optional)',
        description:
            'When the **shuffle score tax** option is on in settings, each **full-board shuffle** multiplies your run’s **match-score multiplier** down by a modest factor—**additional shuffles compound** the penalty for that run. Distinct from floor objective bonuses.'
    },
    {
        id: 'sys_encore_pairs',
        title: 'Encore pairs',
        description:
            'Meta progression remembers which **pair keys** you cleared last run; matching one of those pairs again this run grants a small **flat encore bonus** on that match.'
    },
    {
        id: 'sys_presentation_mutator_penalties',
        title: 'Presentation mutators (match score)',
        description:
            '**Wide recall**, **Silhouette twist**, and **Distraction channel** apply a small **flat penalty to each successful match score** while active (rules stay consistent between logic and renderer).'
    },
    {
        id: 'sys_clear_life_bonus',
        title: 'Bonus life on level clear',
        description:
            'Clearing a floor with **zero tries** can grant **+1 life** when you are below the life cap (**perfect** clear path). A **single** mismatch clear may still grant a smaller **clean** life bonus—see the results summary for that floor.'
    }
];

/**
 * Settings, optional assists, pacing systems, and dev-only notes — do not duplicate full numeric tables from `contracts.ts`.
 */
export const ENCYCLOPEDIA_SETTINGS_AND_ASSISTS_TOPICS: readonly EncyclopediaTopic[] = [
    {
        id: 'assist_pair_proximity',
        title: 'Pair proximity hints',
        description:
            'Optional setting: shows **distance-class** hints between paired tiles (Manhattan steps on the grid). **Informational only**—does not change score, streak math, or perfect / achievement rules.'
    },
    {
        id: 'assist_focus_dim',
        title: 'Focus dim',
        description:
            'Read-only **focus assist** may dim tiles outside the current attention set so the active tiles read more clearly. Does not change what you can flip or match.'
    },
    {
        id: 'opt_weaker_shuffle',
        title: 'Weaker shuffle (full vs rows-only)',
        description:
            'Settings can force **row-preserving** shuffles (only hidden tiles permute **within each row**) instead of a full hidden-tile Fisher–Yates. **Full-board shuffle** charges and relics that mention shuffle refer to the full-board tool; **row / region shuffle** stays a separate control.'
    },
    {
        id: 'opt_resolve_echo',
        title: 'Resolve timing & echo',
        description:
            'Adjust how long matches and mismatches **linger** before the board unlocks (`resolveDelayMultiplier`). **Echo** adds extra feedback time on a **two-flip mismatch** (accessibility). **Gambit** uses a **separate** resolving delay after the third flip and does **not** apply that same echo extension—so mismatch timing can feel different from a straight two-flip miss when echo is enabled. These change **feel**, not scoring formulas.'
    },
    {
        id: 'meta_memorize_pacing',
        title: 'Memorize pacing',
        description:
            'Study time starts from a **base**, adjusts in **steps** toward a **floor minimum**, and **relaxes** every few levels so memorize does not shrink every single floor. Losing a life **banks** a small memorize bonus for the **next** floor (capped).'
    },
    {
        id: 'meta_floor_cycle_boss',
        title: 'Endless floor cycle & boss tags',
        description:
            'In **Classic Run** with the modern floor schedule, each level draws a named **chapter**, **act**, **biome**, **active mutators**, a **featured objective**, and a **pacing tag** (normal, breather, or **boss**) from a **12-floor repeating cycle**. The cycle is grouped into Act I / Lantern Academy (floors 1–4), Act II / Shadow Archive (floors 5–8), and Act III / Spire Convergence (floors 9–12). **Boss**-tagged clears apply the boss **score multiplier**; some boss steps may add presentation mutators for variation.'
    },
    {
        id: 'dev_debug_peek',
        title: 'Debug peek (development)',
        description:
            'Development builds may expose an extra **face-reveal** window for debugging. It is not part of shipped balance; turn it off when validating fair play.'
    }
];

/** Bonus pickups and special tile types (not the same as relics). */
export const ENCYCLOPEDIA_PICKUP_AND_BOARD_TOPICS: readonly EncyclopediaTopic[] = [
    {
        id: 'pickup_findables',
        title: 'Findables (bonus pickups)',
        description:
            'Procedural floors spawn **real** pickup pairs by default: floors 1–3 have one pair, later floors have one or two, and **Dense pickups** guarantees two. **Shard spark** grants +1 combo shard, **score glint** grants +25 score, **ward spark** grants a capped safe-hazard ward charge, and **scout glint** scouts one hazard or dungeon family through the existing scout path. Matching the carrier pair claims it, Destroy forfeits it, and Peek only reveals it.'
    },
    {
        id: 'board_glass_decoy',
        title: 'Glass decoy trap (singleton)',
        description:
            'From **Glass floor**: one extra decoy tile that **never** forms a pair. The **glass witness** payout requires the decoy to **never appear in a mismatch** (or a failed **gambit** that includes it). Any such flip marks the witness failed for the floor. It is a trap, not a pickup.'
    },
    {
        id: 'board_wild_tile',
        title: 'Wild / joker tile',
        description:
            'Optional tile that can match a normal symbol per run rules. Typically one use per run; shown as Wild in copy.'
    },
    {
        id: 'board_cursed_pair',
        title: 'Cursed pair objective',
        description:
            'One **real** pair may be marked **cursed**. Match it **last** among normal pairs to earn the **cursed last** floor bonus; matching it while other real pairs remain forfeits that bonus.'
    },
    {
        id: 'board_shifting_spotlight',
        title: 'Ward & bounty (shifting spotlight)',
        description:
            'With **Shifting spotlight**, a Ward pair scores less if matched while highlighted; a Bounty pair grants extra score. Rotates on match, miss, gambit, or destroy.'
    },
    {
        id: 'board_route_cards',
        title: 'Route cards',
        description:
            'Route boards stamp real pairs with Safe Ward, Greed Cache, or Mystery Veil rendering metadata plus named special families. Safe rewards protection, Greed rewards gold/score and can lose value to destroy, and Mystery rewards information, shards, or Favor after fair reveal counterplay.'
    },
    {
        id: 'board_route_reveal',
        title: 'Mystery route reveal rules',
        description:
            'Mystery Veil, Secret Door, and Omen Seal start unrevealed. Peek reveals the matching pair label for readability but does not grant the route reward; the reward is paid only when the pair is actually matched.'
    },
    {
        id: 'board_boss_elite_anchors',
        title: 'Boss and elite route anchors',
        description:
            'Boss route floors add a Keystone Pair anchor mapped through the selected route. Hard non-boss route floors add an elite anchor: Greed gets Elite Cache, Safe gets Final Ward, and Mystery gets Omen Seal. Final Ward and Omen Seal are protected from Stray remove so route pressure stays on the board.'
    },
    {
        id: 'board_route_side_rooms',
        title: 'Route side rooms and relic weighting',
        description:
            'Route choices can open side-room interludes before the next board and mark bonus-reward ledgers. Safe leans defensive, Greed leans risky economy, and Mystery leans event/reveal outcomes; relic weighting can nudge shrine drafts toward the chosen route when eligible.'
    },
    {
        id: 'board_dungeon_glossary',
        title: 'Dungeon board glossary',
        description:
            '**Enemies** may appear as card pairs or moving **enemy patrols**; patrols always expose an occupied tile and next-target telegraph. **Trap cards**, **Route cards**, **elite anchors**, **treasure caches**, **rooms**, **rest shrines**, **dungeon keys**, **locked exits**, **boss floors**, and **dungeon objectives** use the same board/focus vocabulary across HUD, tile a11y, and results copy.'
    }
];

/** Challenge runs and contract flags (endless + flags, not separate `GameMode`). */
export const ENCYCLOPEDIA_CONTRACT_TOPICS: readonly EncyclopediaTopic[] = [
    {
        id: 'contract_scholar',
        title: 'Scholar contract',
        description:
            'Menu / run flag: **no full-board shuffle** and **no destroy pair** for the contract (row/region tools follow current rules). Separate from the **scholar-style per-floor bonus**, which any run can earn floor-by-floor by not using shuffle/destroy on that floor.'
    },
    {
        id: 'contract_pin_vow',
        title: 'Pin vow',
        description: 'Caps how many pins you may place over the **whole run**—track pins carefully.'
    },
    {
        id: 'contract_max_mismatches',
        title: 'Max mismatches',
        description:
            'Optional hard cap on mismatch resolutions; exceeding it ends the run immediately (can combine with presentation mutators).'
    }
];

/** Featured menu entries that are not separate `GameMode` ids — still encyclopedia entries. */
export const ENCYCLOPEDIA_FEATURED_RUN_TOPICS: readonly EncyclopediaTopic[] = [
    {
        id: 'featured_practice',
        title: 'Practice',
        description: 'Endless-style run with achievements relaxed—good for learning flows.'
    },
    {
        id: 'featured_wild',
        title: 'Wild / joker run',
        description: 'Endless run with wild-tile rules enabled from the menu for a different pairing puzzle.'
    },
    {
        id: 'featured_route_world',
        title: 'Route-world run flow',
        description:
            'After eligible clears, pick Safe, Greed, or Mystery to shape the next floor. The selected route affects board specials, side rooms, reward hooks, elite anchors on hard floors, and route-aware relic opportunities.'
    }
];
