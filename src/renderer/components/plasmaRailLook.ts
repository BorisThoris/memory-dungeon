import { comboHeatLevels } from '../../shared/combo-heat-rules';

/**
 * How the combo meter's plasma beam looks at a combo (`PlasmaRail.tsx`). Heat saturates by forty
 * links; past Legendary the ascensions' surge (log2, unbounded) keeps it growing on a soft cap, so
 * a very deep chain is still visibly climbing without the beam ever becoming a solid bar.
 */
export interface PlasmaRailLook {
    /** The beam's core width in CSS pixels. */
    width: number;
    /** How bright its glow is, 0..1. */
    glow: number;
    /** How fast the plasma runs up it, in rail heights a second. */
    flow: number;
    /** Drips let go a second. */
    drips: number;
}

const softCap = (value: number, ceiling: number): number => ceiling * (1 - Math.exp(-value / ceiling));

export const plasmaRailLook = (combo: number): PlasmaRailLook => {
    const { heat, surge, stageIndex } = comboHeatLevels(combo);
    const deep = softCap(surge, 2);
    return {
        width: 1 + heat * 3 + deep * 1.2,
        glow: Math.min(1, heat * 0.85 + deep * 0.1),
        flow: 0.25 + heat * 0.9 + deep * 0.3,
        drips: stageIndex < 2 ? 0 : (heat * heat * 3 + deep * 1.5)
    };
};
