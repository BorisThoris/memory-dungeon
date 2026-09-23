import type { FindableKind, TileTraitKind } from '../../shared/contracts';
import { getFindableKindLabel, getFindableRewardCopy } from '../../shared/findables';
import { TILE_TRAIT_COUNT_KINDS } from '../../shared/session-stats-rules';
import { TILE_TRAIT_COPY } from '../../shared/tile-trait-rules';

export const getFindableAnnouncementText = (kind: FindableKind): string =>
    `${getFindableKindLabel(kind)} claimed: ${getFindableRewardCopy(kind)}.`;

export const getFindableToastText = (kind: FindableKind): string =>
    `${getFindableKindLabel(kind)} ${getFindableRewardCopy(kind)}`;

const isNonEmptyHudSentence = (value: string): boolean => value.length > 0;

/* A sentence ends at a stop followed by a space, so `Ripple ×1.75` stays one sentence. */
const splitHudAnnouncementSentences = (text: string): string[] =>
    text
        .replace(/\s+/g, ' ')
        .trim()
        .split(/(?<=[.?!])\s+/)
        .map((part) => part.trim())
        .filter(isNonEmptyHudSentence);

/**
 * The counters every match repeats. The line under the board has room for two sentences, and
 * these always come first, because the queue files the per-match counters ahead of the turn's
 * news: the floor's last match read "Match resolved. 6/6 pairs cleared. +6 more updates." while
 * "Clean reached: x3" and "Chain 3, Sharp break" were the six. They yield their places to news.
 */
const ROUTINE_HUD_SENTENCE = /^(?:Match resolved\.|\d+\/\d+ pairs cleared\.|Recall focus \d+\/\d+)/;

/** Two glints on one turn were two identical sentences side by side; say it once, counted. */
const collapseRepeatedSentences = (sentences: readonly string[]): string[] => {
    const counts = new Map<string, number>();
    for (const sentence of sentences) {
        counts.set(sentence, (counts.get(sentence) ?? 0) + 1);
    }
    return [...counts].map(([sentence, count]) =>
        count > 1 ? `${sentence.replace(/[.?!]$/, '')} (×${count}).` : sentence
    );
};

/**
 * The visual line only; the live region always gets the whole announcement. A shortened line
 * keeps the turn's news over its routine counters and says nothing about what it left out - a
 * "+N more updates" tail pointed at a log the player has no way to open.
 */
export const formatHudActionFeedbackText = (
    text: string,
    { maxChars = 132, maxSentences = 2 }: { maxChars?: number; maxSentences?: number } = {}
): string => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxChars) {
        return normalized;
    }

    const sentences = collapseRepeatedSentences(splitHudAnnouncementSentences(normalized));
    if (sentences.length > 1) {
        const byWeight = [
            ...sentences.filter((sentence) => !ROUTINE_HUD_SENTENCE.test(sentence)),
            ...sentences.filter((sentence) => ROUTINE_HUD_SENTENCE.test(sentence))
        ];
        const selected = new Set<string>();
        let length = 0;
        for (const sentence of byWeight) {
            if (selected.size >= maxSentences) {
                break;
            }
            const nextLength = length + (selected.size > 0 ? 1 : 0) + sentence.length;
            if (nextLength > maxChars && selected.size > 0) {
                continue;
            }
            selected.add(sentence);
            length = nextLength;
        }
        const kept = sentences.filter((sentence) => selected.has(sentence)).join(' ');
        if (kept.length <= maxChars) {
            return kept;
        }
        return formatHudActionFeedbackText(kept, { maxChars, maxSentences: 1 });
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
    if (priority === 'error' || /\b(contact|bit)\b/.test(normalized)) {
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
    if (/\b(chain times|(?:clean|sharp|fever) reached|surge)\b/.test(normalized)) {
        return { label: 'Chain', tone: 'chain' };
    }
    if (/\b(trait|stasis|row\/swap|shuffle charge)\b/.test(normalized)) {
        return { label: 'Trait play', tone: 'trait' };
    }
    if (/\b(cashout|claimed|gained|reward|gold|cache|favor)\b/.test(normalized)) {
        return { label: 'Reward burst', tone: 'reward' };
    }
    return { label: 'Action result', tone: 'info' };
};

export const countTileTraitTotal = (counts: Partial<Record<TileTraitKind, number>> | undefined): number =>
    TILE_TRAIT_COUNT_KINDS.reduce((sum, kind) => sum + (counts?.[kind] ?? 0), 0);

/**
 * Labels for the trait kinds a turn actually involved. Takes the kinds the core
 * reported on the event rather than diffing two count maps across renders.
 */
export const tileTraitKindLabels = (kinds: readonly string[]): string[] =>
    TILE_TRAIT_COUNT_KINDS.filter((kind) => kinds.includes(kind)).map((kind) => TILE_TRAIT_COPY[kind].label);

export const joinReadableList = (items: readonly string[]): string =>
    items.length <= 1 ? items[0] ?? '' : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

export const pluralize = (count: number, singular: string, plural = `${singular}s`): string =>
    `${count} ${count === 1 ? singular : plural}`;

