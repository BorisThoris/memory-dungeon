import { describe, expect, it } from 'vitest';
import { COPY_TONE_RULES, copyToneAllowsPlayerFacingText, getCopyToneRuleRows } from './copy-tone';

describe('REG-101 copy tone rules', () => {
    it('defines concise, rules-aligned, premium/offline-safe microcopy rules', () => {
        expect(getCopyToneRuleRows().map((row) => row.id)).toEqual([
            'rules_match_engine',
            'economy_premium',
            'offline_scope',
            'mobile_concise'
        ]);
        expect(COPY_TONE_RULES.every((row) => row.preferred.length > 0)).toBe(true);
        expect(COPY_TONE_RULES.find((row) => row.id === 'atmospheric_feedback')).toMatchObject({
            surface: 'run_feedback',
            preferred: expect.arrayContaining(['archive', 'room', 'memory', 'route', 'cards'])
        });
        expect(copyToneAllowsPlayerFacingText('Spend shop gold: Peek charge · 2g')).toBe(true);
        expect(copyToneAllowsPlayerFacingText('Buy premium coins to continue')).toBe(false);
        expect(copyToneAllowsPlayerFacingText('Global online leaderboard rank')).toBe(false);
    });
});
