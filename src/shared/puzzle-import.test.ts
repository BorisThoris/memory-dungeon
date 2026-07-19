import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BUILTIN_PUZZLES } from './builtin-puzzles';
import type { Tile } from './contracts';
import { createDefaultSaveData } from './save-data';
import { getPuzzleLibraryRows, getPuzzlePackProgressRows, isValidPuzzleImportTileSet, validatePuzzleImportPayload } from './puzzle-import';

const minimalValidTiles = [
    { id: 'a1', pairKey: 'p1', symbol: 'A', label: 'a', state: 'hidden' as const },
    { id: 'a2', pairKey: 'p1', symbol: 'A', label: 'a', state: 'hidden' as const },
    { id: 'b1', pairKey: 'p2', symbol: 'B', label: 'b', state: 'hidden' as const },
    { id: 'b2', pairKey: 'p2', symbol: 'B', label: 'b', state: 'hidden' as const }
];

describe('isValidPuzzleImportTileSet', () => {
    it('accepts a minimal valid tile set', () => {
        expect(isValidPuzzleImportTileSet([...minimalValidTiles])).toBe(true);
    });

    it('rejects invalid pair counts', () => {
        const tiles = [
            { id: 'a1', pairKey: 'p1', symbol: 'A', label: 'a', state: 'hidden' as const },
            { id: 'a2', pairKey: 'p1', symbol: 'A', label: 'a', state: 'hidden' as const },
            { id: 'b1', pairKey: 'p2', symbol: 'B', label: 'b', state: 'hidden' as const },
            { id: 'b2', pairKey: 'p3', symbol: 'C', label: 'c', state: 'hidden' as const }
        ];
        expect(isValidPuzzleImportTileSet(tiles)).toBe(false);
    });

    it.each([
        ['duplicate', 'a1'],
        ['trim-colliding', ' a1 ']
    ])('rejects %s tile ids', (_case, duplicateId) => {
        const tiles = minimalValidTiles.map((tile, index) =>
            index === 1 ? { ...tile, id: duplicateId } : tile
        );

        expect(isValidPuzzleImportTileSet(tiles)).toBe(false);
        expect(validatePuzzleImportPayload({
            title: 'Duplicate ids',
            goal: 'clear_all',
            difficulty: 'starter',
            tiles
        })).toEqual({
            ok: false,
            errors: ['tiles must contain 4-64 tiles with unique ids and exactly two tiles per non-decoy pairKey']
        });
    });

    it('rejects too few tiles', () => {
        const tiles = [
            { id: 'a1', pairKey: 'p1', symbol: 'A', label: 'a', state: 'hidden' as const },
            { id: 'a2', pairKey: 'p1', symbol: 'A', label: 'a', state: 'hidden' as const }
        ];
        expect(isValidPuzzleImportTileSet(tiles)).toBe(false);
    });

    it('rejects non-array tile sets without throwing', () => {
        expect(isValidPuzzleImportTileSet(null)).toBe(false);
        expect(isValidPuzzleImportTileSet({ tiles: minimalValidTiles })).toBe(false);
    });

    it('rejects empty tile id after trim', () => {
        const tiles = [
            { id: '   ', pairKey: 'p1', symbol: 'A', label: 'a', state: 'hidden' as const },
            { id: 'a2', pairKey: 'p1', symbol: 'A', label: 'a', state: 'hidden' as const },
            { id: 'b1', pairKey: 'p2', symbol: 'B', label: 'b', state: 'hidden' as const },
            { id: 'b2', pairKey: 'p2', symbol: 'B', label: 'b', state: 'hidden' as const }
        ];
        expect(isValidPuzzleImportTileSet(tiles)).toBe(false);
    });

    it('rejects non-finite atomicVariant', () => {
        const tiles = [
            { id: 'a1', pairKey: 'p1', symbol: 'A', label: 'a', state: 'hidden' as const, atomicVariant: Number.NaN },
            { id: 'a2', pairKey: 'p1', symbol: 'A', label: 'a', state: 'hidden' as const },
            { id: 'b1', pairKey: 'p2', symbol: 'B', label: 'b', state: 'hidden' as const },
            { id: 'b2', pairKey: 'p2', symbol: 'B', label: 'b', state: 'hidden' as const }
        ];
        expect(isValidPuzzleImportTileSet(tiles)).toBe(false);
    });

    it('validates import payload metadata with useful errors', () => {
        expect(
            validatePuzzleImportPayload({
                title: 'Tiny',
                goal: 'clear_all',
                difficulty: 'starter',
                tiles: minimalValidTiles
            }).ok
        ).toBe(true);
        expect(validatePuzzleImportPayload({ title: '', goal: 'clear_all', difficulty: 'starter', tiles: minimalValidTiles })).toEqual({
            ok: false,
            errors: ['title must be a string with at least 3 characters']
        });
        expect(validatePuzzleImportPayload({ title: 'Broken', goal: 'clear_all', difficulty: 'starter', tiles: [] })).toEqual({
            ok: false,
            errors: ['tiles must contain 4-64 tiles with unique ids and exactly two tiles per non-decoy pairKey']
        });
    });

    it('rejects non-object import payloads without throwing', () => {
        expect(validatePuzzleImportPayload(null)).toEqual({
            ok: false,
            errors: [
                'title must be a string with at least 3 characters',
                'goal must be one of clear_all, perfect_clear, flip_par',
                'difficulty must be starter, standard, or advanced',
                'tiles must contain 4-64 tiles with unique ids and exactly two tiles per non-decoy pairKey'
            ]
        });
        expect(validatePuzzleImportPayload('not a puzzle').ok).toBe(false);
    });

    it('property-checks exact non-decoy pair cardinality', () => {
        const makeTiles = (pairCount: number): Tile[] =>
            Array.from({ length: pairCount }, (_, index) => {
                const pairKey = `pair-${index}`;
                const symbol = String.fromCharCode(65 + (index % 26));
                return [
                    { id: `${pairKey}-a`, pairKey, symbol, label: symbol, state: 'hidden' as const },
                    { id: `${pairKey}-b`, pairKey, symbol, label: symbol, state: 'hidden' as const }
                ];
            }).flat();

        fc.assert(
            fc.property(fc.integer({ min: 2, max: 32 }), (pairCount) => {
                expect(isValidPuzzleImportTileSet(makeTiles(pairCount))).toBe(true);
            })
        );

        fc.assert(
            fc.property(fc.integer({ min: 2, max: 31 }), (pairCount) => {
                const tiles = [
                    ...makeTiles(pairCount),
                    { id: 'orphan', pairKey: 'orphan', symbol: '?', label: 'orphan', state: 'hidden' as const }
                ];
                expect(isValidPuzzleImportTileSet(tiles)).toBe(false);
            })
        );
    });

    it('property-checks arbitrary import payloads never throw', () => {
        fc.assert(
            fc.property(fc.anything(), (payload) => {
                const result = validatePuzzleImportPayload(payload);
                expect(typeof result.ok).toBe('boolean');
                expect(Array.isArray(result.errors)).toBe(true);
            }),
            { numRuns: 100 }
        );
    });
});

