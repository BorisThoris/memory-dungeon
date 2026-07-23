export type RendererLoadSource = 'development' | 'bundled' | 'failed';

interface RendererLoadOperations {
    developmentUrl: string | null;
    loadDevelopmentUrl: (url: string) => Promise<unknown>;
    loadBundledFile: () => Promise<unknown>;
    reportError: (source: Exclude<RendererLoadSource, 'failed'>, error: unknown) => void;
}

export const loadRendererEntry = async ({
    developmentUrl,
    loadDevelopmentUrl,
    loadBundledFile,
    reportError
}: RendererLoadOperations): Promise<RendererLoadSource> => {
    if (developmentUrl) {
        try {
            await loadDevelopmentUrl(developmentUrl);
            return 'development';
        } catch (error) {
            reportError('development', error);
        }
    }
    try {
        await loadBundledFile();
        return 'bundled';
    } catch (error) {
        reportError('bundled', error);
        return 'failed';
    }
};

