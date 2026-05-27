import { describe, expect, it } from 'vitest';
import { AUDIO_INTERACTION_COVERAGE, audioCoverageRowsByDomain } from './audioInteractionCoverage';

describe('REG-037 audio interaction coverage', () => {
    it('covers major runtime domains with sampled fallbacks or intentional silence', () => {
        expect(new Set(AUDIO_INTERACTION_COVERAGE.map((row) => row.domain))).toEqual(
            new Set(['startup', 'menu', 'settings', 'gameplay', 'overlay', 'meta'])
        );
        expect(AUDIO_INTERACTION_COVERAGE.every((row) => row.reducedMotionSafe)).toBe(true);
        expect(AUDIO_INTERACTION_COVERAGE.every((row) => row.cooldownPolicy.length > 0)).toBe(true);
        expect(AUDIO_INTERACTION_COVERAGE.every((row) => row.semanticMoment.length > 0)).toBe(true);
        expect(AUDIO_INTERACTION_COVERAGE.filter((row) => row.decision === 'silent').map((row) => row.id)).toEqual([
            'passive_scroll'
        ]);
    });

    it('documents core gameplay mix roles separately from UI/meta roles', () => {
        const gameplay = audioCoverageRowsByDomain('gameplay');
        expect(gameplay.map((row) => row.id)).toEqual([
            'tile_flip',
            'resolve_match',
            'resolve_mismatch',
            'board_power',
            'gauntlet_pressure'
        ]);
        expect(gameplay.find((row) => row.id === 'resolve_match')?.mixRole).toMatch(/reward/i);
        expect(gameplay.find((row) => row.id === 'board_power')?.semanticMoment).toBe('arm');
        expect(gameplay.find((row) => row.id === 'resolve_mismatch')?.mixRole).toMatch(/fail/i);
    });
});
