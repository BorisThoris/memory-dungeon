/**
 * Bakes static PNGs of the current in-game procedural illustration (Canvas2D) for every
 * `pairKey` in the illustration regression fixture, for scriptable post-processing (color, ML, etc.).
 *
 * Requires a Vite dev server. If nothing is listening on the port, this script starts
 * `yarn vite` and stops it when done.
 *
 * Usage:
 *   yarn bake:procedural-set
 *   yarn bake:procedural-set -- --port=5173
 *   yarn bake:procedural-set -- --tiers=full,standard
 *   yarn bake:procedural-set -- --include-full-canvas
 *
 * Output: `output/baked-procedural-illustrations/panels/{pairKey}-{tier}.png` (illustration mat only)
 *         optional `output/baked-procedural-illustrations/overlay-full/...` (full static card canvas)
 *         + `manifest.json`
 */
import { Buffer } from 'node:buffer';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright-core';
import waitOn from 'wait-on';
import type { OverlayDrawTier } from '../src/renderer/cardFace/overlayDrawTier';
import { computeIllustrationPixelRect } from '../src/renderer/cardFace/cardIllustrationRect';
import { GAMEPLAY_CARD_VISUALS } from '../src/renderer/components/gameplayVisualConfig';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from '../src/renderer/components/tileShatter';
import { ILLUSTRATION_GEN_SCHEMA_VERSION } from '../src/renderer/cardFace/proceduralIllustration/illustrationSchemaVersion';
import { parseBakeProceduralIllustrationSetArgs } from './bake-procedural-illustration-set-options';

