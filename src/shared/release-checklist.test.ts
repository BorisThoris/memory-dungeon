import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RELEASE_CHECKLIST, releaseChecklistByOwner, renderReleaseChecklistMarkdown } from './release-checklist';
import { ACHIEVEMENT_IDS, createDefaultSaveData } from './save-data';
import { createDailyRun, createNewRun } from './game';
import { chargeFieldsWithATool } from '../renderer/components/runShellToolCatalog';
import { STEAM_ACHIEVEMENT_API_NAME } from './steam-achievement-api-names';
import { buildRichPresence, richPresencePairs } from './rich-presence';
import { STEAM_CLOUD_RULES, SAVE_FILE_NAME } from './save-location';
import { TILE_TRAIT_MARKS, describeTraitMark } from './tile-trait-marks';
import { GAMEPAD_STICK_DEADZONE, readGamepadActions, STANDARD_GAMEPAD_BUTTONS } from './gamepad-input';
import { MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH, normalizeWindowState, resolveRestoredBounds } from '../main/window-bounds';
import { CRASH_LOG_KEEP_COUNT, pruneCrashLogs, redactUserPaths } from '../main/crash-log';
import { quarantineFileName, quarantineSaveFile } from '../main/save-recovery';
import { HARDCODED_COPY_BASELINE, scanComponentCopy } from '../../scripts/copy-locality';
import { findUnrunGates, readScripts } from '../../scripts/gate-reachability';
import { BRIDGE_EXEMPTIONS, findUnusedBridgeMethods } from '../../scripts/bridge-reachability';
import { buildContentSecurityPolicy } from './content-security-policy';
import {
    DEAD_E2E_LOCATOR_BASELINE,
    findDeadTestIds,
    readRenderedTestIds
} from '../../scripts/e2e-locator-audit';
import { renderAchievementRows, renderRichPresenceRows } from '../../scripts/steam-partner-config';
import {
    findUnreachableMembers,
    readAppStateMembers,
    REACHABILITY_EXEMPTIONS
} from '../../scripts/store-action-reachability';
import { findTestOnlyModules, TEST_ONLY_EXEMPTIONS } from '../../scripts/test-only-modules';
import { reachableFromEntries, SHARED_REACH_EXEMPTIONS } from '../../scripts/shared-reach';
import { findMissingScriptPaths } from '../../scripts/script-paths';
import {
    findUndefinedTokens,
    findUndersized,
    MIN_TYPE_PX,
    readFontTokens,
    readTypeDeclarations,
    resolveMinPx
} from '../../scripts/min-type-size';
import {
    findFieldsWithoutPolicy,
    readPolicyRoots,
    SAVE_FIELD_POLICY_EXEMPTIONS
} from '../../scripts/save-field-policy';
import { audioNeverThrows, audioNeverThrowsBoolean } from '../renderer/audio/audioSafety';
import { DESKTOP_IPC_CHANNELS } from './ipc-channels';
import {
    appendRunHistory,
    buildRunHistoryRecord,
    normalizeRunHistory,
    RUN_HISTORY_LIMIT
} from './run-history-log';
import { SAVE_RECOVERY_COPY } from '../renderer/copy/saveRecoveryNotice';
import { APP_ERROR_COPY } from '../renderer/copy/appErrorBoundary';
import { normalizeRendererErrorReport } from './desktop-api-boundary';
import {
    describeThrownValue,
    RENDERER_ERROR_REPORT_LIMIT
} from '../renderer/diagnostics/rendererErrorHooks';

/**
 * One verifier per `repo` row. The point of the pairing is the assertion below that the two sets
 * are identical: a row cannot claim the repository has done something without a check here that
 * says so, and a check cannot be quietly orphaned when its row is deleted.
 */
