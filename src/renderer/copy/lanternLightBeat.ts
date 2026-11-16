import { tr } from '../../shared/i18n';
/**
 * What the lantern says when it lights.
 *
 * A sighted player needs no words: the faces turn up beside the pair. A screen reader has nothing
 * on the board to lean on, so it hears how many cards are lit and that they go dark on the next flip.
 */
const COUNT_WORDS = ['one', 'two', 'three'] as const;

export const lanternLitAnnouncement = (count: number): string => {
    const n = Math.max(1, Math.floor(count));
    const word = COUNT_WORDS[n - 1] ?? String(n);
    return tr`The lantern lit ${word} ${n === 1 ? tr.s('card') : tr.s('cards')} beside the pair, until you turn the next one.`;
};
