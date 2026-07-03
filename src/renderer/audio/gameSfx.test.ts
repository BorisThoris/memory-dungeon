import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RunState } from '../../shared/contracts';
import sfxManifest from '../assets/audio/sfx/manifest.json';
import {
    AUDIO_INTERACTION_COVERAGE,
    audioCoverageCueIsGameplaySfx,
    audioCoverageCueIsKnown
} from './audioInteractionCoverage';
import {
    __resetGameSfxEngineForTests,
    playChainOpportunityBeatSfx,
    playCountdownPressureSfx,
    playFlipSfx,
    playGambitCommitSfx,
    playFloorClearSfx,
    playMatchPayoffSfx,
    playMatchSfx,
    playMismatchRecoveryCrescendoSfx,
    playRelicChoiceCrescendoSfx,
    playRelicOfferOpenSfx,
    playRelicPickSfx,
    playResolveSfx,
    playShuffleSfx,
    playWagerArmSfx,
    sfxGainFromSettings
} from './gameSfx';
import { preloadSampledSfx } from './sampledSfx';

describe('gameSfx', () => {
    const oscillators: {
        addEventListener: ReturnType<typeof vi.fn>;
        stop: ReturnType<typeof vi.fn>;
        type?: OscillatorType;
    }[] = [];

    afterEach(() => {
        __resetGameSfxEngineForTests();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        oscillators.length = 0;
    });

    it('respects mute instantly (does not schedule nodes)', () => {
        const createOscillator = vi.fn(() => {
            const o = {
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
                addEventListener: vi.fn()
            };
            oscillators.push(o);
            return o;
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        playFlipSfx(sfxGainFromSettings(1, 0));
        expect(createOscillator).not.toHaveBeenCalled();
        playGambitCommitSfx(sfxGainFromSettings(1, 0));
        expect(createOscillator).not.toHaveBeenCalled();
    });

    it('keeps sampled SFX preload safe in test mode', async () => {
        await expect(preloadSampledSfx()).resolves.toBeUndefined();
    });

    it('steals oldest match voice when polyphony is exceeded', () => {
        const stops: string[] = [];
        const createOscillator = vi.fn(() => {
            const id = `osc-${stops.length}`;
            const o = {
                id,
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(() => {
                    stops.push(id);
                }),
                addEventListener: vi.fn()
            };
            oscillators.push(o);
            return o;
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const g = sfxGainFromSettings(1, 1);
        for (let i = 0; i < 5; i += 1) {
            playMatchSfx(g);
        }
        expect(stops.length).toBeGreaterThanOrEqual(1);
    });

    it('adds a sparkle layer for surge-depth match chains only', () => {
        const createOscillator = vi.fn(() => {
            const o = {
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
                addEventListener: vi.fn()
            };
            oscillators.push(o);
            return o;
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const g = sfxGainFromSettings(1, 1);
        playMatchSfx(g, 2);
        expect(createOscillator).toHaveBeenCalledTimes(1);
        playMatchSfx(g, 6);
        expect(createOscillator).toHaveBeenCalledTimes(3);
    });

    it('plays distinct procedural chain opportunity beat cues by board beat tier', () => {
        const createOscillator = vi.fn(() => {
            const o = {
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
                addEventListener: vi.fn()
            };
            oscillators.push(o);
            return o;
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const gain = sfxGainFromSettings(1, 1);
        playChainOpportunityBeatSfx(gain, 'setup', 2);
        playChainOpportunityBeatSfx(gain, 'cashout', 5);

        expect(createOscillator).toHaveBeenCalledTimes(2);
        expect(oscillators[0]?.type).toBe('triangle');
        expect(createOscillator.mock.results[0]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            1192,
            expect.any(Number)
        );
        expect(oscillators[1]?.type).toBe('triangle');
        expect(createOscillator.mock.results[1]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            2660,
            expect.any(Number)
        );
    });

    it('does not schedule chain opportunity beat cues while muted', () => {
        const createOscillator = vi.fn(() => ({
            type: 'sine' as OscillatorType,
            frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            addEventListener: vi.fn()
        }));
        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = vi.fn();
                close = (): Promise<void> => Promise.resolve();
            }
        );

        playChainOpportunityBeatSfx(sfxGainFromSettings(1, 0), 'surge', 4);

        expect(createOscillator).not.toHaveBeenCalled();
    });

    it('plays a distinct payoff cue for stack and super-stack match payloads', () => {
        const createOscillator = vi.fn(() => {
            const o = {
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
                addEventListener: vi.fn()
            };
            oscillators.push(o);
            return o;
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const gain = sfxGainFromSettings(1, 1);
        playMatchPayoffSfx(gain, {
            cascadeCue: { tier: 'combo' },
            payoffSummary: { label: 'Stack cashout', value: '3 payoffs: Route + Pickup + Chain', tier: 'reward' },
            rewardBurst: { label: 'Cash stack', tier: 'stack' }
        });
        playMatchPayoffSfx(gain, {
            impactCue: { label: 'Super stack' },
            payoffSummary: { label: 'Super stack', value: '4 payoffs: Route + Pickup + Trait + Chain', tier: 'combo' },
            rewardBurst: { label: 'Super stack', tier: 'mega' }
        });

        expect(createOscillator).toHaveBeenCalledTimes(2);
        expect(oscillators[0]?.type).toBe('triangle');
        expect(createOscillator.mock.results[0]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            3890,
            expect.any(Number)
        );
        expect(oscillators[1]?.type).toBe('triangle');
        expect(createOscillator.mock.results[1]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            5120,
            expect.any(Number)
        );
    });

    it('keeps ordinary score-only payoff payloads silent', () => {
        const createOscillator = vi.fn(() => ({
            type: 'sine' as OscillatorType,
            frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            addEventListener: vi.fn()
        }));
        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = vi.fn();
                close = (): Promise<void> => Promise.resolve();
            }
        );

        playMatchPayoffSfx(sfxGainFromSettings(1, 1), {
            payoffSummary: { label: 'Score hit', value: '+15', tier: 'score' }
        });

        expect(createOscillator).not.toHaveBeenCalled();
    });

    it('plays distinct procedural mismatch recovery crescendo cues by recovery tier', () => {
        const createOscillator = vi.fn(() => {
            const o = {
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
                addEventListener: vi.fn()
            };
            oscillators.push(o);
            return o;
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const gain = sfxGainFromSettings(1, 1);
        playMismatchRecoveryCrescendoSfx(gain, 'recover', 2);
        playMismatchRecoveryCrescendoSfx(gain, 'trait-surge', 5);

        expect(createOscillator).toHaveBeenCalledTimes(2);
        expect(oscillators[0]?.type).toBe('sine');
        expect(createOscillator.mock.results[0]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            888,
            expect.any(Number)
        );
        expect(oscillators[1]?.type).toBe('square');
        expect(createOscillator.mock.results[1]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            190,
            expect.any(Number)
        );
    });

    it('does not schedule mismatch recovery crescendo cues while muted', () => {
        const createOscillator = vi.fn(() => ({
            type: 'sine' as OscillatorType,
            frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            addEventListener: vi.fn()
        }));
        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = vi.fn();
                close = (): Promise<void> => Promise.resolve();
            }
        );

        playMismatchRecoveryCrescendoSfx(sfxGainFromSettings(1, 0), 'lost-reward', 4);

        expect(createOscillator).not.toHaveBeenCalled();
    });

    it('plays distinct procedural relic choice crescendo cues by draft tier', () => {
        const createOscillator = vi.fn(() => {
            const o = {
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
                addEventListener: vi.fn()
            };
            oscillators.push(o);
            return o;
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const gain = sfxGainFromSettings(1, 1);
        playRelicChoiceCrescendoSfx(gain, 'prime', 2);
        playRelicChoiceCrescendoSfx(gain, 'rare', 5);

        expect(createOscillator).toHaveBeenCalledTimes(2);
        expect(oscillators[0]?.type).toBe('triangle');
        expect(createOscillator.mock.results[0]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            1168,
            expect.any(Number)
        );
        expect(oscillators[1]?.type).toBe('triangle');
        expect(createOscillator.mock.results[1]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            2580,
            expect.any(Number)
        );
    });

    it('does not schedule relic choice crescendo cues while muted', () => {
        const createOscillator = vi.fn(() => ({
            type: 'sine' as OscillatorType,
            frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            addEventListener: vi.fn()
        }));
        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = vi.fn();
                close = (): Promise<void> => Promise.resolve();
            }
        );

        playRelicChoiceCrescendoSfx(sfxGainFromSettings(1, 0), 'stack', 4);

        expect(createOscillator).not.toHaveBeenCalled();
    });

    it('layers a reward sparkle when a resolved match claims an in-board pickup', () => {
        const createOscillator = vi.fn(() => {
            const o = {
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
                addEventListener: vi.fn()
            };
            oscillators.push(o);
            return o;
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const before = {
            stats: { matchesFound: 1, tries: 1, currentStreak: 1 },
            findablesClaimedThisFloor: 0
        } as unknown as RunState;
        const after = {
            stats: { matchesFound: 2, tries: 2, currentStreak: 2 },
            findablesClaimedThisFloor: 1
        } as unknown as RunState;

        playResolveSfx(before, after, sfxGainFromSettings(1, 1));
        expect(createOscillator).toHaveBeenCalledTimes(2);
    });

    it('adds a beat-scaled threshold-only chain milestone ping when a clean streak reaches x3', () => {
        const createOscillator = vi.fn(() => {
            const o = {
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
                addEventListener: vi.fn()
            };
            oscillators.push(o);
            return o;
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const gain = sfxGainFromSettings(1, 1);
        const beforeMilestone = {
            stats: { matchesFound: 2, tries: 2, currentStreak: 2 }
        } as unknown as RunState;
        const afterMilestone = {
            stats: { matchesFound: 3, tries: 3, currentStreak: 3 }
        } as unknown as RunState;

        playResolveSfx(beforeMilestone, afterMilestone, gain);
        expect(createOscillator).toHaveBeenCalledTimes(3);
        expect(oscillators[1]?.type).toBe('sine');
        expect(createOscillator.mock.results[1]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            2048,
            expect.any(Number)
        );
        expect(oscillators[2]?.type).toBe('sine');
        expect(createOscillator.mock.results[2]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            2900,
            expect.any(Number)
        );

        const beforeRepeat = {
            stats: { matchesFound: 3, tries: 3, currentStreak: 3 }
        } as unknown as RunState;
        const afterRepeat = {
            stats: { matchesFound: 4, tries: 4, currentStreak: 4 }
        } as unknown as RunState;

        playResolveSfx(beforeRepeat, afterRepeat, gain);
        expect(createOscillator).toHaveBeenCalledTimes(5);
    });

    it('layers a resource reward chime when a resolved match grants combo resources', () => {
        const createOscillator = vi.fn(() => {
            const o = {
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
                addEventListener: vi.fn()
            };
            oscillators.push(o);
            return o;
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const before = {
            stats: { matchesFound: 1, tries: 1, currentStreak: 1, comboShards: 0, guardTokens: 0 },
            findablesClaimedThisFloor: 0,
            shopGold: 0,
            relicFavorProgress: 0
        } as unknown as RunState;
        const after = {
            stats: { matchesFound: 2, tries: 2, currentStreak: 2, comboShards: 1, guardTokens: 0 },
            findablesClaimedThisFloor: 0,
            shopGold: 0,
            relicFavorProgress: 0
        } as unknown as RunState;

        playResolveSfx(before, after, sfxGainFromSettings(1, 1));
        expect(createOscillator).toHaveBeenCalledTimes(2);
    });

    it('adds a distinct chain reward cashout accent for streak resource payouts', () => {
        const createOscillator = vi.fn(() => {
            const o = {
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
                addEventListener: vi.fn()
            };
            oscillators.push(o);
            return o;
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const before = {
            lives: 4,
            stats: { matchesFound: 2, tries: 2, currentStreak: 3, comboShards: 1, guardTokens: 0 },
            findablesClaimedThisFloor: 0,
            shopGold: 0,
            relicFavorProgress: 0
        } as unknown as RunState;
        const after = {
            lives: 5,
            stats: { matchesFound: 3, tries: 3, currentStreak: 4, comboShards: 2, guardTokens: 1 },
            findablesClaimedThisFloor: 0,
            shopGold: 0,
            relicFavorProgress: 0
        } as unknown as RunState;

        playResolveSfx(before, after, sfxGainFromSettings(1, 1));
        expect(createOscillator).toHaveBeenCalledTimes(4);
        expect(oscillators[2]?.type).toBe('triangle');
        expect(createOscillator.mock.results[2]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            2536,
            expect.any(Number)
        );
        expect(oscillators[3]?.type).toBe('sine');
        expect(createOscillator.mock.results[3]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            2900,
            expect.any(Number)
        );
    });

    it('adds an anticipatory chime when a match arms a one-away chain reward', () => {
        const createOscillator = vi.fn(() => {
            const o = {
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
                addEventListener: vi.fn()
            };
            oscillators.push(o);
            return o;
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const before = {
            lives: 4,
            stats: { matchesFound: 3, tries: 3, currentStreak: 4, comboShards: 0, guardTokens: 0 }
        } as unknown as RunState;
        const after = {
            lives: 4,
            stats: { matchesFound: 4, tries: 4, currentStreak: 5, comboShards: 0, guardTokens: 0 }
        } as unknown as RunState;

        playResolveSfx(before, after, sfxGainFromSettings(1, 1));

        expect(createOscillator).toHaveBeenCalledTimes(3);
        expect(oscillators[1]?.type).toBe('sine');
        expect(createOscillator.mock.results[1]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            1890,
            expect.any(Number)
        );
    });

    it('stacks pickup sparkle and resource chime for bigger reward moments', () => {
        const createOscillator = vi.fn(() => {
            const o = {
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
                addEventListener: vi.fn()
            };
            oscillators.push(o);
            return o;
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const before = {
            stats: { matchesFound: 1, tries: 1, currentStreak: 1, comboShards: 0, guardTokens: 0 },
            findablesClaimedThisFloor: 0,
            shopGold: 0
        } as unknown as RunState;
        const after = {
            stats: { matchesFound: 2, tries: 2, currentStreak: 2, comboShards: 1, guardTokens: 0 },
            findablesClaimedThisFloor: 1,
            shopGold: 2
        } as unknown as RunState;

        playResolveSfx(before, after, sfxGainFromSettings(1, 1));
        expect(createOscillator).toHaveBeenCalledTimes(5);
        expect(createOscillator.mock.results[3]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            3020,
            expect.any(Number)
        );
        expect(oscillators[4]?.type).toBe('sine');
        expect(createOscillator.mock.results[4]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            2580,
            expect.any(Number)
        );
    });

    it('adds a capstone burst when three reward channels resolve together', () => {
        const createOscillator = vi.fn(() => {
            const o = {
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
                addEventListener: vi.fn()
            };
            oscillators.push(o);
            return o;
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const before = {
            stats: { matchesFound: 1, tries: 1, currentStreak: 1, comboShards: 0, guardTokens: 0 },
            findablesClaimedThisFloor: 0,
            shopGold: 0,
            traitRouteObjectiveCompletedThisFloor: false,
            traitRouteObjectiveProgressThisFloor: 0,
            traitRouteObjectiveTriggeredTagsThisFloor: []
        } as unknown as RunState;
        const after = {
            stats: { matchesFound: 2, tries: 2, currentStreak: 2, comboShards: 1, guardTokens: 0 },
            findablesClaimedThisFloor: 1,
            shopGold: 2,
            traitRouteObjectiveCompletedThisFloor: false,
            traitRouteObjectiveProgressThisFloor: 1,
            traitRouteObjectiveTriggeredTagsThisFloor: ['echo:sealed-combo']
        } as unknown as RunState;

        playResolveSfx(before, after, sfxGainFromSettings(1, 1));
        expect(createOscillator).toHaveBeenCalledTimes(6);
        expect(oscillators[4]?.type).toBe('triangle');
        expect(createOscillator.mock.results[4]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            3700,
            expect.any(Number)
        );
        expect(createOscillator.mock.results[5]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            3340,
            expect.any(Number)
        );
    });

    it('adds a top-tier flourish when four reward channels resolve together', () => {
        const createOscillator = vi.fn(() => {
            const o = {
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
                addEventListener: vi.fn()
            };
            oscillators.push(o);
            return o;
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const before = {
            stats: { matchesFound: 2, tries: 2, currentStreak: 2, comboShards: 0, guardTokens: 0 },
            findablesClaimedThisFloor: 0,
            shopGold: 0,
            traitRouteObjectiveCompletedThisFloor: false,
            traitRouteObjectiveProgressThisFloor: 0,
            traitRouteObjectiveTriggeredTagsThisFloor: []
        } as unknown as RunState;
        const after = {
            stats: { matchesFound: 3, tries: 3, currentStreak: 3, comboShards: 1, guardTokens: 0 },
            findablesClaimedThisFloor: 1,
            shopGold: 0,
            traitRouteObjectiveCompletedThisFloor: false,
            traitRouteObjectiveProgressThisFloor: 1,
            traitRouteObjectiveTriggeredTagsThisFloor: ['echo:sealed-combo']
        } as unknown as RunState;

        playResolveSfx(before, after, sfxGainFromSettings(1, 1));

        expect(createOscillator).toHaveBeenCalledTimes(9);
        expect(oscillators[8]?.type).toBe('triangle');
        expect(createOscillator.mock.results[8]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            4420,
            expect.any(Number)
        );
    });

    it('adds a distinct trait-route accent when a match advances a combo route', () => {
        const createOscillator = vi.fn(() => {
            const o = {
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
                addEventListener: vi.fn()
            };
            oscillators.push(o);
            return o;
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const before = {
            stats: { matchesFound: 1, tries: 1, currentStreak: 1, comboShards: 0, guardTokens: 0 },
            traitRouteObjectiveCompletedThisFloor: false,
            traitRouteObjectiveProgressThisFloor: 0,
            traitRouteObjectiveTriggeredTagsThisFloor: []
        } as unknown as RunState;
        const after = {
            stats: { matchesFound: 2, tries: 2, currentStreak: 2, comboShards: 0, guardTokens: 0 },
            traitRouteObjectiveCompletedThisFloor: false,
            traitRouteObjectiveProgressThisFloor: 1,
            traitRouteObjectiveTriggeredTagsThisFloor: ['echo:sealed-combo']
        } as unknown as RunState;

        playResolveSfx(before, after, sfxGainFromSettings(1, 1));

        expect(createOscillator).toHaveBeenCalledTimes(2);
        expect(createOscillator.mock.results[1]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            2040,
            expect.any(Number)
        );
    });

    it('layers a bright reward-perk pop when durable perk tags resolve', () => {
        const createOscillator = vi.fn(() => {
            const o = {
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
                addEventListener: vi.fn()
            };
            oscillators.push(o);
            return o;
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const before = {
            stats: { matchesFound: 1, tries: 1, currentStreak: 1, comboShards: 0, guardTokens: 0 },
            traitRouteObjectiveCompletedThisFloor: false,
            traitRouteObjectiveProgressThisFloor: 0,
            traitRouteObjectiveTriggeredTagsThisFloor: []
        } as unknown as RunState;
        const after = {
            stats: { matchesFound: 2, tries: 2, currentStreak: 2, comboShards: 0, guardTokens: 0 },
            traitRouteObjectiveCompletedThisFloor: false,
            traitRouteObjectiveProgressThisFloor: 1,
            traitRouteObjectiveTriggeredTagsThisFloor: ['reward-perk:trait-streak-flash']
        } as unknown as RunState;

        playResolveSfx(before, after, sfxGainFromSettings(1, 1));

        expect(createOscillator).toHaveBeenCalledTimes(5);
        expect(oscillators[2]?.type).toBe('triangle');
        expect(createOscillator.mock.results[2]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            3560,
            expect.any(Number)
        );
        expect(oscillators[3]?.type).toBe('sine');
        expect(createOscillator.mock.results[3]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            3020,
            expect.any(Number)
        );
        expect(createOscillator.mock.results[4]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            2580,
            expect.any(Number)
        );
    });

    it('counts perk pops as payoff lanes for super-stack cashout audio', () => {
        const createOscillator = vi.fn(() => {
            const o = {
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
                addEventListener: vi.fn()
            };
            oscillators.push(o);
            return o;
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const before = {
            lives: 4,
            stats: { matchesFound: 2, tries: 2, currentStreak: 2, comboShards: 0, guardTokens: 0 },
            findablesClaimedThisFloor: 0,
            shopGold: 0,
            traitRouteObjectiveCompletedThisFloor: false,
            traitRouteObjectiveProgressThisFloor: 0,
            traitRouteObjectiveTriggeredTagsThisFloor: []
        } as unknown as RunState;
        const after = {
            lives: 4,
            stats: { matchesFound: 3, tries: 3, currentStreak: 3, comboShards: 1, guardTokens: 0 },
            findablesClaimedThisFloor: 1,
            shopGold: 0,
            traitRouteObjectiveCompletedThisFloor: false,
            traitRouteObjectiveProgressThisFloor: 1,
            traitRouteObjectiveTriggeredTagsThisFloor: ['reward-perk:trait-streak-flash']
        } as unknown as RunState;

        playResolveSfx(before, after, sfxGainFromSettings(1, 1));

        expect(createOscillator).toHaveBeenCalledTimes(10);
        expect(oscillators[9]?.type).toBe('triangle');
        expect(createOscillator.mock.results[9]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            4560,
            expect.any(Number)
        );
    });

    it('uses a stronger trait-surge accent when several route interactions advance together', () => {
        const createOscillator = vi.fn(() => {
            const o = {
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
                addEventListener: vi.fn()
            };
            oscillators.push(o);
            return o;
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const before = {
            stats: { matchesFound: 1, tries: 1, currentStreak: 1, comboShards: 0, guardTokens: 0 },
            traitRouteObjectiveCompletedThisFloor: false,
            traitRouteObjectiveProgressThisFloor: 0,
            traitRouteObjectiveTriggeredTagsThisFloor: []
        } as unknown as RunState;
        const after = {
            stats: { matchesFound: 2, tries: 2, currentStreak: 2, comboShards: 0, guardTokens: 0 },
            traitRouteObjectiveCompletedThisFloor: false,
            traitRouteObjectiveProgressThisFloor: 2,
            traitRouteObjectiveTriggeredTagsThisFloor: ['echo:sealed-combo', 'sealed:conduit-spark']
        } as unknown as RunState;

        playResolveSfx(before, after, sfxGainFromSettings(1, 1));

        expect(createOscillator).toHaveBeenCalledTimes(4);
        expect(oscillators[1]?.type).toBe('triangle');
        expect(createOscillator.mock.results[1]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            2920,
            expect.any(Number)
        );
        expect(oscillators[2]?.type).toBe('sine');
        expect(createOscillator.mock.results[2]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            3020,
            expect.any(Number)
        );
        expect(oscillators[3]?.type).toBe('sine');
        expect(createOscillator.mock.results[3]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            2580,
            expect.any(Number)
        );
    });

    it('uses a larger trait-route accent when the combo route cashes out', () => {
        const createOscillator = vi.fn(() => {
            const o = {
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
                addEventListener: vi.fn()
            };
            oscillators.push(o);
            return o;
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const before = {
            stats: { matchesFound: 1, tries: 1, currentStreak: 1, comboShards: 0, guardTokens: 0 },
            traitRouteObjectiveCompletedThisFloor: false,
            traitRouteObjectiveProgressThisFloor: 0,
            traitRouteObjectiveTriggeredTagsThisFloor: []
        } as unknown as RunState;
        const after = {
            stats: { matchesFound: 2, tries: 2, currentStreak: 2, comboShards: 1, guardTokens: 0 },
            traitRouteObjectiveCompletedThisFloor: true,
            traitRouteObjectiveProgressThisFloor: 1,
            traitRouteObjectiveTriggeredTagsThisFloor: ['echo:sealed-combo']
        } as unknown as RunState;

        playResolveSfx(before, after, sfxGainFromSettings(1, 1));

        expect(createOscillator).toHaveBeenCalledTimes(5);
        expect(createOscillator.mock.results[2]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            2440,
            expect.any(Number)
        );
        expect(createOscillator.mock.results[3]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            3020,
            expect.any(Number)
        );
        expect(createOscillator.mock.results[4]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            2580,
            expect.any(Number)
        );
    });

    it('layers chain-break and lost-payoff accents when a mismatch drops a near reward streak', () => {
        const createOscillator = vi.fn(() => {
            const o = {
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
                addEventListener: vi.fn()
            };
            oscillators.push(o);
            return o;
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const before = {
            lives: 4,
            stats: { matchesFound: 2, tries: 2, currentStreak: 6, comboShards: 0 }
        } as unknown as RunState;
        const after = {
            stats: { matchesFound: 2, tries: 3, currentStreak: 0 }
        } as unknown as RunState;

        playResolveSfx(before, after, sfxGainFromSettings(1, 1));

        expect(createOscillator).toHaveBeenCalledTimes(3);
        expect(oscillators[1]?.type).toBe('triangle');
        expect(oscillators[2]?.type).toBe('sine');
        expect(createOscillator.mock.results[2]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            360,
            expect.any(Number)
        );
    });

    it('adds a trait-surge risk accent when several trait penalties land on one miss', () => {
        const createOscillator = vi.fn(() => {
            const o = {
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
                addEventListener: vi.fn()
            };
            oscillators.push(o);
            return o;
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const before = {
            stats: {
                matchesFound: 2,
                tries: 2,
                currentStreak: 1,
                tileTraitMismatches: { volatile: 0, mirror: 0 }
            }
        } as unknown as RunState;
        const after = {
            stats: {
                matchesFound: 2,
                tries: 3,
                currentStreak: 0,
                tileTraitMismatches: { volatile: 1, mirror: 1 }
            }
        } as unknown as RunState;

        playResolveSfx(before, after, sfxGainFromSettings(1, 1));

        expect(createOscillator).toHaveBeenCalledTimes(2);
        expect(oscillators[0]?.type).toBe('sawtooth');
        expect(oscillators[1]?.type).toBe('square');
        expect(createOscillator.mock.results[1]?.value.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            180,
            expect.any(Number)
        );
    });

    it('playShuffleSfx respects mute', () => {
        const createOscillator = vi.fn(() => ({
            type: 'sine' as OscillatorType,
            frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            addEventListener: vi.fn()
        }));
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        playShuffleSfx(sfxGainFromSettings(1, 0));
        expect(createOscillator).not.toHaveBeenCalled();
    });

    it('playShuffleSfx full uses layered voices', () => {
        const createOscillator = vi.fn(() => ({
            type: 'sine' as OscillatorType,
            frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            addEventListener: vi.fn()
        }));
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        playShuffleSfx(sfxGainFromSettings(1, 1));
        expect(createOscillator.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('playFloorClearSfx defers oscillators to next macrotask', async () => {
        const createOscillator = vi.fn(() => ({
            type: 'sine' as OscillatorType,
            frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            addEventListener: vi.fn()
        }));
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        playFloorClearSfx(sfxGainFromSettings(1, 1));
        expect(createOscillator).not.toHaveBeenCalled();

        await new Promise<void>((resolve) => {
            globalThis.setTimeout(() => {
                resolve();
            }, 0);
        });

        expect(createOscillator).toHaveBeenCalled();
    });

    it('supports dedicated relic and wager cues', () => {
        const createOscillator = vi.fn(() => ({
            type: 'sine' as OscillatorType,
            frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            addEventListener: vi.fn()
        }));
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const gain = sfxGainFromSettings(1, 1);
        playRelicOfferOpenSfx(gain);
        playRelicPickSfx(gain);
        playWagerArmSfx(gain);

        expect(createOscillator).toHaveBeenCalledTimes(3);
    });

    it('uses one pressure voice for countdown pulses', () => {
        const stops: string[] = [];
        let index = 0;
        const createOscillator = vi.fn(() => {
            const id = `pressure-${index}`;
            index += 1;
            return {
                id,
                type: 'sine' as OscillatorType,
                frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(() => {
                    stops.push(id);
                }),
                addEventListener: vi.fn()
            };
        });
        const createGain = vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn()
        }));

        vi.stubGlobal(
            'AudioContext',
            class {
                currentTime = 0;
                destination = {};
                createOscillator = createOscillator;
                createGain = createGain;
                close = (): Promise<void> => Promise.resolve();
            }
        );

        const gain = sfxGainFromSettings(1, 1);
        playCountdownPressureSfx(gain);
        playCountdownPressureSfx(gain);

        expect(createOscillator).toHaveBeenCalledTimes(2);
        expect(stops.length).toBeGreaterThanOrEqual(1);
    });

    it('keeps sampled gameplay coverage backed by manifest entries and files', () => {
        const manifestKeys = new Set(Object.keys(sfxManifest.entries));
        const sfxAssetDir = path.resolve(process.cwd(), 'src/renderer/assets/audio/sfx');

        for (const row of AUDIO_INTERACTION_COVERAGE) {
            expect(audioCoverageCueIsKnown(row.cue), `${row.id} cue ${row.cue} is not registered`).toBe(true);

            if (row.decision === 'sampled_with_fallback' && audioCoverageCueIsGameplaySfx(row.cue)) {
                expect(manifestKeys.has(row.cue), `${row.id} cue ${row.cue} is missing from SFX manifest`).toBe(true);
            }
        }

        for (const [key, entry] of Object.entries(sfxManifest.entries)) {
            expect(entry.file, `manifest key ${key} should use runtime OGG`).toMatch(/\.ogg$/);
            const assetPath = path.join(sfxAssetDir, entry.file);
            expect(fs.existsSync(assetPath), `manifest key ${key} points to missing file ${entry.file}`).toBe(true);
        }
    });

    it('keeps the countdown pressure cue covered by first-run asset checks', () => {
        const coverageRow = AUDIO_INTERACTION_COVERAGE.find((row) => row.id === 'gauntlet_pressure');
        const manifestEntry = sfxManifest.entries['countdown-pressure'];

        expect(coverageRow?.cue).toBe('countdown-pressure');
        expect(manifestEntry.file).toBe('countdown-pressure.ogg');
        expect(
            fs.existsSync(path.resolve(process.cwd(), 'src/renderer/assets/audio/sfx', manifestEntry.file))
        ).toBe(true);
    });
});
