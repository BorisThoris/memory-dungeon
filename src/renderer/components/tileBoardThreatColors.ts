import type { EnemyHazardState, HazardTileKind } from '../../shared/contracts';

/**
 * Threat colour is a rule the player reads at a glance — telling a boss from a warden, or a toll
 * cache from a trap, changes what they do next. Both palettes are tuned against the dichromacy
 * simulation in `shared/color-vision.ts` and gated by `tileBoardThreatColors.test.ts`. As shipped,
 * boss and warden sat dE 5.5 apart for a tritanope and warden and sentinel 9.6 apart for a
 * deuteranope; each hue here stayed within 16 degrees of the colour it replaced.
 */
export const ENEMY_HAZARD_COLORS = {
    boss: '#fdaa21',
    observer: '#4edcf0',
    sentinel: '#d94444',
    stalker: '#3953e8',
    warden: '#fef7b9'
} as const;

export const enemyHazardColor = (hazard: EnemyHazardState): string => {
    if (hazard.bossId) return ENEMY_HAZARD_COLORS.boss;
    if (hazard.kind === 'stalker') return ENEMY_HAZARD_COLORS.stalker;
    if (hazard.kind === 'warden') return ENEMY_HAZARD_COLORS.warden;
    if (hazard.kind === 'observer') return ENEMY_HAZARD_COLORS.observer;
    return ENEMY_HAZARD_COLORS.sentinel;
};

/** A trap's state: safe, seen, armed. The one triple where confusing two entries costs a life. */
export const TRAP_STATE_COLORS = {
    armed: '#d94444',
    resolved: '#bef7dc',
    revealed: '#fdcc21'
} as const;

export const HAZARD_TILE_COLORS = {
    cascade_cache: '#21ebfd',
    fragile_cache: '#fdd621',
    mirror_decoy: '#8b4cfd',
    toll_cache: '#bdfcbb',
    trap: '#e73637'
} as const;

export const hazardTileColor = (kind: HazardTileKind): string =>
    kind === 'cascade_cache'
        ? HAZARD_TILE_COLORS.cascade_cache
        : kind === 'mirror_decoy'
          ? HAZARD_TILE_COLORS.mirror_decoy
          : kind === 'fragile_cache'
            ? HAZARD_TILE_COLORS.fragile_cache
            : kind === 'toll_cache'
              ? HAZARD_TILE_COLORS.toll_cache
              : HAZARD_TILE_COLORS.trap;
