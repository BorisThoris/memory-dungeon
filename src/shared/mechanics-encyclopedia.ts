/**
 * Mechanics encyclopedia — **single source of truth** for player-facing reference copy tied to game IDs
 * (mutators, the one mode, achievements) plus explicit articles for powers, pickups, board specials, and contracts.
 *
 * Every entry describes a rule that exists in `src/shared` today. When a system is removed, its entries go
 * with it rather than staying as history; the history is in the docs/REMOVED_*.md files.
 *
 * **Version** bumps when entries are added, removed, or meaningfully rewritten (helps audits and saves).
 * Gameplay rules remain in `game.ts`; this file is **labels + reference only**.
 */
import type { AchievementId, GameMode, MutatorId } from './contracts';

/** Monotonic reference doc version (increment when the encyclopedia meaningfully changes). */
export const ENCYCLOPEDIA_VERSION = 40 as const;

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
        | 'mutators'
        | 'contracts'
        | 'findables'
        | 'tile_traits'
        | 'recall_focus'
        | 'perfect_memory'
        | 'powers';
    preferredLabel: string;
    shortDefinition: string;
    avoidLabels: string[];
    surfaces: string[];
}

export const MECHANICS_GLOSSARY_TERMS: readonly MechanicsGlossaryTerm[] = [
    {
        id: 'mutators',
        preferredLabel: 'Mutators',
        shortDefinition: 'Rule modifiers that change floor pressure, presentation, scoring, or board constraints.',
        avoidLabels: ['debuffs only', 'mods'],
        surfaces: ['HUD', 'Codex', 'Floor banner']
    },
    {
        id: 'contracts',
        preferredLabel: 'Contracts',
        shortDefinition: 'Optional run constraints chosen on the setup sheet, with explicit failure rules.',
        avoidLabels: ['quests when constraint is active'],
        surfaces: ['Setup sheet', 'Inventory', 'Codex']
    },
    {
        id: 'findables',
        preferredLabel: 'Findables',
        shortDefinition: 'Bonus pickup pairs on the board; match to claim, or let a chunk break spill one.',
        avoidLabels: ['loot boxes', 'random drops'],
        surfaces: ['Tile a11y', 'HUD', 'Codex']
    },
    {
        id: 'tile_traits',
        preferredLabel: 'Tile traits',
        shortDefinition: 'Pair-level modifiers - Echo, Heavy, Conduit, and Stasis - that add match rewards or a miss drawback.',
        avoidLabels: ['random punishments', 'status ailments'],
        surfaces: ['Board', 'Tile a11y', 'Codex']
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
        id: 'powers',
        preferredLabel: 'Powers',
        shortDefinition: 'Player-triggered board tools such as shuffle, row shuffle, tile swap, peek, pin, and flash pair.',
        avoidLabels: ['boosters for sale'],
        surfaces: ['Toolbar', 'Inventory', 'Codex']
    }
];

const DEFAULT_MECHANICS_GLOSSARY_TERM: MechanicsGlossaryTerm = {
    id: 'mutators',
    preferredLabel: 'Mutators',
    shortDefinition: 'Rule modifiers that change floor pressure, presentation, scoring, or board constraints.',
    avoidLabels: ['debuffs only', 'mods'],
    surfaces: ['HUD', 'Codex', 'Floor banner']
};

export const glossaryTermById = (id: MechanicsGlossaryTerm['id']): MechanicsGlossaryTerm =>
    MECHANICS_GLOSSARY_TERMS.find((term) => term.id === id) ?? DEFAULT_MECHANICS_GLOSSARY_TERM;

