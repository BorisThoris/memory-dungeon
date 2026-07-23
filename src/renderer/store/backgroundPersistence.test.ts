import { describe, expect, it, vi } from 'vitest';
import { runPersistenceInBackground } from './backgroundPersistence';

describe('runPersistenceInBackground', () => {
    it('invokes the persistence operation without changing write timing', () => {
        const operation = vi.fn();

        runPersistenceInBackground(operation);

        expect(operation).toHaveBeenCalledOnce();
    });

    it('captures synchronous throws', () => {
        const operation = vi.fn(() => {
            throw new Error('sync failure');
        });

        expect(() => runPersistenceInBackground(operation)).not.toThrow();
        expect(operation).toHaveBeenCalledOnce();
    });

    it('settles rejected promises', async () => {
        const operation = vi.fn().mockRejectedValue(new Error('async failure'));

        runPersistenceInBackground(operation);

        expect(operation).toHaveBeenCalledOnce();
        await Promise.resolve();
    });
});
