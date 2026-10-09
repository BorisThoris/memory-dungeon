import type { ColossusEvent, ColossusState, TileSuit } from '../../shared/contracts';
import { ELEMENT_NAMES } from '../../shared/element-alchemy-rules';

/**
 * What the Colossus says (`colossus-rules.ts`).
 *
 * The card shows the fight: its element, the hits and the clock (and, on a rules-62 Colossus, the
 * order it turns through). These are the words for what a glance at it cannot give, and for a
 * screen reader that has no card to glance at: what the last turn did to it. A rules-63 Colossus
 * is 'fixed' - one element, no chips, and it breaks into face-down pairs - and says so.
 */
export const COLOSSUS_COPY = {
    name: 'Colossus',
    felledTitle: 'COLOSSUS FELLED',
    splitTitle: 'THE COLOSSUS SPLITS',
    rule: 'Match its element for a hit. Any other match is a chip; two chips are a hit.',
    ruleFixed: 'Match pairs of its element. Nothing else hurts it.',
    breakTitle: 'THE COLOSSUS BREAKS',
    felled: 'Felled',
    split: 'Split',
    next: 'next',
    chipTitle: 'A chip: one more is a hit'
} as const;

/** The clock on the card. */
export const colossusClockLabel = (turnsLeft: number): string => `${turnsLeft} ${turnsLeft === 1 ? 'turn' : 'turns'}`;

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** The standing card's own label: everything on it, in one sentence. */
export const colossusCardLabel = (colossus: ColossusState, showing: TileSuit, next: TileSuit): string => {
    if (colossus.status === 'felled') return 'Colossus: felled.';
    if (colossus.status === 'split') return colossus.form === 'fixed' ? 'Colossus: it broke apart and is gone.' : 'Colossus: it split and is gone.';
    if (colossus.form === 'fixed') return `Colossus of ${ELEMENT_NAMES[showing]}: match ${plural(colossus.hits, 'pair', 'pairs')} of it to fell it, ${plural(colossus.turnsLeft, 'turn', 'turns')} left.`;
    return `Colossus: showing ${ELEMENT_NAMES[showing]}, ${ELEMENT_NAMES[next]} next. ${plural(colossus.hits, 'hit', 'hits')} to fell it, ${plural(colossus.turnsLeft, 'turn', 'turns')} left.`;
};

/** One line for the turn that just happened; null when there is nothing a card does not already say. */
export const colossusBeatLine = (event: ColossusEvent, next: TileSuit | null, fixed = false): string => {
    const then = next && !fixed ? ` It turns to ${ELEMENT_NAMES[next]}.` : '';
    if (fixed) {
        const left = `${plural(event.hitsLeft, `pair of ${ELEMENT_NAMES[event.element]}`, `pairs of ${ELEMENT_NAMES[event.element]}`)} to go, ${plural(event.turnsLeft, 'turn', 'turns')} left.`;
        if (event.kind === 'split') return `Out of time: the Colossus breaks into ${plural(event.pairs, `pair of ${ELEMENT_NAMES[event.element]}`, `pairs of ${ELEMENT_NAMES[event.element]}`)}, face down.`;
        if (event.kind === 'hit') return `A hit on the Colossus. ${left}`;
        if (event.kind === 'turn') return `No ${ELEMENT_NAMES[event.element]} for the Colossus. ${left}`;
    }
    const left = `${plural(event.hitsLeft, 'hit', 'hits')} to go, ${plural(event.turnsLeft, 'turn', 'turns')} left.`;
    switch (event.kind) {
        case 'felled':
            return 'The Colossus falls. It pays score and gold.';
        case 'split':
            return `Out of time: the Colossus splits into ${plural(event.pairs, 'new pair', 'new pairs')}, face up until your next flip.`;
        case 'hit':
            return `${plural(event.hits, 'hit', 'hits')} on the Colossus. ${left}${then}`;
        case 'chip':
            return `A chip on the Colossus: one more is a hit. ${left}${then}`;
        case 'turn':
            return `The Colossus turns. ${left}${then}`;
    }
};

/** The stamp's second line. */
export const colossusCalloutSub = (event: ColossusEvent, fixed = false): string =>
    event.kind === 'felled'
        ? 'Score and gold for every hit it took'
        : fixed
          ? `${plural(event.pairs, `pair of ${ELEMENT_NAMES[event.element]}`, `pairs of ${ELEMENT_NAMES[event.element]}`)} dealt face down`
          : `${plural(event.pairs, 'new pair', 'new pairs')} on the board, face up until your next flip`;
