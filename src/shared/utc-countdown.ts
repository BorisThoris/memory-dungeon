/** Next UTC midnight countdown as HH:MM:SS (for daily challenge UI). */
export const formatNextUtcReset = (nowMs: number): string => {
    if (!Number.isFinite(nowMs)) {
        return '00:00:00';
    }
    const now = new Date(nowMs);
    const nextReset = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0);
    const remaining = Math.max(0, nextReset - nowMs);
    const totalSeconds = Math.floor(remaining / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
};
