import { tr } from '../../shared/i18n';
import type { RunState } from '../../shared/contracts';

const count = (n: number, one: string, many: string): string => `${n === 1 ? tr.s('one more') : n === 2 ? tr.s('two more') : tr`${n} more`} ${n === 1 ? one : many}`;

/** The Dread spends (`dread-composition-rules.ts`): what it bought on this floor, told before the first flip. */
export const DREAD_BOUGHT_COPY = {
    kicker: tr.s('The Dread'),
    line: (bought: NonNullable<RunState['dreadBought']>): string => {
        const parts = [
            bought.sleeper > 0 ? count(bought.sleeper, tr.s('Sleeper pair'), tr.s('Sleeper pairs')) : null,
            bought.mask > 0 ? count(bought.mask, 'mask', 'masks') : null,
            bought.wanderer > 0 ? count(bought.wanderer, tr.s('Wanderer pair'), tr.s('Wanderer pairs')) : null
        ].filter((part): part is string => part !== null);
        const list = parts.length > 1 ? tr`${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0] ?? '';
        return tr`It bought ${list} on this floor.`;
    }
} as const;
