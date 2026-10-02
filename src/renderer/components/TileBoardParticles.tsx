import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import type { BoardState, GraphicsQualityPreset, RunStatus } from '../../shared/contracts';
import { hashStringToSeed } from '../../shared/rng';
import { boardParticleBudget, createBoardParticleSystem } from './boardParticleSystem';
import { collectBoardParticleCues, particleBoardChanged } from './boardParticleCues';
import { getTileTransform } from './tileBoardTransform';
import type { TileBezelFrameBag } from './tileBoardFrameBag';
import { getRimParticleMood } from './boardParticleRim';
import { beginMatchImpact, MATCH_CONTACT_SECONDS } from './boardMatchImpact';
import { collectGroupArcCues, comboEffectIntensity } from './boardGroupArcs';
import { collectElementCastParticles } from './elementCastParticles';
import { comboHeatLevels, heatThemeById, type ComboHeatThemeId } from '../../shared/combo-heat-rules';
import { useRealmAmbience, useRealmEventPulse } from './realmAmbience';
import { ELEMENT_MOTE_SIZE, REALM_AMBIENT_MOTE, REALM_EVENT_MOTE, REALM_MOTE_SIZE, elementCardMote, elementMoteCards, realmMoteInterval, realmStatusMote, type RealmMote } from './realmParticles';

