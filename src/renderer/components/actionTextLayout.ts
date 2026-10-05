export interface ActionTextLayout { titleLines: string[]; subtitleLines: string[]; titleSize: number; subtitleSize: number; lineHeight: number }
type Measure = (text: string, size: number, bold: boolean) => number;
const wrap = (text: string, size: number, width: number, bold: boolean, measure: Measure): string[] => {
    const lines: string[] = [];
    for (const word of text.trim().split(/\s+/)) {
        const last = lines.at(-1);
        if (last && measure(`${last} ${word}`, size, bold) <= width) lines[lines.length - 1] = `${last} ${word}`;
        else lines.push(word);
    }
    return lines;
};
/** Measure actual glyph widths, keeping words intact and reserving room for the impact envelope. */
export function layoutActionText(title: string, subtitle: string, width: number, height: number, major: boolean, measure: Measure): ActionTextLayout {
    const available = Math.max(32, width * 0.82);
    let titleSize = Math.min(major ? 90 : 54, width * (major ? 0.15 : 0.095), height * 0.23);
    titleSize = Math.max(18, titleSize);
    let titleLines = wrap(title, titleSize, available, true, measure);
    while (titleSize > 14 && (titleLines.length > 2 || titleLines.some(line => measure(line, titleSize, true) > available))) {
        titleSize -= 1; titleLines = wrap(title, titleSize, available, true, measure);
    }
    const subtitleSize = Math.max(12, Math.min(17, width * 0.035));
    return { titleLines, subtitleLines: wrap(subtitle, subtitleSize, available, false, measure), titleSize, subtitleSize, lineHeight: titleSize * 1.1 };
}
