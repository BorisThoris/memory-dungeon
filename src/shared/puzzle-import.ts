import type { PuzzleDifficulty, PuzzleGoal, PuzzlePackId, Tile } from './contracts';
import type { SaveData } from './contracts';
import { z } from 'zod';
import { BUILTIN_PUZZLES } from './builtin-puzzles';
import { DECOY_PAIR_KEY } from './tile-identity';

const puzzleTileSchema = z.object({
    id: z.string().trim().min(1),
    pairKey: z.string().trim().min(1),
    symbol: z.string(),
    label: z.string(),
    state: z.enum(['hidden', 'flipped', 'matched', 'removed']),
    atomicVariant: z.number().finite().optional()
}).passthrough();

export const puzzleImportPayloadSchema = z.object({
    title: z.string().trim().min(3),
    goal: z.enum(['clear_all', 'perfect_clear', 'flip_par']),
    difficulty: z.enum(['starter', 'standard', 'advanced']),
    tags: z.array(z.string().trim().min(1)).optional(),
    tiles: z.array(puzzleTileSchema).min(4).max(64)
});

const PUZZLE_TILE_VALIDATION_ERROR =
    'tiles must contain 4-64 tiles with unique ids and exactly two tiles per non-decoy pairKey';

/**
 * Runtime checks for hand-authored puzzle tile lists (builtins and tests):
 * count 4–64, required string fields (non-empty id/pairKey after trim), optional finite `atomicVariant`,
 * unique normalized tile ids, and exactly two tiles per non-decoy `pairKey`.
 */
