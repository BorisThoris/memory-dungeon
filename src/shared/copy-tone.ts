import { MECHANICS_GLOSSARY_TERMS } from './mechanics-encyclopedia';

export type CopyToneSurface = 'hud' | 'codex' | 'game_over' | 'shop' | 'settings' | 'onboarding' | 'run_feedback';

export interface CopyToneRule {
    id: 'preferred_terms' | 'premium_safe' | 'offline_honest' | 'concise_mobile' | 'atmospheric_feedback';
    surface: CopyToneSurface | 'all';
    rule: string;
    examples: string[];
    preferred: string[];
}

export const COPY_TONE_RULES: readonly CopyToneRule[] = [
    {
        id: 'preferred_terms',
        surface: 'all',
        rule: 'Use glossary preferred labels for recurring mechanics and avoid internal IDs.',
        examples: MECHANICS_GLOSSARY_TERMS.map((term) => term.preferredLabel),
        preferred: ['Perfect Memory', 'combo shard', 'shop gold', 'Relic Favor']
    },
    {
        id: 'premium_safe',
        surface: 'shop',
        rule: 'Run shops spend temporary run resources; do not use real-money verbs for temporary gold.',
        examples: ['Spend shop gold', 'Claimed', 'Not enough shop gold'],
        preferred: ['Spend shop gold', 'Claimed', 'temporary run resource']
    },
    {
        id: 'offline_honest',
        surface: 'all',
        rule: 'Name local/share-only behavior and avoid promising online ranks or account-backed services.',
        examples: ['local-only comparison', 'share-only v1', 'online leaderboard deferred'],
        preferred: ['local-only', 'share-only', 'online leaderboard deferred']
    },
    {
        id: 'concise_mobile',
        surface: 'hud',
        rule: 'Keep HUD and card microcopy short enough for phone layouts.',
        examples: ['Favor', 'Wager', 'Perfect Memory', 'combo shard'],
        preferred: ['Favor', 'Wager', 'Rules', 'Codex']
    },
    {
        id: 'atmospheric_feedback',
        surface: 'run_feedback',
        rule: 'Live and floor-clear feedback should name the mechanic first, then add restrained memory-dungeon texture.',
        examples: ['Hazards: 2 triggered, 1 warded. Hazard marks woke under the cards.', 'Recall: Focus 2/3. Room log updated.'],
        preferred: ['archive', 'room', 'memory', 'route', 'cards']
    }
];

export const copyUsesPreferredMechanicLabels = (copy: string): boolean => {
    const lower = copy.toLowerCase();
    const forbidden = MECHANICS_GLOSSARY_TERMS.flatMap((term) => term.avoidLabels).map((label) => label.toLowerCase());
    return forbidden.every((label) => !lower.includes(label));
};

export const getCopyToneRuleRows = () => LEGACY_COPY_TONE_RULES;

export const LEGACY_COPY_TONE_RULES = [
    {
        id: 'rules_match_engine',
        preferred: ['Perfect Memory', 'combo shard', 'shop gold', 'Relic Favor']
    },
    {
        id: 'economy_premium',
        preferred: ['Spend shop gold', 'Claimed', 'temporary run resource']
    },
    {
        id: 'offline_scope',
        preferred: ['local-only', 'share-only', 'online leaderboard deferred']
    },
    {
        id: 'mobile_concise',
        preferred: ['Favor', 'Wager', 'Rules', 'Codex']
    }
] as const;

export const copyAvoidsRealMoneyLanguage = (copy: string): boolean =>
    !/\b(buy|bought|purchase|premium currency|iap|microtransaction|cash shop|pay-to-win)\b/i.test(copy);

export const copyToneAllowsPlayerFacingText = (copy: string): boolean =>
    copyUsesPreferredMechanicLabels(copy) &&
    copyAvoidsRealMoneyLanguage(copy) &&
    !/\bglobal online leaderboard rank\b/i.test(copy);

