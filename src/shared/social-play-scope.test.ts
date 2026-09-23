import { describe, expect, it } from 'vitest';
import {
    buildSocialScopeNote,
    buildSocialShareCopy,
    getShippedSocialPlayDecision,
    getSocialPlayScopeRows,
    SOCIAL_PLAY_SCOPE_DECISION
} from './social-play-scope';

describe('REG-051 social play scope decision', () => {
    it('ships offline share strings and same-device play, and still defers everything online', () => {
        expect(SOCIAL_PLAY_SCOPE_DECISION.shippedScope).toBe('share_and_same_device');
        // Unchanged by pass-and-play, and the reason it could ship: a shared game persists nothing.
        expect(SOCIAL_PLAY_SCOPE_DECISION.persistedMultiplayerFields).toEqual([]);
        expect(SOCIAL_PLAY_SCOPE_DECISION.onlineRequiresReg052).toBe(true);

        const rows = getSocialPlayScopeRows();
        expect(rows.find((row) => row.id === 'share_strings')?.status).toBe('shipped');
        expect(rows.find((row) => row.id === 'pass_and_play')?.status).toBe('shipped');
        expect(rows.find((row) => row.id === 'pass_and_play')?.onlineRequired).toBe(false);
        expect(rows.find((row) => row.id === 'online_challenges')?.status).toBe('deferred');
        expect(rows.find((row) => row.id === 'online_challenges')?.uiCopy).toMatch(/online|deferred/i);
        expect(getShippedSocialPlayDecision()).toMatchObject({
            id: 'share_strings',
            persistence: 'derived_share_string'
        });
    });

    it('tells a player what plays offline in the words the screen uses', () => {
        // Built from the rows, so it still cannot promise less or more than ships; but it is a
        // sentence on Choose Your Path under a field labelled "Paste a run key", not a scope memo.
        expect(buildSocialScopeNote()).toBe(
            'Everything here plays offline: solo runs, run keys and same-device play. No online challenges.'
        );
    });

    it('normalizes malformed score and seed values before building share copy', () => {
        expect(buildSocialShareCopy({ mode: 'Daily', score: 1234.9, seed: 99.8 })).toBe(
            'Daily · 1,234 local score · seed 99 · share-only v1, no online rank'
        );
        expect(buildSocialShareCopy({ mode: 'Daily', score: Number.NaN, seed: Number.POSITIVE_INFINITY })).toBe(
            'Daily · no score yet · seed unavailable · share-only v1, no online rank'
        );
    });
});
