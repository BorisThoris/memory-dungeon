import { describe, expect, it } from 'vitest';
import { Group } from 'three';
import type { Tile } from '../../shared/contracts';
import {
    advanceScheduledTileBezelFrames,
    scheduleTileBezelFrameActivity,
    shouldAdvanceTileBezelThisFrame,
    type TileBezelActivityBag
} from './tileFrameActivity';

const baseTile = (overrides: Partial<Tile> = {}): Tile => ({
    id: 't1',
    label: 'A',
    pairKey: 'pair-a',
    state: 'hidden',
    symbol: 'A',
    ...overrides
});

const makeBag = (opts: {
    p: TileBezelActivityBag['propsRef']['current'];
    group?: Group;
    refs?: Partial<
        Pick<
            TileBezelActivityBag,
            | 'flipPopT0Ref'
            | 'faceUpStructBlendRef'
            | 'faceUpStructT0Ref'
            | 'matchPulseRef'
            | 'matchedVictoryBurstT0Ref'
            | 'liftSmoothRef'
            | 'pressingOnCardRef'
            | 'focusDimBlendRef'
        >
    >;
    lastActivityVisualGateOverride?: TileBezelActivityBag['lastActivityVisualGateRef'];
}): TileBezelActivityBag => {
    const group = opts.group ?? new Group();
    const flipPopT0Ref = { current: opts.refs?.flipPopT0Ref?.current ?? null };
    const faceUpStructBlendRef = { current: opts.refs?.faceUpStructBlendRef?.current ?? 0 };
    const faceUpStructT0Ref = { current: opts.refs?.faceUpStructT0Ref?.current ?? null };
    const matchPulseRef = { current: opts.refs?.matchPulseRef?.current ?? 0 };
    const matchedVictoryBurstT0Ref = { current: opts.refs?.matchedVictoryBurstT0Ref?.current ?? null };
    const liftSmoothRef = { current: opts.refs?.liftSmoothRef?.current ?? 0 };
    const pressingOnCardRef = { current: opts.refs?.pressingOnCardRef?.current ?? false };
    const focusDimBlendRef = { current: opts.refs?.focusDimBlendRef?.current ?? 0 };
    const lastActivityVisualGateRef =
        opts.lastActivityVisualGateOverride ?? {
            current: {
                textureRevision: opts.p.textureRevision,
                keyboardFocused: opts.p.keyboardFocused,
                focusDimmed: opts.p.focusDimmed,
                graphicsQuality: opts.p.graphicsQuality
            }
        };

    return {
        propsRef: { current: opts.p },
        groupRef: { current: group },
        flipPopT0Ref,
        faceUpStructBlendRef,
        faceUpStructT0Ref,
        matchPulseRef,
        matchedVictoryBurstT0Ref,
        liftSmoothRef,
        pressingOnCardRef,
        focusDimBlendRef,
        lastActivityVisualGateRef
    };
};

