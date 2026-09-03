import { copyFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { SaveRecoveryFileSystem } from './save-recovery';

/** The real file system behind {@link SaveRecoveryFileSystem}; kept apart so tests can substitute it. */
export const nodeSaveRecoveryFileSystem: SaveRecoveryFileSystem = {
    basename,
    copy: (from, to) => copyFileSync(from, to),
    dirname,
    exists: (path) => existsSync(path),
    join,
    listDirectory: (path) => readdirSync(path),
    remove: (path) => rmSync(path, { force: true })
};
