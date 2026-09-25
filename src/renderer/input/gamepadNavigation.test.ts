import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyGamepadAction, listNavigableElements } from './gamepadNavigation';

/** happy-dom lays nothing out, so each control is told where it sits. */
const place = (element: HTMLElement, left: number, top: number, width = 100, height = 40): void => {
    element.getBoundingClientRect = () =>
        ({
            bottom: top + height,
            height,
            left,
            right: left + width,
            toJSON: () => ({}),
            top,
            width,
            x: left,
            y: top
        }) as DOMRect;
};

const button = (label: string, left: number, top: number): HTMLButtonElement => {
    const element = document.createElement('button');
    element.textContent = label;
    place(element, left, top);
    document.body.append(element);
    return element;
};

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('listNavigableElements', () => {
    it('drops controls that lay out to nothing', () => {
        const real = button('real', 0, 0);
        const collapsed = button('collapsed', 0, 0);
        place(collapsed, 0, 0, 0, 0);
        expect(listNavigableElements(document)).toEqual([real]);
    });
});

describe('applyGamepadAction', () => {
    it('walks a roving toolbar with its own arrow keys, whose other tools are tabIndex -1', () => {
        // The in-run dock: one tab stop, the rest reachable only by the toolbar's arrows.
        const toolbar = document.createElement('div');
        toolbar.setAttribute('role', 'toolbar');
        document.body.append(toolbar);
        const tools = ['pin', 'bomb', 'pause'].map((label, index) => {
            const tool = button(label, index * 120, 600);
            tool.tabIndex = index === 0 ? 0 : -1;
            toolbar.append(tool);
            return tool;
        });
        toolbar.addEventListener('keydown', (event) => {
            const at = tools.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === 'ArrowRight' ? at + 1 : event.key === 'ArrowLeft' ? at - 1 : -1;
            if (next >= 0 && next < tools.length && next !== at) {
                event.preventDefault();
                tools[next]?.focus();
            }
        });
        tools[0]?.focus();
        expect(applyGamepadAction('right')).toBe(true);
        expect(document.activeElement).toBe(tools[1]);
        // At the end the toolbar does not consume it, and the spatial walk has its turn.
        tools[2]?.focus();
        applyGamepadAction('right');
        expect(document.activeElement).toBe(tools[2]);
    });

    it('moves the focus ring in the pushed direction', () => {
        const left = button('left', 0, 0);
        const right = button('right', 200, 0);
        left.focus();
        expect(applyGamepadAction('right')).toBe(true);
        expect(document.activeElement).toBe(right);
    });

    it('reports that nothing happened when the ring is already at the edge', () => {
        const only = button('only', 0, 0);
        only.focus();
        expect(applyGamepadAction('right')).toBe(false);
        expect(document.activeElement).toBe(only);
    });

    it('takes the ring somewhere when nothing is focused yet', () => {
        const first = button('first', 0, 0);
        button('second', 0, 100);
        document.body.focus();
        expect(applyGamepadAction('down')).toBe(true);
        expect(document.activeElement).toBe(first);
    });

    it('activates the focused control on confirm', () => {
        const target = button('play', 0, 0);
        const clicked = vi.fn();
        target.addEventListener('click', clicked);
        target.focus();
        expect(applyGamepadAction('confirm')).toBe(true);
        expect(clicked).toHaveBeenCalledTimes(1);
    });

    it('sends the keys the screens already listen for', () => {
        const target = button('anything', 0, 0);
        target.focus();
        const seen: string[] = [];
        document.addEventListener('keydown', (event) => seen.push(event.key), true);
        applyGamepadAction('back');
        applyGamepadAction('pause');
        applyGamepadAction('help');
        expect(seen).toEqual(['Escape', 'p', 'F1']);
    });

    it('steps through every control in order on the bumpers, wrapping at the ends', () => {
        const first = button('first', 0, 0);
        const second = button('second', 0, 100);
        first.focus();
        applyGamepadAction('tabNext');
        expect(document.activeElement).toBe(second);
        applyGamepadAction('tabNext');
        expect(document.activeElement).toBe(first);
        applyGamepadAction('tabPrev');
        expect(document.activeElement).toBe(second);
    });

    describe('inside the board', () => {
        const board = (): HTMLElement => {
            const region = document.createElement('div');
            region.setAttribute('role', 'application');
            region.tabIndex = 0;
            place(region, 0, 0, 400, 400);
            document.body.append(region);
            return region;
        };

        it('lets the board handle a direction it consumes', () => {
            const region = board();
            const outside = button('hud', 600, 0);
            region.addEventListener('keydown', (event) => event.preventDefault());
            region.focus();
            expect(applyGamepadAction('right')).toBe(true);
            expect(document.activeElement).toBe(region);
            expect(outside).not.toBe(document.activeElement);
        });

        it('walks out of the board when it leaves the direction unhandled', () => {
            const region = board();
            const outside = button('hud', 600, 0);
            region.focus();
            expect(applyGamepadAction('right')).toBe(true);
            expect(document.activeElement).toBe(outside);
        });

        it('flips a tile with Enter rather than clicking the region', () => {
            const region = board();
            const keys: string[] = [];
            region.addEventListener('keydown', (event) => {
                keys.push(event.key);
                event.preventDefault();
            });
            region.focus();
            expect(applyGamepadAction('confirm')).toBe(true);
            expect(keys).toEqual(['Enter']);
        });
    });
});
