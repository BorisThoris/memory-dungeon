import { describe, expect, it } from 'vitest';
import { countFindablePairs } from './board-tile-generation-rules';
import { createDungeonShowcaseRun } from './dungeon-showcase-run-rules';

describe('createDungeonShowcaseRun', () => {
    it('creates a playing practice dungeon showcase on the authored showcase board', () => {
        const run = createDungeonShowcaseRun(125);

        expect(run.status).toBe('playing');
        expect(run.practiceMode).toBe(true);
        expect(run.dungeonShowcaseRun).toBe(true);
        expect(run.runSeed).toBe(72_001);
        expect(run.activeMutators).toEqual(['wide_recall']);
        expect(run.board).toMatchObject({
            level: 5,
            floorArchetypeId: 'survey_hall',
            floorTag: 'normal'
        });
        expect(run.findablesTotalThisFloor).toBe(countFindablePairs(run.board!.tiles));
        expect(run.lastLevelResult).toBeNull();
    });

    it('honors explicit showcase seed and mutators', () => {
        const run = createDungeonShowcaseRun(0, {
            activeMutators: ['silhouette_twist'],
            runSeed: 77
        });

        expect(run.runSeed).toBe(77);
        expect(run.activeMutators).toEqual(['silhouette_twist']);
    });
});
