import {
    INITIAL_RECALL_FOCUS,
    RECALL_FOCUS_MATCH_SCORE,
    RECALL_FOCUS_MAX,
    type RunState
} from './contracts';
import { runNonNegativeInteger } from './run-number-guards';

export const FORGOTTEN_TILE_LEDGER_LIMIT = 16;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const rememberForgottenTiles = (
    forgottenTileIdsThisFloor: readonly string[] | null | undefined,
    tileIds: readonly string[]
): string[] => {
    const ordered = [...(forgottenTileIdsThisFloor ?? [])];
    for (const id of tileIds) {
        if (!ordered.includes(id)) {
            ordered.push(id);
        }
    }
    return ordered.slice(-FORGOTTEN_TILE_LEDGER_LIMIT);
};

export const settleForgottenTiles = (
    forgottenTileIdsThisFloor: readonly string[],
    tileIds: readonly string[]
): string[] => {
    if (forgottenTileIdsThisFloor.length === 0) {
        return [...forgottenTileIdsThisFloor];
    }
    const settled = new Set(tileIds);
    return forgottenTileIdsThisFloor.filter((id) => !settled.has(id));
};

export const normalizeRecallFocus = (focus: number): number => clamp(runNonNegativeInteger(focus), 0, RECALL_FOCUS_MAX);

export const calculateRecallMatchBonus = (run: RunState): number =>
    normalizeRecallFocus(run.recallFocus) * RECALL_FOCUS_MATCH_SCORE;

export const increaseRecallFocus = (run: RunState): number => normalizeRecallFocus(run.recallFocus + 1);

export const decreaseRecallFocus = (run: RunState, amount = 1): number =>
    normalizeRecallFocus(run.recallFocus - amount);

export const getMemorizePhaseRecallFocus = (run: RunState): number => {
    const previous = run.lastLevelResult;
    if (!previous) {
        return INITIAL_RECALL_FOCUS;
    }

    const recallMatches = runNonNegativeInteger(previous.recallMatches);
    const recallMistakes = runNonNegativeInteger(previous.recallMistakes);
    return normalizeRecallFocus(
        recallMistakes > 0
            ? 0
            : recallMatches >= 2
              ? INITIAL_RECALL_FOCUS + 1
              : INITIAL_RECALL_FOCUS
    );
};
