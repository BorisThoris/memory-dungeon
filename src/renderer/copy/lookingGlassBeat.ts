/**
 * What the looking glass says when it turns.
 *
 * A sighted player watches every card cross to its reflection. A screen reader has nothing on the
 * board to lean on, so it hears that the board turned, which way, and that what was known holds.
 */
import { tr } from '../../shared/i18n';
import type { LookingGlassAxis } from '../../shared/looking-glass-rules';
import type { OddCardLegendEntry } from './oddCardBeat';

/**
 * The HUD's mutator chip on the looking-glass floor: the mutator and its clock, since the board
 * cannot show when it will turn. `matchesUntil` counts the turning match itself.
 */
export const lookingGlassHudTitle = (matchesUntil: number): string =>
    matchesUntil <= 1 ? tr.s('Looking glass \u00b7 turns on your next match') : tr`Looking glass \u00b7 turns in ${matchesUntil} matches`;

/**
 * The looking glass's line in the key above the board (`OddCardLegend`), where the hourglass keeps
 * its sand: the matches until the board turns, in the mark, and what it does. The HUD's mutator chip
 * sits in the closed menu, so this is where a player sees the clock.
 */
export const lookingGlassLegendEntry = (matchesUntil: number): OddCardLegendEntry => ({
    id: 'looking_glass',
    name: tr.s('Looking glass'),
    line: matchesUntil <= 1 ? tr.s('mirrors the board on your next match') : tr`mirrors the board in ${matchesUntil} matches`,
    suit: null,
    sand: matchesUntil
});

export const lookingGlassAnnouncement = (axis: LookingGlassAxis): string =>
    axis === 'left_right'
        ? tr.s('The glass turned: the board is mirrored left to right. Every card you know is where its reflection was.')
        : tr.s('The glass turned: the board is mirrored top to bottom. Every card you know is where its reflection was.');
