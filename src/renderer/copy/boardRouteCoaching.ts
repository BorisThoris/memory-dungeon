import { tr } from '../../shared/i18n';
/**
 * Board-side coaching for trait routes: what the highlighted cards are asking the player to do.
 *
 * Lifted out of `TileBoard.tsx` so every player-facing sentence lives with the rest of the copy
 * rather than beside the mesh that draws it. That is the half of localization worth doing before
 * anyone picks languages — a translator can work from these files, and `scripts/copy-locality.ts`
 * keeps components from quietly growing new prose.
 */

export const BOARD_ROUTE_COACHING = {
    followUp: tr.s('Match the marked follow-up to resolve the trait route.'),
    payoff: tr.s('Two-beat payoff route is primed'),
    pickups: tr.s('Clear pickup-marked pairs before the floor ends.'),
    routeTools: tr.s('Use row/swap tools to connect the marked route cards.'),
    stacked: tr.s('Four-beat stacked route is primed'),
    traitCard: tr.s('Match a highlighted trait card to cash the route.')
} as const;
