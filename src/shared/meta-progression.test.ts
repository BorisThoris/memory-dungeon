import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_IDS, createDefaultSaveData } from './save-data';
import {
    applyMetaProgressionUnlock,
    buildPermanentUpgradeRows,
    getCosmeticTrackDefinitionRows,
    getMetaHonorMarkSourceRows,
    getNextMetaHonorMarkSource,
    getMetaProgressionDifficultyTier,
    getMetaProgressionFeedback,
    getMetaProgressionMilestones,
    getMetaProgressionBoard,
    getMetaProgressionRows,
    getPermanentUpgradeRows,
    metaProgressionSummary
} from './meta-progression';

describe('REG-080 permanent upgrade tree and cosmetic track', () => {
    it('keeps permanent upgrades local, earned, and non-pay-to-skip', () => {
        const save = createDefaultSaveData();
        save.playerStats = {
            ...save.playerStats!,
            sharpFloors: 7,
            bestFloorNoPowers: 5
        };
        const upgrades = buildPermanentUpgradeRows(save);

        expect(upgrades.map((row) => row.id)).toEqual(['ascendant_title_track', 'sharp_cosmetic_track']);
        expect(upgrades.every((row) => row.offlineOnly)).toBe(true);
        expect(upgrades.every((row) => row.payToSkip === false)).toBe(true);
    });


    it('projects cosmetic track rows from local unlock tags and progress gates', () => {
        const save = createDefaultSaveData();
        save.unlocks = ['cosmetic:crest_daily_bronze'];
        save.playerStats = {
            ...save.playerStats!,
            sharpFloors: 3,
            bestFloorNoPowers: 4
        };

        const rows = getCosmeticTrackDefinitionRows(save);
        expect(rows.find((row) => row.cosmeticId === 'crest_daily_bronze')?.status).toBe('owned');
        expect(rows.find((row) => row.cosmeticId === 'title_ascendant_v')?.status).toBe('in_progress');
        expect(rows.every((row) => row.gameplayAffecting === false)).toBe(true);
        expect(metaProgressionSummary(save)).toMatchObject({
            upgradesUnlocked: 1,
            cosmeticTrackOwned: 2,
            honorsEarned: 1
        });
    });

    it('REG-016 exposes level, next reward, long-term goal, and explicit mode rules', () => {
        const save = createDefaultSaveData();
        save.achievements.ACH_FIRST_CLEAR = true;
        save.playerStats = {
            ...save.playerStats!,
            sharpFloors: 4,
            bestFloorNoPowers: 2
        };

        const board = getMetaProgressionBoard(save);
        expect(board.level).toBeGreaterThan(1);
        expect(board.levelProgress.target).toBe(5);
        // The relic shrine's extra pick used to sit here; the draft went in Gen 175.
        expect(board.nextReward?.id).not.toBe('upgrade_relic_shrine_extra_pick');
        expect(board.longTermGoal?.id).toBe('upgrade_scholar_prep_slot');
        expect(board.longTermGoal?.status).toBe('locked');
        expect(board.rows.every((row) => row.localOnly)).toBe(true);
    });

    it('keeps deferred future upgrades locked even when their planning progress reaches target', () => {
        const save = createDefaultSaveData();
        save.playerStats = {
            ...save.playerStats!,
            bestFloorNoPowers: 12
        };

        const row = getMetaProgressionRows(save).find((entry) => entry.id === 'upgrade_scholar_prep_slot');

        expect(row).toMatchObject({
            status: 'locked',
            gate: 'Deferred: requires REG-016 feature flag and balance pass before enabling.'
        });
        expect(row?.progress).toEqual({ current: 8, target: 8 });
    });

    it('keeps deferred future upgrades out of the short-term next reward slot', () => {
        const save = createDefaultSaveData();
        save.playerStats = {
            ...save.playerStats!,
            bestFloorNoPowers: 12
        };

        const board = getMetaProgressionBoard(save);

        expect(board.nextReward?.id).not.toBe('upgrade_scholar_prep_slot');
        expect(board.longTermGoal).toMatchObject({
            id: 'upgrade_scholar_prep_slot',
            status: 'locked'
        });
    });

    it('REG-016 keeps cosmetic rewards visual-only and gameplay upgrades explicitly flagged', () => {
        const save = createDefaultSaveData();
        save.playerStats = {
            ...save.playerStats!,
            sharpFloors: 7
        };

        const rows = getMetaProgressionRows(save);
        expect(rows.filter((row) => row.track === 'cosmetic').every((row) => row.gameplayAffecting === false)).toBe(true);
    });

    it('derives stable profile difficulty tiers from meta level thresholds', () => {
        expect(getMetaProgressionDifficultyTier(1)).toBe('initiate');
        expect(getMetaProgressionDifficultyTier(3)).toBe('adept');
        expect(getMetaProgressionDifficultyTier(5)).toBe('ascendant');
        expect(getMetaProgressionDifficultyTier(8)).toBe('legend');
    });

    it('breaks honor marks into capped source rows with next-step copy', () => {
        const save = createDefaultSaveData();
        save.achievements.ACH_FIRST_CLEAR = true;
        save.playerStats = {
            ...save.playerStats!,
            sharpFloors: 9,
            bestFloorNoPowers: 2
        };

        const sources = getMetaHonorMarkSourceRows(save);

        expect(sources.map((row) => [row.id, row.marks, row.progress])).toEqual([
            ['achievements', 2, { current: 1, target: ACHIEVEMENT_IDS.length }],
            ['sharp_floors', 7, { current: 7, target: 7 }],
            ['no_powers_mastery', 2, { current: 2, target: 5 }]
        ]);
        expect(sources.find((row) => row.id === 'sharp_floors')?.nextMarkCopy).toBeNull();
    });

    it('normalizes malformed persisted counters before projecting meta progression rows', () => {
        const save = createDefaultSaveData();
        save.playerStats = {
            ...save.playerStats!,
            sharpFloors: Number.POSITIVE_INFINITY,
            bestFloorNoPowers: Number.NaN
        };

        const sources = getMetaHonorMarkSourceRows(save);
        expect(sources.map((row) => [row.id, row.marks, row.progress])).toEqual([
            ['achievements', 0, { current: 0, target: ACHIEVEMENT_IDS.length }],
            ['sharp_floors', 0, { current: 0, target: 7 }],
            ['no_powers_mastery', 0, { current: 0, target: 5 }]
        ]);

        const board = getMetaProgressionBoard(save);
        expect(board.level).toBe(1);
        expect(board.levelProgress).toEqual({ current: 0, target: 5 });
        expect(board.nextReward?.id).not.toBe('upgrade_relic_shrine_extra_pick');

        expect(getPermanentUpgradeRows(save).map((row) => [row.id, row.status, row.progress])).toEqual([
            ['upgrade_scholar_prep_slot', 'locked', { current: 0, target: 8 }]
        ]);
        expect(buildPermanentUpgradeRows(save).map((row) => [row.id, row.status, row.progress])).toEqual([
            ['ascendant_title_track', 'locked', { current: 0, target: 5 }],
            ['sharp_cosmetic_track', 'locked', { current: 0, target: 3 }]
        ]);
        expect(getCosmeticTrackDefinitionRows(save).map((row) => [row.trackId, row.status, row.progress])).toEqual([
            ['starter', 'owned', { current: 1, target: 1 }],
            ['sharp', 'locked', { current: 0, target: 3 }],
            ['mastery', 'locked', { current: 0, target: 5 }]
        ]);
    });

    it('selects the nearest unfinished honor-mark source for motivation surfaces', () => {
        const save = createDefaultSaveData();
        save.playerStats = {
            ...save.playerStats!
        };

        const nextSource = getNextMetaHonorMarkSource(save);
        const feedback = getMetaProgressionFeedback(save);

        // Relic mastery was the nearest source until relic picks went (Gen 175); every source
        // left is one unit away, and the first in order wins the tie.
        expect(nextSource).toMatchObject({
            id: 'achievements',
            nextMarkCopy: 'Earn one more achievement for 2 honor marks.'
        });
        expect(feedback.nextHonorMarkSource).toMatchObject({
            id: 'achievements',
            nextMarkUnitsRemaining: 1
        });
        expect(feedback.honorMarkSources).toHaveLength(3);
    });

    it('maps profile level milestones into reached, current, and upcoming tier rows', () => {
        const save = createDefaultSaveData();
        save.achievements.ACH_FIRST_CLEAR = true;
        save.achievements.ACH_LEVEL_FIVE = true;
        save.achievements.ACH_SCORE_THOUSAND = true;
        save.achievements.ACH_PERFECT_CLEAR = true;
        save.playerStats = {
            ...save.playerStats!,
            sharpFloors: 7,
            bestFloorNoPowers: 5
        };

        const milestones = getMetaProgressionMilestones(save);

        expect(milestones.map((row) => [row.label, row.status])).toEqual([
            ['Initiate tier', 'reached'],
            ['Adept tier', 'reached'],
            ['Ascendant tier', 'current'],
            ['Legend tier', 'upcoming']
        ]);
        expect(milestones.find((row) => row.tier === 'legend')).toMatchObject({
            level: 8,
            marksRequired: 35,
            marksRemaining: 15,
            progress: { current: 20, target: 35 }
        });
    });

    it('builds concise next-reward feedback for progression surfaces', () => {
        const save = createDefaultSaveData();
        save.achievements.ACH_FIRST_CLEAR = true;
        save.playerStats = {
            ...save.playerStats!,
            sharpFloors: 4,
            bestFloorNoPowers: 2
        };

        const feedback = getMetaProgressionFeedback(save);

        expect(feedback).toMatchObject({
            profileLevel: 2,
            difficultyTier: 'initiate',
            difficultyTierLabel: 'Initiate tier',
            honorMarks: 8,
            honorMarksToNextLevel: 2,
            longTermGoal: {
                id: 'upgrade_scholar_prep_slot',
                progressCopy: '2/8 from No-powers mastery'
            },
            nextMilestone: {
                level: 3,
                label: 'Adept tier',
                marksRemaining: 2
            },
            nextMilestoneCopy: 'Adept tier at profile level 3 (2 honor marks).'
        });
        expect(feedback.nextReward?.id).not.toBe('upgrade_relic_shrine_extra_pick');
        expect(feedback.motivationCopy).toMatch(/^Next: /);
    });



    it('does not mutate locked, owned, deferred, or unknown progression unlock requests', () => {
        const locked = createDefaultSaveData();
        const deferred = createDefaultSaveData();
        deferred.playerStats = {
            ...deferred.playerStats!,
            bestFloorNoPowers: 8
        };
        expect(applyMetaProgressionUnlock(deferred, 'upgrade_scholar_prep_slot')).toMatchObject({
            applied: false,
            reason: 'deferred'
        });

        expect(applyMetaProgressionUnlock(locked, 'missing_upgrade')).toMatchObject({
            applied: false,
            reason: 'unknown_row',
            row: null
        });
    });
});
