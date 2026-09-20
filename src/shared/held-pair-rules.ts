import { getSafeBoardColumns } from './board-grid-dimensions';
import type { RunState } from './contracts';
import { runStringArray } from './run-array-guards';

/**
 * The held pair: the decision behind thesis §30.3(c) and T3.4, made here rather than deferred again.
 *
 * §30.3(c) asks for a marker that lets a player claim a pair they intend to save, so that holding a
 * chain becomes a nameable strategy. Gen 188 found the collision: the game already ships a memory
 * marker, the **pin** - up to `MAX_PINNED_TILES` hidden tiles, toggled from the dock, changing no
 * rules, capped by a contract vow. That is the job description almost word for word, except a pin
 * marks a TILE and the hold decision's unit is a PAIR. The thesis offers three ways out and
 * recommends the first: extend the pin into a pair link, one new verb on an existing control.
 *
 * **This takes that recommendation and removes the verb.** Two pins ARE the claim. A player who
 * pins two tiles has already made the two-tile gesture §30.3 says the claim has to be, and adding a
 * "link these" press on top would be a second way to say the same thing - the duplication §105 was
 * written to remove. So: exactly two pins is a held pair, a third pin dissolves it back into three
 * loose notes, and nothing new appears on the dock. The cap of one held pair falls out of the pin
 * cap rather than being declared, and the choice between "hold a pair" and "keep three notes" is
 * the commitment §30.3(c) asks for instead of a notebook.
 *
 * **The cost, because it is real:** a player who pins two unrelated tiles as loose notes is told the
 * span between them whether they meant a claim or not. That is the price of not adding a control,
 * and the reading is inert - a distance between two tiles they chose, which they already know the
 * positions of.
 *
 * Two constraints from §30.3, and both are structural here rather than remembered:
 *
 * - **It never validates.** Nothing in this file reads `pairKey`, `symbol` or any tile identity: a
 *   held pair is two positions the player claims, and whether they match is found out by flipping,
 *   as now. A mark that told you would be a free match test - no turn, no mismatch, strictly better
 *   than playing - and `held-pair-rules.test.ts` holds it by giving the same two positions a
 *   matching and a non-matching identity and asserting the output is identical.
 * - **The span (T3.6) rides on the claim and only on it.** A pair's span is a fact about the hidden
 *   layout, so on an unmarked tile it would hand back part of the memory game (the finding at G.3).
 *   On a claimed pair it is safe by construction: it restates the distance between two tiles the
 *   player picked, and if the claim is wrong it is the span of the pair they think they have -
 *   which is what they are deciding about.
 *
 * **What this does not settle:** whether the marker becomes a crutch that does the remembering
 * (thesis E.6). That needs players. A simulation cannot answer it, because the reference player has
 * no memory to aid.
 */

/** A claim is two tiles. Three is a notebook, one is a note. */
export const HELD_PAIR_PIN_COUNT = 2;

/** The two tiles the player is claiming as a pair, or null when they are not claiming one. */
export const getHeldPairTileIds = (run: Pick<RunState, 'board' | 'pinnedTileIds'>): [string, string] | null => {
    const board = run.board;
    if (!board) {
        return null;
    }
    const pinned = runStringArray(run.pinnedTileIds).filter((id) =>
        board.tiles.some((tile) => tile.id === id && tile.state === 'hidden')
    );
    if (pinned.length !== HELD_PAIR_PIN_COUNT) {
        return null;
    }
    const [first, second] = pinned;
    return first != null && second != null && first !== second ? [first, second] : null;
};

/**
 * How far apart the claimed pair sits, in grid steps. Manhattan rather than straight-line, because
 * the board is a grid and the pop walks it in steps - the distance that matters is the one the
 * break travels, not the one a ruler measures.
 */
export const getHeldPairSpan = (run: Pick<RunState, 'board' | 'pinnedTileIds'>): number | null => {
    const held = getHeldPairTileIds(run);
    const board = run.board;
    if (!held || !board) {
        return null;
    }
    const columns = getSafeBoardColumns(board);
    const indexOf = (id: string): number => board.tiles.findIndex((tile) => tile.id === id);
    const a = indexOf(held[0]);
    const b = indexOf(held[1]);
    if (a < 0 || b < 0) {
        return null;
    }
    return Math.abs(Math.floor(a / columns) - Math.floor(b / columns)) + Math.abs((a % columns) - (b % columns));
};

/** What the dock says about the pin, which is the only place the claim is named. */
export const describeHeldPair = (run: Pick<RunState, 'board' | 'pinnedTileIds'>, maxPins: number): string => {
    const span = getHeldPairSpan(run);
    if (span == null) {
        return `Pin up to ${maxPins} tiles`;
    }
    return `Holding a pair, ${span} ${span === 1 ? 'step' : 'steps'} apart. A third pin lets it go.`;
};
