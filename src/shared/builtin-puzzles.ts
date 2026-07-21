/**
 * Hand-authored puzzle boards (`createPuzzleRun`). Tiles pin explicit `symbol` / `label` / `atomicVariant` — keep in sync
 * with `tile-symbol-catalog.ts` when renaming bands. Optional run systems (cursed pair init, shifting spotlight keys, …)
 * are only present when `buildBoard` / callers supply them for `fixedTiles`.
 *
 * Shipped builtins (layout-only unless the puzzle pipeline wires extra state):
 *
 * | id            | Cursed pair init | Shifting spotlight |
 * |---------------|------------------|--------------------|
 * | starter_pairs | no               | no                 |
 * | mirror_craft  | no               | no                 |
 * | glyph_cross   | no               | no                 |
 */
import type { BuiltinPuzzleDefinition, Tile } from './contracts';
import { isValidPuzzleImportTileSet } from './puzzle-import';

const t = (id: string, pairKey: string, symbol: string, atomicVariant?: number): Tile => ({
    id,
    pairKey,
    symbol,
    label: symbol,
    state: 'hidden',
    ...(atomicVariant !== undefined ? { atomicVariant } : {})
});

export const BUILTIN_PUZZLE_IDS = ['starter_pairs', 'mirror_craft', 'glyph_cross'] as const;
export type BuiltinPuzzleId = (typeof BUILTIN_PUZZLE_IDS)[number];
const BUILTIN_PUZZLE_ID_SET: ReadonlySet<string> = new Set(BUILTIN_PUZZLE_IDS);

export const BUILTIN_PUZZLES: Record<BuiltinPuzzleId, BuiltinPuzzleDefinition> = {
    starter_pairs: {
        id: 'starter_pairs',
        title: 'Starter 2×2',
        packId: 'tutorial',
        author: 'Memory Dungeon',
        version: 1,
        difficulty: 'starter',
        tags: ['tutorial', 'tiny'],
        goal: 'clear_all',
        goalText: 'Clear both pairs. Learn the puzzle format without mutators.',
        tiles: [t('s1a', 'p0', 'A'), t('s1b', 'p0', 'A'), t('s2a', 'p1', 'B'), t('s2b', 'p1', 'B')]
    },
    mirror_craft: {
        id: 'mirror_craft',
        title: 'Mirror craft 3×2',
        packId: 'beginner',
        author: 'Memory Dungeon',
        version: 1,
        difficulty: 'standard',
        tags: ['mirror', 'symbols'],
        goal: 'clear_all',
        goalText: 'Clear three mirrored glyph pairs with no procedural pressure.',
        tiles: [
            t('m1a', 'mk0', 'α', 0),
            t('m1b', 'mk0', 'α', 0),
            t('m2a', 'mk1', 'β', 1),
            t('m2b', 'mk1', 'β', 1),
            t('m3a', 'mk2', 'γ', 2),
            t('m3b', 'mk2', 'γ', 2)
        ]
    },
    glyph_cross: {
        id: 'glyph_cross',
        title: 'Glyph Cross 4×2',
        packId: 'challenge',
        author: 'Memory Dungeon',
        version: 1,
        difficulty: 'advanced',
        tags: ['challenge', 'glyphs', 'pattern'],
        goal: 'perfect_clear',
        goalText: 'Clear four glyph pairs with zero mistakes.',
        tiles: [
            t('g1a', 'gk0', 'AL', 0),
            t('g1b', 'gk0', 'AL', 0),
            t('g2a', 'gk1', 'BR', 1),
            t('g2b', 'gk1', 'BR', 1),
            t('g3a', 'gk2', 'CR', 2),
            t('g3b', 'gk2', 'CR', 2),
            t('g4a', 'gk3', 'DK', 3),
            t('g4b', 'gk3', 'DK', 3)
        ]
    }
};

for (const id of BUILTIN_PUZZLE_IDS) {
    const puzzle = BUILTIN_PUZZLES[id];
    if (!isValidPuzzleImportTileSet(puzzle.tiles)) {
        throw new Error(`BUILTIN_PUZZLES["${id}"] tiles violate puzzle-import rules`);
    }
}

export const listBuiltinPuzzleIds = (): string[] => [...BUILTIN_PUZZLE_IDS];

export const getBuiltinPuzzle = (id: string): BuiltinPuzzleDefinition | undefined =>
    BUILTIN_PUZZLE_ID_SET.has(id) ? BUILTIN_PUZZLES[id as BuiltinPuzzleId] : undefined;
