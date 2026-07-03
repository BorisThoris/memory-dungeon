import type { TileTraitKind } from './contracts';
import { TILE_TRAIT_COPY, TILE_TRAIT_INTERACTION_TEXT, type TileTraitInteractionTag } from './tile-trait-rules';

export interface TileTraitCodexRow {
    id: string;
    title: string;
    description: string;
}

const TRAIT_KIND_ORDER: readonly TileTraitKind[] = [
    'echo',
    'sealed',
    'mirror',
    'stasis',
    'heavy',
    'volatile',
    'cursed',
    'drift',
    'conduit'
];

const INTERACTION_DESCRIPTIONS: Record<TileTraitInteractionTag, string> = {
    'echo:sealed-combo': 'Match Echo next to a different Sealed trait pair to convert the clean read into a combo shard.',
    'mirror:stasis-guard': 'Match Mirror beside Stasis to turn a risky memory tile into guard and score.',
    'sealed:heavy-score': 'Match Sealed beside Heavy to trade a stricter tile for a larger score spike.',
    'cursed:volatile-greed': 'Match Cursed beside Volatile for gold and score, accepting that misses around the same cluster hurt recall.',
    'volatile:heavy-guard': 'Match Volatile beside Heavy to turn an unstable tile into guard.',
    'drift:row-shuffle': 'Match Drift to earn a row/swap charge, letting positioning become a repeatable board tool.',
    'drift:volatile-full-shuffle': 'Match Drift beside Volatile to add a full shuffle charge on top of the row/swap charge.',
    'conduit:adjacent-score': 'Match Conduit beside any other trait to convert local board texture into score.',
    'conduit:mirror-guard': 'Match Conduit beside Mirror to add guard to the Conduit payoff.',
    'conduit:echo-peek': 'Match Conduit beside Echo to add a peek charge to the Conduit payoff.',
    'conduit:stasis-lock': 'Match Conduit beside Stasis to add score and pulse a safe next-turn trait block when the board can support it.',
    'sealed:conduit-spark': 'Match Sealed beside Conduit to turn the sealed pair into extra shard value and score.',
    'echo:mirror-focus': 'Match Echo beside Mirror to build recall focus for a stronger future clean-match memory bonus.',
    'heavy:mirror-guard': 'Match Heavy beside Mirror to turn the heavier commitment into guard and extra score.',
    'stasis:nearby-block': 'Match Stasis while another safe pair remains to block a nearby trait tile from being opened first next turn.',
    'conduit:danger-recall': 'Miss Conduit near Volatile or Cursed and the nearby danger deepens recall pressure.',
    'stasis:sealed-buffer': 'Place Stasis beside Sealed to stop the Sealed miss from draining peek or deepening recall.',
    'stasis:cursed-volatile-buffer': 'Place Stasis near a Cursed and Volatile cluster to buffer the extra recall danger on a miss.',
    'cursed:volatile-danger': 'Miss Cursed beside Volatile and the greedy cluster adds recall pressure.',
    'chapter-compass:conduit-map': 'Draft Chapter Compass to make Conduit clusters pay extra peek value and score.',
    'catalyst-thread:sealed-engine': 'Draft Catalyst Thread to make Sealed matches stronger, with capped shards converting to score.',
    'row-compass:drift-routing': 'Draft Row Compass to make Drift matches generate extra row/swap routing value.',
    'warden-sigil:mirror-ward': 'Draft Warden Sigil to make Mirror matches produce stronger guard or capped-guard score.',
    'wager-surety:cursed-buffer': 'Draft Wager Surety to soften Cursed plus Volatile miss tries while keeping recall pressure visible.',
    'reward-perk:echo-conduit-double': 'Claim Echo Conduit Lens so Echo beside Conduit doubles its peek and adjacent Sealed shard payoff.',
    'reward-perk:trait-streak-flash': 'Claim Trait Streak Lens so a trait match at x3+ clean streak creates a flash-pair charge.',
    'reward-perk:cursed-opener-greed': 'Claim Cursed Opener Contract so the first Cursed match each floor becomes a gold and score play.'
};

export const getTileTraitCodexRows = (): TileTraitCodexRow[] =>
    TRAIT_KIND_ORDER.map((kind) => {
        const copy = TILE_TRAIT_COPY[kind];
        return {
            id: `trait-${kind}`,
            title: copy.label,
            description: `Match: ${copy.match} Miss: ${copy.mismatch}`
        };
    });

export const getTileTraitInteractionCodexRows = (): TileTraitCodexRow[] =>
    (Object.keys(TILE_TRAIT_INTERACTION_TEXT) as TileTraitInteractionTag[]).map((tag) => ({
        id: `trait-interaction-${tag}`,
        title: TILE_TRAIT_INTERACTION_TEXT[tag],
        description: INTERACTION_DESCRIPTIONS[tag]
    }));
