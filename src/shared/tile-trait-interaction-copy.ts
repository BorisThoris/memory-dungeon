export const TILE_TRAIT_INTERACTION_TEXT = {
    'echo:sealed-combo': 'Echo + Sealed: combo shard',
    'mirror:stasis-guard': 'Mirror + Stasis: guard ward',
    'sealed:heavy-score': 'Sealed + Heavy: score surge',
    'cursed:volatile-greed': 'Cursed + Volatile: risky greed',
    'volatile:heavy-guard': 'Volatile + Heavy: guard spark',
    'drift:row-shuffle': 'Drift: row/swap charge',
    'drift:volatile-full-shuffle': 'Drift + Volatile: full shuffle',
    'conduit:adjacent-score': 'Conduit: adjacent trait charge',
    'conduit:mirror-guard': 'Conduit + Mirror: guard spark',
    'conduit:echo-peek': 'Conduit + Echo: peek spark',
    'conduit:stasis-lock': 'Conduit + Stasis: lock pulse',
    'sealed:conduit-spark': 'Sealed + Conduit: shard spark',
    'echo:mirror-focus': 'Echo + Mirror: recall focus',
    'heavy:mirror-guard': 'Heavy + Mirror: braced guard',
    'stasis:nearby-block': 'Stasis: nearby trait blocked',
    'conduit:danger-recall': 'Conduit near danger: recall pressure',
    'stasis:sealed-buffer': 'Stasis buffered Sealed',
    'stasis:cursed-volatile-buffer': 'Stasis buffered Cursed + Volatile',
    'cursed:volatile-danger': 'Cursed + Volatile: recall pressure',
    'chapter-compass:conduit-map': 'Chapter Compass + Conduit: mapped charge',
    'catalyst-thread:sealed-engine': 'Catalyst Thread + Sealed: shard engine',
    'row-compass:drift-routing': 'Row Compass + Drift: extra route charge',
    'warden-sigil:mirror-ward': 'Warden Sigil + Mirror: warded reflection',
    'wager-surety:cursed-buffer': 'Wager Surety buffered cursed risk',
    'reward-perk:echo-conduit-double': 'Echo Conduit Lens: doubled Echo',
    'reward-perk:trait-streak-flash': 'Trait Streak Lens: flash pair',
    'reward-perk:cursed-opener-greed': 'Cursed Opener: first-pair greed'
} as const;

export type TileTraitInteractionTag = keyof typeof TILE_TRAIT_INTERACTION_TEXT;

export const TILE_TRAIT_INTERACTION_TAGS = Object.keys(TILE_TRAIT_INTERACTION_TEXT) as TileTraitInteractionTag[];

export const formatTileTraitInteractionTags = (tags: readonly string[]): string[] => {
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const tag of tags) {
        const line =
            tag in TILE_TRAIT_INTERACTION_TEXT
                ? TILE_TRAIT_INTERACTION_TEXT[tag as TileTraitInteractionTag]
                : undefined;
        if (!line || seen.has(line)) {
            continue;
        }
        seen.add(line);
        lines.push(line);
    }
    return lines;
};
