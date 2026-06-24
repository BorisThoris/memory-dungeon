import type { FindableKind, Tile, TileTraitKind } from '../../shared/contracts';
import { getFindableKindLabel, getFindableRewardCopy } from '../../shared/findables';
import { TILE_TRAIT_COUNT_KINDS } from '../../shared/session-stats-rules';
import { TILE_TRAIT_COPY } from '../../shared/tile-trait-rules';

export const GAUNTLET_WARN_SECS = [60, 30, 10, 5] as const;

export const gauntletMessageForThreshold = (secs: number): string => {
    if (secs <= 5) {
        return 'Gauntlet: five seconds or less remaining.';
    }
    if (secs <= 10) {
        return 'Gauntlet: ten seconds or less remaining.';
    }
    if (secs <= 30) {
        return 'Gauntlet: thirty seconds or less remaining.';
    }
    return 'Gauntlet: one minute or less remaining.';
};

export const detectClaimedFindableKind = (
    previousTiles: readonly Tile[],
    nextTiles: readonly Tile[]
): FindableKind | null => {
    const previousKinds = new Map<string, FindableKind>();
    for (const tile of previousTiles) {
        if (tile.findableKind != null) {
            previousKinds.set(tile.pairKey, tile.findableKind);
        }
    }
    for (const [pairKey, kind] of previousKinds) {
        const nextPairTiles = nextTiles.filter((tile) => tile.pairKey === pairKey);
        if (
            nextPairTiles.length > 0 &&
            nextPairTiles.every(
                (tile) =>
                    (tile.state === 'matched' || tile.state === 'removed') &&
                    tile.findableKind == null
            )
        ) {
            return kind;
        }
    }
    return null;
};

export const getFindableAnnouncementText = (kind: FindableKind): string =>
    `${getFindableKindLabel(kind)} claimed: ${getFindableRewardCopy(kind)}.`;

export const getFindableToastText = (kind: FindableKind): string =>
    `${getFindableKindLabel(kind)} ${getFindableRewardCopy(kind)}`;

const splitHudAnnouncementSentences = (text: string): string[] =>
    text
        .replace(/\s+/g, ' ')
        .trim()
        .match(/[^.?!]+[.?!]?/g)
        ?.map((part) => part.trim())
        .filter(Boolean) ?? [];

export const formatHudActionFeedbackText = (
    text: string,
    { maxChars = 132, maxSentences = 2 }: { maxChars?: number; maxSentences?: number } = {}
): string => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxChars) {
        return normalized;
    }

    const sentences = splitHudAnnouncementSentences(normalized);
    if (sentences.length > 1) {
        const selected: string[] = [];
        for (const sentence of sentences) {
            if (selected.length >= maxSentences) {
                break;
            }
            const next = [...selected, sentence].join(' ');
            if (next.length > maxChars && selected.length > 0) {
                break;
            }
            selected.push(sentence);
        }
        const remaining = Math.max(0, sentences.length - selected.length);
        const summary = selected.join(' ');
        return remaining > 0 ? `${summary} +${remaining} more updates.` : summary;
    }

    const clipped = normalized.slice(0, maxChars - 3).replace(/\s+\S*$/, '').trim();
    return `${clipped}...`;
};

export const countTileTraitTotal = (counts: Partial<Record<TileTraitKind, number>> | undefined): number =>
    TILE_TRAIT_COUNT_KINDS.reduce((sum, kind) => sum + (counts?.[kind] ?? 0), 0);

export const changedTileTraitLabels = (
    previous: Partial<Record<TileTraitKind, number>> | undefined,
    next: Partial<Record<TileTraitKind, number>> | undefined
): string[] =>
    TILE_TRAIT_COUNT_KINDS.filter((kind) => (next?.[kind] ?? 0) > (previous?.[kind] ?? 0)).map(
        (kind) => TILE_TRAIT_COPY[kind].label
    );

export const joinReadableList = (items: readonly string[]): string =>
    items.length <= 1 ? items[0] ?? '' : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

export const pluralize = (count: number, singular: string, plural = `${singular}s`): string =>
    `${count} ${count === 1 ? singular : plural}`;

export const resourceDeltaCopy = (
    delta: number,
    displayLabel: string,
    countedLabel: string,
    verb: 'gained' | 'spent',
    countedPlural = `${countedLabel}s`
): string => {
    const amount = Math.abs(delta);
    return amount === 1 ? `${displayLabel} ${verb}` : `${pluralize(amount, countedLabel, countedPlural)} ${verb}`;
};
