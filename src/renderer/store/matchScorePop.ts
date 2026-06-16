import type { RunState } from '../../shared/contracts';
import { getMatchFloaterAnchorTileIds, getMismatchFloaterAnchorTileIds } from '../../shared/turn-resolution';
import { routeSpecialLabel, routeSpecialRewardLine } from '../../shared/route-world';
import { formatTileTraitInteractionTags, resolveTileTraitEffects } from '../../shared/tile-trait-rules';

export type MatchScorePop = {
    amount: number;
    routeRewardText?: string;
    traitInteractionTexts?: string[];
    tileIdA: string;
    tileIdB: string;
    key: string;
};

export type MismatchScorePop = {
    tileIdA: string;
    tileIdB: string;
    /** Gambit triple-miss only — centroid anchor for GameScreen. */
    tileIdC?: string;
    traitInteractionTexts?: string[];
    key: string;
};

/** Spread into Zustand `set` / `useAppStore.setState` to clear both board floaters in one patch. */
export const BOARD_FLOATER_POP_CLEAR = {
    matchScorePop: null as MatchScorePop | null,
    mismatchScorePop: null as MismatchScorePop | null
};

const getTilesByIds = (run: RunState, tileIds: readonly string[]) =>
    tileIds
        .map((tileId) => run.board?.tiles.find((tile) => tile.id === tileId))
        .filter((tile): tile is NonNullable<RunState['board']>['tiles'][number] => tile != null);

const resolveTraitInteractionTexts = (
    run: RunState,
    tileIds: readonly string[],
    source: 'match' | 'mismatch'
): string[] => {
    if (!run.board) {
        return [];
    }
    const sourceTiles = getTilesByIds(run, tileIds);
    if (sourceTiles.length === 0) {
        return [];
    }
    return formatTileTraitInteractionTags(
        resolveTileTraitEffects({
            run,
            board: run.board,
            sourceTiles,
            source
        }).interactionTags
    );
};

/**
 * Pure payload for the floating +score floater after a successful match resolve.
 */
export function buildMatchScorePopPayload(
    run: RunState | null,
    next: RunState,
    keyNonce?: string
): MatchScorePop | null {
    if (!run?.board) {
        return null;
    }
    const anchor = getMatchFloaterAnchorTileIds(run);
    if (!anchor) {
        return null;
    }
    if (next.stats.matchesFound <= run.stats.matchesFound) {
        return null;
    }
    const amount = next.stats.totalScore - run.stats.totalScore;
    if (amount <= 0) {
        return null;
    }
    const { tileIdA, tileIdB } = anchor;
    const routeKind =
        run.board.tiles.find((tile) => tile.id === tileIdA)?.routeSpecialKind ??
        run.board.tiles.find((tile) => tile.id === tileIdB)?.routeSpecialKind ??
        run.board.tiles.find((tile) => tile.id === tileIdA)?.routeCardKind ??
        run.board.tiles.find((tile) => tile.id === tileIdB)?.routeCardKind ??
        null;
    const routeRewardText = routeKind ? `${routeSpecialLabel(routeKind)} ${routeSpecialRewardLine(routeKind)}` : undefined;
    const traitInteractionTexts = resolveTraitInteractionTexts(run, [tileIdA, tileIdB], 'match');
    const nonce = keyNonce ?? `${Date.now()}`;
    const key = `${run.board.level}-${nonce}-${tileIdA}-${tileIdB}`;
    const payload: MatchScorePop = { amount, tileIdA, tileIdB, key };
    if (routeRewardText) {
        payload.routeRewardText = routeRewardText;
    }
    if (traitInteractionTexts.length > 0) {
        payload.traitInteractionTexts = traitInteractionTexts;
    }
    return payload;
}

/**
 * Pure payload for the floating miss floater after a mismatch resolve.
 */
export function buildMismatchScorePopPayload(
    run: RunState | null,
    next: RunState,
    keyNonce?: string
): MismatchScorePop | null {
    if (!run?.board) {
        return null;
    }
    const anchor = getMismatchFloaterAnchorTileIds(run);
    if (!anchor) {
        return null;
    }
    if (next.stats.mismatches <= run.stats.mismatches) {
        return null;
    }
    const nonce = keyNonce ?? `${Date.now()}`;
    const { tileIdA, tileIdB, tileIdC } = anchor;
    const key = tileIdC
        ? `miss-${run.board.level}-${nonce}-${tileIdA}-${tileIdB}-${tileIdC}`
        : `miss-${run.board.level}-${nonce}-${tileIdA}-${tileIdB}`;
    const traitInteractionTexts = resolveTraitInteractionTexts(
        run,
        tileIdC ? [tileIdA, tileIdB, tileIdC] : [tileIdA, tileIdB],
        'mismatch'
    );
    const payload: MismatchScorePop = { tileIdA, tileIdB, key };
    if (tileIdC !== undefined) {
        payload.tileIdC = tileIdC;
    }
    if (traitInteractionTexts.length > 0) {
        payload.traitInteractionTexts = traitInteractionTexts;
    }
    return payload;
}
