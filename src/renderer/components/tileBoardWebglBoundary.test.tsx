import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TileBoardErrorBoundary } from './tileBoardWebglBoundary';
import { canUseWebGL, type TileBoardWebglProbeDocument } from './tileBoardWebglSupport';

const probeDocument = (contexts: Record<string, unknown>): TileBoardWebglProbeDocument => ({
    createElement: () => ({
        getContext: (contextId) => contexts[contextId] ?? null
    })
});

const ThrowingChild = (): never => {
    throw new Error('scene failed');
};

describe('tileBoardWebglBoundary', () => {
    it('reports false without a document or when context creation throws', () => {
        expect(canUseWebGL(null)).toBe(false);
        expect(canUseWebGL({
            createElement: () => {
                throw new Error('blocked');
            }
        })).toBe(false);
    });

    it('accepts webgl2, webgl, or experimental-webgl contexts', () => {
        expect(canUseWebGL(probeDocument({ webgl2: {} }))).toBe(true);
        expect(canUseWebGL(probeDocument({ webgl: {} }))).toBe(true);
        expect(canUseWebGL(probeDocument({ 'experimental-webgl': {} }))).toBe(true);
        expect(canUseWebGL(probeDocument({}))).toBe(false);
    });

    it('renders fallback content when the scene throws', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        try {
            render(
                <TileBoardErrorBoundary fallback={<div>HTML board fallback</div>}>
                    <ThrowingChild />
                </TileBoardErrorBoundary>
            );
        } finally {
            consoleError.mockRestore();
        }

        expect(screen.getByText('HTML board fallback')).toBeInTheDocument();
    });
});
