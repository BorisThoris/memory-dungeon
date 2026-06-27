import { describe, expect, it, vi } from 'vitest';
import { PlaneGeometry } from 'three';
import type { BufferAttribute, CanvasTexture } from 'three';

import {
    BEND_BUILDUP_MAX,
    BEND_BUILDUP_PER_PRESS,
    BEND_UV_SAME_SPOT,
    CARD_BEND_MAX_DEPTH,
    WEAR_TEX_SIZE,
    addPersistentBendStamp,
    applyCardWearTextureAnisotropy,
    applyLiveCardBend,
    bendFalloffAtUv,
    cloneBasePositions,
    commitPersistentCardBend,
    createWearTextureAndContext,
    computeCardBendSyncDecision,
    computeCardBendSyncState,
    computeCardClickState,
    computeCardHoverTiltDecision,
    computeCardHoverTiltState,
    computeCardPointerDownState,
    computeCardPointerMoveState,
    computeCardPointerOutDecision,
    computeCardPointerOutState,
    computeCardPointerUpDecision,
    computeCardPointerUpState,
    computeLiveCardBendState,
    composeCardPositions,
    disposeCardWearAssetSet,
    drawWearStamp,
    hitUvToCanonicalBendUv,
    nextBendBuildupForHit,
    planeVertexToUv,
    pointerUvToHoverTilt,
    prepareCardBendBaseGeometryState,
    resolveCardBendFaceFromHit
} from './tileBoardCardBend';

