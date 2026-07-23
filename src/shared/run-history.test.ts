import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import { createNewRun, createRunSummary, finishMemorizePhase } from './game-core';
import {
    MAX_DUNGEON_JOURNAL_ROWS,
    buildDungeonJournalRows,
    buildRunHistoryEntry,
    buildRunHistoryExportString,
    buildRunJournalRows,
    buildRunJournalRowsFromSave,
    buildRunShareKey
} from './run-history';
import { createDefaultSaveData } from './save-data';
import { createDungeonRunMapState, revealDungeonChoices, selectDungeonNode } from './run-map';

const completedRun = (): RunState => {
    const run = createRunSummary(
        {
            ...finishMemorizePhase(createNewRun(100, { runSeed: 85_001, initialRelicIds: ['chapter_compass'] })),
            flipHistory: ['1-0-A', '1-0-B', '1-1-A'],
            matchedPairKeysThisRun: ['1-0', '1-1']
        },
        ['ACH_FIRST_CLEAR']
    );
    return run;
};

describe('REG-085 run history, share keys, and journal', () => {
    it('builds a local-only run history entry without a second save file', () => {
        const entry = buildRunHistoryEntry(completedRun());

        expect(entry).toMatchObject({
            runSeed: 85_001,
            localOnly: true,
            share: {
                kind: 'local_share_key'
            }
        });
        expect(entry.build.relicIds).toContain('chapter_compass');
        expect(entry.journalRows.find((row) => row.id === 'build')?.value).toContain('The Slayer');
        expect(entry.journalRows.find((row) => row.id === 'build')?.detail).toContain('prepare, focus, finish');
        expect(entry.journalRows.map((row) => row.id).slice(0, 4)).toEqual(['summary', 'build', 'share', 'encore']);
        expect(entry.journalRows.map((row) => row.id)).toEqual(
            expect.arrayContaining(['dungeon_node', 'dungeon_objective', 'dungeon_rewards'])
        );
    });

    it('produces privacy-safe share keys and journal rows', () => {
        const run = completedRun();
        const link = buildRunShareKey(run);
        const rows = buildRunJournalRows(run);

        expect(link.shareString).toContain('local share');
        expect(link.shareString).not.toMatch(/account|token|path|email/i);
        expect(rows.find((row) => row.id === 'share')?.detail).toContain('3 flip ids are local-only');
        expect(rows.find((row) => row.id === 'share')?.detail).toContain('does not include flip playback');
        expect(rows.every((row) => row.offlineOnly)).toBe(true);
    });

    it('does not advertise puzzle boards as share-key reconstructable', () => {
        const base = completedRun();
        const run: RunState = {
            ...base,
            gameMode: 'puzzle',
            lastRunSummary: base.lastRunSummary
                ? {
                      ...base.lastRunSummary,
                      gameMode: 'puzzle'
                  }
                : base.lastRunSummary
        };

        const link = buildRunShareKey(run);

        expect(link).toMatchObject({
            kind: 'local_share_key',
            shareKey: 'local-share-unavailable',
            shareSupported: false,
            shareString: 'local share unavailable'
        });
        expect(link.reason).toContain('tile payload');
    });

    it('derives a capped dungeon journal without persisting full playback data', () => {
        const base = completedRun();
        const run: RunState = {
            ...base,
            status: 'gameOver',
            lives: 0,
            pendingRouteCardPlan: {
                choiceId: base.dungeonRun.currentNodeId,
                routeType: 'greed',
                sourceLevel: 3,
                targetLevel: 4
            },
            board: base.board
                ? {
                      ...base.board,
                      floorTag: 'boss',
                      dungeonBossId: 'trap_warden',
                      dungeonObjectiveId: 'defeat_boss',
                      selectedGatewayRouteType: 'greed'
                  }
                : base.board,
            lastLevelResult: {
                level: 4,
                scoreGained: 240,
                rating: 'A',
                livesRemaining: 0,
                perfect: false,
                mistakes: 3,
                clearLifeReason: 'none',
                clearLifeGained: 0,
                featuredObjectiveId: 'glass_witness',
                featuredObjectiveCompleted: false
            },
            dungeonEnemiesDefeated: 3,
            dungeonEnemiesDefeatedThisFloor: 1,
            dungeonTrapsResolvedThisFloor: 2,
            dungeonTreasuresOpened: 2,
            dungeonGatewaysUsed: 1,
            dungeonKeys: { iron: 1, boss: 1 },
            dungeonMasterKeys: 1,
            enemyHazardHitsThisFloor: 2,
            shopGold: 9
        };

        const rows = buildDungeonJournalRows(run);
        expect(rows.length).toBeLessThanOrEqual(MAX_DUNGEON_JOURNAL_ROWS);
        expect(rows.map((row) => row.id)).toEqual(
            expect.arrayContaining([
                'dungeon_node',
                'dungeon_route',
                'dungeon_boss',
                'dungeon_objective',
                'dungeon_rewards',
                'dungeon_outcome'
            ])
        );
        expect(rows.find((row) => row.id === 'dungeon_route')?.value).toContain('greed');
        expect(rows.find((row) => row.id === 'dungeon_boss')?.value).toContain('Trap Warden');
        expect(rows.every((row) => row.exportSafe && row.offlineOnly)).toBe(true);
        expect(buildRunHistoryExportString(run)).toContain('Dungeon node');
        expect(buildRunHistoryExportString(run)).not.toMatch(/token|email|path/i);
    });

    it('normalizes malformed dungeon journal counters before export', () => {
        const base = completedRun();
        const run: RunState = {
            ...base,
            status: 'gameOver',
            lives: Number.NaN,
            gameMode: 'endless',
            board: base.board
                ? {
                      ...base.board,
                      dungeonObjectiveId: 'defeat_boss'
                  }
                : base.board,
            dungeonEnemiesDefeated: Number.POSITIVE_INFINITY,
            dungeonEnemiesDefeatedThisFloor: Number.NaN,
            dungeonTrapsResolvedThisFloor: Number.POSITIVE_INFINITY,
            dungeonGatewaysUsed: Number.NaN,
            dungeonTreasuresOpened: Number.POSITIVE_INFINITY,
            dungeonKeys: Number.NaN as unknown as RunState['dungeonKeys'],
            dungeonMasterKeys: Number.NaN,
            enemyHazardHitsThisFloor: Number.POSITIVE_INFINITY,
            shopGold: Number.NaN,
            relicIds: Number.NaN as unknown as RunState['relicIds'],
            bonusRelicPicksNextOffer: Number.POSITIVE_INFINITY,
            favorBonusRelicPicksNextOffer: 1.9,
            stats: {
                ...base.stats,
                bestStreak: Number.POSITIVE_INFINITY
            }
        };

        const rows = buildDungeonJournalRows(run);
        const exportText = buildRunHistoryExportString(run);

        expect(rows.find((row) => row.id === 'dungeon_rewards')?.value).toBe('0 treasures, 0 keys, 0 shop gold');
        expect(rows.find((row) => row.id === 'dungeon_rewards')?.detail).toContain('0 relics carried');
        expect(rows.find((row) => row.id === 'dungeon_rewards')?.detail).toContain('1 bonus relic picks banked');
        expect(rows.find((row) => row.id === 'dungeon_objective')?.detail).toContain('0 traps resolved this floor; 0 gateways used this run.');
        expect(rows.find((row) => row.id === 'dungeon_outcome')?.detail).toContain('0 enemy hazard hits this floor; 0 best streak.');
        expect(exportText).not.toMatch(/NaN|Infinity/);
    });

    it('normalizes malformed run history arrays before build and playback rows', () => {
        const run: RunState = {
            ...completedRun(),
            relicIds: Number.NaN as unknown as RunState['relicIds'],
            activeMutators: Number.NaN as unknown as RunState['activeMutators'],
            flipHistory: Number.NaN as unknown as string[],
            matchedPairKeysThisRun: Number.NaN as unknown as string[]
        };

        const entry = buildRunHistoryEntry(run);

        expect(entry.build.relicIds).toEqual([]);
        expect(entry.build.mutatorIds).toEqual([]);
        expect(entry.journalRows.find((row) => row.id === 'build')?.value).toContain('0 relics · 0 mutators');
        expect(entry.journalRows.find((row) => row.id === 'share')?.detail).toContain('0 flip ids are local-only');
        expect(entry.journalRows.find((row) => row.id === 'encore')?.detail).toContain('0 matched pair keys');
    });

    it('does not derive a dungeon journal boss row from stale cleared-tile hazards', () => {
        const base = completedRun();
        const run: RunState = {
            ...base,
            gameMode: 'endless',
            board: base.board
                ? {
                      ...base.board,
                      dungeonBossId: null,
                      tiles: [
                          { ...base.board.tiles[0]!, id: 'a1', pairKey: 'done', state: 'matched', dungeonBossId: undefined },
                          { ...base.board.tiles[1]!, id: 'a2', pairKey: 'done', state: 'matched', dungeonBossId: undefined }
                      ],
                      matchedPairs: 1,
                      pairCount: 1,
                      enemyHazards: [
                          {
                              id: 'stale-boss',
                              bossId: 'trap_warden',
                              kind: 'warden',
                              label: 'Latch Warden',
                              currentTileId: 'a1',
                              nextTileId: 'a2',
                              pattern: 'guard',
                              state: 'revealed',
                              damage: 1,
                              hp: 1,
                              maxHp: 3
                          }
                      ]
                  }
                : base.board
        };

        expect(buildDungeonJournalRows(run).map((row) => row.id)).not.toContain('dungeon_boss');
    });

    it('keeps converged boss route approach labels in the dungeon journal', () => {
        const dungeonRun = selectDungeonNode(
            revealDungeonChoices(createDungeonRunMapState(85_002, 1, 5), 5, [
                { id: 'boss-safe', routeType: 'safe', label: 'Safe passage', detail: 'Controlled boss approach.' },
                { id: 'boss-greed', routeType: 'greed', label: 'Greedy route', detail: 'Risky boss approach.' },
                { id: 'boss-mystery', routeType: 'mystery', label: 'Mystery route', detail: 'Omen boss approach.' }
            ]),
            'boss-mystery'
        );
        const run: RunState = {
            ...completedRun(),
            gameMode: 'endless',
            dungeonRun,
            pendingRouteCardPlan: {
                choiceId: 'boss-mystery',
                routeType: 'mystery',
                sourceLevel: 5,
                targetLevel: 6
            }
        };

        expect(buildDungeonJournalRows(run).find((row) => row.id === 'dungeon_route')?.value).toBe(
            'Keeper Chamber via Mystery route'
        );
    });

    it('does not journal stale skipped selected route nodes', () => {
        const dungeonRun = selectDungeonNode(
            revealDungeonChoices(createDungeonRunMapState(85_003, 1, 5), 5, [
                { id: 'route-safe', routeType: 'safe', label: 'Safe passage', detail: 'Controlled route.' },
                { id: 'route-greed', routeType: 'greed', label: 'Greedy route', detail: 'Risky route.' },
                { id: 'route-mystery', routeType: 'mystery', label: 'Mystery route', detail: 'Omen route.' }
            ]),
            'route-greed'
        );
        const run: RunState = {
            ...completedRun(),
            gameMode: 'endless',
            dungeonRun: {
                ...dungeonRun,
                selectedNodeId: 'route-safe'
            },
            pendingRouteCardPlan: null
        };

        expect(buildDungeonJournalRows(run).find((row) => row.id === 'dungeon_route')).toBeUndefined();
    });

    it('uses primary build archetype in journal recap when relics exist', () => {
        const entry = buildRunHistoryEntry(completedRun());
        const journal = buildRunJournalRows(completedRun());

        expect(entry.journalRows.find((row) => row.id === 'build')?.value).toContain('The Slayer');
        expect(journal.find((row) => row.id === 'build')?.value).toContain('The Slayer');
    });

    it('carries persisted payoff stacks into save-derived journal rows', () => {
        const save = createDefaultSaveData();
        save.lastRunSummary = {
            totalScore: 24680,
            bestScore: 24680,
            levelsCleared: 5,
            highestLevel: 6,
            achievementsEnabled: true,
            unlockedAchievements: [],
            bestStreak: 13,
            perfectClears: 2,
            relicIds: ['extra_shuffle_charge'],
            payoffPickupClaimed: 2,
            payoffPickupTotal: 2,
            payoffRewardPerkCount: 1,
            payoffRoutePaid: true,
            payoffRouteRewardText: '+1 combo shard',
            gameMode: 'endless'
        };

        const rows = buildRunJournalRowsFromSave(save);

        expect(rows.find((row) => row.id === 'last_payoff_stack')).toMatchObject({
            label: 'Last payoff stack',
            value: 'Super stack · 5 payoffs',
            persistence: 'persisted_summary',
            exportSafe: true
        });
    });

    it('normalizes malformed save-derived journal counters before rendering rows', () => {
        const save = createDefaultSaveData();
        save.lastRunSummary = {
            totalScore: Number.NaN,
            bestScore: 0,
            levelsCleared: 0,
            highestLevel: Number.POSITIVE_INFINITY,
            achievementsEnabled: true,
            unlockedAchievements: [],
            bestStreak: 4,
            perfectClears: 0,
            relicIds: Number.NaN as unknown as [],
            payoffPickupClaimed: 0,
            payoffPickupTotal: 0,
            payoffRewardPerkCount: Number.NaN,
            payoffRoutePaid: false,
            gameMode: 'endless'
        };
        save.playerStats = {
            ...save.playerStats!,
            encorePairKeysLastRun: Number.NaN as unknown as string[]
        };

        const rows = buildRunJournalRowsFromSave(save);

        expect(rows.find((row) => row.id === 'last_summary')?.value).toBe('endless · 0 score · floor 0');
        expect(rows.find((row) => row.id === 'last_payoff_stack')).toBeUndefined();
        expect(rows.find((row) => row.id === 'encore_pairs')?.value).toBe('0 pair keys remembered locally');
    });
});
