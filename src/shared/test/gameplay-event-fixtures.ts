import { gameplayEventSchema, type GameplayEvent } from '../gameplay-core-contracts';
import type { BoardTurnAnnouncementFacts } from '../board-turn-event-facts';

const DEFAULT_ANNOUNCEMENT: BoardTurnAnnouncementFacts = {
    anchorTileIds: ['tile-a', 'tile-b'],
    level: 1,
    routeSpecialKind: null,
    routeCardKind: null,
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
    findablesTotalAfter: 0
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
        announcement: { ...DEFAULT_ANNOUNCEMENT, ...announcement }
    });
