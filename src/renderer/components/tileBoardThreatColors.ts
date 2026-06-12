import type { EnemyHazardState, HazardTileKind } from '../../shared/contracts';

export const enemyHazardColor = (hazard: EnemyHazardState): string => {
    if (hazard.bossId) return '#ffcf66';
    if (hazard.kind === 'stalker') return '#9cb7ff';
    if (hazard.kind === 'warden') return '#f2d39d';
    if (hazard.kind === 'observer') return '#87d8ee';
    return '#ff9f86';
};

export const hazardTileColor = (kind: HazardTileKind): string =>
    kind === 'cascade_cache'
        ? '#5ee0c8'
        : kind === 'mirror_decoy'
          ? '#b99cff'
          : kind === 'fragile_cache'
            ? '#ffcf66'
            : kind === 'toll_cache'
              ? '#7bd88f'
              : '#ff9f86';
