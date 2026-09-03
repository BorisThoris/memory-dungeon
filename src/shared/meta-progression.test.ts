import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_IDS, createDefaultSaveData, metaRelicDraftExtraPerMilestoneFromSave } from './save-data';
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
            dailiesCompleted: 7,
            bestFloorNoPowers: 5,
            relicShrineExtraPickUnlocked: true
        };
        const upgrades = buildPermanentUpgradeRows(save);

        expect(upgrades.map((row) => row.id)).toEqual([
            'relic_shrine_extra_pick',
            'ascendant_title_track',
            'daily_cosmetic_track'
        ]);
        expect(upgrades.find((row) => row.id === 'relic_shrine_extra_pick')?.status).toBe('unlocked');
        expect(upgrades.every((row) => row.offlineOnly)).toBe(true);
        expect(upgrades.every((row) => row.payToSkip === false)).toBe(true);
    });

    it('does not count ready-but-unclaimed Week of Archives as a legacy owned upgrade', () => {
        const save = createDefaultSaveData();
        save.playerStats = {
            ...save.playerStats!,
            dailiesCompleted: 7,
            relicShrineExtraPickUnlocked: false
        };

        expect(buildPermanentUpgradeRows(save).find((row) => row.id === 'relic_shrine_extra_pick')).toMatchObject({
            status: 'in_progress',
            progress: { current: 7, target: 7 }
        });
        expect(buildPermanentUpgradeRows(save).filter((row) => row.status === 'unlocked').map((row) => row.id)).toEqual([
            'daily_cosmetic_track'
        ]);
        expect(metaProgressionSummary(save).upgradesUnlocked).toBe(1);
    });

    it('projects cosmetic track rows from local unlock tags and progress gates', () => {
        const save = createDefaultSaveData();
        save.unlocks = ['cosmetic:crest_daily_bronze'];
        save.playerStats = {
            ...save.playerStats!,
            dailiesCompleted: 3,
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
            dailiesCompleted: 4,
            bestFloorNoPowers: 2,
            relicPickCounts: {
                extra_shuffle_charge: 3
            }
        };

        const board = getMetaProgressionBoard(save);
        expect(board.level).toBeGreaterThan(1);
        expect(board.levelProgress.target).toBe(5);
        expect(board.nextReward?.id).toBe('upgrade_relic_shrine_extra_pick');
        expect(board.nextReward?.source).toBe('Daily archive completions');
        expect(board.nextReward?.modeRule).toBe('disabled_in_daily');
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

        expect(board.nextReward).toMatchObject({
            id: 'upgrade_relic_shrine_extra_pick',
            status: 'locked',
            progress: { current: 0, target: 7 }
        });
        expect(board.longTermGoal).toMatchObject({
            id: 'upgrade_scholar_prep_slot',
            status: 'locked'
        });
    });

    it('REG-016 keeps cosmetic rewards visual-only and gameplay upgrades explicitly flagged', () => {
        const save = createDefaultSaveData();
        save.playerStats = {
            ...save.playerStats!,
            dailiesCompleted: 7,
            relicShrineExtraPickUnlocked: true
        };

        const rows = getMetaProgressionRows(save);
        const week = rows.find((row) => row.id === 'upgrade_relic_shrine_extra_pick');
        expect(week).toMatchObject({
            gameplayAffecting: true,
            modeRule: 'disabled_in_daily',
            status: 'owned'
        });
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
            dailiesCompleted: 9,
            bestFloorNoPowers: 2,
            relicPickCounts: {
                extra_shuffle_charge: 3
            }
        };

        const sources = getMetaHonorMarkSourceRows(save);

        expect(sources.map((row) => [row.id, row.marks, row.progress])).toEqual([
            ['achievements', 2, { current: 1, target: ACHIEVEMENT_IDS.length }],
            ['daily_archive', 7, { current: 7, target: 7 }],
            ['no_powers_mastery', 2, { current: 2, target: 5 }],
            ['relic_mastery', 1, { current: 3, target: 10 }]
        ]);
        expect(sources.find((row) => row.id === 'daily_archive')?.nextMarkCopy).toBeNull();
        expect(sources.find((row) => row.id === 'relic_mastery')?.nextMarkCopy).toBe('Pick 1 more relic for 1 honor mark.');
    });

    it('normalizes malformed persisted counters before projecting meta progression rows', () => {
        const save = createDefaultSaveData();
        save.playerStats = {
            ...save.playerStats!,
            dailiesCompleted: Number.POSITIVE_INFINITY,
            bestFloorNoPowers: Number.NaN,
            relicPickCounts: {
                guard_token_plus_one: Number.POSITIVE_INFINITY,
                parasite_ledger: 1.9
            }
        };

        const sources = getMetaHonorMarkSourceRows(save);
        expect(sources.map((row) => [row.id, row.marks, row.progress])).toEqual([
            ['achievements', 0, { current: 0, target: ACHIEVEMENT_IDS.length }],
            ['daily_archive', 0, { current: 0, target: 7 }],
            ['no_powers_mastery', 0, { current: 0, target: 5 }],
            ['relic_mastery', 0, { current: 1, target: 10 }]
        ]);

        const board = getMetaProgressionBoard(save);
        expect(board.level).toBe(1);
        expect(board.levelProgress).toEqual({ current: 0, target: 5 });
        expect(board.nextReward).toMatchObject({
            id: 'upgrade_relic_shrine_extra_pick',
            status: 'locked',
            progress: { current: 0, target: 7 }
        });

        expect(getPermanentUpgradeRows(save).map((row) => [row.id, row.status, row.progress])).toEqual([
            ['upgrade_relic_shrine_extra_pick', 'locked', { current: 0, target: 7 }],
            ['upgrade_scholar_prep_slot', 'locked', { current: 0, target: 8 }]
        ]);
        expect(buildPermanentUpgradeRows(save).map((row) => [row.id, row.status, row.progress])).toEqual([
            ['relic_shrine_extra_pick', 'locked', { current: 0, target: 7 }],
            ['ascendant_title_track', 'locked', { current: 0, target: 5 }],
            ['daily_cosmetic_track', 'locked', { current: 0, target: 3 }]
        ]);
        expect(getCosmeticTrackDefinitionRows(save).map((row) => [row.trackId, row.status, row.progress])).toEqual([
            ['starter', 'owned', { current: 1, target: 1 }],
            ['daily', 'locked', { current: 0, target: 3 }],
            ['mastery', 'locked', { current: 0, target: 5 }]
        ]);
    });

    it('selects the nearest unfinished honor-mark source for motivation surfaces', () => {
        const save = createDefaultSaveData();
        save.playerStats = {
            ...save.playerStats!,
            relicPickCounts: {
                extra_shuffle_charge: 1
            }
        };

        const nextSource = getNextMetaHonorMarkSource(save);
        const feedback = getMetaProgressionFeedback(save);

        expect(nextSource).toMatchObject({
            id: 'relic_mastery',
            nextMarkCopy: 'Pick 1 more relic for 1 honor mark.'
        });
        expect(feedback.nextHonorMarkSource).toMatchObject({
            id: 'relic_mastery',
            nextMarkUnitsRemaining: 1
        });
        expect(feedback.honorMarkSources).toHaveLength(4);
    });

    it('maps profile level milestones into reached, current, and upcoming tier rows', () => {
        const save = createDefaultSaveData();
        save.achievements.ACH_FIRST_CLEAR = true;
        save.achievements.ACH_LEVEL_FIVE = true;
        save.achievements.ACH_SCORE_THOUSAND = true;
        save.achievements.ACH_PERFECT_CLEAR = true;
        save.playerStats = {
            ...save.playerStats!,
            dailiesCompleted: 7,
            bestFloorNoPowers: 5,
            relicPickCounts: {
                extra_shuffle_charge: 8
            }
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
            marksRemaining: 11,
            progress: { current: 24, target: 35 }
        });
    });

    it('builds concise next-reward feedback for progression surfaces', () => {
        const save = createDefaultSaveData();
        save.achievements.ACH_FIRST_CLEAR = true;
        save.playerStats = {
            ...save.playerStats!,
            dailiesCompleted: 4,
            bestFloorNoPowers: 2
        };

        const feedback = getMetaProgressionFeedback(save);

        expect(feedback).toMatchObject({
            profileLevel: 2,
            difficultyTier: 'initiate',
            difficultyTierLabel: 'Initiate tier',
            honorMarks: 8,
            honorMarksToNextLevel: 2,
            nextReward: {
                id: 'upgrade_relic_shrine_extra_pick',
                status: 'locked',
                progressCopy: '4/7 from Daily archive completions',
                modeRule: 'disabled_in_daily'
            },
            longTermGoal: {
                id: 'upgrade_scholar_prep_slot',
                progressCopy: '2/8 from No-powers mastery'
            },
            nextMilestone: {
                level: 3,
                label: 'Adept tier',
                marksRemaining: 2
            },
            nextMilestoneCopy: 'Adept tier at profile level 3 (2 honor marks).',
            motivationCopy: 'Next: Week of Archives (4/7 from Daily archive completions).'
        });
    });

    it('calls out ready rewards without changing ownership or spending marks', () => {
        const save = createDefaultSaveData();
        save.playerStats = {
            ...save.playerStats!,
            dailiesCompleted: 7
        };

        const feedback = getMetaProgressionFeedback(save);
        const row = getMetaProgressionRows(save).find((entry) => entry.id === feedback.nextReward?.id);

        expect(feedback.nextReward).toMatchObject({
            id: 'upgrade_relic_shrine_extra_pick',
            status: 'available',
            progressCopy: 'Ready to unlock'
        });
        expect(feedback.motivationCopy).toBe('Week of Archives is ready.');
        expect(row?.status).toBe('available');
    });

    it('applies the ready Week of Archives upgrade into persistent run-to-run growth', () => {
        const save = createDefaultSaveData();
        save.playerStats = {
            ...save.playerStats!,
            dailiesCompleted: 7,
            relicShrineExtraPickUnlocked: false
        };

        const result = applyMetaProgressionUnlock(save, 'upgrade_relic_shrine_extra_pick');

        expect(result).toMatchObject({
            applied: true,
            reason: 'applied',
            feedbackCopy: 'Week of Archives unlocked: +1 relic pick per milestone.'
        });
        expect(result.save.playerStats?.relicShrineExtraPickUnlocked).toBe(true);
        expect(metaRelicDraftExtraPerMilestoneFromSave(result.save)).toBe(1);
        expect(getMetaProgressionRows(result.save).find((row) => row.id === 'upgrade_relic_shrine_extra_pick')).toMatchObject({
            status: 'owned',
            reward: '+1 relic pick per milestone'
        });
    });

    it('does not mutate locked, owned, deferred, or unknown progression unlock requests', () => {
        const locked = createDefaultSaveData();
        const lockedResult = applyMetaProgressionUnlock(locked, 'upgrade_relic_shrine_extra_pick');
        expect(lockedResult).toMatchObject({
            applied: false,
            reason: 'locked',
            feedbackCopy: 'Week of Archives needs 7 more from Daily archive completions.'
        });
        expect(lockedResult.save).toBe(locked);

        const owned = createDefaultSaveData();
        owned.playerStats = {
            ...owned.playerStats!,
            dailiesCompleted: 7,
            relicShrineExtraPickUnlocked: true
        };
        expect(applyMetaProgressionUnlock(owned, 'upgrade_relic_shrine_extra_pick')).toMatchObject({
            applied: false,
            reason: 'already_owned'
        });

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
