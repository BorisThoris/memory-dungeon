import { describe, expect, it } from 'vitest';
import type { TileTraitKind } from './contracts';
import {
    getTraitBuildDraftHintForRelic,
    getTraitBuildRewardRows,
    getTraitBuildRewardRowsForRelic,
    getTraitBuildRewardRowsForTrait,
    TRAIT_BUILD_REWARD_ROWS
} from './trait-build-rewards';

const ALL_TRAITS: readonly TileTraitKind[] = [
    'echo',
    'volatile',
    'mirror',
    'cursed',
    'sealed',
    'heavy',
    'drift',
    'conduit',
    'stasis'
];

describe('trait build reward rows', () => {
    it('keeps every current trait represented by at least one reward archetype', () => {
        const represented = new Set(getTraitBuildRewardRows().flatMap((row) => row.traitKinds));

        for (const trait of ALL_TRAITS) {
            expect(represented.has(trait)).toBe(true);
            expect(getTraitBuildRewardRowsForTrait(trait).length).toBeGreaterThan(0);
        }
    });

    it('connects every trait build archetype to relic and shop support', () => {
        const rows = getTraitBuildRewardRows();

        expect(rows).toHaveLength(TRAIT_BUILD_REWARD_ROWS.length);
        expect(rows.every((row) => row.traitKinds.length >= 2)).toBe(true);
        expect(rows.every((row) => row.relicIds.length > 0)).toBe(true);
        expect(rows.every((row) => row.shopItemIds.includes('region_shuffle_charge'))).toBe(true);
        expect(rows.every((row) => row.decision.length > 0 && row.payoff.length > 0)).toBe(true);
        expect(rows.every((row) => row.regressionHook.startsWith('trait-build:'))).toBe(true);
    });

    it('returns defensive copies for callers that build UI or reports', () => {
        const [row] = getTraitBuildRewardRows();
        row!.traitKinds.push('echo');
        row!.relicIds.length = 0;

        expect(getTraitBuildRewardRows()[0]!.relicIds.length).toBeGreaterThan(0);
        expect(getTraitBuildRewardRows()[0]!.traitKinds).toEqual(TRAIT_BUILD_REWARD_ROWS[0]!.traitKinds);
    });

    it('summarizes relic-driven trait build hints for reward drafts', () => {
        expect(getTraitBuildRewardRowsForRelic('chapter_compass').map((row) => row.id)).toContain('conduit_cartographer');
        expect(getTraitBuildDraftHintForRelic('chapter_compass')).toBe('Trait build: Conduit Cartographer');
        expect(getTraitBuildDraftHintForRelic('wager_surety')).toBe('Trait build: Cursed Greed');
        expect(getTraitBuildDraftHintForRelic('stray_charge_plus_one')).toBeNull();
    });
});
