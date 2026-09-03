import { describe, expect, it } from 'vitest';
import { RELEASE_CHECKLIST, releaseChecklistByOwner, renderReleaseChecklistMarkdown } from './release-checklist';
import { ACHIEVEMENT_IDS } from './save-data';
import { STEAM_ACHIEVEMENT_API_NAME } from './steam-achievement-api-names';
import { buildRichPresence, richPresencePairs } from './rich-presence';
import { STEAM_CLOUD_RULES, SAVE_FILE_NAME } from './save-location';
import { TILE_TRAIT_MARKS, describeTraitMark } from './tile-trait-marks';
import { GAMEPAD_STICK_DEADZONE, readGamepadActions, STANDARD_GAMEPAD_BUTTONS } from './gamepad-input';
import { MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH, normalizeWindowState, resolveRestoredBounds } from '../main/window-bounds';
import { CRASH_LOG_KEEP_COUNT, pruneCrashLogs, redactUserPaths } from '../main/crash-log';

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