const PARTICLE_KINDS = ['bomb', 'match', 'flip', 'chain', 'rim', 'ripple', 'arc', 'ember'] as const;
const themeOf = (id: ComboHeatThemeId | undefined) => heatThemeById(id);

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
    const { gl } = useThree();
    const system = useMemo(() => createBoardParticleSystem(), []);
    const previous = useRef<BoardState | null>(null);
    const motion = useRef(reduceMotion);
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
    const elementBursts = useRef(0);
    const castBursts = useRef(0);
    useEffect(() => () => system.dispose(), [system]);
    useLayoutEffect(() => {
        system.configure(graphicsQuality);
        if (particleBoardChanged(previous.current, board) || motion.current !== reduceMotion) system.clear();
        motion.current = reduceMotion;
        const intensity = comboEffectIntensity(combo);
        const energy = Math.max(cardHeat, intensity);
        const theme = themeOf(comboTheme);
        const arcTint = theme.arcTints[intensity < 0.35 ? 0 : intensity < 0.6 ? 1 : intensity < 0.8 ? 2 : 3];
        const surge = comboHeatLevels(combo).surge;
        // Where a card stands now: its live group if it has one, its layout slot if not.
        const anchorOf = (tileId: string) => {
            const index = board.tiles.findIndex((tile) => tile.id === tileId);
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
        for (const cue of collectBoardParticleCues(previous.current, board)) {
            const index = board.tiles.findIndex((tile) => tile.id === cue.tileId);
            const tile = board.tiles[index]!;
            const transform = getTileTransform(tile, index, board.columns, board.rows, compact, true, reduceMotion);
            const frame = frames.current?.get(tile.id);
            if (cue.kind === 'match' && sharedFrameClock && frame) beginMatchImpact(frame, time.current);
            const group = frame?.groupRef.current;
            group?.updateMatrix();
            const anchor = group?.position;
            const emitted = system.emit({ ...cue,
                delay: cue.delay + (cue.kind === 'match' && !reduceMotion ? MATCH_CONTACT_SECONDS : 0),
                x: anchor?.x ?? transform.baseX + transform.layoutJitterX,
                y: anchor?.y ?? transform.baseY + transform.layoutJitterY,
                z: anchor?.z ?? 0.04,
                time: time.current, seed: hashStringToSeed(`${tile.id}:${cue.kind}`), reduceMotion, quality: graphicsQuality,
                cardMatrix: group?.matrix, energy: cue.kind === 'flip' ? cardHeat : energy
            });
            if (emitted > 0) totals.current[cue.kind] += 1;
            if (cue.kind === 'match' && system.emit({ kind: 'ripple',
                x: anchor?.x ?? transform.baseX, y: anchor?.y ?? transform.baseY, z: 0,
                time: time.current, delay: MATCH_CONTACT_SECONDS, seed: transform.seed,
                reduceMotion, quality: graphicsQuality, energy }) > 0) totals.current.ripple += 1;
        }
        for (const cue of collectElementCastParticles(previous.current, board, graphicsQuality, compact, reduceMotion, time.current)) {
            if (system.emit(cue) > 0) castBursts.current += 1;
        }
        previous.current = board;
        const canvas = gl.domElement;
        canvas.setAttribute('data-particle-budget', String(boardParticleBudget(graphicsQuality)));
        canvas.setAttribute('data-particle-combo', String(Math.max(0, Math.floor(combo))));
        canvas.setAttribute('data-particle-cast-bursts', String(castBursts.current));
        for (const kind of PARTICLE_KINDS) {
            canvas.setAttribute(`data-particle-${kind}-bursts`, String(totals.current[kind]));
        }
    }, [board, cardHeat, combo, comboTheme, compact, frames, gl, graphicsQuality, reduceMotion, sharedFrameClock, system, time]);
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
        const emitMote = (group: { position: { x: number; y: number; z: number } }, mote: RealmMote, seed: number): void => {
            const emitted = system.emit({ kind: 'ember', x: group.position.x, y: group.position.y, z: group.position.z,
                time: time.current, seed, reduceMotion, quality: graphicsQuality, energy: mote.energy, tint: mote.tint, emberMode: mote.mode, sizeScale: mote.size ?? REALM_MOTE_SIZE });
            if (emitted) realmBursts.current += 1;
        };
        const pulse = useRealmEventPulse.getState().event;
        if (pulse && pulse.key !== realmEventKey.current) {
            realmEventKey.current = pulse.key;
            if (!reduceMotion && playingNow && pulse.key !== board.elementCast?.key) {
                const mote = REALM_EVENT_MOTE[pulse.family];
                const bursts = graphicsQuality === 'low' ? 1 : graphicsQuality === 'medium' ? 2 : 3;
                for (const tileId of pulse.tileIds) {
                    const group = frames.current.get(tileId)?.groupRef.current;
                    if (!group?.visible) continue;
                    for (let n = 0; n < bursts; n += 1) emitMote(group, mote, hashStringToSeed(`${pulse.key}:${tileId}:${n}`));
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
                const mote = realmStatusMote(props.tile, false);
                if (mote) statusCards.push({ group, mote });
                else plainCards.push(group);
            }
            const statusLimit = Math.min(statusCards.length, graphicsQuality === 'low' ? 1 : 3);
            for (let index = 0; index < statusLimit; index += 1) {
                const { group, mote } = statusCards[(realmTick.current + index) % statusCards.length]!;
                emitMote(group, mote, realmTick.current * 7907 + index);
            }
            const ambientLimit = Math.min(plainCards.length, graphicsQuality === 'low' ? 1 : graphicsQuality === 'medium' ? 2 : 3);
            for (let index = 0; index < ambientLimit; index += 1) {
                const group = plainCards[(realmTick.current * 3 + index * 5) % plainCards.length]!;
                emitMote(group, REALM_AMBIENT_MOTE[realm], realmTick.current * 6151 + index);
            }
            realmTick.current += 1;
            gl.domElement.setAttribute('data-particle-realm-bursts', String(realmBursts.current));
        }
        // Every card gives off its own material (`elementCardMote`): flame, liquid, ice, leaf. A few
        // cards a tick, taken in turn so the whole board smoulders, drips, glints and sheds; a charged
        // card is always among them. On a realm floor only, like the rest of the elements: a run
        // with no realm casts nothing, and its air is the combo's alone.
        if (!reduceMotion && playingNow && realm && time.current >= nextElementTick.current) {
            nextElementTick.current = time.current + realmMoteInterval(graphicsQuality);
            const charged = [];
            const plain = [];
            for (const bag of frames.current.values()) {
                const group = bag.groupRef.current;
                const props = bag.propsRef.current;
                if (!group?.visible || group.scale.x < 0.35 || props.faceUp) continue;
                const mote = elementCardMote(props.tile);
                if (!mote) continue;
                if (props.tile.empowered) charged.push({ group, mote });
                else plain.push({ group, mote });
            }
            const cards = elementMoteCards(graphicsQuality);
            const picks = [];
            for (let index = 0; index < Math.min(charged.length, Math.ceil(cards / 2)); index += 1) picks.push(charged[(elementTick.current + index) % charged.length]!);
            for (let index = 0; picks.length < cards && index < plain.length; index += 1) picks.push(plain[(elementTick.current * 3 + index * 5) % plain.length]!);
            picks.forEach(({ group, mote }, index) => {
                const emitted = system.emit({ kind: 'ember', x: group.position.x, y: group.position.y, z: group.position.z,
                    time: time.current, seed: elementTick.current * 5303 + index * 131 + 17, reduceMotion, quality: graphicsQuality,
                    energy: mote.energy, tint: mote.tint, shape: mote.shape, sizeScale: ELEMENT_MOTE_SIZE });
                if (emitted) elementBursts.current += 1;
            });
            elementTick.current += 1;
            gl.domElement.setAttribute('data-particle-element-bursts', String(elementBursts.current));
        }
        const active = system.advance(time.current);
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
    return <><primitive object={system.rippleMesh} dispose={null} /><primitive object={system.mesh} dispose={null} /></>;
};
