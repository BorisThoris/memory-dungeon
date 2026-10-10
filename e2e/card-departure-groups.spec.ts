import { expect, test } from '@playwright/test';

interface Preview {
    start(material: 'water' | 'fire' | 'growth' | 'ice' | 'stone', combo: number): void;
    pose(now: number): { groups: number; particles: number; sources: number; geometries: number; textures: number };
    clear(): ReturnType<Preview['pose']>;
    dispose(): void;
}
declare global { interface Window { __departurePreview: Preview } }

test('shared material surfaces render, move and release their GPU resources', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('crash', () => errors.push('Browser tab crashed'));
    await page.goto('/?hallRoom=element-water', { timeout: 180_000 });
    await page.waitForSelector('canvas[data-webgl-draw-calls]', { timeout: 180_000 });
    // Close-up of the runtime renderer, under deterministic visual time. The normal gameplay
    // stress test separately exercises actual controller commits, restarts and cascading breaks.
    await page.evaluate(async () => {
        const moduleUrl = performance.getEntriesByType('resource').map(entry => entry.name)
            .find(url => /\/node_modules\/\.vite\/deps\/three\.js\?/.test(url));
        if (!moduleUrl) throw new Error('The game has not loaded its Three.js module');
        const THREE: typeof import('three') = await import(moduleUrl);
        const { createCardDepartureWorld } = await import('/src/renderer/components/cardDepartureWorld.ts');
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(2, devicePixelRatio));
        renderer.setSize(innerWidth, innerHeight);
        renderer.setClearColor('#151a1f');
        const canvas = renderer.domElement;
        canvas.style.cssText = 'position:fixed;inset:0;z-index:2147483647';
        document.body.append(canvas);
        const scene = new THREE.Scene();
        const aspect = innerWidth / innerHeight;
        const camera = new THREE.OrthographicCamera(-3.4, 3.4, 3.4 / aspect, -3.4 / aspect, .1, 100);
        camera.position.z = 10;
        const world = createCardDepartureWorld();
        scene.add(world.group);
        const hook = {
            start(material: 'water' | 'fire' | 'growth' | 'ice' | 'stone', combo: number) {
                world.clear();
                const sources = Array.from({ length: 6 }, (_, index) => ({
                    key: material + index, material, x: index % 3 * .9 - .9,
                    y: Math.floor(index / 3) * 1.1 - .2, z: .04, floorY: -1.15,
                    seed: 1091 + index * 7919, start: 0, combo
                }));
                world.spawnWave(sources, 'high');
            },
            pose(now: number) { world.advance(now); renderer.render(scene, camera); return { ...world.stats(), ...renderer.info.memory }; },
            clear() { world.clear(); renderer.render(scene, camera); return { ...world.stats(), ...renderer.info.memory }; },
            dispose() { world.dispose(); renderer.dispose(); canvas.remove(); }
        };
        window.__departurePreview = hook;
    });
    const records = [];
    for (const material of ['water', 'fire', 'growth'] as const) {
        await page.evaluate(material => window.__departurePreview.start(material, 30), material);
        for (const time of [.18, .55, 1.1, 1.75]) {
            const memory = await page.evaluate(time => window.__departurePreview.pose(time), time);
            expect(memory.groups).toBe(1); expect(memory.particles).toBeLessThanOrEqual(48);
            expect(memory.geometries).toBe(1);
            records.push({ material, time, ...memory });
            await page.screenshot({ path: testInfo.outputPath(`${material}-${time}.png`) });
        }
        expect((await page.evaluate(() => window.__departurePreview.pose(3))).groups).toBe(0);
        const memory = await page.evaluate(() => window.__departurePreview.clear());
        expect(memory.geometries).toBe(0); expect(memory.textures).toBe(0);
    }
    for (let wave = 0; wave < 40; wave++) {
        await page.evaluate(wave => {
            const hook = window.__departurePreview;
            hook.start((['water', 'fire', 'growth'] as const)[wave % 3]!, wave * 80);
            hook.pose(.5); hook.pose(1.1); hook.pose(2);
        }, wave);
        const memory = await page.evaluate(() => window.__departurePreview.clear());
        expect(memory.geometries).toBe(0); expect(memory.textures).toBe(0);
    }
    await testInfo.attach('shared-material-resource-samples', { body: JSON.stringify(records, null, 2), contentType: 'application/json' });
    await page.evaluate(() => window.__departurePreview.dispose());
    expect(errors).toEqual([]);
});

