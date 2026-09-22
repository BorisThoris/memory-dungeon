import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PortalScene } from './PortalScene';
import { PORTAL_MOTE_COUNT, portalMotes } from './portalSceneMotes';

describe('PortalScene', () => {
    it('is decoration: the clearing as a base, three lights, a spinning vortex, mist and motes', () => {
        render(<PortalScene quality="high" reduceMotion={false} />);
        const scene = screen.getByTestId('portal-scene');
        expect(scene).toHaveAttribute('aria-hidden', 'true');
        expect(scene).toHaveAttribute('data-alive', 'true');
        const plate = screen.getByTestId('portal-scene-plate');
        // base + stars x2 + moon + runes
        expect([...plate.children].filter((el) => /base|layer/i.test(el.className))).toHaveLength(5);
        const vortex = screen.getByTestId('portal-scene-vortex');
        expect(vortex.querySelectorAll('img')).toHaveLength(2);
        // The disc sits in the arch: the middle of the plate, above the ground.
        expect(parseFloat(vortex.style.left)).toBeGreaterThan(40);
        expect(parseFloat(vortex.style.left) + parseFloat(vortex.style.width)).toBeLessThan(60);
        expect(parseFloat(vortex.style.top)).toBeGreaterThan(30);
        expect(screen.getByTestId('portal-scene-mist')).toBeInTheDocument();
        expect(screen.getByTestId('portal-scene-motes').children).toHaveLength(PORTAL_MOTE_COUNT);
    });

    it('holds still under reduce motion and keeps only the core vortex on low quality', () => {
        const { unmount } = render(<PortalScene quality="high" reduceMotion />);
        expect(screen.getByTestId('portal-scene')).toHaveAttribute('data-still', 'true');
        expect(screen.queryByTestId('portal-scene-mist')).toBeNull();
        unmount();
        render(<PortalScene quality="low" reduceMotion={false} />);
        expect(screen.getByTestId('portal-scene')).toHaveAttribute('data-alive', 'false');
        expect(screen.getByTestId('portal-scene-vortex').querySelectorAll('img')).toHaveLength(1);
        expect(screen.queryByTestId('portal-scene-motes')).toBeNull();
    });

    it('keeps the motes to the sides of the arch, each on its own loop', () => {
        const motes = portalMotes();
        expect(motes).toHaveLength(PORTAL_MOTE_COUNT);
        expect(new Set(motes.map((m) => m.durationMs)).size).toBe(PORTAL_MOTE_COUNT);
        for (const mote of motes) {
            expect(mote.x < 36 || mote.x > 64).toBe(true);
            expect(mote.y).toBeGreaterThanOrEqual(48);
            expect(-mote.delayMs).toBeLessThan(mote.durationMs);
        }
        expect(portalMotes()).toEqual(motes);
    });
});
