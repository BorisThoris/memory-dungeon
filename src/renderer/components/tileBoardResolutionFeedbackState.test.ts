import { describe, expect, it } from 'vitest';
import type { BoardState } from '../../shared/contracts';
import {
    buildLastResolutionFeedback,
    buildTrapResolutionAnnouncement,
    shouldClearTrapResolutionAnnouncement
} from './tileBoardResolutionFeedbackState';

const baseBoard: BoardState = {
    level: 1,
    pairCount: 2,
    columns: 2,
    rows: 2,
    matchedPairs: 0,
    flippedTileIds: ['a1', 'a2'],
    floorArchetypeId: null,
    featuredObjectiveId: null,
    tiles: [
        { id: 'a1', pairKey: 'A', symbol: 'A', label: 'A', state: 'flipped' },
        { id: 'a2', pairKey: 'A', symbol: 'A', label: 'A', state: 'flipped' },
        { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' },
        { id: 'b2', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' }
    ]
};

describe('tileBoardResolutionFeedbackState', () => {
    it('builds reduced-motion last resolution feedback summary', () => {
        expect(buildLastResolutionFeedback({ board: baseBoard, runStatus: 'resolving' })).toBe('match:2');
    });

    it('builds trap resolution announcement details', () => {
        const board: BoardState = {
            ...baseBoard,
            tiles: [
                { id: 'a1', pairKey: 'A', symbol: 'A', label: 'Snare', state: 'hidden', dungeonCardKind: 'trap', dungeonCardState: 'resolved' },
                { id: 'a2', pairKey: 'A', symbol: 'A', label: 'Snare', state: 'hidden', dungeonCardKind: 'trap', dungeonCardState: 'resolved' },
                { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' },
                { id: 'b2', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' }
            ]
        };

        expect(
            buildTrapResolutionAnnouncement({
                board,
                previousResolvedTrapTileCount: 0,
                resolvedTrapTileCount: 2
            })
        ).toEqual({
            details: {
                count: 1,
                effect: 'Trap effect paid',
                next: 'Chase next pair'
            },
            message: 'Trap resolved: Snare. Trap effect paid; Chase next pair.'
        });
        expect(
            shouldClearTrapResolutionAnnouncement({
                resolvedTrapTileCount: 0,
                trapResolutionMessage: 'Trap resolved'
            })
        ).toBe(true);
    });
});
