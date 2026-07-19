import { afterEach, describe, expect, it } from 'vitest';
import { acquireToolbarRovingPause, syncVerticalToolbarTabIndices } from './toolbarRoving';

const pauseReleases: Array<() => void> = [];

const pauseToolbarRoving = (): (() => void) => {
    const release = acquireToolbarRovingPause();
    pauseReleases.push(release);
    return release;
};

afterEach(() => {
    pauseReleases.splice(0).reverse().forEach((release) => release());
    document.body.replaceChildren();
});

describe('toolbarRoving (REF-061)', () => {
    it('removes toolbar buttons from the tab order until the pause is released', () => {
        document.body.innerHTML = `
            <div role="toolbar" data-testid="tb">
                <button type="button">a</button>
                <button type="button">b</button>
            </div>
        `;
        const toolbar = document.querySelector<HTMLElement>('[data-testid="tb"]')!;
        const buttons = toolbar.querySelectorAll('button');
        syncVerticalToolbarTabIndices(toolbar);
        expect(buttons[0]!.tabIndex).toBe(0);
        expect(buttons[1]!.tabIndex).toBe(-1);

        const release = pauseToolbarRoving();
        expect(buttons[0]!.tabIndex).toBe(-1);
        expect(buttons[1]!.tabIndex).toBe(-1);

        release();
        expect(buttons[0]!.tabIndex).toBe(0);
        expect(buttons[1]!.tabIndex).toBe(-1);
    });

    it('preserves the active roving control across a modal pause', () => {
        document.body.innerHTML = `
            <div role="toolbar" data-testid="tb">
                <button type="button">a</button>
                <button type="button">b</button>
            </div>
        `;
        const toolbar = document.querySelector<HTMLElement>('[data-testid="tb"]')!;
        const buttons = toolbar.querySelectorAll('button');
        syncVerticalToolbarTabIndices(toolbar, buttons[1]);

        const release = pauseToolbarRoving();
        syncVerticalToolbarTabIndices(toolbar);
        release();

        expect(buttons[0]!.tabIndex).toBe(-1);
        expect(buttons[1]!.tabIndex).toBe(0);
    });

    it('keeps resynced and dynamically mounted controls paused until resume', () => {
        const release = pauseToolbarRoving();
        document.body.innerHTML = `
            <div role="toolbar" data-testid="tb">
                <button type="button">a</button>
                <button type="button">b</button>
            </div>
        `;
        const toolbar = document.querySelector<HTMLElement>('[data-testid="tb"]')!;
        const buttons = toolbar.querySelectorAll('button');

        syncVerticalToolbarTabIndices(toolbar, buttons[1]);

        expect(buttons[0]!.tabIndex).toBe(-1);
        expect(buttons[1]!.tabIndex).toBe(-1);

        release();
        expect(buttons[0]!.tabIndex).toBe(-1);
        expect(buttons[1]!.tabIndex).toBe(0);
    });

    it('does not resume nested pauses when a release is repeated', () => {
        document.body.innerHTML = `
            <div role="toolbar" data-testid="tb">
                <button type="button">a</button>
                <button type="button">b</button>
            </div>
        `;
        const toolbar = document.querySelector<HTMLElement>('[data-testid="tb"]')!;
        const buttons = toolbar.querySelectorAll('button');
        syncVerticalToolbarTabIndices(toolbar);
        const releaseOuter = pauseToolbarRoving();
        const releaseInner = pauseToolbarRoving();

        releaseOuter();
        releaseOuter();
        expect(buttons[0]!.tabIndex).toBe(-1);
        expect(buttons[1]!.tabIndex).toBe(-1);

        releaseInner();
        expect(buttons[0]!.tabIndex).toBe(0);
        expect(buttons[1]!.tabIndex).toBe(-1);
    });
});
