import { Buffer } from 'node:buffer';
import { expect, test } from '@playwright/test';
import { defaultE2eGameSaveJson, STORAGE_KEY } from './tileBoardGameFlow';

test.skip(process.env.RUN_ILLUSTRATION_BENCHMARK !== '1', 'manual illustration benchmark harness');

const BENCHMARK_PAIR_KEYS = Array.from({ length: 32 }, (_, index) => `benchmark-${index.toString().padStart(2, '0')}`);

test.describe('Illustration perf benchmark', () => {
    test('records avg and p95 cold generation time for 32 unique overlays', async ({ page }, testInfo) => {
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
            const texturesMod = await import('/src/renderer/components/tileTextures.ts');

            const qualityByTier = {
                full: 'high',
                minimal: 'low',
                standard: 'medium'
            } as const;

            const percentile = (values: number[], ratio: number): number => {
                const sorted = [...values].sort((left, right) => left - right);
                const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
                return sorted[index] ?? 0;
            };

            const report: Record<
                'minimal' | 'standard' | 'full',
                { avgMs: number; budgetMs: number; p95Ms: number; samples: number[] }
            > = {
                full: { avgMs: 0, budgetMs: 2.0, p95Ms: 0, samples: [] },
                minimal: { avgMs: 0, budgetMs: 0.4, p95Ms: 0, samples: [] },
                standard: { avgMs: 0, budgetMs: 1.0, p95Ms: 0, samples: [] }
            };

            for (const tier of ['minimal', 'standard', 'full'] as const) {
                const quality = qualityByTier[tier];
                for (const pairKey of pairKeys) {
                    texturesMod.clearTileTextureCachesForDebug();
                    const tile = {
                        id: `bench-${tier}-${pairKey}`,
                        label: pairKey.slice(0, 4).toUpperCase(),
                        pairKey,
                        state: 'hidden' as const,
                        symbol: pairKey.slice(-1).toUpperCase()
                    };

                    const startedAt = performance.now();
                    const texture = texturesMod.getTileFaceOverlayTexture(tile, 'active', quality);
                    const elapsedMs = performance.now() - startedAt;
                    if (!texture) {
                        throw new Error(`overlay texture generation failed for ${tier}:${pairKey}`);
                    }

                    report[tier].samples.push(elapsedMs);
                }

                const samples = report[tier].samples;
                const total = samples.reduce((sum, sample) => sum + sample, 0);
                report[tier].avgMs = samples.length > 0 ? total / samples.length : 0;
                report[tier].p95Ms = percentile(samples, 0.95);
            }

            return report;
        }, { pairKeys: BENCHMARK_PAIR_KEYS });

        await testInfo.attach('illustration-benchmark.json', {
            body: Buffer.from(JSON.stringify(result, null, 2)),
            contentType: 'application/json'
        });

        expect(result.minimal.samples).toHaveLength(32);
        expect(result.standard.samples).toHaveLength(32);
        expect(result.full.samples).toHaveLength(32);
    });
});
