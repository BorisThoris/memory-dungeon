import { act, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { focusWasLostWith, pickFocusSuccessor, useFocusLossRecovery } from './focusLossRecovery';

const buttons = (spec: string): HTMLButtonElement[] =>
    [...spec].map((c, i) => {
        const b = document.createElement('button');
        b.textContent = String(i);
        b.disabled = c === 'x';
        return b;
    });

describe('pickFocusSuccessor', () => {
    it('takes the next enabled control at or after the lost one, else the nearest before it', () => {
        const list = buttons('oxxo');
        expect(pickFocusSuccessor(list, 1)).toBe(list[3]);
        expect(pickFocusSuccessor(buttons('oox'), 2)?.textContent).toBe('1');
        expect(pickFocusSuccessor(buttons('xxx'), 1)).toBeNull();
        // A removed control's place is taken by the one that followed it.
        expect(pickFocusSuccessor(buttons('oo'), 5)?.textContent).toBe('1');
    });
});

describe('focusWasLostWith', () => {
    it('is true only for a dead control that took focus with it', () => {
        const [live] = buttons('o');
        document.body.append(live!);
        live!.focus();
        expect(focusWasLostWith(live!)).toBe(false);
        live!.disabled = true;
        expect(focusWasLostWith(live!)).toBe(true);
        live!.remove();
        expect(focusWasLostWith(live!)).toBe(true);
        expect(focusWasLostWith(null)).toBe(false);
    });

    it('leaves a player who moved focus elsewhere alone', () => {
        const [a, b] = buttons('oo');
        document.body.append(a!, b!);
        a!.focus();
        b!.focus();
        a!.disabled = true;
        expect(focusWasLostWith(a!)).toBe(false);
        a!.remove();
        b!.remove();
    });
});

const Harness = ({ withFallback = false }: { withFallback?: boolean }) => {
    const ref = useRef<HTMLDivElement | null>(null);
    const [dead, setDead] = useState<string[]>([]);
    useFocusLossRecovery(ref, {
        selector: 'button',
        fallback: withFallback ? () => document.getElementById('fallback') : undefined
    });
    return (
        <>
            <div ref={ref}>
                {['a', 'b', 'c'].map((id) => (
                    <button disabled={dead.includes(id)} key={id} onClick={() => setDead((d) => [...d, id])} type="button">
                        {id}
                    </button>
                ))}
            </div>
            <button id="fallback" type="button">
                fallback
            </button>
        </>
    );
};

describe('useFocusLossRecovery', () => {
    it('moves focus on to the next live control when the focused one goes disabled', () => {
        render(<Harness />);
        const b = screen.getByRole('button', { name: 'b' });
        b.focus();
        act(() => b.click());
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'c' }));
    });

    it('goes to the fallback when nothing in the group is left', () => {
        render(<Harness withFallback />);
        for (const name of ['a', 'b', 'c']) {
            const button = screen.getByRole('button', { name });
            button.focus();
            act(() => button.click());
        }
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'fallback' }));
    });
});
