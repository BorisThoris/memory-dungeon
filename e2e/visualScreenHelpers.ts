import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';
import { SAVE_SCHEMA_VERSION } from '../src/shared/contracts';
import {
    flipTileAtGridCellKeyboard,
    readFrameHiddenTileCount,
    STORAGE_KEY,
    waitForBoardPlayPhase
} from './tileBoardGameFlow';
import { readMemorizeSnapshot, type MemorizePairPositions } from './memorizeSnapshot';
import { dismissStartupIntro } from './startupIntroHelpers';

const MATCH_SETTLE_MS = 950;

type PairClickSettlement = 'floor_cleared' | 'four_hidden' | 'two_hidden';

/**
 * After two hidden tiles are clicked, the DOM can lag flip-back / match removal (especially under load).
 * Prefer polling over a single `MATCH_SETTLE_MS` sleep to avoid racing hidden-tile counts.
 */
async function settleAfterHiddenPairClick(page: Page, timeoutMs = 18_000): Promise<PairClickSettlement> {
    const deadline = Date.now() + timeoutMs;
    const floorCleared = page.getByRole('dialog', { name: /floor cleared/i });

    /** On a mismatch, brief `hidden === 2` is transient (tiles revealed) before flip-back to four hidden. After a legal match clearing two tiles on a small board, `hidden === 2` can stay stable (two cards remain). Wait out the transient before treating as accidental match downstate. */
    const settleTransientTwoHiddenMs = 5_000;

    while (Date.now() < deadline) {
        if (await floorCleared.isVisible().catch(() => false)) {
            return 'floor_cleared';
        }
        const hidden = await readFrameHiddenTileCount(page);
        if (hidden === 4) {
            return 'four_hidden';
        }
        if (hidden === 2) {
            const innerDeadline = Math.min(Date.now() + settleTransientTwoHiddenMs, deadline);
            while (Date.now() < innerDeadline) {
                if (await floorCleared.isVisible().catch(() => false)) {
                    return 'floor_cleared';
                }
                const h = await readFrameHiddenTileCount(page);
                if (h === 4) {
                    return 'four_hidden';
                }
                if (h !== 2) {
                    break;
                }
                await page.waitForTimeout(80);
            }
            const finalHidden = await readFrameHiddenTileCount(page);
            if (finalHidden === 4) {
                return 'four_hidden';
            }
            return 'two_hidden';
        }
        await page.waitForTimeout(80);
    }
    const hidden = await readFrameHiddenTileCount(page);
    throw new Error(`timeout settling after hidden pair click (hidden=${hidden})`);
}

async function settleAfterMismatchBurnClick(page: Page, timeoutMs = 22_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    const expeditionOver = page.getByText(/Expedition Over/i);
    while (Date.now() < deadline) {
        if (await expeditionOver.isVisible().catch(() => false)) {
            return;
        }
        const hidden = await readFrameHiddenTileCount(page);
        if (hidden === 4) {
            return;
        }
        await page.waitForTimeout(80);
    }
    throw new Error('timeout waiting for game over or four hidden tiles after mismatch');
}

export type VisualOrientation = 'portrait' | 'landscape';

/** `id` is used in test titles; captures go to `{root}/{deviceId}/{orientation}/`. */
export type VisualViewport = {
    deviceId: string;
    height: number;
    id: string;
    orientation: VisualOrientation;
    width: number;
};

export function getVisualCaptureRoot(): string {
    const override = process.env.VISUAL_CAPTURE_ROOT?.trim();
    if (override) {
        return resolve(process.cwd(), override);
    }
    return join(process.cwd(), 'test-results', 'visual-screens');
}

export const MOBILE_VISUAL_VIEWPORTS: ReadonlyArray<VisualViewport> = [
    { deviceId: 'mobile', height: 844, id: 'mobile-portrait', orientation: 'portrait', width: 390 },
    { deviceId: 'mobile', height: 390, id: 'mobile-landscape', orientation: 'landscape', width: 844 }
];

export const STANDARD_VISUAL_VIEWPORTS: ReadonlyArray<VisualViewport> = [
    { deviceId: 'tablet', height: 1180, id: 'tablet-portrait', orientation: 'portrait', width: 820 },
    { deviceId: 'desktop', height: 900, id: 'desktop-landscape', orientation: 'landscape', width: 1440 }
];

