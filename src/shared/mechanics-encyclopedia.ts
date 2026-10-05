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
import {
    CURSED_LAST_BONUS_SCORE,
    FEATURED_OBJECTIVE_STREAK_BONUS_MAX,
    FEATURED_OBJECTIVE_STREAK_BONUS_PER_STEP,
    FEATURED_OBJECTIVE_STREAK_MISS_DECAY,
    FLIP_PAR_BONUS_SCORE,
    SCHOLAR_STYLE_FLOOR_BONUS_SCORE,
    type AchievementId,
    type GameMode,
    type MutatorId
} from './contracts';

/** Monotonic reference doc version (increment when the encyclopedia meaningfully changes). */
export const ENCYCLOPEDIA_VERSION = 80 as const;

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
        description: 'Clear a floor with your last miss already spent.'
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
        title: 'Fourfold',
        description: 'Take four pairs or more with a single chunk break - a Fever break at its cap.'
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
    },
    /*
     * The retention curve, graded. Across nine comparable products the market survey found almost
     * every published statistic is a one-time unlock, so nobody can tell a player who tried a game
     * once from one who played it for a year. Exactly one - Luck be a Landlord - instruments repeat
     * play, and its numbers are the only real engagement data in public anywhere in the survey:
     * 41.1% reach 5 wins, 30.8% reach 10, 8.1% reach 25, 2.2% reach 50, 0.9% reach 100. The spacing
     * here is that spacing, so this game's own curve can be read against the one comparable that
     * publishes theirs. These exist to be read after launch; they are not content.
     */
    ACH_RUNS_FIVE: {
        id: 'ACH_RUNS_FIVE',
        title: 'Five Descents',
        description: 'Finish five runs.'
    },
    ACH_RUNS_TEN: {
        id: 'ACH_RUNS_TEN',
        title: 'Ten Descents',
        description: 'Finish ten runs.'
    },
    ACH_RUNS_TWENTY_FIVE: {
        id: 'ACH_RUNS_TWENTY_FIVE',
        title: 'Twenty-Five Descents',
        description: 'Finish twenty-five runs.'
    },
    ACH_RUNS_FIFTY: {
        id: 'ACH_RUNS_FIFTY',
        title: 'Fifty Descents',
        description: 'Finish fifty runs.'
    },
    ACH_RUNS_HUNDRED: {
        id: 'ACH_RUNS_HUNDRED',
        title: 'A Hundred Descents',
        description: 'Finish a hundred runs.'
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
            'After a match, a **face-down card touching** the first card of the pair **sticks**: your **next turn cannot open on it**, though it can still be the second card. The stuck card is marked on the board. Nothing sticks when the match has no face-down neighbour, or when one pair is left.'
    },
    restless_floor: {
        id: 'restless_floor',
        title: 'Restless floor',
        description:
            'The floor keeps changing while you play it. Every **third turn**, match or miss, hidden cards trade places — one pair the first time, two the second, three from then on. Matched, flipped and pinned cards stay put. Clear what you know before the floor takes it back.'
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
        title: 'The anchor',
        description:
            'After your first match, the floor picks a pair still face down as the **anchor** and **marks one of its cards**. You know where half of it is: find the other half and match them for an **extra chain link**. Leave it for two matches and the anchor moves to another pair.'
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
    },
    lantern_light: {
        id: 'lantern_light',
        title: 'Lantern light',
        description:
            'Every **match** lights the cards beside it: up to **three** of the face-down cards touching the matched pair show their faces until you **turn the next card**. Nothing is spent. A pair matched at the edge lights little; one matched where you have not looked lights the most - so choose where to match.'
    },
    skittish_cards: {
        id: 'skittish_cards',
        title: 'Skittish cards',
        description:
            'The cards on this floor do not like being looked at. When you **miss**, each of the two cards you just saw **flinches one step** — up, down, left or right — into a face-down neighbour’s cell. A card you missed is still **next to where you saw it**: check beside it first. A clean floor never flinches, and a **pinned** card never moves.'
    }
};

