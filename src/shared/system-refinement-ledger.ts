import { gameplayInteractionGraph } from './gameplay-interaction-graph';

/**
 * What was examined, and what came of it, for every system in the game.
 *
 * "Refine every system" is a claim about coverage, and a claim about coverage is worth exactly as
 * much as the thing that checks it. This is the record of that pass in a shape a test can walk, so
 * the claim is checkable rather than asserted.
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

/**
 * The generation the whole ledger was last walked against the game as it stands.
 *
 * Gen 213. Until this sweep the ledger recorded *what* had been examined and never *when relative
 * to the game*: 34 of the 48 entries were stamped Gen 200-202, and in the eleven generations since,
 * the deal became a shuffle (204), the three authored floors were redrawn (205), the census learned
 * to measure a run rather than a heap of first floors (207), and par stopped being a flat rate
 * (210-211). An entry written before any of that is not evidence about this game; it is evidence
 * about a game that used to be here, indistinguishable from the real thing by reading.
 *
 * So the gate now requires every entry to be stamped at or after this constant. Raising it is the
 * act of re-walking all forty-eight, and the evidence fields below are what stop that walk from
 * being a stamp: raising the constant without looking leaves the numbers and the greps to fail.
 */
export const SYSTEM_REFINEMENT_SWEEP_GENERATION = 213;

export interface SystemRefinementEntry {
    /** Mechanic id from the interaction graph, or a `surface.` id for a system the graph omits. */
    readonly id: string;
    readonly verdict: SystemRefinementVerdict;
    /** Which generation last passed over it. Must be at or after the sweep constant. */
    readonly generation: number;
    readonly note: string;
    /**
     * The occupancy counter this entry's note quotes its share from (Gen 208).
     *
     * A note that says "0.408 of floors" is a measurement, and a measurement written into prose
     * goes stale the moment the game moves - `power.gambit` said 0.408 while the census said 0.446,
     * and the turn resolution said 4.46 a floor while the census said 4.95. Naming the counter lets
     * the gate re-measure it instead of trusting the sentence: the note has to quote the counter's
     * live share to three decimals somewhere, so a figure that drifts fails rather than rots.
     */
    readonly counter?: string;
    /**
     * Text whose absence from the live game is this entry's finding (Gen 213).
     *
     * Half this ledger records a removal - a lane, a currency, a power, a promise - and a removal
     * is the one kind of finding that can silently come undone: nothing stops a later generation
     * from reintroducing the string, and nothing was checking. The gate re-greps each of these
     * against today's source with comments stripped, so a record of what went is re-proven rather
     * than remembered. Comments are stripped because a comment saying a thing is gone is the
     * record, not the thing.
     */
    readonly gone?: readonly string[];
    /**
     * Text whose presence in the live game this entry depends on (Gen 213).
     *
     * The mirror of `gone`, and the evidence for the systems whose finding is that something is
     * still wired: a charge field with a tool that spends it, a gate that still runs, a slot range
     * that still matches its last slot. If the thing is renamed or deleted, the entry stops being
     * true, and the next person is made to re-examine the system rather than inherit the sentence.
     */
    readonly present?: readonly string[];
}

