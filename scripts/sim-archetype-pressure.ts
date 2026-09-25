/**
 * Does a floor's archetype change how hard the floor is? Run: yarn sim:archetype-pressure [--check]
 *
 * The endless cycle is built out of eleven archetypes, and `pressureRoleForArchetype` sorts them into
 * five pacing jobs - baseline, pressure, reward, recovery, mystery. `sim:curve` reads the curve along
 * the floor number and `sim:cascade` reads it over all floors; neither reads it by archetype, so
 * until Gen 260 nothing in this repository had ever checked whether those five roles describe
 * anything the player experiences. They mostly did not.
 *
 * **The archetype is measured with the archetype as the only thing moving.** One board per floor and
 * seed, built with no mutators, the archetype id swapped and everything else - floor, seed, pair
 * count, objective - held. That matters, and the first reading of this that grouped *live* floors by
 * archetype got the answer backwards: an archetype that lands on shallow floors looks generous and
 * one that lands on deep floors looks tight, because turns-against-par rises with board size, and no
 * two archetypes sit on the same floors.
 *
 * Measured that way (Gen 260, thirty seeds, floors 18/22/30/42):
 *
 *   treasure_gallery 0.795   parasite_tithe 0.780   breather 0.778   shadow_read 0.775
 *   anchor_chain     0.769   script_room    0.767   survey_hall 0.758
 *   trap_hall        0.727   spotlight_hunt 0.716   rush_recall 0.711   speed_trial 0.697
 *
 * Every clumped archetype between 0.758 and 0.795, every narrow-palette one between 0.697 and 0.727,
 * and the split falls exactly on `SUIT_DEAL_PROFILE_BY_ARCHETYPE` rather than on the archetype id.
 * **The archetype is a label; its suit-deal profile is the whole of its difficulty.** Two of the
 * mutators that were supposed to differentiate the floors turned out to be measured in other
 * currencies entirely - `wide_recall` costs five score per match and `short_memorize` shortens the
 * memorize window, neither of which is a turn - and the magpie, which does cost turns, fires on 0.31
 * of the floors it rides and is worth 0.016 of par.
 *
 * Read by role, the cycle's pacing was upside down:
 *
 *   recovery 0.778    reward 0.795    mystery 0.767    baseline 0.758    pressure 0.739
 *
 * The floor whose job is to let a run heal spent MORE of its allowance than the average floor whose
 * job is to press, because the narrow palette - which Gen 259 established is the looser board
 * against its own par - had been handed out to `pressure` archetypes only. `SUIT_DEAL_PROFILE_BY_
 * ARCHETYPE` gives the breather two suits now and the band below is what holds it there.
 *
 * This gate deliberately does not band the individual archetypes against each other. They are within
 * noise of one another and saying otherwise would be inventing a structure the game does not have;
 * what it bands is the one claim the schedule makes out loud and can be held to.
 */
import { GAME_RULES_VERSION, type BoardState, type FloorArchetypeId, type RunState } from '../src/shared/contracts';
import { buildBoard } from '../src/shared/board-generation';
import { countFindablePairs } from '../src/shared/board-tile-generation-rules';
import { FLOOR_ARCHETYPE_CATALOG, pressureRoleForArchetype } from '../src/shared/floor-mutator-schedule';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from '../src/shared/game';
import { parTurnsForBoard } from '../src/shared/floor-par';
import { getUnresolvedPlayablePairGroups } from '../src/shared/playthrough-solver-rules';
import { createMulberry32, hashStringToSeed, pickRngIndex } from '../src/shared/rng';
import { SUIT_DEAL_PROFILE_BY_ARCHETYPE, boardPaletteWidth } from '../src/shared/tile-suit-rules';
import { isSingletonUtilityPairKey } from '../src/shared/tile-identity';
import { orderAroundLock } from '../src/shared/turn-match-board-cleanup-rules';

