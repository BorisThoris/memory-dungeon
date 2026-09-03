/**
 * Where the window was last time.
 *
 * A desktop game that forgets its size and position every launch is a game the player has to
 * re-arrange every session. Restoring bounds is only half of it, though: a monitor that was
 * unplugged, a resolution that changed, or a save file someone edited can all put the window
 * somewhere the player cannot reach. Everything here is pure so those cases are decidable without
 * an actual screen.
 */

export interface WindowBounds {
    readonly height: number;
    readonly width: number;
    readonly x: number;
    readonly y: number;
}

export interface WindowState {
    readonly bounds: WindowBounds | null;
    readonly maximized: boolean;
}

export interface DisplayArea {
    readonly height: number;
    readonly width: number;
    readonly x: number;
    readonly y: number;
}

/**
 * The smallest window the layout is verified at. `e2e/ui-fit-contract.spec.ts` holds every screen
 * to fitting at 390x844 and 812x375, so the desktop floor is a comfortable size rather than a
 * layout limit — low enough to sit beside other windows on a 1366x768 laptop, and below the Steam
 * Deck's 1280x800 so the window is resizable there rather than pinned to the full screen.
 */
export const MIN_WINDOW_WIDTH = 900;
export const MIN_WINDOW_HEIGHT = 600;

export const DEFAULT_WINDOW_WIDTH = 1600;
export const DEFAULT_WINDOW_HEIGHT = 960;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Untrusted input: the store file is on disk and can be edited, truncated, or written by an older build. */
export const normalizeWindowState = (value: unknown): WindowState => {
    if (typeof value !== 'object' || value === null) {
        return { bounds: null, maximized: false };
    }
    const record = value as Record<string, unknown>;
    const maximized = record.maximized === true;
    const raw = record.bounds;
    if (typeof raw !== 'object' || raw === null) {
        return { bounds: null, maximized };
    }
    const { height, width, x, y } = raw as Record<string, unknown>;
    if (!isFiniteNumber(height) || !isFiniteNumber(width) || !isFiniteNumber(x) || !isFiniteNumber(y)) {
        return { bounds: null, maximized };
    }
    if (width < MIN_WINDOW_WIDTH || height < MIN_WINDOW_HEIGHT) {
        return { bounds: null, maximized };
    }
    return {
        bounds: { height: Math.round(height), width: Math.round(width), x: Math.round(x), y: Math.round(y) },
        maximized
    };
};

/** How much of the window has to land on a display before we call it reachable. */
const VISIBLE_MARGIN_PX = 80;

const overlaps = (bounds: WindowBounds, area: DisplayArea): boolean =>
    bounds.x + bounds.width > area.x + VISIBLE_MARGIN_PX &&
    bounds.x < area.x + area.width - VISIBLE_MARGIN_PX &&
    bounds.y + bounds.height > area.y &&
    // The title bar has to be on-screen or the window cannot be dragged back.
    bounds.y < area.y + area.height - VISIBLE_MARGIN_PX;

/**
 * Bring stored bounds back onto a display that exists now. Returns `null` when there is nothing
 * usable to restore, which the caller reads as "open at the default size, centred".
 */
export const resolveRestoredBounds = (
    stored: WindowBounds | null,
    displays: readonly DisplayArea[]
): WindowBounds | null => {
    if (!stored || displays.length === 0) {
        return null;
    }
    const host = displays.find((area) => overlaps(stored, area));
    if (!host) {
        return null;
    }
    // A display that shrank since last launch (resolution change, a laptop undocked) can leave the
    // window wider than the screen; clamp rather than discard, so the size is at least close.
    const width = Math.max(MIN_WINDOW_WIDTH, Math.min(stored.width, host.width));
    const height = Math.max(MIN_WINDOW_HEIGHT, Math.min(stored.height, host.height));
    const x = Math.min(Math.max(stored.x, host.x), host.x + Math.max(0, host.width - width));
    const y = Math.min(Math.max(stored.y, host.y), host.y + Math.max(0, host.height - height));
    return { height, width, x, y };
};

export interface WindowStateSource {
    getBounds: () => WindowBounds;
    getNormalBounds?: () => WindowBounds;
    isFullScreen: () => boolean;
    isMaximized: () => boolean;
    isMinimized: () => boolean;
}

/**
 * What to store for a window as it is right now. A maximized, minimized or fullscreen window's
 * outer bounds are the screen, not the size the player chose, so the restorable size is kept
 * instead and the maximized flag carries the rest.
 */
export const captureWindowState = (window: WindowStateSource): WindowState => {
    const maximized = window.isMaximized();
    if (window.isMinimized() || window.isFullScreen()) {
        // Nothing trustworthy to read: the caller keeps whatever was stored before.
        return { bounds: null, maximized };
    }
    const bounds = maximized && window.getNormalBounds ? window.getNormalBounds() : window.getBounds();
    return {
        bounds: {
            height: Math.round(bounds.height),
            width: Math.round(bounds.width),
            x: Math.round(bounds.x),
            y: Math.round(bounds.y)
        },
        maximized
    };
};

/** Merge a capture over what is already stored, so a minimized close does not erase the size. */
export const mergeWindowState = (stored: WindowState, captured: WindowState): WindowState => ({
    bounds: captured.bounds ?? stored.bounds,
    maximized: captured.maximized
});
