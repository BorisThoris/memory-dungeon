import type { FaceVariant } from './tileTextures';

export const frontRoughnessVariantForSurface = (surfaceVariant: FaceVariant): Exclude<FaceVariant, 'hidden'> =>
    surfaceVariant === 'hidden' ? 'active' : surfaceVariant;

export const overlayVariantForSurface = (surfaceVariant: FaceVariant): Exclude<FaceVariant, 'hidden'> | null =>
    surfaceVariant === 'hidden' ? null : surfaceVariant;
