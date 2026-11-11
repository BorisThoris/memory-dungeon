import { describe, expect, it } from 'vitest';
import { collectionStorageNote } from './collectionStorageNote';

describe('collectionStorageNote', () => {
    it('only claims Steam has the unlocks when Steam is actually connected', () => {
        expect(collectionStorageNote({ isAchievements: true, steamConnected: true })).toContain('Steam as well');
        expect(collectionStorageNote({ isAchievements: true, steamConnected: false })).toContain('not connected');
    });

    it('says nothing about Steam off the desktop build, where there is no Steam to connect', () => {
        const note = collectionStorageNote({ isAchievements: true, steamConnected: false, desktop: false });
        expect(note).not.toMatch(/Steam/);
        expect(note).toContain('this device');
    });

    it('says nothing about Steam for sections Steam has no part in', () => {
        for (const steamConnected of [true, false]) {
            expect(collectionStorageNote({ isAchievements: false, steamConnected })).not.toMatch(/Steam/);
        }
    });
});
