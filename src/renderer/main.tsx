import { activateContentLockFromEnv } from '../shared/content-lock';
import { bootstrapWebRenderer } from './initRendererShell';

// The build flavour decides what the demo ships; it must be set before any screen reads the catalog.
activateContentLockFromEnv(import.meta.env.VITE_BUILD_FLAVOUR);

bootstrapWebRenderer();
