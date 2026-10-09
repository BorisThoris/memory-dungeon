import type { GraphicsQualityPreset } from '../../shared/contracts';

/** Detailed departing cards share a fixed budget; pooled sparks still cover the whole wave. */
export const cardDepartureEffectBudget = (quality: GraphicsQualityPreset): number =>
    quality === 'low' ? 8 : quality === 'medium' ? 16 : 24;
