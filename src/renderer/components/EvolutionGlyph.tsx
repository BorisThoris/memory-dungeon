import type { BlueprintId } from '../../shared/boss-reward-rules';

/**
 * The six evolutions' marks (DGE-014, 2026-10-24): an inline line glyph per evolved relic, drawn in
 * the chip's own ink (`currentColor`), like the Dread's eye. No file to load, nothing to preload.
 */
const GLYPH_PATHS: Readonly<Record<BlueprintId, readonly string[]>> = {
    // A lantern: handle, cage and flame.
    lantern_of_recall: ['M9 3h6', 'M12 3v2', 'M8 6h8l-1 12H9z', 'M12 10c-1.4 1.6-1.4 3.4 0 5c1.4-1.6 1.4-3.4 0-5z', 'M7 20h10'],
    // A vault door: the round door and its wheel.
    misers_vault: ['M4 4h16v16H4z', 'M12 7a5 5 0 1 0 0.01 0z', 'M12 9.5v5', 'M9.5 12h5'],
    // A thread wound between two pins.
    cartographers_thread: ['M5 19c3-10 11-4 14-14', 'M5 19m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0', 'M19 5m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0'],
    // A heart set as an arch's keystone.
    keystone_heart: ['M12 20c-5-3.6-8-6.6-8-10a4 4 0 0 1 8-1.6a4 4 0 0 1 8 1.6c0 3.4-3 6.4-8 10z', 'M10 9h4l-0.8 4h-2.4z'],
    // A glass held over a mask.
    unmasking_glass: ['M4 9c2-2 5-2 6 0c-1 2-4 2-6 0z', 'M10 9c1-2 4-2 6 0', 'M15 14m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', 'M18 17l3 3'],
    // Three echoing arcs.
    echo_chamber: ['M6 12h0.01', 'M9 8.5a5 5 0 0 1 0 7', 'M12.5 6a8.5 8.5 0 0 1 0 12', 'M16 3.5a12 12 0 0 1 0 17']
};

export const EvolutionGlyph = ({ id, className }: { id: string; className?: string }) => {
    const paths = GLYPH_PATHS[id as BlueprintId];
    if (!paths) return null;
    return (
        <svg aria-hidden="true" className={className} data-evolution-glyph={id} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} viewBox="0 0 24 24">
            {paths.map((d) => <path d={d} key={d} />)}
        </svg>
    );
};
