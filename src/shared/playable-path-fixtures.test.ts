import { describe, expect, it } from 'vitest';
import {
    createPlayablePathFixture,
    PLAYABLE_PATH_FIXTURE_IDS,
    type PlayablePathFixtureId
} from './playable-path-fixtures';

describe('playable path fixtures', () => {
    it('builds every fixture deterministically', () => {
        const firstPass = PLAYABLE_PATH_FIXTURE_IDS.map((id) => createPlayablePathFixture(id));
        const secondPass = PLAYABLE_PATH_FIXTURE_IDS.map((id) => createPlayablePathFixture(id));

        expect(firstPass).toEqual(secondPass);
    });

    it.each([
        ['freshProfile', 'menu', null],
        ['activeRunWithPickupCashout', 'playing', 'playing'],
        ['cascadeClump', 'playing', 'playing'],
        ['floorClearWithRouteChoices', 'playing', 'levelComplete'],
        ['gameOver', 'gameOver', 'gameOver']
    ] satisfies [PlayablePathFixtureId, string, string | null][])(
        '%s exposes the expected view/run status',
        (id, view, status) => {
            const fixture = createPlayablePathFixture(id);

            expect(fixture.view).toBe(view);
            expect(fixture.run?.status ?? null).toBe(status);
            expect(fixture.saveData.schemaVersion).toBeGreaterThan(0);
        }
    );

    it('creates floor-clear and post-run scenario invariants', () => {
        // The floor-clear fixture kept its id from when it offered routes; a cleared floor has one
        // way forward now.
        const routeFixture = createPlayablePathFixture('floorClearWithRouteChoices');
        expect(routeFixture.run?.status).toBe('levelComplete');

        const gameOverFixture = createPlayablePathFixture('gameOver');
        expect(gameOverFixture.run?.lastRunSummary).not.toBeNull();

        const pickupFixture = createPlayablePathFixture('activeRunWithPickupCashout');
        expect(pickupFixture.run?.findablesTotalThisFloor).toBe(1);
        expect(pickupFixture.run?.board?.tiles.filter((tile) => tile.findableKind === 'shard_spark')).toHaveLength(2);
        expect(pickupFixture.run?.stats.currentStreak).toBe(0);
        expect(pickupFixture.run?.stats.comboShards).toBeGreaterThan(0);
    });

});
