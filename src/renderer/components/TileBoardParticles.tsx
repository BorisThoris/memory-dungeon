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

const PARTICLE_KINDS = ['bomb', 'match', 'flip', 'chain', 'rim', 'ripple', 'arc'] as const;

export const TileBoardParticles = ({ board, compact, graphicsQuality, reduceMotion, runStatus, frames, cardHeat, combo = 0, time, sharedFrameClock }: {
    board: BoardState;
    compact: boolean;
    graphicsQuality: GraphicsQualityPreset;
    reduceMotion: boolean;
    runStatus: RunStatus;
    frames: RefObject<Map<string, TileBezelFrameBag>>;
    cardHeat: number;
    /** The run's combo: it carries across floors, and every burst and bolt grows with it. */
    combo?: number;
    time: RefObject<number>;
    sharedFrameClock: boolean;
}) => {
    const { gl } = useThree();
    const system = useMemo(() => createBoardParticleSystem(), []);
    const previous = useRef<BoardState | null>(null);
    const motion = useRef(reduceMotion);
    const activeCount = useRef(-1);
    const peakCount = useRef(0);
    const totals = useRef({ bomb: 0, match: 0, flip: 0, chain: 0, rim: 0, ripple: 0, arc: 0 });
    const nextRimTick = useRef(0);
    const rimTick = useRef(0);
    const pausedFrame = useRef<boolean | null>(null);
    useEffect(() => () => system.dispose(), [system]);
    useLayoutEffect(() => {
        system.configure(graphicsQuality);
        if (particleBoardChanged(previous.current, board) || motion.current !== reduceMotion) system.clear();
        motion.current = reduceMotion;
        const intensity = comboEffectIntensity(combo);
        const energy = Math.max(cardHeat, intensity);
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
                intensity: arc.kind === 'pair' ? intensity * 0.85 : intensity, reduceMotion, quality: graphicsQuality });
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
        previous.current = board;
        const canvas = gl.domElement;
        canvas.setAttribute('data-particle-budget', String(boardParticleBudget(graphicsQuality)));
        canvas.setAttribute('data-particle-combo', String(Math.max(0, Math.floor(combo))));
        for (const kind of PARTICLE_KINDS) {
            canvas.setAttribute(`data-particle-${kind}-bursts`, String(totals.current[kind]));
        }
    }, [board, cardHeat, combo, compact, frames, gl, graphicsQuality, reduceMotion, sharedFrameClock, system, time]);
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
