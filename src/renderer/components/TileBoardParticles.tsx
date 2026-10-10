import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import type { BoardState, GraphicsQualityPreset, RunStatus } from '../../shared/contracts';
import { readElementalGround } from '../../shared/element-ground-rules';
import { hashStringToSeed } from '../../shared/rng';
import { getSceneEffectTier } from '../../shared/graphicsQuality';
import { boardParticleBudget, createBoardParticleSystem } from './boardParticleSystem';
import { collectBoardParticleCues, particleBoardChanged } from './boardParticleCues';
import { itemEffectRecipe, useItemEffectChannel } from './itemEffects';
import { getTileTransform } from './tileBoardTransform';
import type { TileBezelFrameBag } from './tileBoardFrameBag';
import { getRimParticleMood } from './boardParticleRim';
import { beginMatchImpact, MATCH_CONTACT_SECONDS } from './boardMatchImpact';
import { collectGroupArcCues, comboEffectIntensity } from './boardGroupArcs';
import { collectElementCastParticles } from './elementCastParticles';
import { cardDepartureBursts, cardDepartureSparkTint, CARD_DEPARTURE_PARTICLE_DELAY } from './cardDepartureParticles';
import { createCardShardSystem } from './cardShardSystem';
import { createCardElementFxSystem } from './cardElementFx';
import { createCardDepartureWorld } from './cardDepartureWorld';
import type { DepartureSource } from './cardDepartureGrouping';
import { emitRoomSpill } from './roomSpill';
import { Vector3 } from 'three';
import { CARD_PLANE_HEIGHT } from './tileShatter';
import { collectElementReactionParticles } from './elementReactionParticles';
import { useDevOptions } from '../dev/useDevOptions';
import { comboHeatLevels, heatThemeById, type ComboHeatThemeId } from '../../shared/combo-heat-rules';
import { useRealmAmbience, useRealmEventPulse, useRealmSwayLean } from './realmAmbience';
import { ELEMENT_MOTE_SIZE, REALM_AMBIENT_MOTE, realmEventMote, REALM_MOTE_SIZE, elementCardMote, elementMoteCards, realmMoteInterval, realmStatusMotes, ELEMENT_CARD_MOTE, type RealmMote } from './realmParticles';

const PARTICLE_KINDS = ['bomb', 'match', 'flip', 'chain', 'rim', 'ripple', 'arc', 'ember'] as const;
const themeOf = (id: ComboHeatThemeId | undefined) => heatThemeById(id);
let departureInstanceSerial = 0;

