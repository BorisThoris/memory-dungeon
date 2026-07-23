import type { DisplayMode } from '../shared/contracts';

interface StartupSettingsReader {
    getSettings: () => { displayMode: DisplayMode };
}

export const resolveStartupDisplayMode = (
    reader: StartupSettingsReader,
    reportError: (error: unknown) => void = (error) => console.error('[startup] settings read failed', error)
): DisplayMode => {
    try {
        return reader.getSettings().displayMode;
    } catch (error) {
        reportError(error);
        return 'windowed';
    }
};

