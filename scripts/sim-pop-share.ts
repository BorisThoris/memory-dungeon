/**
 * Pop share: how much of a floor the player matches by hand against what the pop takes. Run:
 * yarn sim:pop-share [--off]  (--off switches the heat perks off for a baseline).
 *
 * A perfect-memory player plays the scheduled floors, eight seeds, floors 1-24; per turn the pairs
 * the break took are bucketed by the heat carried into the turn. The measurement the owner asks
 * for before any pop tuning (docs/BALANCE_NOTES.md, 2026-09-23): matched share, not ladder steps.
 */
import { GAME_RULES_VERSION, type RunState } from '../src/shared/contracts';
import { buildBoard } from '../src/shared/board-generation';
import { countFindablePairs } from '../src/shared/board-tile-generation-rules';
import { filterMutatorsByContentLock } from '../src/shared/content-lock-state';
import { pickFloorScheduleEntry } from '../src/shared/floor-mutator-schedule';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from '../src/shared/game';
import { advanceToNextLevel } from '../src/shared/next-floor-transition-rules';
import { getUnresolvedPlayablePairGroups } from '../src/shared/playthrough-solver-rules';
import { comboHeatStage } from '../src/shared/combo-heat-rules';
import { COMBO_HEAT_PERKS } from '../src/shared/combo-heat-perks';
if (process.argv.includes('--off')) for (const key of Object.keys(COMBO_HEAT_PERKS)) Object.assign((COMBO_HEAT_PERKS as Record<string, object>)[key]!, { afterglow: 0, breakPairBonus: 0, breakReachBonus: 0 });
import { createMulberry32, hashStringToSeed, pickRngIndex } from '../src/shared/rng';
import { orderAroundLock } from '../src/shared/turn-match-board-cleanup-rules';

const seeds = [11, 202, 3003, 40404, 555, 6006, 77, 8888];
const floors = 24;
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
            run = resolveBoardTurn(flipTile(flipTile(run, a.id), b.id));
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
