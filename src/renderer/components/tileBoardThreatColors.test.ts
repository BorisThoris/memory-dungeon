import { describe, expect, it } from 'vitest';
import type { EnemyHazardState } from '../../shared/contracts';
import { enemyHazardColor, hazardTileColor } from './tileBoardThreatColors';

const enemy = (kind: EnemyHazardState['kind'], bossId?: EnemyHazardState['bossId']): EnemyHazardState =>
    ({
        id: `${kind}-1`,
        kind,
        bossId,
        label: kind,
        currentTileId: 'a',
        nextTileId: 'b',
        hp: 1,
        maxHp: 1,
        pattern: 'patrol',
        damage: 1,
        state: 'revealed'
    }) as EnemyHazardState;

describe('tileBoardThreatColors', () => {
    it('prioritizes boss hazard color over enemy kind', () => {
        expect(enemyHazardColor(enemy('stalker', 'trap_warden'))).toBe('#ffcf66');
    });

    it('maps enemy kinds to readable board colors', () => {
        expect(enemyHazardColor(enemy('stalker'))).toBe('#9cb7ff');
        expect(enemyHazardColor(enemy('warden'))).toBe('#f2d39d');
        expect(enemyHazardColor(enemy('observer'))).toBe('#87d8ee');
    });

    it('maps hazard tile kinds to board accent colors', () => {
        expect(hazardTileColor('cascade_cache')).toBe('#5ee0c8');
        expect(hazardTileColor('mirror_decoy')).toBe('#b99cff');
        expect(hazardTileColor('fragile_cache')).toBe('#ffcf66');
        expect(hazardTileColor('toll_cache')).toBe('#7bd88f');
    });
});
