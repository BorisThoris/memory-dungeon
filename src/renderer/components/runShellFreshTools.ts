/**
 * A tool that just came into the hand glows (2026-10-18).
 *
 * A Curio's item, a meteor shard's meteor, a bomb from camp: each arrives with a drop balloon that
 * is gone in two seconds, and then the item is one more glyph in a row of ten. The owner asked for
 * the items' feedback to be enhanced; the first thing a player needs is to see where the new thing
 * went. So a dock tool whose count rises pulses gold for a moment (`RunShell.module.css`), and on a
 * phone the Items button that folds it does too.
 */

/** How long a tool reads as just received. */
export const TOOL_FRESH_MS = 2400;

/**
 * The tools whose charges rose since `previous`, and the counts to remember. The first look is a
 * baseline, not a gain: a run opening with a bomb in hand is not news.
 */
export const risenToolCharges = (
    previous: ReadonlyMap<string, number> | null,
    tools: readonly { id: string; charges?: number }[]
): { counts: Map<string, number>; risen: string[] } => {
    const counts = new Map<string, number>();
    const risen: string[] = [];
    for (const tool of tools) {
        if (tool.charges === undefined) continue;
        counts.set(tool.id, tool.charges);
        if (previous && tool.charges > (previous.get(tool.id) ?? 0)) risen.push(tool.id);
    }
    return { counts, risen };
};
