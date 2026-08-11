import { useState, useEffect } from "react";
import { Chat, User } from "@anocm/shared";
import { useTranslation } from "react-i18next";
import { UIMessage } from "../features/types";
import { getChatMessages, getChatSettings, sendMessage as sendMessageApi } from "../api/chatApi";
import { Encryption } from "../Encryption";
import { checkIfTTLIsValid } from "../utils/ttlUtils";

interface ChatSettings {
    minTTL: number;
    defaultTTL: number;
    maxTTL: number;
};

interface KeyExchangeControls {
    isRequestingKey: boolean;
    isSendingKey: boolean;
    startKeyRequest: (chatId: string) => Promise<void>;
};

export const useChatMessages = (
    currentUser: User | null,
    selectedChatId: string | null,
    keyExchange: KeyExchangeControls,
    mergeChatDetails: (chatId: string, chat: Chat) => void,
) => {
    const { t } = useTranslation();

    // Data  States - Messages
    const [messages, setMessages] = useState<UIMessage[]>([]);
    
    // Modal State
    const [chatSettings, setChatSettings] = useState<ChatSettings | null>(null);
    
    // UI State
    const [messageInput, setMessageInput] = useState("");
    
    // TTL für einzelne Nachrichten
    const [messageTTL, setMessageTTL] = useState<number | null>(null);

    const loadMessages = async (chatId: string, user: User) => {
        const { messages: chatMessages, chat } = await getChatMessages(
            chatId,
            user.userId,
            user.token,
        );

        if (chat) {
            mergeChatDetails(chatId, chat);
        }

        chatMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        
        const chatkey = await Encryption.loadKey(chatId);

        if (!chatkey) {
            setMessages(chatMessages);
            if (!keyExchange.isRequestingKey && !keyExchange.isSendingKey) {
                await keyExchange.startKeyRequest(chatId);
            }
            return;
        }
        
        const decrypted = await Promise.all(
            chatMessages.map(async (message) => ({
                ...message,
                content: await Encryption.decryptMessage(chatkey, message.content),
            })),
        );
        setMessages(decrypted);
    };

    useEffect(() => {
        if (!selectedChatId || !currentUser) {
            setMessages([]);
            return;
        }
        loadMessages(selectedChatId, currentUser);
    }, [selectedChatId, currentUser, keyExchange.isRequestingKey]);

    useEffect(() => {
        const loadSettings = async () => {
            if (!selectedChatId || !currentUser) {
                setChatSettings(null);
                return;
            }

            const { settings, chat } = await getChatSettings(selectedChatId, currentUser,);
            setChatSettings(settings);
        
            if (chat) {
                mergeChatDetails(selectedChatId, chat);
            }
        };
        loadSettings();
    }, [selectedChatId, currentUser]);

    const reloadMessages = async () => {
        if (selectedChatId && currentUser) {
            await loadMessages(selectedChatId, currentUser);
        }
    };

    const handleSendMessage = async () => {
        if (!messageInput.trim() || !selectedChatId || !currentUser) {
            return;
        }

        const chatkey = await Encryption.loadKey(selectedChatId);
        if (!chatkey) {
            alert(t("otherMessages.unifinishedKeyExchange"));
            return;
        }

        // Aktuelle TTL-Auswahl für diesen Chat holen
        const selectedTTL = messageTTL == undefined ? null : messageTTL;

        if (selectedTTL !== null && chatSettings) {
            if (!checkIfTTLIsValid(selectedTTL, chatSettings.minTTL, chatSettings.maxTTL)) {
                console.error(`TTL ${selectedTTL} außerhalb erluabter Grenzen: ${chatSettings.minTTL} - ${chatSettings.maxTTL}`);
                return;
            }
        }

        const encryptedContent = await Encryption.encryptMessage(chatkey, messageInput);

        const result = await sendMessageApi(
            selectedChatId,
            encryptedContent,
            currentUser.userId,
            currentUser.token,
            selectedTTL,
        );

        if (result.success) {
            setMessageInput("");
            console.log(`[SEND]Nachricht gesendet mit ${selectedTTL != null ? `TTL: ${selectedTTL} Sekunden` : "Standard-TTL (Chat-Default)"}`);
        } else {
            console.error("Fehler beim Senden:", result.tError);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const resetMessages = () => {
        setMessages([]);
        setMessageInput("");
        setMessageTTL(null);
    }

    return {
        messages,
        setMessages,
        chatSettings,
        messageInput,
        setMessageInput,
        messageTTL,
        setMessageTTL,
        reloadMessages,
        resetMessages,
        handleSendMessage,
        handleKeyPress,
    };
};