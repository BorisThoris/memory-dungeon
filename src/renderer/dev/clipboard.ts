interface ClipboardWriter {
    writeText: (text: string) => Promise<void>;
}

const getNavigatorClipboard = (): ClipboardWriter | null => {
    if (typeof navigator === 'undefined') {
        return null;
    }

    return typeof navigator.clipboard?.writeText === 'function' ? navigator.clipboard : null;
};

const formatClipboardError = (error: unknown): string =>
    error instanceof Error && error.message.trim() ? error.message : 'Clipboard write failed';

export const copyDevTextToClipboard = async (
    text: string,
    clipboard: ClipboardWriter | null = getNavigatorClipboard()
): Promise<string> => {
    if (!clipboard) {
        return 'Clipboard unavailable';
    }

    try {
        await clipboard.writeText(text);
        return `Copied ${text}`;
    } catch (error) {
        return formatClipboardError(error);
    }
};
