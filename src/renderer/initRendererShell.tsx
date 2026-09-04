import { NotificationHost } from '@cross-repo-libs/notifications';
import '@cross-repo-libs/notifications/styles.css';
import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import App from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { desktopClient } from './desktop-client';
import { registerRendererErrorHooks } from './diagnostics/rendererErrorHooks';
import { PlatformTiltProvider } from './platformTilt/PlatformTiltProvider';
import { forEachRendererThemeCssVar } from './styles/theme';
import './styles/global.css';
import './styles/notificationsGame.css';

/** Theme tokens on `:root` — shared by web bootstrap and any native shell that reuses the DOM theme bridge. */
const applyRendererThemeToDocument = (): void => {
    const html = document.documentElement;
    forEachRendererThemeCssVar((key, value) => html.style.setProperty(key, value));
};

const mountRendererApp = (rootElement: HTMLElement): Root => {
    const root = createRoot(rootElement);
    root.render(
        <StrictMode>
            {/*
             * Outside everything, including the tilt provider and the notification host: a throw in
             * any of them used to unmount the whole tree and leave an empty window behind.
             */}
            <AppErrorBoundary
                report={(report) => {
                    void desktopClient.reportRendererError(report);
                }}
                reload={() => {
                    window.location.reload();
                }}
            >
            <PlatformTiltProvider>
                <NotificationHost
                    labels={{
                        closeAriaLabel: 'Dismiss tip',
                        regionAriaLabel: 'Memory Dungeon tips'
                    }}
                >
                    <App />
                </NotificationHost>
            </PlatformTiltProvider>
            </AppErrorBoundary>
        </StrictMode>
    );
    return root;
};

export const getRendererRootElement = (documentRef: Document = document): HTMLElement => {
    const rootElement = documentRef.getElementById('root');
    if (rootElement == null) {
        throw new Error('Missing #root element for renderer bootstrap.');
    }
    return rootElement;
};

/** Web entry: theme CSS variables + React root (single place for shell side effects). */
export const bootstrapWebRenderer = (): void => {
    const rootElement = getRendererRootElement();
    applyRendererThemeToDocument();
    // Before mounting: an error thrown during the first render is still an error worth recording.
    registerRendererErrorHooks({
        report: (kind, report) => {
            void desktopClient.reportRendererError(report, kind);
        },
        target: window
    });
    mountRendererApp(rootElement);
};
