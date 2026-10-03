import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RealmTravel from './RealmTravel';

describe('arena decisions', () => {
    it('shows depth-dependent danger, both confluence effects, and chooses only the pressed door', () => {
        const choose = vi.fn();
        render(<RealmTravel doors={[{ realmId: 'grove', severity: 'calm' }, { realmId: 'tide', severity: 'raging', confluence: 'ember' }]}
            attunement={{ grove: 6 }} floorsIn={{ grove: 3 }} endedIn="grove" onChoose={choose} reduceMotion />);
        const first = screen.getByTestId('realm-door-0');
        expect(first).toHaveFocus();
        expect(first).toHaveTextContent('Misses trigger hazards');
        expect(first).toHaveTextContent('No timed hazards');
        expect(first).toHaveTextContent('3 floors here this run');
        const second = screen.getByTestId('realm-door-1');
        expect(within(second).getByText('Wet ground · Fire makes steam')).toBeInTheDocument();
        expect(within(second).getByText('Hot ground · Water makes steam')).toBeInTheDocument();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(choose).not.toHaveBeenCalled();
        fireEvent.click(second);
        expect(choose).toHaveBeenCalledExactlyOnceWith(1);
    });
});
