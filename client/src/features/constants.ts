import { TFunction } from "i18next";

// CHANGE TO IMPORT
export enum Action {
    None = "",
    BroadcastToChat = "BroadcastToChat",
    Init = "Init",
    MessageResponse = "MessageResponse",
    DH_PUBLIC_EX = "dhpublic", // Diffie-Hellman public key exchange
    CK_EX = "chatkey", // Chat key exchange
    CK_REQ = "chatkeyreq", // Chat key request
}

/* export const API_BASE =
    import.meta.env.VITE_API_BASE_URL || "https://anocm.tomatenbot.com";
*/

// export const API_V1 = `${API_BASE}/api/v1`;
export const API_V2 = `/api/v2`;
export const WS_URL = import.meta.env.VITE_WSS_URL || "wss://anocm.tomatenbot.com/ws";

export const getDropdownTtlPresets = (t: TFunction) => [
    { value: 0, text: t("ttlPresets.broadcast") },
    { value: 300, text: t("ttlPresets.fiveMin") },
    { value: 1800, text: t("ttlPresets.halfHour") },
    { value: 3600, text: t("ttlPresets.oneHour") },
    { value: 86400, text: t("ttlPresets.oneDay") },
    { value: 604800, text: t("ttlPresets.oneWeek") },
    { value: 2592000, text: t("ttlPresets.oneMonth") },
    { value: -1, text: t("ttlPresets.broadcast") },
];