export const MECHANICS_GLOSSARY = MECHANICS_GLOSSARY_TERMS;

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
        description: 'Score 10,000 total points in one run.'
    },
    ACH_PERFECT_CLEAR: {
        id: 'ACH_PERFECT_CLEAR',
        title: 'Perfect Memory',
        // One sentence, like every other achievement here. The full list of disallowed powers
        // is rule detail and lives in the Codex entry for Perfect Memory, which is where a
        // player goes to look a rule up; a card in a grid of twenty cannot hold it.
        description: 'Clear a floor with zero mismatches and no powers that run. Pins are allowed.'
    },
    ACH_LAST_LIFE: {
        // The id is a Steam API name and stays; the achievement it names changed in Gen 183, when
        // lives went and the turn ceiling came in (docs/REMOVED_LIVES.md).
        id: 'ACH_LAST_LIFE',
        title: 'Last Turn Standing',
        description: 'Clear a floor on the final turn before its ceiling.'
    },
    ACH_ENDLESS_TEN: {
        id: 'ACH_ENDLESS_TEN',
        title: 'Abyssal Ten',
        description: 'Reach floor 10 in a single Endless run.'
    },
    ACH_ENDLESS_CYCLE: {
        id: 'ACH_ENDLESS_CYCLE',
        title: 'Full Circuit',
        description: 'Reach floor 12 in one Endless run, the length of a full mutator cycle.'
    },
    ACH_ENDLESS_TWENTY: {
        id: 'ACH_ENDLESS_TWENTY',
        title: 'Twenty Down',
        description: 'Reach floor 20 in a single Endless run.'
    },
    ACH_SCORE_TEN_THOUSAND: {
        id: 'ACH_SCORE_TEN_THOUSAND',
        title: 'Vault Mind',
        description: 'Score 100,000 total points in one run.'
    },
    ACH_STREAK_TEN: {
        id: 'ACH_STREAK_TEN',
        title: 'Unbroken Ten',
        description: 'Reach a ten-match clean streak in one run.'
    },
    ACH_TRAIT_SCHOLAR: {
        id: 'ACH_TRAIT_SCHOLAR',
        title: 'Trait Scholar',
        description: 'Match all four tile traits in a single run.'
    },
    ACH_NO_POWERS_TEN: {
        id: 'ACH_NO_POWERS_TEN',
        title: 'Bare Hands',
        description: 'Reach floor 10 in a run where you used no powers.'
    },
    ACH_FIRST_FEVER: {
        id: 'ACH_FIRST_FEVER',
        title: 'Fever',
        description: 'Break a chunk at the Fever rung of the chain.'
    },
    ACH_CHUNK_SIX: {
        id: 'ACH_CHUNK_SIX',
        title: 'Sixfold',
        description: 'Take six pairs or more with a single chunk break.'
    },
    ACH_EXTREME_FEVER: {
        id: 'ACH_EXTREME_FEVER',
        title: 'Extreme Fever',
        description: 'Clear a floor with the chain still at Fever when the last pair goes.'
    },
    ACH_NOTHING_HELD_IT: {
        id: 'ACH_NOTHING_HELD_IT',
        title: 'Nothing held it',
        description: 'Watch a suit\'s last pairs drop with a break, without a match touching them.'
    },
    ACH_CHAIN_REACTION: {
        id: 'ACH_CHAIN_REACTION',
        title: 'Chain reaction',
        description: 'Send a pop three waves deep: the wave walks on from where it stopped, and on again.'
    }
};

/**
 * Mutators — must include **every** `MutatorId`.
 */
export const MUTATOR_CATALOG: Record<MutatorId, MutatorDefinition> = {
    sticky_fingers: {
        id: 'sticky_fingers',
        title: 'Sticky fingers',
        description:
            'After a match, **one board slot** is reserved so your **next opening flip** must start elsewhere—flip-order pressure only (often highlighted in the HUD).'
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
            'Baseline procedural floors already spawn pickups. This mutator makes the floor denser by guaranteeing **two** pickup pairs.'
    },
    shifting_spotlight: {
        id: 'shifting_spotlight',
        title: 'Shifting spotlight',
        description:
            'Each flip sequence (match, miss, or gambit) moves a Ward pair (lower match score) and a Bounty pair (bonus score) among remaining pairs. Distinct from the cursed “match last” pair.'
    },
    magpie_thief: {
        id: 'magpie_thief',
        title: 'The magpie',
        description:
            'Something bright-eyed is nesting on this floor. Every **third miss** it drops in, takes a **pair you already cleared**, and hides it again somewhere you have never looked. Your **score keeps the points** — what it takes is the knowing.'
    }
};

