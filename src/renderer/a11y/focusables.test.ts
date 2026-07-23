import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFocusableElements, handleTabFocusTrapEvent } from './focusables';

describe('focusables', () => {
    afterEach(() => {
        document.body.replaceChildren();
    });

    it('excludes every explicit negative tabindex from modal focus order', () => {
        const container = document.createElement('section');
        container.innerHTML = `
            <button type="button" tabindex="-2">Sentinel</button>
            <button type="button">First command</button>
            <div tabindex="-10">Programmatic anchor</div>
            <a href="#details">Details</a>
        `;
        document.body.append(container);

        expect(getFocusableElements(container).map((element) => element.textContent)).toEqual([
            'First command',
            'Details'
        ]);
    });

    it('moves outside Tab focus to the first sequentially focusable modal control', () => {
        const outside = document.createElement('button');
        outside.type = 'button';
        outside.textContent = 'Outside';
        const container = document.createElement('section');
        container.tabIndex = -1;
        container.innerHTML = `
            <button type="button" tabindex="-2">Sentinel</button>
            <button type="button">First command</button>
        `;
        document.body.append(outside, container);
        outside.focus();
        const event = {
            key: 'Tab',
            preventDefault: vi.fn(),
            shiftKey: false
        };

        handleTabFocusTrapEvent(event, container);

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(document.activeElement?.textContent).toBe('First command');
    });
});
