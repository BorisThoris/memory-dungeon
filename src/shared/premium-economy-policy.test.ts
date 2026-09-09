import { describe, expect, it } from 'vitest';
import {
    getPremiumEconomyPolicyRows,
    PREMIUM_ECONOMY_POLICY,
    PREMIUM_ECONOMY_SURFACE_ROWS,
    premiumEconomyCopyAuditPasses,
    premiumEconomyPolicyForSurface
} from './premium-economy-policy';

describe('REG-054 premium economy policy', () => {
    it('keeps v1 premium/offline with no ad, IAP, or pay-to-win assumptions', () => {
        expect(PREMIUM_ECONOMY_POLICY.productStance).toBe('premium_offline_first');
        expect(PREMIUM_ECONOMY_POLICY.prohibitedMonetization).toContain('ads');
        expect(PREMIUM_ECONOMY_POLICY.neverMonetize).toContain('accessibility_settings');
        expect(PREMIUM_ECONOMY_POLICY.futureMonetizationRequiresDecision).toBe(true);
    });

    it('classifies economy surfaces as gameplay systems rather than payment placeholders', () => {
        const rows = getPremiumEconomyPolicyRows();
        expect(rows.some((row) => /shop gold|favor|relic/i.test(`${row.title} ${row.copy}`))).toBe(false);
        expect(premiumEconomyPolicyForSurface('run_resources')?.paymentLike).toBe(false);
        expect(premiumEconomyPolicyForSurface('run_resources')?.status).toBe('allowed_gameplay_system');
        expect(premiumEconomyPolicyForSurface('core_power_access')?.status).toBe('never_monetized');
        expect(rows.every((row) => !/buy gems|pay.?to.?win|buy continues/i.test(row.uiCopy ?? ''))).toBe(true);
    });

    it('names no lives or guard tokens: the run has neither since Gen 183', () => {
        // The policy still refuses to monetize continues; it cannot refuse to monetize a thing the
        // game does not have (docs/REMOVED_LIVES.md), and copy that named it would read as a promise.
        expect(PREMIUM_ECONOMY_POLICY.neverMonetize).toContain('continues');
        expect(PREMIUM_ECONOMY_POLICY.neverMonetize).not.toContain('lives');
        const removed = /\blives\b|\blife\b|guard token/i;
        for (const row of getPremiumEconomyPolicyRows()) {
            expect(`${row.title} ${row.copy} ${row.uiCopy ?? ''}`, row.id).not.toMatch(removed);
        }
        for (const row of PREMIUM_ECONOMY_SURFACE_ROWS) {
            expect(row.uiCopy, row.id).not.toMatch(removed);
        }
        expect(premiumEconomyCopyAuditPasses('buy continues')).toBe(false);
        expect(premiumEconomyCopyAuditPasses('Combo shards and power charges reset with the run.')).toBe(true);
    });
});
