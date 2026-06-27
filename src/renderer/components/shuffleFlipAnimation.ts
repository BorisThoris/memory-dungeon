/**
 * Shuffle / deal motion helpers for the **WebGL** tile board (`TileBoard` → `TileBoardScene`).
 * This module is the single timing source for shuffle, deal-in, and related premium motion accents.
 */
import { TILE_SPACING } from './tileShatter';

export const FLIP_DURATION_MS = 680;
export const STAGGER_MS = 28;
const SHUFFLE_SETTLE_TAIL_MS = 220;
const ENTRANCE_DURATION_MS = 380;
const ENTRANCE_STAGGER_MS = 12;
const ENTRANCE_SETTLE_TAIL_MS = 80;
const ENTRANCE_MAX_BUDGET_MS = 680;

interface BoardMotionTransform {
    rx: number;
    ry: number;
    rz: number;
    rotX: number;
    rotY: number;
    rotZ: number;
}

const ZERO_MOTION_TRANSFORM: BoardMotionTransform = {
    rx: 0,
    ry: 0,
    rz: 0,
    rotX: 0,
    rotY: 0,
    rotZ: 0
};

interface BoardMotionState {
    arch: number;
    columnNorm: number;
    globalSmooth: number;
    lane: number;
    remain: number;
    rowNorm: number;
}

interface BoardMotionTiming {
    durationMs: number;
    staggerMs: number;
}

