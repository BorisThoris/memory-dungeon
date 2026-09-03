/**
 * REG-027, REG-029–031, REG-039, REG-041–043, REG-056–058, REG-062, REG-109–112
 * — Phase-5 “hardening” contract surfaces: perf, GPU, input, FX, a11y, and offline trust notes.
 * Implementation detail remains in renderer/game code; this module is the index tests and bots read.
 */

import type { GraphicsQualityPreset } from '../contracts';
import { getGraphicsQualityTierSnapshot } from '../graphicsQuality';

// --- REG-109: performance budget + quality preset enforcement ---

/** Soft frame-time budget (ms) for 60Hz targets — observability only; not a hard cap in the runtime loop. */
export const REG109_TARGET_FRAME_BUDGET_MS = 16.7;

export const reg109QualityEnforcesDprAndAniso = (quality: GraphicsQualityPreset): boolean => {
    const s = getGraphicsQualityTierSnapshot(quality);
    return s.boardDprCapStandard > 0 && s.boardAnisotropyCap > 0 && s.menuPixiResolutionCap > 0;
};

// --- REG-110 / REG-031 / REG-057: WebGL and GPU ---

export type Reg110GpuHealth = 'ok' | 'context_lost' | 'webgl_unavailable';

export const REG110_CONTEXT_LOSS_USER_COPY =
    'WebGL context was lost — the board will try to rebuild when the GPU restores it. If this persists, reload.';

// --- REG-111: input latency / frame pacing (policy text + numeric SLA for QA) ---

export const REG111_POINTER_TO_COMMIT_SLA_MS = 48;

// --- REG-112: visual FX LOD + reduced motion ---

export const REG112_REDUCED_MOTION_SUPPRESSES: readonly string[] = [
    'parallaxTilt',
    'boardEntranceExcess',
    'hudChromaticMicro',
    'menuPixiOverdraw'
] as const;

// --- REG-027: visual baseline refresh (version token for CI/screenshot policy) ---

export const REG027_VISUAL_BASELINE_EPOCH = '2026-04-reg027-v1' as const;

// --- REG-029: input + a11y unification (keyboard, pointer and controller all reach every screen) ---

export const REG029_INPUT_PATHS = ['keyboard', 'pointer', 'gamepad'] as const;

// --- REG-030: local balance / telemetry (no PII; offline) ---

export const REG030_LOCAL_PLAYTEST_SCHEMA = 'local_only_v1' as const;

// --- REG-039: achievements + Steam (offline recovery surfaces) ---

export const REG039_ACHIEVEMENT_OFFLINE_WARN =
    'Achievements in this build are local-first; platform unlock sync is deferred.';

// --- REG-041 / REG-042 / REG-043: run export, toasts, pause ---

export const REG041_EXPORT_SCOPE = 'local_string_share_v1' as const;
export const REG042_TOAST_DEDUPE_WINDOW_MS = 4000;
export const REG043_PAUSE_STOPS_MUSIC = true;

// --- REG-056: cognitive a11y ---

export const REG056_MIN_FOCUS_CONTRAST_RATIO = 4.5;

// --- REG-058: dev fixtures / state matrix ---

export const REG058_DEV_MATRIX_NAMESPACE = 'dev.reg058.fixtures' as const;

// --- REG-062: e2e flake control ---

export const REG062_E2E_STABILITY_MODE = 'shard_and_worker_cap' as const;
export const REG062_E2E_MAX_WORKER_HINT = 4;
