import { describe, expect, it } from 'vitest';
import { colorDistance, findConfusablePairs, hexToRgb } from '../../shared/color-vision';
import {
    ENEMY_HAZARD_COLORS,
    HAZARD_TILE_COLORS,
    TRAP_STATE_COLORS,
    enemyHazardColor,
    hazardTileColor
} from './tileBoardThreatColors';
import { TRAIT_LANE_COLORS, getTraitLaneReadabilityColor } from './tileBoardReadability';
import type { EnemyHazardState } from '../../shared/contracts';

/**
 * Threat colour is a rule, not decoration: a boss and a warden ask for different play. As shipped,
 * boss and warden were dE 5.5 apart for a tritanope and warden and sentinel 9.6 apart for a
 * deuteranope, so those players were reading one marker where the game meant two.
 */
const MIN_THREAT_COLOR_DISTANCE = 25;
const BOARD_GROUND = '#090d18';
const MIN_GROUND_CONTRAST = 45;

const hazard = (over: Partial<EnemyHazardState>): EnemyHazardState => over as EnemyHazardState;

describe('threat palettes', () => {
    for (const [label, palette] of [
        ['enemy hazard', ENEMY_HAZARD_COLORS],
        ['hazard tile', HAZARD_TILE_COLORS],
        ['trap state', TRAP_STATE_COLORS],
        ['trait lane', TRAIT_LANE_COLORS]
    ] as const) {
        it(`keeps every ${label} colour apart for every kind of colour vision`, () => {
            const confusable = findConfusablePairs(palette, MIN_THREAT_COLOR_DISTANCE);
            for (const pair of confusable) {
                console.log(`THREAT PALETTE ${label} ${pair.vision}: ${pair.left} vs ${pair.right} = dE ${pair.distance.toFixed(1)}`);
            }
            expect(confusable).toEqual([]);
        });

        it(`keeps every ${label} colour readable against the board`, () => {
            const ground = hexToRgb(BOARD_GROUND);
            const faint = Object.entries(palette)
                .map(([kind, hex]) => ({ distance: colorDistance(hexToRgb(hex), ground), kind }))
                .filter((row) => row.distance < MIN_GROUND_CONTRAST);
            expect(faint).toEqual([]);
        });
    }

    it('routes each hazard kind to its own entry, so the gate covers what the board actually draws', () => {
        expect(enemyHazardColor(hazard({ bossId: 'trap_warden', kind: 'warden' }))).toBe(ENEMY_HAZARD_COLORS.boss);
        expect(enemyHazardColor(hazard({ kind: 'warden' }))).toBe(ENEMY_HAZARD_COLORS.warden);
        expect(enemyHazardColor(hazard({ kind: 'stalker' }))).toBe(ENEMY_HAZARD_COLORS.stalker);
        expect(enemyHazardColor(hazard({ kind: 'observer' }))).toBe(ENEMY_HAZARD_COLORS.observer);
        expect(enemyHazardColor(hazard({ kind: 'sentinel' }))).toBe(ENEMY_HAZARD_COLORS.sentinel);

        expect(hazardTileColor('cascade_cache')).toBe(HAZARD_TILE_COLORS.cascade_cache);
        expect(hazardTileColor('mirror_decoy')).toBe(HAZARD_TILE_COLORS.mirror_decoy);
        expect(hazardTileColor('fragile_cache')).toBe(HAZARD_TILE_COLORS.fragile_cache);
        expect(hazardTileColor('toll_cache')).toBe(HAZARD_TILE_COLORS.toll_cache);

        for (const lane of ['shard', 'guard', 'tool', 'risk', 'block', 'recall'] as const) {
            expect(getTraitLaneReadabilityColor(lane)).toBe(TRAIT_LANE_COLORS[lane]);
        }
    });
});
