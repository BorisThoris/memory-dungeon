/**
 * How much bigger an element is painted than it is laid out.
 *
 * The app applies the UI scale as `zoom` on the shell (`App.module.css` `.content`). Everything
 * inside that box still LAYS OUT at the unzoomed size — a `118px` bar is 118 layout px at every
 * scale — and is then painted that much larger. `getBoundingClientRect()` reports the painted box;
 * `clientWidth`/`clientHeight`, and every CSS length the same subtree resolves, are the laid-out
 * one. The two are the same number only at scale 1, which is the scale every automated check in
 * this repository used to pin, so code that measured in one and wrote back in the other read as
 * correct forever.
 *
 * This returns the ratio between them so a measurement taken from a rect can be handed back to CSS
 * in the units CSS will read it in. Measured on the element itself rather than from the stored
 * setting, because what matters is the zoom in force where the value will be used, and an ancestor
 * may have its own.
 */
export const readCssZoom = (element: Pick<Element, 'clientWidth' | 'getBoundingClientRect'>): number => {
    const layoutWidth = element.clientWidth;
    if (layoutWidth <= 0) {
        return 1;
    }
    const zoom = element.getBoundingClientRect().width / layoutWidth;
    // A collapsed or display:none element measures 0/0; a scale of 0 would divide a clearance away.
    return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
};