export const buildVisualSaveJson = (onboardingDismissed: boolean, reduceMotion = true): string =>
    JSON.stringify({
        schemaVersion: SAVE_SCHEMA_VERSION,
        bestScore: 0,
        achievements: {
            ACH_FIRST_CLEAR: false,
            ACH_LEVEL_FIVE: false,
            ACH_SCORE_THOUSAND: false,
            ACH_PERFECT_CLEAR: false,
            ACH_LAST_LIFE: false
        },
        settings: {
            masterVolume: 0.8,
            musicVolume: 0.55,
            sfxVolume: 0.8,
            displayMode: 'windowed',
            uiScale: 1,
            reduceMotion,
            debugFlags: {
                showDebugTools: false,
                allowBoardReveal: false,
                disableAchievementsOnDebug: true
            }
        },
        onboardingDismissed,
        lastRunSummary: null,
        powersFtueSeen: true
    });

export const buildFreshProfileSaveJson = (reduceMotion = true): string =>
    JSON.stringify({
        schemaVersion: SAVE_SCHEMA_VERSION,
        bestScore: 0,
        achievements: {
            ACH_FIRST_CLEAR: false,
            ACH_LEVEL_FIVE: false,
            ACH_SCORE_THOUSAND: false,
            ACH_PERFECT_CLEAR: false,
            ACH_LAST_LIFE: false
        },
        settings: {
            masterVolume: 0.8,
            musicVolume: 0.55,
            sfxVolume: 0.8,
            displayMode: 'windowed',
            uiScale: 1,
            reduceMotion,
            debugFlags: {
                showDebugTools: false,
                allowBoardReveal: false,
                disableAchievementsOnDebug: true
            }
        },
        onboardingDismissed: false,
        lastRunSummary: null,
        powersFtueSeen: false
    });

/**
 * Save JSON for Playwright captures of matched rim fire: `graphicsQuality: high` (shader on; hidden on low)
 * and motion enabled so the flame animates in screenshots.
 */
export const buildMatchedFlameCaptureSaveJson = (): string =>
    JSON.stringify({
        schemaVersion: SAVE_SCHEMA_VERSION,
        bestScore: 0,
        achievements: {
            ACH_FIRST_CLEAR: false,
            ACH_LEVEL_FIVE: false,
            ACH_SCORE_THOUSAND: false,
            ACH_PERFECT_CLEAR: false,
            ACH_LAST_LIFE: false
        },
        settings: {
            masterVolume: 0.8,
            musicVolume: 0.55,
            sfxVolume: 0.8,
            displayMode: 'windowed',
            uiScale: 1,
            reduceMotion: false,
            graphicsQuality: 'high',
            debugFlags: {
                showDebugTools: false,
                allowBoardReveal: false,
                disableAchievementsOnDebug: true
            }
        },
        onboardingDismissed: true,
        lastRunSummary: null,
        powersFtueSeen: true
    });

export function visualCaptureDir(deviceId: string, orientation: VisualOrientation): string {
    const dir = join(getVisualCaptureRoot(), deviceId, orientation);
    mkdirSync(dir, { recursive: true });
    return dir;
}

export async function captureVisualScreen(
    page: Page,
    deviceId: string,
    orientation: VisualOrientation,
    baseName: string
): Promise<void> {
    const dir = visualCaptureDir(deviceId, orientation);
    await page.screenshot({ path: join(dir, `${baseName}.png`), fullPage: true });
}

/** No unintended horizontal page scroll on the root (common mobile breakage). */
/** App shell must not use vertical document scroll (native-app / game shell). */
/**
 * Ensures the element’s bounding box lies fully inside the window layout viewport
 * (catches clipping inside nested overflow:hidden that does not affect [data-app-scrollport] scrollHeight).
 */
export async function expectLocatorFullyInWindowViewport(_page: Page, locator: Locator, epsilon = 6): Promise<void> {
    const box = await locator.evaluate((element, eps) => {
        const r = element.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        return {
            bottom: r.bottom,
            eps,
            left: r.left,
            right: r.right,
            top: r.top,
            vh,
            vw
        };
    }, epsilon);
    expect(
        box.top >= -box.eps && box.left >= -box.eps && box.right <= box.vw + box.eps && box.bottom <= box.vh + box.eps,
        `expected locator in window viewport; got top=${box.top} left=${box.left} right=${box.right} bottom=${box.bottom} for ${box.vw}x${box.vh}`
    ).toBeTruthy();
}

