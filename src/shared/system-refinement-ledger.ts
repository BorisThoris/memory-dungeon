import { gameplayInteractionGraph } from './gameplay-interaction-graph';

/**
 * What was examined, and what came of it, for every system in the game.
 *
 * "Refine every system" is a claim about coverage, and a claim about coverage is worth exactly as
 * much as the thing that checks it. Generations 200-202 worked system by system; this is the record
 * of that pass in a shape a test can walk, so the claim is checkable rather than asserted.
 *
 * A system's verdict is one of three, and each means something different:
 *
 *   `changed`   - the pass found something wrong and this is what was done about it.
 *   `confirmed` - the pass looked and found the system already in its refined state. The note says
 *                 what was checked and what the evidence was, so "confirmed" is never a shrug.
 *   `removed`   - the pass concluded the system should not exist, and it is gone. Kept in the
 *                 ledger so the next reader knows it was decided rather than forgotten.
 *
 * The gate is `system-refinement-ledger.test.ts`: every mechanic in the interaction graph must have
 * an entry, every entry must name a real mechanic, and no note may be shorter than a sentence.
 * A new mechanic therefore cannot ship without someone saying what state it is in.
 */
export type SystemRefinementVerdict = 'changed' | 'confirmed' | 'removed';

export interface SystemRefinementEntry {
    /** Mechanic id from the interaction graph, or a `surface.` id for a system the graph omits. */
    readonly id: string;
    readonly verdict: SystemRefinementVerdict;
    /** Which generation last passed over it. */
    readonly generation: number;
    readonly note: string;
}

