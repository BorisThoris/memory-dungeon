import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION, type RunState } from './contracts';
import { applyBossReward, BLUEPRINT_ORDER, BOSS_REWARD_RULES_FROM, BOSS_WILD_GOLD, bossRewardFor, offersBossDoors } from './boss-reward-rules';
import { isActBossFloor } from './floor-mutator-schedule';
import { finalizeLevel } from './floor-clear-transition';
import { createNewRun, finishMemorizePhase } from './game';

const runAt = (level: number, extra: Partial<RunState> = {}): RunState => {
    const base = finishMemorizePhase(createNewRun(0, { runSeed: 2626, gameMode: 'endless' }));
    return { ...base, board: { ...base.board!, level }, ...extra };
};

describe('boss rewards by the door (DGE-026)', () => {
    it('knows the act bosses: 24, 40, 60, and each Endless act’s last floor', () => {
        expect([23, 24, 25, 39, 40, 59, 60].map(isActBossFloor)).toEqual([false, true, false, false, true, false, true]);
        expect(isActBossFloor(7)).toBe(false);
    });

    it('offers doors on the clear before an act boss only', () => {
        expect(offersBossDoors(runAt(23))).toBe(true);
        expect(offersBossDoors(runAt(22))).toBe(false);
        expect(offersBossDoors(runAt(24))).toBe(false);
        expect(offersBossDoors(runAt(23, { runRulesVersion: BOSS_REWARD_RULES_FROM - 1 }))).toBe(false);
    });

    it('pays the clear on calm, gold on wild, the next blueprint on raging, in order', () => {
        expect(bossRewardFor('calm', [])).toEqual({ kind: 'clear' });
        expect(bossRewardFor('wild', [])).toEqual({ kind: 'gold', gold: BOSS_WILD_GOLD });
        expect(bossRewardFor('raging', [])).toEqual({ kind: 'blueprint', blueprint: BLUEPRINT_ORDER[0] });
        expect(bossRewardFor('raging', [BLUEPRINT_ORDER[0]])).toEqual({ kind: 'blueprint', blueprint: BLUEPRINT_ORDER[1] });
        // Every blueprint held: raging pays the wild gold.
        expect(bossRewardFor('raging', [...BLUEPRINT_ORDER])).toEqual({ kind: 'gold', gold: BOSS_WILD_GOLD });
    });

    it('a later boss beaten first on raging still drops the first blueprint, and the same state the same reward', () => {
        const at40 = applyBossReward(runAt(40, { gold: 0 }), 40, 'raging');
        expect(at40.blueprints).toEqual([BLUEPRINT_ORDER[0]]);
        expect(applyBossReward(runAt(40, { gold: 0 }), 40, 'raging')).toEqual(at40);
        expect(applyBossReward(at40, 60, 'raging').blueprints).toEqual([BLUEPRINT_ORDER[0], BLUEPRINT_ORDER[1]]);
        expect(applyBossReward(runAt(40, { gold: 5 }), 40, 'wild').gold).toBe(5 + BOSS_WILD_GOLD);
        // Not an act boss: nothing.
        expect(applyBossReward(runAt(23, { gold: 5 }), 23, 'raging')).toEqual(runAt(23, { gold: 5 }));
    });

    it('the clear before floor 24 offers three doors and picks none, and floor 24’s clear pays by its severity', () => {
        const base = runAt(23, { realmId: 'storm', realmSeverity: 'calm', runRulesVersion: GAME_RULES_VERSION });
        const cleared = finalizeLevel(base, { ...base.board!, matchedPairs: base.board!.pairCount, tiles: base.board!.tiles.map((t) => ({ ...t, state: 'matched' as const })) });
        expect(cleared.realmDoors).toHaveLength(3);
        expect(new Set(cleared.realmDoors!.map((door) => door.severity))).toEqual(new Set(['calm', 'wild', 'raging']));
        expect(cleared.nextRealm).toBeNull();
        const boss = runAt(24, { realmId: 'storm', realmSeverity: 'raging', runRulesVersion: GAME_RULES_VERSION, blueprints: [] });
        const won = finalizeLevel(boss, { ...boss.board!, matchedPairs: boss.board!.pairCount, tiles: boss.board!.tiles.map((t) => ({ ...t, state: 'matched' as const })) });
        expect(won.blueprints).toEqual([BLUEPRINT_ORDER[0]]);
        expect(won.lastBossReward).toEqual({ kind: 'blueprint', blueprint: BLUEPRINT_ORDER[0] });
    });
});
