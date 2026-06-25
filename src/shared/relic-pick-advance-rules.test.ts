import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import { createNewRun } from './run-creation-rules';
import { grantBonusRelicPickNextOffer } from './relic-immediate-rules';
import { openRelicOffer } from './relic-offer-rules';
import { completeRelicPickAndAdvance } from './relic-pick-advance-rules';
import { isSingletonUtilityPairKey } from './tile-identity';

const levelCompleteRun = (overrides: Partial<RunState> = {}): RunState => ({
    ...createNewRun(999, { gameMode: 'endless' }),
    status: 'levelComplete',
    lastLevelResult: {
        clearLifeGained: 0,
        clearLifeReason: 'none',
        level: 3,
        livesRemaining: 3,
        mistakes: 0,
        perfect: false,
        rating: 'S',
        scoreGained: 1
    },
    ...overrides
});

describe('completeRelicPickAndAdvance', () => {
    it('leaves stale or invalid picks unchanged', () => {
        const run = levelCompleteRun({
            relicIds: ['extra_shuffle_charge'],
            relicOffer: {
                options: ['extra_shuffle_charge'],
                pickRound: 0,
                picksRemaining: 1,
                tier: 1
            }
        });

        expect(completeRelicPickAndAdvance(run, 'extra_shuffle_charge')).toBe(run);
    });

    it('keeps multi-pick offers open and advances after the final pick', () => {
        let run = openRelicOffer(grantBonusRelicPickNextOffer(levelCompleteRun(), 1));
        const first = run.relicOffer!.options[0]!;

        run = completeRelicPickAndAdvance(run, first);

        expect(run.status).toBe('levelComplete');
        expect(run.relicOffer?.picksRemaining).toBe(1);

        const second = run.relicOffer!.options[0]!;
        const next = completeRelicPickAndAdvance(run, second);

        expect(next.status).toBe('memorize');
        expect(next.relicOffer).toBeNull();
        expect(next.relicIds).toEqual(expect.arrayContaining([first, second]));
    });

    it('repairs stale boss hazards before keeping a multi-pick offer open', () => {
        const base = levelCompleteRun();
        const pairKey = base.board!.tiles.find((tile) => !isSingletonUtilityPairKey(tile.pairKey))!.pairKey;
        const pairTiles = base.board!.tiles.filter((tile) => tile.pairKey === pairKey).slice(0, 2);
        const board = {
            ...base.board!,
            dungeonBossId: 'trap_warden' as const,
            enemyHazards: [
                {
                    bossId: 'trap_warden' as const,
                    currentTileId: pairTiles[0]!.id,
                    damage: 1,
                    hp: 1,
                    id: 'stale-warden',
                    kind: 'warden' as const,
                    label: 'Stale Warden',
                    maxHp: 1,
                    nextTileId: pairTiles[1]!.id,
                    pattern: 'guard' as const,
                    state: 'revealed' as const
                }
            ],
            tiles: base.board!.tiles.map((tile) =>
                isSingletonUtilityPairKey(tile.pairKey) ? tile : { ...tile, state: 'matched' as const }
            )
        };
        const run = openRelicOffer(
            grantBonusRelicPickNextOffer({
                ...base,
                board,
                dungeonEnemiesDefeated: 0,
                dungeonEnemiesDefeatedThisFloor: 0,
                enemyHazardsDefeatedThisFloor: 0
            })
        );

        const next = completeRelicPickAndAdvance(run, run.relicOffer!.options[0]!);

        expect(next.status).toBe('levelComplete');
        expect(next.board?.enemyHazards?.[0]).toMatchObject({ hp: 0, state: 'defeated' });
        expect(next.dungeonEnemiesDefeated).toBe(1);
        expect(next.enemyHazardsDefeatedThisFloor).toBe(1);
    });
});
