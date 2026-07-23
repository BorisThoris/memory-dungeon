import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RENDERER_THEME } from './styles/theme';

const createRootMock = vi.hoisted(() => vi.fn());
const renderMock = vi.hoisted(() => vi.fn());

vi.mock('react-dom/client', () => ({
    createRoot: createRootMock
}));

vi.mock('@cross-repo-libs/notifications', () => ({
    NotificationHost: ({ children }: { children: ReactNode }) => <div data-testid="notification-host">{children}</div>
}));

vi.mock('./platformTilt/PlatformTiltProvider', () => ({
    PlatformTiltProvider: ({ children }: { children: ReactNode }) => <div data-testid="tilt-provider">{children}</div>
}));

vi.mock('./App', () => ({
    default: () => <div data-testid="app" />
}));

describe('initRendererShell', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        document.documentElement.removeAttribute('style');
        renderMock.mockReset();
        createRootMock.mockReset();
        createRootMock.mockReturnValue({ render: renderMock });
    });

    it('resolves the renderer root explicitly', async () => {
        const { getRendererRootElement } = await import('./initRendererShell');
        const root = document.createElement('div');
        root.id = 'root';
        document.body.append(root);

        expect(getRendererRootElement()).toBe(root);
    });

    it('throws a clear bootstrap error when #root is missing', async () => {
        const { bootstrapWebRenderer } = await import('./initRendererShell');

        expect(() => bootstrapWebRenderer()).toThrow('Missing #root element for renderer bootstrap.');
        expect(createRootMock).not.toHaveBeenCalled();
    });

    it('applies renderer theme vars before mounting the app', async () => {
        const { bootstrapWebRenderer } = await import('./initRendererShell');
        const root = document.createElement('div');
        root.id = 'root';
        document.body.append(root);

        bootstrapWebRenderer();

        expect(document.documentElement.style.getPropertyValue('--theme-void')).toBe(RENDERER_THEME.cssVars['--theme-void']);
        expect(createRootMock).toHaveBeenCalledWith(root);
        expect(renderMock).toHaveBeenCalledTimes(1);
    });
});