export const GAME_MODE_CODEX: GameModeCodexEntry[] = [
    {
        id: 'endless',
        title: 'Classic Run',
        description:
            'The one mode. Procedural floors whose suits are dealt in clumps, so every board opens as a map. Every match pops the clump around it, and the chain that builds from pop to pop climbs toward Fever. Each floor is named, carries a hint, and features one objective that pays a floor bonus. Everything the retired mode cards used to switch on — a clock, calm pacing, vows, chaos, an unrecorded run — is a choice on the setup sheet in front of the run. (Internal mode id: endless.)'
    },
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
            'Each floor begins with tiles face-up briefly, then play continues hidden. Mutators such as Short memorize can shorten this window, and some floor residents lend or take a little of it.'
    },
    {
        id: 'turn_ceiling',
        title: 'The turn ceiling',
        description:
            'Every floor has a **ceiling** of **three times its par** in turns; a floor not cleared within it ends the run, and that is the only way a run ends on its own - otherwise it ends when you stop. A bad floor costs nothing beyond that: a miss resets the chain and a slow clear pays a smaller floor-end bonus, and the next floor begins like any other. The run bar shows turns against par and marks the last two turns before the ceiling.'
    },
    {
        id: 'scoring',
        title: 'Score, the par, and the floor-end bonus',
        description:
            'Every floor states a **par**: the turns a competent player needs, `ceil(pairs × 0.85)`, shown as **turns / par** on the run bar. A turn is a pair of flips resolved, match or miss. Clearing a floor pays **100 × floor**, multiplied by the chain tier still standing when the last pair went (**Clean ×1.5, Sharp ×2.5, Fever ×5**), plus **50 × floor** for every turn under par. Missing par costs nothing else. Match score, streaks and the break\'s own scoring are under **Scoring & survival**. **Perfect Memory** (achievement) requires a flawless **floor** (zero tries) **and** no disallowed powers this **run**.'
    },
    {
        id: 'powers',
        title: 'Powers and charges (overview)',
        description:
            'Board tools (shuffle, row shuffle, tile swap, peek, pins, flash) and meta-actions (undo resolve, gambit third flip) use charges or per-floor budgets. See **Powers & tools** in this Codex for each one. A Scholar contract disables board shuffle.'
    },
    {
        id: 'mutators',
        title: 'Mutators',
        description:
            'Classic chapters telegraph mutators before play: the banner names the chapter theme, active pressure, featured objective, and pacing tag so the player knows how to adapt.'
    }
];

