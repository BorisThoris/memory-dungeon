export interface DisposableLike {
    dispose(): void;
}

export const disposeTileBoardResource = (resource: DisposableLike | null | undefined): void => {
    resource?.dispose();
};

export const disposeTileBoardResources = (
    resources: ReadonlyArray<DisposableLike | null | undefined>
): void => {
    for (const resource of resources) {
        disposeTileBoardResource(resource);
    }
};
