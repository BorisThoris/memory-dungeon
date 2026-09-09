/*
 * The interactions a match can preview. Nineteen tags stood here across nine traits; the trait
 * triage kept four traits, and an interaction survives only when both of its halves did. Every
 * one that remains fires on a clean match - the miss-side tags all belonged to cut traits.
 */
export const TILE_TRAIT_INTERACTION_TEXT = {
    'conduit:adjacent-score': 'Conduit: adjacent trait charge',
    'conduit:echo-peek': 'Conduit + Echo: peek spark',
    'conduit:stasis-lock': 'Conduit + Stasis: lock pulse',
    'stasis:nearby-block': 'Stasis: nearby trait blocked'
} as const;

export type TileTraitInteractionTag = keyof typeof TILE_TRAIT_INTERACTION_TEXT;

export const TILE_TRAIT_INTERACTION_TAGS = [
    'conduit:adjacent-score',
    'conduit:echo-peek',
    'conduit:stasis-lock',
    'stasis:nearby-block'
] as const satisfies readonly TileTraitInteractionTag[];

const isTileTraitInteractionTag = (value: string): value is TileTraitInteractionTag =>
    Object.prototype.hasOwnProperty.call(TILE_TRAIT_INTERACTION_TEXT, value);

export const formatTileTraitInteractionTags = (tags: readonly string[]): string[] => {
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const tag of tags) {
        const line = isTileTraitInteractionTag(tag) ? TILE_TRAIT_INTERACTION_TEXT[tag] : undefined;
        if (!line || seen.has(line)) {
            continue;
        }
        seen.add(line);
        lines.push(line);
    }
    return lines;
};