const VERIFIERS: Record<string, () => void> = {
    'achievement-api-names': () => {
        // The map is what `achievement.activate` is handed. An id the game can award but the map
        // does not carry would throw at the Steam boundary on the one moment that matters.
        expect(Object.keys(STEAM_ACHIEVEMENT_API_NAME).sort()).toEqual([...ACHIEVEMENT_IDS].sort());
        expect(Object.values(STEAM_ACHIEVEMENT_API_NAME).every((name) => /^ACH_[A-Z_]+$/.test(name))).toBe(true);
    },
    'cloud-save-paths': () => {
        expect(STEAM_CLOUD_RULES.map((rule) => rule.root).sort()).toEqual([
            'LinuxXdgConfigHome',
            'MacAppSupport',
            'WinAppDataRoaming'
        ]);
        expect(STEAM_CLOUD_RULES.every((rule) => rule.pattern.includes(SAVE_FILE_NAME))).toBe(true);
    },
    'dock-tool-coverage': () => {
        const run = createNewRun(0);
        const covered = new Set<string>(chargeFieldsWithATool());

        // Row shuffle accumulated charges with no button to spend them for a long time.
        for (const field of Object.keys(run).filter((key) => key.endsWith('Charges'))) {
            expect(covered.has(field), `${field} has no dock tool that spends it`).toBe(true);
        }
    },
    'controller-support': () => {
        const pressed = new Set<number>([STANDARD_GAMEPAD_BUTTONS.a, STANDARD_GAMEPAD_BUTTONS.dpadUp]);
        const actions = readGamepadActions({
            axes: [0, 0, 0, 0],
            buttons: Array.from({ length: 17 }, (_unused, index) => ({ pressed: pressed.has(index) }))
        });

        expect(actions).toContain('confirm');
        expect(actions).toContain('up');
        expect(GAMEPAD_STICK_DEADZONE).toBeGreaterThan(0);
        // A stick resting inside the deadzone must not walk the focus on its own.
        expect(readGamepadActions({ axes: [0.2, 0.2, 0, 0], buttons: [] })).toEqual([]);
    },
    'crash-reports': () => {
        expect(redactUserPaths('at C:\\Users\\ada\\game\\main.js', null)).not.toContain('ada');
        expect(redactUserPaths('at /home/ada/game/main.js', null)).not.toContain('/home/ada');
        const kept = pruneCrashLogs(
            Array.from({ length: CRASH_LOG_KEEP_COUNT + 5 }, (_unused, index) => `crash-2026-01-${index + 10}.log`)
        );
        expect(kept.length).toBe(5);
    },
    'copy-extracted': () => {
        // Zero, not a baseline: a component may not carry a player-facing sentence at all, which is
        // what keeps localization a translation budget rather than a refactor.
        expect(HARDCODED_COPY_BASELINE).toBe(0);
        expect(scanComponentCopy()).toEqual([]);
    },
    'gate-reachability': () => {
        // gate:security hid 64 advisories this way; gate:package-hygiene hid five dead files.
        expect(findUnrunGates(readScripts())).toEqual([]);
    },
    'package-hygiene': () => {
        // The gate itself does the checking; what this row asserts is that something actually runs
        // it. It sat unreferenced by any composite gate for a long time, which is how five dead
        // files accumulated, two of them player-facing copy modules.
        const scripts = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')).scripts as Record<
            string,
            string
        >;

        expect(scripts['gate:package-hygiene']).toMatch(/knip/);
        expect(scripts.fullcheck).toContain('gate:package-hygiene');
    },
    'e2e-locators-live': () => {
        // A spec naming a missing element times out rather than failing, so this rot is invisible
        // until someone reads a timeout carefully.
        const rendered = readRenderedTestIds(['<div data-testid="present" />']);

        expect(findDeadTestIds(['present'], rendered)).toEqual([]);
        expect(findDeadTestIds(['gone'], rendered)).toEqual(['gone']);
        expect(DEAD_E2E_LOCATOR_BASELINE).toBeGreaterThanOrEqual(0);
    },
    'shipped-csp': () => {
        // Vite copies index.html verbatim, so a hot-reload allowance written there ships with the
        // game: a packaged renderer allowed to open a websocket to any local port.
        const shipped = buildContentSecurityPolicy({ allowDevServer: false });

        expect(shipped).not.toMatch(/wss?:\/\//u);
        expect(shipped).toContain("object-src 'none'");
        expect(buildContentSecurityPolicy({ allowDevServer: true })).toContain('ws://localhost:*');
    },
    'bridge-surface': () => {
        // Everything on the bridge is callable by anything in the renderer, so an uncalled method
        // is attack surface bought for nothing.
        expect(findUnusedBridgeMethods(['used'], ['desktopClient.used()'])).toEqual([]);
        expect(Object.keys(BRIDGE_EXEMPTIONS)).toEqual([]);
    },
    'store-reachability': () => {
        // The audit that would have caught a deleted toolbar taking a whole power with it.
        const members = readAppStateMembers(
            ['export interface AppState {', '    shown: string;', '    hidden: string;', '}'].join('\n')
        );

        expect(findUnreachableMembers(members, ['state.shown'])).toEqual([{ kind: 'state', name: 'hidden' }]);
        expect(Object.keys(REACHABILITY_EXEMPTIONS).length).toBeGreaterThan(0);
    },
    'test-only-modules': () => {
        // A module whose only importer is its own test is content nobody can reach; the audit
        // stays quiet about one a *different* module's test imports, which is a shared fixture.
        const sources: Record<string, string> = {
            'src/a.ts': '',
            'src/a.test.ts': "import { a } from './a';",
            'src/b.ts': '',
            'src/b.test.ts': "import { b } from './b';\nimport { a } from './a';"
        };
        const files = Object.keys(sources);
        const found = findTestOnlyModules(files, files, (file) => sources[file] ?? '');

        // `b` is imported only by its own test; `a` is also imported by b's test, so it is a
        // shared fixture rather than an orphan.
        expect(found.map((row) => row.file)).toEqual(['src/b.ts']);
        expect(Object.keys(TEST_ONLY_EXEMPTIONS).length).toBeGreaterThan(0);
    },
    'shared-reach': () => {
        // The walk starts at what ships; a module nothing on that path imports is not reached.
        const sources: Record<string, string> = {
            'src/entry.ts': "import { used } from './used';",
            'src/used.ts': '',
            'src/stranded.ts': ''
        };
        const files = Object.keys(sources);
        // The walk resolves paths against the working directory, so the stand-in reader is keyed
        // on the file name rather than on the relative path it was handed.
        const reached = reachableFromEntries(
            ['src/entry.ts'],
            files,
            (file) => sources[`src/${file.split('/').pop() ?? ''}`] ?? ''
        );

        expect([...reached].some((path) => path.endsWith('used.ts'))).toBe(true);
        expect([...reached].some((path) => path.endsWith('stranded.ts'))).toBe(false);
        expect(Object.keys(SHARED_REACH_EXEMPTIONS).length).toBeGreaterThan(0);
    },
    'save-field-policy': () => {
        // The failure this guards is the one I actually made: a persisted field added with no
        // policy, every gate green, and nothing able to say so because they are two lists.
        expect(findFieldsWithoutPolicy(['runHistory', 'newThing'], new Set(['runHistory']))).toEqual(['newThing']);
        expect(readPolicyRoots("field: 'runHistory.shareKey'").has('runHistory')).toBe(true);
        expect(Object.keys(SAVE_FIELD_POLICY_EXEMPTIONS).length).toBeGreaterThan(0);
    },
    'min-type-size': () => {
        // Both failures this guards were shipped: three declarations under the floor that the fit
        // contract never walked, and a `var()` naming a token defined nowhere, which does nothing
        // at all and leaves the text at whatever it inherited.
        const css = ['.kicker {', '    font-size: 0.7rem;', '}'].join('\n');
        const [tooSmall] = readTypeDeclarations('a.css', css);
        expect(tooSmall?.px).toBeLessThan(MIN_TYPE_PX);
        expect(findUndersized(readTypeDeclarations('a.css', css))).toHaveLength(1);
        expect(findUndersized(readTypeDeclarations('a.css', '.k {\n    font-size: 0.75rem;\n}'))).toEqual([]);

        const tokens = readFontTokens("'--ui-font-label': '0.75rem',");
        expect(resolveMinPx('var(--ui-font-label)', tokens)).toBe(MIN_TYPE_PX);
        expect(
            findUndefinedTokens(readTypeDeclarations('a.css', '.k {\n    font-size: var(--nope);\n}', tokens))
        ).toHaveLength(1);
    },
    'script-paths': () => {
        // A gate naming a renamed test file fails on its first line for anyone who runs it, and
        // nobody runs a standalone gate, so nothing else would ever say so.
        expect(findMissingScriptPaths({ 'gate:x': 'vitest run src/Gone.test.tsx' }, () => false)).toEqual([
            { path: 'src/Gone.test.tsx', script: 'gate:x' }
        ]);
        expect(findMissingScriptPaths({ 'gate:x': 'vitest run src/Here.test.tsx' }, () => true)).toEqual([]);
    },
    'audio-never-eats-a-press': () => {
        // Every click handler opens with a cue, so a throwing cue takes the press with it.
        expect(() =>
            audioNeverThrows(() => {
                throw new DOMException('AudioContext has been closed', 'InvalidStateError');
            })
        ).not.toThrow();
        expect(
            audioNeverThrowsBoolean(() => {
                throw new Error('decode failed');
            })
        ).toBe(false);
    },
    'run-history': () => {
        // A history that is normalized correctly and never written is the failure to guard here,
        // so the check is that a finished run produces a record and the cap holds.
        const run = createNewRun(0);
        const record = buildRunHistoryRecord(run, '2026-09-04T12:00:00.000Z');
        expect(record.mode).toBe('Classic Dungeon');
        expect(record.shareKey).toMatch(/^md1:classic:/u);

        const full = Array.from({ length: RUN_HISTORY_LIMIT }, () => record);
        const appended = appendRunHistory({ ...createDefaultSaveData(), runHistory: full }, record);
        expect(appended).toHaveLength(RUN_HISTORY_LIMIT);
        // Junk is dropped rather than costing the player their profile.
        expect(normalizeRunHistory(['nonsense', null, record])).toEqual([record]);
    },
    'reveal-save-file': () => {
        // Export, import and backup are all "copy the file yourself", which needs a way to find it.
        expect(DESKTOP_IPC_CHANNELS.revealSaveFile).toMatch(/\S/);
        expect(readFileSync(join(process.cwd(), 'src/main/ipc.ts'), 'utf8')).toContain('showItemInFolder');
    },
    'renderer-crash-visible': () => {
        // The process survives a render error, so `renderer_gone` never fires and nothing is
        // written; without a boundary the player just gets an empty window.
        expect(APP_ERROR_COPY.title).toMatch(/\S/);
        expect(APP_ERROR_COPY.action).toMatch(/\S/);
        expect(normalizeRendererErrorReport('nonsense').message.length).toBeGreaterThan(0);
        // Async failures too: the main process reported rejections long before the renderer did.
        expect(describeThrownValue(undefined).message.length).toBeGreaterThan(0);
        expect(RENDERER_ERROR_REPORT_LIMIT).toBeGreaterThan(0);
    },
    'save-read-recovery': () => {
        // A save the game refuses is usually a *newer* save arriving through Steam Cloud from a
        // beta build, so recovery keeps the file rather than deleting it.
        const kept: string[] = [];
        const result = quarantineSaveFile('/saves/memory-dungeon-save.json', '2026-09-03T20:45:12.884Z', {
            basename: (path) => path.slice(path.lastIndexOf('/') + 1),
            copy: (_from, to) => kept.push(to),
            dirname: (path) => path.slice(0, path.lastIndexOf('/')),
            exists: () => true,
            join: (...segments) => segments.join('/'),
            listDirectory: () => [],
            remove: () => undefined
        });

        expect(result.quarantinedAs).not.toBeNull();
        expect(kept).toHaveLength(1);
        expect(quarantineFileName('memory-dungeon-save.json', '2026-09-03T20:45:12.884Z')).not.toContain(':');
        // The notice the player reads has to name a way out, not just report the failure.
        expect(SAVE_RECOVERY_COPY.action).toMatch(/\S/);
    },
    'daily-determinism': () => {
        // Two players comparing scores over boards that quietly differed are not competing.
        const first = createDailyRun(0);
        const second = createDailyRun(0);

        expect(second.runSeed).toBe(first.runSeed);
        expect(second.board?.tiles.map((tile) => tile.pairKey)).toEqual(first.board?.tiles.map((tile) => tile.pairKey));
        expect(second.activeMutators).toEqual(first.activeMutators);
    },
    'partner-rows-derived': () => {
        const achievements = renderAchievementRows();

        // The overlay text and the Codex text come from one catalog, so they cannot disagree.
        for (const id of ACHIEVEMENT_IDS) {
            expect(achievements).toContain(STEAM_ACHIEVEMENT_API_NAME[id]);
        }
        expect(renderRichPresenceRows()).toContain(
            buildRichPresence({ floor: null, gameMode: null, inRun: false }).display
        );
    },
    'rich-presence': () => {
        const inRun = buildRichPresence({ floor: 7, gameMode: 'endless', inRun: true });
        expect(richPresencePairs(inRun).every(([, value]) => value !== undefined)).toBe(true);
        // Ending a run has to clear the keys, or friends keep seeing a floor nobody is on.
        expect(richPresencePairs(buildRichPresence({ floor: null, gameMode: null, inRun: false }))
            .some(([, value]) => value === null)).toBe(true);
    },
    'trait-second-channel': () => {
        const signatures = Object.values(TILE_TRAIT_MARKS).map((mark) => `${mark.count}:${mark.shape}`);
        // Nine traits, nine distinct marks: the shape alone has to identify the trait.
        expect(new Set(signatures).size).toBe(signatures.length);
        expect(describeTraitMark({ count: 2, shape: 'bar' })).toMatch(/\S/);
    },
    'window-state': () => {
        expect(MIN_WINDOW_WIDTH).toBeGreaterThan(0);
        expect(MIN_WINDOW_HEIGHT).toBeGreaterThan(0);
        const stored = normalizeWindowState({
            bounds: { height: 1200, width: 2000, x: 40, y: 40 },
            maximized: false
        });
        // The display shrank since last launch (undocked laptop): the window is clamped back onto
        // it rather than restored off-screen, and never below the size the HUD needs.
        const restored = resolveRestoredBounds(stored.bounds, [{ height: 800, width: 1280, x: 0, y: 0 }]);

        expect(restored?.width).toBeGreaterThanOrEqual(MIN_WINDOW_WIDTH);
        expect(restored?.height).toBeGreaterThanOrEqual(MIN_WINDOW_HEIGHT);
        expect(restored?.width).toBeLessThanOrEqual(1280);
        // Bounds too small to hold the HUD are discarded, not restored as a sliver.
        expect(normalizeWindowState({ bounds: { height: 200, width: 300, x: 0, y: 0 } }).bounds).toBeNull();
        // No display the window overlaps: the caller opens at the default size instead.
        expect(resolveRestoredBounds(stored.bounds, [])).toBeNull();
    }
};

describe('release checklist', () => {
    it('pairs every repository row with a check that re-proves it', () => {
        expect(releaseChecklistByOwner('repo').map((item) => item.id).sort()).toEqual(Object.keys(VERIFIERS).sort());
    });

    it('keeps every row identifiable and attributed', () => {
        const ids = RELEASE_CHECKLIST.map((item) => item.id);

        expect(new Set(ids).size).toBe(ids.length);
        for (const item of RELEASE_CHECKLIST) {
            expect(item.label).toMatch(/\S/);
            // A repo row points at the module that carries the claim; anything a person or a
            // decision owns has to say what doing it involves, or the row is not actionable.
            expect(item.owner === 'repo' ? item.evidence : item.note).toMatch(/\S/);
        }
    });

    it('still has the work nobody in the repository can do', () => {
        // If this ever reaches zero it means somebody marked Partner-site work done in a data file
        // rather than on the Partner site.
        expect(releaseChecklistByOwner('person').length).toBeGreaterThan(0);
    });

    for (const [id, verify] of Object.entries(VERIFIERS)) {
        it(`proves the "${id}" row is still true`, verify);
    }

    it('renders every row into the generated document', () => {
        const markdown = renderReleaseChecklistMarkdown();

        for (const item of RELEASE_CHECKLIST) {
            expect(markdown).toContain(item.label);
        }
        expect(markdown).toContain('# Release checklist');
    });
});
