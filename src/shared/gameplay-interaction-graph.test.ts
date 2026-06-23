import { describe, expect, it } from 'vitest';
import {
    gameplayInteractionGraph,
    getGameplayInteractionEdgesForMechanic,
    validateGameplayInteractionGraph
} from './gameplay-interaction-graph';
import type { TileTraitKind } from './contracts';

const TILE_TRAIT_KINDS: readonly TileTraitKind[] = [
    'echo',
    'volatile',
    'mirror',
    'cursed',
    'sealed',
    'heavy',
    'drift',
    'conduit',
    'stasis'
];

describe('gameplay interaction graph', () => {
    it('keeps the executable graph connected and guarded', () => {
        expect(validateGameplayInteractionGraph()).toEqual([]);
    });

    it('registers every tile trait as an interacting third-layer mechanic', () => {
        expect(gameplayInteractionGraph.coverage.tileTraits).toEqual(TILE_TRAIT_KINDS);

        for (const trait of TILE_TRAIT_KINDS) {
            const mechanicId = `trait.${trait}`;
            const mechanic = gameplayInteractionGraph.mechanics.find((candidate) => candidate.id === mechanicId);
            expect(mechanic, mechanicId).toBeTruthy();
            expect(mechanic?.kind).toBe('trait');
            expect(getGameplayInteractionEdgesForMechanic(mechanicId).length, mechanicId).toBeGreaterThan(0);
            expect(mechanic?.tests.length, mechanicId).toBeGreaterThan(0);
        }
    });

    it('requires blockers to declare counterplay or softlock guards', () => {
        const blockers = gameplayInteractionGraph.mechanics.filter((mechanic) => mechanic.blocks.length > 0);

        expect(blockers.map((mechanic) => mechanic.id)).toEqual(
            expect.arrayContaining([
                'trait.stasis',
                'hazard.enemy_patrol',
                'boss.moving_patrol',
                'exit.primary',
                'lock.iron_key',
                'objective.defeat_boss'
            ])
        );
        expect(blockers.every((mechanic) => mechanic.softlockGuards.length > 0)).toBe(true);
    });

    it('connects boss, exit, lock, and floor-clear mechanics through safety edges', () => {
        expect(gameplayInteractionGraph.edges).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ source: 'boss.moving_patrol', target: 'safety.softlock_fairness' }),
                expect.objectContaining({ source: 'objective.defeat_boss', target: 'exit.primary' }),
                expect.objectContaining({ source: 'lock.iron_key', target: 'exit.primary' }),
                expect.objectContaining({ source: 'exit.primary', target: 'objective.floor_clear' }),
                expect.objectContaining({ source: 'safety.softlock_fairness', target: 'objective.floor_clear' })
            ])
        );
    });
});
