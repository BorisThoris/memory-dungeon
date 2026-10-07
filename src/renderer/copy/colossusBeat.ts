import type { ColossusEvent, ColossusState, TileSuit } from '../../shared/contracts';
import { ELEMENT_NAMES } from '../../shared/element-alchemy-rules';

/**
 * What the Colossus says (`colossus-rules.ts`).
 *
 * The card shows the fight: its element, the order, the hits and the clock. These are the words
 * for what a glance at it cannot give, and for a screen reader that has no card to glance at:
 * what the last turn did to it, and what it will show next.
 */
export const COLOSSUS_COPY = {
    name: 'Colossus',
    felledTitle: 'COLOSSUS FELLED',
    splitTitle: 'THE COLOSSUS SPLITS',
    rule: 'Match its element for a hit. Any other match is a chip; two chips are a hit.',
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
    if (colossus.status === 'split') return 'Colossus: it split and is gone.';
    return `Colossus: showing ${ELEMENT_NAMES[showing]}, ${ELEMENT_NAMES[next]} next. ${plural(colossus.hits, 'hit', 'hits')} to fell it, ${plural(colossus.turnsLeft, 'turn', 'turns')} left.`;
};

/** One line for the turn that just happened; null when there is nothing a card does not already say. */
export const colossusBeatLine = (event: ColossusEvent, next: TileSuit | null): string => {
    const then = next ? ` It turns to ${ELEMENT_NAMES[next]}.` : '';
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
export const colossusCalloutSub = (event: ColossusEvent): string =>
    event.kind === 'felled' ? 'Score and gold for every hit it took' : `${plural(event.pairs, 'new pair', 'new pairs')} on the board, face up until your next flip`;
