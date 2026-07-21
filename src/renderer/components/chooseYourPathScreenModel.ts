import { getMutatorCatalogRows } from '../../shared/game-catalog';

export const buildMeditationPickMutatorRows = () =>
    [...getMutatorCatalogRows()].sort((a, b) => a.title.localeCompare(b.title));
