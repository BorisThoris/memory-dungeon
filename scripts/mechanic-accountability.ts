/**
 * Every mechanic the game declares has to answer for itself.
 *
 * The interaction graph names 45 mechanics. The occupancy census watches seven counters. Nothing
 * joined the two, and the gap is where this repo's most expensive failures have lived: the pop
 * shipped dead for six floors, the ripple went from 7% of breaks to zero and stayed there for
 * three generations, and the magpie has been taking back cleared pairs on every fourth miss with
 * no counter, no graph node and no test that it ever happens in a real run.
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
export const MECHANIC_CENSUS_COUNTERS: Record<string, readonly string[]> = {
    'board.chain_chunk_fever': ['chunkBreaksThisFloor', 'chunkPairsDroppedThisFloor', 'feverBreaksThisFloor'],
    'board.cleanup': ['matchResolutionsThisFloor'],
    'core.board_turn_resolution': ['matchResolutionsThisFloor'],
    'economy.score_and_rewards': ['recallMatchesThisFloor'],
    'findable.score_glint': ['findablesClaimedThisFloor'],
    'objective.floor_clear': ['matchResolutionsThisFloor'],
    'stats.session_tracking': ['recallMistakesThisFloor'],
    'power.peek': ['peekCharges'],
    'power.shuffle': ['shuffleCharges'],
    'power.region_shuffle': ['regionShuffleCharges'],
    'power.undo_resolve': ['undoUsesThisFloor'],
    'inventory.peek_charge': ['peekCharges'],
    'inventory.shuffle_charge': ['shuffleCharges'],
    'inventory.region_shuffle_charge': ['regionShuffleCharges'],
    'inventory.undo_charge': ['undoUsesThisFloor']
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
    'board.wild_joker_tile': 'Dealt only when the run setup asks for chaos; the census plays plain endless floors.',
    'core.gameplay_commands': 'The command bus every other mechanic runs on; counted by everything, so counting it says nothing.',
    'feedback.gameplay_hud': 'A projection of the run, not an event in it. Its coverage gate is the HUD audit.',
    'mode.wild_run': 'A run setup, chosen before the first floor: the census plays endless floors only.',
    'objective.featured_streak': 'Spans floors, and the census resets between them. Needs the run-level census (task Gen 150).',
    'persistence.run_summary': 'Written once when a run ends; the census plays floors, not runs.',
    'phase.memorize': 'Every floor opens with it, so a counter would read 1.00 on every row and prove nothing.',
    'progression.run_flow': 'The frame the census itself drives; it cannot observe the thing stepping it.',
    'progression.run_setup': 'Chosen before the run starts, outside every floor the census plays.',
    'safety.softlock_fairness': 'A guarantee, not an occurrence: its gate is the softlock seed sweep, which proves it never fails.',
    'simulation.build_evaluation': 'A tool for tuning the game, not a rule inside it.',
    'simulation.gameplay_replay': 'A tool for verifying the game, not a rule inside it.'
};

/** Prefixes whose mechanics are all invisible for the same reason: the census player never spends one. */
const REFERENCE_PLAYER_BLIND: ReadonlyArray<{ prefix: string; reason: string }> = [
    {
        prefix: 'power.',
        reason: 'Granted only by a run setup - Destroy, Stray Remove, Flash Pair, the pin, the gambit, the tile swap and the wild match all start a plain endless run at zero, so a census that reported them silent would be reporting its own setup.'
    },
    {
        prefix: 'inventory.',
        reason: 'The charge behind a power a plain endless run never hands out; it cannot be spent where the census plays.'
    },
    { prefix: 'trait.', reason: 'Traits pay on a match that touches them, and the census player picks pairs without reading traits.' }
];

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
    const censusKeys = new Set<string>(SYSTEM_OCCUPANCY_COUNTERS.map((counter) => counter.key));
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
