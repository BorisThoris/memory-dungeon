/**
 * Where the shape of a card-face gradient lives.
 *
 * `escapeXml` used to sit here too. The programmatic face carries no text nodes any more — the
 * rank and symbol glyphs went when the face became a framed illustration — so there was nothing
 * left to escape, and an escaper nobody calls is a liability rather than a safety net.
 */
export const svgLinearGradientDef = (
    id: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    userSpace: boolean,
    stops: readonly { offset: string; color: string }[]
): string => {
    const gu = userSpace ? 'userSpaceOnUse' : 'objectBoundingBox';
    const body = stops.map((s) => `      <stop offset="${s.offset}" stop-color="${s.color}"/>`).join('\n');
    return `<linearGradient id="${id}" gradientUnits="${gu}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
${body}
    </linearGradient>`;
};
