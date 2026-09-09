export type PremiumEconomyStatus = 'shipped' | 'forbidden' | 'separate_decision_required';

export interface PremiumEconomyPolicyRow {
    id:
        | 'product_stance'
        | 'ads_iap'
        | 'continues_lives_fairness'
        | 'accessibility'
        | 'core_power_access'
        | 'run_currency'
        | 'cosmetics';
    title: string;
    status: PremiumEconomyStatus | 'allowed_gameplay_system' | 'never_monetized';
    copy: string;
    allowedInSaveData: boolean;
    paymentLike?: boolean;
    uiCopy?: string;
}

export const PREMIUM_ECONOMY_POLICY_ROWS: readonly PremiumEconomyPolicyRow[] = [
    {
        id: 'product_stance',
        title: 'Premium offline-first',
        status: 'shipped',
        copy: 'Windows-first Steam premium positioning; no ad, subscription, or IAP economy is assumed.',
        allowedInSaveData: false
    },
    {
        id: 'ads_iap',
        title: 'Ads and IAP currencies',
        status: 'forbidden',
        copy: 'No rewarded ads, paid currency packs, subscriptions, or booster-store placeholders in v1.',
        allowedInSaveData: false
    },
    {
        id: 'continues_lives_fairness',
        title: 'Fairness is never monetized',
        status: 'forbidden',
        copy: 'Continues, lives, daily fairness, and core power access remain gameplay/balance systems only.',
        allowedInSaveData: false
    },
    {
        id: 'accessibility',
        title: 'Accessibility is never a sink',
        status: 'forbidden',
        copy: 'Settings such as motion, audio, timing, readability, focus assist, and input comfort are free preferences.',
        allowedInSaveData: false
    },
    {
        id: 'core_power_access',
        title: 'Core power access',
        status: 'never_monetized',
        copy: 'Core powers, continues, lives, fairness, and accessibility settings are never monetized.',
        uiCopy: 'Core powers, continues, lives, fairness, and accessibility settings are never monetized.',
        allowedInSaveData: false,
        paymentLike: false
    },
    {
        id: 'run_currency',
        title: 'Run currency is temporary',
        status: 'shipped',
        copy: 'Combo shards, guard tokens, and power charges are local run systems; they expire or reset by design.',
        allowedInSaveData: false
    },
    {
        id: 'cosmetics',
        title: 'Cosmetics are earned',
        status: 'separate_decision_required',
        copy: 'Cosmetic unlocks are local progression/honor rewards; paid cosmetic proposals require a separate product decision and migration plan.',
        allowedInSaveData: true
    }
];

export const getPremiumEconomyPolicyRows = (): readonly PremiumEconomyPolicyRow[] => PREMIUM_ECONOMY_POLICY_ROWS;

export const premiumEconomyCopyAuditPasses = (copy: string): boolean =>
    !/\b(ad pack|rewarded ad|iap|microtransaction|subscription|premium currency|pay.?to.?win|buy lives|buy continues)\b/i.test(copy);

export const PREMIUM_ECONOMY_POLICY = {
    productStance: 'premium_offline_first',
    prohibitedMonetization: ['ads', 'IAP currencies', 'subscriptions', 'pay-to-win boosters'],
    neverMonetize: ['continues', 'lives', 'fairness', 'accessibility_settings', 'core_power_access'],
    futureMonetizationRequiresDecision: true
} as const;

export interface PremiumEconomySurfacePolicy {
    id: 'run_resources' | 'cosmetics' | 'core_power_access';
    status: 'allowed_gameplay_system' | 'earned_progression' | 'never_monetized';
    paymentLike: false;
    uiCopy: string;
}

export const PREMIUM_ECONOMY_SURFACE_ROWS: readonly PremiumEconomySurfacePolicy[] = [
    {
        // The run has no currency: shards, guard tokens and charges are the only things it banks,
        // and all of them reset with the run. Nothing on this surface can look like a balance.
        id: 'run_resources',
        status: 'allowed_gameplay_system',
        paymentLike: false,
        uiCopy: 'Combo shards, guard tokens, and power charges are run-scoped resources, not a purchasable balance.'
    },
    {
        id: 'cosmetics',
        status: 'earned_progression',
        paymentLike: false,
        uiCopy: 'Cosmetics are local earned progression unless a separate future product decision says otherwise.'
    },
    {
        id: 'core_power_access',
        status: 'never_monetized',
        paymentLike: false,
        uiCopy: 'Core powers, lives, continues, and accessibility settings are never monetized.'
    }
];

export const premiumEconomyPolicyForSurface = (
    id: PremiumEconomySurfacePolicy['id']
): PremiumEconomySurfacePolicy | null => PREMIUM_ECONOMY_SURFACE_ROWS.find((row) => row.id === id) ?? null;
