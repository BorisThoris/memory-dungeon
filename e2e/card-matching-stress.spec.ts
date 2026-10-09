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
    const rooms = ['fever-bridge', 'clean-pop', 'element-fire', 'element-water', 'element-frost',
        'element-grove', 'element-steam', 'element-blaze', 'element-frostbloom', 'hourglass'] as const;
    const readGpu = () => page.evaluate(() => ({ ...(window as unknown as {
        __matchGpu: { buffers: number; peak: number; textures: number; contextsLost: number }
    }).__matchGpu }));
    const samples: Awaited<ReturnType<typeof readGpu>>[] = [];
    for (let turn = 0; turn < 60; turn++) {
        await page.evaluate(async id => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            const { testHallRoom } = await import('/src/shared/test-hall-rooms.ts');
            const hooks = window as unknown as { __memoryDungeonE2e: { startTestHallRoom(id: string): Promise<boolean> } };
            const started = await hooks.__memoryDungeonE2e.startTestHallRoom(id);
            if (!started) throw new Error(`Could not start ${id}`);
            await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
            const step = testHallRoom(id)!.script.find(entry => entry.step.do === 'match')?.step;
            if (!step || step.do !== 'match') throw new Error(`${id} has no match`);
            const run = useAppStore.getState().run!;
            const pair = run.board!.tiles.filter(tile => tile.pairKey === step.pairKey);
            if (pair.length !== 2) throw new Error(`${id} has no playable pair`);
            useAppStore.setState({ run: { ...run, resolveDelayMultiplier: 0.2 } });
            for (const tile of pair) useAppStore.getState().pressTile(tile.id);
        }, rooms[turn % rooms.length]!);
        await expect.poll(async () => page.evaluate(async () => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            return useAppStore.getState().run?.board?.matchedPairs ?? 0;
        })).toBeGreaterThan(0);
        await page.waitForTimeout(450);
        if (turn % rooms.length === rooms.length - 1) {
            await page.waitForTimeout(3000);
            samples.push(await readGpu());
        }
    }
    // Compare identical warmed rooms: the old card planes leaked ~248 buffers per ten turns.
    for (const sample of samples.slice(1)) expect(sample.buffers).toBeLessThanOrEqual(samples[0]!.buffers + 32);
    for (const sample of samples.slice(1)) expect(sample.textures).toBeLessThanOrEqual(samples[0]!.textures + 8);

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
    expect(errors).toEqual([]);
    expect(samples.every(sample => sample.contextsLost === 0)).toBe(true);
});