export const GAME_MODE_CODEX: GameModeCodexEntry[] = [
    {
        id: 'endless',
        title: 'Classic Run',
        description:
            'Remember pairs and build momentum through procedural floors. At Clean, matches can pop nearby pairs of the same suit; climb to Sharp and Fever for larger reactions. Each floor has its own layout, hint and bonus objective. Choose your run settings before you descend.'
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
        id: 'store',
        title: 'Gold and camp upgrades',
        description:
            'Clear floors and build combos to earn **gold**. A clear pays two gold, plus one per chain rung and up to three for turns under par. Arena difficulty can increase the payout. ' +
            'After every third floor, **camp automatically spends gold** on one useful reward. It restores a miss first when only one remains; otherwise it chooses the lowest-rank affordable upgrade, then a missing supply. There is no shop screen. **Long Look** adds one second of study per rank (8, 14, 20 gold). **Deep Pockets** adds one miss slot and restores one miss per rank (8, 14, 20 gold), up to seven slots. ' +
            '**Gilded Chain** pays 2, 3 or 4 gold every five matches in a row (6, 11, 16 gold). Each upgrade has three ranks and lasts this run. ' +
            'When an upgrade is not affordable, camp can restore a miss for 4 gold, a missing peek for 3 or a missing bomb for 4. Each repeat costs 2 more for misses and bombs, or 1 more for peeks. New runs start with one bomb; the last pair must be matched. ' +
            'Unspent gold carries between floors. Gold and upgrades reset when the run ends. The next arena is selected randomly; no route choice is needed.'
    },
    {
        id: 'miss_budget',
        title: 'Misses',
        description:
            'A run has a small bank of **misses**, and it is earned. It opens with **three**; clearing a floor earns **one**, and so does every **fifth match in a row**. Each miss you earn lasts **three floors** past the one you earned it on - the oldest go first - and the bank holds **four** at most (**five** with Deep Pockets at rank 1, up to **seven** at rank 3). A miss spends one (two on a Heavy card) - it still resets the chain, counts a try and a turn, and nothing else - and a miss with none left ends the run. That is the only way a run ends on its own; otherwise it ends when you stop. The run bar shows turns against par and how many misses you have left, and turns red on the last one.'
    },
    {
        id: 'scoring',
        title: 'Score, the par, and the floor-end bonus',
        description:
            'Every floor states a **par**: the turns a competent player needs, about **0.72 turns a pair** (a little more past thirteen pairs), rounded up, plus **one** turn to spare (**three** on the first six floors), and never more turns than the floor has pairs, shown as **turns / par** on the run bar. A turn is a pair of flips resolved, match or miss. Clearing a floor pays **100 × floor**, multiplied by the chain tier still standing when the last pair went (**Clean ×1.5, Sharp ×2.5, Fever ×5**), plus **50 × floor** for every turn under par. Missing par costs nothing else. Match score, streaks and the break\'s own scoring are under **Scoring & survival**. **Perfect Memory** (achievement) requires a flawless **floor** (zero tries) **and** no disallowed powers this **run**.'
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
        id: 'power_zone',
        title: 'The Zone (Ignite)',
        description:
            'At **Inferno** or better, with nothing face up, press **Ignite**. Your combo **burns to zero** and the Zone opens for **three pairs** (**four** at Legendary, one more for every ascension, six at most). Inside it, time stops: every card you turn **stays up** and **nothing resolves**. Turn the last allowed card, or press **Resolve**, and everything face up plays at once: every complete pair **matches first**, so the chain climbs and the pop widens through them; what is left is played as **misses**, two cards at a time, at full price from the bank (a lone leftover card costs nothing). On top, a Zone bonus of **100 × pairs matched²**. A perfect Zone leaves a fresh combo standing; a bad one costs what those cards would have cost as turns.'
    },
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
            'Once per floor, after two flips, you may try a third card to complete a pair; a wrong gambit still costs a miss. Counts as a power for perfect clear when used. Resolve **feel** can differ from a normal two-flip miss when **Echo** is on—see **Resolve timing & echo**.'
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
        id: 'sys_void_spew',
        title: 'The void spews',
        description:
            'Lose a combo of **Inferno** (16) or better to a miss and the room collapses into the **void** - and the void spits. It lays **brand-new pairs**, faces you have not seen on this floor, face down into cells you had already cleared (one, plus one for every ten links over sixteen, three at most), and then **reshuffles every face-down card on the board**, pinned ones too. A big combo lost costs what you knew, and leaves more to find.'
    },
    {
        id: 'sys_combo_heat_perks',
        title: 'Heat: what a hot combo changes',
        description:
            'Your **combo** carries from floor to floor until a miss, and past **Warm** (3) it gets hot: **Hot** at 6, **Blazing** at 10, **Inferno** at 16, **Legendary** at 25, and an **ascension** every 25 after. Heat changes the board, not just the room. **Afterglow**: from Hot, every match lights face-down cards touching it until your next flip - **one** at Hot, **two** at Blazing, **three** from Inferno - nothing spent, not a peek. **The wider pop**: from Blazing a break may take **one pair more** than its rung allows. **The longer reach**: from Inferno the first wave walks **a step further** along the clump. The heat you carry **into** a turn is what counts, and it buys **no misses**: a miss at any heat ends the combo and costs the bank the same.'
    },
    {
        id: 'sys_floor_schedule_and_featured_objective',
        title: 'Floor schedule, featured objectives, and the objective streak',
        description:
            `**Classic Run** uses a repeating chapter schedule: each floor has a **name**, a short **hint**, and **one featured objective** — **Scholar style**, **Flip par**, or **Cursed last** — that pays a floor bonus when you clear with it intact. Consecutive featured-objective clears build an **objective streak**: the first clear starts it, and each clear after that adds a **+${FEATURED_OBJECTIVE_STREAK_BONUS_PER_STEP}** score kicker per streak step, capped at **+${FEATURED_OBJECTIVE_STREAK_BONUS_MAX}**. Missing the featured objective on a clear decays the streak by **${FEATURED_OBJECTIVE_STREAK_MISS_DECAY}**; a floor without a featured objective leaves it untouched.`
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
            `The **scholar-style** objective is worth **+${SCHOLAR_STYLE_FLOOR_BONUS_SCORE}**. Outside scheduled endless chapters, it still behaves like a normal stackable floor objective: clear the floor **without moving the board on that floor** — no full-board shuffle, row shuffle or tile swap — and you get the bonus. In modern endless chapters, you earn it only on floors where **Scholar style** is the **featured objective**.`
    },
    {
        id: 'sys_flip_par_floor',
        title: 'Flip par (within the floor par)',
        description:
            `The **flip par** objective is worth **+${FLIP_PAR_BONUS_SCORE}**. Clear the floor within its stated **par** of turns (the same par the run bar shows) and you get the bonus. A turn is a pair of flips resolved, match or miss; the gambit's three flips are one turn. Outside scheduled endless chapters this can stack with other floor objectives; in modern endless chapters it pays out only when **Flip par** is the **featured objective** for that floor.`
    },
    {
        id: 'sys_cursed_last',
        title: 'Cursed last objective',
        description:
            `**Cursed last** is worth **+${CURSED_LAST_BONUS_SCORE}**: one pair is marked cursed, and you must match it **last** among real pairs. Outside scheduled endless chapters it behaves like a normal floor objective. In modern endless chapters it only appears when it is the floor's **featured objective**, and endless floors generate the cursed pair only on **Cursed last** chapters.`
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
            '**On a realm floor - every floor of a run - a match takes its own pair and nothing else. What pops is the reaction** (see **Resonance and reactions**): match one element twice, then another, and the reaction bursts the nearest pairs of both, as many of each as its potency. The rungs below still multiply what a burst pays and still climb with every pair it takes; the contact rule that follows is the old pop, which a floor outside any realm still plays by. ' +
            'A match on its own just matches. Build a chain of three (Clean) and matches start to **pop**: a same-suit pair the two tiles you matched are touching breaks away with them. ' +
            'A pop only ever takes what it is touching - a pair goes when the wave holds **both** halves, and nothing is ever taken across a gap - and it is capped by the rung: up to one extra pair at Clean, two at Sharp, four at Fever, nearest first. These are extra pairs beyond the pair you matched, and the layout decides how many are in reach. A **breather** allows one extra pair at every rung, including before Clean. ' +
            'Sharp, a little over half the floor\'s pairs of momentum and four at least, runs the reaction one wave on from where the pop stopped. ' +
            'Fever, three quarters and seven at least, runs it three waves and lets it **bridge** into the one clump its cards were touching, whatever that suit is. Every pair a break takes adds to the chain\'s momentum. ' +
            'Treasure inside a break spills and pays as if you had matched it. Each popped pair starts at **60% of a base match\'s score**, then the break multiplies by its tier (Clean ×2, Sharp ×4, Fever ×8) and ripple (×1.75 for a second wave, up to ×6). Those multipliers apply to popped pairs, not the pair you remembered. Broken pairs give no recall credit - memory still pays best - but they ' +
            'clear the floor faster, and a longer ripple pays more. A miss ends the chain and puts the fire out. ' +
            'A suit that can no longer pop - no two of its pairs within reach of each other - loses its last pair on its own: that is the drop, and it happens at any chain, so the last pair of a suit is never a pair you have to grind out. ' +
            'A break with a shape gets a name on the run line: a ripple that ran on, a drop, a long clump, a bridge into the suit next door, a treasure spill, a clean sweep of a suit. ' +
            'Clear the floor with momentum still standing and the floor-end bonus multiplies with the tier: 1.5x at Clean, 2.5x at Sharp, 5x at Fever - Extreme Fever. Never the rating. ' +
            'Your **combo carries from floor to floor until you miss** - the chain, its tier, its cascade and early-start momentum, all of it. A floor cleared at Fever opens the next one at Fever, and the only thing that ends it is a miss. ' +
            'Past Fever the combo keeps heating: **Warm** from 3, **Hot** from 6, **Blazing** from 10, **Inferno** from 16, **Legendary** from 25. The heat changes nothing a rule reads - the rungs still decide what a break takes - but the whole game answers it: flames climb the chain rail, the combo number burns, embers rise off the cards, the torches and the ring go wild, lightning through every pop forks and thickens, and the edges of the screen glow in the stage\'s colour. ' +
            'Every run has a **temper**, rolled from its seed: most burn **Ember**; some run **Frost**, and the combo goes cold instead - Chill, Cold, Frozen, Glacial, Absolute Zero - with snow drifting down off the cards; some run **Storm**. One run in fifty is **Prismatic**, the rare one: every colour at once, and its stamps say so. The temper changes nothing a rule reads, and on a floor in a realm the heat burns in the realm\u2019s own element instead - frost, ember, storm, tide or grove. A combo of fifty, and of every hundred, gets a stamp of its own.'
    },
    {
        id: 'realms',
        title: 'Realms and their weather',
        description:
            'Every floor is in a **realm**. On a calm or wild floor the realm is the place - its look, its sound, which element reaches furthest - and everything that happens to the board comes from your matches (see **The elements**). On a **raging** floor the realm also plays the board with you: its weather comes on a clock you wind yourself - every few turns, match or miss - and the chip at the top says how many turns are left. ' +
            '**The Frozen Reach**: a miss freezes both cards it showed for two turns, and a frozen card cannot be turned; a **blizzard** slides one row of face-down cards with the wind and snows their backs over, so their suits cannot be read until you turn them. ' +
            '**The Cinder Deep**: **wildfire** lights a card on a three-turn fuse. Match it and its partner in time and the fire is **doused** for two gold; let the fuse run out and it burns a gold and spreads to a neighbour. ' +
            '**The Drowned Vault**: the **current** runs one column of face-down cards down a step, the bottom card to the top, and sweeps across the room. ' +
            '**The Thunder Spire**: **lightning** swaps two face-down cards and leaves both lit until your next flip - what it shows you is where they landed. ' +
            '**The Overgrown Crypt**: **vines** creep over a card and hold it so it cannot be turned; a match beside vines cuts them, a gold for every vine. ' +
            'Every third weather of a raging floor is the realm\u2019s **peak**: a **Whiteout** snows over every back on the board; a **Firestorm** lights a fire and spreads every fire at once; a **Spring Tide** runs two columns; a **Thunderclap** lights a whole row until your next flip and moves nothing; a **Bloom** flowers the vines, and a bloom you cut pays three gold. The chip at the top names the peak when it is next. ' +
            'A **Raging** realm strikes back at a miss, on the two cards you just saw: the Cinder Deep **scalds** them, both burning on a two-turn fuse; the Drowned Vault\u2019s **undertow** drags each a cell down its column; the Thunder Spire\u2019s **static** throws each across the board, unlit; the Overgrown Crypt **snares** both in vines. ' +
            'Matching beside frozen cards shatters their ice. However the weather falls, a floor always keeps a pair you can turn: if the ice and the vines would leave none, they give way.'
    },
    {
        id: 'element_alchemy',
        title: 'Alchemy',
        description:
            'Every card is made of its element, and you can see which: **Fire** is char split by molten veins, **Water** is deep blue under a web of light, **Frost** is faceted ice, **Grove** is moss and leaves. When an element reaches a face-down card - your casts, the realm\u2019s weather, a raging backlash, the frostbite of a miss - the card answers first. ' +
            'Its **own** element it drinks: nothing happens to it, and it gains a **charge** and glows, brighter the more it holds - there is no limit. Every cast also charges the cards of its own element right beside it. Match a charged card and its charge joins its element\u2019s **resonance**, with a gold for every four charges; miss it and the charge is lost. ' +
            'The element its own **puts out** is **neutralized** and does nothing: **water puts out fire**, **fire melts frost**, **frost kills growth**, and **roots hold against water**. The other two elements land as always. ' +
            'So a fire card never burns and never freezes, a water card is never carried off or set alight, and a frost or grove card shrugs off what its element beats. Casts skip immune cards to find a vulnerable target; even when none remain, the ground changes.'
    },
    {
        id: 'element_resonance',
        title: 'Resonance and reactions',
        description:
            'The elements **stack, and never stop**. Every pair you match of an element - the pairs its pop takes too - is a stack of its **resonance** for the whole run, and the strip beside the board counts all four. Each stack is score on that element\u2019s matches, and every **tier** (at 2, 6, 12, 20, 30 stacks and on) widens its cast by a step. A card you miss sheds a stack of its element. ' +
            'Match the **same element again** and you build a **streak**, floor to floor; a miss breaks it. At two in a row the streak is **primed**, and the next match of a **different** element spends it: the two elements **react**. The potency is the streak, plus half the spent element\u2019s tier, plus half your depth in the Thunder Spire. ' +
            '**Every amplified streak reaction bursts cards**: as many pairs of each of the two elements as its potency, the nearest to your match first, gone from the floor and paid as a pop at your combo\u2019s rung. A plain match pops nothing. On top of the burst, each reaction does its own thing. ' +
            '**Steam** (fire and water) shows that many of the nearest faces until your next flip. **Blaze** (fire and grove) burns every vine on the floor and pays a gold for every two of its potency. **Thaw** (fire and frost) frees every card of ice and snow and scores 25 times its potency squared. **Freeze-over** (water and frost) holds the floor still for its potency plus one turns: no weather, no backlash, no frostbite, no fuse burning down. **Flood** (water and grove) adds its potency to both elements\u2019 resonance. **Frostbloom** (frost and grove) charges that many of the nearest cards. ' +
            'So every turn asks: the same element again, and deeper - or a different one now, and the reaction.'
    },
    {
        id: 'element_groups',
        title: 'The elements',
        description:
            'Every elemental match casts, even a single pair: **Fire** clears ice and vines and ignites a vulnerable block on three-turn fuses; **Water** douses fires and carries unanchored cards; **Frost** freezes vulnerable blocks, preventing flips until thawed; **Grove** binds vulnerable blocks with vines, preventing flips and drift. Match nearby to break ice or cut vines for gold, or cast Fire to clear them. Vines carry seeds worth 1 gold when eventually matched; Water or strong casts grow 2-gold seeds. Fire burns seeds away. Calm pauses weather but never prevents player ignition; Steam or Thaw quenches it. ' +
            'Casts start at two steps of reach, three in their own realm (either half of a confluence). Every three combo and every resonance tier adds a step. Casts start with a two-card budget. Touching cards of the same element carry the cast through their whole block, beyond the initial reach and budget. Every six combo, two resonance tiers, extra popped pair and multiplier doubling adds to that budget, up to six before finishing the last block. Short material bursts show casts, muted sparks show counters, and gold motes show absorbed charges. Combo six or tier two grows blooming vines worth 3 gold when cut. Frost lasts 1 turn at base power, 2 at power 3, and 3 at power 6. All holds cover at least two complete pairs with a common treatment, leaving another pair free; cutting an incomplete cohort releases it. Every cast shows its outcome or a reason it was resisted or blocked. A persistent result beside the elements opens the full receipt. ' +
            'Every match leaves **ground** under its cells and their neighbours, surviving even after the cards leave. Ice anchors cards against elemental movement; a later match on planted roots harvests one gold. The first different material under the matched cards, in board order, reacts locally at power 1. Neighbour patches cannot choose the reaction. Steam douses fires and reveals a face; Thaw melts ice, snow and rime for 25 score; Blaze burns vines, seeds and blooms for one gold; Freeze-over douses fires, plants ice and calms the arena for two turns; Flood plants roots, ripens seeds and grants one Water and Grove resonance; Frostbloom charges a card. Bare cells use the arena material; Storm reveals an extra face. Amplified streak reactions use these same recipes at greater power across the board. Open **Casts** for the last match receipt, upcoming reactions, counters and current strength.'
    },
    {
        id: 'realm_sway',
        title: 'The sway',
        description:
            'Your matches lean the world. Every suit belongs to a realm - **ember** to the Cinder Deep, **tide** to the Drowned Vault, **moss** to the Overgrown Crypt, **bone** to the Frozen Reach - and every pair you match of a suit whose realm you are not in, pops included, leans the floor toward it. The lean comes with you down the stairs like your combo, and like your combo a miss wipes it. At **five pairs** of one suit the floor **tips** into that realm: a named reaction (frost meeting ember is a **Thaw**), at the same severity, once a floor. A tip clears nothing and pays nothing - what the old weather left stays. The realm chip counts the lean, and the backs of the leaning suit take on the realm that is coming. The Thunder Spire has no suit: you can lean your way out of a storm, never into one.'
    },
    {
        id: 'realm_travel',
        title: 'Travel',
        description:
            'The next arena is selected **randomly** when a floor clears. Floors continue automatically, including every third clear when camp supplies are applied. A shared seed repeats the same journey. A run opens somewhere calm. ' +
            'A **Calm** arena pays normal clear gold, **Wild** pays a quarter more and **Raging** pays half again. Only raging arenas have a regular weather clock; the others react to your matches and misses. ' +
            'From the fourth floor a wild arena can be a **confluence**: two realms at once. Both affect the floor and the clear pays **double**. Matching an omen settles the floor on its realm alone. ' +
            'What you leave behind follows you. Every fire that **burnt out** leaves **smoke**: the next floor\u2019s study is 12% shorter for each, up to three. A floor that froze four cards or more sends a **chill**: two cards on the next floor start frozen. Clear a realm floor **clean** by that realm\u2019s measure - nothing frozen in the frost, no fire burnt out in the ember, within par in the tide or the storm, two vines cut in the grove - and you go deeper twice as fast. Every clear in a realm takes you a level **deeper** into it, and every other realm fades by one; there is no limit. Each level is a quarter more gold on that realm\u2019s clears up to three and a twentieth after, one more pair of the floor made of the realm\u2019s element (up to half the floor), and more resonance from it. But a deep realm bites: it strikes back at a miss on a **wild** floor from depth three, and even a **calm** one from depth six, and its raging weather reaches further. The arena HUD shows your current realm.'
    },
    {
        id: 'tile_suits',
        title: 'Suits',
        description:
            'Every tile wears one of four suits on its back — Ember, Tide, Moss or Bone — and both halves of a pair share it. ' +
            'Suits are shuffled across the board, so nothing is laid out for you and no two floors look alike. ' +
            'A floor carries about one suit for every three pairs it deals, rounded up: the very first board shows two, and all four are out by around the fifth floor. '
            + 'What the floor decides is the palette, not the layout: a breather, a rush, a speed or a trap floor and a spotlight floor deal three suits, everything else four. No floor past the first deals two: one suit over half a board was a board where every match popped, and the pop is capped now, so the palette is a map to read rather than a lever. ' +
            'Focus or select a hidden tile and the board outlines the cards it is touching that share its suit, and says how many pairs a Sharp break there would take. ' +
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
            '**Tile traits** are pair-level rules layered onto ordinary match pairs from floor 4 onward; the first three floors carry none. **Echo** grants a peek charge on clean match. **Heavy** grants +35 score on clean match and a miss on it costs one more from the bank. **Conduit** converts nearby traits into score. **Stasis** locks a nearby trait tile from being opened first next turn. Traits standing next to each other add to these effects — Conduit beside Echo also grants a peek charge, Conduit beside Stasis adds score and pulses the same lock.'
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
