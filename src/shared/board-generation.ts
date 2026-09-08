export {
    buildBoard,
    type BuildBoardOptions
} from './board-build-rules';
export {
    countFindablePairs
} from './board-tile-generation-rules';
export {
    boardHasGlassDecoy,
    boardHasActionableProgressionPair,
    countFullyHiddenPairs,
    getEffectivePrimaryExitLock,
    getWildTileIdFromBoard,
    inspectBoardFairness,
    inspectRunFairness,
    type BoardFairnessIssue,
    type BoardFairnessIssueCode,
    type BoardFairnessReport,
    type RunFairnessReport,
    isBoardComplete
} from './board-inspection';

