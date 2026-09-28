import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import type { TileBezelFramePropsSnapshot } from './tileBoardFramePropsSnapshot';

export type RimParticleMood = 'focus' | 'charge' | 'match';
export interface RimSample { x: number; y: number; nx: number; ny: number }

/** Arc-length sampling keeps sparks evenly spaced around the real rounded card silhouette. */
export const sampleCardRim = (phase: number, out: RimSample): void => {
    const x = CARD_PLANE_WIDTH / 2 + 0.012;
    const y = CARD_PLANE_HEIGHT / 2 + 0.012;
    const radius = 0.075;
    const horizontal = 2 * (x - radius);
    const vertical = 2 * (y - radius);
    const arc = Math.PI * radius / 2;
    let distance = ((phase % 1 + 1) % 1) * (2 * horizontal + 2 * vertical + 4 * arc);
    for (let side = 0; side < 4; side += 1) {
        const length = side % 2 === 0 ? horizontal : vertical;
        if (distance <= length) {
            const t = distance / length;
            out.x = side === 0 ? -x + radius + t * length : side === 1 ? x : side === 2 ? x - radius - t * length : -x;
            out.y = side === 0 ? y : side === 1 ? y - radius - t * length : side === 2 ? -y : -y + radius + t * length;
            out.nx = side === 1 ? 1 : side === 3 ? -1 : 0;
            out.ny = side === 0 ? 1 : side === 2 ? -1 : 0;
            return;
        }
        distance -= length;
        if (distance <= arc) {
            const angle = Math.PI / 2 - side * Math.PI / 2 - distance / radius;
            out.nx = Math.cos(angle); out.ny = Math.sin(angle);
            out.x = (side < 2 ? 1 : -1) * (x - radius) + radius * out.nx;
            out.y = (side === 0 || side === 3 ? 1 : -1) * (y - radius) + radius * out.ny;
            return;
        }
        distance -= arc;
    }
};

/** The particles follow visible interaction cues; they never reveal a hidden card's partner. */
export const getRimParticleMood = (props: Pick<TileBezelFramePropsSnapshot,
    'tile' | 'faceUp' | 'resolvingSelection' | 'interactionSuppressed' | 'pickable' |
    'keyboardFocused' | 'hoverTiltRef' | 'traitRouteReadabilityIntensity'>): RimParticleMood | null => {
    // Committed clears get a one-shot sweep from the state diff, never a replay on load/context restore.
    if (props.interactionSuppressed || props.tile.state === 'removed' || props.tile.state === 'matched' || props.resolvingSelection === 'mismatch') return null;
    if (props.faceUp && props.resolvingSelection === 'match') return 'match';
    if (props.pickable && (props.keyboardFocused || props.hoverTiltRef.current.tileId === props.tile.id)) return 'focus';
    if (!props.faceUp && ['ready', 'surge', 'cashout', 'stack'].includes(props.traitRouteReadabilityIntensity ?? 'none')) return 'charge';
    return null;
};
