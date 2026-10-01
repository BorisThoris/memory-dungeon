import { useMemo, type CSSProperties, type ReactElement } from 'react';
import type { RealmId } from '../../shared/contracts';
import { createMulberry32 } from '../../shared/rng';
import styles from './RealmScreenOverlay.module.css';
import { useBeat } from './useSceneBeat';

/**
 * The realm over the whole screen (2026-10-01). The room behind the board took a tint and a drift
 * from the realm, which nobody could tell apart from the plain dungeon. These are the realm on the
 * glass: flames licking up the bottom edge in the ember realm, vines creeping in from the corners in
 * the grove, rain streaking down in the tide, rime feathering in from the corners in the frost, the
 * edges crackling with charge in the storm. They keep to the edges so the board stays readable,
 * and `strength` (calm, wild, raging) sets how far they reach.
 */
export interface RealmScreenOverlayProps {
    realm: RealmId;
    strength: number;
    seed: number;
    reduceMotion: boolean;
    /** The realm's latest event: the edges surge with it, flames leaping, rain sheeting, charge going white. */
    surgeKey?: string | null;
    /** The realm the board just left (an omen turned it): it burns, melts or washes off the glass. */
    leaving?: boolean;
}

const VIEW_W = 1600;
const VIEW_H = 900;

const Flames = ({ seed }: { seed: number }): ReactElement => {
    const tongues = useMemo(() => {
        const rng = createMulberry32(seed ^ 0xf1a3e);
        return Array.from({ length: 26 }, (_unused, index) => {
            const x = (index / 25) * VIEW_W + (rng() - 0.5) * 50;
            const w = 70 + rng() * 90;
            const h = 120 + rng() * 170;
            const lean = (rng() - 0.5) * 50;
            const d = `M ${x - w / 2} ${VIEW_H} C ${x - w * 0.45} ${VIEW_H - h * 0.5}, ${x + lean - w * 0.2} ${VIEW_H - h * 0.75}, ${x + lean} ${VIEW_H - h} C ${x + lean + w * 0.15} ${VIEW_H - h * 0.7}, ${x + w * 0.45} ${VIEW_H - h * 0.45}, ${x + w / 2} ${VIEW_H} Z`;
            return { d, delay: rng() * -1.6, dur: 0.9 + rng() * 0.9, hot: rng() < 0.45 };
        });
    }, [seed]);
    return (
        <svg className={styles.flames} preserveAspectRatio="none" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
            <defs>
                <linearGradient id="realm-flame" x1="0" x2="0" y1="1" y2="0">
                    <stop offset="0" stopColor="#ff3d00" stopOpacity="0.95" />
                    <stop offset="0.45" stopColor="#ff8a1e" stopOpacity="0.85" />
                    <stop offset="0.8" stopColor="#ffd25a" stopOpacity="0.55" />
                    <stop offset="1" stopColor="#fff2b0" stopOpacity="0" />
                </linearGradient>
                <filter id="realm-flame-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="9" />
                </filter>
            </defs>
            {tongues.map((tongue, index) => (
                <path
                    className={tongue.hot ? `${styles.tongue} ${styles.tongueHot}` : styles.tongue}
                    d={tongue.d}
                    fill="url(#realm-flame)"
                    filter={index % 3 === 0 ? 'url(#realm-flame-glow)' : undefined}
                    key={index}
                    style={{ animationDelay: `${tongue.delay}s`, animationDuration: `${tongue.dur}s` } as CSSProperties}
                />
            ))}
        </svg>
    );
};

