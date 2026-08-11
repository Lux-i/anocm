import { useState, useEffect, useCallback } from "react";
import { Chat, User } from "@anocm/shared";
import { useTranslation } from "react-i18next";
import { fetchChatList, createChat as createChatApi, removeUserFromChat } from "../api/chatApi";
import { Encryption } from "../Encryption";

export const useChats = (
    currentUser: User | null,
    selectedChatId: string | null,
    setSelectedChatId: (id: string | null) => void,
    wsActive: boolean,
) => {
    const { t } = useTranslation();
    
    // Data States - Chats
    const [chats, setChats] = useState<Chat[]>([]);
    
    const [decryptedLastMessages, setDecryptedLastMessages] = useState<{[chatId: string]: string}>({});
    const [status, setStatus] = useState<string | null>(null);

    // Modal States - Create Chat
    const [newChatUserId, setNewChatUserId] = useState<string>("");

    // TTL für Chat-Erstellung
    const [selectedMinTTL, setSelectedMinTTL] = useState<number>(0); // Standard: Broadcast minTTL
    const [selectedDefaultTTL, setSelectedDefaultTTL] = useState<number>(3600); // Standard: 1h
    const [selectedMaxTTL, setSelectedMaxTTL] = useState(-1); // Standard: Permanent TTL

    const refreshChats = useCallback(async (): Promise<string[]> => {
        if (!currentUser) return [];

        const chatIds = await fetchChatList(currentUser);
    
        setChats(
            chatIds.map((id) => {
                const old = chats.find((c) => c.chatId === id);
                return {
                    chatId: id,
                    name: old?.name ?? `Chat ${id.slice(0, 8)}...`,
                    chatUserList: old?.chatUserList ?? [],
                    messages: old?.messages ?? [],
                    lastMessage: old?.lastMessage ?? null,
                    unreadCount: old?.unreadCount ?? 0,
                } as Chat;
            }),
        );

        return chatIds;
    }, [currentUser]);

    // Chat-Details im State aktualisieren
    const mergeChatDetails = useCallback((chatId: string, chat: Chat) => {
        setChats((prev) =>
            prev.map((c) => 
                c.chatId == chatId
                    ? {
                        ...c,
                        chatUserList: chat.chatUserList || {},
                        name: chat.name || c.name,
                    }
                    : c,
            ),
        );
    }, []);

    const updateLastMessage = useCallback((chatId: string, content: string, timestamp: Date) => {
        setChats((prev) =>
            prev.map((c) =>
                c.chatId == chatId
                    ? {
                        ...c, lastMessage:  { content, timestamp }
                    }
                    : c,
            ),
        );
    }, []);

    const removeChatLocally = useCallback((chatId: string) => {
        setChats((prev) => prev.filter((c) => c.chatId !== chatId));
    }, []);

    const resetChats = useCallback(() => {
        setChats([]);
    }, []);

    useEffect(() => {
        const decryptLastMessages = async () => {
            const entries = await Promise.all(
                chats.map(async (chat) => {
                    if (chat.lastMessage?.content && chat.chatId) {
                        const chatkey = await Encryption.loadKey(chat.chatId);
                        if (chatkey) {
                            try {
                                const decrypted = await Encryption.decryptMessage(
                                    chatkey,
                                    chat.lastMessage.content,
                                );
                                return [chat.chatId, decrypted];
                            } catch {
                                return [chat.chatId, t("otherMessages.encryptedMessage")];
                            }
                        }
                        return [chat.chatId, t("otherMessages.encryptedMessage")];  
                    }
                    return [chat.chatId, t("chatList.noMessages")];
                }),
            );
            setDecryptedLastMessages(Object.fromEntries(entries));
        };

        decryptLastMessages();
    }, [chats, t]);

    useEffect(() => {
        if (!wsActive || !selectedChatId) return;

        const checkChatStillExists = async () => {
            const ids = await refreshChats();
            if (!ids.includes(selectedChatId)) {
                setStatus(t("otherMessages.endChat"));
                setSelectedChatId(null);
            }
        };

        checkChatStillExists();
        const interval = setInterval(checkChatStillExists, 5000);
        return () => clearInterval(interval);
    }, [wsActive, selectedChatId, refreshChats, t]);

    // Event Handlers
    const handleCreateChat = async (
        onSuccess: (newChatId: string) => Promise<void> | void,
    ) => {
        if (!newChatUserId || !currentUser) return;
        
        const result = await createChatApi(
            currentUser,
            newChatUserId,
            selectedMinTTL,
            selectedDefaultTTL,
            selectedMaxTTL,
        );

        if (!result.success || !result.chatId) {
            console.error("Fehler beim Erstellen des Chats:", result.tError);
            return;
        }

        await Encryption.storeKey(
            result.chatId as string,
            await Encryption.generateChatKey(),
        );

        // lokal in State einfügen
        const newChat: Chat = {
            chatId: result.chatId,
            name: `Chat ${result.chatId.slice(0, 8)}...`,
            chatUserList: {
                [currentUser.userId]: currentUser!.username || "Anonym",
                [newChatUserId]: `User ${newChatUserId.slice(0, 8)}`,
            },
            messages: [],
            lastMessage: null,
            unreadCount: 0,
        };
        setChats((prev) => [newChat, ...prev]);

        setSelectedChatId(result.chatId);
        setNewChatUserId("");

        await refreshChats();
        await onSuccess(result.chatId);
    };

    const handleRemoveUserFromChat = async (userIdToRemove: string) => {
        if (!selectedChatId || !currentUser) return;
        if (!confirm(t("otherMessages.confirmRemoveUser"))) return;
    
        // Backend call
        const { success, tError } = await removeUserFromChat(
            selectedChatId,
            userIdToRemove,
            currentUser.userId,
            currentUser.token,
        );

        if (!success) {
            console.error("Fehler beim Entfernen:", tError);
            return;
        }
        
        // Chats neu laden und neue IDs abfragen
        const newChatIds = await refreshChats();

        // Wenn Chat weg ist, aus dem UI schmeissen
        if (!newChatIds.includes(selectedChatId)) {
            // sofort aus dem local State entfernen
            removeChatLocally(selectedChatId);
            setStatus(t("otherMessages.endChat"));
            setSelectedChatId(null);
        }
    };

    return {
        chats,
        decryptedLastMessages,
        status,
        setStatus,
        newChatUserId,
        setNewChatUserId,
        selectedMinTTL,
        setSelectedMinTTL,
        selectedDefaultTTL,
        setSelectedDefaultTTL,
        selectedMaxTTL,
        setSelectedMaxTTL,
        refreshChats,
        mergeChatDetails,
        updateLastMessage,
        removeChatLocally,
        resetChats,
        handleCreateChat,
        handleRemoveUserFromChat,
    };
};