/** Toolbar / store powers and related actions (one entry per major mechanic). */
export const ENCYCLOPEDIA_POWER_TOPICS: readonly EncyclopediaTopic[] = [
    {
        id: 'power_full_shuffle',
        title: 'Full-board shuffle',
        description:
            'Spends a shuffle charge to permute hidden tiles (rules may use weaker “rows only” shuffle). May incur shuffle score tax when enabled.'
    },
    {
        id: 'power_region_shuffle',
        title: 'Row / region shuffle',
        description:
            'Shuffles tiles within a single row (charges per run). Distinct from full-board shuffle.'
    },
    {
        id: 'power_peek',
        title: 'Peek',
        description:
            'Reveals a hidden tile briefly without committing a full flip sequence (charges). Peeking a findable shows it without claiming it. Useful for verification; still counts as a power where perfect-clear rules apply.'
    },
    {
        id: 'power_pin',
        title: 'Pin tiles',
        description:
            'Marks tiles to track mentally (pin budget per run; scholar contracts may cap total pins). Pins do **not** disqualify perfect clear by themselves.'
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
 * Floor bonuses, streak rewards, and optional rules that affect score — mirrors `finalizeLevel` / match resolution in `game.ts`.
 */
export const ENCYCLOPEDIA_SCORING_AND_SURVIVAL_TOPICS: readonly EncyclopediaTopic[] = [
    {
        id: 'sys_floor_schedule_and_featured_objective',
        title: 'Floor schedule, featured objectives, and the objective streak',
        description:
            '**Classic Run** uses a repeating chapter schedule: each floor has a **name**, a short **hint**, and **one featured objective** — **Scholar style**, **Glass witness**, **Flip par**, or **Cursed last** — that pays a floor bonus when you clear with it intact. Consecutive featured-objective clears build an **objective streak**: the first clear starts it, and each clear after that adds a **+10** score kicker per streak step, capped at **+50**. Missing the featured objective on a clear decays the streak by **2**; a floor without a featured objective leaves it untouched.'
    },
    {
        id: 'sys_perfect_floor_vs_achievement',
        title: 'Perfect floor vs Perfect Memory (achievement)',
        description:
            'A **perfect floor** means **zero tries** (no failed mismatches) on that level: you get the perfect-clear **score** bonus and a top **rating** tier. The **Perfect Memory** achievement additionally requires you **never used disallowed powers in that run**—no **shuffle** (full-board or row/region), tile swap, peek, undo resolve, gambit, flash, or wild match (pins are still fine). Do not confuse “perfect floor score” with the achievement gate.'
    },
    {
        id: 'sys_recall_focus',
        title: 'Recall Focus and forgotten tiles',
        description:
            '**Recall Focus** is the floor-level memory readout. Clean remembered matches raise focus and can add memory score; mismatches, shuffles, swaps, peeks and other memory aids can lower focus and mark affected tile memories as unstable. If you later match a pair containing those tiles, the forgotten markers are removed, so the HUD distinguishes a lapse from a recovered memory.'
    },
    {
        id: 'sys_scholar_style_floor',
        title: 'Scholar-style floor bonus (not only the contract)',
        description:
            'The **scholar-style** objective is worth **+40**. Outside scheduled endless chapters, it still behaves like a normal stackable floor objective: clear the floor **without moving the board on that floor** — no full-board shuffle, row shuffle or tile swap — and you get the bonus. In modern endless chapters, you earn it only on floors where **Scholar style** is the **featured objective**.'
    },
    {
        id: 'sys_flip_par_floor',
        title: 'Flip par (within the floor par)',
        description:
            'The **flip par** objective is worth **+30**. Clear the floor within its stated **par** of turns (`ceil(pairs × 0.85)`, the same par the run bar shows) and you get the bonus. A turn is a pair of flips resolved, match or miss; the gambit\'s three flips are one turn. Outside scheduled endless chapters this can stack with other floor objectives; in modern endless chapters it pays out only when **Flip par** is the **featured objective** for that floor.'
    },
    {
        id: 'sys_cursed_last',
        title: 'Cursed last objective',
        description:
            '**Cursed last** is worth **+50**: one pair is marked cursed, and you must match it **last** among real pairs. Outside scheduled endless chapters it behaves like a normal floor objective. In modern endless chapters it only appears when it is the floor\'s **featured objective**, and endless floors generate the cursed pair only on **Cursed last** chapters.'
    },
    {
        id: 'sys_boss_floor_multiplier',
        title: 'Boss floors',
        description:
            'Floors tagged **boss** apply a **score multiplier** (~1.15×) to the pre-boss subtotal for that clear (the floor-end bonus and stacked objective bonuses included before the multiply).'
    },
    {
        id: 'sys_shuffle_score_tax',
        title: 'Shuffle score tax (optional)',
        description:
            'When the **shuffle score tax** option is on in settings, each **full-board shuffle** multiplies your run’s **match-score multiplier** down by a modest factor—**additional shuffles compound** the penalty for that run. Every shuffle is taxed; there is no free first one. Distinct from floor objective bonuses.'
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
            'Optional setting: shows **distance-class** hints between paired tiles (Manhattan steps on the grid). **Informational only**—does not change score, streak math, or perfect / achievement rules. ' +
            'The number is read off the live board on every flip and every break: a tile a chunk took is a gap, never a partner, and a card whose partner broke away shows no number at all.'
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
            'Settings can force **row-preserving** shuffles (only hidden tiles permute **within each row**) instead of a full hidden-tile Fisher–Yates. **Full-board shuffle** charges refer to the full-board tool; **row / region shuffle** stays a separate control.'
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
            'Study time starts from a **base**, adjusts in **steps** toward a **floor minimum**, and **relaxes** every few levels so memorize does not shrink every single floor. A floor resident can lend or take a little of the **next** floor\'s study time (capped).'
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

/** Bonus pickups and special tile types. */
export const ENCYCLOPEDIA_PICKUP_AND_BOARD_TOPICS: readonly EncyclopediaTopic[] = [
    {
        id: 'chain_chunk_fever',
        title: 'Chain, chunk and Fever',
        description:
            'Every match pops: the same-suit cards the two tiles you matched are touching break away with them. ' +
            'A pop only ever takes what it is touching - a pair goes when the wave holds **both** halves, and nothing is ever taken across a gap. ' +
            'What the chain buys is how far the wave walks: two steps with no chain, four from chain 3 (Clean). ' +
            'Sharp, about two-fifths of the floor\'s pairs of momentum and four at least, runs the reaction on from where the wave stopped and lets it **bridge** - crossing into the one clump its cards were touching, whatever that suit is. ' +
            'Fever, about two-thirds and seven at least, bridges into three clumps and walks diagonals, so corners connect too. Every pair a break takes adds to the chain\'s momentum. ' +
            'Treasure inside a break spills and pays as if you had matched it. A break pays a pair\'s worth times the pairs, times the tier it landed at (Clean ×2, Sharp ×4, Fever ×8), times the ripple (×1.75 for a second wave, up to ×6): a huge Fever reaction is worth hundreds of pops. Broken pairs give no recall credit - memory still pays best - but they ' +
            'clear the floor faster, and a longer ripple pays more. A miss halves the chain and puts the fire out. ' +
            'A suit that can no longer pop - no two of its pairs within reach of each other - loses its last pairs on its own: that is the drop, and it happens at any chain, so breaking the two pairs that hold a third up is a thing you can aim. ' +
            'A break with a shape gets a name on the run line: a ripple that ran on, a drop, a long clump, a bridge into the suit next door, a treasure spill, a clean sweep of a suit. ' +
            'Clear the floor with momentum still standing and the floor-end bonus multiplies with the tier: 1.5x at Clean, 2.5x at Sharp, 5x at Fever - Extreme Fever. Never the rating.'
    },
    {
        id: 'tile_suits',
        title: 'Suits',
        description:
            'Every tile wears one of four suits on its back — Ember, Tide, Moss or Bone — and both halves of a pair share it. ' +
            'Suits are dealt in clumps, so the floor opens as a map you can plan against before you flip anything. ' +
            'A floor carries about one suit for every four pairs it deals, rounded up: the very first board shows two, the second shows three, and all four are out by around the tenth floor. '
            + 'The floor decides the shape: a breather or a treasure hall deals big clumps, a rush, speed or trap floor deals its suits scattered - and a scattered floor keeps to two suits however big it is, because a scattered third suit thins the board until a match touches nothing of its own kind. A spotlight floor deals only two by design. ' +
            'Focus or select a hidden tile and the board outlines the clump it stands in and says how many pairs a Sharp break there would take. ' +
            'The symbol on the front is still the thing to remember; the suit is the thing you can see.'
    },
    {
        id: 'pickup_findables',
        title: 'Findables (bonus pickups)',
        description:
            'Procedural floors spawn **real** pickup pairs by default: floors 1–3 have one pair, later floors have one or two, and **Dense pickups** guarantees two. There is one kind: the **score glint**, +25 score. Matching the carrier pair claims it, a chunk break that takes it spills it and pays it out, and Peek only reveals it.'
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
        id: 'board_tile_traits',
        title: 'Tile traits',
        description:
            '**Tile traits** are pair-level rules layered onto ordinary match pairs from floor 4 onward; the first three floors carry none. **Echo** grants a peek charge on clean match. **Heavy** grants +35 score on clean match and a miss costs an extra try. **Conduit** converts nearby traits into score. **Stasis** locks a nearby trait tile from being opened first next turn. Traits standing next to each other add to these effects — Conduit beside Echo also grants a peek charge, Conduit beside Stasis adds score and pulses the same lock.'
    },
    {
        id: 'board_shifting_spotlight',
        title: 'Ward & bounty (shifting spotlight)',
        description:
            'With **Shifting spotlight**, a Ward pair scores less if matched while highlighted; a Bounty pair grants extra score. Rotates on match, miss, or gambit.'
    }
];

/** Challenge runs and contract flags (endless + flags, not separate `GameMode`). */
export const ENCYCLOPEDIA_CONTRACT_TOPICS: readonly EncyclopediaTopic[] = [
    {
        id: 'contract_scholar',
        title: 'Scholar contract',
        description:
            'Menu / run flag: **no full-board shuffle** for the whole contract (row/region tools follow current rules). Separate from the **scholar-style per-floor bonus**, which any run can earn floor-by-floor by not moving the board on that floor.'
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
    }
];
