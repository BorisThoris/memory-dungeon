import {
    SHIFTING_BOUNTY_MATCH_BONUS,
    SHIFTING_WARD_MATCH_PENALTY,
    type BoardState,
    type RunState,
    type Tile
} from './contracts';
import { isBoardComplete } from './board-inspection';
import { hasMutator } from './mutators';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { DECOY_PAIR_KEY, WILD_PAIR_KEY } from './tile-identity';

export interface ShiftingSpotlightKeys {
    wardPairKey: string | null;
    bountyPairKey: string | null;
}

export interface RotatedShiftingSpotlight {
    board: BoardState;
    shiftingSpotlightNonce: number;
}

export interface AnchorSealPressureRotation extends RotatedShiftingSpotlight {
    anchorSealUsed: boolean;
}

/** Remaining real pairs that can still be matched (not both matched; no removed tile in pair). */
export const eligibleSpotlightPairKeys = (board: BoardState): string[] => {
    const groups = new Map<string, Tile[]>();
    for (const tile of board.tiles) {
        if (tile.pairKey === DECOY_PAIR_KEY || tile.pairKey === WILD_PAIR_KEY) {
            continue;
        }
        const list = groups.get(tile.pairKey) ?? [];
        list.push(tile);
        groups.set(tile.pairKey, list);
    }

    const keys: string[] = [];
    for (const [key, tiles] of groups) {
        if (tiles.some((tile) => tile.state === 'removed')) {
            continue;
        }
        if (tiles.every((tile) => tile.state === 'matched')) {
            continue;
        }
        keys.push(key);
    }
    return keys;
};

export const pickShiftingSpotlightKeys = (
    board: BoardState,
    runSeed: number,
    rulesVersion: number,
    level: number,
    step: 'init' | number
): ShiftingSpotlightKeys => {
    const keys = eligibleSpotlightPairKeys(board);
    if (keys.length === 0) {
        return { wardPairKey: null, bountyPairKey: null };
    }

    const stepTag = step === 'init' ? 'init' : String(step);
    const rng = createMulberry32(
        hashStringToSeed(`shiftSpotlight:${rulesVersion}:${runSeed}:${level}:${stepTag}`)
    );
    const shuffled = [...keys];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = pickRngIndex(rng, i + 1);
        const tmp = shuffled[i]!;
        shuffled[i] = shuffled[j]!;
        shuffled[j] = tmp;
    }

    if (shuffled.length === 1) {
        return { wardPairKey: null, bountyPairKey: shuffled[0]! };
    }
    return { wardPairKey: shuffled[0]!, bountyPairKey: shuffled[1]! };
};

export const shiftingSpotlightMatchDelta = (board: BoardState | undefined, matchedPairKey: string): number => {
    if (!board) {
        return 0;
    }

    let delta = 0;
    if (board.bountyPairKey === matchedPairKey) {
        delta += SHIFTING_BOUNTY_MATCH_BONUS;
    }
    if (board.wardPairKey === matchedPairKey) {
        delta -= SHIFTING_WARD_MATCH_PENALTY;
    }
    return delta;
};

export const rotateShiftingSpotlight = (
    run: RunState,
    board: BoardState,
    isBoardComplete: (board: BoardState) => boolean
): RotatedShiftingSpotlight => {
    const nonceBase = run.shiftingSpotlightNonce ?? 0;
    if (!hasMutator(run, 'shifting_spotlight')) {
        return { board, shiftingSpotlightNonce: nonceBase };
    }
    if (isBoardComplete(board)) {
        return { board, shiftingSpotlightNonce: nonceBase };
    }

    const nextNonce = nonceBase + 1;
    const { wardPairKey, bountyPairKey } = pickShiftingSpotlightKeys(
        board,
        run.runSeed,
        run.runRulesVersion,
        board.level,
        nextNonce
    );
    return {
        board: { ...board, wardPairKey, bountyPairKey },
        shiftingSpotlightNonce: nextNonce
    };
};

export const rotateRunShiftingSpotlight = (run: RunState, board: BoardState): RotatedShiftingSpotlight =>
    rotateShiftingSpotlight(run, board, isBoardComplete);

export const rotateAnchorSealPressure = (
    run: RunState,
    board: BoardState
): AnchorSealPressureRotation => {
    if (hasMutator(run, 'shifting_spotlight') && !isBoardComplete(board) && run.anchorSealChargesThisFloor > 0) {
        return {
            board,
            shiftingSpotlightNonce: run.shiftingSpotlightNonce ?? 0,
            anchorSealUsed: true
        };
    }

    return {
        ...rotateRunShiftingSpotlight(run, board),
        anchorSealUsed: false
    };
};