export async function expectAppScrollportHasNoVerticalOverflow(page: Page, epsilon = 10): Promise<void> {
    const { scrollHeight, clientHeight } = await page.locator('[data-app-scrollport]').evaluate((el) => ({
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight
    }));
    expect(
        scrollHeight,
        `app scrollport scrollHeight ${scrollHeight} should fit clientHeight ${clientHeight} (no page scroll)`
    ).toBeLessThanOrEqual(clientHeight + epsilon);
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
    }));
    expect(
        scrollWidth,
        `document scrollWidth ${scrollWidth} should not exceed clientWidth ${clientWidth} by more than 1px`
    ).toBeLessThanOrEqual(clientWidth + 1);
}

export async function expectMinimumTargetSize(
    locator: Locator,
    minWidth = 44,
    minHeight = 44
): Promise<void> {
    /**
     * Use layout box (`offset*`), not `getBoundingClientRect()`, so shells that apply CSS `zoom`
     * for viewport fit (e.g. MainMenu `useFitShellZoom`) do not shrink the asserted size — the
     * design system still assigns ≥44px min-height on controls; zoom is a separate fit pass.
     */
    const box = await locator.evaluate((element) => {
        const el = element as HTMLElement;
        return { height: el.offsetHeight, width: el.offsetWidth };
    });
    expect(box.width, `target width ${box.width} should be at least ${minWidth}px`).toBeGreaterThanOrEqual(minWidth);
    expect(box.height, `target height ${box.height} should be at least ${minHeight}px`).toBeGreaterThanOrEqual(minHeight);
}

/** Main menu CTA — scope avoids accidental matches if another "Play" appears elsewhere in the tree. */
export function mainMenuPlayButton(page: Page) {
    return page.getByRole('group', { name: /primary actions/i }).getByRole('button', { name: /^play$/i });
}

export async function openChooseYourPath(page: Page): Promise<void> {
    const chooseYourPath = page.getByRole('region', { name: /choose your path/i });
    if (await chooseYourPath.isVisible().catch(() => false)) {
        return;
    }
    await expect(async () => {
        const playButton = mainMenuPlayButton(page);
        await expect(playButton).toBeVisible({ timeout: 5_000 });
        await expect(playButton).toBeEnabled({ timeout: 5_000 });
        await playButton.click({ force: true, timeout: 10_000 });
        if (!(await chooseYourPath.isVisible().catch(() => false))) {
            await playButton.evaluate((el) => (el as HTMLButtonElement).click());
        }
        await expect(chooseYourPath).toBeVisible({ timeout: 10_000 });
    }).toPass({ timeout: 30_000 });
}

export async function ensureModeLibraryVisible(page: Page): Promise<void> {
    const library = page.getByRole('region', { name: /browse modes/i });
    if (await library.isVisible().catch(() => false)) {
        return;
    }
    await page.getByRole('button', { name: /browse modes/i }).click();
    await expect(library).toBeVisible();
}

export async function gotoWithSave(page: Page, saveJson: string): Promise<void> {
    await page.addInitScript(
        ([key, json]) => {
            localStorage.setItem(key, json);
        },
        [STORAGE_KEY, saveJson]
    );
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 90_000 });
}

