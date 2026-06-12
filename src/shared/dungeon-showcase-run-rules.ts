import { type RunState } from './contracts';
import { countFindablePairs } from './board-tile-generation-rules';
import { buildBoard } from './board-build-rules';
import { createDungeonRunMapState } from './run-map';
import {
    createNewRun,
    type CreateRunOptions
} from './run-creation-rules';
import { finishMemorizePhase } from './memorize-phase-rules';

export const createDungeonShowcaseRun = (bestScore: number, extra: Partial<CreateRunOptions> = {}): RunState => {
    const runSeed = extra.runSeed ?? 72_001;
    const base = finishMemorizePhase(
        createNewRun(bestScore, {
            ...extra,
            gameMode: 'endless',
            practiceMode: true,
            dungeonShowcaseRun: true,
            runSeed,
            activeMutators: extra.activeMutators ?? ['wide_recall']
        })
    );
    const board = buildBoard(5, {
        activeMutators: base.activeMutators,
        dungeonNodeKind: 'combat',
        floorArchetypeId: 'survey_hall',
        floorTag: 'normal',
        gameMode: 'endless',
        runRulesVersion: base.runRulesVersion,
        runSeed
    });

    return {
        ...base,
        board,
        dungeonRun: createDungeonRunMapState(runSeed, base.runRulesVersion, 5),
        findablesTotalThisFloor: countFindablePairs(board.tiles),
        lastLevelResult: null
    };
};
