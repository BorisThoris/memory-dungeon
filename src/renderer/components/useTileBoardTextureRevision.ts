import { useEffect, useState } from 'react';

import { subscribeCardRankFontLoaded } from '../cardFace/opentypeCardRankFont';
import { subscribeTextureImageUpdates } from './tileTextures';
import { subscribeTileBoardTextureRevisionUpdates } from './tileBoardTextureRevision';

export const useTileBoardTextureRevision = (): number => {
    const [textureRevision, setTextureRevision] = useState(0);

    useEffect(
        () =>
            subscribeTileBoardTextureRevisionUpdates(
                {
                    subscribeCardRankFontLoaded,
                    subscribeTextureImageUpdates
                },
                () => setTextureRevision((current) => current + 1)
            ),
        []
    );

    return textureRevision;
};