const Vines = ({ seed }: { seed: number }): ReactElement => {
    const vines = useMemo(() => {
        const rng = createMulberry32(seed ^ 0x9f0e5);
        const corners: Array<[number, number, number, number]> = [
            [0, 0, 1, 1],
            [VIEW_W, 0, -1, 1],
            [0, VIEW_H, 1, -1],
            [VIEW_W, VIEW_H, -1, -1]
        ];
        return corners.flatMap(([cx, cy, sx, sy], corner) =>
            Array.from({ length: 4 }, (_unused, index) => {
                const reach = 260 + rng() * 220;
                const bend = 80 + rng() * 120;
                const angle = (index / 3) * 0.9 + 0.15;
                const ex = cx + sx * Math.cos(angle) * reach;
                const ey = cy + sy * Math.sin(angle) * reach;
                const mx = cx + sx * (Math.cos(angle) * reach * 0.5 + bend * (rng() - 0.3));
                const my = cy + sy * (Math.sin(angle) * reach * 0.5 + bend * (rng() - 0.3));
                const leaves = Array.from({ length: 5 }, (_leaf, l) => {
                    const t = (l + 1) / 6;
                    const lx = (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * mx + t * t * ex;
                    const ly = (1 - t) * (1 - t) * cy + 2 * (1 - t) * t * my + t * t * ey;
                    return { x: lx, y: ly, r: rng() * 360 };
                });
                return { d: `M ${cx} ${cy} Q ${mx} ${my} ${ex} ${ey}`, delay: corner * 0.25 + index * 0.18, leaves };
            })
        );
    }, [seed]);
    return (
        <svg className={styles.vines} preserveAspectRatio="none" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
            {vines.map((vine, index) => (
                <g key={index}>
                    <path className={styles.vine} d={vine.d} style={{ animationDelay: `${vine.delay}s` } as CSSProperties} />
                    {vine.leaves.map((leaf, l) => (
                        <ellipse
                            className={styles.leaf}
                            cx={leaf.x}
                            cy={leaf.y}
                            key={l}
                            rx={9}
                            ry={20}
                            style={{ animationDelay: `${vine.delay + 0.4 + l * 0.15}s` } as CSSProperties}
                            transform={`rotate(${leaf.r} ${leaf.x} ${leaf.y})`}
                        />
                    ))}
                </g>
            ))}
        </svg>
    );
};

const Rime = ({ seed }: { seed: number }): ReactElement => {
    const strokes = useMemo(() => {
        const rng = createMulberry32(seed ^ 0x1ce);
        const out: string[] = [];
        const branch = (x: number, y: number, a: number, len: number, depth: number): void => {
            if (depth <= 0) return;
            const x2 = x + Math.cos(a) * len;
            const y2 = y + Math.sin(a) * len;
            out.push(`M ${x} ${y} L ${x2} ${y2}`);
            branch(x2, y2, a + 0.55, len * 0.62, depth - 1);
            branch(x2, y2, a - 0.55, len * 0.62, depth - 1);
        };
        const corners: Array<[number, number, number]> = [[0, 0, Math.PI / 4], [VIEW_W, 0, (3 * Math.PI) / 4], [0, VIEW_H, -Math.PI / 4], [VIEW_W, VIEW_H, (-3 * Math.PI) / 4]];
        for (const [cx, cy, a] of corners) for (let i = 0; i < 6; i += 1) branch(cx, cy, a + (rng() - 0.5) * 1.1, 90 + rng() * 80, 4);
        return out.join(' ');
    }, [seed]);
    return (
        <svg className={styles.rime} preserveAspectRatio="none" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
            <path className={styles.rimeStroke} d={strokes} />
        </svg>
    );
};

export function RealmScreenOverlay({ realm, strength, seed, reduceMotion, surgeKey = null, leaving = false }: RealmScreenOverlayProps) {
    const surging = useBeat(surgeKey, 1300);
    return (
        <div
            aria-hidden="true"
            className={styles.overlay}
            data-leaving={leaving ? 'true' : 'false'}
            data-surge={surging && !leaving ? 'true' : 'false'}
            data-realm={realm}
            data-reduce-motion={reduceMotion ? 'true' : 'false'}
            data-testid={leaving ? 'realm-screen-overlay-leaving' : 'realm-screen-overlay'}
            style={{ '--realm-strength': strength } as CSSProperties}
        >
            <span className={styles.vignette} />
            {realm === 'ember' ? <Flames seed={seed} /> : null}
            {realm === 'grove' ? <Vines seed={seed} /> : null}
            {realm === 'frost' ? <Rime seed={seed} /> : null}
            {realm === 'tide' ? (
                <>
                    <span className={styles.rain} />
                    <span className={`${styles.rain} ${styles.rainFar}`} />
                </>
            ) : null}
            {realm === 'storm' ? <span className={styles.charge} /> : null}
        </div>
    );
}
