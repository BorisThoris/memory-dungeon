import { plural, tr } from '../../shared/i18n';
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
    name: tr.s('Colossus'),
    felledTitle: tr.s('COLOSSUS FELLED'),
    splitTitle: tr.s('THE COLOSSUS SPLITS'),
    rule: tr.s('Match its element for a hit. Any other match is a chip; two chips are a hit.'),
    ruleFixed: tr.s('Match pairs of its element. Nothing else hurts it.'),
    breakTitle: tr.s('THE COLOSSUS BREAKS'),
    felled: tr.s('Felled'),
    split: tr.s('Split'),
    next: tr.s('next'),
    chipTitle: tr.s('A chip: one more is a hit')
} as const;

/** The clock on the card. */
export const colossusClockLabel = (turnsLeft: number): string => `${plural(turnsLeft, { one: '{0} turn', other: '{0} turns' })}`;


/** The standing card's own label: everything on it, in one sentence. */
export const colossusCardLabel = (colossus: ColossusState, showing: TileSuit, next: TileSuit): string => {
    if (colossus.status === 'felled') return tr.s('Colossus: felled.');
    if (colossus.status === 'split') return colossus.form === 'fixed' ? tr.s('Colossus: it broke apart and is gone.') : tr.s('Colossus: it split and is gone.');
    if (colossus.form === 'fixed') return tr`Colossus of ${ELEMENT_NAMES[showing]}: match ${plural(colossus.hits, { one: '{0} pair', other: '{0} pairs' })} of it to fell it, ${plural(colossus.turnsLeft, { one: '{0} turn', other: '{0} turns' })} left.`;
    return tr`Colossus: showing ${ELEMENT_NAMES[showing]}, ${ELEMENT_NAMES[next]} next. ${plural(colossus.hits, { one: '{0} hit', other: '{0} hits' })} to fell it, ${plural(colossus.turnsLeft, { one: '{0} turn', other: '{0} turns' })} left.`;
};

/** One line for the turn that just happened; null when there is nothing a card does not already say. */
export const colossusBeatLine = (event: ColossusEvent, next: TileSuit | null, fixed = false): string => {
    const then = next && !fixed ? tr` It turns to ${ELEMENT_NAMES[next]}.` : '';
    if (fixed) {
        const left = tr`${plural(event.hitsLeft, { one: '{0} pair of {1}', other: '{0} pairs of {1}' }, ELEMENT_NAMES[event.element])} to go, ${plural(event.turnsLeft, { one: '{0} turn', other: '{0} turns' })} left.`;
        if (event.kind === 'split') return tr`Out of time: the Colossus breaks into ${plural(event.pairs, { one: '{0} pair of {1}', other: '{0} pairs of {1}' }, ELEMENT_NAMES[event.element])}, face down.`;
        if (event.kind === 'hit') return tr`A hit on the Colossus. ${left}`;
        if (event.kind === 'turn') return tr`No ${ELEMENT_NAMES[event.element]} for the Colossus. ${left}`;
    }
    const left = tr`${plural(event.hitsLeft, { one: '{0} hit', other: '{0} hits' })} to go, ${plural(event.turnsLeft, { one: '{0} turn', other: '{0} turns' })} left.`;
    switch (event.kind) {
        case 'felled':
            return tr.s('The Colossus falls. It pays score and gold.');
        case 'split':
            return tr`Out of time: the Colossus splits into ${plural(event.pairs, { one: '{0} new pair', other: '{0} new pairs' })}, face up until your next flip.`;
        case 'hit':
            return tr`${plural(event.hits, { one: '{0} hit', other: '{0} hits' })} on the Colossus. ${left}${then}`;
        case 'chip':
            return tr`A chip on the Colossus: one more is a hit. ${left}${then}`;
        case 'turn':
            return tr`The Colossus turns. ${left}${then}`;
    }
};

/** The stamp's second line. */
export const colossusCalloutSub = (event: ColossusEvent, fixed = false): string =>
    event.kind === 'felled'
        ? tr.s('Score and gold for every hit it took')
        : fixed
          ? tr`${plural(event.pairs, { one: '{0} pair of {1}', other: '{0} pairs of {1}' }, ELEMENT_NAMES[event.element])} dealt face down`
          : tr`${plural(event.pairs, { one: '{0} new pair', other: '{0} new pairs' })} on the board, face up until your next flip`;
