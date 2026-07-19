import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    CARD_BACK_SVG_LAYER_NAMES,
    loadSharedCardBackSvgLayerGeometries,
    loadSharedCardSvgPlaneGeometry
} from './cardSvgPlaneGeometry';

const cardBackSvg = readFileSync(
    resolve(process.cwd(), 'src/renderer/assets/textures/cards/authored-card-back.svg'),
    'utf8'
);
const layeredFixtureSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 740 1080">
${CARD_BACK_SVG_LAYER_NAMES.map(
    (name, index) =>
        `  <g id="${name}"><rect x="${40 + index * 6}" y="${40 + index * 6}" width="${80 + index}" height="${80 + index}" fill="#c3954f"/></g>`
).join('\n')}
</svg>`;

const installSvgStyleGetters = (): void => {
    const styleProto = window.CSSStyleDeclaration.prototype as CSSStyleDeclaration & Record<string, unknown>;
    for (const name of [
        'clip-path',
        'fill',
        'fill-opacity',
        'fill-rule',
        'opacity',
        'stroke',
        'stroke-dasharray',
        'stroke-dashoffset',
        'stroke-linecap',
        'stroke-linejoin',
        'stroke-miterlimit',
        'stroke-opacity',
        'stroke-width',
        'visibility'
    ]) {
        Object.defineProperty(styleProto, name, {
            configurable: true,
            get: () => ''
        });
    }
};

describe('cardSvgPlaneGeometry', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('loads authored card back SVG as named animation layers', async () => {
        for (const name of CARD_BACK_SVG_LAYER_NAMES) {
            expect(cardBackSvg).toContain(`id="${name}"`);
        }

        installSvgStyleGetters();

        globalThis.fetch = vi.fn(async () =>
            new Response(layeredFixtureSvg, {
                headers: { 'content-length': String(layeredFixtureSvg.length) },
                status: 200
            })
        ) as typeof fetch;

        const layers = await loadSharedCardBackSvgLayerGeometries('test-card-back-layers.svg');

        expect(layers?.map((layer) => layer.name)).toEqual([...CARD_BACK_SVG_LAYER_NAMES]);
        for (const layer of layers ?? []) {
            expect(layer.geometry.attributes.position.count).toBeGreaterThan(0);
            layer.geometry.dispose();
        }
    });

    it('retries a transient front SVG failure and caches the recovered geometry', async () => {
        installSvgStyleGetters();
        const frontFixture = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 740 1080"><rect x="40" y="40" width="660" height="1000" fill="#ffffff"/></svg>';
        globalThis.fetch = vi
            .fn()
            .mockRejectedValueOnce(new Error('network unavailable'))
            .mockResolvedValueOnce(
                new Response(frontFixture, {
                    headers: { 'content-length': String(frontFixture.length) },
                    status: 200
                })
            ) as typeof fetch;

        await expect(loadSharedCardSvgPlaneGeometry('retry-front.svg')).resolves.toBeNull();
        const recovered = await loadSharedCardSvgPlaneGeometry('retry-front.svg');
        const cached = await loadSharedCardSvgPlaneGeometry('retry-front.svg');

        expect(recovered).not.toBeNull();
        expect(cached).toBe(recovered);
        expect(globalThis.fetch).toHaveBeenCalledTimes(2);
        recovered?.dispose();
    });

    it('bounds repeated layered-back SVG failures', async () => {
        globalThis.fetch = vi.fn(async () => {
            throw new Error('network unavailable');
        }) as typeof fetch;

        await loadSharedCardBackSvgLayerGeometries('failed-back.svg');
        await loadSharedCardBackSvgLayerGeometries('failed-back.svg');
        await loadSharedCardBackSvgLayerGeometries('failed-back.svg');

        expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });
});
