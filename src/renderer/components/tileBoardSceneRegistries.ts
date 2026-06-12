import { createContext } from 'react';
import type { Mesh } from 'three';
import type { TileBezelFrameBag } from './tileBoardFrameBag';
import type { TileBoardItemRegistry } from './tileBoardRegistry';

export const TileBezelFrameRegistryContext = createContext<TileBoardItemRegistry<TileBezelFrameBag> | null>(null);
export const TilePickMeshRegistryContext = createContext<TileBoardItemRegistry<Mesh> | null>(null);
