import { createContext, useContext, type MutableRefObject } from 'react';
import type { MotionPermissionState, TiltVector } from './platformTiltTypes';

export interface PlatformTiltContextValue {
    gyroTiltRef: MutableRefObject<TiltVector>;
    permission: MotionPermissionState;
    requestMotionPermission: () => Promise<void>;
}

export const PlatformTiltContext = createContext<PlatformTiltContextValue | null>(null);

export const usePlatformTiltContext = (): PlatformTiltContextValue => {
    const ctx = useContext(PlatformTiltContext);

    if (!ctx) {
        throw new Error('usePlatformTiltContext must be used within PlatformTiltProvider');
    }

    return ctx;
};
