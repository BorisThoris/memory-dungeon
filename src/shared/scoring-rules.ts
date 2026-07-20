import {
    MATCH_DELAY_MS,
    MEMORIZE_BASE_MS,
    MEMORIZE_DECAY_EVERY_N_LEVELS,
    MEMORIZE_MIN_MS,
    MEMORIZE_STEP_MS,
    type Rating,
    type RunState,
    type Tile
} from './contracts';
import { getActiveDungeonBossPressureRule } from './dungeon-boss-rules';
import { hasMutator } from './mutators';
import { DECOY_PAIR_KEY, isWildPairKey } from './tile-identity';

const ECHO_EXTRA_RESOLVE_MS = 380;

/** Documented in `docs/BALANCE_NOTES.md` (presentation mutator match penalties). */
export const PRESENTATION_MUTATOR_MATCH_PENALTIES = {
    wide_recall: 5,
    silhouette_twist: 5,
    distraction_channel: 4
} as const;

export const getPresentationMutatorMatchPenalty = (run: RunState): number => {
    let penalty = 0;
    if (hasMutator(run, 'wide_recall')) {
        penalty += PRESENTATION_MUTATOR_MATCH_PENALTIES.wide_recall;
    }
    if (hasMutator(run, 'silhouette_twist')) {
        penalty += PRESENTATION_MUTATOR_MATCH_PENALTIES.silhouette_twist;
    }
    if (hasMutator(run, 'distraction_channel')) {
        penalty += PRESENTATION_MUTATOR_MATCH_PENALTIES.distraction_channel;
    }
    return penalty;
};

export const getMemorizeDuration = (level: number): number => {
    const decaySteps = Math.floor(Math.max(level - 1, 0) / MEMORIZE_DECAY_EVERY_N_LEVELS);
    return Math.max(MEMORIZE_MIN_MS, MEMORIZE_BASE_MS - MEMORIZE_STEP_MS * decaySteps);
};

export const getMemorizeDurationForRun = (run: RunState, level: number): number => {
    let ms = getMemorizeDuration(level);
    if (hasMutator(run, 'short_memorize')) {
        ms = Math.max(MEMORIZE_MIN_MS, ms - 350);
    }
    if (run.relicIds.includes('memorize_bonus_ms')) {
        ms += 280;
    }
    if (run.relicIds.includes('memorize_under_short_memorize') && hasMutator(run, 'short_memorize')) {
        ms += 220;
    }
    if (run.gameMode === 'meditation') {
        ms = Math.floor(ms * 1.55);
    }
    const bossPressure = getActiveDungeonBossPressureRule(run.board);
    if (bossPressure && run.board?.floorTag === 'boss') {
        ms = Math.max(MEMORIZE_MIN_MS, ms + bossPressure.memorizeMsDelta);
    }
    return ms;
};

export const calculateRating = (tries: number): Rating => {
    if (tries === 0) return 'S++';
    if (tries === 1) return 'S';
    if (tries === 2) return 'A';
    if (tries <= 4) return 'B';
    if (tries <= 6) return 'C';
    if (tries <= 8) return 'D';
    return 'F';
};

export const calculateMatchScore = (
    level: number,
    currentStreak: number,
    multiplier: number = 1
): number => {
    const levelOffset = typeof level === 'number' && Number.isFinite(level) ? Math.max(level - 1, 0) : 0;
    const streak = typeof currentStreak === 'number' && Number.isFinite(currentStreak) ? Math.max(currentStreak, 0) : 0;
    const scoreMultiplier = typeof multiplier === 'number' && Number.isFinite(multiplier) ? Math.max(0, multiplier) : 1;
    return Math.floor((20 + 5 * levelOffset + 10 * streak) * scoreMultiplier);
};

/** Exported for UI resolving highlights (gambit 3-flip) - keep in sync with `resolveGambitThree`. */
export const tilesArePairMatch = (a: Tile, b: Tile): boolean => {
    if (a.pairKey === b.pairKey && a.pairKey !== DECOY_PAIR_KEY) {
        return true;
    }
    if (a.pairKey === DECOY_PAIR_KEY || b.pairKey === DECOY_PAIR_KEY) {
        return false;
    }
    if (isWildPairKey(a.pairKey) && !isWildPairKey(b.pairKey)) {
        return true;
    }
    if (isWildPairKey(b.pairKey) && !isWildPairKey(a.pairKey)) {
        return true;
    }
    return false;
};

/** Effective delay after two tiles are flipped (0 if immediate match). */
export const computeFlipResolveDelayMs = (
    run: RunState,
    flippedTileIds: string[],
    opts: { resolveDelayMultiplier: number; echoFeedbackEnabled: boolean }
): number => {
    if (flippedTileIds.length !== 2 || !run.board) {
        return 0;
    }
    const [firstId, secondId] = flippedTileIds;
    const firstTile = run.board.tiles.find((t) => t.id === firstId);
    const secondTile = run.board.tiles.find((t) => t.id === secondId);
    if (!firstTile || !secondTile) {
        return 0;
    }
    if (tilesArePairMatch(firstTile, secondTile)) {
        return 0;
    }
    let ms = MATCH_DELAY_MS * opts.resolveDelayMultiplier;
    if (opts.echoFeedbackEnabled) {
        ms += ECHO_EXTRA_RESOLVE_MS;
    }
    return ms;
};

export const calculateLevelClearBonus = (level: number): number => 50 * level;

export const calculatePerfectClearBonus = (): number => 25;
