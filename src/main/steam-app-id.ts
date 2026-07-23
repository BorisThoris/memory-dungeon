const MAX_STEAM_APP_ID = 0xffff_ffff;

export const parseSteamAppId = (rawValue: string | undefined): number | undefined => {
    const value = rawValue?.trim();
    if (!value || !/^\d+$/.test(value)) {
        return undefined;
    }
    const appId = Number(value);
    return Number.isSafeInteger(appId) && appId > 0 && appId <= MAX_STEAM_APP_ID ? appId : undefined;
};

