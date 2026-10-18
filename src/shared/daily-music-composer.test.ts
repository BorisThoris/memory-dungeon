import { describe, expect, it } from 'vitest';
import { REALM_IDS } from './contracts';
import { composeDailyPiece, dailyMusicSalt, DAILY_MUSIC_MODES, localDateKey } from './daily-music-composer';

const realms = [...REALM_IDS, 'run'] as const;
const pitchClassAboveA = (pitch: number): number => (((pitch - 69) % 12) + 12) % 12;
const tonal = (voice: string): boolean => !['kick', 'hat', 'shaker', 'rim'].includes(voice);

describe('the day’s music', () => {
    it('writes the same piece for the same player on the same day, every time', () => {
        const salt = dailyMusicSalt('player-a', '2026-10-18');
        for (const realm of realms) expect(composeDailyPiece(salt, realm)).toEqual(composeDailyPiece(salt, realm));
    });

    it('writes a different piece tomorrow, and for another player today', () => {
        const today = composeDailyPiece(dailyMusicSalt('player-a', '2026-10-18'), 'ember');
        const tomorrow = composeDailyPiece(dailyMusicSalt('player-a', '2026-10-19'), 'ember');
        const someoneElse = composeDailyPiece(dailyMusicSalt('player-b', '2026-10-18'), 'ember');
        expect(tomorrow.notes).not.toEqual(today.notes);
        expect(someoneElse.notes).not.toEqual(today.notes);
        // Over a month, the melodies do not repeat.
        const melodies = new Set(Array.from({ length: 30 }, (_, day) =>
            JSON.stringify(composeDailyPiece(dailyMusicSalt('player-a', `2026-11-${String(day + 1).padStart(2, '0')}`), 'tide').notes.filter((n) => n.voice === 'lead').map((n) => [n.beat, n.pitch]))
        ));
        expect(melodies.size).toBe(30);
    });

    it('stays in its mode on A, which always holds the cascade’s A, B, D and E', () => {
        for (const mode of Object.values(DAILY_MUSIC_MODES)) for (const pc of [0, 2, 5, 7]) expect(mode).toContain(pc);
        for (let day = 1; day <= 20; day += 1) {
            for (const realm of realms) {
                const piece = composeDailyPiece(dailyMusicSalt('p', `2026-12-${day}`), realm);
                const mode = DAILY_MUSIC_MODES[piece.mode] as readonly number[];
                for (const note of piece.notes.filter((n) => tonal(n.voice))) expect(mode, `${realm} ${note.voice} ${note.pitch}`).toContain(pitchClassAboveA(note.pitch));
            }
        }
    });

    it('fills one sixteen-bar loop, each voice in its own register, the melody never on top of itself', () => {
        for (const realm of realms) {
            const piece = composeDailyPiece(dailyMusicSalt('p', '2026-10-18'), realm);
            expect(piece.loopBeats).toBe(64);
            for (const note of piece.notes) {
                expect(note.beat).toBeGreaterThanOrEqual(0);
                expect(note.beat).toBeLessThan(piece.loopBeats);
                expect(note.velocity).toBeGreaterThan(0);
                expect(note.velocity).toBeLessThanOrEqual(1);
            }
            const lead = piece.notes.filter((n) => n.voice === 'lead');
            expect(lead.length).toBeGreaterThan(16);
            for (const n of lead) expect(n.pitch).toBeGreaterThanOrEqual(69);
            for (const n of lead) expect(n.pitch).toBeLessThanOrEqual(69 + 24);
            for (const n of piece.notes.filter((x) => x.voice === 'bass')) expect(n.pitch).toBeLessThan(60);
            for (let i = 1; i < lead.length; i += 1) expect(lead[i]!.beat).toBeGreaterThanOrEqual(lead[i - 1]!.beat + lead[i - 1]!.length - 1e-9);
            expect(piece.bpm).toBeGreaterThanOrEqual(60);
            expect(piece.bpm).toBeLessThanOrEqual(120);
        }
    });

    it('holds a pedal on A under every chord, so the piece stays in the game’s key', () => {
        for (const realm of realms) {
            const piece = composeDailyPiece(dailyMusicSalt('p', '2026-10-18'), realm);
            const pedal = piece.notes.filter((n) => n.voice === 'pad' && n.pitch === 45);
            expect(pedal.map((n) => n.beat)).toEqual([0, 8, 16, 24, 32, 40, 48, 56]);
        }
    });

    it('gives each realm its own mood', () => {
        const salt = dailyMusicSalt('p', '2026-10-18');
        expect(composeDailyPiece(salt, 'frost').bpm).toBeLessThan(composeDailyPiece(salt, 'storm').bpm);
        expect(composeDailyPiece(salt, 'frost').notes.some((n) => n.voice === 'kick')).toBe(false);
        expect(composeDailyPiece(salt, 'storm').notes.some((n) => n.voice === 'kick')).toBe(true);
        expect(new Set(realms.map((realm) => composeDailyPiece(salt, realm).timbre)).size).toBeGreaterThan(3);
    });

    it('turns the day over at the player’s own midnight', () => {
        expect(localDateKey(new Date(2026, 9, 18, 23, 59))).toBe('2026-10-18');
        expect(localDateKey(new Date(2026, 9, 19, 0, 1))).toBe('2026-10-19');
    });
});
