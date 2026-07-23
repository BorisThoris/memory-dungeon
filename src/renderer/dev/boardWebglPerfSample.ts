/**
 * Dev-only: `localStorage.perfBoard = '1'` — log average ms per R3F frame (tile step + viewport combined).
 * `localStorage.perfBoardVerbose = '1'` — also log phase breakdown (tileStep vs viewport) every 120 frames.
 * Optional: `boardWebglPerfSampleRecordReactCommit(ms)` when verbose — TileBoard layout cost.
 * Production `vite build` resolves this module to `boardWebglPerfSample.stub.ts` (see vite.config.mts).
 *
 * Benchmark (local): pick a fixed run seed / board JSON, enable `perfBoard=1`, compare mean tileStep ms
 * after changes — keep results in dev notes only (not CI — too noisy).
 */
let accumMs = 0;
let frameCount = 0;

let accumTileStepMs = 0;
let accumViewportMs = 0;
let verboseFrameCount = 0;

let reactCommitAccumMs = 0;
let reactCommitSamples = 0;

const SAMPLE_FRAMES = 120;

export const boardWebglPerfSampleEnabled = (): boolean =>
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    (() => {
        try {
            return window.localStorage.getItem('perfBoard') === '1';
        } catch {
            return false;
        }
    })();

export const boardWebglPerfSampleVerboseEnabled = (): boolean =>
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    (() => {
        try {
            return window.localStorage.getItem('perfBoardVerbose') === '1';
        } catch {
            return false;
        }
    })();

export const boardWebglPerfSampleAccumulate = (deltaMs: number): void => {
    if (!import.meta.env.DEV) {
        return;
    }

    accumMs += deltaMs;
    frameCount += 1;

    if (frameCount < SAMPLE_FRAMES) {
        return;
    }

    const avg = accumMs / frameCount;
    console.info(`[perfBoard] avg frame slice ${avg.toFixed(3)}ms over ${frameCount} frames`);
    accumMs = 0;
    frameCount = 0;
};

/** Split consolidated `useFrame` cost: tile stepping vs boardGroup pan/scale damping. */
export const boardWebglPerfSampleAccumulatePhases = (phases: {
    tileStepMs: number;
    viewportMs: number;
}): void => {
    if (!import.meta.env.DEV) {
        return;
    }

    const coarse = boardWebglPerfSampleEnabled();
    const verbose = boardWebglPerfSampleVerboseEnabled();

    if (coarse) {
        boardWebglPerfSampleAccumulate(phases.tileStepMs + phases.viewportMs);
    } else if (!verbose) {
        return;
    }

    if (verbose) {
        accumTileStepMs += phases.tileStepMs;
        accumViewportMs += phases.viewportMs;
        verboseFrameCount += 1;
        if (verboseFrameCount >= SAMPLE_FRAMES) {
            const n = verboseFrameCount;
            const ts = accumTileStepMs / n;
            const vp = accumViewportMs / n;
            const rc =
                reactCommitSamples > 0 ? (reactCommitAccumMs / reactCommitSamples).toFixed(3) : 'n/a';
            console.info(
                `[perfBoard][verbose] avg tileStep ${ts.toFixed(3)}ms viewport ${vp.toFixed(3)}ms (react layout avg ${rc}ms, n=${reactCommitSamples}) over ${n} frames`
            );
            accumTileStepMs = 0;
            accumViewportMs = 0;
            verboseFrameCount = 0;
            reactCommitAccumMs = 0;
            reactCommitSamples = 0;
        }
    }
};

/** TileBoard `useLayoutEffect`: optional React commit/layout cost when perfBoardVerbose is on. */
export const boardWebglPerfSampleRecordReactCommit = (deltaMs: number): void => {
    if (!import.meta.env.DEV || !boardWebglPerfSampleVerboseEnabled()) {
        return;
    }
    reactCommitAccumMs += deltaMs;
    reactCommitSamples += 1;
};
