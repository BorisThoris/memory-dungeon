import { expect, test } from '@playwright/test';

test('repeated matches and large cascades keep GPU resources bounded', async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const errors: string[] = [];
    page.on('crash', () => errors.push('Browser tab crashed'));
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
    });
    await page.addInitScript(() => {
        const canvases: WeakRef<HTMLCanvasElement>[] = [];
        const createElement = document.createElement.bind(document);
        document.createElement = ((...args: Parameters<typeof createElement>) => {
            const element = createElement(...args);
            if (element instanceof HTMLCanvasElement) canvases.push(new WeakRef(element));
            return element;
        }) as typeof document.createElement;
        let bitmapCopies = 0;
        const createBitmap = window.createImageBitmap;
        window.createImageBitmap = ((...args: Parameters<typeof createBitmap>) => {
            bitmapCopies++;
            return createBitmap(...args);
        }) as typeof window.createImageBitmap;
        (window as unknown as { __matchMemory: () => { canvasPixels: number; bitmapCopies: number } }).__matchMemory = () => ({
            canvasPixels: canvases.reduce((sum, ref) => {
                const canvas = ref.deref();
                return sum + (canvas ? canvas.width * canvas.height : 0);
            }, 0),
            bitmapCopies
        });
        const live = new Set<WebGLBuffer>();
        const textures = new Set<WebGLTexture>();
        const tracker = { buffers: 0, peak: 0, textures: 0, contextsLost: 0 };
        (window as unknown as { __matchGpu: typeof tracker }).__matchGpu = tracker;
        for (const context of [WebGLRenderingContext, WebGL2RenderingContext]) {
            const create = context.prototype.createBuffer;
            const drop = context.prototype.deleteBuffer;
            context.prototype.createBuffer = function () {
                const buffer = create.call(this);
                if (buffer) live.add(buffer);
                tracker.buffers = live.size;
                tracker.peak = Math.max(tracker.peak, live.size);
                return buffer;
            };
            context.prototype.deleteBuffer = function (buffer) {
                if (buffer) live.delete(buffer);
                tracker.buffers = live.size;
                return drop.call(this, buffer);
            };
            const createTexture = context.prototype.createTexture;
            const deleteTexture = context.prototype.deleteTexture;
            context.prototype.createTexture = function () {
                const texture = createTexture.call(this);
                if (texture) textures.add(texture);
                tracker.textures = textures.size;
                return texture;
            };
            context.prototype.deleteTexture = function (texture) {
                if (texture) textures.delete(texture);
                tracker.textures = textures.size;
                return deleteTexture.call(this, texture);
            };
        }
        document.addEventListener('webglcontextlost', () => tracker.contextsLost++, true);
    });
    await page.goto('/?hallRoom=fever-bridge', { timeout: 180_000 });
    await page.waitForSelector('canvas[data-webgl-draw-calls]', { timeout: 180_000 });
    const originalCanvas = await page.locator('canvas[data-webgl-draw-calls]').elementHandle();
    const rooms = ['fever-bridge', 'clean-pop', 'element-fire', 'element-water', 'element-frost',
        'element-grove', 'element-steam', 'element-blaze', 'element-frostbloom', 'hourglass'] as const;
    const readGpu = () => page.evaluate(() => ({ ...(window as unknown as {
        __matchGpu: { buffers: number; peak: number; textures: number; contextsLost: number }
    }).__matchGpu }));
    const samples: Awaited<ReturnType<typeof readGpu>>[] = [];
    const memory: { canvasPixels: number; bitmapCopies: number }[] = [];
    const cdp = await page.context().newCDPSession(page);
    for (let turn = 0; turn < 60; turn++) {
        await page.evaluate(async ({ id, turn }) => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            const { testHallRoom } = await import('/src/shared/test-hall-rooms.ts');
            const { startTestHallRoom } = await import('/src/renderer/dev/testHallLoader.ts');
            // Use the run lifecycle to cancel delayed resolution from the preceding room.
            // Load the next fixture synchronously in the same batch: awaiting the public hook
            // here unmounts the canvas, so a global buffer tracker also counts retired contexts.
            useAppStore.getState().goToMenu();
            startTestHallRoom(id);
            await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
            const step = testHallRoom(id)!.script.find(entry => entry.step.do === 'match')?.step;
            if (!step || step.do !== 'match') throw new Error(`${id} has no match`);
            const run = useAppStore.getState().run!;
            const pair = run.board!.tiles.filter(tile => tile.pairKey === step.pairKey);
            if (pair.length !== 2) throw new Error(`${id} has no playable pair`);
            const realms = ['ember', 'frost', 'tide', 'grove', 'storm'] as const;
            useAppStore.setState({ run: { ...run, resolveDelayMultiplier: 0.2,
                realmId: realms[Math.floor(turn / 2) % realms.length],
                stats: { ...run.stats, currentStreak: [0, 8, 24, 64, 256, 3000][turn % 6]! } } });
            for (const tile of pair) useAppStore.getState().pressTile(tile.id);
        }, { id: rooms[turn % rooms.length]!, turn });
        try {
            await expect.poll(async () => page.evaluate(async () => {
                const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
                return useAppStore.getState().run?.board?.matchedPairs ?? 0;
            }), { message: `Resolved stress match ${turn} in ${rooms[turn % rooms.length]}` }).toBeGreaterThan(0);
        } catch (error) {
            const state = await page.evaluate(async () => {
                const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
                const state = useAppStore.getState();
                return { view: state.view, status: state.run?.status, pairs: state.run?.board?.matchedPairs,
                    flipped: state.run?.board?.flippedTileIds, timers: state.run?.timerState,
                    renderedStatus: document.querySelector('[data-board-run-status]')?.getAttribute('data-board-run-status') };
            });
            await testInfo.attach('failed-match-state', { body: JSON.stringify({ turn, room: rooms[turn % rooms.length], state, gpu: await readGpu(), errors }), contentType: 'application/json' });
            throw error;
        }
        await page.waitForTimeout(450);
        if (turn < 30 && turn % 6 === 5) {
            await page.screenshot({ path: testInfo.outputPath(`realm-combo-${turn}.png`) });
        }
        if (turn % rooms.length === rooms.length - 1) {
            await page.waitForTimeout(3000);
            // The scene clock slows on low-FPS headless runs. Sample after the actual effects
            // expire, rather than comparing a live departure against an idle room.
            await expect(page.locator('canvas[data-departure-groups]')).toHaveAttribute('data-departure-groups', '0', { timeout: 30_000 });
            expect(await originalCanvas!.evaluate(canvas => canvas.isConnected)).toBe(true);
            samples.push(await readGpu());
            await cdp.send('HeapProfiler.collectGarbage');
            await page.waitForTimeout(100);
            memory.push(await page.evaluate(() => (window as unknown as {
                __matchMemory: () => { canvasPixels: number; bitmapCopies: number }
            }).__matchMemory()));
        }
    }
    await testInfo.attach('warmed-gpu-resource-samples', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
    // Compare identical warmed rooms: the old card planes leaked ~248 buffers per ten turns.
    for (const sample of samples.slice(1)) expect(sample.buffers).toBeLessThanOrEqual(samples[0]!.buffers + 32);
    for (const sample of samples.slice(1)) expect(sample.textures).toBeLessThanOrEqual(samples[0]!.textures + 8);
    // Scene source pixels are already decoded by the preloader. A second bitmap per layer used
    // another ~295 MB in a session visiting every realm, outside the JavaScript heap counter.
    for (const sample of memory) expect(sample.bitmapCopies).toBe(0);
    for (const sample of memory.slice(2)) expect(sample.canvasPixels).toBeLessThanOrEqual(memory[1]!.canvasPixels + 4 * 1024 * 1024);

    // Exercise the renderer's departure path beyond a normal opening board. These are synthetic
    // committed visual states, while the sixty turns above use the real match controller.
    for (let wave = 0; wave < 3; wave++) {
        await page.evaluate(async wave => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            const { buildBoard } = await import('/src/shared/board-build-rules.ts');
            const run = useAppStore.getState().run!;
            const tiles = Array.from({ length: 512 }, (_, index) => ({
                id: `stress-${wave}-${index}`, pairKey: `stress-pair-${Math.floor(index / 2)}`,
                symbol: 'circle', label: 'Stress card', state: 'hidden' as const,
                suit: index % 4 < 2 ? 'ember' as const : 'bone' as const
            }));
            useAppStore.setState({ run: { ...run, status: 'playing',
                board: buildBoard(100, { fixedTiles: tiles, fixedTilesMode: 'exact' }) } });
        }, wave);
        await page.waitForTimeout(2000);
        await page.evaluate(async () => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            const run = useAppStore.getState().run!;
            useAppStore.setState({ run: { ...run, board: { ...run.board!, matchedPairs: 1,
                tiles: run.board!.tiles.map((tile, index) => ({ ...tile,
                    state: index < 2 ? 'matched' as const : 'removed' as const,
                    brokenByChunk: index >= 2, brokenAtTier: 'fever' as const })) } } });
        });
        await page.waitForTimeout(1500);
        if (wave === 0) await page.screenshot({ path: testInfo.outputPath('bounded-cascade.png') });
        await expect.poll(async () => (await readGpu()).buffers, { timeout: 30_000 }).toBeLessThan(100);
        await expect.poll(async () => (await readGpu()).textures, { timeout: 30_000 }).toBeLessThan(80);
        samples.push(await readGpu());
    }
    await testInfo.attach('gpu-resource-samples', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
    await testInfo.attach('scene-memory-samples', { body: JSON.stringify(memory, null, 2), contentType: 'application/json' });
    expect(errors).toEqual([]);
    expect(samples.every(sample => sample.contextsLost === 0)).toBe(true);
});