describe('shouldAdvanceTileBezelThisFrame', () => {
    it('schedules requested frames immediately and resets the idle streak', () => {
        expect(scheduleTileBezelFrameActivity(true, 5)).toEqual({
            nextIdleStreak: 0,
            runFrame: true
        });
    });

    it('keeps two grace frames after a tile stops requesting work', () => {
        expect(scheduleTileBezelFrameActivity(false, 0)).toEqual({
            nextIdleStreak: 1,
            runFrame: true
        });
        expect(scheduleTileBezelFrameActivity(false, 1)).toEqual({
            nextIdleStreak: 2,
            runFrame: true
        });
        expect(scheduleTileBezelFrameActivity(false, 2)).toEqual({
            nextIdleStreak: 3,
            runFrame: false
        });
    });

    it('advances scheduled tile frames and records idle streaks per tile', () => {
        const pForTile = (id: string) => ({
            reduceMotion: false,
            faceUp: false,
            pickable: true,
            focusDimmed: false,
            keyboardFocused: false,
            graphicsQuality: 'high' as const,
            textureRevision: 0,
            resolvingSelection: null,
            shuffleMotionDeadlineMs: 0,
            shuffleMotionBudgetMs: 0,
            shuffleStaggerTileCount: 0,
            boardEntranceMotionDeadlineMs: 0,
            boardEntranceMotionBudgetMs: 0,
            boardEntranceStaggerTileCount: 0,
            tile: baseTile({ id }),
            tileFieldParallaxEnabled: false,
            fieldAmp: 1,
            fieldTiltRef: { current: { x: 0, y: 0 } },
            hoverTiltRef: { current: { tileId: null, x: 0, y: 0 } },
            transform: {
                imperfectionRotationX: 0,
                imperfectionRotationZ: 0,
                layoutYaw: 0,
                flipRotationY: Math.PI,
                baseX: 0,
                baseY: 0,
                imperfectionX: 0,
                imperfectionY: 0,
                layoutJitterX: 0,
                layoutJitterY: 0,
                layoutJitterZ: 0
            }
        }) as TileBezelActivityBag['propsRef']['current'];
        const bags = new Map([
            ['a', makeBag({ p: pForTile('a') })],
            ['b', makeBag({ p: pForTile('b') })],
            ['c', makeBag({ p: pForTile('c') })]
        ]);
        const idleStreaks = new Map([
            ['a', 3],
            ['b', 0],
            ['c', 2]
        ]);
        const advanced: string[] = [];

        const result = advanceScheduledTileBezelFrames({
            advanceFrame: (bag) => advanced.push(bag.propsRef.current.tile.id),
            bags,
            clockElapsedTime: 10,
            idleStreaks,
            nowMs: 1_000,
            shouldAdvance: (bag, clockElapsedTime, nowMs) => {
                expect(clockElapsedTime).toBe(10);
                expect(nowMs).toBe(1_000);
                return bag.propsRef.current.tile.id === 'a';
            }
        });

        expect(result).toEqual({ advancedCount: 2, scheduledCount: 3 });
        expect(advanced).toEqual(['a', 'b']);
        expect([...idleStreaks.entries()]).toEqual([
            ['a', 0],
            ['b', 1],
            ['c', 3]
        ]);
    });

    it('returns true while shuffle motion window is active', () => {
        const nowMs = 1_000_000;
        const p = {
            reduceMotion: false,
            faceUp: false,
            pickable: true,
            focusDimmed: false,
            keyboardFocused: false,
            graphicsQuality: 'high' as const,
            textureRevision: 0,
            resolvingSelection: null,
            shuffleMotionDeadlineMs: nowMs + 500,
            shuffleMotionBudgetMs: 400,
            shuffleStaggerTileCount: 12,
            boardEntranceMotionDeadlineMs: 0,
            boardEntranceMotionBudgetMs: 0,
            boardEntranceStaggerTileCount: 0,
            tile: baseTile(),
            tileFieldParallaxEnabled: false,
            fieldAmp: 1,
            fieldTiltRef: { current: { x: 0, y: 0 } },
            hoverTiltRef: { current: { tileId: null, x: 0, y: 0 } },
            transform: {
                imperfectionRotationX: 0,
                imperfectionRotationZ: 0,
                layoutYaw: 0,
                flipRotationY: Math.PI,
                baseX: 0,
                baseY: 0,
                imperfectionX: 0,
                imperfectionY: 0,
                layoutJitterX: 0,
                layoutJitterY: 0,
                layoutJitterZ: 0
            }
        } as TileBezelActivityBag['propsRef']['current'];

        const bag = makeBag({ p });
        expect(shouldAdvanceTileBezelThisFrame(bag, 10, nowMs)).toBe(true);
    });

    it('returns false for a fully settled hidden tile with matching group pose', () => {
        const nowMs = 1_000_000;
        const p = {
            reduceMotion: false,
            faceUp: false,
            pickable: false,
            focusDimmed: false,
            keyboardFocused: false,
            graphicsQuality: 'high' as const,
            textureRevision: 0,
            resolvingSelection: null,
            shuffleMotionDeadlineMs: 0,
            shuffleMotionBudgetMs: 0,
            shuffleStaggerTileCount: 0,
            boardEntranceMotionDeadlineMs: 0,
            boardEntranceMotionBudgetMs: 0,
            boardEntranceStaggerTileCount: 0,
            tile: baseTile(),
            tileFieldParallaxEnabled: false,
            fieldAmp: 1,
            fieldTiltRef: { current: { x: 0, y: 0 } },
            hoverTiltRef: { current: { tileId: null, x: 0, y: 0 } },
            transform: {
                imperfectionRotationX: 0,
                imperfectionRotationZ: 0,
                layoutYaw: 0,
                flipRotationY: Math.PI,
                baseX: 0.1,
                baseY: -0.2,
                imperfectionX: 0,
                imperfectionY: 0,
                layoutJitterX: 0,
                layoutJitterY: 0,
                layoutJitterZ: 0
            }
        } as TileBezelActivityBag['propsRef']['current'];

        const group = new Group();
        group.rotation.y = Math.PI;
        group.position.set(0.1, -0.2, 0);

        const bag = makeBag({
            p,
            group,
            refs: { liftSmoothRef: { current: 0 }, faceUpStructBlendRef: { current: 0 } }
        });

        expect(shouldAdvanceTileBezelThisFrame(bag, 50, nowMs)).toBe(false);
    });

    it('reduceMotion: returns false for settled hidden tile (no rim fire)', () => {
        const nowMs = 1_000_000;
        const p = {
            reduceMotion: true,
            faceUp: false,
            pickable: true,
            focusDimmed: false,
            keyboardFocused: false,
            graphicsQuality: 'high' as const,
            textureRevision: 0,
            resolvingSelection: null,
            shuffleMotionDeadlineMs: 0,
            shuffleMotionBudgetMs: 0,
            shuffleStaggerTileCount: 0,
            boardEntranceMotionDeadlineMs: 0,
            boardEntranceMotionBudgetMs: 0,
            boardEntranceStaggerTileCount: 0,
            tile: baseTile(),
            tileFieldParallaxEnabled: false,
            fieldAmp: 1,
            fieldTiltRef: { current: { x: 0, y: 0 } },
            hoverTiltRef: { current: { tileId: null, x: 0, y: 0 } },
            transform: {
                imperfectionRotationX: 0,
                imperfectionRotationZ: 0,
                layoutYaw: 0,
                flipRotationY: Math.PI,
                baseX: 0.05,
                baseY: -0.1,
                imperfectionX: 0,
                imperfectionY: 0,
                layoutJitterX: 0,
                layoutJitterY: 0,
                layoutJitterZ: 0
            }
        } as TileBezelActivityBag['propsRef']['current'];

        const group = new Group();
        group.rotation.y = Math.PI;
        group.position.set(0.05, -0.1, 0);

        const bag = makeBag({
            p,
            group,
            refs: {
                liftSmoothRef: { current: 0 },
                faceUpStructBlendRef: { current: 0 },
                focusDimBlendRef: { current: 0 }
            }
        });

        expect(shouldAdvanceTileBezelThisFrame(bag, 50, nowMs)).toBe(false);
    });

    it('reduceMotion: returns true while resolving', () => {
        const nowMs = 1_000_000;
        const p = {
            reduceMotion: true,
            faceUp: true,
            pickable: false,
            focusDimmed: false,
            keyboardFocused: false,
            graphicsQuality: 'high' as const,
            textureRevision: 0,
            resolvingSelection: 'match' as const,
            shuffleMotionDeadlineMs: 0,
            shuffleMotionBudgetMs: 0,
            shuffleStaggerTileCount: 0,
            boardEntranceMotionDeadlineMs: 0,
            boardEntranceMotionBudgetMs: 0,
            boardEntranceStaggerTileCount: 0,
            tile: baseTile({ state: 'flipped' }),
            tileFieldParallaxEnabled: false,
            fieldAmp: 1,
            fieldTiltRef: { current: { x: 0, y: 0 } },
            hoverTiltRef: { current: { tileId: null, x: 0, y: 0 } },
            transform: {
                imperfectionRotationX: 0,
                imperfectionRotationZ: 0,
                layoutYaw: 0,
                flipRotationY: 0,
                baseX: 0,
                baseY: 0,
                imperfectionX: 0,
                imperfectionY: 0,
                layoutJitterX: 0,
                layoutJitterY: 0,
                layoutJitterZ: 0
            }
        } as TileBezelActivityBag['propsRef']['current'];

        const bag = makeBag({ p });
        expect(shouldAdvanceTileBezelThisFrame(bag, 50, nowMs)).toBe(true);
    });

    it('reduceMotion: matched face-up medium quality keeps frames for rim-fire shader', () => {
        const nowMs = 1_000_000;
        const p = {
            reduceMotion: true,
            faceUp: true,
            pickable: false,
            focusDimmed: false,
            keyboardFocused: false,
            graphicsQuality: 'medium' as const,
            textureRevision: 0,
            resolvingSelection: null,
            shuffleMotionDeadlineMs: 0,
            shuffleMotionBudgetMs: 0,
            shuffleStaggerTileCount: 0,
            boardEntranceMotionDeadlineMs: 0,
            boardEntranceMotionBudgetMs: 0,
            boardEntranceStaggerTileCount: 0,
            tile: baseTile({ state: 'matched' }),
            tileFieldParallaxEnabled: false,
            fieldAmp: 1,
            fieldTiltRef: { current: { x: 0, y: 0 } },
            hoverTiltRef: { current: { tileId: null, x: 0, y: 0 } },
            transform: {
                imperfectionRotationX: 0,
                imperfectionRotationZ: 0,
                layoutYaw: 0,
                flipRotationY: 0,
                baseX: 0,
                baseY: 0,
                imperfectionX: 0,
                imperfectionY: 0,
                layoutJitterX: 0,
                layoutJitterY: 0,
                layoutJitterZ: 0
            }
        } as TileBezelActivityBag['propsRef']['current'];

        const group = new Group();
        const bag = makeBag({
            p,
            group,
            refs: {
                faceUpStructBlendRef: { current: 1 },
                liftSmoothRef: { current: 0.0012 },
                focusDimBlendRef: { current: 0 }
            }
        });
        group.rotation.y = 0;
        group.position.set(0, 0, 0.0018);

        expect(shouldAdvanceTileBezelThisFrame(bag, 50, nowMs)).toBe(true);
    });

    it('keeps focused medium-quality tiles advancing for shader glow pulse', () => {
        const nowMs = 1_000_000;
        const p = {
            reduceMotion: false,
            faceUp: false,
            pickable: true,
            focusDimmed: false,
            keyboardFocused: true,
            graphicsQuality: 'medium' as const,
            textureRevision: 0,
            resolvingSelection: null,
            shuffleMotionDeadlineMs: 0,
            shuffleMotionBudgetMs: 0,
            shuffleStaggerTileCount: 0,
            boardEntranceMotionDeadlineMs: 0,
            boardEntranceMotionBudgetMs: 0,
            boardEntranceStaggerTileCount: 0,
            tile: baseTile({ state: 'hidden' }),
            tileFieldParallaxEnabled: false,
            fieldAmp: 1,
            fieldTiltRef: { current: { x: 0, y: 0 } },
            hoverTiltRef: { current: { tileId: null, x: 0, y: 0 } },
            transform: {
                imperfectionRotationX: 0,
                imperfectionRotationZ: 0,
                layoutYaw: 0,
                flipRotationY: 0,
                baseX: 0,
                baseY: 0,
                imperfectionX: 0,
                imperfectionY: 0,
                layoutJitterX: 0,
                layoutJitterY: 0,
                layoutJitterZ: 0
            }
        } as TileBezelActivityBag['propsRef']['current'];

        const bag = makeBag({ p });

        expect(shouldAdvanceTileBezelThisFrame(bag, 50, nowMs)).toBe(true);
    });
});
