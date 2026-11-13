import { SAVE_SCHEMA_VERSION, type SaveData } from '../shared/contracts';
import { normalizeUnknownSaveDataOrThrow } from '../shared/save-data';

/**
 * Carrying a profile from one device to another (2026-11-13). There is no cloud sync in this
 * build, so a player who moves from the browser to the phone, or to a new PC, had no way to take
 * their progress along; About only said to copy the file yourself, which a browser or phone player
 * cannot. Export writes the save as a JSON file; import reads one back through the same validation
 * the game applies to its own save on boot, so a hand-edited or foreign file is refused, not loaded.
 */
export const SAVE_EXPORT_KIND = 'memory-dungeon-save';

export const saveExportFileName = (now: Date): string => `memory-dungeon-save-${now.toISOString().slice(0, 10)}.json`;

export const serializeSaveExport = (saveData: SaveData, now: Date): string =>
    JSON.stringify({ kind: SAVE_EXPORT_KIND, exportedAt: now.toISOString(), save: saveData }, null, 2);

export type ImportedSave = { ok: true; save: SaveData } | { ok: false; reason: string };

/** The save in an exported file, or why it cannot be used. */
export const parseSaveExport = (text: string): ImportedSave => {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return { ok: false, reason: 'That file is not a Memory Dungeon save.' };
    }
    const wrapped = typeof parsed === 'object' && parsed !== null && (parsed as { kind?: unknown }).kind === SAVE_EXPORT_KIND;
    if (!wrapped) return { ok: false, reason: 'That file is not a Memory Dungeon save.' };
    // The save's own normaliser repairs what it can, which on boot is right; here it would turn a
    // broken file into an empty profile that silently replaces real progress. The core of a save
    // must be there before it is trusted.
    const save = (parsed as { save?: unknown }).save as Record<string, unknown> | null | undefined;
    if (
        typeof save !== 'object' ||
        save === null ||
        typeof save.schemaVersion !== 'number' ||
        save.schemaVersion > SAVE_SCHEMA_VERSION ||
        typeof save.bestScore !== 'number' ||
        typeof save.settings !== 'object' ||
        save.settings === null
    ) {
        return { ok: false, reason: 'That save is damaged or from a newer version of the game.' };
    }
    try {
        return { ok: true, save: normalizeUnknownSaveDataOrThrow((parsed as { save?: unknown }).save) };
    } catch {
        return { ok: false, reason: 'That save is damaged or from a newer version of the game.' };
    }
};

/** Hands the export to the browser (or Electron's save dialog) as a download. */
export const downloadSaveExport = (saveData: SaveData, now = new Date()): void => {
    const blob = new Blob([serializeSaveExport(saveData, now)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = saveExportFileName(now);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
};