/** Seed the same visual save JSON as `gotoWithSave`, then open `/?{queryString}`. */
export async function gotoWithSaveAndQuery(page: Page, saveJson: string, queryString: string): Promise<void> {
    const qs = queryString.startsWith('?') ? queryString.slice(1) : queryString;
    await page.addInitScript(
        ([key, json]) => {
            localStorage.setItem(key, json);
        },
        [STORAGE_KEY, saveJson]
    );
    await page.goto(`/?${qs}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
}

/** Output folder for HUD/board crops vs `docs/ENDPRODUCTIMAGE.png` (see `capture:endproduct-parity`). */
export function getEndproductParityCaptureDir(): string {
    const root = process.env.VISUAL_CAPTURE_ROOT?.trim()
        ? resolve(process.cwd(), process.env.VISUAL_CAPTURE_ROOT.trim())
        : join(process.cwd(), 'test-results', 'endproduct-parity');
    mkdirSync(root, { recursive: true });
    return root;
}

/** Sizes + computed min-height for HUD layout debugging (see `e2e/hud-inspect.spec.ts`). */
export type HudLayoutMetricsEntry = {
    className: string;
    clientHeight: number;
    maxHeight: string;
    minHeight: string;
    offsetHeight: number;
    scrollHeight: number;
    tagName: string;
    testId: string;
};

/**
 * Full-page + HUD element screenshots, bounding metrics for HUD wings, raw `outerHTML` of `game-hud`,
 * and JSON under `outDir` (defaults to endproduct parity dir).
 */
export async function writeHudLayoutDiagnostics(page: Page, outDir: string): Promise<void> {
    mkdirSync(outDir, { recursive: true });
    await page.screenshot({ path: join(outDir, 'hud-context-fullpage.png'), fullPage: true });
    const hud = page.getByTestId('game-hud');
    await hud.screenshot({ path: join(outDir, 'hud-element.png') });

    const testIds = ['game-hud', 'hud-wing-left', 'hud-wing-center', 'hud-wing-right'] as const;
    const elements: HudLayoutMetricsEntry[] = [];
    for (const id of testIds) {
        const loc = page.getByTestId(id);
        const entry = await loc.evaluate((el) => {
            const cs = getComputedStyle(el);
            return {
                className: typeof el.className === 'string' ? el.className : '',
                clientHeight: el.clientHeight,
                maxHeight: cs.maxHeight,
                minHeight: cs.minHeight,
                offsetHeight: el.offsetHeight,
                scrollHeight: el.scrollHeight,
                tagName: el.tagName,
                testId: el.getAttribute('data-testid') ?? ''
            };
        });
        elements.push(entry);
    }

    const viewport = page.viewportSize();
    /* Combined `playwright test a.spec b.spec` runs can recreate `test-results/` between screenshots and JSON writes. */
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
        join(outDir, 'hud-metrics.json'),
        JSON.stringify(
            {
                capturedAt: new Date().toISOString(),
                elements,
                viewport
            },
            null,
            2
        ),
        'utf8'
    );

    const outerHtml = await hud.evaluate((el) => el.outerHTML);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'hud-fragment.html'), outerHtml, 'utf8');
}

/**
 * Seeds localStorage, navigates home, then waits for the startup intro dialog.
 * Navigation completes first so React can mount the overlay; the locator wait catches visibility
 * without racing a parallel `goto` completion.
 */
export async function gotoWithSaveExpectStartupIntroVisible(page: Page, saveJson: string): Promise<void> {
    await page.addInitScript(
        ([key, json]) => {
            localStorage.setItem(key, json);
        },
        [STORAGE_KEY, saveJson]
    );
    const intro = page.getByRole('dialog', { name: /startup relic intro/i });
    await page.goto('/', { waitUntil: 'load', timeout: 90_000 });
    await intro.waitFor({ state: 'visible', timeout: 90_000 });
}

export async function openMainMenuFromSave(page: Page, onboardingDismissed: boolean): Promise<void> {
    await gotoWithSave(page, buildVisualSaveJson(onboardingDismissed));
    await dismissStartupIntro(page);
    await expect(mainMenuPlayButton(page)).toBeVisible();
}

export async function startClassicRunFromModeSelect(page: Page): Promise<void> {
    const recommended = page.getByRole('region', { name: /recommended run/i });
    const recommendedClassic = recommended.getByRole('heading', { name: /^classic run$/i });
    if (await recommendedClassic.isVisible().catch(() => false)) {
        const classicBtn = recommended.getByRole('button', { name: /start run/i });
        await expect(classicBtn).toBeVisible({ timeout: 15_000 });
        await classicBtn.scrollIntoViewIfNeeded();
        // Long serial visual runs against Vite can see `element was detached` / stability timeouts on animated cards.
        await classicBtn.click({ force: true });
    } else {
        await ensureModeLibraryVisible(page);
        const search = page.getByRole('searchbox', { name: /filter modes/i });
        if (await search.isVisible().catch(() => false)) {
            await search.fill('Classic Run');
        }
        const classicTile = page.getByRole('button', { name: /^Classic Run\. Open details\.$/i });
        await expect(classicTile).toBeVisible({ timeout: 15_000 });
        await classicTile.click({ force: true });
        const modal = page.getByTestId('library-mode-detail-modal');
        await expect(modal).toBeVisible({ timeout: 15_000 });
        await modal.getByRole('button', { name: /^play$/i }).click();
    }
    // GameScreen level title is `srOnly` (screen-reader-only); visible checks time out on narrow viewports.
    await expect(page.getByRole('heading', { name: /level \d+/i })).toBeAttached({ timeout: 15000 });
    await expect(page.getByRole('group', { name: /run stats/i })).toBeVisible({ timeout: 15000 });
}

export async function openLevel1Play(page: Page): Promise<void> {
    await openMainMenuFromSave(page, true);
    await openChooseYourPath(page);
    await startClassicRunFromModeSelect(page);
}

export async function openLevel1PlayWithSave(page: Page, saveJson: string): Promise<void> {
    await gotoWithSave(page, saveJson);
    await dismissStartupIntro(page);
    await mainMenuPlayButton(page).click({ force: true });
    await expect(page.getByRole('region', { name: /choose your path/i })).toBeVisible();
    await startClassicRunFromModeSelect(page);
}

type PairPositions = MemorizePairPositions;

async function getHiddenTilePositions(page: Page): Promise<{ row: number; col: number }[]> {
    const raw = await page.getByTestId('tile-board-frame').getAttribute('data-hidden-slots');
    if (!raw) {
        return [];
    }
    return raw
        .split(';')
        .filter(Boolean)
        .map((part) => {
            const [r, c] = part.split(',').map((x) => Number.parseInt(x, 10));
            return { row: r, col: c };
        })
        .sort((a, b) => a.row - b.row || a.col - b.col);
}

function pairKey(a: { row: number; col: number }, b: { row: number; col: number }): string {
    const s = [
        `${a.row},${a.col}`,
        `${b.row},${b.col}`
    ].sort();
    return `${s[0]}|${s[1]}`;
}

async function completeLevel1ByTryingHiddenPairs(page: Page): Promise<void> {
    await page.getByTestId('tile-board-application').focus();
    const tried = new Set<string>();
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
        if (await page.getByRole('dialog', { name: /floor cleared/i }).isVisible().catch(() => false)) {
            return;
        }
        if (await proceedThroughUnlockedExitIfVisible(page)) {
            return;
        }
        if (await revealLoneExitIfPresent(page)) {
            return;
        }
        const positions = await getHiddenTilePositions(page);
        if (positions.length < 2) {
            await page.waitForTimeout(120);
            continue;
        }
        let clicked = false;
        for (let i = 0; i < positions.length && !clicked; i += 1) {
            for (let j = i + 1; j < positions.length; j += 1) {
                const pk = pairKey(positions[i]!, positions[j]!);
                if (tried.has(pk)) {
                    continue;
                }
                await clickHiddenTile(page, positions[i]!.row, positions[i]!.col);
                await clickHiddenTile(page, positions[j]!.row, positions[j]!.col);
                let settled: PairClickSettlement;
                try {
                    settled = await settleAfterHiddenPairClick(page, 45_000);
                } catch {
                    tried.add(pk);
                    await page.waitForTimeout(MATCH_SETTLE_MS);
                    clicked = true;
                    break;
                }
                tried.add(pk);
                if (settled === 'floor_cleared') {
                    return;
                }
                if (await proceedThroughUnlockedExitIfVisible(page)) {
                    return;
                }
                clicked = true;
                break;
            }
        }
        if (!clicked) {
            await page.waitForTimeout(120);
        }
    }
    await expect(page.getByRole('dialog', { name: /floor cleared/i })).toBeVisible({ timeout: 30_000 });
}

/** Poll hidden-tile count only (run may be `playing`, `resolving`, or briefly `paused` — do not require `playing` here). */
export async function waitForPlayPhaseHiddenTiles(page: Page, expected: number): Promise<void> {
    await expect.poll(async () => readFrameHiddenTileCount(page), { timeout: 15000 }).toBe(expected);
}

async function waitForPlayingAndHiddenCount(page: Page, expectedMinimum: number): Promise<void> {
    await waitForBoardPlayPhase(page);
    await expect.poll(async () => readFrameHiddenTileCount(page), { timeout: 15000 }).toBeGreaterThanOrEqual(expectedMinimum);
}

/** Visual captures only need a playable board; dungeon objective cards can add non-pair hidden slots. */
export async function waitLevel1VisualReady(page: Page): Promise<void> {
    await waitForBoardPlayPhase(page);
    await expect.poll(async () => readFrameHiddenTileCount(page), { timeout: 15000 }).toBeGreaterThanOrEqual(4);
}

async function clickHiddenTile(page: Page, row: number, col: number): Promise<void> {
    await flipTileAtGridCellKeyboard(page, row, col);
}

async function proceedThroughUnlockedExitIfVisible(page: Page): Promise<boolean> {
    const exitDialog = page.getByRole('dialog', { name: /unlocked exit/i });
    if (!(await exitDialog.isVisible().catch(() => false))) {
        return false;
    }
    await exitDialog.getByRole('button', { name: /^proceed$/i }).click();
    await expect(page.getByRole('dialog', { name: /floor cleared/i })).toBeVisible({ timeout: 15_000 });
    return true;
}

async function revealLoneExitIfPresent(page: Page): Promise<boolean> {
    if (await proceedThroughUnlockedExitIfVisible(page)) {
        return true;
    }

    const positions = await getHiddenTilePositions(page);
    if (positions.length !== 1) {
        return false;
    }

    await clickHiddenTile(page, positions[0]!.row, positions[0]!.col);
    await expect(page.getByRole('dialog', { name: /unlocked exit/i })).toBeVisible({ timeout: 15_000 });
    return proceedThroughUnlockedExitIfVisible(page);
}

/**
 * Level 1: wait for play phase (memory pairs plus any required objective cards). Captures memorize map when possible; otherwise returns null
 * and callers should use `completeLevel1Play`.
 */
export async function waitLevel1PlayReady(page: Page): Promise<PairPositions | null> {
    let lastMemorizeSnap: PairPositions | null = null;
    const deadline = Date.now() + 40_000;
    while (Date.now() < deadline) {
        const snap = await readMemorizeSnapshot(page);
        if (snap && Object.keys(snap).length >= 2) {
            lastMemorizeSnap = snap;
        }
        const hidden = await readFrameHiddenTileCount(page);
        const runStatus = await page.getByTestId('tile-board-frame').getAttribute('data-board-run-status');
        /** Hidden cards can include objective cards; require `playing` before keyboard/canvas picks work. */
        if (hidden >= 4 && runStatus === 'playing') {
            return lastMemorizeSnap;
        }
        await page.waitForTimeout(40);
    }
    await waitForPlayingAndHiddenCount(page, 4);
    return lastMemorizeSnap;
}

export async function completeLevel1AllMatches(page: Page, pairs: PairPositions): Promise<void> {
    await page.getByTestId('tile-board-application').focus();
    for (const label of Object.keys(pairs)) {
        const [a, b] = pairs[label];
        await clickHiddenTile(page, a.row, a.col);
        await clickHiddenTile(page, b.row, b.col);
        await page.waitForTimeout(MATCH_SETTLE_MS);
    }
    if (await proceedThroughUnlockedExitIfVisible(page)) {
        return;
    }
    if (await revealLoneExitIfPresent(page)) {
        return;
    }
    await completeLevel1ByTryingHiddenPairs(page);
}

/** Finish level 1 using memorize pairs when present, otherwise search pairs (missed short memorize window). */
export async function completeLevel1Play(page: Page, pairs: PairPositions | null): Promise<void> {
    if (pairs && Object.keys(pairs).length >= 2) {
        await completeLevel1AllMatches(page, pairs);
        return;
    }
    await completeLevel1ByTryingHiddenPairs(page);
}

async function restartLevel1FromMainMenu(page: Page): Promise<void> {
    await expect(mainMenuPlayButton(page)).toBeVisible({ timeout: 15000 });
    await mainMenuPlayButton(page).click();
    await expect(page.getByRole('region', { name: /choose your path/i })).toBeVisible();
    await startClassicRunFromModeSelect(page);
    await waitForPlayingAndHiddenCount(page, 4);
}

async function leaveRunForMainMenu(page: Page): Promise<void> {
    const abandonRunConfirm = page.getByRole('dialog', { name: /abandon run\?/i });

    await expect
        .poll(
            async () => {
                if (await mainMenuPlayButton(page).isVisible().catch(() => false)) {
                    return 'menu';
                }
                if (await abandonRunConfirm.isVisible().catch(() => false)) {
                    return 'confirm';
                }
                return 'pending';
            },
            { timeout: 15_000 }
        )
        .toMatch(/^(menu|confirm)$/);

    if (await abandonRunConfirm.isVisible().catch(() => false)) {
        await abandonRunConfirm.getByRole('button', { name: /^abandon run$/i }).click();
    }
}

async function restartLevel1AfterAccidentalMatch(page: Page): Promise<void> {
    const floorCleared = page.getByRole('dialog', { name: /floor cleared/i });

    if (await floorCleared.isVisible().catch(() => false)) {
        await floorCleared.getByRole('button', { name: /main menu/i }).click();
    } else {
        await page.getByRole('button', { name: /return to main menu/i }).click();
    }

    await leaveRunForMainMenu(page);
    await restartLevel1FromMainMenu(page);
}

/**
 * Find two hidden cells that are not a match (level 1). Flake patterns this addresses:
 * - Memorize map missed (`pairs` null): probe order can rarely clear the floor on unlucky seeds — restart and retry.
 * - Hidden-tile `count()` races flip-back animations — use `settleAfterHiddenPairClick` instead of a single fixed sleep.
 * - Transient counts outside {2,4} during animation — poll until settlement or timeout.
 */
async function discoverMismatchPair(
    page: Page,
    pairs: PairPositions | null
): Promise<{ a: { row: number; col: number }; b: { row: number; col: number } }> {
    if (pairs && Object.keys(pairs).length >= 2) {
        const keys = Object.keys(pairs);
        return { a: pairs[keys[0]][0], b: pairs[keys[1]][0] };
    }

    const probeIndexPairs: ReadonlyArray<readonly [number, number]> = [
        [0, 3],
        [0, 2],
        [1, 3],
        [1, 2],
        [0, 1],
        [2, 3]
    ];

    const maxAttempts = 14;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        await waitForPlayPhaseHiddenTiles(page, 4);
        const positions = await getHiddenTilePositions(page);
        if (positions.length !== 4) {
            await page.waitForTimeout(120);
            continue;
        }

        const [i, j] = probeIndexPairs[attempt % probeIndexPairs.length]!;
        const guess = { a: positions[i]!, b: positions[j]! };
        await clickHiddenTile(page, guess.a.row, guess.a.col);
        await clickHiddenTile(page, guess.b.row, guess.b.col);

        const settled = await settleAfterHiddenPairClick(page);

        if (settled === 'floor_cleared') {
            await restartLevel1AfterAccidentalMatch(page);
            continue;
        }

        if (settled === 'four_hidden') {
            return guess;
        }

        if (settled === 'two_hidden') {
            await restartLevel1AfterAccidentalMatch(page);
            continue;
        }
    }

    throw new Error('failed to discover a deterministic mismatch pair for the level 1 game-over flow');
}

/**
 * Burn lives with mismatches until game over (level 1). Flake patterns:
 * - Same as `discoverMismatchPair` for the discovery phase; burn loop waits for board reset or overlay via polling
 *   (slow machines can exceed a fixed `MATCH_SETTLE_MS`).
 * - If CI keeps failing here, increase the visual scenario timeout before weakening the live game-over path.
 */
export async function forceGameOverWithMismatches(page: Page, pairs: PairPositions | null): Promise<void> {
    const mismatch = await discoverMismatchPair(page, pairs);

    const expedition = () => page.getByText(/Expedition Over/i).isVisible().catch(() => false);

    await expect
        .poll(
            async () => {
                if (await expedition()) {
                    return 'over';
                }
                const hidden = await readFrameHiddenTileCount(page);
                return hidden === 4 ? 'play' : `bad:${hidden}`;
            },
            { timeout: 20_000 }
        )
        .toMatch(/^(over|play)$/);

    if (await expedition()) {
        return;
    }

    for (let i = 0; i < 12; i += 1) {
        if (await expedition()) {
            return;
        }
        await expect
            .poll(
                async () => {
                    if (await expedition()) {
                        return 'over';
                    }
                    const hidden = await readFrameHiddenTileCount(page);
                    return hidden === 4 ? 'play' : `bad:${hidden}`;
                },
                { timeout: 18_000 }
            )
            .toMatch(/^(over|play)$/);
        if (await expedition()) {
            return;
        }
        await clickHiddenTile(page, mismatch.a.row, mismatch.a.col);
        await clickHiddenTile(page, mismatch.b.row, mismatch.b.col);
        await settleAfterMismatchBurnClick(page);
    }
    await expect(page.getByText(/Expedition Over/i)).toBeVisible({ timeout: 20000 });
}