export const SYSTEM_REFINEMENT_LEDGER: readonly SystemRefinementEntry[] = [
    // ---- The cascade: the loop the game is actually about. -------------------------------------
    {
        id: 'board.chain_chunk_fever',
        counter: 'feverBreaks',
        verdict: 'confirmed',
        generation: 213,
        note: 'Ladder re-measured at none 1.51 / clean 2.19 / sharp 5.67 / fever 7.53 pairs per match, spread 6.02, and the multiplier climbs strictly at every rung. Fever itself lands on 0.246 of floors at 0.28 breaks a floor, which is the top of the ladder being reachable rather than decorative. sim:cascade and sim:pop both hold their bands.'
    },
    {
        id: 'board.cleanup',
        counter: 'chunkPairsDropped',
        verdict: 'confirmed',
        generation: 213,
        note: 'The pop takes only cards in contact (Gen 197), and the drop fires on 0.397 of chain-one matches at 1.38 pairs a drop in sim:pop. The census reads the same mechanism from the other side: the drop takes a severed suit on 0.871 of floors at 2.98 pairs a floor. Both are measurements rather than the rule being read back.'
    },
    {
        id: 'core.board_turn_resolution',
        counter: 'matchResolutions',
        verdict: 'confirmed',
        generation: 213,
        note: 'The census reads 1.000 x 4.95 on the reference pass: every floor resolves turns, which is the one row that would be alarming at any other value. Re-measured at Gen 213 against par as Gen 211 left it, and 4.95 turns a floor is still the number par is built on.'
    },
    {
        id: 'objective.floor_clear',
        verdict: 'changed',
        generation: 213,
        gone: ['exit is ready'],
        note: 'The in-run line at zero remaining pairs said "Next: exit is ready." There is no exit; a floor ends when the board does. It now says the floor is clear, and the phrase survives only in the comment recording that it went.'
    },

    // ---- The four traits. ----------------------------------------------------------------------
    {
        id: 'trait.echo',
        counter: 'trait.echo',
        verdict: 'changed',
        generation: 213,
        note: 'Occupancy 0.392 x 0.43, banded common. Pays in peek charges, a currency the run still spends. Gen 205: it was the rarest of the four at 0.342, because two of the three interaction couples spend Conduit and Stasis and the fill meant to even the floor out drew uniformly instead. Re-measured at Gen 213 and the fill is still holding it level with Heavy.'
    },
    {
        id: 'trait.heavy',
        counter: 'trait.heavy',
        verdict: 'changed',
        generation: 213,
        gone: ['never drains peek charges'],
        note: 'Its mismatch line promised "costs +1 extra try but never drains peek charges". Nothing in the game drains a peek charge on a mismatch, so the clause promised the absence of an impossible penalty. Cut; the true half stayed. Occupancy 0.404 x 0.44, which is the trait appearing about as often as Echo and rather less than the two lock traits.'
    },
    {
        id: 'trait.conduit',
        counter: 'trait.conduit',
        verdict: 'changed',
        generation: 213,
        gone: ['combo shard'],
        note: 'Its Echo payoff line, "Conduit + Echo: peek spark", was sorted into a lane called Shard and drawn on the card back as a combo shard - a currency removed in Gen 184. It reads Tool now, which is what a returned peek charge is. Occupancy 0.508 x 0.64, and no live source names the shard.'
    },
    {
        id: 'trait.stasis',
        counter: 'trait.stasis',
        verdict: 'confirmed',
        generation: 213,
        note: 'Occupancy 0.512 x 0.67, banded common and the most common of the four. Both its interaction lines land in the block lane, which is what a lock does, and the lane survived the Gen 202 cull on evidence rather than by being overlooked.'
    },

    // ---- The powers a player can press. --------------------------------------------------------
    {
        id: 'power.peek',
        counter: 'peek',
        verdict: 'confirmed',
        generation: 213,
        note: 'Occupancy 0.904 across whole runs, banded core, and it is the one run-scoped charge that clears that bar honestly: a run starts with a single peek and three of the floor curios grant another, so the charge keeps coming back. Read a floor at a time it was 1.000, which was true of 240 first floors rather than of a run (Gen 207).'
    },
    {
        id: 'power.pin',
        counter: 'pin',
        verdict: 'changed',
        generation: 213,
        note: 'Re-banded core to common. It read 1.000 while the census pressed it at floor open regardless of the board; pressed after a miss, where a pin has a reason, it reads 0.163 - the reference miss rate, at 0.23 pins a floor.'
    },
    {
        id: 'power.flash_pair',
        counter: 'flashPair',
        verdict: 'changed',
        generation: 213,
        note: 'Re-banded common to rare at Gen 207. A setup charge the run hands out once and never refills: 0.042 of the floors in a run, against the 0.158 a fresh-run-per-floor census reported. Rare is what a once-a-run charge is.'
    },
    {
        id: 'power.tile_swap',
        counter: 'tileSwap',
        verdict: 'changed',
        generation: 213,
        note: 'Stays core, but on evidence: 1.000 of floors at 1.00 a floor, because nearly every board deals a pair whose halves are not touching. Before, it was pressed unconditionally and read 1.000 by construction, which is the instrument agreeing with itself.'
    },
    {
        id: 'power.shuffle',
        counter: 'shuffle',
        verdict: 'changed',
        generation: 213,
        note: 'Re-banded core to common at Gen 207. It read 1.000 of floors on a census that built a fresh run for every floor; across a real run it is 0.196, because a run starts with one shuffle charge and only one floor curio grants another. Nothing about the tool changed - the band was describing the instrument. Gen 205 also moved the census press off the halfway mark, where a break that empties the board in one turn skips it entirely.'
    },
    {
        id: 'power.region_shuffle',
        counter: 'regionShuffle',
        verdict: 'confirmed',
        generation: 213,
        note: 'Occupancy 1.000 x 1.00, banded core - it sat at exactly 0.900 against a 0.900 bar until Gen 205 asked what the missing tenth was, and it was the census pressing at a moment a cascade can skip. It sets the same shuffle flag as the full shuffle, so the scholar-style objective catches it; checked against the rule rather than the field name.'
    },
    {
        id: 'power.undo_resolve',
        counter: 'undo',
        verdict: 'confirmed',
        generation: 213,
        note: 'Occupancy 0.475 x 0.47, banded common, and correctly bounded: undo only exists while a pair is resolving, so it cannot exceed the miss rate by much. The reference miss rate is 0.483 of floors, which is the ceiling it sits just under.'
    },
    {
        id: 'power.gambit',
        counter: 'gambit',
        verdict: 'confirmed',
        generation: 213,
        note: 'Occupancy 0.446 x 0.45, banded common. One third flip per floor, spent on the first miss, which is the only moment it can be spent - so its share tracks the chance a floor has a miss at all.'
    },
    {
        id: 'power.wild_match',
        counter: 'wildMatch',
        verdict: 'changed',
        generation: 213,
        note: 'Re-banded core to rare at Gen 207, and it is the clearest thing the run census found: the joker read 1.000 of floors because the census built a new setup run for every floor, and across a real run it is 0.042 - spent on floor one and never seen again, on all ten seeds. That is the setup sheet working exactly as written, one joker a run, so the power is unchanged and the claim about it is.'
    },

    // ---- The charges behind those powers. ------------------------------------------------------
    {
        id: 'inventory.peek_charge',
        verdict: 'confirmed',
        generation: 213,
        present: ['peekCharges'],
        note: 'Spent as a fall rather than read as a value, so an Echo refund mid-floor cannot hide a spend. That distinction is the reason the census reports charges the way it does, and the field is still the one the dock, the HUD announcement and the tool catalog all read.'
    },
    {
        id: 'inventory.shuffle_charge',
        verdict: 'confirmed',
        generation: 213,
        present: ['shuffleCharges'],
        note: 'One charge, one dock tool, one spend path; the run-shell tool catalog gate proves no charge field exists without a tool that spends it. Gen 213 re-checked the other direction too - the field is still read by the catalog, so the tool has not been left pointing at nothing.'
    },
    {
        id: 'inventory.region_shuffle_charge',
        verdict: 'confirmed',
        generation: 213,
        present: ['regionShuffleCharges'],
        note: 'Shared by the row shuffle and the tile swap, which is why the census gives them separate counter ids on separate passes rather than one row - and why a Scholar contract, which gates this field, forbids the swap as well as the two shuffles.'
    },
    {
        id: 'inventory.flash_pair_charge',
        counter: 'flashPair',
        verdict: 'confirmed',
        generation: 213,
        present: ['flashPairCharges'],
        note: 'Granted by a run setup rather than a plain endless run, which is exactly why the setup pass exists; its spend tracks the flash at 0.042 of the floors in a run. The field is still wired to the dock and to the arming sound.'
    },
    {
        id: 'inventory.undo_charge',
        verdict: 'confirmed',
        generation: 213,
        present: ['undoUsesThisFloor'],
        note: 'A per-floor budget rather than a run charge, and the field name says so. The one condition - a pair mid-resolution - is told to the player in the tool reason and taken by the dock from the same rule, so the button and the sentence cannot disagree.'
    },
    {
        id: 'inventory.gambit_token',
        verdict: 'confirmed',
        generation: 213,
        present: ['gambitAvailableThisFloor', 'gambitThirdFlipUsed'],
        note: 'A per-floor flag rather than a tally, read through the census as 0 or 1, because the gambit either happened on a floor or did not. Two fields carry it - whether the window is open and whether the flip was taken - and both are still written by the floor transition.'
    },
    {
        id: 'inventory.wild_match_token',
        verdict: 'confirmed',
        generation: 213,
        present: ['wildMatchesRemaining'],
        note: 'The token and the joker tile are two halves of one system and move together: the count the run carries is the count of joker matches left, and Gen 207 showed both landing on floor one of a setup run and nowhere else.'
    },
    {
        id: 'board.wild_joker_tile',
        verdict: 'confirmed',
        generation: 213,
        present: ['SINGLETON_UTILITY_PAIR_KEYS'],
        note: 'The last singleton in the game. Gen 196 removed the decoy, the exit, the lever and the shop door; the singleton key list is now exactly one key, pinned by a test, and Gen 213 re-read it to confirm the joker is still the only card in the game without a partner.'
    },

    // ---- Memory, board and floor. --------------------------------------------------------------
    {
        id: 'phase.memorize',
        verdict: 'confirmed',
        generation: 213,
        present: ['memorizeMs'],
        note: 'Exempt from the census by argument rather than omission: every floor opens with it, so a counter would read 1.00 on every row and prove nothing. What can be checked is that the window is still a run-creation value a mutator can move, which is what the mutator-effect audit presses it through.'
    },
    {
        id: 'hazard.magpie_thief',
        counter: 'magpieThefts',
        verdict: 'changed',
        generation: 213,
        note: 'Occupancy 0.013 across whole runs, banded rare, and until Gen 208 it had no counter at all and was not in the interaction graph - so the ledger claim to cover every system had never covered the one mechanic that takes finished work back off the player. The floor census reads it SILENT, true of 240 first floors and false of the game: the bird arrives on every third mismatch OF THE RUN, so a census that restarts every floor almost never reaches it. It is announced when it steals (Gen 113) and the graph now records that reader.'
    },
    {
        id: 'safety.softlock_fairness',
        verdict: 'confirmed',
        generation: 213,
        present: ['runSoftlockSeedGate'],
        note: 'A guarantee rather than an occurrence, so its gate is the softlock seed sweep - 0 issue floors across the endless health check - not an occupancy row. Re-run at Gen 213 against the boards Gen 205 redrew and the par Gen 211 set: still zero.'
    },
    {
        id: 'findable.score_glint',
        verdict: 'changed',
        generation: 213,
        gone: ['destroyText', 'forfeited by destroying the carrier'],
        note: 'Its reward row carried a field saying Destroy forfeits the score. Replaced with the rule that is true: a break which takes the carrier spills the glint and pays it. Gen 213 found the same dead promise a second time in the economy row for findable pickups and repointed it; Gen 214 found that row had no reader at all and removed it, so the rule now lives in one place rather than two.'
    },
    {
        id: 'objective.featured_streak',
        verdict: 'changed',
        generation: 213,
        gone: ['no shuffle, swap, or destroy'],
        note: 'The scholar-style objective told the player "no shuffle, swap, or destroy" while its rule watched one field. The field turned out to cover swap too, so only the dead third was cut - and Gen 213 found the same three-way phrasing still describing the Scholar preset in the mode-scope record, and cut it there too.'
    },
    {
        id: 'economy.score_and_rewards',
        verdict: 'changed',
        generation: 214,
        gone: ['stray-remove', 'RUN_ECONOMY_DEFINITIONS'],
        present: ['turn-match-scoring-summary-rules', 'level-clear-rules'],
        note: 'Gen 200 took the Destroy and Stray rows out of the economy projection rather than showing them at zero; Gen 213 read the rows that stayed and found both still describing sinks the game does not have - a pickup "forfeited by destroying the carrier", charges spent on "destroy" and "stray-remove". Gen 214 then asked who reads that projection and the answer was nobody: it hung off the dead Inventory screen model, and it is gone. The score itself is unaffected and always was somewhere else - the two modules named here are what the interaction graph has always cited as this mechanic.'
    },
    {
        id: 'stats.session_tracking',
        verdict: 'changed',
        generation: 213,
        gone: ['pairsDestroyed'],
        note: 'The destroyed-pairs stat could only ever be zero once Destroy left - it had no other writer. The field, its normalizer entry and the long-run feedback branch that listed "destroy pair" among a player’s actions are all gone, and no live source names it.'
    },

    // ---- Run shape, setup and persistence. -----------------------------------------------------
    {
        id: 'progression.run_flow',
        verdict: 'confirmed',
        generation: 213,
        present: ['createGameplayFloorAdvanceCommand'],
        note: 'Exempt from the census because it is the frame the census steps; a floor ends when the board is empty, proven by the endless simulation clearing 1.00 of floors at every miss rate. The advance is still one typed command rather than a screen between boards, which is what Gen 182 left.'
    },
    {
        id: 'progression.run_setup',
        verdict: 'changed',
        generation: 213,
        gone: ['initialStrayRemoveCharges'],
        present: ['CHAOS_MUTATORS'],
        note: 'A chaos setup granted a stray-remove charge alongside the joker. Stray is gone, so it grants the joker and the three chaos mutators - which is what a chaos run was for. Gen 213 re-checked the grant against the setup builder rather than against the sentence describing it.'
    },
    {
        id: 'mode.wild_run',
        verdict: 'changed',
        generation: 213,
        gone: ['stray-remove'],
        present: ['CHAOS_MUTATORS'],
        note: 'The one surviving setup flavour, and after Gen 111 it is a setup rather than a mode: the catalog now offers Classic and Pass and Play, and every preset row is the record of where its options went. Gen 213 found that record still crediting Wild with a stray-remove charge, three generations after the charge left, and corrected it to the joker and the three mutators the setup actually builds.'
    },
    {
        id: 'inventory.mutator_loadout',
        verdict: 'changed',
        generation: 213,
        gone: ['score_parasite'],
        present: ['MUTATOR_IDS'],
        note: 'Exempt from the census as a pre-floor choice, but its documentation still listed a mutator removed in Gen 183. The document now lists the ten in the id list and says why the eleventh went. Gen 209 went further and made every one of the ten prove it changes the game, so the loadout is covered by measurement as well as by inventory.'
    },
    {
        id: 'inventory.contract_loadout',
        verdict: 'changed',
        generation: 213,
        gone: ['noDestroy'],
        present: ['noShuffle'],
        note: 'The no-destroy clause went with Destroy, so a contract is a no-shuffle contract - and because the row-shuffle charge is what the tile swap spends, the one flag forbids board shuffle, row shuffle and swap alike. Gen 213 re-read the flag against what it gates rather than against its name, and repointed the last sentence that still said otherwise.'
    },
    {
        id: 'persistence.run_summary',
        verdict: 'confirmed',
        generation: 213,
        present: ['createValidatedGameOverRunSummary'],
        note: 'Written once when a run ends, so the floor census cannot see it; the save-field policy gate covers it instead, and no removed field is written back. The summary still goes through validation on the way out, which is what stops a run ending with a shape the save cannot read.'
    },

    // ---- The machinery around the game. --------------------------------------------------------
    {
        id: 'core.gameplay_commands',
        verdict: 'changed',
        generation: 213,
        present: ['GAMEPLAY_CONTENT_DEFINITIONS', 'definitions.length + 8', 'definitions.length + 7'],
        note: 'The simulation drew from a slot range with a dead slot in it after the destroy and stray commands left, wasting one pick in every n on nothing. The slots were compacted, and Gen 213 re-checked the arithmetic rather than the story: the range is the definition count plus eight and the last special slot is plus seven, so every slot in the range still reaches a command.'
    },
    {
        id: 'feedback.gameplay_hud',
        verdict: 'changed',
        generation: 213,
        gone: ['guard cache', 'patrol path'],
        note: 'Twenty-one branches of the in-run feedback rail watched for announcements the game cannot produce - guard caches, patrol paths, shop gold. Removed, and gated so no branch can outlive its announcement. Gen 212 then checked the rail the other way, laying the HUD out around the seven-digit score a sixty-floor run really carries rather than the three digits floor one produces.'
    },
    {
        id: 'simulation.gameplay_replay',
        verdict: 'confirmed',
        generation: 213,
        present: ['runGameplayCoreSimulation'],
        note: 'A tool for verifying the game rather than a rule in it. Its 384-step run stays deterministic and schema-clean after the command slots were compacted, and Gen 213 re-ran it against the redrawn floors and the new par to confirm the determinism is the simulation and not the boards it happened to be given.'
    },
    {
        id: 'simulation.build_evaluation',
        verdict: 'confirmed',
        generation: 213,
        present: ['runBalanceSimulation'],
        note: 'A tool for tuning rather than a rule. It is the thing that produced the re-bands in this ledger, which is the argument for exempting it from being censused by itself - but not from being checked: it still feeds the long-run depth gate, so a broken evaluator fails a gate rather than quietly agreeing with whatever it is asked.'
    },

    // ---- Systems the interaction graph does not model, checked anyway. --------------------------
    {
        id: 'surface.floor_identity_coaching',
        verdict: 'changed',
        generation: 213,
        gone: ['the parasite clock', 'finding the exit'],
        present: ['getFloorIdentityContract'],
        note: 'The four sentences a player reads on the floor they are standing on taught traps, disarms, keys, locks, guard, the parasite clock and finding the exit. Rewritten around what an archetype now decides: whether the suits are clumped, scattered or two-suit. The contract that supplies them is still the one the game screen reads.'
    },
    {
        id: 'surface.boss_identity',
        verdict: 'changed',
        generation: 213,
        gone: ['Favor', 'Keystone Pair'],
        note: 'It promised +2 Favor, a currency removed in Gen 175, and a Keystone Pair board anchor that exists nowhere in the game - in a string shown in the HUD title. Gen 201 fixed the constant and Gen 213 found the phantom anchor still being injected by the builder a real boss floor goes through, thirty lines below the comment saying it appears nowhere. The floor now lists the scattered deal, which is what a boss floor does to the board.'
    },
    {
        id: 'surface.trait_interaction_lanes',
        verdict: 'changed',
        generation: 213,
        gone: ['trait-lane-shard'],
        present: ['TraitInteractionLaneId'],
        note: 'Seven lanes for four interactions. The shard, guard and risk lanes went with their colours and their beat tiers - except on the board, which Gen 213 found still publishing all seven in its lane contract, cast to the lane id type to make it compile, and defaulting the audio cue to the shard the game lost in Gen 184. The score lane was being announced under a dead currency name. The contract is now the lane order itself and every lane names its own cue.'
    },
    {
        id: 'surface.codex',
        verdict: 'changed',
        generation: 213,
        gone: ['Destroy pair', 'Remove stray'],
        present: ['MECHANICS_GLOSSARY_TERMS'],
        note: 'Eleven entries still taught Destroy and Stray the day after both were removed: findables, powers, dense pickups, shifting spotlight, charges, perfect memory, recall focus, the scholar objective and the scholar contract. Gen 213 re-read the glossary against the powers that exist and found nothing left teaching either.'
    },
    {
        id: 'surface.audio',
        verdict: 'changed',
        generation: 213,
        gone: ['destroy-pair', 'stray-power'],
        present: ['SFX_SAMPLE_KEYS'],
        note: 'Two sampled effects and their manifest rows went with the powers that played them, along with the OGG and WAV files. The audio coverage gate confirms every remaining cue has a manifest entry and a file, and Gen 213 re-read the manifest: eleven entries, none of them named for a power that no longer exists.'
    },
    {
        id: 'surface.removed_powers',
        verdict: 'removed',
        generation: 213,
        gone: ['destroyPairCharges', 'strayRemoveCharges'],
        note: 'Destroy could never be pressed - no code path grants a charge - and Stray had only one legal target left, the wild joker, so pressing it deleted the player’s own wild match. Recorded in docs/REMOVED_POWERS.md, and Gen 213 re-greps both charge fields to prove the removal has not quietly come back.'
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

/**
 * Entries carrying no evidence a test can re-check: a sentence and nothing behind it.
 *
 * There is deliberately no exemption. A system argued exempt from the census - the memorize window,
 * the run frame, the tuning simulation - is exempt from being *counted*, not from being checked,
 * and each of the three names something whose presence says the argument still holds.
 */
export const unevidencedLedgerIds = (): string[] =>
    SYSTEM_REFINEMENT_LEDGER.filter(
        (entry) => !entry.counter && (entry.gone?.length ?? 0) === 0 && (entry.present?.length ?? 0) === 0
    ).map((entry) => entry.id);

/** Entries last walked before the current sweep: a verdict about a game that has since moved. */
export const staleLedgerIds = (): string[] =>
    SYSTEM_REFINEMENT_LEDGER.filter((entry) => entry.generation < SYSTEM_REFINEMENT_SWEEP_GENERATION).map(
        (entry) => entry.id
    );