test('committed departures share groups on the board and stop under reduced motion', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('/?hallRoom=element-water', { timeout: 180_000 });
    const canvas = page.locator('canvas[data-webgl-draw-calls]');
    await canvas.waitFor({ timeout: 180_000 });
    for (const suit of ['tide', 'ember', 'moss', 'bone', null] as const) {
        await page.evaluate(async suit => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            const { buildBoard } = await import('/src/shared/board-build-rules.ts');
            const run = useAppStore.getState().run!;
            const tiles = Array.from({ length: 16 }, (_, i) => ({
                id: `${suit}-${i}`, pairKey: `pair-${Math.floor(i / 2)}`, symbol: 'circle', label: 'Material preview',
                suit: suit ?? undefined, state: 'hidden' as const
            }));
            useAppStore.setState({ run: { ...run, status: 'playing', board: buildBoard(1, { fixedTiles: tiles, fixedTilesMode: 'exact' }) } });
        }, suit);
        await expect(page.locator('[data-hidden-tile-count]')).toHaveAttribute('data-hidden-tile-count', '16');
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        await expect(page.locator('[data-board-prestage]')).toHaveAttribute('data-board-prestage', 'idle', { timeout: 30_000 });
        await page.evaluate(async () => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            const run = useAppStore.getState().run!;
            useAppStore.setState({ run: { ...run, board: { ...run.board!, tiles: run.board!.tiles.map((tile, index) =>
                index < 6 ? { ...tile, state: 'removed' as const } : tile) } } });
        });
        await expect.poll(async () => Number(await canvas.getAttribute('data-departure-groups')), { message: `Committed ${suit ?? 'stone'} departure` }).toBeGreaterThan(0);
        const groups = Number(await canvas.getAttribute('data-departure-groups'));
        expect(groups).toBeLessThan(6);
        expect(Number(await canvas.getAttribute('data-departure-physics-particles'))).toBeLessThanOrEqual(groups * (testInfo.project.name.startsWith('phone-') ? 24 : 48));
        await page.waitForTimeout(300);
        await page.screenshot({ path: testInfo.outputPath(`board-${suit}-early.png`) });
        await page.waitForTimeout(500);
        await page.screenshot({ path: testInfo.outputPath(`board-${suit}-late.png`) });
        await expect.poll(async () => Number(await canvas.getAttribute('data-departure-groups')), { timeout: 10_000 }).toBe(0);
        expect(Number(await canvas.getAttribute('data-departure-physics-particles'))).toBe(0);
    }
    await page.evaluate(async () => {
        const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
        const state = useAppStore.getState();
        useAppStore.setState({ settings: { ...state.settings, reduceMotion: true }, run: { ...state.run!, board: { ...state.run!.board!,
            tiles: state.run!.board!.tiles.map(tile => ({ ...tile, state: 'hidden' as const })) } } });
    });
    await page.waitForTimeout(200);
    await page.evaluate(async () => {
        const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
        const run = useAppStore.getState().run!;
        useAppStore.setState({ run: { ...run, board: { ...run.board!, tiles: run.board!.tiles.map(tile => ({ ...tile, state: 'removed' as const })) } } });
    });
    await page.waitForTimeout(300);
    expect(Number(await canvas.getAttribute('data-departure-groups'))).toBe(0);
    expect(errors).toEqual([]);
});
