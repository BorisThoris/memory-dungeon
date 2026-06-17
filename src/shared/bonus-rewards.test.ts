import { describe, expect, it } from 'vitest';
import {
    BONUS_REWARD_CATALOG,
    claimBonusReward,
    createBonusRewardLedger,
    previewBonusRewardClaim,
    resolveBonusRewardRoomByInstanceId,
    rollBonusRewardDraft,
    rollBonusRewardRoom,
    getBonusRewardRows
} from './bonus-rewards';
import { GAME_RULES_VERSION, MAX_COMBO_SHARDS, MAX_GUARD_TOKENS, type RunState } from './contracts';

const makeRun = (runSeed = 75_000, runRulesVersion = GAME_RULES_VERSION): RunState =>
    ({
        runSeed,
        runRulesVersion,
        shopGold: 1,
        relicFavorProgress: 2,
        bonusRelicPicksNextOffer: 0,
        favorBonusRelicPicksNextOffer: 0,
        destroyPairCharges: 0,
        peekCharges: 0,
        dungeonKeys: {},
        dungeonMasterKeys: 0,
        stats: { totalScore: 10, currentLevelScore: 10, comboShards: 0, guardTokens: 0 }
    }) as RunState;

describe('REG-075 treasure, secret room, and bonus rewards', () => {
    it('rolls deterministic local reward rooms with anti-grind eligibility', () => {
        const ledger = createBonusRewardLedger();
        const a = rollBonusRewardRoom({
            runSeed: 75_001,
            rulesVersion: GAME_RULES_VERSION,
            floor: 6,
            routeKind: 'treasure',
            ledger
        });
        const b = rollBonusRewardRoom({
            runSeed: 75_001,
            rulesVersion: GAME_RULES_VERSION,
            floor: 6,
            routeKind: 'treasure',
            ledger
        });

        expect(a).toEqual(b);
        expect(a.roomKind).toBe('treasure_chest');
        expect(a.offlineOnly).toBe(true);
        expect(a.eligible).toBe(true);
        expect(a.summaryText.length).toBeGreaterThan(0);
        expect(getBonusRewardRows().some((row) => row.id === 'chest_gold' && row.antiGrindLimit === '2 per run')).toBe(true);
    });

    it('bounds secret rooms and reports anti-grind disabled reasons', () => {
        const capped = { ...createBonusRewardLedger(), discoveredSecretRooms: 1 };
        const room = {
            ...rollBonusRewardRoom({ runSeed: 75_002, rulesVersion: GAME_RULES_VERSION, floor: 8, routeKind: 'treasure', ledger: capped }),
            ...BONUS_REWARD_CATALOG.secret_favor,
            eligible: false,
            unavailableReason: 'Secret room already discovered this run.'
        };

        expect(room.roomKind).toBe('secret_room');
        expect(room.eligible).toBe(false);
        expect(room.unavailableReason).toContain('already discovered');
    });

    it('applies local reward previews without persistent save state', () => {
        const room = rollBonusRewardRoom({
            runSeed: 75_003,
            rulesVersion: GAME_RULES_VERSION,
            floor: 9,
            routeKind: 'treasure'
        });
        const run = makeRun(room.runSeed, room.rulesVersion);
        const ledger = createBonusRewardLedger();
        const result = claimBonusReward(run, ledger, room);

        expect(result.claimed).toBe(true);
        expect(result.rewardId).toBe(room.id);
        expect(result.run.shopGold).toBeGreaterThanOrEqual(1);
        expect(result.run.stats.comboShards).toBeGreaterThanOrEqual(0);
        expect(result.feedback.gained.length).toBeGreaterThan(0);
        expect(claimBonusReward(result.run, result.ledger, room).claimed).toBe(false);
    });

    it('rechecks reward limits at claim time for stale saved reward instances', () => {
        const room = {
            ...rollBonusRewardRoom({
                runSeed: 75_013,
                rulesVersion: GAME_RULES_VERSION,
                floor: 9,
                routeKind: 'treasure'
            }),
            instanceId: `${GAME_RULES_VERSION}:75013:10:chest_gold`,
            eligible: true,
            unavailableReason: null
        };
        const run = makeRun(room.runSeed, room.rulesVersion);
        const cappedLedger = {
            ...createBonusRewardLedger(),
            claimedRewardIds: { chest_gold: 2 }
        };
        const malformedLedger = {
            ...createBonusRewardLedger(),
            claimedRewardIds: { chest_gold: Number.NaN }
        };

        expect(claimBonusReward(run, cappedLedger, room)).toMatchObject({
            claimed: false,
            reason: 'ineligible',
            feedback: { summary: 'Treasure chest claim limit reached for this run.' }
        });
        expect(claimBonusReward(run, malformedLedger, room).claimed).toBe(true);
    });

    it('normalizes malformed saved reward ledgers before duplicate-claim checks', () => {
        const room = {
            ...rollBonusRewardRoom({
                runSeed: 75_015,
                rulesVersion: GAME_RULES_VERSION,
                floor: 6,
                routeKind: 'event'
            }),
            ...BONUS_REWARD_CATALOG.supply_cache,
            eligible: true,
            unavailableReason: null
        };
        const run = makeRun(room.runSeed, room.rulesVersion);
        const malformedLedger = {
            claimedInstanceIds: [room.instanceId, room.instanceId, 42],
            claimedRewardIds: { supply_cache: 1.8, missing_reward: 99 },
            discoveredSecretRooms: Number.NaN,
            openedTreasureRooms: -3
        } as unknown as RunState['bonusRewardLedger'];

        const result = claimBonusReward(run, malformedLedger, room);

        expect(result).toMatchObject({
            claimed: false,
            reason: 'already_claimed',
            ledger: {
                claimedInstanceIds: [room.instanceId],
                claimedRewardIds: { supply_cache: 1 },
                discoveredSecretRooms: 0,
                openedTreasureRooms: 0
            }
        });
    });

    it('falls through to another treasure reward when the preferred chest is capped', () => {
        const room = rollBonusRewardRoom({
            runSeed: 75_014,
            rulesVersion: GAME_RULES_VERSION,
            floor: 6,
            routeKind: 'treasure',
            ledger: {
                ...createBonusRewardLedger(),
                claimedRewardIds: { chest_gold: 2 }
            }
        });

        expect(room.id).toBe('trait_toolkit');
        expect(room.eligible).toBe(true);
        expect(room.unavailableReason).toBeNull();
    });

    it('keeps deterministic event rewards useful when the seeded candidate is already capped', () => {
        const room = rollBonusRewardRoom({
            runSeed: 75_002,
            rulesVersion: GAME_RULES_VERSION,
            floor: 5,
            routeKind: 'event',
            ledger: {
                ...createBonusRewardLedger(),
                claimedRewardIds: { bonus_shards: 2 }
            }
        });

        expect(room.id).toBe('supply_cache');
        expect(room.eligible).toBe(true);
        expect(room.unavailableReason).toBeNull();
    });

    it('adds supply caches to deterministic reward variety with useful consumables', () => {
        const row = getBonusRewardRows().find((reward) => reward.id === 'supply_cache');
        const room = {
            ...rollBonusRewardRoom({
                runSeed: 75_006,
                rulesVersion: GAME_RULES_VERSION,
                floor: 5,
                routeKind: 'event'
            }),
            ...BONUS_REWARD_CATALOG.supply_cache,
            eligible: true,
            unavailableReason: null
        };
        const result = claimBonusReward(makeRun(room.runSeed, room.rulesVersion), createBonusRewardLedger(), room);

        expect(row).toMatchObject({
            label: 'Supply cache',
            summaryText: '+1 destroy charge, +1 peek charge, and +10 score.'
        });
        expect(result.claimed).toBe(true);
        expect(result.run.destroyPairCharges).toBe(1);
        expect(result.run.peekCharges).toBe(1);
        expect(result.feedback.gained).toEqual(expect.arrayContaining(['+1 destroy charge', '+1 peek charge', '+10 score']));
    });

    it('rolls deterministic reward drafts with build-defining trait, key, and hazard options', () => {
        const draft = rollBonusRewardDraft({
            runSeed: 75_102,
            rulesVersion: GAME_RULES_VERSION,
            floor: 6,
            routeKind: 'treasure'
        });

        expect(draft).toHaveLength(3);
        expect(rollBonusRewardDraft({
            runSeed: 75_102,
            rulesVersion: GAME_RULES_VERSION,
            floor: 6,
            routeKind: 'treasure'
        }).map((reward) => reward.instanceId)).toEqual(draft.map((reward) => reward.instanceId));
        expect(draft.map((reward) => reward.id)).toEqual(
            expect.arrayContaining(['trait_toolkit', 'key_insurance'])
        );
        expect(getBonusRewardRows().find((reward) => reward.id === 'trait_toolkit')).toMatchObject({
            label: 'Trait toolkit',
            summaryText: '+1 row/swap charge, +1 peek charge, and +10 score.'
        });
    });

    it('claims new reward draft rows through the same capped inventory feedback path', () => {
        const room = {
            ...rollBonusRewardRoom({
                runSeed: 75_107,
                rulesVersion: GAME_RULES_VERSION,
                floor: 6,
                routeKind: 'treasure'
            }),
            ...BONUS_REWARD_CATALOG.trait_toolkit,
            eligible: true,
            unavailableReason: null
        };
        const result = claimBonusReward(makeRun(room.runSeed, room.rulesVersion), createBonusRewardLedger(), room);

        expect(result.claimed).toBe(true);
        expect(result.run.regionShuffleCharges).toBe(1);
        expect(result.run.peekCharges).toBe(1);
        expect(result.feedback.gained).toEqual(
            expect.arrayContaining(['+1 row/swap charge', '+1 peek charge', '+10 score'])
        );
    });

    it('unlocks durable reward perks from build-defining draft rows without duplicating them', () => {
        const room = {
            ...rollBonusRewardRoom({
                runSeed: 75_108,
                rulesVersion: GAME_RULES_VERSION,
                floor: 6,
                routeKind: 'event'
            }),
            ...BONUS_REWARD_CATALOG.echo_conduit_lens,
            eligible: true,
            unavailableReason: null
        };
        const run = makeRun(room.runSeed, room.rulesVersion);
        const result = claimBonusReward(run, createBonusRewardLedger(), room);
        const duplicate = claimBonusReward(
            { ...run, rewardPerkIds: ['echo_conduit_double'] },
            createBonusRewardLedger(),
            room
        );

        expect(result.claimed).toBe(true);
        expect(result.run.rewardPerkIds).toContain('echo_conduit_double');
        expect(result.feedback.gained).toEqual(
            expect.arrayContaining(['Unlock Echo doubles beside Conduit', '+1 peek charge'])
        );
        expect(duplicate.feedback.gained).not.toContain('Unlock Echo doubles beside Conduit');
    });

    it('resolves a saved reward instance even when the current route roll picks another candidate', () => {
        const instanceId = `${GAME_RULES_VERSION}:75008:5:bonus_shards`;
        const resolved = resolveBonusRewardRoomByInstanceId({
            runSeed: 75_008,
            rulesVersion: GAME_RULES_VERSION,
            floor: 5,
            routeKind: 'event',
            instanceId
        });

        expect(resolved).toMatchObject({
            id: 'bonus_shards',
            instanceId,
            eligible: true
        });
    });

    it('reports capped pickup feedback while still applying useful inventory rewards', () => {
        const room = {
            ...rollBonusRewardRoom({
                runSeed: 75_004,
                rulesVersion: GAME_RULES_VERSION,
                floor: 7,
                routeKind: 'event'
            }),
            ...BONUS_REWARD_CATALOG.bonus_shards,
            eligible: true,
            unavailableReason: null
        };
        const run = {
            ...makeRun(room.runSeed, room.rulesVersion),
            stats: { ...makeRun().stats, comboShards: MAX_COMBO_SHARDS, guardTokens: 0 }
        } as RunState;
        const preview = previewBonusRewardClaim(run, room);
        const result = claimBonusReward(run, createBonusRewardLedger(), room);

        expect(preview.eligible).toBe(true);
        expect(preview.rewardId).toBe('bonus_shards');
        expect(preview.feedback).toEqual(result.feedback);
        expect(preview.run.stats.currentLevelScore).toBe(result.run.stats.currentLevelScore);
        expect(preview.run.stats.guardTokens).toBe(result.run.stats.guardTokens);
        expect(result.claimed).toBe(true);
        expect(result.run.stats.comboShards).toBe(MAX_COMBO_SHARDS);
        expect(result.run.stats.guardTokens).toBe(1);
        expect(result.feedback.capped).toContain('Combo shards already full');
        expect(result.feedback.gained).toContain('+1 guard token');
        expect(result.feedback.gained).toContain('+5 overflow score');
        expect(result.run.stats.currentLevelScore).toBe(run.stats.currentLevelScore + 5);
    });

    it('pluralizes multi-shard reward feedback for future pickup variety', () => {
        const room = {
            ...rollBonusRewardRoom({
                runSeed: 75_012,
                rulesVersion: GAME_RULES_VERSION,
                floor: 7,
                routeKind: 'event'
            }),
            ...BONUS_REWARD_CATALOG.bonus_shards,
            payout: { comboShards: 2 },
            eligible: true,
            unavailableReason: null
        };
        const result = claimBonusReward(makeRun(room.runSeed, room.rulesVersion), createBonusRewardLedger(), room);

        expect(result.claimed).toBe(true);
        expect(result.run.stats.comboShards).toBe(2);
        expect(result.feedback.gained).toContain('+2 combo shards');
    });

    it('does not report capped inventory pickups as gained rewards', () => {
        const room = {
            ...rollBonusRewardRoom({
                runSeed: 75_005,
                rulesVersion: GAME_RULES_VERSION,
                floor: 7,
                routeKind: 'event'
            }),
            ...BONUS_REWARD_CATALOG.bonus_shards,
            eligible: true,
            unavailableReason: null
        };
        const run = {
            ...makeRun(room.runSeed, room.rulesVersion),
            stats: { ...makeRun().stats, comboShards: 0, guardTokens: MAX_GUARD_TOKENS }
        } as RunState;
        const result = claimBonusReward(run, createBonusRewardLedger(), room);

        expect(result.claimed).toBe(true);
        expect(result.run.stats.comboShards).toBe(1);
        expect(result.run.stats.guardTokens).toBe(MAX_GUARD_TOKENS);
        expect(result.feedback.gained).toContain('+1 combo shard');
        expect(result.feedback.gained).toContain('+5 overflow score');
        expect(result.feedback.gained).not.toContain('+1 guard token');
        expect(result.feedback.capped).toContain('Guard tokens already full');
    });

    it('converts all-capped pickup rewards into fallback score before claiming', () => {
        const room = {
            ...rollBonusRewardRoom({
                runSeed: 75_007,
                rulesVersion: GAME_RULES_VERSION,
                floor: 7,
                routeKind: 'event'
            }),
            ...BONUS_REWARD_CATALOG.bonus_shards,
            eligible: true,
            unavailableReason: null
        };
        const run = {
            ...makeRun(room.runSeed, room.rulesVersion),
            stats: { ...makeRun().stats, comboShards: MAX_COMBO_SHARDS, guardTokens: MAX_GUARD_TOKENS }
        } as RunState;
        const result = claimBonusReward(run, createBonusRewardLedger(), room);

        expect(result.claimed).toBe(true);
        expect(result.run.stats.currentLevelScore).toBe(run.stats.currentLevelScore + 10);
        expect(result.feedback.gained).toEqual(['+10 overflow score']);
        expect(result.feedback.capped).toEqual(['Combo shards already full', 'Guard tokens already full']);
    });

    it('previews ineligible reward feedback without mutating the run', () => {
        const room = {
            ...rollBonusRewardRoom({
                runSeed: 75_010,
                rulesVersion: GAME_RULES_VERSION,
                floor: 1,
                routeKind: 'treasure'
            }),
            ...BONUS_REWARD_CATALOG.chest_gold,
            eligible: false,
            unavailableReason: 'Bonus rooms unlock after floor 1.'
        };
        const run = makeRun();
        const preview = previewBonusRewardClaim(run, room);

        expect(preview).toMatchObject({
            eligible: false,
            rewardId: 'chest_gold',
            reason: 'ineligible',
            feedback: {
                summary: 'Bonus rooms unlock after floor 1.',
                gained: [],
                capped: []
            }
        });
        expect(preview.run).toBe(run);
    });

    it('deduplicates capped feedback when one reward hits the same inventory limit twice', () => {
        const room = {
            ...rollBonusRewardRoom({
                runSeed: 75_009,
                rulesVersion: GAME_RULES_VERSION,
                floor: 7,
                routeKind: 'event'
            }),
            ...BONUS_REWARD_CATALOG.bonus_shards,
            payout: {
                comboShards: 1,
                inventoryItems: { combo_shard: 1, guard_token: 1 }
            },
            eligible: true,
            unavailableReason: null
        };
        const run = {
            ...makeRun(room.runSeed, room.rulesVersion),
            stats: { ...makeRun().stats, comboShards: MAX_COMBO_SHARDS, guardTokens: MAX_GUARD_TOKENS }
        } as RunState;
        const result = claimBonusReward(run, createBonusRewardLedger(), room);

        expect(result.claimed).toBe(true);
        expect(result.feedback.gained).toEqual(['+10 overflow score']);
        expect(result.feedback.capped).toEqual(['Combo shards already full', 'Guard tokens already full']);
        expect(result.feedback.summary).toBe('+10 overflow score; Combo shards already full; Guard tokens already full');
    });

    it('ignores malformed numeric reward payloads before they can poison run counters', () => {
        const room = {
            ...rollBonusRewardRoom({
                runSeed: 75_011,
                rulesVersion: GAME_RULES_VERSION,
                floor: 7,
                routeKind: 'event'
            }),
            ...BONUS_REWARD_CATALOG.supply_cache,
            payout: {
                shopGold: Number.NaN,
                score: Number.POSITIVE_INFINITY,
                comboShards: Number.NEGATIVE_INFINITY,
                relicFavorProgress: -2,
                inventoryItems: { peek_charge: Number.NaN, destroy_charge: 1.8 }
            },
            eligible: true,
            unavailableReason: null
        };
        const run = makeRun(room.runSeed, room.rulesVersion);
        const result = claimBonusReward(run, createBonusRewardLedger(), room);

        expect(result.claimed).toBe(true);
        expect(result.run.shopGold).toBe(run.shopGold);
        expect(result.run.stats.totalScore).toBe(run.stats.totalScore);
        expect(result.run.stats.currentLevelScore).toBe(run.stats.currentLevelScore);
        expect(result.run.stats.comboShards).toBe(run.stats.comboShards);
        expect(result.run.relicFavorProgress).toBe(run.relicFavorProgress);
        expect(result.run.destroyPairCharges).toBe(1);
        expect(result.run.peekCharges).toBe(0);
        expect(result.feedback.gained).toEqual(['+1 destroy charge']);
    });
});
