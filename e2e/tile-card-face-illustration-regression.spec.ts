import { Buffer } from 'node:buffer';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { defaultE2eGameSaveJson, STORAGE_KEY } from './tileBoardGameFlow';

const HASH_FIXTURE_PATH = path.resolve(
    process.cwd(),
    'e2e',
    'fixtures',
    'tile-card-face-illustration-regression.json'
);
const CONTACT_SHEET_FIXTURE_PATH = path.resolve(
    process.cwd(),
    'e2e',
    'fixtures',
    'tile-card-face-illustration-contact-sheet.png'
);

type IllustrationHashFixture = {
    hashes: Record<string, string>;
    metadata: {
        illustrationSchemaVersion: number;
        textureVersion: number;
        tiers: readonly string[];
    };
    pairKeys: readonly string[];
};

const readHashFixture = (): IllustrationHashFixture =>
    JSON.parse(readFileSync(HASH_FIXTURE_PATH, 'utf8')) as IllustrationHashFixture;

const sortRecord = (value: Record<string, string>): Record<string, string> =>
    Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));

const HASH_FIXTURE = readHashFixture();
const PAIR_KEYS = HASH_FIXTURE.pairKeys;
const SHOULD_UPDATE_FIXTURES =
    process.env.UPDATE_ILLUSTRATION_FIXTURES === '1' || process.env.UPDATE_ILLUSTRATION_HASHES === '1';

const decodePngDataUrl = (value: string): Buffer => Buffer.from(value.replace(/^data:image\/png;base64,/, ''), 'base64');

const writeUpdatedFixtures = (
    currentFixture: IllustrationHashFixture,
    nextFixture: IllustrationHashFixture,
    contactSheetPng: Buffer
): void => {
    const fixtureChanged = JSON.stringify(currentFixture) !== JSON.stringify(nextFixture);
    const versionsChanged =
        currentFixture.metadata.illustrationSchemaVersion !== nextFixture.metadata.illustrationSchemaVersion ||
        currentFixture.metadata.textureVersion !== nextFixture.metadata.textureVersion;

    if (fixtureChanged && !versionsChanged) {
        throw new Error(
            `Illustration hashes changed without a version bump. Current fixture uses illustrationSchemaVersion=${currentFixture.metadata.illustrationSchemaVersion} and textureVersion=${currentFixture.metadata.textureVersion}; bump one before regenerating ${path.basename(HASH_FIXTURE_PATH)}.`
        );
    }

    mkdirSync(path.dirname(HASH_FIXTURE_PATH), { recursive: true });
    writeFileSync(HASH_FIXTURE_PATH, `${JSON.stringify(nextFixture, null, 2)}\n`, 'utf8');
    writeFileSync(CONTACT_SHEET_FIXTURE_PATH, contactSheetPng);
};

