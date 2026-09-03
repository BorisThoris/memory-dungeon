/**
 * Getting a player out of an unreadable save.
 *
 * A save the game cannot accept is not always a broken one. The commonest cause is a save written
 * by a *newer* build: a player on the beta branch closes the game on their Deck, Steam Cloud syncs
 * that file down to the release build on their desktop, and the older client refuses it. The file
 * is perfectly good — it just belongs to a version this build does not know.
 *
 * So recovery never deletes. It copies the file aside under a timestamped name and starts a fresh
 * profile beside it; the player who realises what happened can put the original back, and the
 * player who does not is at least playing a game that saves again. Old sidecars are pruned so a
 * repeatedly downgraded install does not accumulate them forever.
 */

/** How many quarantined saves to keep before the oldest are dropped. */
export const QUARANTINE_KEEP_COUNT = 5;

const QUARANTINE_MARKER = '.unreadable-';

/** File-system timestamps have to survive Windows, which rejects `:` in a name. */
const fileSafeTimestamp = (nowIso: string): string => nowIso.replace(/[:.]/g, '-');

/**
 * The name to copy an unreadable save aside under. Keeps the original extension so the file still
 * opens in whatever the player uses to read JSON.
 */
export const quarantineFileName = (saveFileName: string, nowIso: string): string => {
    const dot = saveFileName.lastIndexOf('.');
    const stem = dot > 0 ? saveFileName.slice(0, dot) : saveFileName;
    const extension = dot > 0 ? saveFileName.slice(dot) : '';
    return `${stem}${QUARANTINE_MARKER}${fileSafeTimestamp(nowIso)}${extension}`;
};

export const isQuarantinedSaveName = (fileName: string, saveFileName: string): boolean => {
    const dot = saveFileName.lastIndexOf('.');
    const stem = dot > 0 ? saveFileName.slice(0, dot) : saveFileName;
    return fileName.startsWith(`${stem}${QUARANTINE_MARKER}`);
};

/**
 * Which quarantined saves to delete. Names sort chronologically because the timestamp is ISO, so
 * the newest survive — the one a player is most likely to want back is the one just set aside.
 */
export const pruneQuarantinedSaves = (
    fileNames: readonly string[],
    saveFileName: string,
    keep = QUARANTINE_KEEP_COUNT
): string[] => {
    const quarantined = [...new Set(fileNames.filter((name) => isQuarantinedSaveName(name, saveFileName)))].sort();
    return quarantined.slice(0, Math.max(0, quarantined.length - keep));
};

export interface SaveRecoveryResult {
    /** The name the unreadable save was kept under, or null when there was no file to keep. */
    readonly quarantinedAs: string | null;
    /** Names removed to stay under {@link QUARANTINE_KEEP_COUNT}. */
    readonly pruned: readonly string[];
}

/** The file operations recovery needs, kept as a seam so the sequencing can be tested. */
export interface SaveRecoveryFileSystem {
    exists: (path: string) => boolean;
    copy: (from: string, to: string) => void;
    remove: (path: string) => void;
    listDirectory: (path: string) => string[];
    join: (...segments: string[]) => string;
    dirname: (path: string) => string;
    basename: (path: string) => string;
}

/**
 * Copy the save aside and prune old sidecars. Deliberately a copy rather than a rename: the store
 * that owns the original is still open, and taking the file out from under it is the kind of thing
 * that turns one bad save into two.
 */
export const quarantineSaveFile = (
    saveFilePath: string,
    nowIso: string,
    fs: SaveRecoveryFileSystem
): SaveRecoveryResult => {
    if (!fs.exists(saveFilePath)) {
        return { pruned: [], quarantinedAs: null };
    }
    const directory = fs.dirname(saveFilePath);
    const saveFileName = fs.basename(saveFilePath);
    const quarantinedAs = quarantineFileName(saveFileName, nowIso);
    fs.copy(saveFilePath, fs.join(directory, quarantinedAs));

    const pruned: string[] = [];
    for (const name of pruneQuarantinedSaves(fs.listDirectory(directory), saveFileName)) {
        fs.remove(fs.join(directory, name));
        pruned.push(name);
    }
    return { pruned, quarantinedAs };
};
