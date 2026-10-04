import type { RunState } from './contracts';
import { reduceGodRun, type GodRunCommand } from './god-run-engine';

/** Keep profile depth and manual-memory records accurate without counting automated cards as remembered pairs. */
export const applyGodRunCommand = (run: RunState, command: GodRunCommand): RunState => {
    if (!run.godRun || run.status === 'paused' || run.status === 'gameOver') return run;
    const before=run.godRun, godRun=reduceGodRun(before,command);
    if(godRun===before) return run;
    const waveCleared=godRun.phase==='camp'||godRun.phase==='cleared';
    return {...run,godRun,status:godRun.phase==='failed'?'gameOver':'playing',
        runEndReason:godRun.phase==='failed'?'miss_budget':null,
        powersUsedThisRun:true,
        stats:{...run.stats,
            highestLevel:Math.max(run.stats.highestLevel,3+godRun.wave),
            levelsCleared:Math.max(run.stats.levelsCleared,3+Math.max(0,godRun.wave-(waveCleared?0:1))),
            matchesFound:run.stats.matchesFound+godRun.manualMatches-before.manualMatches,
            mismatches:run.stats.mismatches+godRun.manualMisses-before.manualMisses,
            currentStreak:godRun.combo,bestStreak:Math.max(run.stats.bestStreak,godRun.combo)
        }};
};
