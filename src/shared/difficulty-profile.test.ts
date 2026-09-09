import { describe, expect, it } from 'vitest';
import { MEMORIZE_BASE_MS, MEMORIZE_MIN_MS, MEMORIZE_STEP_MS } from './contracts';
import {
    getCurrentDifficultyProfile,
    getDifficultyProfileRows,
    SHIPPED_FAIR_DIFFICULTY_PROFILE
} from './difficulty-profile';

describe('REG-046 difficulty profile contract', () => {
    it('keeps shipped default explicit and distinguishes deferred variants', () => {
        const current = getCurrentDifficultyProfile();
        expect(current.id).toBe('classic_fair');
        expect(current.status).toBe('shipped');
        expect(current.constants).toEqual({
            memorizeBaseMs: MEMORIZE_BASE_MS,
            memorizeStepMs: MEMORIZE_STEP_MS,
            memorizeMinMs: MEMORIZE_MIN_MS
        });
        expect(current.rules).toContain('a ceiling at three times par');

        const rows = getDifficultyProfileRows();
        expect(rows.map((row) => row.id)).toEqual(['classic_fair', 'practice_soft', 'purist_hard']);
        expect(rows.filter((row) => row.status === 'deferred')).toHaveLength(2);
        expect(rows.every((row) => row.dailyComparable === (row.id === 'classic_fair'))).toBe(true);
    });

    it('describes the shipped profile by the par and the ceiling, not by a life economy (Gen 183)', () => {
        // Lives, the first-mismatch grace, guard tokens and the shard-to-life conversion went in
        // Gen 183 (docs/REMOVED_LIVES.md); the one profile has no forgiveness block to summarize.
        expect(SHIPPED_FAIR_DIFFICULTY_PROFILE.playerCopy).toContain('three times par');
        expect(SHIPPED_FAIR_DIFFICULTY_PROFILE).not.toHaveProperty('lives');
        expect(SHIPPED_FAIR_DIFFICULTY_PROFILE).not.toHaveProperty('forgiveness');
        const removed = /\blives\b|\blife\b|guard|grace|shard/i;
        expect(SHIPPED_FAIR_DIFFICULTY_PROFILE.playerCopy).not.toMatch(removed);
        for (const row of getDifficultyProfileRows()) {
            expect(row.rules, row.id).not.toMatch(removed);
            expect(row.constants, row.id).not.toHaveProperty('maxLives');
        }
    });
});
