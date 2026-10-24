import { describe, expect, it } from 'vitest';
import { DEEP_CENSUS_FLOORS, DEEP_OCCUPANCY_COUNTERS, judgeDeepCensus } from './deep-census';

describe('the deep census (DGE-027)', () => {
    it('names a deep counter that never fired, and nothing when all did', () => {
        const rows = DEEP_OCCUPANCY_COUNTERS.map((counter) => ({ key: counter.id, label: counter.label, runFloorShare: 0.1 }));
        expect(judgeDeepCensus({ rows } as never)).toEqual([]);
        const silent = rows.map((row, index) => (index === 0 ? { ...row, runFloorShare: 0 } : row));
        expect(judgeDeepCensus({ rows: silent } as never)).toEqual([`${rows[0]!.key} (${rows[0]!.label}) never fired to floor ${DEEP_CENSUS_FLOORS}`]);
    });

    it('watches tallies and states, the board by the reference player and the verbs by the planned one, each under its own id', () => {
        expect(new Set(DEEP_OCCUPANCY_COUNTERS.map((counter) => counter.id)).size).toBe(DEEP_OCCUPANCY_COUNTERS.length);
        expect(DEEP_OCCUPANCY_COUNTERS.every((counter) => (counter.player === 'reference' || counter.player === 'planned') && counter.kind !== 'spend')).toBe(true);
        expect(DEEP_OCCUPANCY_COUNTERS.filter((counter) => counter.player === 'planned').map((counter) => counter.id)).toEqual(['deep.holdReleases', 'deep.carvesSpent', 'deep.reprises']);
    });
});
