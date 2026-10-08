/** The item drop's words (`ItemDropPopup.tsx`). */
export const ITEM_DROP_COPY = {
    kicker: 'Item get',
    skipHint: 'Tap to continue',
    /** What a screen reader hears: the rarity, the item and what it gives. */
    announce: (rarity: string, name: string, line: string): string => `${rarity} item: ${name}. ${line}`
} as const;
