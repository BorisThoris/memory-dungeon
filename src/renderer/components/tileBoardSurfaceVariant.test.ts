import { describe, expect, it } from 'vitest';
import type { Tile } from '../../shared/contracts';
import { getTileBoardSurfaceVariant } from './tileBoardSurfaceVariant';

const tile = (state: Tile['state'] = 'hidden'): Tile =>
    ({
        id: 'tile-a',
        pairKey: 'pair-a',
        label: 'A',
        state
    }) as Tile;

describe('tileBoardSurfaceVariant', () => {
    it('renders matched tiles as matched regardless of face direction or resolving state', () => {
        expect(getTileBoardSurfaceVariant(tile('matched'), false, null)).toBe('matched');
        expect(getTileBoardSurfaceVariant(tile('matched'), true, 'mismatch')).toBe('matched');
    });

    it('maps face-up resolving states to their visible variants', () => {
        expect(getTileBoardSurfaceVariant(tile('flipped'), true, 'mismatch')).toBe('mismatch');
        expect(getTileBoardSurfaceVariant(tile('flipped'), true, 'gambitNeutral')).toBe('active');
        expect(getTileBoardSurfaceVariant(tile('flipped'), true, 'match')).toBe('active');
    });

    it('maps normal face direction to active or hidden variants', () => {
        expect(getTileBoardSurfaceVariant(tile('hidden'), true, null)).toBe('active');
        expect(getTileBoardSurfaceVariant(tile('hidden'), false, null)).toBe('hidden');
    });
});