for (let opening = 1; opening <= 3; opening++) {
    test(`cold opening ${opening} survives the first matches`, async ({ page }, testInfo) => {
        test.setTimeout(180_000);
        const errors: string[] = [];
        page.on('crash', () => errors.push('Browser tab crashed'));
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Network.enable');
        await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
        await page.goto('/?hallRoom=element-water', { timeout: 180_000 });
        await page.waitForSelector('canvas[data-webgl-draw-calls]', { timeout: 180_000 });
        // Verify the real browser honors the CPU bake option, rather than only spying on the
        // requested option in a DOM mock. The card's finished texture is still uploaded to WebGL.
        expect(await page.evaluate(async () => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            const { getTileFaceOverlayTexture } = await import('/src/renderer/components/tileTextures.ts');
            const tile = useAppStore.getState().run!.board!.tiles[0]!;
            const canvas = getTileFaceOverlayTexture(tile, 'active', 'high')!.image as HTMLCanvasElement;
            return canvas.getContext('2d')!.getContextAttributes().willReadFrequently;
        })).toBe(true);
        for (const room of ['element-water', 'element-fire', 'element-grove'] as const) {
            await page.evaluate(async id => {
                const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
                const { testHallRoom } = await import('/src/shared/test-hall-rooms.ts');
                const hooks = window as unknown as { __memoryDungeonE2e: { startTestHallRoom(id: string): Promise<boolean> } };
                if (!await hooks.__memoryDungeonE2e.startTestHallRoom(id)) throw new Error(`Could not start ${id}`);
                const step = testHallRoom(id)!.script.find(entry => entry.step.do === 'match')?.step;
                if (!step || step.do !== 'match') throw new Error(`No opening match in ${id}`);
                await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
                const run = useAppStore.getState().run!;
                for (const tile of run.board!.tiles.filter(tile => tile.pairKey === step.pairKey)) {
                    useAppStore.getState().pressTile(tile.id);
                }
            }, room);
            await expect.poll(async () => page.evaluate(async () => {
                const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
                return useAppStore.getState().run?.board?.matchedPairs ?? 0;
            })).toBeGreaterThan(0);
            await page.waitForTimeout(2800);
        }
        await page.screenshot({ path: testInfo.outputPath('opening-matches.png') });
        expect(errors).toEqual([]);
    });
}
