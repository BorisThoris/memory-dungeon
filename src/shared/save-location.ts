/**
 * Where the save lives, said once, so Steam can be told the same thing the game does.
 *
 * Steam Auto-Cloud needs no code in the game at all: it syncs files matching a pattern under a
 * named root while the game is not running. What it does need is a path that will not drift, and
 * an accurate idea of which files should travel between a player's machines and which must not.
 * Both of those were previously an accident of `electron-store` defaults and existed nowhere a
 * person configuring the Partner site could read them.
 *
 * Pure and shared so `scripts/steam-cloud-config.mjs` can print the configuration and a test can
 * hold it to the values the main process actually uses.
 */

/** `electron-store` is constructed with this name and appends `.json`. */
export const SAVE_STORE_NAME = 'memory-dungeon-save';
export const SAVE_FILE_NAME = `${SAVE_STORE_NAME}.json`;

/**
 * The directory Electron gives us, which is `app.getName()` under each platform's app-data root.
 * A packaged build takes its name from `build.productName`; an unpackaged one falls back to the
 * package name, which is why these differ and why only the packaged value belongs in Steam.
 */
export const PACKAGED_APP_DIR_NAME = 'Memory Dungeon';
export const UNPACKAGED_APP_DIR_NAME = 'memory-dungeon';

export type SteamCloudRoot = 'WinAppDataRoaming' | 'MacAppSupport' | 'LinuxXdgConfigHome';

export interface SteamCloudRule {
    /** Steam's name for the platform root the path hangs off. */
    readonly root: SteamCloudRoot;
    /** Path under that root, as Steam expects it. */
    readonly subdirectory: string;
    readonly pattern: string;
    readonly platform: 'windows' | 'macos' | 'linux';
}

/**
 * One rule per platform, each matching the save and nothing else.
 *
 * Deliberately narrow. The crash logs sit in a sibling directory and must not sync: they describe
 * one machine's failure, and carrying them to a second machine would report a crash that never
 * happened there — besides spending cloud quota on files no other machine can act on.
 */
export const STEAM_CLOUD_RULES: readonly SteamCloudRule[] = [
    { pattern: SAVE_FILE_NAME, platform: 'windows', root: 'WinAppDataRoaming', subdirectory: PACKAGED_APP_DIR_NAME },
    { pattern: SAVE_FILE_NAME, platform: 'macos', root: 'MacAppSupport', subdirectory: PACKAGED_APP_DIR_NAME },
    { pattern: SAVE_FILE_NAME, platform: 'linux', root: 'LinuxXdgConfigHome', subdirectory: PACKAGED_APP_DIR_NAME }
];

/** Files under the save directory that must never be synced, and why, for the config doc. */
export const STEAM_CLOUD_EXCLUSIONS: readonly { readonly path: string; readonly reason: string }[] = [
    {
        path: 'crash-logs/',
        reason: 'Describes one machine. Syncing it would report another machine’s crash as this one’s.'
    }
];

export const formatSteamCloudRules = (rules: readonly SteamCloudRule[] = STEAM_CLOUD_RULES): string =>
    rules
        .map((rule) => `${rule.platform.padEnd(8)} ${rule.root.padEnd(19)} ${rule.subdirectory}/${rule.pattern}`)
        .join('\n');