describe('BUILTIN_PUZZLES', () => {
    it('satisfies puzzle tile validation rules', () => {
        for (const puzzle of Object.values(BUILTIN_PUZZLES)) {
            expect(isValidPuzzleImportTileSet(puzzle.tiles)).toBe(true);
        }
    });

    it('projects visible puzzle library progress rows', () => {
        const save = createDefaultSaveData();
        save.playerStats = {
            ...save.playerStats!,
            puzzleCompletions: {
                starter_pairs: { completed: true, bestMistakes: 0, bestScore: 120 }
            }
        };
        const rows = getPuzzleLibraryRows(save);
        expect(rows.map((row) => row.id)).toEqual(['starter_pairs', 'mirror_craft', 'glyph_cross']);
        expect(rows.find((row) => row.id === 'starter_pairs')?.status).toBe('completed');
        expect(rows.find((row) => row.id === 'mirror_craft')?.difficulty).toBe('standard');
        expect(rows.find((row) => row.id === 'glyph_cross')?.pack).toBe('challenge');
        expect(rows.find((row) => row.id === 'glyph_cross')?.author).toBe('Memory Dungeon');
    });

    it('REG-084 derives pack progression medals and curation gates', () => {
        const save = createDefaultSaveData();
        save.playerStats = {
            ...save.playerStats!,
            puzzleCompletions: {
                starter_pairs: { completed: true, bestMistakes: 0, bestScore: 120 },
                mirror_craft: { completed: true, bestMistakes: 2, bestScore: 90 }
            }
        };
        const packs = getPuzzlePackProgressRows(save);

        expect(packs.find((pack) => pack.id === 'tutorial')?.medal).toBe('gold');
        expect(packs.find((pack) => pack.id === 'beginner')?.medal).toBe('silver');
        expect(packs.find((pack) => pack.id === 'challenge')?.locked).toBe(false);
        expect(packs.every((pack) => pack.offlineOnly)).toBe(true);
    });
});
