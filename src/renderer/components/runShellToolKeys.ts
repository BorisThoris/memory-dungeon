/** The number keys that use the dock's tools: 1 to 9, left to right (`RunShell.tsx`). */
export const TOOL_KEY_COUNT = 9;

/** The dock slot a key names (0 for "1"), or null for any other key. */
export const toolKeySlot = (key: string): number | null => (/^[1-9]$/.test(key) ? Number(key) - 1 : null);
