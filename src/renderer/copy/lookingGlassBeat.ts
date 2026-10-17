/**
 * What the looking glass says when it turns.
 *
 * A sighted player watches every card cross to its reflection. A screen reader has nothing on the
 * board to lean on, so it hears that the board turned, which way, and that what was known holds.
 */
import type { LookingGlassAxis } from '../../shared/looking-glass-rules';

export const lookingGlassAnnouncement = (axis: LookingGlassAxis): string =>
    axis === 'left_right'
        ? 'The glass turned: the board is mirrored left to right. Every card you know is where its reflection was.'
        : 'The glass turned: the board is mirrored top to bottom. Every card you know is where its reflection was.';