describe('tileBoardCardBend', () => {
    it('maps plane vertices into canonical UV space', () => {
        expect(planeVertexToUv(-1, -2, 2, 4)).toEqual({ u: 0, v: 0 });
        expect(planeVertexToUv(0, 0, 2, 4)).toEqual({ u: 0.5, v: 0.5 });
        expect(planeVertexToUv(1, 2, 2, 4)).toEqual({ u: 1, v: 1 });
    });

    it('mirrors back-face hit UVs into canonical bend UVs', () => {
        expect(hitUvToCanonicalBendUv('front', 0.25, 0.75)).toEqual({ u: 0.25, v: 0.75 });
        expect(hitUvToCanonicalBendUv('back', 0.25, 0.75)).toEqual({ u: 0.75, v: 0.75 });
    });

    it('resolves bend face from a strong raycast face normal first', () => {
        expect(resolveCardBendFaceFromHit({ faceNormalZ: 0.9, halfDepth: 0.1, localZ: -1 })).toBe('front');
        expect(resolveCardBendFaceFromHit({ faceNormalZ: -0.9, halfDepth: 0.1, localZ: 1 })).toBe('back');
    });

    it('falls back to local hit depth when the raycast face normal is weak or missing', () => {
        expect(resolveCardBendFaceFromHit({ faceNormalZ: 0.2, halfDepth: 0.5, localZ: 0.2 })).toBe('front');
        expect(resolveCardBendFaceFromHit({ faceNormalZ: undefined, halfDepth: 0.5, localZ: -0.2 })).toBe('back');
        expect(resolveCardBendFaceFromHit({ faceNormalZ: null, halfDepth: 0.5, localZ: 0.02 })).toBeNull();
    });

    it('computes bend sync UVs from valid pointer hits', () => {
        expect(
            computeCardBendSyncDecision({
                eventType: 'pointerdown',
                face: 'back',
                pointerButtons: 1,
                pointerType: 'mouse',
                uv: { x: 0.25, y: 0.75 }
            })
        ).toEqual({ u: 0.75, v: 0.75 });
    });

    it('skips bend sync for mouse hover pointermove without primary button held', () => {
        expect(
            computeCardBendSyncDecision({
                eventType: 'pointermove',
                face: 'front',
                pointerButtons: 0,
                pointerType: 'mouse',
                uv: { x: 0.25, y: 0.75 }
            })
        ).toBeNull();
        expect(
            computeCardBendSyncDecision({
                eventType: 'pointermove',
                face: 'front',
                pointerButtons: 1,
                pointerType: 'mouse',
                uv: { x: 0.25, y: 0.75 }
            })
        ).toEqual({ u: 0.25, v: 0.75 });
    });

    it('skips bend sync when face or UV data is missing', () => {
        expect(
            computeCardBendSyncDecision({
                eventType: 'pointerdown',
                face: null,
                pointerButtons: 1,
                pointerType: 'mouse',
                uv: { x: 0.25, y: 0.75 }
            })
        ).toBeNull();
        expect(
            computeCardBendSyncDecision({
                eventType: 'pointerdown',
                face: 'front',
                pointerButtons: 1,
                pointerType: 'mouse',
                uv: null
            })
        ).toBeNull();
    });

    it('computes full bend sync state without bumping repeat depth', () => {
        expect(
            computeCardBendSyncState({
                bumpRepeat: false,
                currentBuildup: 1,
                eventType: 'pointermove',
                face: 'front',
                lastBumpU: 0.4,
                lastBumpV: 0.5,
                pickable: true,
                pointerButtons: 1,
                pointerType: 'mouse',
                reduceMotion: false,
                uv: { x: 0.25, y: 0.75 }
            })
        ).toEqual({
            bendU: 0.25,
            bendV: 0.75,
            buildup: 1,
            lastBumpU: 0.4,
            lastBumpV: 0.5
        });
    });

    it('computes full bend sync state and bumps repeated press depth', () => {
        expect(
            computeCardBendSyncState({
                bumpRepeat: true,
                currentBuildup: 1,
                eventType: 'pointerdown',
                face: 'back',
                lastBumpU: 0.76,
                lastBumpV: 0.74,
                pickable: true,
                pointerButtons: 1,
                pointerType: 'mouse',
                reduceMotion: false,
                uv: { x: 0.25, y: 0.75 }
            })
        ).toEqual({
            bendU: 0.75,
            bendV: 0.75,
            buildup: 1.5,
            lastBumpU: 0.75,
            lastBumpV: 0.75
        });
    });

    it('blocks full bend sync state when card cannot bend', () => {
        expect(
            computeCardBendSyncState({
                bumpRepeat: true,
                currentBuildup: 1,
                eventType: 'pointerdown',
                face: 'front',
                lastBumpU: null,
                lastBumpV: null,
                pickable: false,
                pointerButtons: 1,
                pointerType: 'mouse',
                reduceMotion: false,
                uv: { x: 0.25, y: 0.75 }
            })
        ).toBeNull();
        expect(
            computeCardBendSyncState({
                bumpRepeat: true,
                currentBuildup: 1,
                eventType: 'pointerdown',
                face: 'front',
                lastBumpU: null,
                lastBumpV: null,
                pickable: true,
                pointerButtons: 1,
                pointerType: 'mouse',
                reduceMotion: true,
                uv: { x: 0.25, y: 0.75 }
            })
        ).toBeNull();
    });

    it('builds repeated-press depth only near the previous bend hit', () => {
        expect(BEND_BUILDUP_PER_PRESS).toBe(0.5);
        expect(BEND_UV_SAME_SPOT).toBeGreaterThan(0);
        expect(
            nextBendBuildupForHit({
                currentBuildup: 1,
                hitU: 0.5,
                hitV: 0.5,
                previousU: null,
                previousV: null
            })
        ).toBe(0);
        expect(
            nextBendBuildupForHit({
                currentBuildup: 1,
                hitU: 0.5,
                hitV: 0.5,
                previousU: 0.54,
                previousV: 0.52
            })
        ).toBe(1.5);
        expect(
            nextBendBuildupForHit({
                currentBuildup: 1,
                hitU: 0.5,
                hitV: 0.5,
                previousU: 0.8,
                previousV: 0.8
            })
        ).toBe(0);
    });

    it('caps repeated-press depth buildup', () => {
        expect(
            nextBendBuildupForHit({
                currentBuildup: 2.6,
                hitU: 0.5,
                hitV: 0.5,
                previousU: 0.5,
                previousV: 0.5
            })
        ).toBe(BEND_BUILDUP_MAX);
    });

    it('maps pointer UVs into clamped hover tilt coordinates', () => {
        const center = pointerUvToHoverTilt(0.5, 0.5);
        expect(center.x).toBeCloseTo(0);
        expect(center.y).toBeCloseTo(0);
        expect(pointerUvToHoverTilt(0, 0)).toEqual({ x: -1, y: 1 });
        expect(pointerUvToHoverTilt(1, 1)).toEqual({ x: 1, y: -1 });
        expect(pointerUvToHoverTilt(2, -1)).toEqual({ x: 1, y: 1 });
    });

    it('computes hover tilt from pointer UVs for precise pointer movement', () => {
        expect(
            computeCardHoverTiltDecision({
                pointerType: 'mouse',
                reduceMotion: false,
                uv: { x: 0.25, y: 0.75 }
            })
        ).toEqual({ kind: 'set', x: -0.5, y: -0.5 });
    });

    it('clears hover tilt for reduced motion and coarse pointer types', () => {
        expect(
            computeCardHoverTiltDecision({
                pointerType: 'mouse',
                reduceMotion: true,
                uv: { x: 0.25, y: 0.75 }
            })
        ).toEqual({ kind: 'clear' });
        expect(
            computeCardHoverTiltDecision({
                pointerType: 'touch',
                reduceMotion: false,
                uv: { x: 0.25, y: 0.75 }
            })
        ).toEqual({ kind: 'clear' });
        expect(
            computeCardHoverTiltDecision({
                pointerType: 'pen',
                reduceMotion: false,
                uv: { x: 0.25, y: 0.75 }
            })
        ).toEqual({ kind: 'clear' });
    });

    it('leaves hover tilt unchanged when pointer UVs are unavailable', () => {
        expect(
            computeCardHoverTiltDecision({
                pointerType: 'mouse',
                reduceMotion: false,
                uv: null
            })
        ).toEqual({ kind: 'unchanged' });
    });

    it('computes hover tilt state updates for set, unchanged, and clear decisions', () => {
        const current = { tileId: 'tile-a', x: 0.2, y: -0.3 };

        expect(
            computeCardHoverTiltState({
                current,
                pointerType: 'mouse',
                reduceMotion: false,
                tileId: 'tile-b',
                uv: { x: 0.25, y: 0.75 }
            })
        ).toEqual({ tileId: 'tile-b', x: -0.5, y: -0.5 });

        expect(
            computeCardHoverTiltState({
                current,
                pointerType: 'mouse',
                reduceMotion: false,
                tileId: 'tile-b',
                uv: null
            })
        ).toBe(current);

        expect(
            computeCardHoverTiltState({
                current,
                pointerType: 'touch',
                reduceMotion: false,
                tileId: 'tile-a',
                uv: { x: 0.25, y: 0.75 }
            })
        ).toEqual({ tileId: null, x: 0, y: 0 });

        expect(
            computeCardHoverTiltState({
                current,
                pointerType: 'touch',
                reduceMotion: false,
                tileId: 'tile-b',
                uv: { x: 0.25, y: 0.75 }
            })
        ).toBe(current);
    });

    it('computes pointer-down as press start with bend sync', () => {
        expect(computeCardPointerDownState()).toEqual({
            pressingOnCard: true,
            syncBend: true
        });
    });

    it('computes click bend sync eligibility', () => {
        expect(computeCardClickState({ pickable: true, reduceMotion: false })).toEqual({ syncBend: true });
        expect(computeCardClickState({ pickable: false, reduceMotion: false })).toEqual({ syncBend: false });
        expect(computeCardClickState({ pickable: true, reduceMotion: true })).toEqual({ syncBend: false });
    });

    it('computes pointer-move hover state while requesting bend sync', () => {
        expect(
            computeCardPointerMoveState({
                current: { tileId: null, x: 0, y: 0 },
                pointerType: 'mouse',
                reduceMotion: false,
                tileId: 'tile-a',
                uv: { x: 0.75, y: 0.25 }
            })
        ).toEqual({
            hoverTilt: { tileId: 'tile-a', x: 0.5, y: 0.5 },
            syncBend: true
        });
    });

    it('computes pointer-move hover clearing for touch input', () => {
        expect(
            computeCardPointerMoveState({
                current: { tileId: 'tile-a', x: 0.5, y: 0.5 },
                pointerType: 'touch',
                reduceMotion: false,
                tileId: 'tile-a',
                uv: { x: 0.75, y: 0.25 }
            })
        ).toEqual({
            hoverTilt: { tileId: null, x: 0, y: 0 },
            syncBend: true
        });
    });

    it('computes pointer-up actions for primary mouse picks', () => {
        expect(
            computeCardPointerUpDecision({
                button: 0,
                pickable: true,
                pointerType: 'mouse',
                pressingOnCard: true,
                reduceMotion: false
            })
        ).toEqual({ commitBend: true, pickTile: true, syncBend: true });
    });

    it('suppresses mouse secondary-button picks while still committing an active press bend', () => {
        expect(
            computeCardPointerUpDecision({
                button: 2,
                pickable: true,
                pointerType: 'mouse',
                pressingOnCard: true,
                reduceMotion: false
            })
        ).toEqual({ commitBend: true, pickTile: false, syncBend: false });
    });

    it('accepts non-mouse pointer-up picks regardless of button value', () => {
        expect(
            computeCardPointerUpDecision({
                button: 2,
                pickable: true,
                pointerType: 'touch',
                pressingOnCard: false,
                reduceMotion: false
            })
        ).toEqual({ commitBend: false, pickTile: true, syncBend: true });
    });

    it('blocks bend work for reduced motion while preserving pick behavior', () => {
        expect(
            computeCardPointerUpDecision({
                button: 0,
                pickable: true,
                pointerType: 'mouse',
                pressingOnCard: true,
                reduceMotion: true
            })
        ).toEqual({ commitBend: false, pickTile: true, syncBend: false });
    });

    it('blocks all pointer-up actions for unpickable cards', () => {
        expect(
            computeCardPointerUpDecision({
                button: 0,
                pickable: false,
                pointerType: 'mouse',
                pressingOnCard: true,
                reduceMotion: false
            })
        ).toEqual({ commitBend: false, pickTile: false, syncBend: false });
    });

    it('computes full pointer-up state and clears the press flag', () => {
        expect(
            computeCardPointerUpState({
                button: 0,
                pickable: true,
                pointerType: 'mouse',
                pressingOnCard: true,
                reduceMotion: false
            })
        ).toEqual({
            commitBend: true,
            pickTile: true,
            pressingOnCard: false,
            syncBend: true
        });
    });

    it('clears the press flag even when pointer-up does not pick or bend', () => {
        expect(
            computeCardPointerUpState({
                button: 2,
                pickable: false,
                pointerType: 'mouse',
                pressingOnCard: true,
                reduceMotion: false
            })
        ).toEqual({
            commitBend: false,
            pickTile: false,
            pressingOnCard: false,
            syncBend: false
        });
    });

    it('computes pointer-out bend commits and hover clearing for the active tile', () => {
        expect(
            computeCardPointerOutDecision({
                activeHoverTileId: 'tile-1',
                pickable: true,
                pressingOnCard: true,
                reduceMotion: false,
                tileId: 'tile-1'
            })
        ).toEqual({ clearHoverTilt: true, commitBend: true });
    });

    it('does not clear another tile hover state on pointer out', () => {
        expect(
            computeCardPointerOutDecision({
                activeHoverTileId: 'tile-2',
                pickable: true,
                pressingOnCard: true,
                reduceMotion: false,
                tileId: 'tile-1'
            })
        ).toEqual({ clearHoverTilt: false, commitBend: true });
    });

    it('blocks pointer-out bend commits when the card cannot bend', () => {
        expect(
            computeCardPointerOutDecision({
                activeHoverTileId: 'tile-1',
                pickable: false,
                pressingOnCard: true,
                reduceMotion: false,
                tileId: 'tile-1'
            })
        ).toEqual({ clearHoverTilt: true, commitBend: false });
        expect(
            computeCardPointerOutDecision({
                activeHoverTileId: 'tile-1',
                pickable: true,
                pressingOnCard: true,
                reduceMotion: true,
                tileId: 'tile-1'
            })
        ).toEqual({ clearHoverTilt: true, commitBend: false });
        expect(
            computeCardPointerOutDecision({
                activeHoverTileId: 'tile-1',
                pickable: true,
                pressingOnCard: false,
                reduceMotion: false,
                tileId: 'tile-1'
            })
        ).toEqual({ clearHoverTilt: true, commitBend: false });
    });

    it('computes full pointer-out state for commit, press clearing, and hover clearing', () => {
        expect(
            computeCardPointerOutState({
                hoverTilt: { tileId: 'tile-1', x: 0.4, y: -0.2 },
                pickable: true,
                pressingOnCard: true,
                reduceMotion: false,
                tileId: 'tile-1'
            })
        ).toEqual({
            commitBend: true,
            hoverTilt: { tileId: null, x: 0, y: 0 },
            pressingOnCard: false
        });
    });

    it('preserves another tile hover state when computing pointer-out state', () => {
        const hoverTilt = { tileId: 'tile-2', x: 0.4, y: -0.2 };

        expect(
            computeCardPointerOutState({
                hoverTilt,
                pickable: true,
                pressingOnCard: true,
                reduceMotion: false,
                tileId: 'tile-1'
            })
        ).toEqual({
            commitBend: true,
            hoverTilt,
            pressingOnCard: false
        });
    });

    it('computes live bend depth only while an eligible card is pressed', () => {
        expect(
            computeLiveCardBendState({
                bendBuildup: 2,
                bendOverlay: true,
                pickable: true,
                pressingOnCard: true,
                reduceMotion: false
            })
        ).toEqual({ liveDepthScale: 2.04, liveOverlayDepthScale: 2.04 });

        expect(
            computeLiveCardBendState({
                bendBuildup: 2,
                bendOverlay: true,
                pickable: false,
                pressingOnCard: true,
                reduceMotion: false
            })
        ).toEqual({ liveDepthScale: 0, liveOverlayDepthScale: 0 });

        expect(
            computeLiveCardBendState({
                bendBuildup: 2,
                bendOverlay: true,
                pickable: true,
                pressingOnCard: true,
                reduceMotion: true
            })
        ).toEqual({ liveDepthScale: 0, liveOverlayDepthScale: 0 });
    });

    it('gates live overlay bend independently from face bend depth', () => {
        expect(
            computeLiveCardBendState({
                bendBuildup: 1,
                bendOverlay: false,
                pickable: true,
                pressingOnCard: true,
                reduceMotion: false
            })
        ).toEqual({ liveDepthScale: 1.52, liveOverlayDepthScale: 0 });
    });

    it('uses smooth radial falloff from the bend center', () => {
        expect(bendFalloffAtUv(0.5, 0.5, 0.5, 0.5, 2, 2)).toBe(1);
        expect(bendFalloffAtUv(0, 0, 0.5, 0.5, 2, 2)).toBe(0);
        expect(bendFalloffAtUv(0.62, 0.5, 0.5, 0.5, 2, 2)).toBeGreaterThan(
            bendFalloffAtUv(0.86, 0.5, 0.5, 0.5, 2, 2)
        );
    });

    it('adds persistent bend depth and composes live depth into geometry positions', () => {
        const geometry = new PlaneGeometry(2, 2, 2, 2);
        const base = cloneBasePositions(geometry);
        const persistent = new Float32Array(base.length / 3);

        addPersistentBendStamp(persistent, base, 0.5, 0.5, 2, 2, 1);

        expect(Math.max(...persistent)).toBeGreaterThan(0);
        expect(Math.max(...persistent)).toBeLessThanOrEqual(CARD_BEND_MAX_DEPTH);

        const positions = geometry.attributes.position as BufferAttribute;
        composeCardPositions(positions, base, persistent, 0.5, 0.5, 2, 2, 0.5);

        const array = positions.array as Float32Array;
        const zValues = Array.from({ length: array.length / 3 }, (_, index) => array[index * 3 + 2]);
        expect(Math.max(...zValues)).toBeGreaterThan(Math.max(...persistent));

        geometry.dispose();
    });

    it('prepares base geometry state and computes tangents for front/back planes', () => {
        const front = new PlaneGeometry(2, 2, 2, 2);
        const back = new PlaneGeometry(2, 2, 2, 2);
        const overlay = new PlaneGeometry(2, 2, 2, 2);
        const frontTangents = vi.spyOn(front, 'computeTangents');
        const backTangents = vi.spyOn(back, 'computeTangents');
        const overlayTangents = vi.spyOn(overlay, 'computeTangents');

        const state = prepareCardBendBaseGeometryState({
            backGeometry: back,
            frontGeometry: front,
            overlayGeometry: overlay
        });

        expect(state.frontBase).toEqual(cloneBasePositions(front));
        expect(state.backBase).toEqual(cloneBasePositions(back));
        expect(state.overlayBase).toEqual(cloneBasePositions(overlay));
        expect(frontTangents).toHaveBeenCalledTimes(1);
        expect(backTangents).toHaveBeenCalledTimes(1);
        expect(overlayTangents).not.toHaveBeenCalled();

        front.dispose();
        back.dispose();
        overlay.dispose();
    });

    it('applies and disposes card wear texture assets', () => {
        const wear = {
            back: {
                canvas: {} as HTMLCanvasElement,
                context: {} as CanvasRenderingContext2D,
                texture: { anisotropy: 0, dispose: vi.fn() } as unknown as CanvasTexture
            },
            front: {
                canvas: {} as HTMLCanvasElement,
                context: {} as CanvasRenderingContext2D,
                texture: { anisotropy: 0, dispose: vi.fn() } as unknown as CanvasTexture
            }
        };

        applyCardWearTextureAnisotropy(wear, 6);

        expect(wear.front.texture.anisotropy).toBe(6);
        expect(wear.back.texture.anisotropy).toBe(6);

        disposeCardWearAssetSet(wear);

        expect(wear.front.texture.dispose).toHaveBeenCalledTimes(1);
        expect(wear.back.texture.dispose).toHaveBeenCalledTimes(1);
        expect(() => applyCardWearTextureAnisotropy(null, 6)).not.toThrow();
        expect(() => disposeCardWearAssetSet(null)).not.toThrow();
    });

    it('creates configured wear texture assets from a canvas context', () => {
        const context = {
            fillRect: vi.fn(),
            imageSmoothingEnabled: false,
            imageSmoothingQuality: 'low'
        } as unknown as CanvasRenderingContext2D;
        const canvas = {
            getContext: vi.fn(() => context),
            height: 0,
            width: 0
        } as unknown as HTMLCanvasElement;
        const createElement = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
            expect(tagName).toBe('canvas');
            return canvas;
        }) as typeof document.createElement);

        const assets = createWearTextureAndContext();

        expect(createElement).toHaveBeenCalledWith('canvas');
        expect(assets.canvas.width).toBe(WEAR_TEX_SIZE);
        expect(assets.canvas.height).toBe(WEAR_TEX_SIZE);
        expect(assets.context).toBe(context);
        expect(context.fillRect).toHaveBeenCalledWith(0, 0, WEAR_TEX_SIZE, WEAR_TEX_SIZE);
        expect(assets.texture.generateMipmaps).toBe(false);
        expect(assets.texture.premultiplyAlpha).toBe(true);

        createElement.mockRestore();
        assets.texture.dispose();
    });

    it('applies live card bend to front, back, and overlay plane targets', () => {
        const front = new PlaneGeometry(2, 2, 2, 2);
        const back = new PlaneGeometry(2, 2, 2, 2);
        const overlay = new PlaneGeometry(2, 2, 2, 2);
        const frontBase = cloneBasePositions(front);
        const backBase = cloneBasePositions(back);
        const overlayBase = cloneBasePositions(overlay);

        applyLiveCardBend({
            back: {
                base: backBase,
                persistent: new Float32Array(backBase.length / 3),
                positions: back.attributes.position as BufferAttribute
            },
            bendU: 0.5,
            bendV: 0.5,
            cardHeight: 2,
            cardWidth: 2,
            front: {
                base: frontBase,
                persistent: new Float32Array(frontBase.length / 3),
                positions: front.attributes.position as BufferAttribute
            },
            liveDepthScale: 1,
            liveOverlayDepthScale: 0.5,
            overlay: {
                base: overlayBase,
                persistent: new Float32Array(overlayBase.length / 3),
                positions: overlay.attributes.position as BufferAttribute
            },
            useSvgMeshBack: false,
            useSvgMeshFront: false
        });

        const frontZ = Array.from({ length: frontBase.length / 3 }, (_, index) => {
            const array = front.attributes.position.array as Float32Array;
            return array[index * 3 + 2];
        });
        const backZ = Array.from({ length: backBase.length / 3 }, (_, index) => {
            const array = back.attributes.position.array as Float32Array;
            return array[index * 3 + 2];
        });
        const overlayZ = Array.from({ length: overlayBase.length / 3 }, (_, index) => {
            const array = overlay.attributes.position.array as Float32Array;
            return array[index * 3 + 2];
        });

        expect(Math.max(...frontZ)).toBeCloseTo(CARD_BEND_MAX_DEPTH);
        expect(Math.max(...backZ)).toBeCloseTo(CARD_BEND_MAX_DEPTH);
        expect(Math.max(...overlayZ)).toBeCloseTo(CARD_BEND_MAX_DEPTH * 0.5);

        front.dispose();
        back.dispose();
        overlay.dispose();
    });

    it('skips SVG-backed front and back meshes while still composing overlay bend', () => {
        const front = new PlaneGeometry(2, 2, 2, 2);
        const back = new PlaneGeometry(2, 2, 2, 2);
        const overlay = new PlaneGeometry(2, 2, 2, 2);
        const frontBase = cloneBasePositions(front);
        const backBase = cloneBasePositions(back);
        const overlayBase = cloneBasePositions(overlay);

        applyLiveCardBend({
            back: {
                base: backBase,
                persistent: new Float32Array(backBase.length / 3),
                positions: back.attributes.position as BufferAttribute
            },
            bendU: 0.5,
            bendV: 0.5,
            cardHeight: 2,
            cardWidth: 2,
            front: {
                base: frontBase,
                persistent: new Float32Array(frontBase.length / 3),
                positions: front.attributes.position as BufferAttribute
            },
            liveDepthScale: 1,
            liveOverlayDepthScale: 1,
            overlay: {
                base: overlayBase,
                persistent: new Float32Array(overlayBase.length / 3),
                positions: overlay.attributes.position as BufferAttribute
            },
            useSvgMeshBack: true,
            useSvgMeshFront: true
        });

        const frontArray = front.attributes.position.array as Float32Array;
        const backArray = back.attributes.position.array as Float32Array;
        const overlayArray = overlay.attributes.position.array as Float32Array;

        expect(Math.max(...Array.from(frontArray).filter((_, index) => index % 3 === 2))).toBe(0);
        expect(Math.max(...Array.from(backArray).filter((_, index) => index % 3 === 2))).toBe(0);
        expect(Math.max(...Array.from(overlayArray).filter((_, index) => index % 3 === 2))).toBeGreaterThan(0);

        front.dispose();
        back.dispose();
        overlay.dispose();
    });

    it('commits persistent bend stamps to enabled front, back, and overlay targets', () => {
        const geometry = new PlaneGeometry(2, 2, 2, 2);
        const base = cloneBasePositions(geometry);
        const frontPersistent = new Float32Array(base.length / 3);
        const backPersistent = new Float32Array(base.length / 3);
        const overlayPersistent = new Float32Array(base.length / 3);

        commitPersistentCardBend({
            back: { base, persistent: backPersistent },
            bendOverlay: true,
            bendU: 0.5,
            bendV: 0.5,
            cardHeight: 2,
            cardWidth: 2,
            depthScale: 1,
            front: { base, persistent: frontPersistent },
            overlay: { base, persistent: overlayPersistent },
            useSvgMeshBack: false,
            useSvgMeshFront: false,
            wear: null
        });

        expect(Math.max(...frontPersistent)).toBeCloseTo(CARD_BEND_MAX_DEPTH);
        expect(Math.max(...backPersistent)).toBeCloseTo(CARD_BEND_MAX_DEPTH);
        expect(Math.max(...overlayPersistent)).toBeCloseTo(CARD_BEND_MAX_DEPTH);

        geometry.dispose();
    });

    it('skips persistent front/back stamps for SVG meshes and respects overlay gating', () => {
        const geometry = new PlaneGeometry(2, 2, 2, 2);
        const base = cloneBasePositions(geometry);
        const frontPersistent = new Float32Array(base.length / 3);
        const backPersistent = new Float32Array(base.length / 3);
        const overlayPersistent = new Float32Array(base.length / 3);

        commitPersistentCardBend({
            back: { base, persistent: backPersistent },
            bendOverlay: false,
            bendU: 0.5,
            bendV: 0.5,
            cardHeight: 2,
            cardWidth: 2,
            depthScale: 1,
            front: { base, persistent: frontPersistent },
            overlay: { base, persistent: overlayPersistent },
            useSvgMeshBack: true,
            useSvgMeshFront: true,
            wear: null
        });

        expect(Math.max(...frontPersistent)).toBe(0);
        expect(Math.max(...backPersistent)).toBe(0);
        expect(Math.max(...overlayPersistent)).toBe(0);

        geometry.dispose();
    });

    it('stamps wear textures only for raster-backed faces', () => {
        const geometry = new PlaneGeometry(2, 2, 2, 2);
        const base = cloneBasePositions(geometry);
        const frontPersistent = new Float32Array(base.length / 3);
        const backPersistent = new Float32Array(base.length / 3);
        const overlayPersistent = new Float32Array(base.length / 3);
        const calls: string[] = [];
        const context = {
            createRadialGradient(): CanvasGradient {
                return {
                    addColorStop(): void {
                        return undefined;
                    }
                } as CanvasGradient;
            },
            fillRect(): void {
                calls.push('fillRect');
            },
            restore(): void {
                calls.push('restore');
            },
            save(): void {
                calls.push('save');
            },
            set fillStyle(_value: string | CanvasGradient) {
                return;
            },
            set globalCompositeOperation(_value: GlobalCompositeOperation) {
                return;
            }
        } as unknown as CanvasRenderingContext2D;
        const wear = {
            back: { context, texture: { needsUpdate: false } },
            front: { context, texture: { needsUpdate: false } }
        };

        commitPersistentCardBend({
            back: { base, persistent: backPersistent },
            bendOverlay: true,
            bendU: 0.5,
            bendV: 0.5,
            cardHeight: 2,
            cardWidth: 2,
            depthScale: 1,
            front: { base, persistent: frontPersistent },
            overlay: { base, persistent: overlayPersistent },
            useSvgMeshBack: false,
            useSvgMeshFront: true,
            wear
        });

        expect(wear.front.texture.needsUpdate).toBe(false);
        expect(wear.back.texture.needsUpdate).toBe(true);
        expect(calls.filter((call) => call === 'fillRect')).toHaveLength(1);

        geometry.dispose();
    });

    it('draws wear stamps with the shared wear texture resolution', () => {
        const gradient = { addColorStop: vi.fn() } as unknown as CanvasGradient;
        const context = {
            createRadialGradient: vi.fn(() => gradient),
            fillRect: vi.fn(),
            restore: vi.fn(),
            save: vi.fn(),
            set fillStyle(_value: string | CanvasGradient) {
                return;
            },
            set globalCompositeOperation(_value: GlobalCompositeOperation) {
                return;
            }
        } as unknown as CanvasRenderingContext2D;

        drawWearStamp(context, 0.25, 0.75, 2);

        expect(context.createRadialGradient).toHaveBeenCalledWith(WEAR_TEX_SIZE * 0.25, WEAR_TEX_SIZE * 0.25, 0, WEAR_TEX_SIZE * 0.25, WEAR_TEX_SIZE * 0.25, WEAR_TEX_SIZE * 0.14);
        expect(gradient.addColorStop).toHaveBeenCalledTimes(3);
        expect(context.fillRect).toHaveBeenCalledWith(0, 0, WEAR_TEX_SIZE, WEAR_TEX_SIZE);
    });
});
