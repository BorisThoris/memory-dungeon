import { describe, expect, it } from 'vitest';
import type { BoardState, RunState } from '../../shared/contracts';
import { getBoardTurnAnnouncementFacts } from '../../shared/board-turn-event-facts';
import { resolveTileTraitEffects } from '../../shared/tile-trait-rules';
import type { BoardTurnResolvedEvent } from './gameplayFeedbackAdapter';
import {
    buildMatchScorePopImpactCue,
    buildMatchScorePopCrescendo,
    buildMatchScorePopPayload,
    buildMatchScorePopPayoffLaneMap,
    buildMatchScorePopPayoffSummary,
    buildMismatchScorePopPayload,
    getMatchScorePopChainMilestone,
    getMatchScorePopFeedbackProfile,
    getMatchScorePopSignal
} from './matchScorePop';

const minimalRun = (partial: Partial<RunState>): RunState =>
    ({
        stats: {
            matchesFound: 0,
            totalScore: 0,
            tries: 0,
            comboShards: 0,
            rating: '',
            highestLevel: 1,
            currentLevelScore: 0,
            bestScore: 0,
            currentStreak: 0,
            bestStreak: 0,
            levelsCleared: 0,
            mismatches: 0,
            guardTokens: 0
        },
        relicIds: [],
        board: null,
        ...partial
    }) as RunState;


/**
 * Builds the board.turn_resolved event the core would emit for a before/after run pair,
 * using the core's own getBoardTurnAnnouncementFacts. These tests then exercise the
 * event-only builders against a faithful event instead of a hand-rolled stub.
 */
const formatSourceTraitTags = (run: RunState, source: 'match' | 'mismatch'): string[] => {
    const board = run.board;
    if (!board) {
        return [];
    }
    const sourceTiles = (board.flippedTileIds ?? [])
        .map((tileId) => board.tiles.find((tile) => tile.id === tileId))
        .filter((tile): tile is NonNullable<typeof tile> => tile != null);
    if (sourceTiles.length === 0) {
        return [];
    }
    return resolveTileTraitEffects({ run, board, sourceTiles, source }).interactionTags;
};

const turnEventFor = (
    run: RunState,
    next: RunState,
    outcomeHint: 'match' | 'mismatch' | 'gambit_match' | 'gambit_mismatch',
    keyNonce = 'k'
): BoardTurnResolvedEvent => {
    // Derive the outcome from the stats the fixture actually moved, so a fixture that
    // changes nothing produces an event the builders correctly decline, exactly as the
    // core would.
    const matched = (next.stats.matchesFound ?? 0) > (run.stats.matchesFound ?? 0);
    const missed = (next.stats.mismatches ?? 0) > (run.stats.mismatches ?? 0);
    const outcome = matched ? outcomeHint.includes('gambit') ? 'gambit_match' : 'match'
        : missed ? (outcomeHint.includes('gambit') ? 'gambit_mismatch' : 'mismatch')
        : outcomeHint === 'mismatch' || outcomeHint === 'gambit_mismatch' ? 'match' : outcomeHint;
    return ({
        schemaVersion: 1,
        commandId: keyNonce,
        eventId: keyNonce,
        sequence: 0,
        source: { kind: 'system', id: 'board_turn' },
        type: 'board.turn_resolved',
        outcome,
        flippedTileIds: [...(run.board?.flippedTileIds ?? [])],
        matchedPairKey: null,
        boardComplete: false,
        statusBefore: 'resolving',
        statusAfter: 'playing',
        livesBefore: run.lives ?? 3,
        livesAfter: next.lives ?? 3,
        totalScoreBefore: run.stats.totalScore ?? 0,
        totalScoreAfter: next.stats.totalScore ?? 0,
        triesBefore: run.stats.tries ?? 0,
        triesAfter: next.stats.tries ?? 0,
        matchesBefore: run.stats.matchesFound ?? 0,
        matchesAfter: next.stats.matchesFound ?? 0,
        comboShardsBefore: run.stats.comboShards ?? 0,
        comboShardsAfter: next.stats.comboShards ?? 0,
        currentStreakAfter: next.stats.currentStreak ?? 0,
        findablesClaimedBefore: run.findablesClaimedThisFloor ?? 0,
        findablesClaimedAfter: next.findablesClaimedThisFloor ?? 0,
        findablesTotalBefore: run.findablesTotalThisFloor ?? 0,
        findablesTotalAfter: next.findablesTotalThisFloor ?? 0,
        // Derived the same way the core derives them, so pickup and trait cases exercise
        // real event data rather than empty stubs.
        matchedFindableKind:
            (run.board?.tiles ?? []).find((tile) => (next.board?.tiles ?? []).some(
                (after) => after.id === tile.id && after.state === 'matched' && tile.state !== 'matched'
            ))?.findableKind ??
            (run.board?.tiles ?? []).find((tile) => tile.findableKind != null)?.findableKind ??
            null,
        traitInteractionTags: run.board
            ? formatSourceTraitTags(run, outcome.includes('mismatch') ? 'mismatch' : 'match')
            : [],
        announcement: getBoardTurnAnnouncementFacts(run, next, run.board?.flippedTileIds ?? [], outcome)
    }) as BoardTurnResolvedEvent;
};

