import {
    Children,
    cloneElement,
    createElement,
    type HTMLAttributes,
    isValidElement,
    type ReactElement,
    type ReactNode,
    useId,
    useLayoutEffect,
    useRef,
    useState
} from 'react';
import styles from './MetaFrame.module.css';

export type MetaFrameTag = 'div' | 'section';

export interface MetaFrameProps extends HTMLAttributes<HTMLElement> {
    children: ReactNode;
    as?: MetaFrameTag;
}

type CorniceGeom = {
    /** SVG layout box (matches `svg.clientWidth` / `clientHeight`). */
    w: number;
    h: number;
    /** Offset from SVG edge to slot (Panel) origin — half of `(svg − root)` expansion. */
    ox: number;
    oy: number;
    /** Slot / framed content size (matches root). */
    rw: number;
    rh: number;
    /** Corner radius aligned to the framed element’s computed radius. */
    rx: number;
};

function parseRadiusFromComputed(br: string, fallback: number): number {
    const token = br.trim().split(/\s+/)[0] ?? '';
    const v = parseFloat(token);
    return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** Tag direct slot content so shells can drop duplicate box borders (MetaFrame draws the rail). */
function stampMetaFramed(nodes: ReactNode): ReactNode {
    return Children.map(nodes, (node) => {
        if (!isValidElement(node)) {
            return node;
        }
        const props = node.props as Record<string, unknown>;
        if (props['data-meta-framed'] !== undefined) {
            return node;
        }
        return cloneElement(node as ReactElement<Record<string, unknown>>, {
            'data-meta-framed': 'true'
        });
    });
}

function readFallbackRadiusPx(root: HTMLElement): number {
    const raw = getComputedStyle(root).getPropertyValue('--ui-radius-panel').trim();
    if (raw) {
        const v = parseFloat(raw);
        if (Number.isFinite(v) && v > 0) {
            return v;
        }
    }
    return 12;
}

/**
 * META-003: ornamental “forged gold” vector frame for meta surfaces. Wraps existing {@link Panel}
 * (or other blocks). Cornice geometry follows `ResizeObserver` + the first child’s
 * `border-radius` so rails follow real rounded rects (no stretched 100×100 viewBox mismatch).
 * Direct slot children are stamped with `data-meta-framed` so redundant CSS borders / plate lines
 * can be suppressed (see `MetaFrame.module.css`, `Panel.module.css`, `UiButton.module.css`).
 */
const MetaFrame = ({ as: Tag = 'div', children, className = '', ...rest }: MetaFrameProps) => {
    const reactId = useId();
    const gid = `mf-${reactId.replace(/:/g, '')}`;

    const rootRef = useRef<HTMLElement | null>(null);
    const slotRef = useRef<HTMLSpanElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const [geom, setGeom] = useState<CorniceGeom | null>(null);

    useLayoutEffect(() => {
        const root = rootRef.current;
        const svg = svgRef.current;
        if (!root || !svg) {
            return;
        }

        const measure = (): void => {
            const rootW = root.clientWidth;
            const rootH = root.clientHeight;
            const svgW = svg.clientWidth;
            const svgH = svg.clientHeight;
            if (rootW < 2 || rootH < 2 || svgW < 2 || svgH < 2) {
                return;
            }

            const ox = Math.max(0, (svgW - rootW) / 2);
            const oy = Math.max(0, (svgH - rootH) / 2);

            const slot = slotRef.current;
            const first = slot?.firstElementChild as HTMLElement | null;
            const radiusSource = first ?? root;
            const cs = getComputedStyle(radiusSource);
            const fb = readFallbackRadiusPx(root);
            let rx = parseRadiusFromComputed(cs.borderTopLeftRadius, fb);
            rx = Math.min(rx, rootW / 2 - 0.5, rootH / 2 - 0.5);
            rx = Math.max(0, rx);

            setGeom((prev) => {
                const next: CorniceGeom = {
                    w: Math.round(svgW * 1000) / 1000,
                    h: Math.round(svgH * 1000) / 1000,
                    ox: Math.round(ox * 1000) / 1000,
                    oy: Math.round(oy * 1000) / 1000,
                    rw: rootW,
                    rh: rootH,
                    rx
                };
                if (
                    prev &&
                    Math.abs(prev.w - next.w) < 0.5 &&
                    Math.abs(prev.h - next.h) < 0.5 &&
                    Math.abs(prev.ox - next.ox) < 0.5 &&
                    Math.abs(prev.oy - next.oy) < 0.5 &&
                    Math.abs(prev.rx - next.rx) < 0.35
                ) {
                    return prev;
                }
                return next;
            });
        };

        if (typeof ResizeObserver === 'undefined') {
            measure();
            return;
        }

        let ro: ResizeObserver | null = null;
        try {
            ro = new ResizeObserver(() => {
                measure();
            });
            ro.observe(root);
        } catch {
            ro?.disconnect();
            ro = null;
        }
        measure();

        return () => {
            ro?.disconnect();
        };
    }, []);

    const g = geom;
    const w = g?.w ?? 1;
    const h = g?.h ?? 1;
    const ox = g?.ox ?? 0;
    const oy = g?.oy ?? 0;
    const rw = g?.rw ?? 1;
    const rh = g?.rh ?? 1;
    const rx = g?.rx ?? 0;

    const innerGap = g ? Math.max(2.25, Math.min(w, h) * 0.028) : 0;
    const orx = g ? Math.min(rx, rw / 2 - 0.01, rh / 2 - 0.01) : 0;
    const ix = ox + innerGap;
    const iy = oy + innerGap;
    const iw = Math.max(0, rw - 2 * innerGap);
    const ih = Math.max(0, rh - 2 * innerGap);
    const irx = g
        ? Math.max(
              0,
              Math.min(
                  orx - innerGap * 0.55,
                  iw > 0 ? iw / 2 - 0.01 : 0,
                  ih > 0 ? ih / 2 - 0.01 : 0
              )
          )
        : 0;

    const rivetR = g ? Math.max(0.65, Math.min(w, h) * 0.006) : 0;
    const rivetOffset = g ? Math.max(5, Math.min(w, h) * 0.06) : 0;
    const rivets: ReadonlyArray<[number, number]> = g
        ? [
              [ox + rivetOffset, oy + rivetOffset],
              [ox + rw - rivetOffset, oy + rivetOffset],
              [ox + rw - rivetOffset, oy + rh - rivetOffset],
              [ox + rivetOffset, oy + rh - rivetOffset]
          ]
        : [];

    const showCornice = Boolean(g && rw > 1 && rh > 1 && w > 1 && h > 1);
    const showInner = showCornice && iw > 3 && ih > 3 && irx > 0.25;

    /* Dynamic host tag + ref for ResizeObserver; ref is not read during render. */
    /* eslint-disable react-hooks/refs -- createElement(Tag, { ref }) for div|section */
    return createElement(
        Tag,
        {
            ...rest,
            className: `${styles.root} ${className}`.trim(),
            'data-meta-frame': 'true',
            ref: rootRef as never
        },
        <>
            <span className={styles.slot} ref={slotRef}>
                {stampMetaFramed(children)}
            </span>
            <svg
                aria-hidden
                className={styles.cornice}
                focusable="false"
                height="100%"
                preserveAspectRatio="none"
                ref={svgRef}
                viewBox={`0 0 ${w} ${h}`}
                width="100%"
            >
                {showCornice ? (
                    <>
                        <defs>
                            <linearGradient
                                gradientUnits="userSpaceOnUse"
                                id={`${gid}-g`}
                                x1={ox}
                                x2={ox + rw}
                                y1={oy}
                                y2={oy + rh}
                            >
                                <stop offset="0%" stopColor="var(--theme-gold-bright)" />
                                <stop offset="42%" stopColor="var(--theme-gold)" />
                                <stop offset="100%" stopColor="var(--theme-gold-deep)" />
                            </linearGradient>
                            <linearGradient
                                gradientUnits="userSpaceOnUse"
                                id={`${gid}-h`}
                                x1={ox + rw}
                                x2={ox}
                                y1={oy}
                                y2={oy + rh}
                            >
                                <stop offset="0%" stopColor="var(--theme-gold-bright)" stopOpacity="0.55" />
                                <stop offset="100%" stopColor="var(--theme-gold-deep)" stopOpacity="0.9" />
                            </linearGradient>
                        </defs>
                        <rect
                            fill="none"
                            height={rh}
                            rx={orx}
                            ry={orx}
                            stroke={`url(#${gid}-g)`}
                            strokeWidth="1.35"
                            vectorEffect="non-scaling-stroke"
                            width={rw}
                            x={ox}
                            y={oy}
                        />
                        {showInner ? (
                            <rect
                                fill="none"
                                height={ih}
                                opacity="0.85"
                                rx={irx}
                                ry={irx}
                                stroke={`url(#${gid}-h)`}
                                strokeWidth="0.75"
                                vectorEffect="non-scaling-stroke"
                                width={iw}
                                x={ix}
                                y={iy}
                            />
                        ) : null}
                        {rivets.map(([cx, cy], i) => (
                            <circle
                                cx={cx}
                                cy={cy}
                                fill="var(--theme-gold-deep)"
                                key={i}
                                opacity="0.55"
                                r={rivetR}
                                stroke="var(--theme-gold-bright)"
                                strokeWidth="0.35"
                                vectorEffect="non-scaling-stroke"
                            />
                        ))}
                    </>
                ) : null}
            </svg>
        </>
    );
    /* eslint-enable react-hooks/refs */
};

export default MetaFrame;