/** Both cards of the turn, the locked one second (`orderAroundLock`). */
const flipLockedLast = (run: RunState, first: { id: string }, second: { id: string }): RunState => {
    const [a, b] = orderAroundLock(run, first, second);
    return flipTile(flipTile(run, a.id), b.id);
};

export const ARCHETYPE_PRESSURE_SEEDS: readonly number[] = Array.from({ length: 30 }, (_, index) => 5001 + index * 211);

/**
 * The floors it builds on. Deep enough to be past `PAR_OPENING_FLOORS`, and spread over the pair
 * curve's whole upper range (16, 17, 19 and 22 pairs) so one board size cannot carry the reading.
 */
export const ARCHETYPE_PRESSURE_FLOORS: readonly number[] = [18, 22, 30, 42];

export const ARCHETYPE_PRESSURE_MISS_RATE = 0.15;

export interface ArchetypePressureRow {
    archetypeId: FloorArchetypeId;
    role: string;
    profile: string;
    suits: number;
    pairs: number;
    turns: number;
    par: number;
    /** Turns divided by par: how much of its allowance the floor costs. Higher is tighter. */
    ofPar: number;
    boards: number;
}

const playFloor = (board: BoardState, seed: number, tag: string): number => {
    const rng = createMulberry32(hashStringToSeed(`archetype:${seed}:${tag}:${ARCHETYPE_PRESSURE_MISS_RATE}`));
    let run: RunState = {
        ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: seed })),
        board,
        status: 'playing',
        findablesTotalThisFloor: countFindablePairs(board.tiles)
    };
    let turns = 0;
    while (run.status === 'playing' && turns < 120) {
        const groups = getUnresolvedPlayablePairGroups(run.board!).filter((group) =>
            group.every((tile) => tile.state === 'hidden' || tile.state === 'flipped')
        );
        if (groups.length === 0) break;
        const hidden = run.board!.tiles.filter(
            (tile) => tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey)
        );
        let first;
        let second;
        if (rng() < ARCHETYPE_PRESSURE_MISS_RATE && hidden.length >= 3) {
            first = hidden[pickRngIndex(rng, hidden.length)]!;
            const others = hidden.filter((tile) => tile.pairKey !== first!.pairKey);
            if (others.length === 0) break;
            second = others[pickRngIndex(rng, others.length)]!;
        } else {
            const group = groups[pickRngIndex(rng, groups.length)]!;
            [first, second] = [group[0]!, group[1]!];
        }
        run = resolveBoardTurn(flipLockedLast(run, first, second));
        turns += 1;
    }
    return turns;
};

const mean = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

export const simulateArchetypePressure = ({
    seeds = ARCHETYPE_PRESSURE_SEEDS,
    floors = ARCHETYPE_PRESSURE_FLOORS
}: { seeds?: readonly number[]; floors?: readonly number[] } = {}): ArchetypePressureRow[] =>
    (Object.keys(FLOOR_ARCHETYPE_CATALOG) as FloorArchetypeId[]).map((archetypeId) => {
        const ratios: number[] = [];
        const suits: number[] = [];
        const pairs: number[] = [];
        const turns: number[] = [];
        const pars: number[] = [];
        for (const floor of floors) {
            for (const seed of seeds) {
                // No mutators on any of them: the archetype is the only thing that differs.
                const board = buildBoard(floor, {
                    runSeed: seed,
                    runRulesVersion: GAME_RULES_VERSION,
                    gameMode: 'endless',
                    activeMutators: [],
                    floorTag: 'normal',
                    floorArchetypeId: archetypeId,
                    featuredObjectiveId: null,
                    cycleFloor: floor
                });
                const par = parTurnsForBoard(board);
                const taken = playFloor(board, seed, `${floor}:${archetypeId}`);
                ratios.push(par <= 0 ? 0 : taken / par);
                suits.push(boardPaletteWidth(board));
                pairs.push(board.pairCount);
                turns.push(taken);
                pars.push(par);
            }
        }
        return {
            archetypeId,
            role: pressureRoleForArchetype(archetypeId),
            profile: SUIT_DEAL_PROFILE_BY_ARCHETYPE[archetypeId],
            suits: mean(suits),
            pairs: mean(pairs),
            turns: mean(turns),
            par: mean(pars),
            ofPar: mean(ratios),
            boards: ratios.length
        };
    });