describe('buildMatchScorePopPayload', () => {
    it('returns null when not a new match', () => {
        const run = minimalRun({
            board: {
                level: 1,
                rows: 2,
                columns: 2,
                flippedTileIds: ['a', 'b'],
                tiles: []
            } as unknown as BoardState,
            stats: { matchesFound: 1, totalScore: 10 } as RunState['stats']
        });
        const next = {
            ...run,
            stats: { ...run.stats, matchesFound: 1, totalScore: 10 }
        };
        expect(buildMatchScorePopPayload(turnEventFor(run, next, 'match', 'k'), 'k')).toBeNull();
    });

    it('returns payload with amount and tile ids when match score increases', () => {
        const run = minimalRun({
            board: {
                level: 3,
                rows: 2,
                columns: 2,
                flippedTileIds: ['t1', 't2'],
                tiles: []
            } as unknown as BoardState,
            stats: { matchesFound: 2, totalScore: 40 } as RunState['stats']
        });
        const next = {
            ...run,
            stats: { ...run.stats, matchesFound: 3, totalScore: 55 }
        };
        const pop = buildMatchScorePopPayload(turnEventFor(run, next, 'match', 'fixture'), 'fixture');
        expect(pop).toEqual({
            amount: 15,
            chainDepth: 1,
            feedbackHeadline: 'Score pop',
            feedbackIntensity: 'low',
            feedbackSignal: { label: 'Score', tone: 'score' },
            impactCue: { label: 'Score pop', tone: 'score' },
            crescendo: {
                audioCue: 'score-pop',
                beatCount: 1,
                detail: '+15',
                label: 'Score pop',
                screenCue: 'tick',
                tier: 'score'
            },
            payoffSummary: { label: 'Score hit', value: '+15', tier: 'score' },
            payoffChips: [{ arcadeCue: 'Score pop', id: 'score', label: 'Score', value: '+15', tone: 'score' }],
            tileIdA: 't1',
            tileIdB: 't2',
            key: '3-fixture-t1-t2'
        });
    });

    it('normalizes malformed current streak before building match score payload feedback', () => {
        const run = minimalRun({
            board: {
                level: 3,
                rows: 2,
                columns: 2,
                flippedTileIds: ['t1', 't2'],
                tiles: []
            } as unknown as BoardState,
            stats: { matchesFound: 2, totalScore: 40 } as RunState['stats']
        });
        const next = {
            ...run,
            stats: { ...run.stats, currentStreak: Number.POSITIVE_INFINITY, matchesFound: 3, totalScore: 55 }
        };
        const pop = buildMatchScorePopPayload(turnEventFor(run, next, 'match', 'malformed-streak'), 'malformed-streak');

        expect(pop).toMatchObject({
            chainDepth: 1,
            feedbackHeadline: 'Score pop',
            feedbackIntensity: 'low',
            feedbackSignal: { label: 'Score', tone: 'score' },
            impactCue: { label: 'Score pop', tone: 'score' },
            payoffSummary: { label: 'Score hit', value: '+15', tier: 'score' }
        });
        expect(pop?.crescendo).toMatchObject({
            audioCue: 'score-pop',
            detail: '+15',
            tier: 'score'
        });
        expect(JSON.stringify(pop)).not.toMatch(/NaN|Infinity/);
    });

    it('returns null when score delta is not positive', () => {
        const run = minimalRun({
            board: {
                level: 1,
                flippedTileIds: ['a', 'b'],
                tiles: []
            } as unknown as BoardState,
            stats: { matchesFound: 2, totalScore: 10 } as RunState['stats']
        });
        const next = {
            ...run,
            stats: { ...run.stats, matchesFound: 3, totalScore: 10 }
        };
        expect(buildMatchScorePopPayload(turnEventFor(run, next, 'match', 'k'), 'k')).toBeNull();
    });

    it('returns null when score delta is malformed', () => {
        const run = minimalRun({
            board: {
                level: 1,
                flippedTileIds: ['a', 'b'],
                tiles: []
            } as unknown as BoardState,
            stats: { matchesFound: 2, totalScore: 10 } as RunState['stats']
        });
        const next = {
            ...run,
            stats: { ...run.stats, matchesFound: 3, totalScore: Number.POSITIVE_INFINITY }
        };
        expect(buildMatchScorePopPayload(turnEventFor(run, next, 'match', 'k'), 'k')).toBeNull();
    });

    it('gambit match anchors to resolveGambitThree pair (not third tile)', () => {
        const run = minimalRun({
            board: {
                level: 5,
                rows: 2,
                columns: 2,
                flippedTileIds: ['t1', 't3', 't2'],
                tiles: [
                    { id: 't1', pairKey: 'pk', symbol: 'a', label: 'a', state: 'hidden' },
                    { id: 't2', pairKey: 'pk', symbol: 'b', label: 'b', state: 'hidden' },
                    { id: 't3', pairKey: 'other', symbol: 'c', label: 'c', state: 'hidden' }
                ]
            } as unknown as BoardState,
            stats: { matchesFound: 1, totalScore: 20 } as RunState['stats']
        });
        const next = {
            ...run,
            stats: { ...run.stats, matchesFound: 2, totalScore: 35 }
        };
        expect(buildMatchScorePopPayload(turnEventFor(run, next, 'match', 'g'), 'g')).toEqual({
            amount: 15,
            chainDepth: 1,
            feedbackHeadline: 'Score pop',
            feedbackIntensity: 'low',
            feedbackSignal: { label: 'Score', tone: 'score' },
            impactCue: { label: 'Score pop', tone: 'score' },
            crescendo: {
                audioCue: 'score-pop',
                beatCount: 1,
                detail: '+15',
                label: 'Score pop',
                screenCue: 'tick',
                tier: 'score'
            },
            payoffSummary: { label: 'Score hit', value: '+15', tier: 'score' },
            payoffChips: [{ arcadeCue: 'Score pop', id: 'score', label: 'Score', value: '+15', tone: 'score' }],
            tileIdA: 't1',
            tileIdB: 't2',
            key: '5-g-t1-t2'
        });
    });

    it('adds route reward copy when the matched pair is a route card', () => {
        const run = minimalRun({
            board: {
                level: 3,
                rows: 2,
                columns: 2,
                flippedTileIds: ['t1', 't2'],
                tiles: [
                    { id: 't1', pairKey: 'pk', symbol: 'a', label: 'a', state: 'flipped', routeCardKind: 'greed_cache' },
                    { id: 't2', pairKey: 'pk', symbol: 'a', label: 'a', state: 'flipped', routeCardKind: 'greed_cache' }
                ]
            } as unknown as BoardState,
            stats: { matchesFound: 2, totalScore: 40 } as RunState['stats']
        });
        const next = {
            ...run,
            stats: { ...run.stats, matchesFound: 3, totalScore: 85 }
        };
        expect(buildMatchScorePopPayload(turnEventFor(run, next, 'match', 'route'), 'route')?.routeRewardText).toBe(
            'Greed Cache +2 gold +25 score'
        );
        expect(buildMatchScorePopPayload(turnEventFor(run, next, 'match', 'route'), 'route')?.feedbackSignal).toEqual({
            label: 'Route',
            tone: 'route'
        });
        expect(buildMatchScorePopPayload(turnEventFor(run, next, 'match', 'route'), 'route')?.payoffSummary).toEqual({
            label: 'Route cashout',
            value: 'Greed Cache +2 gold +25 score',
            tier: 'reward'
        });
        expect(buildMatchScorePopPayload(turnEventFor(run, next, 'match', 'route'), 'route')?.impactCue).toEqual({
            label: 'Route cashout',
            tone: 'route'
        });
    });

    it('turns matched pickup claims into reward floaters beside the matched cards', () => {
        const run = minimalRun({
            board: {
                level: 3,
                rows: 2,
                columns: 2,
                flippedTileIds: ['t1', 't2'],
                tiles: [
                    { id: 't1', pairKey: 'pk', symbol: 'a', label: 'a', state: 'flipped', findableKind: 'shard_spark' },
                    { id: 't2', pairKey: 'pk', symbol: 'a', label: 'a', state: 'flipped', findableKind: 'shard_spark' }
                ]
            } as unknown as BoardState,
            stats: { matchesFound: 2, totalScore: 40 } as RunState['stats']
        });
        const next = {
            ...run,
            board: {
                ...run.board!,
                tiles: run.board!.tiles.map((tile) => ({ ...tile, state: 'matched' as const, findableKind: undefined }))
            },
            stats: { ...run.stats, matchesFound: 3, totalScore: 65 }
        };

        expect(buildMatchScorePopPayload(turnEventFor(run, next, 'match', 'pickup'), 'pickup')).toMatchObject({
            feedbackHeadline: 'Reward',
            feedbackIntensity: 'high',
            feedbackSignal: { label: 'Pickup', tone: 'pickup' },
            impactCue: { label: 'Pickup cashout', tone: 'pickup' },
            rewardBurst: { action: 'Cash now', label: 'Reward hit', value: 'Pickup', tier: 'single' },
            payoffSummary: { label: 'Pickup cashout', value: 'Shard spark +1 combo shard', tier: 'reward' },
            payoffChips: [
                { arcadeCue: 'Score pop', id: 'score', label: 'Score', value: '+25', tone: 'score' },
                { arcadeCue: 'Pickup cashout', id: 'pickup', label: 'Pickup', value: 'Shard spark +1 combo shard', tone: 'pickup' }
            ],
            pickupRewardText: 'Shard spark +1 combo shard'
        });
    });

    it('adds chain reward forecast cues to streak floaters', () => {
        const run = minimalRun({
            lives: 4,
            board: {
                level: 3,
                rows: 2,
                columns: 2,
                flippedTileIds: ['t1', 't2'],
                tiles: [
                    { id: 't1', pairKey: 'pk', symbol: 'a', label: 'a', state: 'flipped' },
                    { id: 't2', pairKey: 'pk', symbol: 'a', label: 'a', state: 'flipped' }
                ]
            } as unknown as BoardState,
            stats: { ...minimalRun({}).stats, matchesFound: 2, totalScore: 40, comboShards: 1, currentStreak: 3 }
        });
        const next = {
            ...run,
            stats: { ...run.stats, matchesFound: 3, totalScore: 65, currentStreak: 4 }
        };

        expect(buildMatchScorePopPayload(turnEventFor(run, next, 'match', 'chain'), 'chain')?.chainRewardForecastCues).toEqual([
            {
                actionLabel: 'Soon',
                chaseLabel: 'Prime',
                distance: 2,
                distanceLabel: '2 matches',
                id: 'shard-6',
                label: 'x6 +1 shard',
                targetStreak: 6,
                tone: 'reward',
                urgency: 'soon'
            },
            {
                actionLabel: 'Later',
                chaseLabel: 'Hold streak',
                distance: 4,
                distanceLabel: '4 matches',
                id: 'guard-8',
                label: 'x8 +1 guard',
                stackSize: 2,
                targetStreak: 8,
                tone: 'guard',
                urgency: 'later'
            },
            {
                actionLabel: 'Later',
                chaseLabel: 'Hold streak',
                distance: 4,
                distanceLabel: '4 matches',
                id: 'heal-8',
                label: 'x8 +1 life',
                stackSize: 2,
                targetStreak: 8,
                tone: 'heal',
                urgency: 'later'
            }
        ]);
        expect(buildMatchScorePopPayload(turnEventFor(run, next, 'match', 'chain'), 'chain')?.payoffChips).toEqual([
            { arcadeCue: 'Score pop', id: 'score', label: 'Score', value: '+25', tone: 'score' },
            { arcadeCue: 'Prime cashout', id: 'streak', label: 'Streak', value: 'x4', tone: 'chain' },
            { arcadeCue: 'Chain cascade', id: 'cascade', label: 'Cascade', value: 'chain cascade', tone: 'chain' },
            { arcadeCue: 'Combo prime', id: 'next', label: 'Soon shard', value: 'x6 +1 shard', tone: 'reward' }
        ]);
        expect(buildMatchScorePopPayload(turnEventFor(run, next, 'match', 'chain'), 'chain')?.cascadeCue).toEqual({
            label: 'Cascade',
            value: 'chain cascade',
            tier: 'chain'
        });
    });

    it('names next payoff chips by reward type for guard and life cashouts', () => {
        const baseRun = minimalRun({
            lives: 5,
            board: {
                level: 3,
                rows: 2,
                columns: 2,
                flippedTileIds: ['t1', 't2'],
                tiles: [
                    { id: 't1', pairKey: 'pk', symbol: 'a', label: 'a', state: 'flipped' },
                    { id: 't2', pairKey: 'pk', symbol: 'a', label: 'a', state: 'flipped' }
                ]
            } as unknown as BoardState,
            stats: { ...minimalRun({}).stats, matchesFound: 2, totalScore: 40, comboShards: 3, currentStreak: 7 }
        });

        expect(
            buildMatchScorePopPayload(turnEventFor(baseRun, { ...baseRun, stats: { ...baseRun.stats, matchesFound: 3, totalScore: 65, currentStreak: 8 } }, 'match', 'guard'), 'guard')?.payoffChips
        ).toContainEqual({ arcadeCue: 'Combo chase', id: 'next', label: 'Later guard', value: 'x12 +1 guard', tone: 'guard' });

        expect(
            buildMatchScorePopPayload(turnEventFor({ ...baseRun, lives: 3, stats: { ...baseRun.stats, comboShards: 2, currentStreak: 3 } }, {
                    ...baseRun,
                    lives: 3,
                    stats: { ...baseRun.stats, comboShards: 2, matchesFound: 3, totalScore: 65, currentStreak: 4 }
                }, 'match', 'life'), 'life')?.payoffChips
        ).toContainEqual({ arcadeCue: 'Heal prime', id: 'next', label: 'Soon life', value: 'x6 +1 life', tone: 'heal' });
    });

    it('promotes one-away chain rewards as armed cashouts on the match floater', () => {
        const run = minimalRun({
            lives: 4,
            board: {
                level: 3,
                rows: 2,
                columns: 2,
                flippedTileIds: ['t1', 't2'],
                tiles: [
                    { id: 't1', pairKey: 'pk', symbol: 'a', label: 'a', state: 'flipped' },
                    { id: 't2', pairKey: 'pk', symbol: 'a', label: 'a', state: 'flipped' }
                ]
            } as unknown as BoardState,
            stats: { ...minimalRun({}).stats, matchesFound: 4, totalScore: 80, comboShards: 0, currentStreak: 4 }
        });
        const pop = buildMatchScorePopPayload(turnEventFor(run, { ...run, stats: { ...run.stats, matchesFound: 5, totalScore: 110, currentStreak: 5 } }, 'match', 'armed-cashout'), 'armed-cashout');

        expect(pop?.chainRewardText).toBeUndefined();
        expect(pop?.payoffSummary).toEqual({
            label: 'Cashout armed',
            value: 'x6 +1 shard',
            tier: 'reward'
        });
        expect(pop?.impactCue).toEqual({ label: 'Cashout armed', tone: 'reward' });
        expect(pop?.payoffChips).toContainEqual({
            arcadeCue: 'One-away cashout',
            id: 'next',
            label: 'Next shard',
            value: 'x6 +1 shard',
            tone: 'reward'
        });
    });

    it('surfaces chain reward cashouts from resource gains on the matched turn', () => {
        const baseRun = minimalRun({
            lives: 4,
            board: {
                level: 3,
                rows: 2,
                columns: 2,
                flippedTileIds: ['t1', 't2'],
                tiles: [
                    { id: 't1', pairKey: 'pk', symbol: 'a', label: 'a', state: 'flipped' },
                    { id: 't2', pairKey: 'pk', symbol: 'a', label: 'a', state: 'flipped' }
                ]
            } as unknown as BoardState,
            stats: {
                ...minimalRun({}).stats,
                matchesFound: 2,
                totalScore: 40,
                comboShards: 1,
                guardTokens: 0,
                currentStreak: 3
            }
        });
        const pop = buildMatchScorePopPayload(turnEventFor(baseRun, {
                ...baseRun,
                lives: 5,
                stats: {
                    ...baseRun.stats,
                    comboShards: 2,
                    guardTokens: 1,
                    matchesFound: 3,
                    totalScore: 75,
                    currentStreak: 4
                }
            }, 'match', 'cashout'), 'cashout');

        expect(pop?.chainRewardText).toBe('+1 combo shard / +1 guard token / +1 life');
        expect(pop).toMatchObject({
            feedbackHeadline: 'Reward',
            feedbackIntensity: 'high'
        });
        expect(pop?.payoffSummary).toEqual({
            label: 'Chain cashout',
            value: '+1 combo shard / +1 guard token / +1 life',
            tier: 'reward'
        });
        expect(pop?.impactCue).toEqual({ label: 'Cashout now', tone: 'reward' });
        expect(pop?.payoffChips).toContainEqual({
            arcadeCue: 'Chain cashout',
            id: 'chainReward',
            label: 'Cashout',
            value: '+1 combo shard / +1 guard token / +1 life',
            tone: 'reward'
        });
        expect(pop?.payoffChips).toContainEqual({
            arcadeCue: 'Reward cascade',
            id: 'cascade',
            label: 'Cascade',
            value: 'reward cascade',
            tone: 'chain'
        });
        expect(pop?.cascadeCue).toEqual({
            label: 'Cascade',
            value: 'reward cascade',
            tier: 'reward'
        });
        expect(pop?.rewardBurst).toEqual({
            action: 'Cash now',
            label: 'Reward hit',
            value: 'Chain reward',
            tier: 'single'
        });
        expect(pop?.payoffLadder).toEqual({
            first: 'Chain cashout',
            then: 'Combo chase',
            keep: 'Hold streak',
            tone: 'reward'
        });
    });

    it('normalizes malformed chain reward counters before building cashout copy', () => {
        const baseRun = minimalRun({
            lives: Number.NaN,
            board: {
                level: 3,
                rows: 2,
                columns: 2,
                flippedTileIds: ['t1', 't2'],
                tiles: [
                    { id: 't1', pairKey: 'pk', symbol: 'a', label: 'a', state: 'flipped' },
                    { id: 't2', pairKey: 'pk', symbol: 'a', label: 'a', state: 'flipped' }
                ]
            } as unknown as BoardState,
            stats: {
                ...minimalRun({}).stats,
                matchesFound: 2,
                totalScore: 40,
                comboShards: Number.POSITIVE_INFINITY,
                guardTokens: Number.NaN,
                currentStreak: 3
            }
        });
        const pop = buildMatchScorePopPayload(turnEventFor(baseRun, {
                ...baseRun,
                lives: Number.POSITIVE_INFINITY,
                stats: {
                    ...baseRun.stats,
                    comboShards: Number.POSITIVE_INFINITY,
                    guardTokens: Number.POSITIVE_INFINITY,
                    matchesFound: 3,
                    totalScore: 75,
                    currentStreak: 4
                }
            }, 'match', 'malformed-cashout'), 'malformed-cashout');

        expect(pop?.chainRewardText).toBeUndefined();
        expect(pop?.payoffSummary?.value).not.toMatch(/NaN|Infinity/);
        expect(pop?.payoffChips?.map((chip) => chip.value).join(' ')).not.toMatch(/NaN|Infinity/);
    });

    it('summarizes four-channel match rewards as a super stack', () => {
        const run = minimalRun({
            lives: 4,
            board: {
                level: 4,
                rows: 2,
                columns: 3,
                flippedTileIds: ['e1', 'e2'],
                tiles: [
                    {
                        id: 'e1',
                        pairKey: 'echo',
                        symbol: 'e',
                        label: 'Echo',
                        state: 'flipped',
                        tileTraitKind: 'echo',
                        findableKind: 'shard_spark',
                        routeCardKind: 'greed_cache'
                    },
                    { id: 'c1', pairKey: 'conduit', symbol: 'c', label: 'Conduit', state: 'hidden', tileTraitKind: 'conduit' },
                    { id: 's1', pairKey: 'sealed', symbol: 's', label: 'Sealed', state: 'hidden', tileTraitKind: 'sealed' },
                    {
                        id: 'e2',
                        pairKey: 'echo',
                        symbol: 'e',
                        label: 'Echo',
                        state: 'flipped',
                        tileTraitKind: 'echo',
                        findableKind: 'shard_spark',
                        routeCardKind: 'greed_cache'
                    },
                    { id: 'x1', pairKey: 'x', symbol: 'x', label: 'X', state: 'hidden' },
                    { id: 'x2', pairKey: 'x', symbol: 'x', label: 'X', state: 'hidden' }
                ]
            } as unknown as BoardState,
            rewardPerkIds: ['echo_conduit_double'],
            stats: {
                ...minimalRun({}).stats,
                matchesFound: 2,
                totalScore: 40,
                comboShards: 1,
                guardTokens: 0,
                currentStreak: 3
            }
        });
        const next = {
            ...run,
            board: {
                ...run.board!,
                tiles: run.board!.tiles.map((tile) =>
                    tile.id === 'e1' || tile.id === 'e2'
                        ? { ...tile, state: 'matched' as const, findableKind: undefined }
                        : tile
                )
            },
            lives: 4,
            stats: {
                ...run.stats,
                comboShards: 2,
                guardTokens: 1,
                matchesFound: 3,
                totalScore: 125,
                currentStreak: 4
            }
        };
        const pop = buildMatchScorePopPayload(turnEventFor(run, next, 'match', 'stack-cashout'), 'stack-cashout');

        expect(pop?.payoffSummary).toEqual({
            label: 'Super stack',
            value: '4 payoffs: Route + Pickup + Trait + Chain',
            tier: 'combo'
        });
        expect(pop?.impactCue).toEqual({ label: 'Super stack', tone: 'reward' });
        expect(pop?.rewardBurst).toEqual({
            action: 'Cash super stack',
            label: 'Super stack',
            value: '4-way payoff',
            tier: 'mega'
        });
        expect(pop?.cascadeCue).toEqual({
            label: 'Cascade',
            value: 'combo cascade',
            tier: 'combo'
        });
        expect(pop?.payoffChips).toEqual(
            expect.arrayContaining([
                { arcadeCue: 'Route cashout', id: 'route', label: 'Route', value: 'Greed Cache +2 gold +25 score', tone: 'route' },
                { arcadeCue: 'Pickup cashout', id: 'pickup', label: 'Pickup', value: 'Shard spark +1 combo shard', tone: 'pickup' },
                { arcadeCue: 'Perk pop', id: 'trait', label: 'Perk', value: 'Perk pop: Echo Conduit Lens doubles the route', tone: 'trait' },
                { arcadeCue: 'Chain cashout', id: 'chainReward', label: 'Cashout', value: '+1 combo shard / +1 guard token', tone: 'reward' }
            ])
        );
        expect(pop?.payoffLadder).toEqual({
            first: 'Route cashout',
            lanes: ['Route cashout', 'Pickup cashout', 'Perk pop', 'Chain cashout'],
            then: 'Cash super stack',
            keep: 'Prime',
            tone: 'combo'
        });
        expect(pop?.payoffLaneMap).toEqual([
            { id: 'route', label: 'Route', count: 1, tone: 'route', cue: 'Route cashout' },
            { id: 'pickup', label: 'Pickup', count: 1, tone: 'pickup', cue: 'Pickup cashout' },
            { id: 'trait', label: 'Trait', count: 1, tone: 'trait', cue: 'Perk pop' },
            { id: 'chain', label: 'Chain', count: 1, tone: 'chain', cue: 'Chain cashout' }
        ]);
    });

    it('groups payoff chips into lane-map cues and skips plain score-only hits', () => {
        expect(
            buildMatchScorePopPayoffLaneMap([
                { arcadeCue: 'Score pop', id: 'score', label: 'Score', value: '+15', tone: 'score' }
            ])
        ).toBeUndefined();
        expect(
            buildMatchScorePopPayoffLaneMap([
                { arcadeCue: 'Score pop', id: 'score', label: 'Score', value: '+80', tone: 'score' },
                { arcadeCue: 'Chain cashout', id: 'streak', label: 'Streak', value: 'x6', tone: 'chain' },
                { arcadeCue: 'Surge live', id: 'tier', label: 'Momentum', value: 'Surge live', tone: 'chain' },
                { arcadeCue: 'One-away cashout', id: 'next', label: 'Next', value: 'x8 +1 shard', tone: 'reward' }
            ])
        ).toEqual([
            { id: 'chain', label: 'Chain', count: 2, tone: 'chain', cue: 'Chain cashout' },
            { id: 'build', label: 'Build', count: 1, tone: 'reward', cue: 'One-away cashout' }
        ]);
    });

    it('marks surge and combo streaks as live momentum states in payoff chips', () => {
        const run = minimalRun({
            lives: 4,
            board: {
                level: 3,
                rows: 2,
                columns: 2,
                flippedTileIds: ['t1', 't2'],
                tiles: [
                    { id: 't1', pairKey: 'pk', symbol: 'a', label: 'a', state: 'flipped' },
                    { id: 't2', pairKey: 'pk', symbol: 'a', label: 'a', state: 'flipped' }
                ]
            } as unknown as BoardState,
            stats: { ...minimalRun({}).stats, matchesFound: 2, totalScore: 40, comboShards: 1, currentStreak: 5 }
        });
        const surge = buildMatchScorePopPayload(turnEventFor(run, { ...run, stats: { ...run.stats, matchesFound: 3, totalScore: 70, currentStreak: 6 } }, 'match', 'surge'), 'surge');
        const combo = buildMatchScorePopPayload(turnEventFor(run, { ...run, stats: { ...run.stats, matchesFound: 3, totalScore: 90, currentStreak: 10 } }, 'match', 'combo'), 'combo');

        expect(surge?.payoffChips).toContainEqual({
            arcadeCue: 'Chain cashout',
            id: 'streak',
            label: 'Streak',
            value: 'x6',
            tone: 'chain'
        });
        expect(surge?.payoffChips).toContainEqual({
            arcadeCue: 'Surge live',
            id: 'tier',
            label: 'Momentum',
            value: 'Surge live',
            tone: 'chain'
        });
        expect(surge?.cascadeCue).toEqual({
            label: 'Cascade',
            value: 'reward cascade',
            tier: 'reward'
        });
        expect(combo?.payoffChips).toContainEqual({
            arcadeCue: 'Combo live',
            id: 'tier',
            label: 'Momentum',
            value: 'Combo live',
            tone: 'chain'
        });
        expect(combo?.cascadeCue).toEqual({
            label: 'Cascade',
            value: 'combo cascade',
            tier: 'combo'
        });
    });

    it('emits arcade milestone badges only when chain tiers are crossed', () => {
        expect(getMatchScorePopChainMilestone(2, 3)).toEqual({
            action: 'Start chain',
            audioCue: 'chain-start-ping',
            beatCount: 3,
            label: 'Chain started',
            screenCue: 'reward-loop',
            target: 'x3',
            tone: 'chain',
            value: 'Reward loop online'
        });
        expect(getMatchScorePopChainMilestone(5, 6)).toEqual({
            action: 'Push surge',
            audioCue: 'surge-hit-ping',
            beatCount: 4,
            label: 'Surge hit',
            screenCue: 'surge-live',
            target: 'x6',
            tone: 'surge',
            value: 'Surge tier live'
        });
        expect(getMatchScorePopChainMilestone(9, 10)).toEqual({
            action: 'Hold combo',
            audioCue: 'combo-hit-ping',
            beatCount: 5,
            label: 'Combo hit',
            screenCue: 'combo-live',
            target: 'x10',
            tone: 'combo',
            value: 'Combo tier live'
        });
        expect(getMatchScorePopChainMilestone(6, 7)).toBeUndefined();
    });

    it('adds the crossed chain milestone to the match floater payload', () => {
        const run = minimalRun({
            lives: 4,
            board: {
                level: 3,
                rows: 2,
                columns: 2,
                flippedTileIds: ['t1', 't2'],
                tiles: [
                    { id: 't1', pairKey: 'pk', symbol: 'a', label: 'a', state: 'flipped' },
                    { id: 't2', pairKey: 'pk', symbol: 'a', label: 'a', state: 'flipped' }
                ]
            } as unknown as BoardState,
            stats: { ...minimalRun({}).stats, matchesFound: 2, totalScore: 40, comboShards: 1, currentStreak: 5 }
        });
        const pop = buildMatchScorePopPayload(turnEventFor(run, { ...run, stats: { ...run.stats, matchesFound: 3, totalScore: 70, currentStreak: 6 } }, 'match', 'surge-milestone'), 'surge-milestone');

        expect(pop?.chainMilestone).toEqual({
            action: 'Push surge',
            audioCue: 'surge-hit-ping',
            beatCount: 4,
            label: 'Surge hit',
            screenCue: 'surge-live',
            target: 'x6',
            tone: 'surge',
            value: 'Surge tier live'
        });
    });

    it('adds trait interaction copy from adjacent matched traits', () => {
        const run = minimalRun({
            board: {
                level: 3,
                rows: 2,
                columns: 2,
                flippedTileIds: ['e1', 'e2'],
                tiles: [
                    { id: 'e1', pairKey: 'echo', symbol: 'e', label: 'Echo', state: 'flipped', tileTraitKind: 'echo' },
                    { id: 's1', pairKey: 'sealed', symbol: 's', label: 'Sealed', state: 'hidden', tileTraitKind: 'sealed' },
                    { id: 'e2', pairKey: 'echo', symbol: 'e', label: 'Echo', state: 'flipped', tileTraitKind: 'echo' },
                    { id: 's2', pairKey: 'sealed', symbol: 's', label: 'Sealed', state: 'hidden', tileTraitKind: 'sealed' }
                ]
            } as unknown as BoardState,
            stats: { matchesFound: 2, totalScore: 40, comboShards: 0 } as RunState['stats']
        });
        const next = {
            ...run,
            stats: { ...run.stats, matchesFound: 3, totalScore: 60 }
        };
        expect(buildMatchScorePopPayload(turnEventFor(run, next, 'match', 'trait'), 'trait')?.traitInteractionTexts).toContain(
            'Echo + Sealed: combo shard'
        );
        expect(buildMatchScorePopPayload(turnEventFor(run, next, 'match', 'trait'), 'trait')).toMatchObject({
            feedbackHeadline: 'Surge',
            feedbackIntensity: 'high',
            feedbackSignal: { label: 'Trait', tone: 'trait' },
            payoffChips: [
                { id: 'score', label: 'Score', value: '+20', tone: 'score' },
                { id: 'trait', label: 'Trait', value: 'Echo + Sealed: combo shard', tone: 'trait' }
            ]
        });
    });

    it('names reward perk payoffs in trait match floaters', () => {
        const run = minimalRun({
            board: {
                level: 4,
                rows: 2,
                columns: 3,
                flippedTileIds: ['e1', 'e2'],
                tiles: [
                    { id: 'e1', pairKey: 'echo', symbol: 'e', label: 'Echo', state: 'flipped', tileTraitKind: 'echo' },
                    { id: 'c1', pairKey: 'conduit', symbol: 'c', label: 'Conduit', state: 'hidden', tileTraitKind: 'conduit' },
                    { id: 's1', pairKey: 'sealed', symbol: 's', label: 'Sealed', state: 'hidden', tileTraitKind: 'sealed' },
                    { id: 'e2', pairKey: 'echo', symbol: 'e', label: 'Echo', state: 'flipped', tileTraitKind: 'echo' },
                    { id: 'x1', pairKey: 'x', symbol: 'x', label: 'X', state: 'hidden' },
                    { id: 'x2', pairKey: 'x', symbol: 'x', label: 'X', state: 'hidden' }
                ]
            } as unknown as BoardState,
            rewardPerkIds: ['echo_conduit_double', 'trait_streak_toolkit'],
            stats: { ...minimalRun({}).stats, matchesFound: 2, totalScore: 40, currentStreak: 2, comboShards: 0 }
        });
        const next = {
            ...run,
            stats: { ...run.stats, matchesFound: 3, totalScore: 80, currentStreak: 3 }
        };
        const pop = buildMatchScorePopPayload(turnEventFor(run, next, 'match', 'perk-trait'), 'perk-trait');

        expect(pop?.traitInteractionTexts).toEqual(
            expect.arrayContaining([
                'Perk pop: Echo Conduit Lens doubles the route',
                'Perk pop: Trait Streak Lens flashes a pair'
            ])
        );
        expect(pop?.payoffChips).toContainEqual({
            arcadeCue: 'Perk pop',
            id: 'trait',
            label: 'Perk surge',
            value: '2 perk pops',
            tone: 'trait'
        });
        expect(pop?.rewardBurst).toEqual({
            action: 'Cash stack',
            label: 'Combo burst',
            value: '3-way payoff',
            tier: 'mega'
        });
        expect(pop?.cascadeCue).toEqual({
            label: 'Cascade',
            value: 'combo cascade',
            tier: 'combo'
        });
        expect(pop?.payoffSummary).toEqual({
            label: 'Perk surge',
            value: '2 perk pops',
            tier: 'combo'
        });
        expect(pop?.impactCue).toEqual({ label: 'Stack cashout', tone: 'reward' });
    });

    it('classifies a single reward perk activation as a perk pop', () => {
        const payoffSummary = buildMatchScorePopPayoffSummary({
            amount: 45,
            chainDepth: 2,
            traitInteractionTexts: ['Perk pop: Cursed Opener pays gold']
        });

        expect(payoffSummary).toEqual({
            label: 'Perk pop',
            value: 'Perk pop: Cursed Opener pays gold',
            tier: 'reward'
        });
        expect(buildMatchScorePopImpactCue({ chainDepth: 2, payoffSummary })).toEqual({
            label: 'Perk pop',
            tone: 'trait'
        });
    });

    it('normalizes malformed score-hit amount before rendering payoff summary', () => {
        expect(
            buildMatchScorePopPayoffSummary({
                amount: Number.POSITIVE_INFINITY,
                chainDepth: 1,
                traitInteractionTexts: []
            })
        ).toEqual({
            label: 'Score hit',
            value: '+0',
            tier: 'score'
        });
    });

    it('normalizes malformed chain depth before classifying match pop feedback', () => {
        const payoffSummary = buildMatchScorePopPayoffSummary({
            amount: 45,
            chainDepth: Number.POSITIVE_INFINITY,
            traitInteractionTexts: []
        });

        expect(getMatchScorePopFeedbackProfile(Number.POSITIVE_INFINITY, 0)).toEqual({
            feedbackHeadline: 'Score pop',
            feedbackIntensity: 'low'
        });
        expect(
            getMatchScorePopSignal({
                chainDepth: Number.POSITIVE_INFINITY,
                hasPickupReward: false,
                hasRouteReward: false,
                traitInteractionCount: 0
            })
        ).toEqual({
            label: 'Score',
            tone: 'score'
        });
        expect(payoffSummary).toEqual({
            label: 'Score hit',
            value: '+45',
            tier: 'score'
        });
        expect(buildMatchScorePopImpactCue({ chainDepth: Number.POSITIVE_INFINITY, payoffSummary })).toEqual({
            label: 'Score pop',
            tone: 'score'
        });
        expect(
            buildMatchScorePopCrescendo({
                chainDepth: Number.POSITIVE_INFINITY,
                impactCue: { label: 'Score pop', tone: 'score' },
                payoffSummary
            })
        ).toEqual({
            audioCue: 'score-pop',
            beatCount: 1,
            detail: '+45',
            label: 'Score pop',
            screenCue: 'tick',
            tier: 'score'
        });
    });

    it('floors fractional chain depth before rendering streak feedback', () => {
        const payoffSummary = buildMatchScorePopPayoffSummary({
            amount: 45,
            chainDepth: 3.9,
            traitInteractionTexts: []
        });

        expect(payoffSummary).toEqual({
            label: 'Chain hit',
            value: 'x3 streak',
            tier: 'chain'
        });
        expect(
            buildMatchScorePopCrescendo({
                chainDepth: 3.9,
                impactCue: { label: 'Prime chain', tone: 'chain' },
                payoffSummary
            })
        ).toMatchObject({
            detail: 'x3 streak',
            tier: 'prime'
        });
    });

    it('classifies match pop crescendo tiers for arcade feedback', () => {
        expect(
            buildMatchScorePopCrescendo({
                chainDepth: 1,
                impactCue: { label: 'Score pop', tone: 'score' },
                payoffSummary: { label: 'Score hit', value: '+15', tier: 'score' }
            })
        ).toEqual({
            audioCue: 'score-pop',
            beatCount: 1,
            detail: '+15',
            label: 'Score pop',
            screenCue: 'tick',
            tier: 'score'
        });
        expect(
            buildMatchScorePopCrescendo({
                chainDepth: 4,
                impactCue: { label: 'Prime chain', tone: 'chain' },
                payoffSummary: { label: 'Chain hit', value: 'x4 streak', tier: 'chain' }
            })
        ).toEqual({
            audioCue: 'prime-pop',
            beatCount: 2,
            detail: 'x4 streak',
            label: 'Prime beat',
            screenCue: 'pulse',
            tier: 'prime'
        });
        expect(
            buildMatchScorePopCrescendo({
                chainDepth: 5,
                impactCue: { label: 'Cashout armed', tone: 'reward' },
                payoffSummary: { label: 'Cashout armed', value: 'x6 +1 shard', tier: 'reward' }
            })
        ).toMatchObject({
            audioCue: 'cashout-pop',
            beatCount: 3,
            label: 'Cashout beat',
            screenCue: 'snap',
            tier: 'cashout'
        });
        expect(
            buildMatchScorePopCrescendo({
                chainDepth: 4,
                impactCue: { label: 'Stack cashout', tone: 'reward' },
                payoffLaneMap: [
                    { id: 'pickup', label: 'Pickup', count: 1, tone: 'pickup', cue: 'Pickup cashout' },
                    { id: 'chain', label: 'Chain', count: 1, tone: 'chain', cue: 'Chain cashout' }
                ],
                payoffSummary: { label: 'Stack cashout', value: '2 payoffs: Pickup + Chain', tier: 'reward' }
            })
        ).toMatchObject({
            audioCue: 'stack-burst',
            beatCount: 4,
            detail: '2 payoff lanes',
            label: 'Stack burst',
            screenCue: 'burst',
            tier: 'stack'
        });
        expect(
            buildMatchScorePopCrescendo({
                chainDepth: 8,
                impactCue: { label: 'Super stack', tone: 'reward' },
                payoffLaneMap: [
                    { id: 'route', label: 'Route', count: 1, tone: 'route', cue: 'Route cashout' },
                    { id: 'pickup', label: 'Pickup', count: 1, tone: 'pickup', cue: 'Pickup cashout' },
                    { id: 'trait', label: 'Trait', count: 1, tone: 'trait', cue: 'Trait cashout' },
                    { id: 'chain', label: 'Chain', count: 1, tone: 'chain', cue: 'Chain cashout' }
                ],
                payoffSummary: { label: 'Super stack', value: '4 payoffs: Route + Pickup + Trait + Chain', tier: 'combo' }
            })
        ).toMatchObject({
            audioCue: 'super-burst',
            beatCount: 5,
            detail: '4 payoff lanes',
            label: 'Super burst',
            screenCue: 'super',
            tier: 'super'
        });
    });

    it('ignores malformed payoff lane counts before classifying match pop crescendo tiers', () => {
        expect(
            buildMatchScorePopCrescendo({
                chainDepth: 1,
                impactCue: { label: 'Score pop', tone: 'score' },
                payoffLaneMap: [
                    { id: 'route', label: 'Route', count: Number.NaN, tone: 'route', cue: 'Route cashout' },
                    { id: 'pickup', label: 'Pickup', count: Number.POSITIVE_INFINITY, tone: 'pickup', cue: 'Pickup cashout' },
                    { id: 'trait', label: 'Trait', count: -2, tone: 'trait', cue: 'Trait cashout' }
                ],
                payoffSummary: { label: 'Score hit', value: '+15', tier: 'score' }
            })
        ).toEqual({
            audioCue: 'score-pop',
            beatCount: 1,
            detail: '+15',
            label: 'Score pop',
            screenCue: 'tick',
            tier: 'score'
        });
    });

    it('classifies match feedback intensity by streak and trait interaction count', () => {
        expect(getMatchScorePopFeedbackProfile(1, 0)).toEqual({
            feedbackHeadline: 'Score pop',
            feedbackIntensity: 'low'
        });
        expect(getMatchScorePopFeedbackProfile(3, 0)).toEqual({
            feedbackHeadline: 'Chain',
            feedbackIntensity: 'mid'
        });
        expect(getMatchScorePopFeedbackProfile(6, 0)).toEqual({
            feedbackHeadline: 'Surge',
            feedbackIntensity: 'high'
        });
        expect(getMatchScorePopFeedbackProfile(10, 0)).toEqual({
            feedbackHeadline: 'Combo',
            feedbackIntensity: 'max'
        });
        expect(getMatchScorePopFeedbackProfile(2, 2)).toEqual({
            feedbackHeadline: 'Combo',
            feedbackIntensity: 'max'
        });
    });

    it('classifies match floater signal chips by the most actionable payoff', () => {
        expect(getMatchScorePopSignal({
            chainDepth: 1,
            hasPickupReward: false,
            hasRouteReward: false,
            traitInteractionCount: 0
        })).toEqual({
            label: 'Score',
            tone: 'score'
        });
        expect(getMatchScorePopSignal({
            chainDepth: 4,
            hasPickupReward: false,
            hasRouteReward: false,
            traitInteractionCount: 0
        })).toEqual({
            label: 'Chain',
            tone: 'chain'
        });
        expect(getMatchScorePopSignal({
            chainDepth: 10,
            hasPickupReward: false,
            hasRouteReward: false,
            traitInteractionCount: 0
        })).toEqual({
            label: 'Combo',
            tone: 'combo'
        });
        expect(getMatchScorePopSignal({
            chainDepth: 10,
            hasPickupReward: true,
            hasRouteReward: false,
            traitInteractionCount: 2
        })).toEqual({
            label: 'Pickup',
            tone: 'pickup'
        });
        expect(getMatchScorePopSignal({
            chainDepth: 10,
            hasPickupReward: true,
            hasRouteReward: true,
            traitInteractionCount: 2
        })).toEqual({
            label: 'Route',
            tone: 'route'
        });
    });
});

