import type { DungeonKeyKind } from './contracts';

export const dungeonKeyKindLabel = (keyKind: DungeonKeyKind): string =>
    keyKind === 'iron' ? 'iron key' : `${keyKind} key`;

export const dungeonKeyKindArticleLabel = (keyKind: DungeonKeyKind): string =>
    `${keyKind === 'iron' ? 'an' : 'a'} ${dungeonKeyKindLabel(keyKind)}`;
