import { describe, expect, it } from 'vitest';
import {
    isQuarantinedSaveName,
    pruneQuarantinedSaves,
    QUARANTINE_KEEP_COUNT,
    quarantineFileName,
    quarantineSaveFile,
    type SaveRecoveryFileSystem
} from './save-recovery';

const SAVE_FILE = 'memory-dungeon-save.json';

const createFileSystem = (files: string[]): SaveRecoveryFileSystem & { files: string[] } => ({
    basename: (path) => path.slice(path.lastIndexOf('/') + 1),
    copy: (_from, to) => {
        (fileSystem.files as string[]).push(to.slice(to.lastIndexOf('/') + 1));
    },
    dirname: (path) => path.slice(0, path.lastIndexOf('/')),
    exists: (path) => fileSystem.files.includes(path.slice(path.lastIndexOf('/') + 1)),
    files,
    join: (...segments) => segments.join('/'),
    listDirectory: () => [...fileSystem.files],
    remove: (path) => {
        const name = path.slice(path.lastIndexOf('/') + 1);
        fileSystem.files = fileSystem.files.filter((candidate) => candidate !== name);
    }
});

let fileSystem: ReturnType<typeof createFileSystem>;

describe('quarantineFileName', () => {
    it('keeps the extension and strips characters Windows will not accept in a name', () => {
        const name = quarantineFileName(SAVE_FILE, '2026-09-03T20:45:12.884Z');

        expect(name.endsWith('.json')).toBe(true);
        expect(name).not.toContain(':');
        expect(name.startsWith('memory-dungeon-save.unreadable-')).toBe(true);
    });

    it('handles a name with no extension at all', () => {
        expect(quarantineFileName('save', '2026-09-03T20:45:12.884Z')).toBe('save.unreadable-2026-09-03T20-45-12-884Z');
    });
});

describe('pruneQuarantinedSaves', () => {
    it('drops the oldest and never touches the live save or anything else in the folder', () => {
        const quarantined = Array.from(
            { length: QUARANTINE_KEEP_COUNT + 3 },
            (_unused, index) => quarantineFileName(SAVE_FILE, `2026-09-0${index + 1}T10:00:00.000Z`)
        );
        const pruned = pruneQuarantinedSaves([SAVE_FILE, 'config.json', ...quarantined], SAVE_FILE);

        expect(pruned).toHaveLength(3);
        expect(pruned).toEqual(quarantined.slice(0, 3));
        expect(pruned).not.toContain(SAVE_FILE);
        expect(pruned).not.toContain('config.json');
    });

    it('does not treat the live save as one of its own sidecars', () => {
        expect(isQuarantinedSaveName(SAVE_FILE, SAVE_FILE)).toBe(false);
        expect(pruneQuarantinedSaves([SAVE_FILE], SAVE_FILE)).toEqual([]);
    });
});

describe('quarantineSaveFile', () => {
    it('copies the unreadable save aside rather than moving it', () => {
        fileSystem = createFileSystem([SAVE_FILE]);
        const result = quarantineSaveFile(`/saves/${SAVE_FILE}`, '2026-09-03T20:45:12.884Z', fileSystem);

        expect(result.quarantinedAs).not.toBeNull();
        // The original is still there: the store that owns it is open, and a rename out from under
        // it turns one bad save into two.
        expect(fileSystem.files).toContain(SAVE_FILE);
        expect(fileSystem.files).toContain(result.quarantinedAs);
    });

    it('prunes older sidecars once past the keep limit', () => {
        const existing = Array.from(
            { length: QUARANTINE_KEEP_COUNT },
            (_unused, index) => quarantineFileName(SAVE_FILE, `2026-08-0${index + 1}T10:00:00.000Z`)
        );
        fileSystem = createFileSystem([SAVE_FILE, ...existing]);
        const result = quarantineSaveFile(`/saves/${SAVE_FILE}`, '2026-09-03T20:45:12.884Z', fileSystem);

        expect(result.pruned).toEqual([existing[0]]);
        expect(fileSystem.files).not.toContain(existing[0]);
        expect(fileSystem.files).toContain(result.quarantinedAs);
        expect(fileSystem.files.filter((name) => isQuarantinedSaveName(name, SAVE_FILE))).toHaveLength(
            QUARANTINE_KEEP_COUNT
        );
    });

    it('reports nothing kept when there was no save file to keep', () => {
        fileSystem = createFileSystem([]);
        expect(quarantineSaveFile(`/saves/${SAVE_FILE}`, '2026-09-03T20:45:12.884Z', fileSystem)).toEqual({
            pruned: [],
            quarantinedAs: null
        });
    });
});
