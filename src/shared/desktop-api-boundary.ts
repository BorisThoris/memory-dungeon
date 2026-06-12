import { z } from 'zod';
import type { AchievementId, AchievementUnlockResult, DisplayMode } from './contracts';
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
