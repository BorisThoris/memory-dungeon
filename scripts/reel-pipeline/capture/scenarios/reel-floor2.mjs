// The reel's gameplay: a real run from the menu (seeded by --runKey), floor 1 off camera, floor 2 on
// camera — the study period, matched pairs with a natural cadence, the break, the floor-clear colophon.
export async function run(api) {
    const { page } = api;
    await page.getByRole('group', { name: /primary actions/i }).getByRole('button', { name: /^play$/i }).evaluate((el) => el.click());
    await page.getByRole('region', { name: /choose your path/i }).waitFor();
    if (api.args.runKey) {
        // A shared-run key (md1:<variant>:<rulesVersion>:<seed>) replays one exact board under the
        // rules version it names, so the take is the same run every time the reel is rebuilt.
        const form = page.getByTestId('choose-path-shared-run');
        await form.getByRole('textbox').fill(String(api.args.runKey));
        await form.evaluate((el) => el.requestSubmit());
    } else {
        await page.getByRole('button', { name: /start run/i }).evaluate((el) => el.click());
    }
    await api.until((s) => s.hud, 10, false);
    await api.hide();

    // Floor 1 at speed, off camera.
    await api.until((s) => s.memorize === 'true', 5, false);
    await api.until((s) => s.memorize !== 'true' && !s.clear, 30, false);
    await api.skip(0.5);
    for (let i = 0; i < 24; i++) {
        const pairs = await api.readPairs();
        if (!pairs.length) break;
        const [a, b] = pairs[0];
        await api.pick(a); await api.skip(0.3); await api.pick(b);
        await api.skip(1.1);
        if ((await api.state()).clear) break;
    }
    await api.until((s) => /Floor\s*2/.test(s.floor), 30, false);

    // Floor 2 on camera from the first frame of the study period.
    await api.until((s) => s.memorize === 'true', 10, false);
    api.mark('memorize');
    await api.until((s) => s.memorize !== 'true', 12, true);
    api.mark('play');
    await api.frames(Math.round(0.6 * api.fps));
    let lastTier = 'none';
    for (let i = 0; i < 20; i++) {
        const pairs = await api.readPairs();
        if (!pairs.length) break;
        const [a, b] = pairs[i % 2 === 0 ? 0 : pairs.length - 1];
        api.mark(`flip-${i}a`, { at: await api.rectOf(a) }); await api.pick(a);
        await api.frames(Math.round(0.5 * api.fps));
        api.mark(`flip-${i}b`, { at: await api.rectOf(b) }); await api.pick(b);
        await api.frames(Math.round(0.4 * api.fps));
        const s = await api.state();
        if (s.tier !== lastTier) { api.mark(`tier-${s.tier}`); lastTier = s.tier; }
        api.mark(`score-${i}`, { score: s.score });
        // Record until the floor clears or the pair has settled, so 'clear' is frame-exact.
        if (await api.until((s) => s.clear, 1.1, true)) { api.mark('clear'); break; }
    }
    await api.until((s) => s.clear, 3, true);
    api.mark('colophon');
    await api.until((s) => !s.clear, 4, true);
    api.mark('colophon-gone');
    await api.frames(Math.round(0.5 * api.fps));
    api.mark('end');
}
