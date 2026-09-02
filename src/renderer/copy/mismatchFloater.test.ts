import { describe, expect, it } from 'vitest';
import {
    mismatchFloaterLiveRegionText,
    mismatchFloaterNextAction,
    mismatchFloaterRecoveryHint,
    mismatchFloaterSignal
} from './mismatchFloater';

describe('mismatchFloaterLiveRegionText', () => {
    it('states the miss and the one recovery line, matching the visible floater', () => {
        expect(mismatchFloaterLiveRegionText('Miss', 'Recover - safe match')).toBe(
            'Miss. No match. Recover - safe match'
        );
        expect(mismatchFloaterLiveRegionText('Break')).toBe('Break. No match');
        expect(mismatchFloaterLiveRegionText('', 'Recover - peek or route away.')).toBe(
            'No match. Recover - peek or route away'
        );
    });
});

describe('mismatchFloaterSignal', () => {
    it('reads Miss, Risk on a trait penalty, and Break on a deep broken chain', () => {
        expect(mismatchFloaterSignal()).toEqual({ label: 'Miss', tone: 'miss' });
        expect(mismatchFloaterSignal(['Volatile + Sealed: risk'])).toEqual({ label: 'Risk', tone: 'penalty' });
        expect(mismatchFloaterSignal([], { brokenChainDepth: 4 })).toEqual({ label: 'Break', tone: 'break' });
        expect(mismatchFloaterSignal([], { brokenChainDepth: 2 })).toEqual({ label: 'Miss', tone: 'miss' });
    });

    it('normalizes a malformed broken-chain depth', () => {
        expect(mismatchFloaterSignal([], { brokenChainDepth: Number.NaN })).toEqual({ label: 'Miss', tone: 'miss' });
    });
});

describe('mismatchFloaterRecoveryHint', () => {
    it('names a recovery that fits what actually went wrong', () => {
        expect(mismatchFloaterRecoveryHint()).toBe('Recover - safe match');
        expect(mismatchFloaterRecoveryHint(['Echo buffered the hit'])).toBe('Buffered - open a safe match');
        expect(mismatchFloaterRecoveryHint(['Warden blocked the pair'])).toBe('Next - choose another opener');
        expect(mismatchFloaterRecoveryHint(['Cursed tile flared'])).toBe('Recover - peek or route away');
        expect(mismatchFloaterRecoveryHint(['Sealed pair held'])).toBe('Recover - peek before Sealed');
        expect(mismatchFloaterRecoveryHint(['Something else entirely'])).toBe('Recover - prime with tools');
    });
});

describe('mismatchFloaterNextAction', () => {
    it('points at the lost reward first, then the broken chain, then the route', () => {
        expect(
            mismatchFloaterNextAction([], {
                brokenChainDepth: 4,
                brokenChainRewardCue: { distanceLabel: '2 matches', label: 'x6 +1 shard' }
            })
        ).toMatchObject({ tone: 'lost-reward', value: 'Rebuild toward x6 +1 shard' });
        expect(mismatchFloaterNextAction([], { brokenChainDepth: 3 })).toMatchObject({ tone: 'risk' });
        expect(mismatchFloaterNextAction(['Cursed tile flared'])).toMatchObject({
            tone: 'risk',
            value: 'peek or route away'
        });
        expect(mismatchFloaterNextAction()).toMatchObject({ tone: 'recover', value: 'Safe match' });
    });
});
