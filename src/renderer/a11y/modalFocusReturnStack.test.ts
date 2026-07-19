import { afterEach, describe, expect, it } from 'vitest';
import { acquireModalFocusSnapshot } from './modalFocusReturnStack';

afterEach(() => {
    document.body.replaceChildren();
});

describe('modalFocusReturnStack', () => {
    it('restores nested modal openers in order', () => {
        const outerOpener = document.createElement('button');
        const innerOpener = document.createElement('button');
        const modalTarget = document.createElement('button');
        document.body.append(outerOpener, innerOpener, modalTarget);

        outerOpener.focus();
        const releaseOuter = acquireModalFocusSnapshot();
        innerOpener.focus();
        const releaseInner = acquireModalFocusSnapshot();
        modalTarget.focus();

        releaseInner();
        expect(document.activeElement).toBe(innerOpener);

        releaseOuter();
        expect(document.activeElement).toBe(outerOpener);
    });

    it('does not consume another modal snapshot during repeated or out-of-order teardown', () => {
        const outerOpener = document.createElement('button');
        const innerOpener = document.createElement('button');
        const modalTarget = document.createElement('button');
        document.body.append(outerOpener, innerOpener, modalTarget);

        outerOpener.focus();
        const releaseOuter = acquireModalFocusSnapshot();
        innerOpener.focus();
        const releaseInner = acquireModalFocusSnapshot();
        modalTarget.focus();

        releaseOuter();
        releaseOuter();
        expect(document.activeElement).toBe(modalTarget);

        releaseInner();
        expect(document.activeElement).toBe(innerOpener);
    });
});
