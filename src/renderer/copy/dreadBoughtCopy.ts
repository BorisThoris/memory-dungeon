import type { RunState } from '../../shared/contracts';

const count = (n: number, one: string, many: string): string => `${n === 1 ? 'one more' : n === 2 ? 'two more' : `${n} more`} ${n === 1 ? one : many}`;

/** The Dread spends (`dread-composition-rules.ts`): what it bought on this floor, told before the first flip. */
export const DREAD_BOUGHT_COPY = {
    kicker: 'The Dread',
    line: (bought: NonNullable<RunState['dreadBought']>): string => {
        const parts = [
            bought.sleeper > 0 ? count(bought.sleeper, 'Sleeper pair', 'Sleeper pairs') : null,
            bought.mask > 0 ? count(bought.mask, 'mask', 'masks') : null,
            bought.wanderer > 0 ? count(bought.wanderer, 'Wanderer pair', 'Wanderer pairs') : null
        ].filter((part): part is string => part !== null);
        const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0] ?? '';
        return `It bought ${list} on this floor.`;
    }
} as const;
