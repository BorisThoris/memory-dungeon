import { describe, expect, it } from 'vitest';
import {
    getMotionPermissionButtonLabels,
    getPlatformMotionCapabilityRows,
    getPlatformPolishPolicy,
    motionHapticsCarryEssentialFeedback,
    shouldOfferDeviceMotionPermission
} from './platformTiltPermissionUi';

describe('shouldOfferDeviceMotionPermission', () => {
    it('is false when touch is not primary', () => {
        expect(
            shouldOfferDeviceMotionPermission({
                motionParallaxSuppressed: false,
                permission: 'prompt',
                touchPrimary: false
            })
        ).toBe(false);
    });

    it('is false when parallax is suppressed (reduce motion)', () => {
        expect(
            shouldOfferDeviceMotionPermission({
                motionParallaxSuppressed: true,
                permission: 'prompt',
                touchPrimary: true
            })
        ).toBe(false);
    });

    it('is true for prompt or denied on touch when motion is allowed', () => {
        expect(
            shouldOfferDeviceMotionPermission({
                motionParallaxSuppressed: false,
                permission: 'prompt',
                touchPrimary: true
            })
        ).toBe(true);
        expect(
            shouldOfferDeviceMotionPermission({
                motionParallaxSuppressed: false,
                permission: 'denied',
                touchPrimary: true
            })
        ).toBe(true);
    });

    it('is false when permission is granted or unsupported', () => {
        expect(
            shouldOfferDeviceMotionPermission({
                motionParallaxSuppressed: false,
                permission: 'granted',
                touchPrimary: true
            })
        ).toBe(false);
        expect(
            shouldOfferDeviceMotionPermission({
                motionParallaxSuppressed: false,
                permission: 'unsupported',
                touchPrimary: true
            })
        ).toBe(false);
    });
});

describe('getMotionPermissionButtonLabels', () => {
    it('uses first-time copy for prompt', () => {
        expect(getMotionPermissionButtonLabels('prompt', 'board').buttonText).toBe('Enable motion');
        expect(getMotionPermissionButtonLabels('prompt', 'intro').ariaLabel).toMatch(/intro/i);
    });

    it('uses retry copy for denied', () => {
        const board = getMotionPermissionButtonLabels('denied', 'board');
        expect(board.buttonText).toBe('Try again');
        expect(board.ariaLabel).toMatch(/again/i);
    });
});

describe('REG-067 platform motion/haptics policy', () => {
    it('documents optional platform support and no essential haptics', () => {
        expect(
            getPlatformPolishPolicy({
                hasDeviceOrientationRequest: true,
                reduceMotion: false,
                touchPrimary: true
            })
        ).toMatchObject({
            motionCapability: 'touch_motion',
            hapticsCapability: 'no_op_v1',
            permissionGate: 'user_initiated_only',
            essentialFeedbackPolicy: 'visual_audio_first_haptics_optional'
        });
        expect(
            getPlatformPolishPolicy({
                hasDeviceOrientationRequest: false,
                reduceMotion: true,
                touchPrimary: false
            }).motionCapability
        ).toBe('desktop_pointer');
        const rows = getPlatformMotionCapabilityRows();
        expect(rows.find((row) => row.id === 'touch_motion')?.permissionModel).toBe('user_initiated');
        expect(rows.find((row) => row.id === 'haptics')?.supported).toBe(false);
        expect(rows.every((row) => row.reducedMotionBehavior.length > 0)).toBe(true);
        expect(motionHapticsCarryEssentialFeedback()).toBe(false);
    });
});
