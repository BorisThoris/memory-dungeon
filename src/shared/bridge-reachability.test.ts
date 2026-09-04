import { describe, expect, it } from 'vitest';
import {
    BRIDGE_EXEMPTIONS,
    findUnusedBridgeMethods,
    readDesktopApiMethods
} from '../../scripts/bridge-reachability';
import { DESKTOP_IPC_CHANNELS, IPC_CHANNELS_LEGACY_DESKTOP } from './ipc-channels';

/**
 * The preload bridge is the renderer's whole reach into the main process, and everything on it is
 * callable by anything running in the renderer. A method nobody calls is attack surface bought for
 * nothing — and this is also where a second, never-taken path to fullscreen lived for a long time.
 */
describe('the desktop bridge audit', () => {
    it('reads the methods off the interface', () => {
        const methods = readDesktopApiMethods(
            [
                'export interface DesktopApi {',
                '    getSaveData: () => Promise<unknown>;',
                '    quitApp: () => Promise<void>;',
                '}'
            ].join('\n')
        );

        expect(methods).toEqual(['getSaveData', 'quitApp']);
    });

    it('reports a method the renderer never calls', () => {
        expect(findUnusedBridgeMethods(['used', 'orphaned'], ['void desktopClient.used();'])).toEqual(['orphaned']);
    });

    it('keeps no standing exemptions', () => {
        // Unlike gates, there is no good reason to expose a bridge method nobody calls; if this
        // ever gains an entry it should come with an argument, not a shrug.
        expect(Object.keys(BRIDGE_EXEMPTIONS)).toEqual([]);
    });

    it('keeps a channel for every method, and no channel without one', () => {
        // A method with no channel cannot be invoked; a channel with no method is a handler
        // registered in the main process that nothing on the bridge can reach.
        const methods = Object.keys(DESKTOP_IPC_CHANNELS).sort();

        expect(Object.keys(IPC_CHANNELS_LEGACY_DESKTOP).sort()).toEqual(methods);
        expect(new Set(Object.values(DESKTOP_IPC_CHANNELS)).size).toBe(methods.length);
    });
});
