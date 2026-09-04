import { z } from 'zod';
import type {
    AchievementId,
    AchievementUnlockResult,
    DisplayMode,
    RendererErrorReport
} from './contracts';
import { ACHIEVEMENT_IDS } from './save-data';

const achievementIdSchema = z.custom<AchievementId>(
    (value) => typeof value === 'string' && ACHIEVEMENT_IDS.includes(value as AchievementId)
);

const displayModeSchema = z.enum(['windowed', 'fullscreen']);

const achievementUnlockResultSchema = z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true) }),
    z.object({
        ok: z.literal(false),
        reason: z.enum(['not_connected', 'steam_rejected', 'persistence_error']),
        detail: z.string().optional()
    })
]);

export const normalizeUnknownAchievementUnlockResult = (input: unknown): AchievementUnlockResult => {
    const parsed = achievementUnlockResultSchema.safeParse(input);
    return parsed.success ? parsed.data : { ok: false, reason: 'steam_rejected', detail: 'Malformed Steam bridge response.' };
};

export const normalizeUnknownSteamConnected = (input: unknown): boolean => input === true;

export const normalizeUnknownAchievementId = (input: unknown): AchievementId | null => {
    const parsed = achievementIdSchema.safeParse(input);
    return parsed.success ? parsed.data : null;
};

export const normalizeUnknownDisplayMode = (input: unknown): DisplayMode | null => {
    const parsed = displayModeSchema.safeParse(input);
    return parsed.success ? parsed.data : null;
};

/** Caps so a runaway stack cannot fill the crash log, mirroring the limits in `crash-log.ts`. */
const RENDERER_ERROR_MESSAGE_LIMIT = 500;
const RENDERER_ERROR_STACK_LIMIT = 4000;

const rendererErrorReportSchema = z.object({
    componentStack: z.string().nullable().optional(),
    message: z.string().optional(),
    stack: z.string().nullable().optional()
});

/**
 * A render-error report arrives over IPC from a renderer that just failed, so it is exactly the
 * kind of payload worth distrusting: never throws, and returns something recordable whatever it is
 * handed.
 */
export const normalizeRendererErrorReport = (input: unknown): RendererErrorReport => {
    const parsed = rendererErrorReportSchema.safeParse(input);
    const value = parsed.success ? parsed.data : {};
    return {
        componentStack: value.componentStack?.slice(0, RENDERER_ERROR_STACK_LIMIT) ?? null,
        message: (value.message ?? 'Renderer error with no message').slice(0, RENDERER_ERROR_MESSAGE_LIMIT),
        stack: value.stack?.slice(0, RENDERER_ERROR_STACK_LIMIT) ?? null
    };
};