export const SYSTEM_REFINEMENT_LEDGER: readonly SystemRefinementEntry[] = [
    // ---- The cascade: the loop the game is actually about. -------------------------------------
    {
        id: 'board.chain_chunk_fever',
        verdict: 'confirmed',
        generation: 201,
        note: 'Ladder measured at none 1.72 / clean 2.19 / sharp 6.03 / fever 8.64 pairs per match, spread 6.93, and the multiplier climbs strictly at every rung. sim:cascade and sim:pop both hold their bands.'
    },
    {
        id: 'board.cleanup',
        verdict: 'confirmed',
        generation: 201,
        note: 'The pop takes only cards in contact (Gen 197) and the drop fires on 0.177 of chain-one matches at 1.17 pairs a drop. Both numbers come from sim:pop rather than from the rule being read back.'
    },
    {
        id: 'core.board_turn_resolution',
        verdict: 'confirmed',
        generation: 201,
        note: 'Occupancy 1.000 x 4.46 on the reference pass: every floor resolves turns, which is the one row in the census that would be alarming at any other value.'
    },
    {
        id: 'objective.floor_clear',
        verdict: 'changed',
        generation: 201,
        note: 'The in-run line at zero remaining pairs said "Next: exit is ready." There is no exit; a floor ends when the board does. It now says the floor is clear.'
    },

    // ---- The four traits. ----------------------------------------------------------------------
    {
        id: 'trait.echo',
        verdict: 'changed',
        generation: 205,
        note: 'Occupancy 0.392, banded common. Pays in peek charges, which is a currency the run still spends - the peek reads 1.000 on the tooled pass. Gen 205: it was the rarest of the four at 0.342, because two of the three interaction couples spend Conduit and Stasis and the fill that was meant to even the floor out drew uniformly instead.'
    },
    {
        id: 'trait.heavy',
        verdict: 'changed',
        generation: 201,
        note: 'Its mismatch line promised "costs +1 extra try but never drains peek charges". Nothing in the game drains a peek charge on a mismatch, so the clause promised the absence of an impossible penalty. Cut; the true half stayed.'
    },
    {
        id: 'trait.conduit',
        verdict: 'changed',
        generation: 202,
        note: 'Its Echo payoff line, "Conduit + Echo: peek spark", was being sorted into a lane called Shard and drawn on the card back as a combo shard - a currency removed in Gen 184. It reads Tool now, which is what a returned peek charge is.'
    },
    {
        id: 'trait.stasis',
        verdict: 'confirmed',
        generation: 202,
        note: 'Occupancy 0.512, banded common. Both its interaction lines land in the block lane, which is what a lock does, and the lane survived the Gen 202 cull on evidence.'
    },

    // ---- The powers a player can press. --------------------------------------------------------
    {
        id: 'power.peek',
        verdict: 'confirmed',
        generation: 201,
        note: 'Occupancy 1.000 and honestly so: the census presses it at floor open, where an unrevealed card always exists. The reason is real on every floor, so 1.000 is a measurement rather than a construction.'
    },
    {
        id: 'power.pin',
        verdict: 'changed',
        generation: 201,
        note: 'Re-banded core to common. It read 1.000 while the census pressed it at floor open regardless of the board; pressed after a miss, where a pin has a reason, it reads 0.158 - the reference miss rate.'
    },
    {
        id: 'power.flash_pair',
        verdict: 'changed',
        generation: 207,
        note: 'Re-banded common -> rare at Gen 207. A setup charge the run hands out once and never refills: 0.042 of the floors in a run against the 0.158 a fresh run every floor reported. Rare is what a once-a-run charge is.'
    },
    {
        id: 'power.tile_swap',
        verdict: 'changed',
        generation: 201,
        note: 'Stays core, but now on evidence: 0.988, because nearly every board deals a pair whose halves are not touching. Before, it was pressed unconditionally and read 1.000 by construction.'
    },
    {
        id: 'power.shuffle',
        verdict: 'changed',
        generation: 207,
        note: 'Re-banded core -> common at Gen 207. It read 1.000 of floors on a census that built a fresh run for every floor; across a real run it is 0.196, because a run starts with one shuffle charge and only one floor curio grants another. Nothing about the tool changed - the band was describing the instrument. Its Codex entry was repointed in Gen 201: a Scholar contract disables board shuffle and nothing else, which is what the code does. Gen 205 moved the census press off the halfway mark, where a break that empties the board in one turn skips it entirely.'
    },
    {
        id: 'power.region_shuffle',
        verdict: 'confirmed',
        generation: 205,
        note: 'Occupancy 1.000, banded core - it sat at exactly 0.900 against a 0.900 bar until Gen 205 asked what the missing tenth was, and it was the census pressing at a moment a cascade can skip. It sets shuffleUsedThisFloor like the full shuffle, so the scholar-style objective catches it - checked against the rule, not the field name.'
    },
    {
        id: 'power.undo_resolve',
        verdict: 'confirmed',
        generation: 201,
        note: 'Occupancy 0.475, banded common, and correctly bounded: undo only exists while a pair is resolving, so it cannot exceed the miss rate by much.'
    },
    {
        id: 'power.gambit',
        verdict: 'confirmed',
        generation: 201,
        note: 'Occupancy 0.408, banded common. One third flip per floor, spent on the first miss, which is the only moment it can be spent.'
    },
    {
        id: 'power.wild_match',
        verdict: 'changed',
        generation: 207,
        note: 'Re-banded core -> rare at Gen 207, and it is the clearest thing the run census found: the joker read 1.000 x 1.00 of floors because the census built a new setup run for every floor, and across a real run it is spent on floor 1 and never seen again, on all ten seeds. That is the setup sheet working exactly as written - one joker a run - so the power is unchanged and the claim about it is.'
    },

    // ---- The charges behind those powers. ------------------------------------------------------
    {
        id: 'inventory.peek_charge',
        verdict: 'confirmed',
        generation: 201,
        note: 'Spent as a fall rather than read as a value, so an Echo refund mid-floor cannot hide a spend. That distinction is the reason the census reports charges the way it does.'
    },
    {
        id: 'inventory.shuffle_charge',
        verdict: 'confirmed',
        generation: 201,
        note: 'One charge, one dock tool, one spend path; the run-shell tool catalog gate proves no charge field exists without a tool that spends it.'
    },
    {
        id: 'inventory.region_shuffle_charge',
        verdict: 'confirmed',
        generation: 201,
        note: 'Shared by the row shuffle and the tile swap, which is why the census gives them separate counter ids on separate passes rather than one row.'
    },
    {
        id: 'inventory.flash_pair_charge',
        verdict: 'confirmed',
        generation: 201,
        note: 'Granted by a run setup rather than a plain endless run, which is exactly why the setup pass exists; its spend now tracks the flash at 0.158.'
    },
    {
        id: 'inventory.undo_charge',
        verdict: 'confirmed',
        generation: 201,
        note: 'A per-floor budget rather than a run charge. RUN_TOOL_REASONS.undo tells the player the one condition - a pair mid-resolution - and the dock takes its enabled state from the same rule.'
    },
    {
        id: 'inventory.gambit_token',
        verdict: 'confirmed',
        generation: 201,
        note: 'A per-floor flag, read through the census as 0 or 1 rather than as a tally, because the gambit either happened on a floor or did not.'
    },
    {
        id: 'inventory.wild_match_token',
        verdict: 'confirmed',
        generation: 200,
        note: 'The token and the joker tile are two halves of one system and now move together at 1.000 on the setup pass.'
    },
    {
        id: 'board.wild_joker_tile',
        verdict: 'confirmed',
        generation: 200,
        note: 'The last singleton in the game. Gen 196 removed the decoy, the exit, the lever and the shop door; SINGLETON_UTILITY_PAIR_KEYS is now exactly one key, pinned by a test.'
    },

    // ---- Memory, board and floor. --------------------------------------------------------------
    {
        id: 'phase.memorize',
        verdict: 'confirmed',
        generation: 201,
        note: 'Exempt from the census by argument rather than omission: every floor opens with it, so a counter would read 1.00 on every row and prove nothing.'
    },
    {
        id: 'safety.softlock_fairness',
        verdict: 'confirmed',
        generation: 201,
        note: 'A guarantee rather than an occurrence, so its gate is the softlock seed sweep - 0 issue floors across the endless health check - not an occupancy row.'
    },
    {
        id: 'findable.score_glint',
        verdict: 'changed',
        generation: 202,
        note: 'Its reward row carried a destroyText field saying Destroy forfeits the score. Replaced with the rule that is true: a break which takes the carrier spills the glint and pays it.'
    },
    {
        id: 'objective.featured_streak',
        verdict: 'changed',
        generation: 201,
        note: 'The scholar-style objective told the player "no shuffle, swap, or destroy" while its rule watched one field. The field turned out to cover swap too, so only the dead third was cut.'
    },
    {
        id: 'economy.score_and_rewards',
        verdict: 'confirmed',
        generation: 201,
        note: 'The economy row projection lists score, findable pickups and assist charges, and it lost Destroy and Stray in Gen 200 rather than showing them at zero.'
    },
    {
        id: 'stats.session_tracking',
        verdict: 'changed',
        generation: 202,
        note: 'pairsDestroyed could only ever be zero once Destroy left - it had no other writer. The field, its normalizer entry and the long-run feedback branch that listed "destroy pair" among a player’s actions are all gone.'
    },

    // ---- Run shape, setup and persistence. -----------------------------------------------------
    {
        id: 'progression.run_flow',
        verdict: 'confirmed',
        generation: 201,
        note: 'Exempt from the census because it is the frame the census steps; a floor ends when the board is empty, proven by the endless simulation clearing 1.00 of floors at every miss rate.'
    },
    {
        id: 'progression.run_setup',
        verdict: 'changed',
        generation: 200,
        note: 'A chaos setup granted initialStrayRemoveCharges alongside the joker. Stray is gone, so it grants the joker alone - which is what a chaos run was for.'
    },
    {
        id: 'mode.wild_run',
        verdict: 'confirmed',
        generation: 200,
        note: 'The one surviving setup flavour. Its Codex entry describes a joker and a different pairing puzzle, which after Gen 200 is the whole of what it does.'
    },
    {
        id: 'inventory.mutator_loadout',
        verdict: 'changed',
        generation: 201,
        note: 'Exempt from the census as a pre-floor choice, but its documentation still listed score_parasite, removed in Gen 183. MUTATORS.md now lists the ten in MUTATOR_IDS and says why the eleventh went.'
    },
    {
        id: 'inventory.contract_loadout',
        verdict: 'changed',
        generation: 200,
        note: 'The noDestroy clause went with Destroy, so a Scholar contract is a no-shuffle contract. Every Codex sentence that said otherwise was repointed.'
    },
    {
        id: 'persistence.run_summary',
        verdict: 'confirmed',
        generation: 201,
        note: 'Written once when a run ends, so the floor census cannot see it; the save-field policy gate covers it instead, and no removed field is written back.'
    },

    // ---- The machinery around the game. --------------------------------------------------------
    {
        id: 'core.gameplay_commands',
        verdict: 'changed',
        generation: 200,
        note: 'The simulation drew from a slot range with a dead slot in it after the destroy and stray commands left, wasting one pick in every n on nothing. The slots were compacted.'
    },
    {
        id: 'feedback.gameplay_hud',
        verdict: 'changed',
        generation: 202,
        note: 'Twenty-one branches of the in-run feedback rail watched for announcements the game cannot produce - guard caches, patrol paths, shop gold. Removed, and gateed so no branch can outlive its announcement.'
    },
    {
        id: 'simulation.gameplay_replay',
        verdict: 'confirmed',
        generation: 200,
        note: 'A tool for verifying the game rather than a rule in it. Its 384-step run stays deterministic and schema-clean after the command slots were compacted.'
    },
    {
        id: 'simulation.build_evaluation',
        verdict: 'confirmed',
        generation: 201,
        note: 'A tool for tuning rather than a rule. It is the thing that produced the re-bands in this ledger, which is the argument for exempting it from being censused by itself.'
    },

    // ---- Systems the interaction graph does not model, checked anyway. --------------------------
    {
        id: 'surface.floor_identity_coaching',
        verdict: 'changed',
        generation: 201,
        note: 'The four sentences a player reads on the floor they are standing on taught traps, disarms, keys, locks, guard, the parasite clock and finding the exit. Rewritten around what an archetype now decides: whether the suits are clumped, scattered or two-suit.'
    },
    {
        id: 'surface.boss_identity',
        verdict: 'changed',
        generation: 201,
        note: 'Promised +2 Favor, a currency removed in Gen 175, and a Keystone Pair board anchor that exists nowhere in the game - in a string shown in the HUD title.'
    },
    {
        id: 'surface.trait_interaction_lanes',
        verdict: 'changed',
        generation: 202,
        note: 'Seven lanes for four interactions. The shard, guard and risk lanes went with their colours, their card-back marker meshes and their beat tiers.'
    },
    {
        id: 'surface.codex',
        verdict: 'changed',
        generation: 201,
        note: 'Eleven entries still taught Destroy and Stray the day after both were removed: findables, powers, dense pickups, shifting spotlight, charges, perfect memory, recall focus, the scholar objective and the scholar contract.'
    },
    {
        id: 'surface.audio',
        verdict: 'changed',
        generation: 200,
        note: 'Two sampled effects and their manifest rows went with the powers that played them, along with the OGG and WAV files. The audio coverage gate confirms every remaining cue has a manifest entry and a file.'
    },
    {
        id: 'surface.removed_powers',
        verdict: 'removed',
        generation: 200,
        note: 'Destroy could never be pressed - no code path grants a charge - and Stray had only one legal target left, the wild joker, so pressing it deleted the player’s own wild match. Recorded in docs/REMOVED_POWERS.md.'
    }
];

export const systemRefinementLedgerById = (): Map<string, SystemRefinementEntry> =>
    new Map(SYSTEM_REFINEMENT_LEDGER.map((entry) => [entry.id, entry]));

/** Graph mechanics with no ledger entry: systems nobody has said anything about. */
export const unexaminedSystemIds = (): string[] => {
    const ledger = systemRefinementLedgerById();
    return gameplayInteractionGraph.mechanics.map((mechanic) => mechanic.id).filter((id) => !ledger.has(id));
};

/** Ledger entries naming a mechanic the graph does not have, excluding the `surface.` ids. */
export const strandedLedgerIds = (): string[] => {
    const known = new Set(gameplayInteractionGraph.mechanics.map((mechanic) => mechanic.id));
    return SYSTEM_REFINEMENT_LEDGER.map((entry) => entry.id).filter(
        (id) => !known.has(id) && !id.startsWith('surface.')
    );
};
