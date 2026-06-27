import type { MotionPermissionState } from './platformTiltTypes';

type MotionPermissionCopyContext = 'board' | 'intro';
type PlatformMotionCapability = 'desktop_pointer' | 'touch_motion' | 'unsupported';

interface PlatformPolishPolicy {
    motionCapability: PlatformMotionCapability;
    hapticsCapability: 'no_op_v1';
    permissionGate: 'user_initiated_only';
    reducedMotionBehavior: 'suppress_motion_and_hide_permission_cta';
    essentialFeedbackPolicy: 'visual_audio_first_haptics_optional';
}

export const getPlatformPolishPolicy = ({
    hasDeviceOrientationRequest,
    reduceMotion,
    touchPrimary
}: {
    hasDeviceOrientationRequest: boolean;
    reduceMotion: boolean;
    touchPrimary: boolean;
}): PlatformPolishPolicy => {
    void reduceMotion;
    return {
    motionCapability: touchPrimary && hasDeviceOrientationRequest ? 'touch_motion' : touchPrimary ? 'unsupported' : 'desktop_pointer',
    hapticsCapability: 'no_op_v1',
    permissionGate: 'user_initiated_only',
    reducedMotionBehavior: 'suppress_motion_and_hide_permission_cta',
    essentialFeedbackPolicy: 'visual_audio_first_haptics_optional'
    };
};

export const getPlatformMotionCapabilityRows = (): Array<{
    id: 'desktop_pointer' | 'touch_motion' | 'haptics';
    permissionModel: 'none' | 'user_initiated';
    permissionPrompt: 'none' | 'user_initiated_only';
    supported: boolean | 'optional';
    copy: string;
    reducedMotionBehavior: string;
}> => [
    {
        id: 'desktop_pointer',
        permissionModel: 'none',
        permissionPrompt: 'none',
        supported: true,
        copy: 'Desktop pointer tilt is permissionless polish.',
        reducedMotionBehavior: 'Pointer tilt is suppressed when reduce motion is active.'
    },
    {
        id: 'touch_motion',
        permissionModel: 'user_initiated',
        permissionPrompt: 'user_initiated_only',
        supported: 'optional',
        copy: 'Touch motion can be enabled from an explicit CTA and is hidden when reduced motion suppresses parallax.',
        reducedMotionBehavior: 'Permission CTA is hidden and gyro target is zeroed.'
    },
    {
        id: 'haptics',
        permissionModel: 'none',
        permissionPrompt: 'none',
        supported: false,
        copy: 'Haptics are optional no-op polish in v1; visual and audio feedback remain primary.',
        reducedMotionBehavior: 'No essential haptic signal exists; reduced motion never removes core feedback.'
    }
];

export const motionHapticsCarryEssentialFeedback = (): false => false;

export function shouldOfferDeviceMotionPermission(params: {
    touchPrimary: boolean;
    motionParallaxSuppressed: boolean;
    permission: MotionPermissionState;
}): boolean {
    if (!params.touchPrimary || params.motionParallaxSuppressed) {
        return false;
    }

    return params.permission === 'prompt' || params.permission === 'denied';
}

/**
 * Labels for the motion-permission chip / CTA. `denied` uses retry-oriented copy.
 */
export function getMotionPermissionButtonLabels(
    permission: MotionPermissionState,
    context: MotionPermissionCopyContext = 'board'
): { ariaLabel: string; buttonText: string } {
    if (permission === 'denied') {
        return {
            buttonText: 'Try again',
            ariaLabel:
                context === 'intro'
                    ? 'Request device motion permission again for this intro'
                    : 'Request device motion permission again for parallax on the board'
        };
    }

    return {
        buttonText: 'Enable motion',
        ariaLabel:
            context === 'intro'
                ? 'Enable device motion for this intro'
                : 'Enable device motion for parallax on the board'
    };
}
