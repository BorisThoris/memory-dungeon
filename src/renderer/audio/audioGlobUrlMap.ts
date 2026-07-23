export const filenameFromAudioGlobPath = (path: string): string => path.replace(/^.*\//, '');

export const buildAudioUrlMapByFilename = (globUrls: Readonly<Record<string, string>>): Map<string, string> =>
    new Map(Object.entries(globUrls).map(([path, url]) => [filenameFromAudioGlobPath(path), url]));