export const ARCHETYPE_PRESSURE_BANDS = {
    /**
     * The recovery floor may not cost a clean player more of its allowance than the average pressure
     * floor does. That is the one claim the archetype catalog makes out loud - the breather's own
     * hint is *"A calmer floor to steady the board and rebuild the chain"* and its risk profile is
     * *"Lower pressure"* - and it was false by 0.039 until Gen 260: recovery 0.778 against pressure
     * 0.739. The margin is what the fix bought, so the band sits at zero and the measurement has
     * room: recovery 0.682 against pressure 0.739, 0.057 the right way round.
     */
    recoveryHeadroom: 0,
    /** A role with no archetype in it means the role map and this gate have drifted apart. */
    requiredRoles: ['baseline', 'pressure', 'reward', 'recovery', 'mystery'] as const
} as const;

export const judgeArchetypePressure = (rows: readonly ArchetypePressureRow[]): string[] => {
    const issues: string[] = [];
    for (const role of ARCHETYPE_PRESSURE_BANDS.requiredRoles) {
        if (!rows.some((row) => row.role === role)) {
            issues.push(`no archetype carries the ${role} role, so this gate cannot read it`);
        }
    }
    const recovery = rows.filter((row) => row.role === 'recovery');
    const pressure = rows.filter((row) => row.role === 'pressure');
    if (recovery.length > 0 && pressure.length > 0) {
        const recoveryCost = mean(recovery.map((row) => row.ofPar));
        const pressureCost = mean(pressure.map((row) => row.ofPar));
        if (recoveryCost > pressureCost + ARCHETYPE_PRESSURE_BANDS.recoveryHeadroom) {
            issues.push(
                `the recovery floor is not a rest: ${recovery.map((row) => row.archetypeId).join(', ')} ` +
                    `spends ${recoveryCost.toFixed(3)} of its par against the ${pressure.length} pressure ` +
                    `archetypes' ${pressureCost.toFixed(3)}`
            );
        }
    }
    return issues;
};

const main = (): void => {
    const rows = simulateArchetypePressure();
    process.stdout.write('role      archetype          deal        suits  pairs  turns   par  of par\n');
    for (const row of [...rows].sort((a, b) => b.ofPar - a.ofPar)) {
        process.stdout.write(
            `${row.role.padEnd(9)} ${row.archetypeId.padEnd(18)} ${row.profile.padEnd(11)} ` +
                `${row.suits.toFixed(1)}   ${row.pairs.toFixed(1)}  ${row.turns.toFixed(1).padStart(5)} ` +
                `${row.par.toFixed(1).padStart(5)}   ${row.ofPar.toFixed(3)}\n`
        );
    }
    process.stdout.write('\nby pacing role (higher of par = tighter):\n');
    for (const role of ARCHETYPE_PRESSURE_BANDS.requiredRoles) {
        const group = rows.filter((row) => row.role === role);
        if (group.length === 0) continue;
        process.stdout.write(
            `  ${role.padEnd(9)} ${String(group.length).padStart(2)} archetype(s)  ` +
                `${mean(group.map((row) => row.ofPar)).toFixed(3)}\n`
        );
    }
    const issues = judgeArchetypePressure(rows);
    if (issues.length > 0) {
        process.stdout.write(`\nThe cycle's pacing moved:\n${issues.map((issue) => `- ${issue}`).join('\n')}\n`);
    }
    if (process.argv.includes('--check')) {
        if (issues.length > 0) {
            process.stderr.write('Archetype pressure check failed\n');
            process.exitCode = 1;
            return;
        }
        process.stdout.write('\nArchetype pressure check passed\n');
    }
};

if (process.argv[1]?.includes('sim-archetype-pressure')) {
    main();
}
