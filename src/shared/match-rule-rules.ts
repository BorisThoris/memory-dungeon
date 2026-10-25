import type { BoardState, FloorTag, Tile, TileSuit } from './contracts';
import { descentActForLevel, actLevelsFor, pickFloorScheduleEntry } from './floor-mutator-schedule';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { isSingletonUtilityPairKey } from './tile-identity';

/**
 * Match rules (rules 94, 2026-10-25): some floors change what makes a pair.
 *
 * The owner, after rules 89-93: "we get more powerups but the core mechanic stays the same without any
 * changes, so it feels like it's the same". Every addition so far sat on top of the one core turn - two
 * cards, same picture, gone. A match rule is a room property instead: on its floor the core turn itself
 * reads differently, told on the board crown before the first flip. Each act of a run has one such floor
 * (the Gate's on floor 4 or 5, every other act's on one of its plain floors), drawn from the run's seed,
 * so a run meets a changed core inside the floors real players reach.
 *
 * The first rule is **Opposites**: every pair is one picture in two opposite elements - ember with tide,
 * moss with bone. One card of each pair shows its opposite on its back and its face; the card is its true
 * element to everything it does (what it casts, what it pops, how it reacts), as a mask is. On every other
 * floor a back's colour says "your partner wears this colour too"; here it says "your partner wears the
 * other one". The deduction a player has built over the run turns over.
 */
export const MATCH_RULES_FROM = 94;

export type MatchRuleId = 'opposites';
export const MATCH_RULES: readonly MatchRuleId[] = ['opposites'];

export const OPPOSITE_SUIT: Readonly<Record<TileSuit, TileSuit>> = { ember: 'tide', tide: 'ember', moss: 'bone', bone: 'moss' };

/** The first Gate floor a match rule may take: after the three authored floors. */
export const MATCH_RULE_GATE_FLOORS: readonly number[] = [4, 5];

/** Which plain floor of its act a run's match rule takes: one per act, from the run's seed. */
export const matchRuleFloorFor = (runSeed: number, rulesVersion: number, level: number): number | null => {
    if (rulesVersion < MATCH_RULES_FROM) return null;
    const act = descentActForLevel(level, rulesVersion);
    const { firstLevel, lastLevel } = actLevelsFor(act, rulesVersion);
    // The Gate's from its fourth floor; every other act's from its second, short of its boss.
    const span = act.id === 'gate' ? [...MATCH_RULE_GATE_FLOORS] : Array.from({ length: Math.max(0, lastLevel - firstLevel - 1) }, (_, i) => firstLevel + 1 + i);
    // Only a plain floor: a boss, a breather or a Spiral keeps its own rules.
    const candidates = span.filter((floor) => {
        const entry = pickFloorScheduleEntry(runSeed, rulesVersion, floor, 'endless');
        return entry.floorTag === 'normal' && entry.floorArchetypeId !== 'spiral_hall';
    });
    if (candidates.length === 0) return null;
    return candidates[pickRngIndex(createMulberry32(hashStringToSeed(`matchRuleFloor:${runSeed}:${act.id}`)), candidates.length)]!;
};

/** The match rule a floor is dealt with, if any: never a boss floor, a breather or past the Descent. */
export const matchRuleFor = (runSeed: number, rulesVersion: number, level: number, floorTag: FloorTag | null | undefined, descentLength: number): MatchRuleId | null => {
    if (rulesVersion < MATCH_RULES_FROM || level > descentLength || floorTag === 'boss' || floorTag === 'breather') return null;
    if (matchRuleFloorFor(runSeed, rulesVersion, level) !== level) return null;
    return MATCH_RULES[pickRngIndex(createMulberry32(hashStringToSeed(`matchRule:${runSeed}:${level}`)), MATCH_RULES.length)]!;
};

const isOppositeCandidate = (tile: Tile): tile is Tile & { suit: TileSuit } =>
    tile.suit != null && !isSingletonUtilityPairKey(tile.pairKey) && tile.mask == null && tile.turncoat == null && tile.shownSuit == null;

/** Deals Opposites: one card of every two-card pair, chosen from the seed, shows its opposite element. */
export const dealOpposites = (board: BoardState, runSeed: number): BoardState => {
    const rng = createMulberry32(hashStringToSeed(`opposites:${runSeed}:${board.level}`));
    const halves = new Map<string, number[]>();
    board.tiles.forEach((tile, index) => {
        if (isOppositeCandidate(tile)) halves.set(tile.pairKey, [...(halves.get(tile.pairKey) ?? []), index]);
    });
    const tiles = [...board.tiles];
    let dealt = 0;
    for (const indices of halves.values()) {
        if (indices.length !== 2) continue;
        const index = indices[pickRngIndex(rng, 2)]!;
        const tile = tiles[index]!;
        tiles[index] = { ...tile, shownSuit: OPPOSITE_SUIT[tile.suit!] };
        dealt += 1;
    }
    return dealt === 0 ? board : { ...board, tiles, matchRule: 'opposites' };
};

/** Deals a floor's match rule onto its board. */
export const dealMatchRule = (board: BoardState, rule: MatchRuleId | null, runSeed: number): BoardState =>
    rule === 'opposites' ? dealOpposites(board, runSeed) : board;