describe('buildMismatchScorePopPayload', () => {
    it('returns null when mismatches do not increase', () => {
        const run = minimalRun({
            board: {
                level: 1,
                flippedTileIds: ['a', 'b'],
                tiles: []
            } as unknown as BoardState,
            stats: { mismatches: 2 } as RunState['stats']
        });
        const next = {
            ...run,
            stats: { ...run.stats, mismatches: 2 }
        };
        expect(buildMismatchScorePopPayload(turnEventFor(run, next, 'mismatch', 'k'), 'k')).toBeNull();
    });

    it('returns tile ids and key when mismatches increase', () => {
        const run = minimalRun({
            board: {
                level: 2,
                flippedTileIds: ['x', 'y'],
                tiles: []
            } as unknown as BoardState,
            stats: { mismatches: 1 } as RunState['stats']
        });
        const next = {
            ...run,
            stats: { ...run.stats, mismatches: 2 }
        };
        expect(buildMismatchScorePopPayload(turnEventFor(run, next, 'mismatch', 'fix'), 'fix')).toEqual({
            tileIdA: 'x',
            tileIdB: 'y',
            key: 'miss-2-fix-x-y'
        });
    });

    it('includes the broken chain depth when a miss resets a streak', () => {
        const run = minimalRun({
            board: {
                level: 2,
                flippedTileIds: ['x', 'y'],
                tiles: []
            } as unknown as BoardState,
            stats: { mismatches: 1, currentStreak: 6 } as RunState['stats']
        });
        const next = {
            ...run,
            stats: { ...run.stats, mismatches: 2, currentStreak: 0 }
        };
        expect(buildMismatchScorePopPayload(turnEventFor(run, next, 'mismatch', 'break'), 'break')).toEqual({
            tileIdA: 'x',
            tileIdB: 'y',
            brokenChainDepth: 6,
            brokenChainRewardCue: {
                actionLabel: 'Soon',
                chaseLabel: 'Prime',
                distance: 2,
                distanceLabel: '2 matches',
                id: 'shard-8',
                label: 'x8 +1 shard',
                stackSize: 3,
                targetStreak: 8,
                tone: 'reward',
                urgency: 'soon'
            },
            key: 'miss-2-break-x-y'
        });
    });

    it('normalizes malformed mismatch streak counters before broken-chain copy', () => {
        const run = minimalRun({
            board: {
                level: 2,
                flippedTileIds: ['x', 'y'],
                tiles: []
            } as unknown as BoardState,
            stats: { mismatches: 1, currentStreak: Number.POSITIVE_INFINITY } as RunState['stats']
        });
        const next = {
            ...run,
            stats: { ...run.stats, mismatches: 2, currentStreak: Number.NaN }
        };

        expect(buildMismatchScorePopPayload(turnEventFor(run, next, 'mismatch', 'malformed-break'), 'malformed-break')).toEqual({
            tileIdA: 'x',
            tileIdB: 'y',
            key: 'miss-2-malformed-break-x-y'
        });
    });

    it('gambit triple miss includes tileIdC and extended key', () => {
        const run = minimalRun({
            board: {
                level: 4,
                flippedTileIds: ['u', 'v', 'w'],
                tiles: []
            } as unknown as BoardState,
            stats: { mismatches: 3 } as RunState['stats']
        });
        const next = {
            ...run,
            stats: { ...run.stats, mismatches: 4 }
        };
        expect(buildMismatchScorePopPayload(turnEventFor(run, next, 'mismatch', 'trip'), 'trip')).toEqual({
            tileIdA: 'u',
            tileIdB: 'v',
            tileIdC: 'w',
            key: 'miss-4-trip-u-v-w'
        });
    });

    it('adds trait interaction copy from risky adjacent misses', () => {
        const run = minimalRun({
            board: {
                level: 4,
                rows: 2,
                columns: 2,
                flippedTileIds: ['c1', 'v1'],
                tiles: [
                    { id: 'c1', pairKey: 'cursed', symbol: 'c', label: 'Cursed', state: 'flipped', tileTraitKind: 'cursed' },
                    { id: 'z1', pairKey: 'nearby-volatile', symbol: 'z', label: 'Nearby Volatile', state: 'hidden', tileTraitKind: 'volatile' },
                    { id: 'v1', pairKey: 'volatile', symbol: 'v', label: 'Volatile', state: 'flipped', tileTraitKind: 'volatile' },
                    { id: 'c2', pairKey: 'cursed', symbol: 'c', label: 'Cursed', state: 'hidden', tileTraitKind: 'cursed' }
                ]
            } as unknown as BoardState,
            stats: { mismatches: 1 } as RunState['stats']
        });
        const next = {
            ...run,
            stats: { ...run.stats, mismatches: 2 }
        };
        expect(buildMismatchScorePopPayload(turnEventFor(run, next, 'mismatch', 'trait'), 'trait')?.traitInteractionTexts).toContain(
            'Cursed + Volatile: recall pressure'
        );
    });
});
