import {
    INITIAL_RECALL_FOCUS,
    MAX_PENDING_MEMORIZE_BONUS_MS,
    MEMORIZE_BONUS_PER_LIFE_LOST_MS,
    RECALL_CLUE_MATCH_SCORE,
    RECALL_FOCUS_MATCH_SCORE,
    RECALL_FOCUS_MAX,
    type RouteNodeType,
    type RunState,
    type Tile
} from './contracts';

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

export const tileHasRecallClue = (tile: Tile): boolean =>
    tile.routeSpecialRevealed === true ||
    tile.lanternScouted === true ||
    tile.scoutRevealSource != null ||
    tile.dungeonCardState === 'revealed';

export const normalizeRecallFocus = (focus: number): number => clamp(focus, 0, RECALL_FOCUS_MAX);

export const calculateRecallMatchBonus = (run: RunState, tiles: readonly Tile[]): number => {
    if (run.gameMode === 'puzzle') {
        return 0;
    }
    const focusBonus = normalizeRecallFocus(run.recallFocus) * RECALL_FOCUS_MATCH_SCORE;
    const clueBonus = tiles.some(tileHasRecallClue) ? RECALL_CLUE_MATCH_SCORE : 0;
    return focusBonus + clueBonus;
};

export const increaseRecallFocus = (run: RunState): number => normalizeRecallFocus(run.recallFocus + 1);

export const decreaseRecallFocus = (run: RunState, amount = 1): number =>
    normalizeRecallFocus(run.recallFocus - amount);

export const addPendingMemorizeBonusForLostLives = (
    pendingMemorizeBonusMs: number,
    lostLives: number
): number =>
    lostLives <= 0
        ? pendingMemorizeBonusMs
        : Math.min(
              MAX_PENDING_MEMORIZE_BONUS_MS,
              pendingMemorizeBonusMs + MEMORIZE_BONUS_PER_LIFE_LOST_MS * lostLives
          );

export const getMemorizePhaseRecallFocusForRoute = (
    run: RunState,
    currentRouteType: RouteNodeType | null | undefined
): number => {
    if (run.gameMode === 'puzzle') {
        return INITIAL_RECALL_FOCUS;
    }

    const previous = run.lastLevelResult;
    if (!previous) {
        return INITIAL_RECALL_FOCUS;
    }

    const recallMatches = previous.recallMatches ?? 0;
    const recallMistakes = previous.recallMistakes ?? 0;
    let focus =
        recallMistakes > 0
            ? 0
            : recallMatches >= 2
              ? INITIAL_RECALL_FOCUS + 1
              : INITIAL_RECALL_FOCUS;

    if (currentRouteType === 'safe' && recallMistakes === 0) {
        focus += 1;
    } else if (currentRouteType === 'greed' && recallMistakes > 0) {
        focus -= 1;
    } else if (currentRouteType === 'mystery' && recallMistakes === 0 && (previous.recallBonusScore ?? 0) > 0) {
        focus += 1;
    }

    return normalizeRecallFocus(focus);
};
