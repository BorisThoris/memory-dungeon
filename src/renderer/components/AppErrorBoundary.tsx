import { Component, type ErrorInfo, type ReactNode } from 'react';
import { APP_ERROR_COPY } from '../copy/appErrorBoundary';
import styles from './AppErrorBoundary.module.css';

interface AppErrorBoundaryProps {
    readonly children: ReactNode;
    /** Where a caught error is written down. Absent in the browser build, which has no main process. */
    readonly report?: (report: { componentStack: string | null; message: string; stack: string | null }) => void;
    /** How the fallback's action puts the player back somewhere usable. */
    readonly reload?: () => void;
}

interface AppErrorBoundaryState {
    readonly failed: boolean;
}

/**
 * The last thing between a thrown render and a blank window.
 *
 * Only the WebGL scene had a boundary, so an error anywhere else — a HUD panel, the shop, a relic
 * draft — unmounted the entire tree. The process survives that, which is what makes it so bad:
 * `renderer_gone` never fires, the crash reporter writes nothing, and the player is left looking at
 * an empty window with no way to tell whether their save is gone.
 *
 * So this reports as well as recovers. A screen that fails silently is a support ticket nobody can
 * answer.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
    state: AppErrorBoundaryState = { failed: false };

    static getDerivedStateFromError(): AppErrorBoundaryState {
        return { failed: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        try {
            this.props.report?.({
                componentStack: info.componentStack ?? null,
                message: error.message,
                stack: error.stack ?? null
            });
        } catch {
            // Reporting is best-effort. Failing to write the report must not replace the fallback
            // with a second, worse crash.
        }
    }

    render(): ReactNode {
        if (!this.state.failed) {
            return this.props.children;
        }
        return (
            <div className={styles.shell} role="alert">
                <div className={styles.panel}>
                    <h1 className={styles.title}>{APP_ERROR_COPY.title}</h1>
                    <p className={styles.detail}>{APP_ERROR_COPY.detail}</p>
                    {this.props.report ? <p className={styles.detail}>{APP_ERROR_COPY.reported}</p> : null}
                    <button
                        type="button"
                        className={styles.action}
                        onClick={() => {
                            this.props.reload?.();
                        }}
                    >
                        {APP_ERROR_COPY.action}
                    </button>
                </div>
            </div>
        );
    }
}
