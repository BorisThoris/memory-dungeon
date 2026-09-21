import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BOOT_SPLASH_ELEMENT_ID, BOOT_SPLASH_FADE_MS, dismissBootSplash } from './bootSplash';

const mountSplash = (): HTMLElement => {
    const splash = document.createElement('div');
    splash.id = BOOT_SPLASH_ELEMENT_ID;
    document.body.append(splash);
    return splash;
};

describe('boot splash teardown', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('marks the splash dismissed immediately and removes it after the fade', () => {
        const splash = mountSplash();
        const scheduled: Array<{ callback: () => void; delayMs: number }> = [];

        dismissBootSplash({
            scheduleRemoval: (callback, delayMs) => {
                scheduled.push({ callback, delayMs });
            }
        });

        // The fade has to start on this frame; only the DOM removal waits for it to finish.
        expect(splash.dataset.bootSplash).toBe('dismissed');
        expect(splash.isConnected).toBe(true);
        expect(scheduled).toHaveLength(1);
        expect(scheduled[0].delayMs).toBe(BOOT_SPLASH_FADE_MS);

        scheduled[0].callback();
        expect(splash.isConnected).toBe(false);
    });

    it('hides the splash from assistive tech while it fades', () => {
        const splash = mountSplash();

        dismissBootSplash({ scheduleRemoval: () => {} });

        expect(splash.getAttribute('aria-hidden')).toBe('true');
    });

    it('is a no-op when no splash is present', () => {
        const scheduleRemoval = vi.fn();

        expect(() => dismissBootSplash({ scheduleRemoval })).not.toThrow();
        expect(scheduleRemoval).not.toHaveBeenCalled();
    });

    it('ignores a repeat dismissal so a second call cannot restart the fade', () => {
        mountSplash();
        const scheduleRemoval = vi.fn();

        dismissBootSplash({ scheduleRemoval });
        dismissBootSplash({ scheduleRemoval });

        expect(scheduleRemoval).toHaveBeenCalledTimes(1);
    });
});
