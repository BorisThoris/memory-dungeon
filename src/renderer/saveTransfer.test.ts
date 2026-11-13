import { describe, expect, it } from 'vitest';
import { createDefaultSaveData } from '../shared/save-data';
import { SAVE_SCHEMA_VERSION } from '../shared/contracts';
import { parseSaveExport, saveExportFileName, serializeSaveExport } from './saveTransfer';

describe('carrying a profile to another device', () => {
    it('reads back exactly what it wrote, under a dated file name', () => {
        const save = { ...createDefaultSaveData(), bestScore: 4_321 };
        const now = new Date('2026-11-13T12:00:00Z');
        const parsed = parseSaveExport(serializeSaveExport(save, now));
        expect(parsed).toEqual({ ok: true, save: expect.objectContaining({ bestScore: 4_321 }) });
        expect(saveExportFileName(now)).toBe('memory-dungeon-save-2026-11-13.json');
    });

    it('refuses a file that is not an export, or a save that does not hold together', () => {
        expect(parseSaveExport('not json')).toEqual({ ok: false, reason: 'That file is not a Memory Dungeon save.' });
        expect(parseSaveExport(JSON.stringify(createDefaultSaveData()))).toMatchObject({ ok: false });
        expect(parseSaveExport(JSON.stringify({ kind: 'memory-dungeon-save', save: { bestScore: 'lots' } }))).toEqual({
            ok: false,
            reason: 'That save is damaged or from a newer version of the game.'
        });
        const future = { ...createDefaultSaveData(), schemaVersion: SAVE_SCHEMA_VERSION + 1 };
        expect(parseSaveExport(serializeSaveExport(future, new Date()))).toMatchObject({ ok: false });
    });
});
