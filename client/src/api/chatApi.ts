// TODO: extract getChatMessages, refreshChats, getChatSettings
// TODO: extract addUserToChat, removeUserFromChat, sendMessage

import { Chat, DatabaseResponse, User } from "@anocm/shared/dist";
import { API_V2 } from "../features/constants";
import { UIMessage } from "../features/types";

export interface ApiResult {
    success: boolean,
    tError?: string,
};

export const removeUserFromChat = async(
    chatId: string,
    userId: string,
    adminId: string,
    adminToken: string,
): Promise<ApiResult> => {
    try{
        const res = await fetch(`${API_V2}/chat/remuser`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chatId,
                userId,
                adminId,
                adminToken,
            }),
        });

        const data = (await res.json()) as DatabaseResponse;
        return data.success
            ? { success: true }
            : { success: false, tError: data.error };
    } catch (err) {
        console.error("Fehler beim Entfernen:", err);
        return { success: false, tError: "errorMessages.networkError" };
    }
};

export const addUserToChat = async(
    chatId: string,
    userId: string,
    adminId: string,
    adminToken: string,
): Promise <ApiResult> => {
    try {
        const res = await fetch(`${API_V2}/chat/adduser`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chatId, userId, adminId, adminToken }),
        });
        const data = (await res.json()) as DatabaseResponse;
        return data.success
            ? { success: true }
            : { success: false, tError: data.error };
    } catch (err) {
        console.error("Fehler beim Hinzufügen:", err);
        return { success: false, tError: "errorMessages.networkError" };
    }
};

export interface ChatMessagesResult {
    messages: UIMessage[];
    chat: Chat | null;
};

export const getChatMessages = async(
    chatId: string,
    userId: string,
    token: string,
): Promise<ChatMessagesResult> => {
    try {
        const res = await fetch(
            `${API_V2}/chat/getchat?chatid=${chatId}&userid=${userId}&token=${token}`,
        );
        const data = (await res.json()) as DatabaseResponse & { userData?: Chat };

        if (!data.success || !data.userData) {
            return { messages: [], chat: null };
        }

        const chat = data.userData as Chat;
        
        // ! Chat-Details im State aktualisieren --> [insert location of code]

        // Nachrichten extrahieren
        let messages: UIMessage[] = [];
        if (chat.chatMessages) {
            messages = Object.entries(chat.chatMessages).map(([ts, entry]) => {
                const msg = typeof entry === "string" ? JSON.parse(entry) : entry;
                return {
                    id: msg.id ?? `msg-${ts}`,
                    content: msg.content,
                    senderId: msg.senderID,
                    isOwn: msg.senderID === userId,
                    timestamp: new Date(msg.timestamp),
                } as UIMessage;
            });
        }

        return { messages, chat };
    } catch (err) {
        console.error("Fehler beim Laden der Nachrichten:", err);
        return { messages: [], chat: null };
    }
};

// ! refreshChats implementation but only the fetching part
// Rückgabe: Array der aktuellen ChatIds
export const fetchChatList = async (user: User): Promise<string[]> => {
    try {
        const url = `${API_V2}/chat/getChatList?userId=${encodeURIComponent(
            user.userId,
        )}&token=${encodeURIComponent(user.token)}`;
        
        const res = await fetch(url, {
            method: "GET",
            headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
    
        const data = (await res.json()) as {
            success: boolean;
            userData?: string[] | string;
        };
        if (!data.success) return [];
        const chatIds: string[] =
            typeof data.userData === "string" ? JSON.parse(data.userData) : (data.userData ?? []);
        
        return Array.from(new Set(chatIds));
    } catch (err) {
        console.error("Fehler beim Laden der Chats:", err);
        return [];
    }
};

export interface ChatSettingsResult {
    settings: { minTTL: number; defaultTTL: number; maxTTL: number} | null;
    chat: Chat | null;
}

export const getChatSettings = async (
    chatId: string,
    user: User,
): Promise<ChatSettingsResult> => {
    try {
        const res = await fetch(
            `${API_V2}/chat/getChatSettings?chatid=${chatId}&userid=${user.userId}&token=${user.token}`,
        );

        const data = (await res.json()) as DatabaseResponse;

        if (!data.success || !data.userData) {
            return { settings: null, chat: null};
        }

        const chat = data.userData as Chat;
        return {
            settings: {
                minTTL: chat.chatSettings?.minMessageTTL ?? 3600,
                defaultTTL: chat.chatSettings?.defaultMessageTTL ?? 86400,
                maxTTL: chat.chatSettings?.maxMessageTTL ?? 604800,
            },
            chat,
        };
    } catch (err) {
        console.error("Fehler beim Laden der Chat-Settings:", err);
        return { settings: null, chat: null };
    }
};

export interface CreateChatResult {
    success: boolean;
    chatId?: string;
    tError?: string;
}

// ! createChat implementation extracted from handleCreateChat in AnocmUI.tsx
export const createChat = async (
    currentUser: User,
    newChatUserId: string,
    minTTL: number,
    defaultTTL: number,
    maxTTL: number,
): Promise<CreateChatResult> => {
    try {
        const res = await fetch(`${API_V2}/chat/newchat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userList: [{ userId: currentUser.userId }, { userId: newChatUserId }],
                ttl: defaultTTL,
                minTTL: minTTL,
                maxTTL: maxTTL,
                creatorId: currentUser.userId,
                creatorToken: currentUser.token,
            }),
        });

        const data = (await res.json()) as DatabaseResponse;

        return data.success
            ? { success: true, chatId: data.id as string }
            : { success: false, tError: data.error }; 
    } catch (err) {
        console.error("Netzwerkfehler beim Erstellen des Chats:", err);
        return { success: false, tError: "errorMessages.networkError" };
    }
};

export const sendMessage = async (
    chatId: string,
    content: string,
    senderId: string,
    token: string,
    ttl?: number | null,
): Promise<ApiResult> => {
    try {
        const res = await fetch(`${API_V2}/chat/send_message`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chatID: chatId,
                senderID: senderId,
                senderToken: token,
                content: content,
                timestamp: Date.now().toString(),
                // TTL nur mitsenden wenn nicht null oder undefined
                ...(ttl !== null && ttl !== undefined ? { ttl } : {}),
            }),
        });

        const data = (await res.json()) as DatabaseResponse;
        return data.success
            ? { success: true }
            : { success: false, tError: data.error };
    } catch (err) {
        console.error("Fehler beim Senden:", err);
        return { success: false, tError: "errorMessages.networkError" };
    }
};