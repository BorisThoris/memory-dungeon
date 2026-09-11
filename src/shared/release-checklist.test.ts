import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RELEASE_CHECKLIST, releaseChecklistByOwner, renderReleaseChecklistMarkdown } from './release-checklist';
import { RUNS_FINISHED_THRESHOLDS } from './achievements';
import { ACHIEVEMENT_IDS, createDefaultSaveData, mergeChainFloorStats, mergeRunsFinished } from './save-data';
import { createNewRun } from './game';
import { RUN_MODE_CATALOG } from './run-mode-catalog';
import {
    applyResolvedTurnToPassAndPlay,
    createPassAndPlayState,
    describePassAndPlayChainLost,
    PASS_AND_PLAY_MIN_SEATS,
    passAndPlaySeatCounts
} from './pass-and-play-rules';
import { createRunSummary } from './game-core';
import { buildRunShareText } from './run-share-text';
import { getQuestCampaignRows, QUEST_CAMPAIGN_LADDER } from './quest-campaign';
import { getSaveFieldPolicies } from './save-field-policy';
import { PASS_AND_PLAY_COPY } from '../renderer/copy/passAndPlay';
import { getSocialPlayScopeRows, SOCIAL_PLAY_SCOPE_DECISION } from './social-play-scope';
import { isPassAndPlayFinalFloor, PASS_AND_PLAY_FLOORS, resolvePassAndPlayOutcome } from './pass-and-play-rules';
import { labelsAreAmbiguous } from '../../scripts/control-label-ambiguity';
import { PLAYABLE_PATH_FIXTURE_IDS, createPlayablePathFixture } from './playable-path-fixtures';
import { resolveChunkBreak } from './chunk-break-rules';
import { CHAIN_REACTION_WAVES, evaluateAchievementUnlocks } from './achievements';
import { makeBoard, makeTile } from './test/game-fixtures';
import { assertCascadeBalanceWithinBands, runCascadeBalanceSimulation } from './cascade-balance-simulation';
import { DECLARED_SURFACES, findBrokenSurfaces, findUnvisitedSurfaces } from '../../scripts/e2e-surface-coverage';
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
    findUndefinedProperties,
    findUnreadProperties,
    readDefinedProperties,
    readVarUses
} from '../../scripts/css-custom-properties';
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
    'chain-chunk-fever': () => {
        // A generated floor: every tile has a suit and both halves of a pair share it.
        const generated = createNewRun(0, { gameMode: 'endless', runSeed: 42_001 }).board!;
        const suitByPair = new Map<string, string | undefined>();
        for (const tile of generated.tiles) {
            expect(tile.suit, `${tile.id} has no suit`).toBeDefined();
            const seen = suitByPair.get(tile.pairKey);
            if (seen !== undefined) {
                expect(tile.suit, `${tile.pairKey} halves disagree on suit`).toBe(seen);
            }
            suitByPair.set(tile.pairKey, tile.suit);
        }
        // The clumped board: a Fever chain on the first pair breaks its clump and the halo.
        const fixture = createPlayablePathFixture('cascadeClump').run!;
        const broken = resolveChunkBreak({ board: fixture.board!, run: fixture, matchedTileIds: ['em1-A', 'em1-B'], chain: 8 });
        expect(broken.tier).toBe('fever');
        expect(broken.brokenPairKeys.length).toBeGreaterThan(0);
    },
    'cascade-balance': () => {
        // Forty-eight seeds over twenty-four floors, matching `cascade-balance-simulation.test.ts`
        // and `sim:cascade` exactly. Three places used to check this row against three different
        // samples and could disagree about whether the game was in band; now there is one sample
        // and one answer. See that test's own comments for what the smaller ones were reading.
        const report = runCascadeBalanceSimulation({
            seeds: Array.from({ length: 48 }, (_unused, index) => 42_001 + index * 7_919),
            floors: Array.from({ length: 24 }, (_unused, index) => index + 1),
            missRates: [0, 0.1, 0.25]
        });
        expect(assertCascadeBalanceWithinBands(report).issues).toEqual([]);
        for (const band of report.bands) {
            expect(band.ratingDriftFloors, `miss ${band.missRate}`).toBe(0);
        }
    },
    'the-live-pop': () => {
        const rowTile = (id: string) => makeTile(id, id[0]!, id[0]!, { suit: 'ABCD'.includes(id[0]!) ? 'ember' : 'tide' });
        // One row of four whole ember pairs, then two tide pairs. Every card touches the next.
        const rowTiles = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2', 'T1', 'T2', 'S1', 'S2'].map(rowTile);
        const row = makeBoard(rowTiles, { columns: 12, rows: 1, level: 3 });
        const run = createNewRun(0, { gameMode: 'endless', runSeed: 7 });
        const lone = resolveChunkBreak({ board: row, run, matchedTileIds: ['A1', 'A2'], chain: 1 });
        expect(lone.wavePairKeys, 'a lone match walks two steps and takes what is touching').toEqual([['B']]);
        expect(lone.waves).toBe(1);
        const split = makeBoard(
            rowTiles.map((t) => (t.id === 'B2' ? rowTile('T1') : t.id === 'T1' ? rowTile('B2') : t)),
            { columns: 12, rows: 1, level: 3 }
        );
        const halfOut = resolveChunkBreak({ board: split, run, matchedTileIds: ['A1', 'A2'], chain: 3 });
        expect(halfOut.wavePairKeys.flat(), 'a pair with a half outside the wave is never reached').not.toContain('B');
        const clean = resolveChunkBreak({ board: row, run, matchedTileIds: ['A1', 'A2'], chain: 3 });
        expect(clean.wavePairKeys, 'Clean walks four steps: the same wave, twice as far').toEqual([['B', 'C']]);
        const sharp = resolveChunkBreak({ board: row, run, matchedTileIds: ['A1', 'A2'], chain: 4 });
        expect(sharp.wavePairKeys, 'Sharp runs the reaction on from where the wave stopped').toEqual([['B', 'C'], ['D']]);
        expect(sharp.board.tiles.find((t) => t.id === 'D2')?.brokenAtWave).toBe(1);
    },
    'the-drop': () => {
        const suit = (id: string) => (['A', 'B', 'C'].includes(id[0]!) ? 'ember' : 'tide');
        const tile = (id: string) => makeTile(id, id[0]!, id[0]!, { suit: suit(id) });
        const cutOff = [tile('A1'), tile('B1'), tile('D1'), tile('C1'), tile('A2'), tile('B2'), tile('E1'), tile('C2'), tile('D2'), tile('F1'), tile('E2'), tile('F2')];
        const board = makeBoard(cutOff, { columns: 4, rows: 3, level: 3 });
        const run = createNewRun(0, { gameMode: 'endless', runSeed: 7 });
        const clean = resolveChunkBreak({ board, run, matchedTileIds: ['A1', 'A2'], chain: 3 });
        expect(clean.droppedPairKeys, 'the cut-off pair drops at Clean').toEqual(['C']);
        const lone = resolveChunkBreak({ board, run, matchedTileIds: ['A1', 'A2'], chain: 1 });
        expect(lone.droppedPairKeys, 'and with no chain behind the match at all').toEqual(['C']);
    },
    'ripple-records': () => {
        const run = createNewRun(0, { gameMode: 'endless', runSeed: 7 });
        const rippled = createRunSummary({ ...run, bestRippleThisRun: 3, bestChainThisRun: 6 }, []);
        expect(rippled.lastRunSummary).toMatchObject({ bestRipple: 3 });
        expect(buildRunShareText(rippled).text, 'the run share posts the ripple').toContain('ripple ×3');
        // One wave is every match ever made; the line stays quiet about it.
        const popOnly = createRunSummary({ ...run, bestRippleThisRun: 1, bestChainThisRun: 2 }, []);
        expect(buildRunShareText(popOnly).text).not.toContain('ripple');
        expect(
            evaluateAchievementUnlocks({ ...run, bestRippleThisRun: CHAIN_REACTION_WAVES }, createDefaultSaveData()),
            'three waves earns Chain reaction'
        ).toContain('ACH_CHAIN_REACTION');
    },
    'chain-in-share-and-shared-play': () => {
        // The summary carries the chain's records, and both share strings read them.
        const run = createNewRun(0, { gameMode: 'endless', runSeed: 7 });
        const chained = createRunSummary({ ...run, bestChainThisRun: 9, sharpFloorsThisRun: 2, feverFloorsThisRun: 1 }, []);
        expect(chained.lastRunSummary).toMatchObject({ bestChain: 9, sharpFloors: 2, feverFloors: 1 });
        expect(buildRunShareText(chained).text).toContain('best chain ×9');
        // The quest reads a persisted counter that has a migration policy, and three Sharp floors complete it.
        const quest = QUEST_CAMPAIGN_LADDER.find((row) => row.id === 'chain_rhythm');
        expect(quest?.saveFields).toEqual(['playerStats.sharpFloors']);
        expect(getSaveFieldPolicies().map((policy) => policy.field)).toContain('playerStats.sharpFloors');
        let save = createDefaultSaveData();
        save.achievements.ACH_FIRST_CLEAR = true;
        for (let floor = 0; floor < 3; floor += 1) {
            save = mergeChainFloorStats(save, floor === 2 ? 'fever' : 'sharp');
        }
        expect(getQuestCampaignRows(save).find((row) => row.id === 'chain_rhythm')?.status).toBe('completed');
        // A shared table: the chunk is the seat's, and the handoff names the chain it ended.
        const broke = applyResolvedTurnToPassAndPlay(createPassAndPlayState(), {
            matched: true,
            scoreDelta: 300,
            chunkPairs: 3,
            chainAfter: 4
        });
        expect(broke.seats[0]).toMatchObject({ chunkPairs: 3, bestChain: 4 });
        const passed = applyResolvedTurnToPassAndPlay(broke, { matched: false, scoreDelta: 0 });
        const lost = describePassAndPlayChainLost(passed);
        expect(lost).toEqual({ label: 'Player 1', chain: 4 });
        expect(PASS_AND_PLAY_COPY.handoffAnnouncement('Player 2', lost)).toBe("Player 1's chain of 4 ends. Player 2's turn.");
    },
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
    'board-chrome-clearance': () => {
        /*
         * The hook that measures the chrome named two CSS-module classes; the bar and the dock
         * moved to another module and it published a clearance of zero every frame, read by no
         * stylesheet at all, while the trap toast sat on the score. So: it finds the chrome by
         * test id, it does not write a clearance it could not measure, and the overlays read it.
         */
        const hook = readFileSync('src/renderer/hooks/useGameplayChromeClearance.ts', 'utf8');
        expect(hook).toContain('data-testid=');
        expect(hook).toContain('removeProperty');
        expect(hook).not.toContain('hudClassName');

        const board = readFileSync('src/renderer/components/TileBoard.module.css', 'utf8');
        expect(board).toContain('var(--gameplay-hud-top-clearance');
        expect(board).toContain('var(--gameplay-dock-bottom-clearance');
    },
    'board-controls-answer': () => {
        /*
         * Reachable and responsive are different, and both were wrong this week: a browse card
         * that hit-tested fine and did nothing, and Undo sitting lit while dropping every press.
         * The gate presses each tool and clicks the board; the dock takes its enabled state from
         * the same rule the action applies.
         */
        const gate = readFileSync('e2e/ui-reachability-gate.spec.ts', 'utf8');
        expect(gate).toContain('the board tools answer a press');
        expect(gate).toContain('a pointer click on the board flips a tile');
        expect(gate).toContain('every dock tool answers a press');

        const screen = readFileSync('src/renderer/components/GameScreen.tsx', 'utf8');
        // Undo is live only while a pair resolves, which is the rule its action already applies.
        expect(screen).toContain("disabled: run.status !== 'resolving'");
        expect(screen).toContain('RUN_TOOL_REASONS.undo.notResolving');
    },
    'ui-reachability': () => {
        /*
         * The rule itself needs a browser — a click's centre point and what is painted there are
         * layout, and there is no layout in this suite — so the gate proves it and this proves the
         * gate is wired. That pairing is the point: the fit sweep asked this question too, and took
         * half an hour, so nobody ran it and a browse grid nothing could click reached the Steam
         * Deck's own panel.
         */
        const pkg = readFileSync('package.json', 'utf8');
        expect(pkg).toContain('"gate:ui-reachability"');
        expect(pkg.slice(pkg.indexOf('"fullcheck"'), pkg.indexOf('"fullcheck"') + 400)).toContain('gate:ui-reachability');

        const helper = readFileSync('e2e/uiReachability.ts', 'utf8');
        expect(helper).toContain('export const findUnreachableControls');
        // Two readings intersected, so a relayout in flight is not reported as a dead button.
        expect(helper).toContain('export const readUnreachableControls');
        expect(readFileSync('e2e/ui-reachability-gate.spec.ts', 'utf8')).toContain('findUnreachableControls');
    },
    'css-custom-properties': () => {
        /*
         * Both halves shipped. A hook measured the HUD every frame and wrote a clearance no rule
         * read, so the board overlays went back to sitting on the chrome. And three declarations
         * named a colour token nothing defined, which invalidated them outright — the score
         * floater's top tier lost its border, its background and both of its glows.
         */
        const runtimeWrite = readDefinedProperties('h.ts', "el.style.setProperty('--clearance', '4px');");
        expect(runtimeWrite[0]).toMatchObject({ property: '--clearance', runtime: true });
        expect(findUnreadProperties(runtimeWrite, []).map((row) => row.property)).toEqual(['--clearance']);
        expect(findUnreadProperties(runtimeWrite, readVarUses('a.css', 'top: var(--clearance);'))).toEqual([]);

        const read = readVarUses('a.css', 'color: var(--theme-magenta-bright);');
        expect(findUndefinedProperties([], read).map((row) => row.property)).toEqual(['--theme-magenta-bright']);
        expect(findUndefinedProperties(readDefinedProperties('t.ts', "'--theme-magenta-bright': '#f0b6e4',"), read)).toEqual([]);
        // A read with its own fallback still renders, so it is not a break.
        expect(findUndefinedProperties([], readVarUses('a.css', 'top: var(--gone, 4px);'))).toEqual([]);
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
    'pass-and-play': () => {
        // The mode is on the catalog, every seat count it allows can be started, and the turn rule
        // is the one the card describes: a match keeps the device, a miss passes it.
        const mode = RUN_MODE_CATALOG.find((row) => row.id === 'pass_and_play');
        expect(mode?.availability).toBe('available');
        expect(mode?.action).toEqual({ type: 'startPassAndPlayRun', seats: PASS_AND_PLAY_MIN_SEATS });

        expect(passAndPlaySeatCounts().length).toBeGreaterThan(1);
        for (const seats of passAndPlaySeatCounts()) {
            expect(createNewRun(0, { passAndPlaySeats: seats }).passAndPlay?.seats).toHaveLength(seats);
        }

        const opening = createPassAndPlayState();
        const afterMatch = applyResolvedTurnToPassAndPlay(opening, { matched: true, scoreDelta: 100 });
        expect(afterMatch.activeSeatIndex, 'a match keeps the device').toBe(0);
        const afterMiss = applyResolvedTurnToPassAndPlay(afterMatch, { matched: false, scoreDelta: 0 });
        expect(afterMiss.activeSeatIndex, 'a miss passes it').toBe(1);
        expect(afterMiss.handoffPending, 'and says so').toBe(true);

        expect(getSocialPlayScopeRows().find((row) => row.id === 'pass_and_play')?.status).toBe('shipped');
    },
    'pass-and-play-length': () => {
        // A solo run is endless; a shared game is a contest of a stated length. The rule has to be
        // a real number the mode card states, and clearing that floor has to end the run.
        expect(PASS_AND_PLAY_FLOORS).toBeGreaterThan(1);
        expect(isPassAndPlayFinalFloor(PASS_AND_PLAY_FLOORS)).toBe(true);
        expect(isPassAndPlayFinalFloor(PASS_AND_PLAY_FLOORS - 1)).toBe(false);

        const mode = RUN_MODE_CATALOG.find((row) => row.id === 'pass_and_play');
        expect(mode?.shortDescription, 'the card states the length before anyone starts').toContain(
            String(PASS_AND_PLAY_FLOORS)
        );

        // And the standings are what decides it, including a draw reported as a draw.
        let table = createPassAndPlayState(2);
        table = applyResolvedTurnToPassAndPlay(table, { matched: true, scoreDelta: 200 });
        table = applyResolvedTurnToPassAndPlay(table, { matched: false, scoreDelta: 0 });
        table = applyResolvedTurnToPassAndPlay(table, { matched: true, scoreDelta: 200 });
        expect(resolvePassAndPlayOutcome(table).tied).toBe(true);
    },
    'surface-coverage': () => {
        // The in-floor vendor was a whole screen nothing rendered, and it hid a Deck button no
        // click could reach. The vendor went in Gen 174; the census still counts surfaces, not
        // views, so a second state of one view still needs its own fixture.
        expect(findBrokenSurfaces()).toEqual([]);
        expect(findUnvisitedSurfaces(readFileSync(join(process.cwd(), 'e2e/ui-reachability-gate.spec.ts'), 'utf8')
            + PLAYABLE_PATH_FIXTURE_IDS.join(' '))).toEqual([]);
        expect(DECLARED_SURFACES.length).toBeGreaterThan(0);
    },
    'no-duplicate-controls': () => {
        // The vendor shipped "Back to board" and "Return to board" together, running the same
        // action, with a test asserting both existed.
        expect(labelsAreAmbiguous('Back to board', 'Return to board')).toBe(true);
        expect(labelsAreAmbiguous('Back to board', 'Back to floor summary')).toBe(false);
    },
    'repeat-play-instrumented': () => {
        /*
         * The rungs are the one comparable curve's spacing (`docs/MARKET_SURVEY.md` §3): 5, 10, 25,
         * 50, 100. What makes this row worth re-proving is the counter behind them - the run
         * history holds twenty entries, so anything derived from it would leave the last two rungs
         * dead, and only a field of its own can count to a hundred.
         */
        expect(RUNS_FINISHED_THRESHOLDS.map(([, threshold]) => threshold)).toEqual([5, 10, 25, 50, 100]);
        expect(RUNS_FINISHED_THRESHOLDS.every(([id]) => ACHIEVEMENT_IDS.includes(id))).toBe(true);
        let save = createDefaultSaveData();
        for (let run = 0; run < RUN_HISTORY_LIMIT + 5; run += 1) {
            save = mergeRunsFinished(save);
        }
        expect(save.playerStats?.runsFinished).toBe(RUN_HISTORY_LIMIT + 5);
        expect(save.playerStats?.runsFinished).toBeGreaterThan(RUN_HISTORY_LIMIT);
        // Every rung has a Steam API name, or it cannot be read off the dashboard after launch.
        for (const [id] of RUNS_FINISHED_THRESHOLDS) {
            expect(STEAM_ACHIEVEMENT_API_NAME[id], `${id} API name`).toBe(id);
        }
    },
    'shared-game-not-recorded': () => {
        // Nothing about a shared game reaches the save: achievements are off at creation, and the
        // scope decision still persists no multiplayer field at all.
        expect(createNewRun(0, { passAndPlaySeats: 2 }).achievementsEnabled).toBe(false);
        expect(createNewRun(0).achievementsEnabled).toBe(true);
        expect(SOCIAL_PLAY_SCOPE_DECISION.persistedMultiplayerFields).toEqual([]);
        expect(SOCIAL_PLAY_SCOPE_DECISION.onlineRequiresReg052).toBe(true);
        // The guard itself, named where it lives, so deleting it fails this row rather than a
        // screen quietly starting to record shared games.
        expect(readFileSync(join(process.cwd(), 'src/renderer/store/runResolutionController.ts'), 'utf8')).toContain(
            'const sharedTable = isPassAndPlayRun('
        );
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

    /*
     * A minute, not the default ten seconds. The cascade row replays forty-eight seeds of the
     * balance simulation, six seconds on an idle machine and more than ten under the full suite's
     * load, and a verifier that fails on the machine's timing rather than the game's is noise.
     */
    for (const [id, verify] of Object.entries(VERIFIERS)) {
        it(`proves the "${id}" row is still true`, verify, 60_000);
    }

    it('renders every row into the generated document', () => {
        const markdown = renderReleaseChecklistMarkdown();

        for (const item of RELEASE_CHECKLIST) {
            expect(markdown).toContain(item.label);
        }
        expect(markdown).toContain('# Release checklist');
    });
});
