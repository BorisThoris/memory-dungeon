import type { ReactElement } from 'react';
import type { StoreItemId } from '../../shared/run-store-rules';

/**
 * The wares as drawings. When a thing is in stock it is *there*, drawn on its shelf or on the
 * counter; when it is not, the shelf is bare. Each is a small hand-set SVG in a 40x40 box in the
 * room's own inks - gold, cyan, parchment - so a ware reads as an object in the painting and not
 * as a button on it. The ring around it is gone; a lit glint under it and a thin outline on hover
 * or focus are all the chrome there is (`StoreVault.module.css`).
 */
const GOLD = '#e8b96a';
const GOLD_DARK = '#8a5a12';
const PARCHMENT = '#f1e3c4';
const CYAN = '#8fdcff';
const INK = '#2a1e16';

const glyphs: Partial<Record<StoreItemId, ReactElement>> = {
    miss: (
        <g>
            <ellipse cx="20" cy="30" fill={GOLD_DARK} rx="12" ry="4" />
            <ellipse cx="20" cy="27" fill={GOLD} rx="12" ry="4" stroke={GOLD_DARK} strokeWidth="1" />
            <ellipse cx="18" cy="21" fill={GOLD} rx="11" ry="4" stroke={GOLD_DARK} strokeWidth="1" />
            <ellipse cx="21" cy="15" fill={GOLD} rx="10" ry="4" stroke={GOLD_DARK} strokeWidth="1" />
            <ellipse cx="21" cy="13.5" fill="#fff1c2" rx="4" ry="1.4" />
        </g>
    ),
    peek: (
        <g>
            <path d="M20 4 L29 16 L26 33 L14 33 L11 16 Z" fill={CYAN} fillOpacity="0.85" stroke="#d9f4ff" strokeWidth="1" />
            <path d="M20 4 L20 33" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1" />
            <path d="M11 16 L20 12 L29 16" fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1" />
            <rect fill={GOLD_DARK} height="4" rx="1" width="18" x="11" y="33" />
        </g>
    ),
    shuffle: (
        <g>
            <path d="M20 5 L20 33" stroke={GOLD} strokeWidth="2" />
            <path d="M8 12 L32 12" stroke={GOLD} strokeWidth="1.6" />
            <path d="M8 12 L4 22 L12 22 Z" fill="none" stroke={GOLD} strokeWidth="1.2" />
            <path d="M32 12 L28 22 L36 22 Z" fill="none" stroke={GOLD} strokeWidth="1.2" />
            <ellipse cx="8" cy="22" fill={GOLD} rx="4.5" ry="1.6" />
            <ellipse cx="32" cy="22" fill={GOLD} rx="4.5" ry="1.6" />
            <rect fill={GOLD_DARK} height="3" rx="1" width="14" x="13" y="33" />
        </g>
    ),
    bomb: (
        <g>
            <path d="M12 8 C10 4 30 4 28 8 L30 24 C32 30 8 30 10 24 Z" fill={GOLD} stroke={GOLD_DARK} strokeWidth="1" />
            <ellipse cx="20" cy="27" fill={GOLD_DARK} rx="11" ry="2.4" />
            <rect fill={GOLD_DARK} height="6" rx="1.5" width="4" x="18" y="2" />
            <circle cx="20" cy="31" fill={GOLD_DARK} r="1.8" />
        </g>
    ),
    deep_pockets: (
        <g>
            <path d="M6 10 Q20 6 34 10 L34 30 Q20 26 6 30 Z" fill={PARCHMENT} stroke={INK} strokeWidth="1" />
            <path d="M20 8 L20 28" stroke={INK} strokeOpacity="0.5" strokeWidth="1" />
            <path d="M10 15 L17 14 M10 19 L17 18 M10 23 L17 22 M23 14 L30 15 M23 18 L30 19 M23 22 L30 23" stroke={INK} strokeOpacity="0.6" strokeWidth="1" />
            <circle cx="12" cy="9" fill={GOLD} r="2.2" />
        </g>
    ),
    gilded_chain: (
        <g>
            <path d="M14 8 L14 12 Q10 14 10 20 L10 32 Q10 35 13 35 L27 35 Q30 35 30 32 L30 20 Q30 14 26 12 L26 8 Z" fill="#3c2412" stroke={GOLD_DARK} strokeWidth="1" />
            <rect fill={GOLD} height="3" rx="1" width="14" x="13" y="6" />
            <path d="M14 22 Q20 26 26 22 L26 32 L14 32 Z" fill={GOLD} fillOpacity="0.9" />
            <circle cx="16" cy="17" fill="#ffffff" fillOpacity="0.35" r="1.5" />
        </g>
    ),
    long_look: (
        <g>
            <path d="M16 6 L24 6 L27 12 L13 12 Z" fill={GOLD_DARK} />
            <rect fill="#ffe9b0" fillOpacity="0.85" height="16" rx="2" stroke={GOLD_DARK} strokeWidth="1" width="14" x="13" y="12" />
            <path d="M20 16 C22 20 22 24 20 26 C18 24 18 20 20 16 Z" fill="#ffb347" />
            <rect fill={GOLD_DARK} height="3" rx="1" width="16" x="12" y="28" />
            <path d="M20 2 L20 6" stroke={GOLD_DARK} strokeWidth="1.5" />
        </g>
    ),
    tallow_candle: (
        <g>
            <rect fill={PARCHMENT} height="18" rx="2" stroke={GOLD_DARK} strokeWidth="1" width="8" x="16" y="14" />
            <path d="M20 4 C24 9 24 12 20 14 C16 12 16 9 20 4 Z" fill="#ffb347" />
            <path d="M20 8 C21.5 10 21.5 12 20 13 C18.5 12 18.5 10 20 8 Z" fill="#fff1c2" />
            <ellipse cx="20" cy="33" fill={GOLD_DARK} rx="9" ry="2.4" />
        </g>
    )
};

/** The drawing for a ware, in a 40x40 viewBox. */
export const storeWareGlyph = (id: StoreItemId): ReactElement => glyphs[id] ?? <circle cx="20" cy="20" r="12" fill={CYAN} />;
