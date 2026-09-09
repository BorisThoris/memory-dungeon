import type { TileTraitKind } from './contracts';
import {
    TILE_TRAIT_COPY,
    TILE_TRAIT_INTERACTION_TAGS,
    TILE_TRAIT_INTERACTION_TEXT,
    type TileTraitInteractionTag
} from './tile-trait-rules';
import { describeTraitMark, tileTraitMark } from './tile-trait-marks';

export interface TileTraitCodexRow {
    id: string;
    title: string;
    description: string;
}

/* Listed in the order a player meets them: the two that pay on their own, then the two that pay for neighbours. */
const TRAIT_KIND_ORDER: readonly TileTraitKind[] = ['echo', 'heavy', 'conduit', 'stasis'];

const INTERACTION_DESCRIPTIONS: Record<TileTraitInteractionTag, string> = {
    'conduit:adjacent-score': 'Match Conduit beside any other trait to convert local board texture into score.',
    'conduit:echo-peek': 'Match Conduit beside Echo to add a peek charge to the Conduit payoff.',
    'conduit:stasis-lock': 'Match Conduit beside Stasis to add score and pulse a safe next-turn trait block when the board can support it.',
    'stasis:nearby-block': 'Match Stasis while another safe pair remains to block a nearby trait tile from being opened first next turn.'
};

export const getTileTraitCodexRows = (): TileTraitCodexRow[] =>
    TRAIT_KIND_ORDER.map((kind) => {
        const copy = TILE_TRAIT_COPY[kind];
        // The mark leads: it is what a player is looking at on a hidden tile, and the code is only
        // learnable if the Codex says which shape belongs to which trait.
        return {
            id: `trait-${kind}`,
            title: `${copy.label} · ${describeTraitMark(tileTraitMark(kind))}`,
            description: `Match: ${copy.match} Miss: ${copy.mismatch}`
        };
    });

export const getTileTraitInteractionCodexRows = (): TileTraitCodexRow[] =>
    TILE_TRAIT_INTERACTION_TAGS.map((tag) => ({
        id: `trait-interaction-${tag}`,
        title: TILE_TRAIT_INTERACTION_TEXT[tag],
        description: INTERACTION_DESCRIPTIONS[tag]
    }));
