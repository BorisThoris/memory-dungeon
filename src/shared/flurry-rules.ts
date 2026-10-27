import type { RunState } from './contracts';
import { descentActForLevel } from './floor-mutator-schedule';
import { flipTile, resolveBoardTurn } from './game';
import { tilesArePairMatch } from './scoring-rules';
import { tilesMatchOnBoard } from './match-rule-rules';
import { finishMemorizePhase } from './memorize-phase-rules';
import { isTileFlipBlocked } from './realm-weather-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { pickRngIndex } from './rng';
import { isSingletonUtilityPairKey } from './tile-identity';

/**
 * **The Flurry** (rules 99, 2026-10-27): past the Gate the study is a grab.
 *
 * Every rule from 90 to 98 changed what a floor deals or what counts as a pair; none changed what the hands
 * do - every floor of every act was "study, then turn a card, turn a card". The owner's word (2026-10-27,
 * after rules 98 put a match rule on ten floors a run): still samey. From rules 99, on every plain floor
 * past the Gate the study is a Flurry: while the faces are shown and the study clock runs, tap two cards
 * of a pair and they are claimed at once, through the floor's own turn - the chain climbs, the pop
 * breaks, the elements cast. Tap two that are not a pair and the study ends there: the faces go down,
 * no miss is charged, and the floor goes on as memory. The Gate keeps its study as the teaching act; a
 * three (Triples, Sequences), a boss and a Spiral never grab, and a Flurry stops when half the floor's pairs are gone:
 * the rest is memory.
 *
 * Greed against time: every pair grabbed is one the floor no longer asks you to remember, and a wrong
 * tap throws away the rest of the study you were using to remember the others.
 */
export const FLURRY_FROM = 99;

/** Whether this floor's study is a Flurry. */
export const isFlurryFloor = (run: Pick<RunState, 'board' | 'runRulesVersion'>): boolean => {
    const board = run.board;
    const rulesVersion = run.runRulesVersion ?? 0;
    if (!board || rulesVersion < FLURRY_FROM) return false;
    if (board.floorTag === 'boss' || board.floorArchetypeId === 'spiral_hall' || (board.tripleKeys?.length ?? 0) > 0) return false;
    return descentActForLevel(board.level, rulesVersion).id !== 'gate';
};

/** Whether a press now is a Flurry grab: the study of a Flurry floor, with a pair it may still take. */
export const canFlurryGrab = (run: RunState): boolean => {
    if (run.status !== 'memorize' || !isFlurryFloor(run)) return false;
    const { left, dealt } = flurryPairs(run);
    return left > Math.max(1, Math.ceil(dealt * FLURRY_KEEPS_SHARE));
};

/** The share of a floor's pairs the Flurry leaves to memory: it grabs until half are gone, a pop's included. */
export const FLURRY_KEEPS_SHARE = 0.5;

/** The floor's pairs still face down, and all it was dealt. */
const flurryPairs = (run: RunState): { left: number; dealt: number } => {
    const left = new Set<string>();
    const dealt = new Set<string>();
    for (const tile of run.board?.tiles ?? []) {
        if (isSingletonUtilityPairKey(tile.pairKey) || tile.state === 'removed') continue;
        dealt.add(tile.pairKey);
        if (tile.state === 'hidden') left.add(tile.pairKey);
    }
    return { left: left.size, dealt: dealt.size };
};

/** The study, without the grab: what a wrong tap, or a press the Flurry cannot take, leaves. */
/** A Flurry's held card back down with the rest, still in the study: it was a look, not a turn. */
export const returnFlurryHeld = (run: RunState): RunState => {
    const board = run.board;
    if (!board || board.flippedTileIds.length === 0) return run;
    const held = new Set(board.flippedTileIds);
    const tiles = board.tiles.map((tile) => (held.has(tile.id) && tile.state === 'flipped' ? { ...tile, state: 'hidden' as const } : tile));
    return { ...run, board: { ...board, tiles, flippedTileIds: [] } };
};

const endStudy = (run: RunState): RunState => finishMemorizePhase(returnFlurryHeld(run));

/**
 * A press in a Flurry. The first card of a grab is held; the second claims the two through the floor's
 * own turn when they are a pair, and ends the study when they are not. A card the floor will not turn
 * (frozen, vined, already held) ends nothing and does nothing.
 */
export const flurryPress = (run: RunState, tileId: string): RunState => {
    if (!canFlurryGrab(run) || !run.board) return run;
    const board = run.board;
    const tile = board.tiles.find((candidate) => candidate.id === tileId);
    if (!tile || tile.state !== 'hidden' || isTileFlipBlocked(tile) || board.flippedTileIds.includes(tileId)) return run;
    const heldId = board.flippedTileIds[0];
    if (heldId == null) {
        const held = flipTile({ ...run, status: 'playing' }, tileId);
        return held.board?.flippedTileIds.includes(tileId) ? { ...held, status: 'memorize', timerState: run.timerState } : run;
    }
    const heldTile = board.tiles.find((candidate) => candidate.id === heldId);
    if (!heldTile || !tilesMatchOnBoard(board, heldTile, tile, tilesArePairMatch)) return endStudy(run);
    const resolved = resolveBoardTurn(flipTile({ ...run, status: 'playing' }, tileId));
    // A card that is other than it looked (a mask dropped, a Turncoat turned) makes the two no pair after all:
    // that is a wrong tap, and a Flurry's wrong tap never costs a miss.
    if (resolved.stats.mismatches !== run.stats.mismatches || resolved.status === 'gameOver') return endStudy(run);
    const grabbed = { ...resolved, flurryGrabsThisFloor: runNonNegativeInteger(run.flurryGrabsThisFloor) + 1, flurryGrabsThisRun: runNonNegativeInteger(run.flurryGrabsThisRun) + 1 };
    // The floor's turn has run: a grab that cleared the floor (it cannot, but a pop may) stands as it is.
    return grabbed.status === 'playing' ? { ...grabbed, status: 'memorize', timerState: run.timerState } : grabbed;
};

/** How long a player takes to find and tap one pair in a Flurry, for the sims: a grab a second and a bit. */
export const FLURRY_SIM_GRAB_MS = 1200;

/**
 * A study played the way a player plays one, for the soak, the census and the survival sims: on a Flurry
 * floor a grab for every `FLURRY_SIM_GRAB_MS` of the study, each a wrong tap at `missChance`; then the study ends.
 */
export const studyWithFlurry = (run: RunState, rng: () => number, missChance: number): RunState => {
    let current = run;
    const attempts = Math.floor(runNonNegativeInteger(run.timerState?.memorizeRemainingMs) / FLURRY_SIM_GRAB_MS);
    for (let attempt = 0; attempt < attempts && canFlurryGrab(current); attempt += 1) {
        const board = current.board!;
        const open = board.tiles.filter((tile) => tile.state === 'hidden' && !isTileFlipBlocked(tile) && !isSingletonUtilityPairKey(tile.pairKey));
        if (open.length < 2) break;
        const first = open[pickRngIndex(rng, open.length)]!;
        const pairs = (tile: (typeof open)[number]): boolean => tile.id !== first.id && tilesMatchOnBoard(board, first, tile, tilesArePairMatch);
        const second = rng() < missChance ? open.find((tile) => tile.id !== first.id && !pairs(tile)) : open.find(pairs);
        if (!second) break;
        current = flurryPress(flurryPress(current, first.id), second.id);
    }
    return finishMemorizePhase(current);
};
