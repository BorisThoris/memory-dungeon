import type { TileSuit } from '../../shared/contracts';

/** The suits are the elements (`element-group-rules.ts`): what the player is told each one is. */
export const ELEMENT_NAME: Readonly<Record<TileSuit, string>> = {
    ember: 'Fire',
    tide: 'Water',
    moss: 'Grove',
    bone: 'Frost'
};
