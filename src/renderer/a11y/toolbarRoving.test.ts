import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    acquireToolbarRovingPause,
    handleHorizontalToolbarKeyDown,
    handleVerticalToolbarKeyDown,
    syncVerticalToolbarTabIndices
} from './toolbarRoving';

const pauseReleases: Array<() => void> = [];

const pauseToolbarRoving = (): (() => void) => {
    const release = acquireToolbarRovingPause();
    pauseReleases.push(release);
    return release;
};

type ToolbarKeyHandler = typeof handleVerticalToolbarKeyDown;

const pressToolbarKey = (handler: ToolbarKeyHandler, root: HTMLElement, key: string) => {
    const preventDefault = vi.fn();
    handler({ currentTarget: root, key, preventDefault } as unknown as Parameters<ToolbarKeyHandler>[0]);
    return preventDefault;
};

afterEach(() => {
    pauseReleases.splice(0).reverse().forEach((release) => release());
    document.body.replaceChildren();
});

describe('toolbarRoving (REF-061)', () => {
    it.each([
        {
            backwardKey: 'ArrowUp',
            forwardKey: 'ArrowDown',
            handler: handleVerticalToolbarKeyDown,
            orientation: 'vertical'
        },
        {
            backwardKey: 'ArrowLeft',
            forwardKey: 'ArrowRight',
            handler: handleHorizontalToolbarKeyDown,
            orientation: 'horizontal'
        }
    ])('keeps $orientation keyboard navigation and roving focus in sync', ({ backwardKey, forwardKey, handler }) => {
        document.body.innerHTML = `
            <div role="toolbar" data-testid="tb">
                <button type="button">a</button>
                <button type="button">b</button>
                <button type="button">c</button>
            </div>
        `;
        const toolbar = document.querySelector<HTMLElement>('[data-testid="tb"]')!;
        const buttons = Array.from(toolbar.querySelectorAll('button'));
        syncVerticalToolbarTabIndices(toolbar);
        buttons[0]!.focus();

        expect(pressToolbarKey(handler, toolbar, forwardKey)).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(buttons[1]);
        expect(buttons.map((button) => button.tabIndex)).toEqual([-1, 0, -1]);

        expect(pressToolbarKey(handler, toolbar, 'End')).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(buttons[2]);
        expect(buttons.map((button) => button.tabIndex)).toEqual([-1, -1, 0]);

        expect(pressToolbarKey(handler, toolbar, forwardKey)).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(buttons[2]);

        expect(pressToolbarKey(handler, toolbar, 'Home')).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(buttons[0]);
        expect(buttons.map((button) => button.tabIndex)).toEqual([0, -1, -1]);

        expect(pressToolbarKey(handler, toolbar, backwardKey)).not.toHaveBeenCalled();
        expect(pressToolbarKey(handler, toolbar, 'Enter')).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(buttons[0]);

        buttons[0]!.blur();
        expect(pressToolbarKey(handler, toolbar, forwardKey)).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(buttons[0]);

        buttons[0]!.blur();
        expect(pressToolbarKey(handler, toolbar, backwardKey)).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(buttons[2]);
    });

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
