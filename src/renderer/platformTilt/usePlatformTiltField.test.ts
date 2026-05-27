import { describe, expect, it } from 'vitest';
import { shouldCommitTiltCssVars, shouldUseGyroForPointerCapabilities } from './usePlatformTiltField';

describe('shouldUseGyroForPointerCapabilities', () => {
    it('uses gyro on coarse-only devices', () => {
        expect(shouldUseGyroForPointerCapabilities({ coarse: true, fine: false }, false)).toBe(true);
        expect(shouldUseGyroForPointerCapabilities({ coarse: true, fine: false }, true)).toBe(true);
    });

    it('uses pointer input on fine-only devices', () => {
        expect(shouldUseGyroForPointerCapabilities({ coarse: false, fine: true }, false)).toBe(false);
        expect(shouldUseGyroForPointerCapabilities({ coarse: false, fine: true }, true)).toBe(false);
    });

    it('lets recent mouse movement override gyro on hybrid devices', () => {
        expect(shouldUseGyroForPointerCapabilities({ coarse: true, fine: true }, false)).toBe(true);
        expect(shouldUseGyroForPointerCapabilities({ coarse: true, fine: true }, true)).toBe(false);
    });
});

describe('shouldCommitTiltCssVars', () => {
    it('skips repeated tilt CSS writes for the same node and rounded values', () => {
        const node = document.createElement('div');
        const tilt = { x: '0.1250', y: '-0.2500' };

        expect(shouldCommitTiltCssVars(null, null, tilt, node)).toBe(true);
        expect(shouldCommitTiltCssVars(tilt, node, tilt, node)).toBe(false);
        expect(shouldCommitTiltCssVars(tilt, node, { x: '0.1251', y: '-0.2500' }, node)).toBe(true);
        expect(shouldCommitTiltCssVars(tilt, node, tilt, document.createElement('div'))).toBe(true);
        expect(shouldCommitTiltCssVars(tilt, node, tilt, null)).toBe(false);
    });
});
