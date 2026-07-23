export const FATAL_STARTUP_TITLE = 'Memory Dungeon could not start';
export const FATAL_STARTUP_MESSAGE = 'A desktop service failed to initialize. Restart the app or reinstall it, then try again.';

interface FatalStartupOperations {
    quit: () => void;
    reportError: (error: unknown) => void;
    showError: (title: string, message: string) => void;
}

export const handleFatalStartupFailure = (error: unknown, operations: FatalStartupOperations): void => {
    try {
        operations.reportError(error);
    } catch {
        // Continue to native notice and shutdown even if diagnostics are unavailable.
    }
    try {
        operations.showError(FATAL_STARTUP_TITLE, FATAL_STARTUP_MESSAGE);
    } catch {
        // Shutdown remains required if the native dialog cannot be shown.
    }
    try {
        operations.quit();
    } catch {
        // The fatal boundary must not create another uncaught startup error.
    }
};

export const runMainProcessAction = (action: () => void, onFailure: (error: unknown) => void): boolean => {
    try {
        action();
        return true;
    } catch (error) {
        onFailure(error);
        return false;
    }
};
