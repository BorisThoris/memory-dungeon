/**
 * What skittish cards say when they flinch.
 *
 * The flinch happens the moment the missed cards turn back, which is exactly when the player's eyes
 * are leaving them - so it is always announced, and it says the one thing that makes it fair: the
 * cards went one step, not anywhere.
 */
export const SKITTISH_FLINCH_ANNOUNCEMENT = 'The cards you missed flinched: each moved one step to a neighbouring card.';

/** The miss floater's reason line when the cards flinched: what happened and where to look, in the space the floater has. */
export const SKITTISH_FLOATER_REASON = 'They flinched one step - look beside them.';
