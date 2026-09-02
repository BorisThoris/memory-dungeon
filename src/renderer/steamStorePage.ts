/**
 * The demo's one outbound link. Set `VITE_STEAM_STORE_URL` to the full game's store page when
 * packaging the demo; without it the run-end screen shows the ledger but no wishlist link.
 */
export const getSteamStorePageUrl = (): string | null => {
    const raw = import.meta.env.VITE_STEAM_STORE_URL?.trim();
    return raw && raw.startsWith('https://store.steampowered.com/') ? raw : null;
};
