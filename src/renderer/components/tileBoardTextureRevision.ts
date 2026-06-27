interface TileBoardTextureRevisionSubscriptions {
    subscribeCardRankFontLoaded: (listener: () => void) => () => void;
    subscribeTextureImageUpdates: (listener: () => void) => () => void;
}

export const subscribeTileBoardTextureRevisionUpdates = (
    subscriptions: TileBoardTextureRevisionSubscriptions,
    onRevisionInvalidated: () => void
): (() => void) => {
    const unsubscribeTextureImages = subscriptions.subscribeTextureImageUpdates(onRevisionInvalidated);
    const unsubscribeCardRankFont = subscriptions.subscribeCardRankFontLoaded(onRevisionInvalidated);

    return () => {
        unsubscribeCardRankFont();
        unsubscribeTextureImages();
    };
};
