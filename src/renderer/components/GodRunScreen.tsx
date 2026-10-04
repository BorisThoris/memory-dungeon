import { useEffect, useRef, useState } from 'react';
import type { RunState } from '../../shared/contracts';
import { fieldPairAlive, findLiveFieldPair } from '../../shared/card-field';
import { canCastGodMeteor, godPerkPrice, godRerollPrice, godSupplyPrice, type GodRun } from '../../shared/god-run-engine';
import { GOD_PERKS, godBuildEffects, godBuildSynergies, godPerkPotentialSynergies, type GodPerkId } from '../../shared/god-run-perks';
import { useAppStore } from '../store/useAppStore';
import { useEffectiveReducedMotion } from '../hooks/useEffectiveReducedMotion';
import { createGodFieldRenderer, drawGodFieldFallback, type FieldView } from './godFieldRenderer';
import styles from './GodRunScreen.module.css';
import { clearGodCheckpoint, saveGodCheckpoint } from '../store/godRunCheckpoint';
import OverlayModal from './OverlayModal';

const compactGodNumber = (value: string | number | bigint): string => {
    const text = String(value), suffixes = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
    if (text.length < 4) return text;
    const group = Math.floor((text.length - 1) / 3);
    const leading = text.slice(0, text.length - group * 3);
    return `${leading}.${text.slice(leading.length, leading.length + 1)}${suffixes[group] ?? `e${group * 3}`}`;
};
const SYMBOLS = ['☀', '☽', '✦', '♜', '♠', '◆'];
const NAMES = ['Sun', 'Moon', 'Star', 'Tower', 'Leaf', 'Diamond'];

function CardFieldView({ god, reduced, low, target, onTarget }: { god: GodRun; reduced: boolean; low: boolean; target: readonly [number, number]; onTarget: (target: [number, number]) => void }) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const renderer = useRef<ReturnType<typeof createGodFieldRenderer>>(null);
    const [fallback, setFallback] = useState(false);
    const [view, setView] = useState<FieldView>({ zoom: 1, x: .5, y: .5 });
    useEffect(() => {
        if (!canvas.current || fallback) return;
        let disposed = false;
        const reportUnavailable = () => queueMicrotask(() => { if (!disposed) setFallback(true); });
        try { renderer.current = createGodFieldRenderer(canvas.current); if (!renderer.current) reportUnavailable(); }
        catch { reportUnavailable(); }
        const node = canvas.current;
        const lost = (event: Event) => { event.preventDefault(); setFallback(true); };
        node.addEventListener('webglcontextlost', lost);
        return () => { disposed = true; renderer.current?.dispose(); renderer.current = null; node.removeEventListener('webglcontextlost', lost); };
    }, [fallback]);
    useEffect(() => {
        if (!canvas.current) return;
        const frame = { field: god.field, view, effects: god.effects, clockMs: god.clockMs, reduced, low, target };
        if (fallback) drawGodFieldFallback(canvas.current, frame); else renderer.current?.draw(frame);
    }, [god, view, reduced, low, target, fallback]);
    const move = (x: number, y: number) => setView(v => ({ ...v, x: Math.max(.5 / v.zoom, Math.min(1 - .5 / v.zoom, v.x + x / v.zoom)), y: Math.max(.5 / v.zoom, Math.min(1 - .5 / v.zoom, v.y + y / v.zoom)) }));
    const zoom = (factor: number) => setView(v => {
        const z = Math.max(1, Math.min(256, v.zoom * factor));
        return { zoom: z, x: Math.max(.5 / z, Math.min(1 - .5 / z, v.x)), y: Math.max(.5 / z, Math.min(1 - .5 / z, v.y)) };
    });
    return <section className={styles.field} aria-label="Living card field">
        <canvas key={fallback ? 'fallback' : 'gpu'} ref={canvas} aria-label={`${god.field.livePairs * 2} living cards. Tap the field to aim a meteor; use the buttons to zoom and move.`}
            onClick={event => {
                const rect = event.currentTarget.getBoundingClientRect();
                onTarget([Math.max(0, Math.min(god.field.columns - 1, ((event.clientX - rect.left) / rect.width / view.zoom - .5 / view.zoom + view.x) * god.field.columns)), Math.max(0, Math.min(god.field.rows - 1, ((event.clientY - rect.top) / rect.height / view.zoom - .5 / view.zoom + view.y) * god.field.rows))]);
            }} />
        <div className={styles.fieldLegend}><span>{view.zoom === 1 ? 'THE LIVING ARCHIVE' : `DETAIL ×${view.zoom}`}</span><span>{god.field.livePairs === god.field.pairCapacity ? 'Zoom to inspect cards' : `${Math.floor((1 - god.field.livePairs / god.field.pairCapacity) * 1000) / 10}% harvested`}</span></div>
        <div className={styles.viewControls} aria-label="Field view controls">
            <button aria-label="Zoom out" onClick={() => zoom(.5)} disabled={view.zoom === 1}>−</button>
            <button aria-label="Zoom in" onClick={() => zoom(2)} disabled={view.zoom === 256}>+</button>
            <button aria-label="Move field left" onClick={() => move(-.3,0)} disabled={view.zoom === 1}>←</button>
            <button aria-label="Move field up" onClick={() => move(0,-.3)} disabled={view.zoom === 1}>↑</button>
            <button aria-label="Move field down" onClick={() => move(0,.3)} disabled={view.zoom === 1}>↓</button>
            <button aria-label="Move field right" onClick={() => move(.3,0)} disabled={view.zoom === 1}>→</button>
        </div>
    </section>;
}

