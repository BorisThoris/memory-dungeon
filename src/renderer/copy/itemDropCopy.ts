/** The item drop's words (`ItemDropPopup.tsx`): the balloon shows the name and line; this is what is heard. */
export const ITEM_DROP_COPY = {
    /** What a screen reader hears: the rarity, the item and what it gives. */
    announce: (rarity: string, name: string, line: string): string => `${rarity} item: ${name}. ${line}`
} as const;