test.describe('Procedural illustration regression', () => {
    test('keeps fixed-seed illustration hashes stable and reuses cached textures', async ({ page }, testInfo) => {
        test.setTimeout(120_000);

        await page.addInitScript(
            ([key, json]) => {
                localStorage.setItem(key, json);
            },
            [STORAGE_KEY, defaultE2eGameSaveJson]
        );
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const result = await page.evaluate(async ({ pairKeys }) => {
            const illustrationMod = await import('/src/renderer/cardFace/cardIllustrationDraw.ts');
            const paletteMod = await import('/src/renderer/cardFace/cardFaceOverlayPalette.ts');
            const texturesMod = await import('/src/renderer/components/tileTextures.ts');
            const sizeMod = await import('/src/renderer/cardFace/staticCardTextureSize.ts');

            const qualityByTier = {
                full: 'high',
                minimal: 'low',
                standard: 'medium'
            } as const;
            const tiers = ['minimal', 'standard', 'full'] as const;

            const toHex = (bytes: Uint8Array): string => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
            const hashCanvas = async (canvas: HTMLCanvasElement): Promise<string> => {
                const context = canvas.getContext('2d');
                if (!context) {
                    throw new Error('2d context unavailable for regression hash');
                }
                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                const digest = await crypto.subtle.digest('SHA-256', imageData.data);
                return toHex(new Uint8Array(digest));
            };

            const { width, height } = sizeMod.getStaticCardTexturePixelSize();
            const palette = paletteMod.getCardFaceOverlayColors('active');
            const hashes: Record<string, string> = {};
            const regressionStamps: unknown[] = [];
            const warmHashes: Record<string, string> = {};

            texturesMod.clearTileTextureCachesForDebug();

            for (const tier of tiers) {
                for (const pairKey of pairKeys) {
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const context = canvas.getContext('2d');
                    if (!context) {
                        throw new Error('2d context unavailable for illustration render');
                    }
                    illustrationMod.drawProceduralIllustrationInCanvasOverlay(context, canvas, pairKey, tier, palette, {
                        matFeatherStrength: 0.92
                    });
                    hashes[`${tier}:${pairKey}`] = await hashCanvas(canvas);
                    regressionStamps.push(
                        texturesMod.getTileFaceOverlayRegressionStamp(
                            {
                                id: `regression-${pairKey}-${tier}`,
                                label: pairKey,
                                pairKey,
                                state: 'hidden',
                                symbol: pairKey.slice(0, 1).toUpperCase()
                            },
                            'active',
                            qualityByTier[tier]
                        )
                    );
                }
            }

            const matrixIllustrationDebugState = illustrationMod.getProceduralIllustrationBitmapCacheDebugState();

            const sampleTile = {
                id: 'regression-A',
                label: 'A',
                pairKey: 'alpha',
                state: 'hidden',
                symbol: 'A'
            };
            texturesMod.clearTileTextureCachesForDebug();
            const overlayCold = texturesMod.getTileFaceOverlayTexture(sampleTile, 'active', 'high');
            const overlayWarm = texturesMod.getTileFaceOverlayTexture(sampleTile, 'active', 'high');
            if (!overlayCold || !overlayWarm) {
                throw new Error('overlay texture generation failed');
            }
            const overlayColdCanvas = overlayCold.image as HTMLCanvasElement;
            const overlayWarmCanvas = overlayWarm.image as HTMLCanvasElement;
            warmHashes.cold = await hashCanvas(overlayColdCanvas);
            warmHashes.warm = await hashCanvas(overlayWarmCanvas);

            const pipelineDebugState = texturesMod.getIllustrationPipelineDebugState();

            const thumbCols = 6;
            const thumbWidth = 72;
            const thumbHeight = 104;
            const sectionGap = 28;
            const titleHeight = 22;
            const rowsPerTier = Math.ceil(pairKeys.length / thumbCols);
            const sheetCanvas = document.createElement('canvas');
            sheetCanvas.width = thumbCols * thumbWidth + 24;
            sheetCanvas.height = tiers.length * (rowsPerTier * thumbHeight + titleHeight) + sectionGap * (tiers.length - 1) + 24;
            const sheetCtx = sheetCanvas.getContext('2d');
            if (!sheetCtx) {
                throw new Error('2d context unavailable for contact sheet');
            }
            sheetCtx.fillStyle = '#080b12';
            sheetCtx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);
            sheetCtx.font = '12px sans-serif';
            sheetCtx.textBaseline = 'top';

            for (let tierIndex = 0; tierIndex < tiers.length; tierIndex += 1) {
                const tier = tiers[tierIndex]!;
                const sectionTop = 12 + tierIndex * (rowsPerTier * thumbHeight + titleHeight + sectionGap);
                sheetCtx.fillStyle = '#f4e0b5';
                sheetCtx.fillText(`${tier} (${qualityByTier[tier]})`, 12, sectionTop);
                for (let pairIndex = 0; pairIndex < pairKeys.length; pairIndex += 1) {
                    const pairKey = pairKeys[pairIndex]!;
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const context = canvas.getContext('2d');
                    if (!context) {
                        throw new Error('2d context unavailable for thumbnail render');
                    }
                    illustrationMod.drawProceduralIllustrationInCanvasOverlay(context, canvas, pairKey, tier, palette, {
                        matFeatherStrength: 0.92
                    });
                    const col = pairIndex % thumbCols;
                    const row = Math.floor(pairIndex / thumbCols);
                    const dx = 12 + col * thumbWidth;
                    const dy = sectionTop + titleHeight + row * thumbHeight;
                    sheetCtx.drawImage(canvas, dx, dy, thumbWidth - 8, thumbHeight - 22);
                    sheetCtx.fillStyle = '#c7d0e5';
                    sheetCtx.fillText(pairKey, dx, dy + thumbHeight - 20);
                }
            }

            return {
                hashFixtureMetadata: {
                    illustrationSchemaVersion: regressionStamps.length
                        ? (regressionStamps[0] as { illustration: { illustrationSchemaVersion: number } }).illustration
                              .illustrationSchemaVersion
                        : 0,
                    textureVersion: regressionStamps.length
                        ? (regressionStamps[0] as { illustration: { textureVersion: number } }).illustration.textureVersion
                        : 0,
                    tiers: [...tiers]
                },
                hashes,
                matrixIllustrationDebugState,
                overlayCacheContainsRegressionKey: pipelineDebugState.overlayTexture.overlayKeys.includes(
                    texturesMod.getTileFaceOverlayTextureCacheKey(sampleTile, 'active', 'high')
                ),
                overlayCacheIdentityStable: overlayCold === overlayWarm,
                pipelineDebugState,
                regressionStamps,
                sheetPng: sheetCanvas.toDataURL('image/png'),
                warmHashes
            };
        }, { pairKeys: [...PAIR_KEYS] });

        await testInfo.attach('illustration-hashes.json', {
            body: Buffer.from(JSON.stringify(sortRecord(result.hashes), null, 2)),
            contentType: 'application/json'
        });
        await testInfo.attach('illustration-regression-stamps.json', {
            body: Buffer.from(JSON.stringify(result.regressionStamps, null, 2)),
            contentType: 'application/json'
        });
        await testInfo.attach('illustration-cache-debug.json', {
            body: Buffer.from(
                JSON.stringify(
                    { matrixIllustration: result.matrixIllustrationDebugState, pipeline: result.pipelineDebugState },
                    null,
                    2
                )
            ),
            contentType: 'application/json'
        });
        const contactSheetPng = decodePngDataUrl(result.sheetPng);
        await testInfo.attach('illustration-contact-sheet.png', {
            body: contactSheetPng,
            contentType: 'image/png'
        });

        expect(result.overlayCacheIdentityStable).toBe(true);
        expect(result.overlayCacheContainsRegressionKey).toBe(true);
        expect(result.warmHashes.warm).toBe(result.warmHashes.cold);
        expect(result.matrixIllustrationDebugState.entryCount).toBe(PAIR_KEYS.length * 3);

        const nextFixture: IllustrationHashFixture = {
            hashes: sortRecord(result.hashes),
            metadata: result.hashFixtureMetadata,
            pairKeys: [...PAIR_KEYS]
        };

        if (SHOULD_UPDATE_FIXTURES) {
            writeUpdatedFixtures(HASH_FIXTURE, nextFixture, contactSheetPng);
            return;
        }

        expect(nextFixture.hashes).toEqual(HASH_FIXTURE.hashes);
        expect(nextFixture.metadata).toEqual(HASH_FIXTURE.metadata);
    });
});
