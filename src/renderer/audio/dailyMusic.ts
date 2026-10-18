import { REALM_IDS, type RealmId } from '../../shared/contracts';
import { composeDailyPiece, dailyMusicSalt, localDateKey, type DailyMusicPiece } from '../../shared/daily-music-composer';
import { DAILY_MUSIC_COPY } from '../copy/realmCopy';
import { renderDailyPiece } from './dailyMusicRender';
import { setDailyTrackUrl } from './gameplayMusic';

/**
 * The day's music for this player, composed and rendered while the game boots, and handed to the
 * music element as each realm's track (`gameplayMusic.ts`). The recorded realm loops stay as the
 * fallback: a device without offline audio, or a piece that fails to render, plays them instead.
 *
 * "Per player, per day" (the owner's call, 2026-10-18): the salt is a key this install makes once
 * and keeps, and the player's own date, so their day turns over at their midnight.
 */

const PLAYER_KEY_STORAGE = 'memory-dungeon.daily-music.player';

/** This install's own key: made once, kept. A session without storage gets one for its lifetime. */
let sessionKey: string | null = null;
export const playerMusicKey = (): string => {
    try {
        const stored = window.localStorage.getItem(PLAYER_KEY_STORAGE);
        if (stored) return stored;
    } catch {
        // Storage may be unavailable; fall through to a session key.
    }
    if (!sessionKey) {
        const bytes = new Uint8Array(8);
        if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes);
        else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
        sessionKey = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    }
    try {
        window.localStorage.setItem(PLAYER_KEY_STORAGE, sessionKey);
    } catch {
        // Kept for the session only.
    }
    return sessionKey;
};

const DAILY_PIECES: readonly (RealmId | 'run')[] = [...REALM_IDS, 'run'];

let prepared: Promise<void> | null = null;

/** The pieces that rendered today, for the run details' credit line: only music that is actually playing is named. */
const renderedPieces = new Map<RealmId | 'run', Pick<DailyMusicPiece, 'bpm' | 'mode' | 'timbre'>>();

/** Today's piece in this realm (the plain run's off a realm), or null when that realm plays its recorded loop. */
export const dailyMusicCredit = (realm: RealmId | null): Pick<DailyMusicPiece, 'bpm' | 'mode' | 'timbre'> | null =>
    renderedPieces.get(realm ?? 'run') ?? null;

/** The run details' music line: today's piece in this realm, or null on a recorded loop. */
export const dailyMusicCreditLine = (realm: RealmId | null): string | null => {
    const piece = dailyMusicCredit(realm);
    return piece ? DAILY_MUSIC_COPY.credit(piece) : null;
};

/** Compose and render today's pieces once per session; resolves when every one is ready or has fallen back. */
export const prepareDailyMusic = (now: Date = new Date()): Promise<void> => {
    if (prepared) return prepared;
    if (typeof OfflineAudioContext === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        prepared = Promise.resolve();
        return prepared;
    }
    const salt = dailyMusicSalt(playerMusicKey(), localDateKey(now));
    /*
     * All six at once: each offline render runs on its own audio thread, so the wall time is the
     * slowest piece rather than the sum - about 10s against 26s one after another on a loaded
     * machine (2026-10-18), inside the loading step's cap.
     */
    prepared = Promise.all(
        DAILY_PIECES.map(async (realm) => {
            try {
                const piece = composeDailyPiece(salt, realm);
                const wav = await renderDailyPiece(piece);
                setDailyTrackUrl(realm === 'run' ? 'run' : `realm:${realm}`, URL.createObjectURL(wav));
                renderedPieces.set(realm, { bpm: piece.bpm, mode: piece.mode, timbre: piece.timbre });
            } catch {
                // That realm keeps its recorded loop.
            }
        })
    ).then(() => undefined);
    return prepared;
};
