import { describe, expect, it } from 'vitest';
import { getUiStateCopy, getUiStateCopyRows } from './ui-state-copy';

describe('REG-100 UI state copy', () => {
    it('keeps empty/error/locked/loading states actionable and offline-safe', () => {
        const rows = getUiStateCopyRows();
        expect(rows.map((row) => row.id)).toEqual([
            'inventory_no_run',
            'inventory_no_relics',
            'inventory_no_mutators',
            'inventory_no_contract',
            'codex_filter_empty',
            'choose_path_locked',
            'startup_loading',
            'collection_locked_reward',
            'save_error_recovery'
        ]);
        expect(rows.every((row) => row.actionLabel.length > 0)).toBe(true);
        expect(rows.every((row) => row.localOnly)).toBe(true);
        expect(rows.every((row) => row.onlineAssumption === false)).toBe(true);
        expect(getUiStateCopy('choose_path_locked').state).toBe('locked');
        expect(getUiStateCopy('missing_copy' as Parameters<typeof getUiStateCopy>[0])).toMatchObject({
            id: 'inventory_no_run',
            state: 'empty'
        });
    });
});
