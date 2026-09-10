/**
 * Every mechanic the game declares has to answer for itself.
 *
 * The interaction graph names the game's mechanics and the occupancy census watches its counters.
 * Nothing joined the two, and the gap is where this repo's most expensive failures have lived: the
 * pop shipped dead for six floors, and the ripple went from 7% of breaks to zero and stayed there
 * for three generations.
 *
 * The third example this comment used to give was the magpie - "taking back cleared pairs with no
 * counter, no graph node and no test that it ever happens in a real run". Gen 194 wrote that down
 * and left it there; Gen 208 closed it, and the closing is worth keeping because of how the bird
 * read once it was counted: SILENT across 240 floors of the floor census, 0.013 across whole runs.
 * It arrives on every third mismatch OF THE RUN, so an instrument that starts a new run every floor
 * cannot see it at all. A mechanic can be counted and still be invisible if the counting is done
 * over the wrong unit.
 *
 * None of those were bugs a unit test could see. Every one had passing tests, because a fixture is
 * built to make the rule fire, which is exactly what hides a rule that never fires on a real board.
 *
 * So this audit walks the graph and asks three questions of every mechanic:
 *
 * 1. **Does anything count it?** Either a `RunState` counter is in the occupancy census, or the
 *    mechanic is exempt with a written reason. An exemption is a debt with a name on it, not a
 *    pass: the list below is meant to shrink.
 * 2. **Does its evidence exist?** A mechanic pointing at a deleted module is a graph that lies,
 *    and a graph that lies is worse than no graph.
 * 3. **Does it carry tests, and do they exist?**
 *
 * Run it with `yarn audit:mechanic-accountability`. It is in `gate:systems`, so a new mechanic
 * cannot ship without answering, and a mechanic whose module is deleted cannot linger.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { gameplayInteractionGraph } from '../src/shared/gameplay-interaction-graph';
import { SYSTEM_OCCUPANCY_COUNTERS } from '../src/shared/system-occupancy-simulation';

const ROOT = resolve(import.meta.dirname, '..');

/**
 * Which census counter stands for which mechanic. A mechanic can share a counter with another -
 * the chain, the chunk and Fever are one node and three counters - but a counter that stands for
 * nothing is as bad as a mechanic that is counted by nothing.
 */
/**
 * Which census row each mechanic points at. The values are counter **ids**, not `RunState` field
 * names: since Gen 199 two passes can watch the same field for different systems - the tooled
 * player spends a row/swap charge on a row shuffle, the setup player spends the same charge on a
 * tile swap - so the field alone is not an identity.
 */
export const MECHANIC_CENSUS_COUNTERS: Record<string, readonly string[]> = {
    'board.chain_chunk_fever': ['chunkBreaks', 'chunkPairsDropped', 'feverBreaks'],
    'board.cleanup': ['matchResolutions'],
    'core.board_turn_resolution': ['matchResolutions'],
    'economy.score_and_rewards': ['recallMatches'],
    'findable.score_glint': ['findablesClaimed'],
    'objective.floor_clear': ['matchResolutions'],
    'stats.session_tracking': ['recallMistakes'],
    'hazard.magpie_thief': ['magpieThefts'],
    'power.peek': ['peek'],
    'power.shuffle': ['shuffle'],
    'power.region_shuffle': ['regionShuffle'],
    'power.undo_resolve': ['undo'],
    'inventory.peek_charge': ['peek'],
    'inventory.shuffle_charge': ['shuffle'],
    'inventory.region_shuffle_charge': ['regionShuffle'],
    'inventory.undo_charge': ['undo'],

    /* The setup pass (Gen 199): every mechanic a run setup puts on the board, and the traits. */
    'power.flash_pair': ['flashPair'],
    'power.wild_match': ['wildMatch'],
    'power.tile_swap': ['tileSwap'],
    'power.gambit': ['gambit'],
    'power.pin': ['pin'],
    'inventory.flash_pair_charge': ['flashPair'],
    'inventory.wild_match_token': ['wildMatch'],
    'inventory.gambit_token': ['gambit'],
    'board.wild_joker_tile': ['wildMatch'],
    'mode.wild_run': ['wildMatch'],
    'progression.run_setup': ['wildMatch'],
    'trait.echo': ['trait.echo'],
    'trait.heavy': ['trait.heavy'],
    'trait.conduit': ['trait.conduit'],
    'trait.stasis': ['trait.stasis']
};

/**
 * Mechanics the census cannot reach, each with the reason, because "why is this uncounted" is the
 * whole question. Every line here is work someone has not done yet.
 *
 * The big one is the reference player. The census plays real generated floors, but it only ever
 * flips pairs: it never spends a charge, never arms a power, never picks a loadout. So every power
 * and every inventory charge is invisible to it - not because the game does not have them, but
 * because the thing playing the game does not use them. Fixing that means a census player that
 * spends its charges, which is its own generation.
 */
