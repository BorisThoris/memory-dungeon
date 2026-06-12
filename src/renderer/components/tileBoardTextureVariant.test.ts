import { describe, expect, it } from 'vitest';
import { frontRoughnessVariantForSurface, overlayVariantForSurface } from './tileBoardTextureVariant';

describe('tileBoardTextureVariant', () => {
    it('uses active front roughness for hidden surfaces because there is no hidden front face', () => {
        expect(frontRoughnessVariantForSurface('hidden')).toBe('active');
    });

    it('keeps visible front roughness variants unchanged', () => {
        expect(frontRoughnessVariantForSurface('active')).toBe('active');
        expect(frontRoughnessVariantForSurface('matched')).toBe('matched');
        expect(frontRoughnessVariantForSurface('mismatch')).toBe('mismatch');
    });

    it('omits overlays for hidden surfaces and keeps visible overlay variants unchanged', () => {
        expect(overlayVariantForSurface('hidden')).toBeNull();
        expect(overlayVariantForSurface('active')).toBe('active');
        expect(overlayVariantForSurface('matched')).toBe('matched');
        expect(overlayVariantForSurface('mismatch')).toBe('mismatch');
    });
});
