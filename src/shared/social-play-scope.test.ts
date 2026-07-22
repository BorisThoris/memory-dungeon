import { describe, expect, it } from 'vitest';
import { getShippedSocialPlayDecision, getSocialPlayScopeRows, SOCIAL_PLAY_SCOPE_DECISION } from './social-play-scope';

describe('REG-051 social play scope decision', () => {
    it('ships share-only offline social and defers pass-and-play/online honestly', () => {
        expect(SOCIAL_PLAY_SCOPE_DECISION.shippedScope).toBe('share_only');
        expect(SOCIAL_PLAY_SCOPE_DECISION.persistedMultiplayerFields).toEqual([]);
        expect(SOCIAL_PLAY_SCOPE_DECISION.onlineRequiresReg052).toBe(true);

        const rows = getSocialPlayScopeRows();
        expect(rows.find((row) => row.id === 'share_strings')?.status).toBe('shipped');
        expect(rows.find((row) => row.id === 'pass_and_play')?.status).toBe('deferred');
        expect(rows.find((row) => row.id === 'online_challenges')?.uiCopy).toMatch(/online|deferred/i);
        expect(getShippedSocialPlayDecision()).toMatchObject({
            id: 'share_strings',
            persistence: 'derived_share_string'
        });
    });
});