export const TileBoardParticles = ({ board, compact, graphicsQuality, reduceMotion, runStatus, frames, cardHeat, combo = 0, comboTheme, time, sharedFrameClock }: {
    board: BoardState;
    compact: boolean;
    graphicsQuality: GraphicsQualityPreset;
    reduceMotion: boolean;
    runStatus: RunStatus;
    frames: RefObject<Map<string, TileBezelFrameBag>>;
    cardHeat: number;
    /** The run's combo: it carries across floors, and every burst and bolt grows with it. */
    combo?: number;
    /** The run's temper (`comboHeatThemeForSeed`): the palette and motion of the embers and bolts. */
    comboTheme?: ComboHeatThemeId;
    time: RefObject<number>;
    sharedFrameClock: boolean;
}) => {
    const { gl, camera } = useThree();
    const comboPopEffects = useDevOptions(state => state.comboPopEffects);
    const departureQuality = getSceneEffectTier({ quality: graphicsQuality, reduceMotion,
        coarsePointer: typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches,
        viewportWidth: typeof window === 'undefined' ? 1280 : window.innerWidth }) === 'lean' ? 'low' : graphicsQuality;
    const system = useMemo(() => createBoardParticleSystem(), []);
    // Every card that leaves breaks into pieces that fall and bounce on the board's floor (`cardShards.ts`).
    const shards = useMemo(() => createCardShardSystem(), []);
    const shardBreaks = useRef(0);
    const departureWorld = useMemo(() => createCardDepartureWorld(), []);
    const departureSerial = useRef(0);
    const departureInstance = useMemo(() => `${performance.timeOrigin}:${++departureInstanceSerial}`, []);
    // A water card liquefies, a fire card combusts, a growth card has a growth spurt (`cardElementFx.ts`).
    const elementFx = useMemo(() => createCardElementFxSystem(), []);
    const previous = useRef<BoardState | null>(null);
    const motion = useRef(reduceMotion);
    const physicalQuality = useRef(departureQuality);
    const activeCount = useRef(-1);
    const peakCount = useRef(0);
    const totals = useRef({ bomb: 0, match: 0, flip: 0, chain: 0, rim: 0, ripple: 0, arc: 0, ember: 0 });
    const nextRimTick = useRef(0);
    const rimTick = useRef(0);
    const nextEmberTick = useRef(0);
    const emberTick = useRef(0);
    const pausedFrame = useRef<boolean | null>(null);
    const nextRealmTick = useRef(0);
    const realmTick = useRef(0);
    const realmBursts = useRef(0);
    const realmEventKey = useRef<string | null>(null);
    const nextElementTick = useRef(0);
    const elementTick = useRef(0);
    const groundTick = useRef(0);
    const groundBursts = useRef(0);
    const statusBursts = useRef(0);
    const nextGroundTick = useRef(0);
    const cellById = useMemo(() => new Map(board.tiles.map((tile, cell) => [tile.id, cell])), [board.tiles]);
    const groundCells = useMemo(() => readElementalGround(board).flatMap((suit, cell) => suit ? [{ suit, cell }] : []), [board]);
    const elementBursts = useRef(0);
    const castBursts = useRef(0);
    const reactionBursts = useRef(0);
    const departureBursts = useRef(0);
    useEffect(() => () => system.dispose(), [system]);
    useEffect(() => () => shards.dispose(), [shards]);
    useEffect(() => () => departureWorld.dispose(), [departureWorld]);
    useEffect(() => () => elementFx.dispose(), [elementFx]);
    useLayoutEffect(() => {
        system.configure(graphicsQuality);
        system.setComboPopEffects(comboPopEffects);
        if (particleBoardChanged(previous.current, board) || motion.current !== reduceMotion || physicalQuality.current !== departureQuality) {
            system.clear();
            shards.clear();
            departureWorld.clear();
            elementFx.clear();
        }
        motion.current = reduceMotion;
        physicalQuality.current = departureQuality;
        const intensity = comboEffectIntensity(combo);
        const energy = Math.max(cardHeat, intensity);
        const theme = themeOf(comboTheme);
        const arcTint = theme.arcTints[intensity < 0.35 ? 0 : intensity < 0.6 ? 1 : intensity < 0.8 ? 2 : 3];
        const surge = comboHeatLevels(combo).surge;
        // Find the floor once for the whole wave, rather than scanning the board for every departure.
        let lowest = Number.POSITIVE_INFINITY;
        for (let cell = 0; cell < board.tiles.length; cell++) {
            lowest = Math.min(lowest, getTileTransform(board.tiles[cell]!, cell, board.columns, board.rows, compact, true, reduceMotion).baseY);
        }
        const floorY = (Number.isFinite(lowest) ? lowest : 0) - CARD_PLANE_HEIGHT * 0.5 - 0.3;
        // Where a card stands now: its live group if it has one, its layout slot if not.
        const anchorOf = (tileId: string) => {
            const index = cellById.get(tileId)!;
            const tile = board.tiles[index]!;
            const transform = getTileTransform(tile, index, board.columns, board.rows, compact, true, reduceMotion);
            const position = frames.current?.get(tileId)?.groupRef.current?.position;
            return {
                x: position?.x ?? transform.baseX + transform.layoutJitterX,
                y: position?.y ?? transform.baseY + transform.layoutJitterY,
                z: position?.z ?? 0.04
            };
        };
        for (const arc of collectGroupArcCues(previous.current, board)) {
            const emitted = system.emitArc({ from: anchorOf(arc.fromTileId), to: anchorOf(arc.toTileId),
                seed: hashStringToSeed(`${arc.fromTileId}>${arc.toTileId}:arc`), time: time.current, delay: arc.delay,
                intensity: arc.kind === 'pair' ? intensity * 0.85 : intensity, reduceMotion, quality: graphicsQuality, tint: arcTint, extraStrands: surge });
            if (emitted > 0) totals.current.arc += 1;
        }
        // Reserve the first detailed departure slots for the pair the player actually matched.
        const departureCues = collectBoardParticleCues(previous.current, board)
            .sort((a, b) => Number(b.kind === 'match') - Number(a.kind === 'match'));
        const physicalSources: DepartureSource[] = [];
        const occurrence = ++departureSerial.current;
        for (const cue of departureCues) {
            const index = cellById.get(cue.tileId)!;
            const tile = board.tiles[index]!;
            const transform = getTileTransform(tile, index, board.columns, board.rows, compact, true, reduceMotion);
            const frame = frames.current?.get(tile.id);
            if (cue.kind === 'match' && sharedFrameClock && frame) beginMatchImpact(frame, time.current);
            const group = frame?.groupRef.current;
            group?.updateMatrix();
            const anchor = group?.position;
            if (cue.kind === 'match' && !reduceMotion) departureWorld.impulse(anchor?.x ?? transform.baseX, anchor?.y ?? transform.baseY, 0, .12);
            const emitted = system.emit({ ...cue,
                delay: cue.delay + (cue.kind === 'match' && !reduceMotion ? MATCH_CONTACT_SECONDS : 0),
                x: anchor?.x ?? transform.baseX + transform.layoutJitterX,
                y: anchor?.y ?? transform.baseY + transform.layoutJitterY,
                z: anchor?.z ?? 0.04,
                time: time.current, seed: hashStringToSeed(`${tile.id}:${cue.kind}`), reduceMotion, quality: graphicsQuality,
                cardMatrix: group?.matrix, energy: cue.kind === 'flip' ? cardHeat : energy,
                tint: cue.kind === 'match' ? cardDepartureSparkTint(tile.suit) : undefined
            });
            if (emitted > 0) totals.current[cue.kind] += 1;
            // ...and as it leaves, it breaks: its pieces thrown off to fall and bounce on the floor under the board.
            if (cue.kind !== 'flip' && !reduceMotion) {
                const sourceKey = `${departureInstance}:${tile.id}:${occurrence}:${time.current.toFixed(3)}`;
                physicalSources.push({ key: sourceKey,
                    material: tile.suit === 'tide' ? 'water' : tile.suit === 'ember' ? 'fire' : tile.suit === 'moss' ? 'growth' : tile.suit === 'bone' ? 'ice' : 'stone',
                    x: anchor?.x ?? transform.baseX + transform.layoutJitterX, y: anchor?.y ?? transform.baseY + transform.layoutJitterY, z: anchor?.z ?? .04,
                    start: time.current + cue.delay + CARD_DEPARTURE_PARTICLE_DELAY * .6,
                    floorY, seed: hashStringToSeed(sourceKey), combo });
                const binding = () => departureWorld.binding(sourceKey);
                const transformed = elementFx.spawn({ tile, x: anchor?.x ?? transform.baseX + transform.layoutJitterX, y: anchor?.y ?? transform.baseY + transform.layoutJitterY, z: (anchor?.z ?? 0.04) + 0.02,
                    seed: hashStringToSeed(sourceKey), time: time.current, delay: cue.delay + CARD_DEPARTURE_PARTICLE_DELAY * 0.6,
                    floorY, quality: departureQuality, binding });
                if (!transformed) shards.spawn({ tile, x: anchor?.x ?? transform.baseX + transform.layoutJitterX, y: anchor?.y ?? transform.baseY + transform.layoutJitterY, z: (anchor?.z ?? 0.04) + 0.02,
                    seed: hashStringToSeed(sourceKey), time: time.current, delay: cue.delay + CARD_DEPARTURE_PARTICLE_DELAY * 0.6,
                    floorY, quality: departureQuality, energy, binding });
                shardBreaks.current += 1;
                // And its material spills into the room, from where the card is on the screen (`roomSpill.ts`).
                const onScreen = new Vector3(anchor?.x ?? transform.baseX, anchor?.y ?? transform.baseY, anchor?.z ?? 0.04).project(camera);
                const canvasRect = gl.domElement.getBoundingClientRect();
                emitRoomSpill({ key: `${tile.id}:${time.current.toFixed(2)}`, suit: tile.suit ?? null,
                    screenX: canvasRect.left + ((onScreen.x + 1) / 2) * canvasRect.width, screenY: canvasRect.top + ((1 - onScreen.y) / 2) * canvasRect.height,
                    delayMs: (cue.delay + CARD_DEPARTURE_PARTICLE_DELAY * 0.6) * 1000 });
                gl.domElement.setAttribute('data-card-shard-breaks', String(shardBreaks.current));
            }
            // ...and throws off its element (`cardDepartureParticles.ts`).
            if (cue.kind !== 'flip') {
                let thrown = 0;
                for (const burst of cardDepartureBursts({ suit: tile.suit,
                    x: anchor?.x ?? transform.baseX + transform.layoutJitterX, y: anchor?.y ?? transform.baseY + transform.layoutJitterY, z: anchor?.z ?? 0.04,
                    seed: hashStringToSeed(`${tile.id}:departure`), time: time.current, delay: cue.delay, quality: graphicsQuality, reduceMotion })) thrown += system.emit(burst);
                if (thrown > 0) departureBursts.current += 1;
            }
            if (cue.kind === 'match' && system.emit({ kind: 'ripple',
                x: anchor?.x ?? transform.baseX, y: anchor?.y ?? transform.baseY, z: 0,
                time: time.current, delay: MATCH_CONTACT_SECONDS, seed: transform.seed,
                reduceMotion, quality: graphicsQuality, energy }) > 0) totals.current.ripple += 1;
        }
        if (physicalSources.length) departureWorld.spawnWave(physicalSources, departureQuality);
        shards.preparePhysics();
        for (const cue of collectElementCastParticles(previous.current, board, graphicsQuality, compact, reduceMotion, time.current)) {
            if (system.emit(cue) > 0) castBursts.current += 1;
        }
        for (const cue of collectElementReactionParticles(previous.current, board, graphicsQuality, compact, reduceMotion, time.current)) {
            if (system.emit(cue) > 0) reactionBursts.current += 1;
        }
        previous.current = board;
        const canvas = gl.domElement;
        canvas.setAttribute('data-particle-budget', String(boardParticleBudget(graphicsQuality)));
        canvas.setAttribute('data-particle-combo', String(Math.max(0, Math.floor(combo))));
        canvas.setAttribute('data-combo-pop-effects', String(comboPopEffects));
        canvas.setAttribute('data-particle-cast-bursts', String(castBursts.current));
        canvas.setAttribute('data-particle-reaction-bursts', String(reactionBursts.current));
        canvas.setAttribute('data-particle-departure-bursts', String(departureBursts.current));
        canvas.setAttribute('data-particle-ground-bursts', String(groundBursts.current));
        canvas.setAttribute('data-particle-status-bursts', String(statusBursts.current));
        for (const kind of PARTICLE_KINDS) {
            canvas.setAttribute(`data-particle-${kind}-bursts`, String(totals.current[kind]));
        }
    }, [board, cardHeat, cellById, combo, comboTheme, comboPopEffects, compact, frames, gl, graphicsQuality, departureQuality, departureInstance, reduceMotion, sharedFrameClock, shards, elementFx, departureWorld, system, time, camera]);
    // Items used on the board (`itemEffects.ts`): each effect's recipe, at its cards or its cell.
    const itemEffectInputs = useRef({ board, compact, graphicsQuality, reduceMotion });
    useLayoutEffect(() => {
        itemEffectInputs.current = { board, compact, graphicsQuality, reduceMotion };
    }, [board, compact, graphicsQuality, reduceMotion]);
    const itemEffectBursts = useRef(0);
    useEffect(
        () =>
            useItemEffectChannel.subscribe((state, before) => {
                if (state.serial === before.serial) return;
                const { board: now, compact: small, graphicsQuality: quality, reduceMotion: still } = itemEffectInputs.current;
                const atCell = (cell: number) => {
                    const tile = now.tiles[cell];
                    if (!tile) return null;
                    const position = frames.current?.get(tile.id)?.groupRef.current?.position;
                    const transform = getTileTransform(tile, cell, now.columns, now.rows, small, true, still);
                    return { x: position?.x ?? transform.baseX + transform.layoutJitterX, y: position?.y ?? transform.baseY + transform.layoutJitterY, z: position?.z ?? 0.04 };
                };
                for (const effect of state.latest) {
                    const anchors = (effect.cell != null ? [atCell(effect.cell)] : effect.tileIds.map((id) => atCell(now.tiles.findIndex((tile) => tile.id === id))))
                        .filter((anchor): anchor is NonNullable<typeof anchor> => anchor != null);
                    const recipe = itemEffectRecipe({ effect, anchors, time: time.current, quality, reduceMotion: still });
                    let emitted = 0;
                    for (const burst of recipe.bursts) emitted += system.emit(burst);
                    for (const arc of recipe.arcs) emitted += system.emitArc(arc);
                    if (emitted > 0) itemEffectBursts.current += 1;
                }
                gl.domElement.setAttribute('data-particle-item-bursts', String(itemEffectBursts.current));
            }),
        [frames, gl, system, time]
    );
    useFrame(() => {
        if (!reduceMotion && (runStatus === 'playing' || runStatus === 'resolving') && time.current >= nextRimTick.current) {
            nextRimTick.current = time.current + (graphicsQuality === 'low' ? 0.24 : graphicsQuality === 'medium' ? 0.16 : 0.1);
            const candidates = [];
            for (const bag of frames.current.values()) {
                const group = bag.groupRef.current;
                if (!group?.visible || group.scale.x < 0.35 || group.scale.y < 0.35) continue;
                const mood = getRimParticleMood(bag.propsRef.current);
                if (mood) candidates.push({ group, mood, seed: bag.propsRef.current.transform.seed });
            }
            const limit = graphicsQuality === 'low' ? 2 : graphicsQuality === 'medium' ? 4 : 6;
            for (let index = 0; index < Math.min(limit, candidates.length); index += 1) {
                const { group, mood, seed } = candidates[(rimTick.current + index) % candidates.length]!;
                group.updateMatrix();
                const emitted = system.emit({ kind: 'rim', rimMood: mood, cardMatrix: group.matrix,
                    x: group.position.x, y: group.position.y, z: group.position.z,
                    time: time.current, seed, reduceMotion, quality: graphicsQuality,
                    energy: mood === 'match' ? 1 : Math.max(cardHeat, mood === 'charge' ? 0.55 : 0.1) });
                if (emitted) totals.current.rim += 1;
            }
            rimTick.current += limit;
            gl.domElement.setAttribute('data-particle-rim-bursts', String(totals.current.rim));
        }
        // The combo heat's embers: from Hot, cards on the board throw sparks that rise off the
        // table, more cards and more often the hotter it gets, in the stage's colour.
        const heat = comboHeatLevels(combo);
        if (!reduceMotion && heat.embers > 0 && (runStatus === 'playing' || runStatus === 'resolving') && time.current >= nextEmberTick.current) {
            nextEmberTick.current = time.current + (graphicsQuality === 'low' ? 0.5 : 0.34) * (1 - heat.heat * 0.45) / (1 + heat.surge * 0.5);
            const groups = [];
            for (const bag of frames.current.values()) {
                const group = bag.groupRef.current;
                if (group?.visible && group.scale.x >= 0.35 && group.scale.y >= 0.35 && bag.propsRef.current.tile.state !== 'removed') groups.push(group);
            }
            const limit = Math.min(groups.length, graphicsQuality === 'low' ? 1 : Math.round(heat.embers));
            for (let index = 0; index < limit; index += 1) {
                const group = groups[(emberTick.current + index) % groups.length]!;
                const emitted = system.emit({ kind: 'ember', x: group.position.x, y: group.position.y, z: group.position.z,
                    time: time.current, seed: (emberTick.current + index) * 7919 + Math.floor(time.current * 10), reduceMotion, quality: graphicsQuality,
                    energy: heat.heat, tint: themeOf(comboTheme).colors[heat.stageIndex], emberMode: themeOf(comboTheme).emberMode });
                if (emitted) totals.current.ember += 1;
            }
            emberTick.current += Math.max(1, limit);
            gl.domElement.setAttribute('data-particle-ember-bursts', String(totals.current.ember));
        }
        // The realm in the air (`realmParticles.ts`): statuses, the realm itself, and its events.
        const playingNow = runStatus === 'playing' || runStatus === 'resolving';
        const emitMote = (group: { position: { x: number; y: number; z: number } }, mote: RealmMote, seed: number, priority?: 'event'): number => {
            const emitted = system.emit({ kind: 'ember', x: group.position.x, y: group.position.y, z: group.position.z,
                time: time.current, seed, reduceMotion, quality: graphicsQuality, energy: mote.energy, tint: mote.tint, emberMode: mote.mode, sizeScale: mote.size ?? REALM_MOTE_SIZE, shape: mote.shape, placement: mote.placement, priority });
            if (emitted) realmBursts.current += 1;
            return emitted;
        };
        const pulse = useRealmEventPulse.getState().event;
        if (pulse && pulse.key !== realmEventKey.current) {
            realmEventKey.current = pulse.key;
            if (!reduceMotion && playingNow && pulse.key !== board.elementCast?.key && !board.elementCast?.reactions?.some(reaction => reaction.eventKey === pulse.key)) {
                const mote = realmEventMote(pulse.kind, pulse.family);
                const bursts = graphicsQuality === 'low' ? 1 : graphicsQuality === 'medium' ? 2 : 3;
                const tileLimit = graphicsQuality === 'low' ? 4 : graphicsQuality === 'medium' ? 8 : 12;
                for (const tileId of [...pulse.tileIds].slice(0, tileLimit)) {
                    const group = frames.current.get(tileId)?.groupRef.current;
                    const cell = cellById.get(tileId);
                    if (cell === undefined) continue;
                    const pos = getTileTransform(board.tiles[cell]!, cell, board.columns, board.rows, compact, false, reduceMotion);
                    const anchor = group?.visible ? group : { position: { x: pos.baseX, y: pos.baseY, z: 0.05 } };
                    for (let n = 0; n < bursts; n += 1) emitMote(anchor, mote, hashStringToSeed(`${pulse.key}:${tileId}:${n}`), 'event');
                }
            }
        }
        const realm = useRealmAmbience.getState().realm;
        if (!reduceMotion && playingNow && realm && time.current >= nextRealmTick.current) {
            nextRealmTick.current = time.current + realmMoteInterval(graphicsQuality);
            const statusCards = [];
            const plainCards = [];
            for (const bag of frames.current.values()) {
                const group = bag.groupRef.current;
                const props = bag.propsRef.current;
                if (!group?.visible || group.scale.x < 0.35 || props.tile.state !== 'hidden' || props.faceUp) continue;
                const motes = realmStatusMotes(props.tile, false);
                if (motes.length) for (const mote of motes) statusCards.push({ group, mote });
                else plainCards.push(group);
            }
            const statusLimit = Math.min(statusCards.length, graphicsQuality === 'low' ? 3 : 8);
            for (let index = 0; index < statusLimit; index += 1) {
                const { group, mote } = statusCards[(realmTick.current + index) % statusCards.length]!;
                if (emitMote(group, mote, realmTick.current * 7907 + index)) statusBursts.current += 1;
            }
            const ambientLimit = Math.min(plainCards.length, graphicsQuality === 'high' ? 2 : 1);
            for (let index = 0; index < ambientLimit; index += 1) {
                const group = plainCards[(realmTick.current * 3 + index * 5) % plainCards.length]!;
                emitMote({ position: { ...group.position, z: -0.04 } }, { ...REALM_AMBIENT_MOTE[realm], placement: 'ground', size: 0.85 }, realmTick.current * 6151 + index);
            }
            realmTick.current += 1;
            gl.domElement.setAttribute('data-particle-realm-bursts', String(realmBursts.current));
            gl.domElement.setAttribute('data-particle-status-bursts', String(statusBursts.current));
        }
        // Every card gives off its own material (`elementCardMote`): flame, liquid, ice, leaf. A few
        // cards a tick, taken in turn so the whole board smoulders, drips, glints and sheds; a charged
        // card is always among them. On a realm floor only, like the rest of the elements: a run
        // with no realm casts nothing, and its air is the combo's alone.
        if (!reduceMotion && playingNow && realm && time.current >= nextElementTick.current) {
            nextElementTick.current = time.current + realmMoteInterval(graphicsQuality);
            const charged = [];
            const plain = [];
            const lean = useRealmSwayLean.getState().lean;
            for (const bag of frames.current.values()) {
                const group = bag.groupRef.current;
                const props = bag.propsRef.current;
                if (!group?.visible || group.scale.x < 0.35 || group.scale.y < 0.35) continue;
                const mote = elementCardMote(props.tile);
                if (!mote) continue;
                if (lean && lean.suit === props.tile.suit && lean.realm !== realm) mote.energy = Math.min(1, mote.energy + lean.progress * 0.3);
                if (props.tile.empowered) charged.push({ group, mote });
                else plain.push({ group, mote });
            }
            const cards = elementMoteCards(graphicsQuality);
            const picks = [];
            for (let index = 0; index < Math.min(charged.length, Math.ceil(cards / 2)); index += 1) picks.push(charged[(elementTick.current + index) % charged.length]!);
            for (let index = 0; picks.length < cards && index < plain.length; index += 1) picks.push(plain[(elementTick.current + index) % plain.length]!);
            picks.forEach(({ group, mote }, index) => {
                const emitted = system.emit({ kind: 'ember', x: group.position.x, y: group.position.y, z: group.position.z,
                    time: time.current, seed: elementTick.current * 5303 + index * 131 + 17, reduceMotion, quality: graphicsQuality,
                    energy: mote.energy, tint: mote.tint, shape: mote.shape, sizeScale: ELEMENT_MOTE_SIZE });
                if (emitted) elementBursts.current += 1;
            });
            elementTick.current += 1;
            gl.domElement.setAttribute('data-particle-element-bursts', String(elementBursts.current));
        }
        if (!reduceMotion && playingNow && groundCells.length && time.current >= nextGroundTick.current) {
            nextGroundTick.current = time.current + realmMoteInterval(graphicsQuality) * 2;
            const limit = Math.min(groundCells.length, graphicsQuality === 'low' ? 2 : 5);
            for (let n = 0; n < limit; n += 1) {
                const { suit, cell } = groundCells[(groundTick.current + n) % groundCells.length]!;
                const pos = getTileTransform(board.tiles[cell]!, cell, board.columns, board.rows, compact, false, reduceMotion);
                if (system.emit({ kind: 'ember', ...ELEMENT_CARD_MOTE[suit], placement: 'ground',
                    x: pos.baseX, y: pos.baseY, z: -0.04, time: time.current, seed: groundTick.current * 919 + n,
                    energy: 0.15, sizeScale: 0.85, reduceMotion, quality: graphicsQuality })) groundBursts.current += 1;
            }
            groundTick.current += limit;
            gl.domElement.setAttribute('data-particle-ground-bursts', String(groundBursts.current));
        }
        const active = system.advance(time.current);
        departureWorld.advance(time.current);
        const departures = departureWorld.stats();
        gl.domElement.setAttribute('data-departure-groups', String(departures.groups));
        gl.domElement.setAttribute('data-departure-physics-particles', String(departures.particles));
        shards.advance(time.current);
        elementFx.advance(time.current);
        if (active > peakCount.current) {
            gl.domElement.setAttribute('data-particle-peak', String(active));
            peakCount.current = active;
        }
        if (activeCount.current !== active) {
            gl.domElement.setAttribute('data-particle-active', String(active));
            activeCount.current = active;
        }
        const paused = runStatus === 'paused';
        if (pausedFrame.current !== paused) {
            gl.domElement.setAttribute('data-particle-paused', String(paused));
            pausedFrame.current = paused;
        }
    });
    return <><primitive object={system.rippleMesh} dispose={null} /><primitive object={system.mesh} dispose={null} /><primitive object={departureWorld.group} dispose={null} /><primitive object={shards.group} dispose={null} /><primitive object={elementFx.group} dispose={null} /></>;
};
