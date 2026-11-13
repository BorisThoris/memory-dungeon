import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_KEY_BINDINGS } from '../../shared/key-bindings';
import KeyBindingsEditor from './KeyBindingsEditor';

describe('Settings › Controls › Keys', () => {
    it('puts an action on the next key pressed', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<KeyBindingsEditor bindings={DEFAULT_KEY_BINDINGS} onChange={onChange} />);
        expect(screen.getByTestId('key-binding-pause')).toHaveTextContent('P');
        await user.click(screen.getByRole('button', { name: 'Change Pause key' }));
        expect(screen.getByTestId('key-binding-pause')).toHaveTextContent('Press a key');
        fireEvent.keyDown(document.body, { code: 'KeyO', key: 'o' });
        expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_KEY_BINDINGS, pause: 'KeyO' });
        expect(screen.getByTestId('key-bindings-note')).toHaveTextContent('Pause is now O.');
    });

    it('says why a key is refused, and Escape keeps the old one', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<KeyBindingsEditor bindings={DEFAULT_KEY_BINDINGS} onChange={onChange} />);
        await user.click(screen.getByRole('button', { name: 'Change Pause key' }));
        fireEvent.keyDown(document.body, { code: 'Digit3', key: '3' });
        expect(screen.getByTestId('key-bindings-note')).toHaveTextContent('3 is already Tool 3');
        fireEvent.keyDown(document.body, { code: 'Enter', key: 'Enter' });
        expect(screen.getByTestId('key-bindings-note')).toHaveTextContent('Enter stays fixed');
        fireEvent.keyDown(document.body, { code: 'Escape', key: 'Escape' });
        expect(screen.getByTestId('key-binding-pause')).toHaveTextContent('P');
        expect(onChange).not.toHaveBeenCalled();
    });

    it('does not let the chosen key reach the game behind the page', async () => {
        const behind = vi.fn();
        document.addEventListener('keydown', behind, true);
        const user = userEvent.setup();
        render(<KeyBindingsEditor bindings={DEFAULT_KEY_BINDINGS} onChange={vi.fn()} />);
        await user.click(screen.getByRole('button', { name: 'Change Shortcuts list key' }));
        behind.mockClear();
        fireEvent.keyDown(document.body, { code: 'KeyP', key: 'p' });
        expect(behind).not.toHaveBeenCalled();
        document.removeEventListener('keydown', behind, true);
    });

    it('resets every key to its default', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<KeyBindingsEditor bindings={{ ...DEFAULT_KEY_BINDINGS, pause: 'KeyO', tool1: 'KeyQ' }} onChange={onChange} />);
        expect(screen.getByTestId('key-binding-tool1')).toHaveTextContent('Q');
        await user.click(screen.getByTestId('key-bindings-reset'));
        expect(onChange).toHaveBeenCalledWith(DEFAULT_KEY_BINDINGS);
    });
});
