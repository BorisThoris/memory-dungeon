import { gameplayEventSchema, type GameplayEvent } from '../gameplay-core-contracts';
import type { BoardTurnAnnouncementFacts } from '../board-turn-event-facts';

const DEFAULT_ANNOUNCEMENT: BoardTurnAnnouncementFacts = {
    anchorTileIds: ['tile-a', 'tile-b'],
    level: 1,
    currentStreakBefore: 0,
    currentStreakAfter: 1,
    comboShardsBefore: 0,
    comboShardsAfter: 0,
    guardTokensBefore: 0,
    guardTokensAfter: 0,
    livesBefore: 3,
    livesAfter: 3,
    findablesClaimedBefore: 0,
    findablesClaimedAfter: 0,
    findablesTotalBefore: 0,
    findablesTotalAfter: 0,
    chunkBreaksBefore: 0,
    chunkBreaksAfter: 0,
    chunkPairsBrokenBefore: 0,
    chunkPairsBrokenAfter: 0,
    chainAfter: 0,
    chainTierAfter: 'none' as const,
    chainTierBefore: 'none' as const,
    chunkPartnerSpanMax: 0,
    chunkHaloPairs: 0,
    chunkSuitCleared: false,
    chunkDroppedPairs: 0,
    chunkRippleWaves: 0,
    magpieTheftsBefore: 0,
    magpieTheftsAfter: 0,
    magpieScaredOffBefore: 0,
    magpieScaredOffAfter: 0,
    matchedTraitKinds: [],
    shuffleChargesBefore: 0,
    shuffleChargesAfter: 0,
    regionShuffleChargesBefore: 0,
    regionShuffleChargesAfter: 0,
    stickyBlockIndexBefore: null,
    stickyBlockIndexAfter: null,
    matchedPairsBefore: 0,
    matchedPairsAfter: 0,
    pairTotal: 0,
    mismatchesBefore: 0,
    mismatchesAfter: 0,
    volatileTraitShufflesBefore: 0,
    volatileTraitShufflesAfter: 0
};

export interface BoardTurnResolvedEventFixtureOverrides {
    commandId: string;
    sequence?: number;
    outcome?: 'match' | 'mismatch' | 'gambit_match' | 'gambit_mismatch';
    flippedTileIds?: string[];
    matchedPairKey?: string | null;
    boardComplete?: boolean;
    statusBefore?: 'memorize' | 'playing' | 'resolving' | 'paused' | 'levelComplete' | 'gameOver';
    statusAfter?: 'memorize' | 'playing' | 'resolving' | 'paused' | 'levelComplete' | 'gameOver';
    livesBefore?: number;
    livesAfter?: number;
    totalScoreBefore?: number;
    totalScoreAfter?: number;
    triesBefore?: number;
    triesAfter?: number;
    matchesBefore?: number;
    matchesAfter?: number;
    findablesClaimedBefore?: number;
    findablesClaimedAfter?: number;
    findablesTotalBefore?: number;
    findablesTotalAfter?: number;
    matchedFindableKind?: 'shard_spark' | 'score_glint' | null;
    announcement?: Partial<BoardTurnAnnouncementFacts>;
}

/**
 * A schema-valid `board.turn_resolved` event for tests that need a resolved turn
 * without driving a whole run to produce one. Defaults describe an ordinary
 * successful match; override only the fields a given assertion cares about.
 *
 * Parsed through gameplayEventSchema so a fixture can never drift out of sync with
 * the contract it is standing in for.
 */
export const createBoardTurnResolvedEventFixture = ({
    commandId,
    sequence = 0,
    outcome = 'match',
    flippedTileIds = ['tile-a', 'tile-b'],
    matchedPairKey = 'pair-a',
    boardComplete = false,
    statusBefore = 'resolving',
    statusAfter = 'playing',
    livesBefore = 3,
    livesAfter = 3,
    totalScoreBefore = 0,
    totalScoreAfter = 10,
    triesBefore = 0,
    triesAfter = 0,
    matchesBefore = 0,
    matchesAfter = 1,
    findablesClaimedBefore = 0,
    findablesClaimedAfter = 0,
    findablesTotalBefore = 0,
    findablesTotalAfter = 0,
    matchedFindableKind = null,
    announcement
}: BoardTurnResolvedEventFixtureOverrides): GameplayEvent =>
    gameplayEventSchema.parse({
        schemaVersion: 1,
        commandId,
        eventId: `${commandId}:${sequence}`,
        sequence,
        source: { kind: 'system', id: 'board_turn' },
        type: 'board.turn_resolved',
        outcome,
        flippedTileIds,
        matchedPairKey,
        boardComplete,
        statusBefore,
        statusAfter,
        livesBefore,
        livesAfter,
        totalScoreBefore,
        totalScoreAfter,
        triesBefore,
        triesAfter,
        matchesBefore,
        matchesAfter,
        findablesClaimedBefore,
        findablesClaimedAfter,
        findablesTotalBefore,
        findablesTotalAfter,
        matchedFindableKind,
        announcement: { ...DEFAULT_ANNOUNCEMENT, ...announcement }
    });
