import { describe, expect, it } from 'vitest';
import { CRASH_LOG_DIR_NAME } from '../main/crash-log';
import {
    PACKAGED_APP_DIR_NAME,
    SAVE_FILE_NAME,
    SAVE_STORE_NAME,
    STEAM_CLOUD_EXCLUSIONS,
    STEAM_CLOUD_RULES,
    formatSteamCloudRules
} from './save-location';

describe('save location', () => {
    it('names the file electron-store actually writes', () => {
        expect(SAVE_FILE_NAME).toBe(`${SAVE_STORE_NAME}.json`);
    });

    it('uses the packaged product name, which is the directory Steam will look in', () => {
        // `build.productName` in package.json decides `app.getName()` in a packaged build, and
        // therefore the app-data directory. A mismatch here means Auto-Cloud syncs nothing.
        expect(PACKAGED_APP_DIR_NAME).toBe('Memory Dungeon');
        for (const rule of STEAM_CLOUD_RULES) {
            expect(rule.subdirectory).toBe(PACKAGED_APP_DIR_NAME);
        }
    });
});

describe('steam cloud rules', () => {
    it('covers each platform once, with the root Steam names for it', () => {
        expect(STEAM_CLOUD_RULES.map((rule) => rule.platform)).toEqual(['windows', 'macos', 'linux']);
        expect(STEAM_CLOUD_RULES.map((rule) => rule.root)).toEqual([
            'WinAppDataRoaming',
            'MacAppSupport',
            'LinuxXdgConfigHome'
        ]);
    });

    it('syncs the save and only the save', () => {
        for (const rule of STEAM_CLOUD_RULES) {
            expect(rule.pattern).toBe(SAVE_FILE_NAME);
            // A wildcard here would sweep up the crash logs sitting beside it.
            expect(rule.pattern).not.toContain('*');
        }
    });

    it('keeps the crash logs out, and says which directory that is', () => {
        const excluded = STEAM_CLOUD_EXCLUSIONS.map((row) => row.path);
        expect(excluded).toContain(`${CRASH_LOG_DIR_NAME}/`);
        for (const row of STEAM_CLOUD_EXCLUSIONS) {
            expect(row.reason.length).toBeGreaterThan(20);
        }
    });

    it('renders a line per rule for the config the Partner site needs', () => {
        const text = formatSteamCloudRules();
        expect(text.split('\n')).toHaveLength(STEAM_CLOUD_RULES.length);
        expect(text).toContain('WinAppDataRoaming');
        expect(text).toContain(`Memory Dungeon/${SAVE_FILE_NAME}`);
    });
});
