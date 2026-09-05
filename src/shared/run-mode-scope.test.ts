import { describe, expect, it } from 'vitest';
import { getRunModeCatalog } from './run-mode-catalog';
import {
    findStaleRunModeScopeRows,
    findUnclassifiedRunModes,
    getRunModeScope,
    getRunModeScopeRows,
    isDistinctRunMode,
    RUN_MODE_SCOPE
} from '../../scripts/run-mode-scope';

describe('run mode scope', () => {
    it('classifies every entry in the catalog, so a new mode has to be triaged', () => {
        // The point of the module: a thirteenth menu entry cannot be added without someone saying
        // whether it is a game or a knob.
        expect(findUnclassifiedRunModes()).toEqual([]);
    });

    it('does not keep a record of a mode the catalog no longer has', () => {
        expect(findStaleRunModeScopeRows()).toEqual([]);
    });

    it('names what each entry changes and why that does or does not make it a mode', () => {
        for (const row of getRunModeScopeRows()) {
            expect(row.changes.length, row.modeId).toBeGreaterThan(20);
            expect(row.reason.length, row.modeId).toBeGreaterThan(20);
        }
    });

    it('keeps the three that differ in kind, and the authored puzzles', () => {
        expect(isDistinctRunMode('classic')).toBe(true);
        expect(isDistinctRunMode('daily')).toBe(true);
        expect(isDistinctRunMode('pass_and_play')).toBe(true);
        expect(getRunModeScopeRows().filter((row) => row.modeId.startsWith('puzzle_')).every((row) => row.kind === 'distinct')).toBe(
            true
        );
    });

    it('calls the option-bag entries what they are', () => {
        // Each of these is createNewRun with a field set; none builds a different board.
        for (const modeId of ['gauntlet', 'wild', 'practice', 'scholar', 'pin_vow', 'meditation', 'endless', 'dungeon_showcase']) {
            expect(getRunModeScope(modeId)?.kind, modeId).toBe('preset');
        }
    });

    it('retired more entries than it kept, which is the finding', () => {
        const presets = RUN_MODE_SCOPE.filter((row) => row.kind === 'preset');
        expect(presets.length).toBeGreaterThan(RUN_MODE_SCOPE.length / 2);
        // And the catalog no longer offers them: the rules live in the Classic setup instead.
        const catalogIds = new Set(getRunModeCatalog().map((mode) => mode.id));
        expect(presets.filter((row) => catalogIds.has(row.modeId))).toEqual([]);
    });
});
