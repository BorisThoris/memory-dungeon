let openOverlayCount = 0;

export const acquireOverlayModalBodyState = (): (() => void) => {
    openOverlayCount += 1;
    document.body.dataset.overlayModalOpen = 'true';
    let released = false;

    return () => {
        if (released) {
            return;
        }
        released = true;
        openOverlayCount = Math.max(0, openOverlayCount - 1);
        if (openOverlayCount === 0) {
            delete document.body.dataset.overlayModalOpen;
        }
    };
};
