import { describe, expect, it } from 'vitest';
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
        expect(questCampaignSummary(save)).toMatchObject({ total: 5, completed: 3, active: 2, locked: 0 });
    });

    it('maps run summaries back to campaign contract rows', () => {
        expect(getQuestContractForRunSummary({ gameMode: 'gauntlet', levelsCleared: 1 })).toBe('gauntlet_proof');
        expect(getQuestContractForRunSummary({ gameMode: 'daily', levelsCleared: 1 })).toBe('daily_rhythm');
        expect(getQuestContractForRunSummary({ gameMode: 'endless', levelsCleared: 1 })).toBe('first_lantern');
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
});