/** Upper bound for 3D ease-out: matches worst-case staggered shuffle motion on this board. */
export function computeShuffleMotionBudgetMs(tileCount: number): number {
    const n = Math.max(1, tileCount);
    if (n <= 1) {
        return FLIP_DURATION_MS + SHUFFLE_SETTLE_TAIL_MS;
    }
    return (n - 1) * STAGGER_MS + FLIP_DURATION_MS + SHUFFLE_SETTLE_TAIL_MS;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const smoothstep = (value: number): number => {
    const t = clamp01(value);
    return t * t * (3 - 2 * t);
};

const computeBoardMotionState = (
    nowMs: number,
    deadlineMs: number,
    budgetMs: number,
    boardOrderIndex: number,
    tileCount: number,
    rows: number,
    columns: number,
    timing: BoardMotionTiming = { durationMs: FLIP_DURATION_MS, staggerMs: STAGGER_MS }
): BoardMotionState | null => {
    if (budgetMs <= 0 || deadlineMs <= 0 || tileCount <= 0) {
        return null;
    }

    const startMs = deadlineMs - budgetMs;

    if (nowMs < startMs || nowMs >= deadlineMs) {
        return null;
    }

    const elapsed = nowMs - startMs;
    const n = Math.max(1, tileCount);
    const clampedIndex = Math.min(Math.max(0, boardOrderIndex), Math.max(0, n - 1));
    const tileStart = clampedIndex * timing.staggerMs;
    const localT = Math.max(0, elapsed - tileStart);
    const u = clamp01(localT / timing.durationMs);
    const eased = smoothstep(u);
    const remain = 1 - eased;
    const arch = Math.sin(u * Math.PI);
    const row = Math.floor(clampedIndex / Math.max(1, columns));
    const column = clampedIndex % Math.max(1, columns);
    const rowNorm = rows <= 1 ? 0 : row / Math.max(1, rows - 1) - 0.5;
    const columnNorm = columns <= 1 ? 0 : column / Math.max(1, columns - 1) - 0.5;
    const lane = n <= 1 ? 0 : clampedIndex / Math.max(1, n - 1) * 2 - 1;

    return {
        arch,
        columnNorm,
        globalSmooth: smoothstep(elapsed / budgetMs),
        lane,
        remain,
        rowNorm
    };
};

export function computeShuffleMotionTransform(
    nowMs: number,
    deadlineMs: number,
    budgetMs: number,
    boardOrderIndex: number,
    tileCount: number,
    rows: number,
    columns: number
): BoardMotionTransform {
    const state = computeBoardMotionState(
        nowMs,
        deadlineMs,
        budgetMs,
        boardOrderIndex,
        tileCount,
        rows,
        columns
    );
    if (!state) {
        return ZERO_MOTION_TRANSFORM;
    }

    const gridSpan = Math.max((Math.max(1, columns) - 1) * TILE_SPACING, (Math.max(1, rows) - 1) * TILE_SPACING);
    const sweepRadius = (0.18 + gridSpan * 0.018) * state.remain * (0.52 + state.arch * 0.48);
    const theta = state.globalSmooth * Math.PI * 1.25 + state.lane * 1.18 + state.rowNorm * 0.85;
    const lateralSweep = state.lane * sweepRadius * 0.44;
    const crossSweep = (state.columnNorm - state.rowNorm * 0.65) * sweepRadius * 0.34;

    return {
        rx: Math.cos(theta) * sweepRadius * 0.68 + lateralSweep,
        ry: Math.sin(theta) * sweepRadius * 0.34 + crossSweep,
        rz: state.arch * 0.022 + state.remain * 0.004,
        rotX: -Math.sin(theta + 0.22) * 0.048 * state.arch,
        rotY: state.lane * 0.11 * state.remain + Math.sin(theta) * 0.045 * state.arch,
        rotZ: Math.cos(theta - 0.33) * 0.068 * state.arch
    };
}

/**
 * Legacy wrapper kept for focused tests and any narrow callers that only care about the lift.
 */
export function computeStaggeredShuffleDealZ(
    nowMs: number,
    deadlineMs: number,
    budgetMs: number,
    boardOrderIndex: number,
    tileCount: number
): number {
    return computeShuffleMotionTransform(nowMs, deadlineMs, budgetMs, boardOrderIndex, tileCount, 1, tileCount).rz;
}

/** Short, capped envelope used when a new board identity appears (deal-in). */
export function computeBoardEntranceMotionBudgetMs(tileCount: number): number {
    const n = Math.max(1, tileCount);
    return Math.min(
        ENTRANCE_MAX_BUDGET_MS,
        ENTRANCE_DURATION_MS + Math.max(0, n - 1) * ENTRANCE_STAGGER_MS + ENTRANCE_SETTLE_TAIL_MS
    );
}

/**
 * New-board deal-in: broader sweep than in-board shuffle, but same timing vocabulary so the two effects feel related.
 */
export function computeBoardEntranceMotionTransform(
    nowMs: number,
    deadlineMs: number,
    budgetMs: number,
    boardOrderIndex: number,
    tileCount: number,
    rows: number,
    columns: number
): BoardMotionTransform {
    const state = computeBoardMotionState(
        nowMs,
        deadlineMs,
        budgetMs,
        boardOrderIndex,
        tileCount,
        rows,
        columns,
        { durationMs: ENTRANCE_DURATION_MS, staggerMs: ENTRANCE_STAGGER_MS }
    );
    if (!state) {
        return ZERO_MOTION_TRANSFORM;
    }

    const gridSpan = Math.max((Math.max(1, columns) - 1) * TILE_SPACING, (Math.max(1, rows) - 1) * TILE_SPACING);
    const radius = (1.35 + gridSpan * 0.16) * state.remain;
    const theta0 = state.lane * Math.PI * 0.88 + state.columnNorm * Math.PI * 0.42;
    const theta = theta0 + state.globalSmooth * Math.PI * 0.82;

    return {
        rx: radius * Math.cos(theta),
        ry: radius * Math.sin(theta) * 0.52,
        rz: state.arch * 0.018 + state.remain * 0.006,
        rotX: -Math.sin(theta) * 0.038 * state.arch,
        rotY: Math.cos(theta + state.rowNorm * 0.8) * 0.052 * state.remain,
        rotZ: Math.sin(theta - 0.3) * 0.044 * state.arch
    };
}

/** Legacy wrapper for callers that only need the XY portion. */
export function computeBoardEntranceRemainderXY(
    nowMs: number,
    deadlineMs: number,
    budgetMs: number,
    boardOrderIndex: number,
    tileCount: number,
    rows: number,
    columns: number
): { rx: number; ry: number } {
    const transform = computeBoardEntranceMotionTransform(
        nowMs,
        deadlineMs,
        budgetMs,
        boardOrderIndex,
        tileCount,
        rows,
        columns
    );
    return { rx: transform.rx, ry: transform.ry };
}
