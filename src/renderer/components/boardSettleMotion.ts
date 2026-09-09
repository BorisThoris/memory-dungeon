import type { BoardState } from '../../shared/contracts';
import { tileIsSettleLive } from '../../shared/board-settle-rules';

/**
 * What the board looks like to the settle: which cell each card in play is standing in.
 *
 * The settle repacks the tile array after a match, so a card's cell - and therefore its position
 * on screen - can change without the card itself changing at all. Nothing else about the board
 * says that happened: the ids are the same, the states of the survivors are the same, and only the
 * order is different. This signature is that order, so a change in it is exactly the signal that
 * the cards need to be glided to their new cells rather than appearing in them.
 *
 * Cleared cards read as empty cells, because a card bursting is not a card moving; the departure
 * animation already covers that and arming the glide for it would smear the whole board on every
 * match.
 */
export const getBoardSettleSignature = (board: Pick<BoardState, 'tiles'>): string =>
    board.tiles.map((tile) => (tileIsSettleLive(tile) ? tile.id : '')).join('|');
