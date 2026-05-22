import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RunState } from '../../shared/contracts';
import { getAdaptiveMusicState, musicGainFromSettings, resolveAdaptiveMusicState, useGameplayMusic } from './gameplayMusic';

class MockAudioElement {
    static instances: MockAudioElement[] = [];

    src?: string;
    loop = false;
    preload = '';
    volume = 1;
    play = vi.fn(() => Promise.resolve());
    pause = vi.fn();
    load = vi.fn();
    removeAttribute = vi.fn();
    private readonly listeners = new Map<string, Set<() => void>>();

    constructor(src?: string) {
        this.src = src;
        MockAudioElement.instances.push(this);
    }

    addEventListener(eventName: string, listener: () => void): void {
        const listeners = this.listeners.get(eventName) ?? new Set<() => void>();
        listeners.add(listener);
        this.listeners.set(eventName, listeners);
    }

    removeEventListener(eventName: string, listener: () => void): void {
        this.listeners.get(eventName)?.delete(listener);
    }

    dispatch(eventName: string): void {
        for (const listener of this.listeners.get(eventName) ?? []) {
            listener();
        }
    }
}

const installMockAudio = (): void => {
    MockAudioElement.instances = [];
    vi.stubGlobal('Audio', MockAudioElement);
};

afterEach(() => {
    vi.unstubAllGlobals();
    MockAudioElement.instances = [];
});

describe('musicGainFromSettings', () => {
    it('multiplies clamped master and music volumes', () => {
        expect(musicGainFromSettings(0.5, 0.25)).toBe(0.125);
        expect(musicGainFromSettings(2, 0.5)).toBe(0.5);
        expect(musicGainFromSettings(-1, 0.5)).toBe(0);
    });
});

describe('REG-038 adaptive music state', () => {
    it('derives pressure/release/suppression from view and run state without owning gameplay', () => {
        expect(getAdaptiveMusicState({ active: true, track: 'menu' })).toMatchObject({
            intensity: 'calm',
            shouldPlay: true,
            track: 'menu'
        });

        expect(getAdaptiveMusicState({ active: true, runStatus: 'playing', track: 'run', gauntletPressure: true })).toMatchObject({
            intensity: 'pressure',
            shouldPlay: true
        });

        expect(getAdaptiveMusicState({ active: true, runStatus: 'levelComplete', track: 'run' })).toMatchObject({
            intensity: 'release',
            shouldPlay: true
        });

        expect(getAdaptiveMusicState({ active: true, runStatus: 'gameOver', track: 'run' })).toMatchObject({
            intensity: 'silent',
            shouldPlay: false
        });
    });

    it('maps app views to menu, run, pressure, release, and silence layers', () => {
        expect(resolveAdaptiveMusicState({ run: null, view: 'menu' })).toMatchObject({
            active: true,
            layer: 'menu_calm',
            track: 'menu',
            volumeMultiplier: 0.82
        });

        expect(
            resolveAdaptiveMusicState({
                run: {
                    activeMutators: [],
                    board: null,
                    gameMode: 'endless',
                    gauntletDeadlineMs: null,
                    status: 'playing'
                } as unknown as RunState,
                view: 'playing'
            })
        ).toMatchObject({ active: true, layer: 'run_focus', track: 'run', volumeMultiplier: 0.74 });

        expect(resolveAdaptiveMusicState({ run: null, view: 'settings' })).toMatchObject({
            active: false,
            layer: 'silent',
            suppressed: true
        });
    });
});

describe('useGameplayMusic', () => {
    type MusicTrack = 'menu' | 'run';

    it('plays the fallback loop when active and unsuppressed', async () => {
        installMockAudio();

        renderHook(() =>
            useGameplayMusic({
                active: true,
                track: 'menu',
                masterVolume: 0.8,
                musicVolume: 0.5
            })
        );

        const audio = MockAudioElement.instances[0];
        expect(audio?.src).toContain('menu-loop.wav');
        expect(audio?.loop).toBe(true);
        expect(audio?.preload).toBe('auto');
        expect(audio?.volume).toBe(0.4);
        await waitFor(() => expect(audio?.play).toHaveBeenCalledTimes(1));
    });

    it('pauses the fallback loop while external music is suppressing it', async () => {
        installMockAudio();

        const { rerender } = renderHook(
            ({ suppressed }) =>
                useGameplayMusic({
                    active: true,
                    track: 'menu',
                    masterVolume: 1,
                    musicVolume: 1,
                    suppressed
                }),
            { initialProps: { suppressed: false } }
        );

        const audio = MockAudioElement.instances[0];
        await waitFor(() => expect(audio?.play).toHaveBeenCalledTimes(1));

        rerender({ suppressed: true });

        expect(audio?.pause).toHaveBeenCalledTimes(1);
    });

    it('recreates the element when switching between menu and run loops', async () => {
        installMockAudio();

        const { rerender } = renderHook(
            ({ track }) =>
                useGameplayMusic({
                    active: true,
                    track,
                    masterVolume: 1,
                    musicVolume: 1
                }),
            { initialProps: { track: 'menu' as MusicTrack } }
        );

        expect(MockAudioElement.instances[0]?.src).toContain('menu-loop.wav');

        rerender({ track: 'run' });

        expect(MockAudioElement.instances[0]?.pause).toHaveBeenCalled();
        expect(MockAudioElement.instances[1]?.src).toMatch(/demo-ambience-loop\.wav|run-loop\.wav/);
        await waitFor(() => expect(MockAudioElement.instances[1]?.play).toHaveBeenCalled());
    });

    it('silences unavailable media after a load error', async () => {
        installMockAudio();

        renderHook(() =>
            useGameplayMusic({
                active: true,
                track: 'menu',
                masterVolume: 1,
                musicVolume: 1
            })
        );

        const audio = MockAudioElement.instances[0];
        await waitFor(() => expect(audio?.play).toHaveBeenCalledTimes(1));

        audio?.dispatch('error');
        document.dispatchEvent(new Event('pointerdown'));

        expect(audio?.pause).toHaveBeenCalled();
        expect(audio?.removeAttribute).toHaveBeenCalledWith('src');
        expect(audio?.load).toHaveBeenCalled();
        expect(audio?.play).toHaveBeenCalledTimes(1);
    });
});
