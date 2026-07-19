export const runPersistenceInBackground = (operation: () => Promise<unknown> | unknown): void => {
    try {
        void Promise.resolve(operation()).catch(() => undefined);
    } catch {
        // The persistence bridge reports failures before rejecting; background callers have no further recovery work.
    }
};