export const MECHANIC_CENSUS_EXEMPTIONS: Record<string, string> = {
    'core.gameplay_commands': 'The command bus every other mechanic runs on; counted by everything, so counting it says nothing.',
    'feedback.gameplay_hud': 'A projection of the run, not an event in it. Its coverage gate is the HUD audit.',
    'objective.featured_streak': 'Spans floors, and the census resets between them. Needs the run-level census (task Gen 150).',
    'persistence.run_summary': 'Written once when a run ends; the census plays floors, not runs.',
    'phase.memorize': 'Every floor opens with it, so a counter would read 1.00 on every row and prove nothing.',
    'progression.run_flow': 'The frame the census itself drives; it cannot observe the thing stepping it.',
    'safety.softlock_fairness': 'A guarantee, not an occurrence: its gate is the softlock seed sweep, which proves it never fails.',
    'simulation.build_evaluation': 'A tool for tuning the game, not a rule inside it.',
    'simulation.gameplay_replay': 'A tool for verifying the game, not a rule inside it.',
    'inventory.contract_loadout': 'A run setup, chosen before the first floor and unchanged by any of them.',
    'inventory.mutator_loadout': 'A run setup, chosen before the first floor; what it selects is censused, it is not.'
};

/*
 * The blanket blind-spot list is empty as of Gen 199, and the empty list is the point.
 *
 * It used to carry three prefixes - `power.`, `inventory.` and `trait.` - which between them
 * excused eighteen of the game's forty-five mechanics from ever answering for themselves. That is
 * not an exemption list, it is a debt register: every line said "the thing playing the game does
 * not use this", which is a statement about the census rather than about the game.
 *
 * Gen 199 paid it off by giving the census a third player - one that starts from a run setup and
 * presses what the setup hands it. Every one of those eighteen now has a counter or an individual,
 * argued line above. The prefix mechanism stays because the next family of mechanics may earn one,
 * and an empty list is easier to defend than a missing one.
 */
const REFERENCE_PLAYER_BLIND: ReadonlyArray<{ prefix: string; reason: string }> = [];

const blindReason = (id: string): string | null =>
    MECHANIC_CENSUS_COUNTERS[id]
        ? null
        : REFERENCE_PLAYER_BLIND.find((entry) => id.startsWith(entry.prefix))?.reason ?? null;

export interface MechanicAccountabilityFinding {
    id: string;
    problem: string;
}

export const auditMechanicAccountability = (): MechanicAccountabilityFinding[] => {
    const findings: MechanicAccountabilityFinding[] = [];
    const censusKeys = new Set<string>(SYSTEM_OCCUPANCY_COUNTERS.map((counter) => counter.id));
    const claimed = new Set<string>();

    for (const mechanic of gameplayInteractionGraph.mechanics) {
        const counters = MECHANIC_CENSUS_COUNTERS[mechanic.id];
        const exemption = MECHANIC_CENSUS_EXEMPTIONS[mechanic.id] ?? blindReason(mechanic.id);

        if (counters && exemption) {
            findings.push({ id: mechanic.id, problem: 'is both censused and exempt; pick one' });
        }
        if (!counters && !exemption) {
            findings.push({
                id: mechanic.id,
                problem: 'has no census counter and no written exemption - nothing proves it ever happens'
            });
        }
        for (const key of counters ?? []) {
            claimed.add(key);
            if (!censusKeys.has(key)) {
                findings.push({ id: mechanic.id, problem: `names census counter "${key}", which the census does not watch` });
            }
        }
        for (const path of mechanic.evidence) {
            if (!existsSync(resolve(ROOT, path))) {
                findings.push({ id: mechanic.id, problem: `points at evidence that does not exist: ${path}` });
            }
        }
        if (mechanic.tests.length === 0) {
            findings.push({ id: mechanic.id, problem: 'carries no tests' });
        }
        for (const path of mechanic.tests) {
            if (!existsSync(resolve(ROOT, path))) {
                findings.push({ id: mechanic.id, problem: `points at a test that does not exist: ${path}` });
            }
        }
    }

    for (const key of censusKeys) {
        if (!claimed.has(key)) {
            findings.push({ id: key, problem: 'is censused but stands for no mechanic in the graph' });
        }
    }

    const declared = new Set(gameplayInteractionGraph.mechanics.map((mechanic) => mechanic.id));
    for (const id of [...Object.keys(MECHANIC_CENSUS_COUNTERS), ...Object.keys(MECHANIC_CENSUS_EXEMPTIONS)]) {
        if (!declared.has(id)) {
            findings.push({ id, problem: 'is listed here but is not a mechanic in the graph any more' });
        }
    }

    return findings;
};

const main = (): void => {
    const findings = auditMechanicAccountability();
    const total = gameplayInteractionGraph.mechanics.length;
    const censused = Object.keys(MECHANIC_CENSUS_COUNTERS).length;
    const exempt = gameplayInteractionGraph.mechanics.filter(
        (mechanic) => MECHANIC_CENSUS_EXEMPTIONS[mechanic.id] != null || blindReason(mechanic.id) != null
    ).length;

    console.log(`mechanics: ${total}  censused: ${censused}  exempt: ${exempt}  unanswered: ${total - censused - exempt}`);
    for (const finding of findings) {
        console.log(`  ${finding.id}: ${finding.problem}`);
    }
    if (findings.length > 0) {
        console.error(`\nMechanic accountability failed: ${findings.length} finding(s).`);
        process.exitCode = 1;
        return;
    }
    console.log('Every mechanic answers for itself');
};

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/gu, '/').split('/').pop() ?? '')) {
    main();
}
