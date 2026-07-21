import { describe, expect, it } from 'vitest';
import {
    assertTokenCoverage,
    calculateMemoryTaxReview,
    CORE_SAFE_MEMORY_TAX,
    MECHANIC_TOKEN_DEFINITIONS,
    MEMORY_TAX_AXES,
    perfectMemoryImpactCopy,
    type MemoryTaxAxis,
    type MechanicTokenId
} from './mechanic-feedback';

const EXPECTED_TOKENS = [
    'safe',
    'risk',
    'reward',
    'armed',
    'resolved',
    'hidden_known',
    'objective',
    'build',
    'cost',
    'forfeit',
    'locked',
    'momentum'
] as const satisfies readonly MechanicTokenId[];

const EXPECTED_MEMORY_TAX_AXES = [
    'informationBypass',
    'spatialDisruption',
    'mistakeRecovery',
    'hiddenPunishment',
    'boardCompletionRisk',
    'uiComprehensionLoad'
] as const satisfies readonly MemoryTaxAxis[];

describe('gameplay mechanic feedback contract', () => {
    it('defines the full semantic token vocabulary with a11y hints', () => {
        expect(Object.keys(MECHANIC_TOKEN_DEFINITIONS).sort()).toEqual([...EXPECTED_TOKENS].sort());
        expect(assertTokenCoverage(EXPECTED_TOKENS)).toBe(true);

        for (const token of EXPECTED_TOKENS) {
            const definition = MECHANIC_TOKEN_DEFINITIONS[token];
            expect(definition.label.length).toBeGreaterThan(0);
            expect(definition.purpose.length).toBeGreaterThan(0);
            expect(definition.a11yHint.length).toBeGreaterThan(0);
        }
    });

    it('scores memory-tax bands and blocks severe hidden punishment or completion risk', () => {
        expect(MEMORY_TAX_AXES).toEqual([...EXPECTED_MEMORY_TAX_AXES]);
        expect(Object.keys(CORE_SAFE_MEMORY_TAX).sort()).toEqual([...EXPECTED_MEMORY_TAX_AXES].sort());

        expect(calculateMemoryTaxReview(CORE_SAFE_MEMORY_TAX)).toMatchObject({
            total: 0,
            band: 'core_safe',
            blockedByAxis: false
        });

        expect(
            calculateMemoryTaxReview({
                informationBypass: 1,
                spatialDisruption: 1,
                mistakeRecovery: 1,
                hiddenPunishment: 1,
                boardCompletionRisk: 1,
                uiComprehensionLoad: 1
            })
        ).toMatchObject({ total: 6, band: 'controlled_assist_or_pressure' });

        expect(
            calculateMemoryTaxReview({
                informationBypass: 0,
                spatialDisruption: 0,
                mistakeRecovery: 0,
                hiddenPunishment: 3,
                boardCompletionRisk: 0,
                uiComprehensionLoad: 0
            })
        ).toMatchObject({ band: 'reject_or_defer', blockedByAxis: true });
    });

    it('keeps Perfect Memory copy centralized for safe and assist actions', () => {
        expect(perfectMemoryImpactCopy('allowed')).toBe('Perfect Memory-safe.');
        expect(perfectMemoryImpactCopy('locks_perfect_memory')).toBe('Assist used: Perfect Memory locked.');
    });
});
