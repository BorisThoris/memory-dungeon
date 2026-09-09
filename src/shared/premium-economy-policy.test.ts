import { describe, expect, it } from 'vitest';
import {
    getPremiumEconomyPolicyRows,
    PREMIUM_ECONOMY_POLICY,
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
        expect(rows.every((row) => !/buy gems|pay.?to.?win|buy lives|buy continues/i.test(row.uiCopy ?? ''))).toBe(true);
    });
});
