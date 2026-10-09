import type { BoardState, Tile } from '../../shared/contracts';
import { getSafeBoardColumns } from '../../shared/board-grid-dimensions';
import { METEOR_IMPACT_DELAY_SECONDS, type ItemEffectKind } from './itemEffects';

/**
 * The meteor lands above the bomb (2026-10-09). Before this the cards a meteor took burst and left
 * the instant it was called, a quarter of a second before the rock came down, so the impact landed
 * on an empty patch of board. Now:
 *
 * - **They wait for it.** A struck card (`tile.meteorStruck`, the impact's key) holds until the
 *   impact, then leaves in a ripple outward from the crater, a beat per cell, each breaking up its
 *   own element's way (`cardDissolveMaterial.ts`).
 * - **They are thrown.** As it leaves, a struck card is pushed away from the crater.
 * - **Time holds at the hit.** The board's visual clock stops for a moment at an impact (hit-stop:
 *   0.1-0.15 s for a critical hit, 0.05-0.08 s for a strong one, per the research), so the meteor
 *   holds twice as long as a bomb. Visual only: the rules and input never wait on it, and the
 *   shake, a pure function of that clock (`boardTrauma.ts`), holds with it.
 */
export const METEOR_RIPPLE_SECONDS_PER_STEP = 0.05;
export const METEOR_RIPPLE_MAX_SECONDS = 0.45;
/** How far a struck card is thrown from the crater as it leaves, in board units (a card is 0.74 wide). */
export const METEOR_THROW_DISTANCE = 0.34;
/** Seconds the board's visual clock holds at an impact, by item. */
export const ITEM_HIT_STOP_SECONDS: Partial<Readonly<Record<ItemEffectKind, number>>> = {
    bomb: 0.06,
    meteor: 0.12
};

const struckBy = (board: Pick<BoardState, 'meteorImpact'>, tile: Tile): boolean =>
    tile.state === 'removed' && tile.meteorStruck != null && board.meteorImpact?.key === tile.meteorStruck;

const gridOf = (board: Pick<BoardState, 'columns' | 'tiles'>, tile: Tile): { col: number; row: number } | null => {
    const columns = getSafeBoardColumns(board);
    const index = board.tiles.findIndex((candidate) => candidate.id === tile.id);
    return index < 0 ? null : { col: index % columns, row: Math.floor(index / columns) };
};

/** Seconds a card the meteor took waits before it bursts: the fall, then a ripple out from the crater. Null for any other card. */
export const meteorDepartureDelaySec = (board: Pick<BoardState, 'columns' | 'tiles' | 'meteorImpact'>, tile: Tile): number | null => {
    if (!struckBy(board, tile)) return null;
    const columns = getSafeBoardColumns(board);
    const cell = gridOf(board, tile);
    const impact = board.meteorImpact!;
    if (!cell) return METEOR_IMPACT_DELAY_SECONDS;
    const distance = Math.hypot(cell.col - (impact.cell % columns), cell.row - Math.floor(impact.cell / columns));
    return METEOR_IMPACT_DELAY_SECONDS + Math.min(METEOR_RIPPLE_MAX_SECONDS, distance * METEOR_RIPPLE_SECONDS_PER_STEP);
};

/** Which way (board units, y up) a struck card is thrown: away from the crater. Null for any other card. */
export const meteorThrowDirection = (board: Pick<BoardState, 'columns' | 'tiles' | 'meteorImpact'>, tile: Tile): { x: number; y: number } | null => {
    if (!struckBy(board, tile)) return null;
    const columns = getSafeBoardColumns(board);
    const cell = gridOf(board, tile);
    if (!cell) return null;
    const impact = board.meteorImpact!;
    const dx = cell.col - (impact.cell % columns);
    const dy = -(cell.row - Math.floor(impact.cell / columns));
    const length = Math.hypot(dx, dy);
    // The card the rock landed on is driven down into the table rather than sideways.
    return length < 1e-6 ? { x: 0, y: 0 } : { x: dx / length, y: dy / length };
};

const thrown = new WeakMap<object, { x: number; y: number }>();

/** Take back last frame's throw, before the card's damped motion runs (the realm sway's pattern). */
export const takeBackMeteorThrow = (card: { position: { x: number; y: number } }): void => {
    const last = thrown.get(card);
    if (!last) return;
    card.position.x -= last.x;
    card.position.y -= last.y;
    thrown.delete(card);
};

/** Push a departing struck card out along its direction, fastest at the start, as the dissolve eats it. */
export const putMeteorThrow = (card: { position: { x: number; y: number } }, direction: { x: number; y: number } | null | undefined, departure: number): void => {
    if (!direction || departure <= 0) return;
    const out = METEOR_THROW_DISTANCE * (1 - (1 - departure) * (1 - departure));
    const offset = { x: direction.x * out, y: direction.y * out };
    if (offset.x === 0 && offset.y === 0) return;
    card.position.x += offset.x;
    card.position.y += offset.y;
    thrown.set(card, offset);
};

/**
 * The hit-stop clock. `hold(at, seconds)` schedules a hold at visual time `at`; `advance` moves
 * visual time on by a frame's delta, except that once it reaches a hold it spends the next
 * `seconds` of real time standing still. Holds that overlap merge into the longest.
 */
export const createHitStopClock = () => {
    let pending: { at: number; seconds: number }[] = [];
    let holding = 0;
    return {
        hold(at: number, seconds: number): void {
            if (seconds > 0) pending.push({ at, seconds });
        },
        advance(visual: number, delta: number): number {
            let next = visual;
            let left = delta;
            if (holding > 0) {
                const spent = Math.min(holding, left);
                holding -= spent;
                left -= spent;
                if (left <= 0) return next;
            }
            const due = pending.filter((stop) => stop.at <= next + left);
            if (due.length > 0) {
                const at = Math.max(next, Math.min(...due.map((stop) => stop.at)));
                pending = pending.filter((stop) => !due.includes(stop));
                left -= at - next;
                next = at;
                holding = Math.max(...due.map((stop) => stop.seconds));
                const spent = Math.min(holding, left);
                holding -= spent;
                left -= spent;
            }
            return next + Math.max(0, left);
        },
        get holding(): boolean {
            return holding > 0;
        },
        clear(): void {
            pending = [];
            holding = 0;
        }
    };
};
