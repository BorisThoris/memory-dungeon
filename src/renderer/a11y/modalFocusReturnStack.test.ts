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
        const outer = acquireModalFocusSnapshot();
        expect(outer.isTop()).toBe(true);
        innerOpener.focus();
        const inner = acquireModalFocusSnapshot();
        expect(outer.isTop()).toBe(false);
        expect(inner.isTop()).toBe(true);
        modalTarget.focus();

        inner.release();
        expect(document.activeElement).toBe(innerOpener);
        expect(outer.isTop()).toBe(true);
        expect(inner.isTop()).toBe(false);

        outer.release();
        expect(document.activeElement).toBe(outerOpener);
        expect(outer.isTop()).toBe(false);
    });

    it('does not consume another modal snapshot during repeated or out-of-order teardown', () => {
        const outerOpener = document.createElement('button');
        const innerOpener = document.createElement('button');
        const modalTarget = document.createElement('button');
        document.body.append(outerOpener, innerOpener, modalTarget);

        outerOpener.focus();
        const outer = acquireModalFocusSnapshot();
        innerOpener.focus();
        const inner = acquireModalFocusSnapshot();
        modalTarget.focus();

        outer.release();
        outer.release();
        expect(document.activeElement).toBe(modalTarget);
        expect(outer.isTop()).toBe(false);
        expect(inner.isTop()).toBe(true);

        inner.release();
        expect(document.activeElement).toBe(innerOpener);
        expect(inner.isTop()).toBe(false);
    });
});
