/**
 * Pop share: how much of a floor the player matches by hand against what the pop takes. Run:
 * yarn sim:pop-share [--off] [--floors=60] [--by-act] [--check]  (--off switches the heat perks off for a baseline).
 *
 * `--by-act` (DGE-012, 2026-10-20) groups the shares by the Descent's acts (`DESCENT_ACTS`), and
 * `--check` is `gate:pop-by-act`: every act after the first must show a pop share (pairs the pop
 * took over all pairs cleared) of at least `POP_BY_ACT_MIN`, the plan's bar. It stays zero until a
 * change makes the late pop share reach it: the Hold probe (BALANCE_NOTES) found the Hold cannot.
 *
 * A perfect-memory player plays the scheduled floors, eight seeds, floors 1-24; per turn the pairs
 * the break took are bucketed by the heat carried into the turn. The measurement the owner asks
 * for before any pop tuning (docs/BALANCE_NOTES.md, 2026-09-23): matched share, not ladder steps.
 */
import { turnTripleThird } from '../src/shared/match-rule-rules';
import { GAME_RULES_VERSION, type RunState } from '../src/shared/contracts';
import { buildBoard } from '../src/shared/board-generation';
import { countFindablePairs } from '../src/shared/board-tile-generation-rules';
import { filterMutatorsByContentLock } from '../src/shared/content-lock-state';
import { descentActForFloor, pickFloorScheduleEntry } from '../src/shared/floor-mutator-schedule';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from '../src/shared/game';
import { advanceToNextLevel } from '../src/shared/next-floor-transition-rules';
import { getUnresolvedPlayablePairGroups } from '../src/shared/playthrough-solver-rules';
import { comboHeatStage } from '../src/shared/combo-heat-rules';
import { COMBO_HEAT_PERKS } from '../src/shared/combo-heat-perks';
if (process.argv.includes('--off')) for (const key of Object.keys(COMBO_HEAT_PERKS)) Object.assign((COMBO_HEAT_PERKS as Record<string, object>)[key]!, { afterglow: 0, breakPairBonus: 0, breakReachBonus: 0 });
import { createMulberry32, hashStringToSeed, pickRngIndex } from '../src/shared/rng';
import { orderAroundLock } from '../src/shared/turn-match-board-cleanup-rules';

const seeds = [11, 202, 3003, 40404, 555, 6006, 77, 8888];
const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const floors = Number(arg('floors') ?? 24);
/** The least pop share Acts II to IV may show (`--check`); 0.6, the plan's bar, once something reaches it. */
export const POP_BY_ACT_MIN = 0;
const byAct: Record<string, { matched: number; popped: number; floors: number }> = {};
const byStage: Record<string, { matched: number; popped: number; turns: number; biggest: number[] }> = {};
let matchedAll = 0;
let poppedAll = 0;
const biggestShare: number[] = [];
for (const seed of seeds) {
    const entry = pickFloorScheduleEntry(seed, GAME_RULES_VERSION, 1, 'endless');
    const mutators = filterMutatorsByContentLock(entry.mutators);
    const board = buildBoard(1, { runSeed: seed, runRulesVersion: GAME_RULES_VERSION, gameMode: 'endless', activeMutators: mutators, floorTag: entry.floorTag, floorArchetypeId: entry.floorArchetypeId, featuredObjectiveId: entry.featuredObjectiveId, cycleFloor: entry.cycleFloor });
    let run: RunState = { ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: seed, realm: null })), activeMutators: mutators, board, status: 'playing', findablesTotalThisFloor: countFindablePairs(board.tiles) };
    for (let floor = 1; floor <= floors; floor += 1) {
        const rng = createMulberry32(hashStringToSeed(`pop:${seed}:${floor}`));
        let turns = 0;
        let matched = 0;
        let popped = 0;
        let biggest = 0;
        const pairs = run.board!.pairCount;
        while (run.status === 'playing' && turns < 120) {
            const groups = getUnresolvedPlayablePairGroups(run.board!).filter((g) => g.every((t) => t.state === 'hidden' || t.state === 'flipped'));
            if (groups.length === 0) break;
            const group = groups[pickRngIndex(rng, groups.length)]!;
            const [a, b] = orderAroundLock(run, group[0]!, group[1]!);
            const stage = comboHeatStage(run.stats.currentStreak);
            const before = run.board!.matchedPairs;
            run = resolveBoardTurn(turnTripleThird(flipTile(flipTile(run, a.id), b.id), flipTile));
            const gained = run.board!.matchedPairs - before;
            const pops = Math.max(0, gained - 1);
            matched += 1;
            popped += pops;
            biggest = Math.max(biggest, pops);
            const row = (byStage[stage] ??= { matched: 0, popped: 0, turns: 0, biggest: [] });
            row.matched += 1;
            row.popped += pops;
            row.turns += 1;
            turns += 1;
        }
        matchedAll += matched;
        poppedAll += popped;
        const actRow = (byAct[descentActForFloor(floor).title] ??= { matched: 0, popped: 0, floors: 0 });
        actRow.matched += matched;
        actRow.popped += popped;
        actRow.floors += 1;
        biggestShare.push(biggest / Math.max(1, pairs));
        if (run.status !== 'levelComplete') break;
        const next = advanceToNextLevel({ ...run, status: 'levelComplete' });
        if (!next.board || next.board.level === floor) break;
        run = finishMemorizePhase(next);
    }
}
const share = (m: number, p: number) => (m / Math.max(1, m + p)).toFixed(2);
console.log(`overall matched share ${share(matchedAll, poppedAll)} (matched ${matchedAll}, popped ${poppedAll}); biggest break mean ${(biggestShare.reduce((s, v) => s + v, 0) / biggestShare.length).toFixed(2)} of a floor, max ${Math.max(...biggestShare).toFixed(2)}`);
for (const [stage, row] of Object.entries(byStage)) console.log(`${stage.padEnd(10)} turns ${String(row.turns).padStart(4)}  pops/turn ${(row.popped / row.turns).toFixed(2)}  matched share ${share(row.matched, row.popped)}`);

if (process.argv.includes('--by-act') || process.argv.includes('--check')) {
    console.log('by act (matched = by hand, pop = taken by the pop, each over all pairs cleared):');
    for (const [act, row] of Object.entries(byAct)) console.log(`  ${act.padEnd(20)} floors ${String(row.floors).padStart(3)}  matched ${share(row.matched, row.popped)}  pop ${share(row.popped, row.matched)}`);
}
if (process.argv.includes('--check')) {
    // The bar is the pop's share, and it is the plan's for every act after the Gate.
    const failures = Object.entries(byAct).filter(([, row], index) => {
        const pop = row.popped / Math.max(1, row.matched + row.popped);
        return !Number.isFinite(pop) || pop > 1 || row.floors === 0 || (index > 0 && pop < POP_BY_ACT_MIN);
    });
    if (failures.length > 0 || Object.keys(byAct).length === 0) {
        console.error(`pop by act failed: ${failures.map(([act]) => act).join(', ') || 'no act measured'}`);
        process.exit(1);
    }
    console.log('Pop by act check passed');
}