/** Must match `STATIC_CARD_TEXTURE_*` in `tileTextures.ts`. */
const STATIC_CARD_TEXTURE_HEIGHT = 1024;
const STATIC_CARD_TEXTURE_WIDTH = Math.max(
    2,
    Math.round(STATIC_CARD_TEXTURE_HEIGHT * (CARD_PLANE_WIDTH / CARD_PLANE_HEIGHT))
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function sanitizePairKey(pairKey: string): string {
    return pairKey.replace(/[^a-zA-Z0-9-_]/g, '_');
}

async function ensureDevServer(port: number): Promise<{ stop: () => void }> {
    const tcp = `tcp:127.0.0.1:${port}`;
    try {
        await waitOn({ resources: [tcp], timeout: 2500 });
        console.log(`Using existing dev server at http://127.0.0.1:${port}`);
        return { stop: () => {} };
    } catch {
        console.log(`Starting Vite on http://127.0.0.1:${port} …`);
        const proc: ChildProcess = spawn(
            process.platform === 'win32' ? 'yarn.cmd' : 'yarn',
            ['vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
            {
                cwd: ROOT,
                shell: process.platform === 'win32',
                stdio: 'inherit',
                detached: false
            }
        );

        await waitOn({ resources: [tcp], timeout: 180_000 });

        return {
            stop: (): void => {
                proc.kill('SIGTERM');
            }
        };
    }
}

async function main(): Promise<void> {
    const argv = process.argv.slice(2);
    const { port, tiers, includeFullCanvas, fixturePath, outDir } = parseBakeProceduralIllustrationSetArgs(argv);

    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as { pairKeys: string[] };
    const pairKeys = fixture.pairKeys;
    if (!pairKeys?.length) {
        throw new Error(`No pairKeys in ${fixturePath}`);
    }

    const cw = STATIC_CARD_TEXTURE_WIDTH;
    const ch = STATIC_CARD_TEXTURE_HEIGHT;
    const panelRect = computeIllustrationPixelRect(cw, ch);

    const panelsDir = path.join(outDir, 'panels');
    const overlayDir = path.join(outDir, 'overlay-full');
    mkdirSync(panelsDir, { recursive: true });
    if (includeFullCanvas) {
        mkdirSync(overlayDir, { recursive: true });
    }

    let stopServer: (() => void) | undefined;
    let browser: Browser | undefined;

    try {
        const srv = await ensureDevServer(port);
        stopServer = srv.stop;

        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            viewport: { width: 900, height: 700 },
            deviceScaleFactor: 1
        });
        const page = await context.newPage();
        await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle', timeout: 120_000 });

        const exports: Array<{
            pairKey: string;
            tier: OverlayDrawTier;
            panelRelativePath: string;
            panelWidth: number;
            panelHeight: number;
            overlayRelativePath?: string;
        }> = [];

        const origin = `http://127.0.0.1:${port}/`;

        for (const tier of tiers) {
            for (const pairKey of pairKeys) {
                const safe = sanitizePairKey(pairKey);
                const baseName = `${safe}-${tier}`;

                // Fresh document each iteration: Vite HMR can otherwise destroy the page's execution context.
                await page.goto(origin, { waitUntil: 'networkidle', timeout: 120_000 });

                const buffers = await page.evaluate(
                    async ({
                        pairKey: pk,
                        tier: tr,
                        clearCaches,
                        includeFullCanvas,
                        canvasWidth,
                        canvasHeight,
                        sx,
                        sy,
                        sw,
                        sh
                    }) => {
                        if (clearCaches) {
                            const texturesMod = await import('/src/renderer/components/tileTextures.ts');
                            texturesMod.clearTileTextureCachesForDebug();
                        }

                        const illustrationMod = await import('/src/renderer/cardFace/cardIllustrationDraw.ts');
                        const paletteMod = await import('/src/renderer/cardFace/cardFaceOverlayPalette.ts');
                        const palette = paletteMod.getCardFaceOverlayColors('active');

                        const canvas = document.createElement('canvas');
                        canvas.width = canvasWidth;
                        canvas.height = canvasHeight;
                        const context = canvas.getContext('2d');
                        if (!context) {
                            throw new Error('2d context unavailable');
                        }

                        illustrationMod.drawProceduralIllustrationInCanvasOverlay(
                            context,
                            canvas,
                            pk,
                            tr,
                            palette,
                            {
                                matFeatherStrength: 0.92
                            }
                        );

                        const panelCanvas = document.createElement('canvas');
                        panelCanvas.width = sw;
                        panelCanvas.height = sh;
                        const pctx = panelCanvas.getContext('2d');
                        if (!pctx) {
                            throw new Error('panel 2d context unavailable');
                        }
                        pctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

                        type Out = { panelDataUrl: string; overlayDataUrl?: string };
                        const result: Out = {
                            panelDataUrl: panelCanvas.toDataURL('image/png')
                        };

                        if (includeFullCanvas) {
                            result.overlayDataUrl = canvas.toDataURL('image/png');
                        }

                        return result;
                    },
                    {
                        pairKey,
                        tier,
                        clearCaches: true,
                        includeFullCanvas,
                        canvasWidth: cw,
                        canvasHeight: ch,
                        sx: panelRect.x,
                        sy: panelRect.y,
                        sw: panelRect.width,
                        sh: panelRect.height
                    }
                );

                const panelBuf = decodePngDataUrl(buffers.panelDataUrl);
                const panelPath = path.join(panelsDir, `${baseName}.png`);
                writeFileSync(panelPath, panelBuf);

                const entry: (typeof exports)[number] = {
                    pairKey,
                    tier,
                    panelRelativePath: path.relative(outDir, panelPath),
                    panelWidth: panelRect.width,
                    panelHeight: panelRect.height
                };

                if (includeFullCanvas && buffers.overlayDataUrl) {
                    const overlayPath = path.join(overlayDir, `${baseName}.png`);
                    writeFileSync(overlayPath, decodePngDataUrl(buffers.overlayDataUrl));
                    entry.overlayRelativePath = path.relative(outDir, overlayPath);
                }

                exports.push(entry);
                console.log(`Wrote ${entry.panelRelativePath}`);
            }
        }

        const manifest = {
            generatedAt: new Date().toISOString(),
            illustrationSchemaVersion: ILLUSTRATION_GEN_SCHEMA_VERSION,
            textureVersion: GAMEPLAY_CARD_VISUALS.textureVersion,
            viewportCanvas: { width: cw, height: ch },
            illustrationPanelRect: panelRect,
            fixturePath: path.relative(ROOT, fixturePath),
            tiers,
            exports
        };

        writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

        console.log(`Done. Manifest: ${path.join(outDir, 'manifest.json')}`);
    } finally {
        await browser?.close();
        stopServer?.();
    }
}

function decodePngDataUrl(value: string): Buffer {
    const base64 = value.replace(/^data:image\/png;base64,/, '');
    return Buffer.from(base64, 'base64');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    main().catch((err: unknown) => {
        console.error(err);
        process.exit(1);
    });
}
