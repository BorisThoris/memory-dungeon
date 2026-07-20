import { describe, expect, it } from 'vitest';
import type { LevelResult } from './contracts';
import { getFloorIdentityContract } from './boss-encounters';
import { getFloorClearCausalityRows } from './level-result-presentation';
import { assertTokenCoverage } from './mechanic-feedback';

const baseResult: LevelResult = {
    level: 3,
    scoreGained: 250,
    rating: 'S',
    livesRemaining: 4,
    perfect: true,
    mistakes: 0,
    clearLifeReason: 'perfect',
    clearLifeGained: 1
};

describe('floor clear causality presentation', () => {
    it('groups performance, rewards, assist state, and route choices with token coverage', () => {
        const rows = getFloorClearCausalityRows(
            {
                ...baseResult,
                featuredObjectiveId: 'flip_par',
                featuredObjectiveCompleted: true,
                objectiveBonusScore: 45,
                relicFavorGained: 1,
                routeChoices: [
                    { id: 'safe', routeType: 'safe', label: 'Safe', detail: 'Recover.', rewardPreview: '+1 guard' }
                ]
            },
            false
        );

        expect(rows.map((row) => row.id)).toEqual([
            'performance_score',
            'life_restore',
            'featured_objective',
            'perfect_memory',
            'route_choice'
        ]);
        expect(rows.every((row) => assertTokenCoverage(row.tokens))).toBe(true);
        expect(rows.find((row) => row.id === 'perfect_memory')).toMatchObject({
            detail: 'Still eligible if the run also clears with zero mismatches.'
        });
        expect(rows.find((row) => row.id === 'route_choice')).toMatchObject({
            detail:
                '1 connected room choice opened in the route archive: Safe. The next route is now written into the archive margin.'
        });
    });

    it('names assist lock and wager loss causes', () => {
        const rows = getFloorClearCausalityRows(
            {
                ...baseResult,
                perfect: false,
                mistakes: 1,
                featuredObjectiveId: 'scholar_style',
                featuredObjectiveCompleted: false,
                endlessRiskWagerOutcome: 'lost',
                endlessRiskWagerStreakLost: 2
            },
            true
        );

        expect(rows.find((row) => row.id === 'perfect_memory')).toMatchObject({
            detail: 'Locked by an assist used this run.',
            tokens: ['forfeit', 'cost']
        });
        expect(rows.find((row) => row.id === 'risk_wager')?.detail).toContain('streak reduced by 2');
    });

    it('explains the cleared floor identity when supplied', () => {
        const identity = getFloorIdentityContract({
            floorTag: 'normal',
            floorArchetypeId: 'trap_hall',
            mutators: ['glass_floor'],
            featuredObjectiveLabel: 'Glass witness'
        });
        const rows = getFloorClearCausalityRows(baseResult, false, identity);

        expect(rows.find((row) => row.id === 'encounter_identity')).toMatchObject({
            group: 'encounter',
            label: 'Trap bounty hall',
            detail: `${identity.floorClearSentence} ${identity.atmosphericFeedback}`,
            tokens: identity.tokens
        });
        expect(rows.find((row) => row.id === 'encounter_identity')?.detail).toContain('pressure plates');
        expect(rows.every((row) => assertTokenCoverage(row.tokens))).toBe(true);
    });

    it('explains boss trophy success and forfeit branches', () => {
        const claimed = getFloorClearCausalityRows(
            {
                ...baseResult,
                bossTrophyCacheOutcome: 'claimed',
                bossTrophyCacheScore: 90
            },
            false
        );
        const forfeited = getFloorClearCausalityRows(
            {
                ...baseResult,
                bossTrophyCacheOutcome: 'forfeited'
            },
            false
        );

        expect(claimed.find((row) => row.id === 'boss_trophy_cache')).toMatchObject({
            detail: 'Boss objective completed; trophy cache paid +90 score.',
            tokens: ['objective', 'reward', 'momentum']
        });
        expect(forfeited.find((row) => row.id === 'boss_trophy_cache')).toMatchObject({
            detail: 'Boss objective unresolved; trophy cache was forfeited.',
            tokens: ['objective', 'forfeit', 'risk']
        });
    });

    it('normalizes malformed floor-result counters before building presentation copy', () => {
        const rows = getFloorClearCausalityRows(
            {
                ...baseResult,
                mistakes: Number.NaN,
                scoreGained: Number.POSITIVE_INFINITY,
                featuredObjectiveId: 'flip_par',
                featuredObjectiveCompleted: true,
                objectiveBonusScore: Number.POSITIVE_INFINITY,
                relicFavorGained: Number.NEGATIVE_INFINITY,
                endlessRiskWagerOutcome: 'won',
                endlessRiskWagerFavorGained: Number.NaN,
                bossTrophyCacheOutcome: 'claimed',
                bossTrophyCacheScore: Number.NaN,
                hazardTileTriggers: Number.POSITIVE_INFINITY,
                recallMatches: Number.NaN,
                recallMistakes: Number.POSITIVE_INFINITY,
                recallBonusScore: Number.NaN
            },
            false
        );

        expect(rows.map((row) => row.detail).join(' ')).not.toMatch(/NaN|Infinity/);
        expect(rows.find((row) => row.id === 'performance_score')?.detail).toBe('Rating S; 0 mistakes; +0 score.');
        expect(rows.find((row) => row.id === 'featured_objective')?.detail).toBe('Completed for +0 score and +0 Favor.');
        expect(rows.find((row) => row.id === 'risk_wager')?.detail).toBe('Won for +0 Favor.');
        expect(rows.find((row) => row.id === 'boss_trophy_cache')?.detail).toBe(
            'Boss objective completed; trophy cache paid +0 score.'
        );
        expect(rows.find((row) => row.id === 'hazard_tiles')).toBeUndefined();
        expect(rows.find((row) => row.id === 'recall_focus')).toBeUndefined();
    });

    it('summarizes hazard tile triggers by kind', () => {
        const rows = getFloorClearCausalityRows(
            {
                ...baseResult,
                hazardTileTriggers: 6,
                hazardShuffleSnares: 2,
                hazardCascadeCaches: 1,
                hazardMirrorDecoys: 1,
                hazardFragileCacheClaims: 1,
                hazardFragileCacheBreaks: 1,
                hazardTollCaches: 1,
                hazardFuseCaches: 2,
                hazardFuseCacheExpiredClaims: 1
            },
            false
        );

        expect(rows.find((row) => row.id === 'hazard_tiles')).toMatchObject({
            group: 'hazard',
            label: 'Hazard tiles',
            detail:
                '2 snare shuffles; 1 cascade clear; 1 mirror decoy read; 1 fragile cache claim; 1 fragile cache break; 1 toll cache claim; 2 fuse cache claims (1 late). Hazard marks woke under the cards.',
            tokens: ['risk', 'hidden_known', 'momentum']
        });
        expect(rows.every((row) => assertTokenCoverage(row.tokens))).toBe(true);
    });

    it('summarizes lantern ward scouting', () => {
        const rows = getFloorClearCausalityRows(
            {
                ...baseResult,
                lanternWardScouts: 1
            },
            false
        );

        expect(rows.find((row) => row.id === 'lantern_ward_scouts')).toMatchObject({
            group: 'reward',
            label: 'Lantern Ward',
            detail:
                '1 lantern scout identified hidden danger or mystery information. The light left a readable mark in the room log.',
            tokens: ['safe', 'hidden_known', 'reward']
        });
        expect(rows.every((row) => assertTokenCoverage(row.tokens))).toBe(true);
    });

    it('summarizes omen seal scouting', () => {
        const rows = getFloorClearCausalityRows(
            {
                ...baseResult,
                omenSealScouts: 2
            },
            false
        );

        expect(rows.find((row) => row.id === 'omen_seal_scouts')).toMatchObject({
            group: 'reward',
            label: 'Omen Seal',
            detail:
                '2 omen scouts revealed hidden danger or mystery information. The seal wrote the warning before the cards forgot it.',
            tokens: ['hidden_known', 'reward', 'risk']
        });
        expect(rows.every((row) => assertTokenCoverage(row.tokens))).toBe(true);
    });

    it('summarizes mimic cache claims and bites', () => {
        const rows = getFloorClearCausalityRows(
            {
                ...baseResult,
                mimicCacheClaims: 2,
                mimicCacheBites: 1
            },
            false
        );

        expect(rows.find((row) => row.id === 'mimic_cache_claims')).toMatchObject({
            group: 'hazard',
            label: 'Mimic Cache',
            detail: '2 mimic cache claims; 1 bite triggered reduced loot.',
            tokens: ['risk', 'reward', 'forfeit']
        });
        expect(rows.every((row) => assertTokenCoverage(row.tokens))).toBe(true);
    });

    it('summarizes Guard Cache ward blocks', () => {
        const rows = getFloorClearCausalityRows(
            {
                ...baseResult,
                safeHazardWardsUsed: 1
            },
            false
        );

        expect(rows.find((row) => row.id === 'safe_hazard_wards')).toMatchObject({
            group: 'assist',
            label: 'Guard Cache ward',
            detail: '1 hazard ward blocked a snare or fragile cache break. The room kept one guarded memory intact.',
            tokens: ['safe', 'risk', 'hidden_known']
        });
        expect(rows.every((row) => assertTokenCoverage(row.tokens))).toBe(true);
    });

    it('summarizes recall focus as floor-clear memory performance', () => {
        const rows = getFloorClearCausalityRows(
            {
                ...baseResult,
                recallMatches: 3,
                recallMistakes: 1,
                recallBonusScore: 40
            },
            false
        );

        expect(rows.find((row) => row.id === 'recall_focus')).toMatchObject({
            group: 'performance',
            label: 'Recall focus',
            detail: '3 remembered matches; 1 recall lapse; +40 memory score. Room log updated.',
            tokens: ['momentum', 'risk', 'reward']
        });
        expect(rows.every((row) => assertTokenCoverage(row.tokens))).toBe(true);
    });
});
