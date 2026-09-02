/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** `demo` selects the demo content lock; anything else is the full game. */
    readonly VITE_BUILD_FLAVOUR?: string;
    /** Full game store page; enables the demo's run-end wishlist link. */
    readonly VITE_STEAM_STORE_URL?: string;
}