export default function GodRunScreen({ run }: { run: RunState & { godRun: GodRun } }) {
    const god = run.godRun;
    const command = useAppStore(s => s.godCommand);
    const settings = useAppStore(s => s.settings);
    const reduced = useEffectiveReducedMotion(settings.reduceMotion);
    const [paused, setPaused] = useState(false);
    const [target, setTarget] = useState<[number, number] | null>(null);
    const [exitOpen, setExitOpen] = useState(false);
    const [saveError, setSaveError] = useState(false);
    const latest = useRef(run);
    useEffect(() => { latest.current = run; }, [run]);
    useEffect(() => {
        const save = () => { void saveGodCheckpoint(latest.current).then(() => setSaveError(false)).catch(() => setSaveError(true)); };
        const timer = window.setInterval(save, 15_000);
        const hidden = () => { if (document.hidden) save(); };
        document.addEventListener('visibilitychange',hidden);
        return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange',hidden); };
    }, []);
    useEffect(() => {
        if (god.phase === 'camp' || god.phase === 'failed' || paused) void saveGodCheckpoint(latest.current).then(() => setSaveError(false)).catch(() => setSaveError(true));
    }, [god.phase, god.gold, paused]);
    useEffect(() => {
        let last = performance.now();
        const timer = window.setInterval(() => {
            const now = performance.now(), dt = now - last; last = now;
            if (!document.hidden && !paused && !exitOpen) command({ type: 'tick', ms: dt });
        }, 50);
        return () => window.clearInterval(timer);
    }, [command, paused, exitOpen]);
    useEffect(() => {
        const key = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); setPaused(p => !p); }
        };
        window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
    }, []);
    const build = godBuildEffects(god.perks), synergies = godBuildSynergies(god.perks);
    const aim: [number, number] = target ? [Math.min(target[0], god.field.columns-1), Math.min(target[1], god.field.rows-1)] : [god.field.columns / 2, god.field.rows / 2];
    const unique = [...new Set(god.hand)];
    const camp = god.phase === 'camp', failed = god.phase === 'failed', locked = paused || exitOpen || run.status === 'paused';
    const latestEffect = god.effects.at(-1);
    const resume = () => { setPaused(false); setExitOpen(false); if (run.status === 'paused') useAppStore.getState().resume(); };
    const aimSurvivor = () => {
        const pair = findLiveFieldPair(god.field, god.nextEffectId);
        if (pair !== null) setTarget([pair % god.field.columns, Math.floor(pair / god.field.columns)]);
    };
    return <main className={styles.screen} data-god-run data-phase={god.phase}>
        <div inert={locked}>
        <header className={styles.header}>
            <div><span className={styles.eyebrow}>MEMORY DUNGEON / ENDLESS</span><h1>{camp ? 'The constellation forge' : failed ? 'The archive remembers' : `Depth ${god.wave + 3}`}</h1></div>
            <button onClick={() => setPaused(p => !p)} aria-pressed={paused}>{paused ? 'Resume' : 'Pause'}</button>
        </header>
        <div className={styles.stats}>
            <div><span>Living cards</span><strong title={String(god.field.livePairs * 2)} data-live-cards={god.field.livePairs * 2}>{compactGodNumber(god.field.livePairs * 2)}</strong></div>
            <div><span>Gold</span><strong title={god.gold}>{compactGodNumber(god.gold)}</strong></div>
            <div><span>Miss bank</span><strong>{god.misses}<small> / {build.missCapacity}</small></strong></div>
            <div><span>Total harvested</span><strong title={god.clearedCards}>{compactGodNumber(god.clearedCards)}</strong></div>
        </div>
        {camp ? <section className={styles.camp} aria-label="Random perk choices">
            <div className={styles.campIntro}><h2>{god.wave === 0 ? 'Small memories. Immense consequences.' : 'Shape your next thousand miracles.'}</h2><p>Choose one perk, stack an old favorite, or save your gold. Every gift has a cost. Another forge awaits after three waves.</p></div>
            <div className={styles.offers}>{god.offers.map(id => {
                const perk = GOD_PERKS[id], price = godPerkPrice(god, id), combos = godPerkPotentialSynergies(god.perks,id);
                return <article key={id} className={styles.perk} data-perk={id}>
                    <span className={styles.eyebrow}>{perk.rarity} · {perk.role} · rank {(god.perks[id] ?? 0) + 1}</span><h3>{perk.title}</h3>
                    <p className={styles.benefit}>{perk.benefit}</p><p className={styles.drawback}>Cost: {perk.drawback}</p>
                    <p>{perk.stacking}</p>{combos.map(combo => <p className={styles.synergy} key={combo.title}>✦ {combo.title}: {combo.body}</p>)}
                    <button disabled={locked || god.pickedPerk || BigInt(god.gold) < price} onClick={() => command({ type:'buy', id })}>{god.pickedPerk ? 'Choice made' : `Take · ${compactGodNumber(price)} gold`}</button>
                </article>;
            })}</div>
            <div className={styles.campActions}>
                <button disabled={locked || god.pickedPerk || BigInt(god.gold) < godRerollPrice(god)} onClick={() => command({type:'reroll'})}>Reroll · {compactGodNumber(godRerollPrice(god))}</button>
                <button disabled={locked || god.misses >= build.missCapacity || BigInt(god.gold) < godSupplyPrice(god)} onClick={() => command({type:'supply'})}>Restore a miss · {compactGodNumber(godSupplyPrice(god))}</button>
                <button className={styles.primary} disabled={locked} onClick={() => { setTarget(null); command({type:'continue'}); }}>Enter wave {god.wave + 1} →</button>
            </div>
        </section> : <>
            <div className={styles.playArea}>
                <CardFieldView god={god} reduced={reduced} low={settings.graphicsQuality === 'low'} target={aim} onTarget={setTarget} />
                <section className={styles.handPanel} aria-label="Focused memory hand">
                    <div className={styles.handTitle}><h2>{failed ? 'Run complete' : god.phase === 'cleared' ? 'Field harvested' : god.studyRemainingMs > 0 ? 'Study the hand' : 'Remember. Ignite.'}</h2><span>{god.studyRemainingMs > 0 ? `${(god.studyRemainingMs / 1000).toFixed(1)}s` : `×${god.combo}`}</span></div>
                    <p>Match real pairs from the field. Each match releases a burst and charges your meteor. Archivists may harvest cards from your hand.</p>
                    <div className={styles.hand} data-hand-nonce={god.handNonce}>{god.hand.map((pair,index) => {
                        const alive = fieldPairAlive(god.field,pair), face = god.studyRemainingMs > 0 || god.flipped.includes(index), symbol = unique.indexOf(pair);
                        return <button key={`${god.handNonce}:${index}`} className={`${styles.card} ${face ? styles.face : ''}`} data-card-index={index} data-alive={alive} disabled={locked || failed || !alive || god.studyRemainingMs > 0 || god.resolveAtMs > 0 || god.flipped.includes(index)} aria-label={!alive ? `Card ${index+1}, harvested` : face ? `Card ${index+1}, ${NAMES[symbol]}` : `Card ${index+1}, face down`} onClick={() => command({type:'flip',index})}>{alive ? face ? SYMBOLS[symbol] : '✧' : '·'}</button>;
                    })}</div>
                    <div className={styles.meteorMeter}><span>Meteor charge</span><span>{Math.floor(god.charge)} / {Math.ceil(build.meteorChargeCost)}</span><progress max={build.meteorChargeCost} value={god.charge} aria-label="Meteor charge" /></div>
                    <div className={styles.meteorActions}><button onClick={aimSurvivor} disabled={locked || failed || god.field.livePairs === 0}>Aim at survivors</button><button className={styles.primary} disabled={locked || !canCastGodMeteor(god)} onClick={() => command({type:'meteor',x:aim[0],y:aim[1]})}>☄ Call meteor</button></div>
                    <p>{!build.meteorUnlocked && god.wave < 3 ? 'Meteors awaken at wave 3, or immediately with Comet Core.' : god.cooldownUntilMs > god.clockMs ? `Meteor cooling · ${Math.ceil((god.cooldownUntilMs-god.clockMs)/1000)}s` : 'Tap the field to aim, then call your meteor.'}</p>
                    <div className={styles.callout} aria-live={latestEffect?.kind === 'archive' || latestEffect?.kind === 'chain' ? 'off' : 'polite'} aria-atomic="true">{latestEffect && god.clockMs-latestEffect.atMs < 1500 ? `${latestEffect.kind === 'meteor' ? 'METEOR' : latestEffect.kind === 'archive' ? 'ARCHIVE' : god.combo > 1 ? `COMBO ×${god.combo}` : 'BURST'} · ${compactGodNumber(latestEffect.clearedCards)} cards` : '\u00a0'}</div>
                </section>
            </div>
            {failed && <section className={styles.ending}><h2>A run worth remembering.</h2><p>You reached wave {god.wave}, held {compactGodNumber(god.peakCards)} cards at once, and harvested {compactGodNumber(god.clearedCards)}.</p><button className={styles.primary} onClick={() => { void clearGodCheckpoint().then(() => useAppStore.getState().restartRun()).catch(() => setSaveError(true)); }}>Start a new run</button></section>}
        </>}
        <details className={styles.build}><summary>Your constellation · {Object.values(god.perks).reduce((a,b) => a+(b ?? 0),0)} perks · {synergies.length} combinations</summary><div className={styles.buildBody}>
            {Object.entries(god.perks).map(([key,rank]) => <p key={key}><strong>{GOD_PERKS[key as GodPerkId].title} ×{rank}</strong> — {GOD_PERKS[key as GodPerkId].benefit} <span className={styles.drawback}>{GOD_PERKS[key as GodPerkId].drawback}</span></p>)}
            {synergies.map(combo => <p className={styles.synergy} key={combo.title}><strong>{combo.title}</strong> — {combo.body}</p>)}
            {Object.keys(god.perks).length === 0 && <p>Your first perk will start a new constellation.</p>}
        </div></details>
        <footer className={styles.footer}><span>Wave {god.wave} · Next forge {god.wave === 0 ? 3 : Math.ceil((god.wave + (camp ? 1 : 0)) / 3) * 3} · Autosaved every 15s</span><button onClick={() => setExitOpen(true)}>Save & leave</button></footer>
        {saveError && <p role="alert">The checkpoint could not be saved. Keep this tab open and try Save & leave again.</p>}
        </div>
        {locked && <OverlayModal title={exitOpen ? 'Save this constellation?' : 'Time stands still.'} subtitle="Your engines are paused. Resume this run from the main menu." onEscape={resume} actions={[
            {label:'Keep playing',onClick:resume,variant:'primary'},
            ...(exitOpen ? [{label:'Save and return to menu',onClick:()=>{ void saveGodCheckpoint(latest.current).then(()=>useAppStore.getState().goToMenu()).catch(()=>setSaveError(true)); }}] : [])
        ]}>{saveError ? <p role="alert">Your checkpoint could not be saved. Keep this tab open and try again.</p> : null}</OverlayModal>}
    </main>;
}
