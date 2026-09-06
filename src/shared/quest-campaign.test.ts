import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import { createDefaultSaveData } from './save-data';
import {
    buildActiveQuestContractRows,
    getQuestCampaignRows,
    getQuestContractForRunSummary,
    questCampaignSummary,
    QUEST_CAMPAIGN_LADDER
} from './quest-campaign';
import { createNewRun } from './game-core';

describe('REG-082 quest contract campaign ladder', () => {
    it('projects authored offline campaign steps from local save progress', () => {
        const save = createDefaultSaveData();
        save.achievements.ACH_FIRST_CLEAR = true;
        save.playerStats = {
            ...save.playerStats!,
            bestFloorNoPowers: 5,
            dailiesCompleted: 2
        };
        save.lastRunSummary = {
            totalScore: 120,
            bestScore: 120,
            levelsCleared: 1,
            highestLevel: 2,
            achievementsEnabled: true,
            unlockedAchievements: [],
            bestStreak: 2,
            perfectClears: 0,
            gameMode: 'gauntlet'
        };

        const rows = getQuestCampaignRows(save);
        expect(rows.map((row) => row.id)).toEqual(QUEST_CAMPAIGN_LADDER.map((row) => row.id));
        expect(rows.find((row) => row.id === 'first_lantern')?.status).toBe('completed');
        expect(rows.find((row) => row.id === 'daily_rhythm')?.status).toBe('active');
        expect(rows.every((row) => row.offlineOnly)).toBe(true);
        expect(rows.every((row) => row.retryRule.includes('local'))).toBe(true);
        expect(questCampaignSummary(save)).toMatchObject({ total: 6, completed: 3, active: 3, locked: 0 });
    });

    it('counts Sharp floors toward the chain quest, and completes it at three', () => {
        const save = createDefaultSaveData();
        save.achievements.ACH_FIRST_CLEAR = true;
        save.playerStats = { ...save.playerStats!, sharpFloors: 2 };
        const row = getQuestCampaignRows(save).find((entry) => entry.id === 'chain_rhythm');
        expect(row).toMatchObject({ status: 'active', progressLabel: '2/3', saveFields: ['playerStats.sharpFloors'] });
        save.playerStats = { ...save.playerStats!, sharpFloors: 3 };
        expect(getQuestCampaignRows(save).find((entry) => entry.id === 'chain_rhythm')?.status).toBe('completed');
    });

    it('maps run summaries back to campaign contract rows', () => {
        expect(getQuestContractForRunSummary({ gameMode: 'gauntlet', levelsCleared: 1 })).toBe('gauntlet_proof');
        expect(getQuestContractForRunSummary({ gameMode: 'daily', levelsCleared: 1 })).toBe('daily_rhythm');
        expect(getQuestContractForRunSummary({ gameMode: 'endless', levelsCleared: 1 })).toBe('first_lantern');
    });

    it('normalizes malformed save counters before projecting campaign progress', () => {
        const save = createDefaultSaveData();
        save.playerStats = {
            ...save.playerStats!,
            bestFloorNoPowers: Number.POSITIVE_INFINITY,
            dailiesCompleted: Number.NaN,
            relicPickCounts: { guard_token_plus_one: Number.POSITIVE_INFINITY, parasite_ledger: 1.9 }
        };
        save.lastRunSummary = {
            totalScore: 0,
            bestScore: 0,
            levelsCleared: Number.POSITIVE_INFINITY,
            highestLevel: 0,
            achievementsEnabled: true,
            unlockedAchievements: [],
            bestStreak: 0,
            perfectClears: 0,
            gameMode: 'gauntlet'
        };

        const rows = getQuestCampaignRows(save);

        expect(rows.find((row) => row.id === 'scholar_oath')?.progressLabel).toBe('0/5');
        expect(rows.find((row) => row.id === 'gauntlet_proof')?.progressLabel).toBe('0/1');
        expect(rows.find((row) => row.id === 'daily_rhythm')?.progressLabel).toBe('0/3');
        expect(rows.find((row) => row.id === 'relic_apprentice')?.progressLabel).toBe('1/10');
        expect(getQuestContractForRunSummary({ gameMode: 'gauntlet', levelsCleared: Number.POSITIVE_INFINITY })).toBeNull();
    });

    it('normalizes malformed pin vow counters before projecting active contracts', () => {
        const run = {
            ...createNewRun(0),
            activeContract: { noDestroy: false, noShuffle: false, maxMismatches: null, maxPinsTotalRun: 1.9 },
            pinsPlacedCountThisRun: Number.POSITIVE_INFINITY
        };

        expect(buildActiveQuestContractRows(run).find((row) => row.id === 'pin_vow')).toMatchObject({
            status: 'active',
            progressLabel: '0/1 pins',
            failureReason: null
        });
    });

    it('normalizes malformed run stats before projecting active contracts', () => {
        const rows = buildActiveQuestContractRows({
            ...createNewRun(0),
            gameMode: 'gauntlet',
            stats: Number.NaN
        } as unknown as RunState);

        expect(rows.find((row) => row.id === 'gauntlet_proof')).toMatchObject({
            status: 'active',
            progressLabel: '0/1 timed clears'
        });
    });
});
