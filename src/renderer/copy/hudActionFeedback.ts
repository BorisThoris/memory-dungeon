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

const isNonEmptyHudSentence = (value: string): boolean => value.length > 0;

const splitHudAnnouncementSentences = (text: string): string[] =>
    text
        .replace(/\s+/g, ' ')
        .trim()
        .match(/[^.?!]+[.?!]?/g)
        ?.map((part) => part.trim())
        .filter(isNonEmptyHudSentence) ?? [];

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
    return clipped.length > 0 ? `${clipped}...` : '';
};

type HudActionFeedbackTone = 'info' | 'reward' | 'trait' | 'chain' | 'danger';

interface HudActionFeedbackProfile {
    label: string;
    tone: HudActionFeedbackTone;
}

export const getHudActionFeedbackProfile = (
    text: string,
    priority: 'info' | 'error' = 'info'
): HudActionFeedbackProfile => {
    const normalized = text.toLowerCase();
    if (priority === 'error' || /\b(life lost|contact|bit)\b/.test(normalized)) {
        return { label: 'Critical', tone: 'danger' };
    }
    if (/\bchain\s+x?\d+\s+broken\b/.test(normalized)) {
        return { label: 'Chain break', tone: 'danger' };
    }
    if (/\b(no match|broken|penalty|expired)\b/.test(normalized)) {
        return { label: 'Miss', tone: 'danger' };
    }
    if (/\bpayoff stack\b/.test(normalized)) {
        return { label: 'Payoff stack', tone: 'reward' };
    }
    if (/\bcashout hit\b/.test(normalized)) {
        return { label: 'Cashout hit', tone: 'reward' };
    }
    if (/\breward cashout\b/.test(normalized)) {
        return { label: 'Reward cashout', tone: 'reward' };
    }
    if (/\btrait combo surge\b/.test(normalized)) {
        return { label: 'Trait surge', tone: 'trait' };
    }
    if (/\b(chain times|chain started|surge hit|combo hit|surge)\b/.test(normalized)) {
        return { label: 'Chain', tone: 'chain' };
    }
    if (/\b(trait|stasis|volatile|row\/swap|shuffle charge)\b/.test(normalized)) {
        return { label: 'Trait play', tone: 'trait' };
    }
    if (/\bcashout armed\b/.test(normalized)) {
        return { label: 'Cashout armed', tone: 'reward' };
    }
    if (/\b(cashout|claimed|gained|reward|gold|shard|life restored|cache|favor)\b/.test(normalized)) {
        return { label: 'Reward burst', tone: 'reward' };
    }
    return { label: 'Action result', tone: 'info' };
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
