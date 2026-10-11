import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalRecordBadge, GlobalRecordResult } from './GlobalRecord';
import { fetchGlobalRecord, submitGlobalRecord } from '../records/globalRecord';

vi.mock('../records/globalRecord', () => ({ fetchGlobalRecord: vi.fn(), submitGlobalRecord: vi.fn() }));
const record = { name: 'Boris', score: 500, at: '2026-10-11T00:00:00Z' };
beforeEach(() => { vi.mocked(fetchGlobalRecord).mockReset();vi.mocked(submitGlobalRecord).mockReset(); });
describe('one global high score', () => {
    it.each([499, 500])('does not prompt for a score of %s against 500', async score => {
        vi.mocked(fetchGlobalRecord).mockResolvedValue({ record });
        render(<GlobalRecordResult score={score} resultKey="lower" />);
        await waitFor(() => expect(fetchGlobalRecord).toHaveBeenCalled());
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    it('prompts for a higher result, rejects disguised profanity, and submits a public name', async () => {
        vi.mocked(fetchGlobalRecord).mockResolvedValue({ record });
        vi.mocked(submitGlobalRecord).mockResolvedValue({ accepted: true, record: { ...record, name: 'Ada', score: 501 } });
        render(<GlobalRecordResult score={501} resultKey="higher" />);
        await screen.findByRole('dialog', { name: 'New global high score' });
        fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 's.h.1.t' } });
        fireEvent.click(screen.getByRole('button', { name: 'Claim global record' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('That name is not going on the board');
        expect(submitGlobalRecord).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Nick Gera' } });
        fireEvent.click(screen.getByRole('button', { name: 'Claim global record' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('That name is not going on the board');
        expect(submitGlobalRecord).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ada' } });
        fireEvent.click(screen.getByRole('button', { name: 'Claim global record' }));
        await screen.findByRole('dialog', { name: 'The global record is yours' });
        expect(submitGlobalRecord).toHaveBeenCalledWith('Ada', 501);
    });
    it('allows the first positive score to establish the record and supports skipping', async () => {
        vi.mocked(fetchGlobalRecord).mockResolvedValue({ record: null });
        render(<GlobalRecordResult score={1} resultKey="first" />);
        await screen.findByRole('dialog');
        fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(submitGlobalRecord).not.toHaveBeenCalled();
    });
    it('handles another player overtaking the pending record without claiming success', async () => {
        vi.mocked(fetchGlobalRecord).mockResolvedValue({ record });
        vi.mocked(submitGlobalRecord).mockResolvedValue({ accepted: false, record: { ...record, score: 999 } });
        render(<GlobalRecordResult score={600} resultKey="race" />);
        await screen.findByRole('dialog');
        fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ada' } });
        fireEvent.click(screen.getByRole('button', { name: 'Claim global record' }));
        await screen.findByRole('dialog', { name: 'A new score just arrived' });
        expect(screen.queryByText('The global record is yours')).not.toBeInTheDocument();
    });
    it('leaves a failed submission open for retry', async () => {
        vi.mocked(fetchGlobalRecord).mockResolvedValue({ record });
        vi.mocked(submitGlobalRecord).mockRejectedValue(new Error('Network unavailable'));
        render(<GlobalRecordResult score={600} resultKey="retry" />);
        await screen.findByRole('dialog');
        fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ada' } });
        fireEvent.click(screen.getByRole('button', { name: 'Claim global record' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable');
        expect(screen.getByRole('button', { name: 'Claim global record' })).toBeEnabled();
    });
    it('does not check or prompt for debug/practice results', () => {
        render(<GlobalRecordResult score={999} resultKey="debug" eligible={false} />);
        expect(fetchGlobalRecord).not.toHaveBeenCalled();
    });
    it('shows the same single global record on the menu', async () => {
        vi.mocked(fetchGlobalRecord).mockResolvedValue({ record });
        render(<GlobalRecordBadge />);
        await waitFor(() => expect(screen.getByLabelText('Global high score')).toHaveTextContent('Dungeon Master · Boris · 500'));
    });
});