export const isValidPuzzleImportTileSet = (tiles: unknown): tiles is Tile[] => {
    const parsed = z.array(puzzleTileSchema).min(4).max(64).safeParse(tiles);
    if (!parsed.success) {
        return false;
    }
    const tileIds = parsed.data.map((tile) => tile.id);
    if (new Set(tileIds).size !== tileIds.length) {
        return false;
    }
    const pairKeys = parsed.data.map((x) => x.pairKey).filter((k) => k !== DECOY_PAIR_KEY);
    const counts = new Map<string, number>();
    for (const k of pairKeys) {
        counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    for (const c of counts.values()) {
        if (c !== 2) {
            return false;
        }
    }
    return true;
};

export interface PuzzleImportPayload {
    title?: unknown;
    goal?: unknown;
    difficulty?: unknown;
    tags?: unknown;
    tiles?: unknown;
}

export interface PuzzleImportResult {
    ok: boolean;
    errors: string[];
}

export interface PuzzlePackSummary {
    id: PuzzlePackId;
    title: string;
    description: string;
    puzzleIds: string[];
}

export type PuzzleMedal = 'none' | 'bronze' | 'silver' | 'gold';

export interface PuzzleProgressionRow {
    id: string;
    title: string;
    packId: PuzzlePackId;
    packTitle: string;
    medal: PuzzleMedal;
    completed: boolean;
    bestMistakes: number | null;
    bestScore: number;
    curation: {
        author: string;
        version: number;
        difficulty: PuzzleDifficulty;
        tags: string[];
        goal: PuzzleGoal;
        goalText: string;
    };
    unlockRule: string;
    offlineOnly: true;
}

export interface PuzzlePackProgressRow extends PuzzlePackSummary {
    completedCount: number;
    totalCount: number;
    medal: PuzzleMedal;
    locked: boolean;
    curated: true;
    curationNote: string;
    progressLabel: string;
    offlineOnly: true;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

export const validatePuzzleImportPayload = (payload: unknown): PuzzleImportResult => {
    const errors: string[] = [];
    if (!isRecord(payload)) {
        return {
            ok: false,
            errors: [
                'title must be a string with at least 3 characters',
                'goal must be one of clear_all, perfect_clear, flip_par',
                'difficulty must be starter, standard, or advanced',
                PUZZLE_TILE_VALIDATION_ERROR
            ]
        };
    }

    const parsed = puzzleImportPayloadSchema.safeParse(payload);
    let hasTileSchemaIssue = false;

    if (!parsed.success) {
        const issuePaths = new Set(parsed.error.issues.map((issue) => issue.path[0]));
        if (issuePaths.has('title')) {
            errors.push('title must be a string with at least 3 characters');
        }
        if (issuePaths.has('goal')) {
            errors.push('goal must be one of clear_all, perfect_clear, flip_par');
        }
        if (issuePaths.has('difficulty')) {
            errors.push('difficulty must be starter, standard, or advanced');
        }
        if (issuePaths.has('tags')) {
            errors.push('tags must be non-empty strings when provided');
        }
        if (issuePaths.has('tiles')) {
            hasTileSchemaIssue = true;
            errors.push(PUZZLE_TILE_VALIDATION_ERROR);
        }
    }
    if (!hasTileSchemaIssue && Array.isArray(payload.tiles) && !isValidPuzzleImportTileSet(payload.tiles)) {
        errors.push(PUZZLE_TILE_VALIDATION_ERROR);
    }
    return { ok: errors.length === 0, errors };
};

export const PUZZLE_PACKS: readonly PuzzlePackSummary[] = [
    {
        id: 'tutorial',
        title: 'Tutorial pack',
        description: 'Tiny and beginner boards for first clears.',
        puzzleIds: ['starter_pairs']
    },
    {
        id: 'beginner',
        title: 'Beginner pack',
        description: 'Readable handcrafted boards that introduce mirrored symbols.',
        puzzleIds: ['mirror_craft']
    },
    {
        id: 'challenge',
        title: 'Challenge pack',
        description: 'Advanced authored patterns for long-tail mastery.',
        puzzleIds: ['glyph_cross']
    }
];

export const getPuzzleLibraryRows = (save: SaveData) =>
    Object.values(BUILTIN_PUZZLES).map((puzzle) => {
        const completion = save.playerStats?.puzzleCompletions?.[puzzle.id];
        const completed = completion?.completed === true;
        const pack = PUZZLE_PACKS.find((candidate) => candidate.puzzleIds.includes(puzzle.id));
        return {
            id: puzzle.id,
            title: puzzle.title,
            difficulty: puzzle.difficulty,
            goal: puzzle.goal,
            goalText: puzzle.goalText,
            tags: puzzle.tags,
            pack: pack?.id ?? 'experimental',
            author: puzzle.author,
            version: puzzle.version,
            status: completed ? 'completed' : 'open',
            progress: completed ? { current: 1, target: 1 } : { current: 0, target: 1 }
        };
    });

type PuzzleCompletionLike = NonNullable<SaveData['playerStats']>['puzzleCompletions'] extends infer C
    ? C extends Record<string, infer R>
        ? R | undefined
        : never
    : never;

export const medalForPuzzleCompletion = (completion: PuzzleCompletionLike): PuzzleMedal => {
    if (!completion || completion.completed !== true) {
        return 'none';
    }
    if (completion.bestMistakes === 0) {
        return 'gold';
    }
    if (completion.bestMistakes != null && completion.bestMistakes <= 2) {
        return 'silver';
    }
    return 'bronze';
};

const packMedal = (save: SaveData, pack: PuzzlePackSummary): PuzzleMedal => {
    const medals = pack.puzzleIds.map((id) => medalForPuzzleCompletion(save.playerStats?.puzzleCompletions?.[id]));
    if (medals.every((medal) => medal === 'gold')) {
        return 'gold';
    }
    if (medals.every((medal) => medal === 'gold' || medal === 'silver')) {
        return 'silver';
    }
    if (medals.some((medal) => medal !== 'none')) {
        return 'bronze';
    }
    return 'none';
};

export const getPuzzlePackProgressRows = (save: SaveData): PuzzlePackProgressRow[] =>
    PUZZLE_PACKS.map((pack) => {
        const completedCount = pack.puzzleIds.filter((id) => save.playerStats?.puzzleCompletions?.[id]?.completed === true).length;
        return {
            ...pack,
            completedCount,
            totalCount: pack.puzzleIds.length,
            medal: packMedal(save, pack),
            locked: false,
            curated: true,
            progressLabel: `${completedCount}/${pack.puzzleIds.length} solved`,
            curationNote:
                pack.id === 'tutorial'
                    ? 'Starter curation: tiny boards teach the format.'
                    : pack.id === 'beginner'
                      ? 'Beginner curation: readable handcrafted symbol layouts.'
                      : 'Challenge curation: advanced authored patterns after starter mastery.',
            offlineOnly: true
        };
    });

const packForPuzzle = (puzzleId: string): PuzzlePackSummary =>
    PUZZLE_PACKS.find((candidate) => candidate.puzzleIds.includes(puzzleId)) ?? {
        id: 'experimental',
        title: 'Experimental pack',
        description: 'Imported or uncategorized local puzzle content.',
        puzzleIds: [puzzleId]
    };

export const getPuzzleProgressionRows = (save: SaveData): PuzzleProgressionRow[] =>
    Object.values(BUILTIN_PUZZLES).map((puzzle) => {
        const pack = packForPuzzle(puzzle.id);
        const completion = save.playerStats?.puzzleCompletions?.[puzzle.id];
        const medal = medalForPuzzleCompletion(completion);
        return {
            id: puzzle.id,
            title: puzzle.title,
            packId: pack.id,
            packTitle: pack.title,
            medal,
            completed: completion?.completed === true,
            bestMistakes: completion?.bestMistakes ?? null,
            bestScore: completion?.bestScore ?? 0,
            curation: {
                author: puzzle.author,
                version: puzzle.version,
                difficulty: puzzle.difficulty,
                tags: puzzle.tags,
                goal: puzzle.goal,
                goalText: puzzle.goalText
            },
            unlockRule:
                puzzle.difficulty === 'advanced'
                    ? 'Recommended after clearing a starter or beginner puzzle; available offline in v1.'
                    : 'Available offline from the puzzle shelf.',
            offlineOnly: true
        };
    });
