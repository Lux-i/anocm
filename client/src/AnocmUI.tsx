// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  MessageCircle,
  Users,
  Menu,
  Edit,
  Send,
  Settings,
  Plus,
  LogOut,
  UserPlus,
  ArrowLeft,
  Clock,
  X,
  RefreshCcw,
  Moon,
  Sun,
  ChevronDown,
  ChevronUp,
  Languages,
} from "lucide-react";
import { DatabaseResponse, User, Chat, ChatMessage } from "@anocm/shared/dist";
import { WsMessage } from "@anocm/shared/dist";
import { Encryption } from "./Encryption";
import { UUID } from "crypto";
import { useTranslation } from "react-i18next";
import { t } from "i18next";
import { resourceLimits } from "worker_threads";

//CHANGE TO IMPORT
enum Action {
  None = "",
  BroadcastToChat = "BroadcastToChat",
  Init = "Init",
  MessageResponse = "MessageResponse",
  DH_PUBLIC_EX = "dhpublic", //Diffie-Hellman public key exchange
  CK_EX = "chatkey", //Chat key exchange
  CK_REQ = "chatkeyreq", //Chat key request
}

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://anocm.tomatenbot.com";

const API_V1 = `${API_BASE}/api/v1`;
const API_V2 = `${API_BASE}/api/v2`;
const WS_URL = import.meta.env.VITE_WSS_URL || "wss://anocm.tomatenbot.com/ws";

type UIMessage = ChatMessage & {
  id: string;
  timestamp: Date;
  isOwn: boolean;
};

const getDropdownTtlPresets = (t: Function) => [
  { value: 0, text: t("ttlPresets.broadcast") },
  { value: 300, text: t("ttlPresets.fiveMin") },
  { value: 1800, text: t("ttlPresets.halfHour") },
  { value: 3600, text: t("ttlPresets.oneHour") },
  { value: 86400, text: t("ttlPresets.oneDay") },
  { value: 604800, text: t("ttlPresets.oneWeek") },
  { value: 2592000, text: t("ttlPresets.oneMonth") },
  { value: -1, text: t("ttlPresets.broadcast") },
];

const AnocmUI = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const [wsActive, setWsActive] = useState(false);

  // KEY EXCHANGE
  const [isRequestingKey, setIsRequestingKey] = useState(false);
  const [isSendingKey, setIsSendingKey] = useState(false);
  const [activeKeyExchange, setActiveKeyExchange] = useState("");
  const [DHKeyPair, setDHKeyPair] = useState<CryptoKeyPair | null>(null);
  const [sharedKey, setSharedKey] = useState<CryptoKey | null>(null);

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState(true);

  // UI States
  const [activeSection, setActiveSection] = useState<"chats" | "users">(
    "chats"
  );
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [decryptedLastMessages, setDecryptedLastMessages] = useState<{
    [chatId: string]: string;
  }>({});

  // Modal States
  const [showCreateChat, setShowCreateChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLanguages, setShowLanguages] = useState(false);
  const [newChatUserId, setNewChatUserId] = useState("");
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [chatSettings, setChatSettings] = useState<{
    minTTL: number;
    defaultTTL: number;
    maxTTL: number;
  } | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [chatMessageTTLs, setChatMessageTTLs] = useState<{
    [chatId: string]: number | null;
  }>({});

  // Data States
  const [chats, setChats] = useState<Chat[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<UIMessage[]>([]);

  // TTL für Chat-Erstellung
  const [selectedMinTTL, setSelectedMinTTL] = useState(0); // Standard: Broadcast minTTL
  const [selectedDefaultTTL, setSelectedDefaultTTL] = useState(3600); // Standard: 1h
  const [selectedMaxTTL, setSelectedMaxTTL] = useState(-1); // Standard: Permanent TTL

  // TTL für einzelne Nachrichten
  const [messageTTL, setMessageTTL] = useState<number | null>(null); // null = defaultTTL verwenden

  // i18n relevant variables and functions
  const lngs = {
    en: { nativeName: "English" },
    de: { nativeName: "Deutsch" },
    fr: { nativeName: "Français" },
  };
  const { t, i18n } = useTranslation();

  //DROPDOWN TTL PRESETS
  const DROPDOWN_TTL_PRESETS = getDropdownTtlPresets(t);

  // Helper Functions
  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return t("common.now");
    if (diffMins < 60) return t("timeUnits.minute", { count: diffMins }); //`${diffMins}m`;
    if (diffMins < 1440)
      return t("timeUnits.hour", { count: Math.floor(diffMins / 60) });
    return t("timeUnits.day", { count: Math.floor(diffMins / 1440) });
  };

  const getInitials = (name: string): string => {
    if (!name || name.length === 0) {
      return "??";
    }

    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string, isAnonymous: boolean) => {
    if (isAnonymous) {
      return "bg-purple-500";
    }

    // Fallback
    if (!name || name.length === 0) {
      return "bg-gray-500";
    }

    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-orange-500",
      "bg-red-500",
      "bg-purple-500",
      "bg-teal-500",
      "bg-pink-500",
      "bg-indigo-500",
    ];

    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const formatTTL = (seconds: number): string => {
    if (seconds < 0) return t("ttlPresets.permanent");
    if (seconds === 0) return t("ttlPresets.broadcast");
    if (seconds < 60) return t("timeUnits.second", { count: seconds });
    if (seconds < 3600)
      return t("timeUnits.minute", { count: Math.floor(seconds / 60) });
    if (seconds < 86400)
      return t("timeUnits.hour", { count: Math.floor(seconds / 3600) });
    return t("timeUnits.day", { count: Math.floor(seconds / 86400) });
  };

  const cleanTTL = (val) => {
    console.log(`val: ${val}`);

    const n = Number(val);
    return n;
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
    document.documentElement.classList.toggle("dark", isDarkMode);
    console.log("Dark Mode: ", isDarkMode);
  };

  const toggleDropdown = (menuId: string): void => {
    const dropDownMenu = document.getElementById(menuId);
    if (!dropDownMenu) {
      console.error(`Dropdown menu with ID "${menuId}" not found.`);
      return;
    }
    dropDownMenu.classList.toggle("hidden");
  };

  //API Functions
  const removeUserFromChat = async (
    chatId: string,
    userId: string,
    adminId: string,
    adminToken: string
  ) => {
    try {
      const res = await fetch(`${API_V2}/chat/remuser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, userId, adminId, adminToken }),
      });
      const data = (await res.json()) as DatabaseResponse;
      return data.success
        ? { success: true }
        : { success: false, error: data.error };
    } catch (err) {
      console.error("Fehler beim Entfernen:", err);
      return { success: false, error: t("errorMessages.networkError") };
    }
  };

  const addUserToChat = async (
    chatId: string,
    userId: string,
    adminId: string,
    adminToken: string
  ) => {
    try {
      const res = await fetch(`${API_V2}/chat/adduser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, userId, adminId, adminToken }),
      });
      const data = (await res.json()) as DatabaseResponse;
      return data.success
        ? { success: true }
        : { success: false, error: data.error };
    } catch (err) {
      console.error("Fehler beim Hinzufügen:", err);
      return { success: false, error: t("errorMessages.networkError") };
    }
  };

  const getChatMessages = async (
    chatId: string,
    userId: string,
    token: string
  ): Promise<UIMessage[]> => {
    try {
      const res = await fetch(
        `${API_V2}/chat/getchat?chatid=${chatId}&userid=${userId}&token=${token}`
      );
      const data = (await res.json()) as DatabaseResponse & { userData?: Chat };

      console.log("🔍 Chat data from /getchat:", data); // DEBUG

      if (data.success && data.userData) {
        const chat = data.userData as Chat;

        console.log("🔍 chatUserList from backend:", chat.chatUserList); // DEBUG

        //Chat-Details im State aktualisieren für chatUserList
        setChats((prev) =>
          prev.map((c) =>
            c.chatId === chatId
              ? {
                  ...c,
                  chatUserList: chat.chatUserList || {},
                  name: chat.name || c.name,
                }
              : c
          )
        );

        // Nachrichten extrahieren
        if (chat.chatMessages) {
          return Object.entries(chat.chatMessages).map(([ts, entry]) => {
            const msg = typeof entry === "string" ? JSON.parse(entry) : entry;
            return {
              id: msg.id ?? `msg-${ts}`,
              content: msg.content,
              senderId: msg.senderID,
              isOwn: msg.senderID === userId,
              timestamp: new Date(Number(msg.timestamp)),
            } as UIMessage;
          });
        }
      }
      return [];
    } catch (err) {
      console.error("Fehler beim Laden der Nachrichten:", err);
      return [];
    }
  };

  function getTtlOptions(min: number, def: number, max: number) {
    const presets = [
      min,
      def,
      max,
      300,
      900,
      3600,
      21600,
      86400,
      604800,
      2592000,
    ];
    return Array.from(
      new Set(presets.filter((x) => x >= min && x <= max))
    ).sort((a, b) => a - b);
  }

  //Rückgabe: Array der aktuellen ChatIds
  const refreshChats = async (): Promise<string[]> => {
    if (!currentUser) return [];
    try {
      const url = `${API_V2}/chat/getChatList?userId=${encodeURIComponent(
        currentUser.userId
      )}&token=${encodeURIComponent(currentUser.token)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = (await res.json()) as {
        success: boolean;
        userData?: string[] | string;
      };
      if (!data.success) {
        setChats([]);
        return [];
      }

      const chatIds: string[] =
        typeof data.userData === "string"
          ? JSON.parse(data.userData)
          : data.userData ?? [];

      // doppelte Chat-IDs entfernen - NICHT ENTFERNEN
      chatIds.forEach((id, index) => {
        if (chatIds.indexOf(id) !== index) {
          console.warn(`Doppelte Chat-ID gefunden und entfernt: ${id}`);
          chatIds.splice(index, 1);
        }
      });

      // State übernehmen
      setChats(
        chatIds.map((id) => {
          const old = chats.find((c) => c.chatId === id);
          return {
            chatId: id,
            name: old?.name ?? `Chat ${id.slice(0, 8)}...`,
            chatUserList: old?.chatUserList ?? {},
            messages: old?.messages ?? [],
            lastMessage: old?.lastMessage ?? null,
            unreadCount: old?.unreadCount ?? 0,
          } as Chat;
        })
      );

      return chatIds;
    } catch (err) {
      console.error("Fehler beim Laden der Chats:", err);
      setChats([]);
      return [];
    }
  };

  const getChatSettings = async (
    chatId: string
  ): Promise<{ minTTL: number; defaultTTL: number; maxTTL: number } | null> => {
    if (!currentUser) return null;
    try {
      const res = await fetch(
        `${API_V2}/chat/getChatSettings?chatid=${chatId}&userid=${currentUser.userId}&token=${currentUser.token}`
      );

      const data = (await res.json()) as DatabaseResponse;
      if (data.success && data.userData) {
        const chat = data.userData as Chat;

        //teilnehmerliste in chats
        setChats((prev) =>
          prev.map((c) =>
            c.chatId === chatId
              ? {
                  ...c,
                  chatUserList: chat.chatUserList || {},
                  name: chat.name ?? c.name,
                }
              : c
          )
        );
        return {
          minTTL: cleanTTL(chat.chatSettings?.minMessageTTL, 3600),
          defaultTTL: cleanTTL(chat.chatSettings?.defaultMessageTTL, 86400),
          maxTTL: cleanTTL(chat.chatSettings?.maxMessageTTL, 604800),
        };
      }
      return null;
    } catch (err) {
      console.error("Fehler beim Laden der Chat-Settings:", err);
      return null;
    }
  };

  const fetchUsers = async (): Promise<User[]> => {
    try {
      const res = await fetch(`${API_V2}/user/getUsers`);
      const data = (await res.json()) as DatabaseResponse;
      if (data.success && Array.isArray(data.userData)) {
        return data.userData as User[];
      }
      return [];
    } catch (err) {
      console.error("Netzwerkfehler beim Laden der User:", err);
      return [];
    }
  };

  const createAnonymousUser = async (): Promise<{
    success: boolean;
    userId?: string;
    error?: string;
  }> => {
    try {
      const res = await fetch(`${API_V2}/user/newano`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json()) as DatabaseResponse;

      if (data.success) {
        return { success: true, userId: data.id }; // Das ist die clientId zum Einloggen
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error("Netzwerkfehler:", err);
      return { success: false, error: t("errorMessages.networkError") };
    }
  };

  const loginUser = async (
    username: string,
    password: string
  ): Promise<{
    success: boolean;
    userId?: string;
    token?: string;
    error?: string;
  }> => {
    try {
      const res = await fetch(`${API_V2}/user/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId_username: username,
          ...(password && { password }),
        }),
      });
      const data = (await res.json()) as DatabaseResponse;
      console.log("Login Response:", data);
      if (data.success) {
        // v2 liefert entweder [userId, token] oder [token]
        if (Array.isArray(data.userData) && data.userData.length >= 2) {
          return {
            success: true,
            userId: data.userData[0],
            token: data.userData[1],
          };
        } else if (typeof data.userData === "string") {
          return { success: true, userId: data.id, token: data.userData };
        } else {
          return {
            success: false,
            error: t("errorMessages.unexpectedResponse"),
          };
        }
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error("Netzwerkfehler:", err);
      return { success: false, error: t("errorMessages.networkError") };
    }
  };

  const registerUser = async (
    username: string,
    password: string
  ): Promise<{ success: boolean; userId?: string; error?: string }> => {
    try {
      const res = await fetch(`${API_V2}/user/newuser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as DatabaseResponse;
      if (data.success) {
        return { success: true, userId: data.id };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error("Netzwerkfehler:", err);
      return { success: false, error: t("errorMessages.networkError") };
    }
  };

  function checkIfTTLIsValid(ttl: number, min: number, max: number): Boolean {
    if (ttl == -1 && max == -1) {
      return true;
    }

    if (min == -1 && max == -1 && ttl != -1) return false;

    if (ttl < min && min != -1) return false;
    if (ttl > max && max != -1) return false;

    return true;
  }

  const sendMessage = async (
    chatId: string,
    content: string,
    senderId: string,
    token: string,
    ttl?: number | null,
    settings?: { minTTL: number; defaultTTL: number; maxTTL: number } | null
  ) => {
    const chatkey = await Encryption.loadKey(chatId);
    if (!chatkey) {
      alert(t("errorMessages.unifinishedKeyExchange"));
      return { success: false, error: t("errorMessages.noChatKey") };
    }

    // TTL validieren gegen Chat-Settings
    if (ttl !== null && ttl !== undefined && chatSettings) {
      if (!checkIfTTLIsValid(ttl, chatSettings.minTTL, chatSettings.maxTTL)) {
        console.error(
          `TTL ${ttl} außerhalb erlaubter Grenzen: ${chatSettings.minTTL}-${chatSettings.maxTTL}`
        );
        return {
          success: false,
          error: t("errorMessages.ttlOutOfBounds", {
            minTTL: formatTTL(chatSettings.minTTL),
            maxTTL: formatTTL(chatSettings.maxTTL),
          }),
        };
      }
    }

    const message = await Encryption.encryptMessage(chatkey, content);

    try {
      const res = await fetch(`${API_V2}/chat/send_message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatID: chatId,
          senderID: senderId,
          senderToken: token,
          content: message,
          timestamp: Date.now().toString(),
          // TTL nur mitsenden wenn nicht null oder undefined
          ...(ttl !== null && ttl !== undefined ? { ttl } : {}),
        }),
      });
      const data = (await res.json()) as DatabaseResponse;
      return data.success
        ? { success: true }
        : { success: false, error: data.error };
    } catch (err) {
      console.error("Fehler beim Senden:", err);
      return { success: false, error: t("errorMessages.networkError") };
    }
  };

  // Event Handlers
  const handleLogin = async (asAnonymous = false) => {
    console.log("Login startet...");
    setAuthError(null);

    if (asAnonymous) {
      const result = await createAnonymousUser();

      if (result.success) {
        setAuthError(null);
        setSuccessMessage(
          t("successMessages.accountCreated", { userId: result.userId })
        );
      } else {
        setAuthError(
          t("errorMessages.authError.anoUserCreationFailed", {
            error: result.error,
          })
        );
      }
    } else {
      if (!loginForm.username) return; // Nur Username erforderlich

      const result = await loginUser(loginForm.username, loginForm.password);

      if (result.success) {
        const newUser = {
          userId: result.userId!,
          username: loginForm.username,
          isOnline: true,
          isAnonymous: !loginForm.password, // Anonym wenn kein Passwort
          token: result.token!,
        };

        console.log("🔄 Setze beide States gleichzeitig...");

        setCurrentUser(newUser);
        setIsAuthenticated(true);
      } else {
        console.error("Login fehlgeschlagen:", result.error);
        setAuthError(
          t("errorMessages.authError.loginFailed", { error: result.error })
        );
      }
    }
  };

  const handleRegister = async () => {
    setAuthError(null);

    if (!loginForm.username || !loginForm.password) {
      setAuthError(t("errorMessage.authError.missingParameters"));
      return;
    }

    const result = await registerUser(loginForm.username, loginForm.password);
    if (!result.success) {
      setAuthError(
        t("errorMessages.authError.registrationFailed", { error: result.error })
      );
      return;
    }

    const loginResult = await loginUser(loginForm.username, loginForm.password);
    if (loginResult.success) {
      const newUser = {
        userId: loginResult.userId,
        username: loginForm.username,
        isOnline: true,
        isAnonymous: false,
        token: loginResult.token,
      };

      setCurrentUser(newUser);
      setIsAuthenticated(true);
    }
  };

  const handleOpenChatMenu = async () => {
    if (selectedChatId && currentUser) {
      try {
        // holt komplette Chat details
        await getChatMessages(
          selectedChatId,
          currentUser.userId,
          currentUser.token
        );
      } catch (e) {
        console.error("Fehler beim Nachladen des Chats:", e);
      }
    }
    setShowChatMenu(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setSelectedChatId(null);
    setChats([]);
    setMessages([]);
    setLoginForm({ username: "", password: "" });
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedChatId || !currentUser) {
      return;
    }
    // Aktuelle TTL-Auswahl für diesen Chat holen

    const selectedTTL = messageTTL == undefined ? null : messageTTL;

    const result = await sendMessage(
      selectedChatId,
      messageInput,
      currentUser.userId,
      currentUser.token,
      selectedTTL,
      chatSettings
    );

    if (result.success) {
      setMessageInput("");
      console.log("Nachricht gesendet");

      if (selectedTTL != null) {
        console.log(
          `[SEND] Nachricht gesendet mit TTL: ${selectedTTL} Sekunden`
        );
      } else {
        console.log(
          `[SEND] Nachricht gesendet mit Standard-TTL (Chat-Default)`
        );
      }
    } else {
      console.error("Fehler beim Senden:", result.error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      handleSendMessage();
    }
  };

  const handleCreateChat = async () => {
    if (!newChatUserId || !currentUser) return;

    try {
      const ttl = selectedDefaultTTL;
      const minTTL = selectedMinTTL;
      const maxTTL = selectedMaxTTL;

      const res = await fetch(`${API_V2}/chat/newchat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userList: [{ userId: currentUser.userId }, { userId: newChatUserId }],
          ttl: ttl,
          minTTL: minTTL,
          maxTTL: maxTTL,
          creatorId: currentUser.userId,
          creatorToken: currentUser.token,
        }),
      });
      const data = (await res.json()) as DatabaseResponse;

      if (data.success) {
        console.log("Chat erfolgreich erstellt:", data.id);
        console.log("Backend response:", data);

        await Encryption.storeKey(
          data.id as string,
          await Encryption.generateChatKey()
        );

        //lokal in  State einfügen
        const newChat: Chat = {
          chatId: data.id,
          name: `Chat ${data.id.slice(0, 8)}...`,
          chatUserList: {
            [currentUser!.userId]: currentUser!.username || "Anonym",
            [newChatUserId]: `User ${newChatUserId.slice(0, 8)}`,
          },
          messages: [],
          lastMessage: null,
          unreadCount: 0,
        };
        setChats((prev) => [newChat, ...prev]);

        //Modal schließen und chat öffnen
        setShowCreateChat(false);
        setSelectedChatId(data.id);
        setNewChatUserId("");

        await refreshChats();
      } else {
        console.error("Fehler beim Erstellen des Chats:", data.error);
        setAuthError(
          t("errorMessages.authError.chatCreationFailed", { error: data.error })
        );
      }
    } catch (err) {
      console.error("Netzwerkfehler beim Erstellen des Chats:", err);
      setAuthError("errorMessages.authError.networkError");
    }
  };

  const handleAddUserToChat = async () => {
    if (!newChatUserId.trim() || !selectedChatId || !currentUser) return;

    const result = await addUserToChat(
      selectedChatId,
      newChatUserId.trim(),
      currentUser.userId,
      currentUser.token
    );

    if (result.success) {
      console.log("User hinzugefügt");
      setNewChatUserId("");
      setShowAddUser(false);
      setShowChatMenu(false);

      // Chat-Details neu laden
      await refreshChats();

      // Chat-Messages auch neu laden um Updates zu sehen
      if (selectedChatId && currentUser) {
        const chatMessages = await getChatMessages(
          selectedChatId,
          currentUser.userId,
          currentUser.token
        );
        chatMessages.sort(
          (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
        );
        setMessages(chatMessages);
      }
    } else {
      setAuthError(
        t("errorMessages.authError.otherError", { error: result.error })
      );
    }
  };

  const handleRemoveUserFromChat = async (userIdToRemove: string) => {
    if (!selectedChatId || !currentUser) return;
    if (!confirm(t("otherMessages.confirmRemoveUser"))) return;

    //  Backend call
    const { success, error } = await removeUserFromChat(
      selectedChatId,
      userIdToRemove,
      currentUser.userId,
      currentUser.token
    );
    if (!success) {
      setAuthError(t("errorMessages.authError.otherError", { error: error }));
      return;
    }
    setShowChatMenu(false);

    // Chats neu laden und neue IDs abfragen
    const newChatIds = await refreshChats();

    //Wenn Chat weg ist, aus dem UI schmeissen
    if (!newChatIds.includes(selectedChatId)) {
      // sofort aus dem local State entfernen
      setChats((prev) => prev.filter((c) => c.chatId !== selectedChatId));
      setStatus(t("otherMessages.endChat"));
      setSelectedChatId(null);
    }
  };

  const loadChatList = async () => {
    if (!userId || !token) return;
    try {
      const url = `${API_BASE}/chat/getChatList?userId=${userId}&token=${token}`;
      const res = await fetch(url, { method: "GET" });
      const data: DatabaseResponse = await res.json();

      if (data.success && Array.isArray(data.userData)) {
        setChatList(data.userData as UUID[]);
        setStatus(`Loaded ${data.userData.length} chats`);
      } else {
        throw new Error(data.error || "Failed to load chat list");
      }
    } catch (e: any) {
      setError(t("errorMessages.loadChatListError", { error: e.message || e }));
    }
  };

  const isRequestingRef = useRef(isRequestingKey);

  useEffect(() => {
    isRequestingRef.current = isRequestingKey;
  }, [isRequestingKey]);

  const activeKeyExchangeRef = useRef(activeKeyExchange);

  useEffect(() => {
    activeKeyExchangeRef.current = activeKeyExchange;
  }, [activeKeyExchange]);

  const DHKeyPairRef = useRef(DHKeyPair);

  useEffect(() => {
    DHKeyPairRef.current = DHKeyPair;
  }, [DHKeyPair]);

  const sharedKeyRef = useRef(sharedKey);

  useEffect(() => {
    sharedKeyRef.current = sharedKey;
  }, [sharedKey]);

  useEffect(() => {
    // nur wenn eingeloggt
    if (!isAuthenticated || !currentUser?.userId) {
      return;
    }

    console.log("WebSocket-Setup für User:", currentUser.userId);
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    setWsActive(true);

    ws.onopen = () => {
      console.log("WebSocket verbunden");
      const initMsg = {
        action: Action.Init,
        content: "init",
        senderID: currentUser.userId,
        chatID: currentUser.userId,
        timestamp: Date.now(),
        senderToken: currentUser.token,
      };
      ws.send(JSON.stringify(initMsg));
      setTimeout(() => {
        console.log("Auto-refresh Chats nach WebSocket-Verbindung");
        refreshChats();
      }, 500);
    };

    ws.onmessage = async (event) => {
      try {
        const data: WsMessage = JSON.parse(event.data);
        console.log("[WS] Parsed message:", data);

        if (data.action === Action.BroadcastToChat) {
          const contentText =
            typeof data.content === "string"
              ? data.content
              : JSON.stringify(data.content);

          const chatkey = await Encryption.loadKey(data.chatID);

          let decryptedText = null;

          if (chatkey) {
            decryptedText = await Encryption.decryptMessage(
              chatkey,
              contentText
            );
          }

          const newMessage: UIMessage = {
            id: `msg-${Date.now()}`,
            content: decryptedText ?? t("otherMessages.encryptedMessage"),
            senderId: data.senderID,
            timestamp: new Date(data.timestamp),
            isOwn: data.senderID === currentUser.userId,
          };

          if (data.chatID === selectedChatId) {
            console.log("Nachricht für aktuellen Chat, füge zu messages hinzu");
            setMessages((prev) => [...prev, newMessage]);
          }

          setChats((prev) =>
            prev.map((chat) =>
              chat.chatId === data.chatID
                ? {
                    ...chat,
                    lastMessage: {
                      content: contentText,
                      timestamp: new Date(data.timestamp),
                    },
                  }
                : chat
            )
          );
        } else if (data.action === Action.CK_REQ) {
          if (isRequestingRef.current || isSendingKey) return;

          Encryption.importPublicKey(data.content).then((dhpubl) => {
            if (!dhpubl) return;
            Encryption.loadKey(data.chatID).then((chatKey) => {
              if (!chatKey) return;
              setIsSendingKey(true);
              setActiveKeyExchange(data.chatID + data.senderID);
              Encryption.generateDHKeyPair().then((keyPair) => {
                if (!keyPair) return;
                setDHKeyPair(keyPair);
                Encryption.deriveSharedKey(keyPair.privateKey, dhpubl).then(
                  (sharedKey) => {
                    if (!sharedKey) return;
                    console.log("[WS] Sende DH_PUBLIC");
                    Encryption.exportPublicKey(keyPair.publicKey).then(
                      (pubKey) => {
                        const ackMsg: WsMessage = {
                          action: Action.DH_PUBLIC_EX,
                          content: `${data.chatID},${pubKey}`,
                          senderID: currentUser.userId as UUID,
                          chatID: data.senderID,
                          timestamp: Date.now(),
                        };
                        ws.send(JSON.stringify(ackMsg));
                        setTimeout(() => {
                          console.log("[WS] Sende Chat Key");
                          Encryption.exportAndEncryptChatKey(
                            chatKey,
                            sharedKey
                          ).then((encryptedKey) => {
                            const keyMsg: WsMessage = {
                              action: Action.CK_EX,
                              content: `${data.chatID},${encryptedKey}`,
                              senderID: currentUser.userId as UUID,
                              chatID: data.senderID,
                              timestamp: Date.now(),
                            };
                            ws.send(JSON.stringify(keyMsg));
                            console.log("[WS] Chat Key gesendet");
                            setSharedKey(null);
                            setDHKeyPair(null);
                            setActiveKeyExchange("");
                            setIsSendingKey(false);
                          });
                        }, 5000);
                      }
                    );
                  }
                );
              });
            });
          });
        } else if (data.action === Action.DH_PUBLIC_EX) {
          console.log(`requestingKey: ${isRequestingRef.current}`);
          if (isRequestingRef.current) {
            console.log(`activeKeyExchange: ${activeKeyExchangeRef.current}`);
            if (activeKeyExchangeRef.current === "") {
              console.log("[WS] Erhalte DH_PUBLIC_EX von:", data.senderID);
              const tokends = data.content.split(",");
              const chatId = tokends[0];
              const dhPublicExported = tokends[1];
              console.log(
                "[WS] DH_PUBLIC_EX Inhalt:",
                chatId,
                dhPublicExported
              );
              setActiveKeyExchange(chatId + data.senderID);
              Encryption.importPublicKey(dhPublicExported).then((dhPublic) => {
                if (!dhPublic) return;
                Encryption.deriveSharedKey(
                  DHKeyPairRef.current!.privateKey,
                  dhPublic
                ).then((sharedKey) => {
                  if (!sharedKey) return;
                  setSharedKey(sharedKey);
                  console.log("[WS] Shared Key abgeleitet");
                });
              });
            }
          }
        } else if (data.action === Action.CK_EX) {
          const tokens = data.content.split(",");
          const chatId = tokens[0];
          const chatKeyEE = tokens[1];
          if (
            isRequestingRef.current &&
            activeKeyExchangeRef.current === chatId + data.senderID
          ) {
            console.log("[WS] Erhalte CK_EX von:", data.senderID);
            Encryption.decryptChatKey(chatKeyEE, sharedKeyRef.current!).then(
              (chatKey) => {
                if (!chatKey) return;
                console.log("[WS] Chat Key importiert");
                Encryption.storeKey(chatId, chatKey).then(() => {
                  setIsRequestingKey(false);
                  setIsSendingKey(false);
                  setSharedKey(null);
                  setDHKeyPair(null);
                  setActiveKeyExchange("");
                  console.log("[WS] Chat Key gespeichert:", data.chatID);
                });
              }
            );
          }
        } else {
          console.log("[WS] Andere Aktion erhalten:", data.action, data);
        }
      } catch (error) {
        console.error("[WS] Fehler beim Verarbeiten der Nachricht:", error);
        console.log("[WS] Ungültige Rohdaten:", event.data);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket getrennt");
      setWsActive(false);
    };

    return () => {
      ws.close();
      setWsActive(false);
    };
  }, [isAuthenticated, currentUser?.userId, selectedChatId]);

  // Nachrichten laden wenn Chat ausgewählt
  useEffect(() => {
    const loadMessages = async () => {
      if (selectedChatId && currentUser) {
        console.log("📥 Lade Nachrichten für Chat:", selectedChatId);
        const chatMessages = await getChatMessages(
          selectedChatId,
          currentUser.userId,
          currentUser.token
        );
        chatMessages.sort(
          (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
        );
        const chatkey = await Encryption.loadKey(selectedChatId);
        if (!chatkey) {
          setMessages(chatMessages);

          //also start requesting key
          if (!isRequestingKey && !isSendingKey) {
            console.log("🔑 Starte Key Exchange für Chat:", selectedChatId);
            setIsRequestingKey(true);
            const dhKeyPair = await Encryption.generateDHKeyPair();
            if (dhKeyPair) {
              setDHKeyPair(dhKeyPair);
              const dhPublic = await Encryption.exportPublicKey(
                dhKeyPair.publicKey
              );
              if (dhPublic) {
                const requestMsg: WsMessage = {
                  action: Action.CK_REQ,
                  content: dhPublic,
                  senderID: currentUser.userId as UUID,
                  chatID: selectedChatId as UUID,
                  timestamp: Date.now(),
                  senderToken: currentUser.token,
                };
                wsRef.current?.send(JSON.stringify(requestMsg));
                console.log(requestMsg);
              }
            }
          }
        } else {
          console.log(chatMessages);
          const decryptPromises = chatMessages.map(async (message) => {
            const decryptedText = await Encryption.decryptMessage(
              chatkey,
              message.content
            );
            return {
              ...message,
              content: decryptedText,
            };
          });

          const decryptedMessages = await Promise.all(decryptPromises);
          setMessages(decryptedMessages);
        }
      } else {
        setMessages([]);
      }
    };

    loadMessages();
  }, [selectedChatId, currentUser, isRequestingKey]);

  useEffect(() => {
    const loadChatSettings = async () => {
      if (selectedChatId) {
        const settings = await getChatSettings(selectedChatId);
        setChatSettings(settings);
      } else {
        setChatSettings(null);
      }
    };

    loadChatSettings();
  }, [selectedChatId, currentUser]);

  //automatisches polling
  useEffect(() => {
    if (!wsActive || !selectedChatId) return;

    // einmalig prüfen
    (async () => {
      const ids = await refreshChats();
      if (!ids.includes(selectedChatId)) {
        setStatus(t("otherMessages.endChat"));
        setSelectedChatId(null);
      }
    })();

    const interval = setInterval(async () => {
      const ids = await refreshChats();
      if (!ids.includes(selectedChatId)) {
        setStatus(t("otherMessages.endChat"));
        setSelectedChatId(null);
        clearInterval(interval);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [wsActive, selectedChatId]);

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
                  chat.lastMessage.content
                );
                return [chat.chatId, decrypted];
              } catch {
                return [chat.chatId, t("otherMessages.encryptedMessage")];
              }
            } else {
              return [chat.chatId, t("otherMessages.encryptedMessage")];
            }
          }
          return [chat.chatId, t("chatList.noNewMessages")];
        })
      );
      setDecryptedLastMessages(Object.fromEntries(entries));
    };

    decryptLastMessages();
  }, [chats]);

  // Filtered Data
  const selectedChat = chats.find((chat) => chat.chatId === selectedChatId);
  const filteredChats = chats.filter(
    (chat) =>
      chat.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chat.lastMessage?.content
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase())
  );
  const filteredUsers = users.filter((user) =>
    user.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen min-w-screen bg-white dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-sm w-full space-y-6">
          <div className="text-center mb-8">
            <div className="w-32 h-32 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 dark:bg-white">
              <svg
                width="180"
                height="180"
                viewBox="0 0 180 180"
                fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M0 64C0 41.5979 0 30.3968 4.35974 21.8404C8.19467 14.3139 14.3139 8.19467 21.8404 4.35974C30.3968 0 41.5979 0 64 0H116C138.402 0 149.603 0 158.16 4.35974C165.686 8.19467 171.805 14.3139 175.64 21.8404C180 30.3968 180 41.5979 180 64V116C180 138.402 180 149.603 175.64 158.16C171.805 165.686 165.686 171.805 158.16 175.64C149.603 180 138.402 180 116 180H64C41.5979 180 30.3968 180 21.8404 175.64C14.3139 171.805 8.19467 165.686 4.35974 158.16C0 149.603 0 138.402 0 116V64Z"
                  fill="#323232"
                />
                <path
                  d="M30.9081 44L40.8081 22.85H45.1581L55.0581 44H49.5381L47.0481 38.18L49.1481 39.71H36.7881L38.9181 38.18L36.4281 44H30.9081ZM42.9381 28.61L39.4581 36.92L38.6181 35.48H47.3481L46.5081 36.92L42.9981 28.61H42.9381ZM56.3389 44V22.85H60.3889L70.9489 36.02H70.1089V22.85H75.2089V44H71.1889L60.6289 30.8H61.4689V44H56.3389ZM89.2733 44.33C87.6733 44.33 86.2133 44.07 84.8933 43.55C83.5733 43.03 82.4333 42.29 81.4733 41.33C80.5333 40.35 79.8033 39.19 79.2833 37.85C78.7833 36.51 78.5333 35.03 78.5333 33.41C78.5333 31.77 78.7833 30.28 79.2833 28.94C79.8033 27.6 80.5333 26.45 81.4733 25.49C82.4333 24.53 83.5733 23.8 84.8933 23.3C86.2133 22.78 87.6733 22.52 89.2733 22.52C90.8733 22.52 92.3333 22.78 93.6533 23.3C94.9733 23.8 96.1033 24.53 97.0433 25.49C98.0033 26.45 98.7333 27.6 99.2333 28.94C99.7533 30.26 100.013 31.74 100.013 33.38C100.013 35.04 99.7533 36.54 99.2333 37.88C98.7333 39.22 98.0033 40.38 97.0433 41.36C96.1033 42.32 94.9733 43.06 93.6533 43.58C92.3333 44.08 90.8733 44.33 89.2733 44.33ZM89.2733 39.71C90.3333 39.71 91.2333 39.46 91.9733 38.96C92.7133 38.46 93.2833 37.74 93.6833 36.8C94.0833 35.86 94.2833 34.73 94.2833 33.41C94.2833 32.09 94.0833 30.96 93.6833 30.02C93.3033 29.08 92.7333 28.37 91.9733 27.89C91.2333 27.39 90.3333 27.14 89.2733 27.14C88.2333 27.14 87.3333 27.39 86.5733 27.89C85.8333 28.37 85.2633 29.08 84.8633 30.02C84.4633 30.96 84.2633 32.09 84.2633 33.41C84.2633 34.73 84.4533 35.86 84.8333 36.8C85.2333 37.74 85.8133 38.46 86.5733 38.96C87.3333 39.46 88.2333 39.71 89.2733 39.71Z"
                  fill="white"
                />
                <path
                  d="M113.953 44.33C111.613 44.33 109.603 43.88 107.923 42.98C106.243 42.08 104.953 40.81 104.053 39.17C103.173 37.53 102.733 35.61 102.733 33.41C102.733 31.21 103.173 29.3 104.053 27.68C104.953 26.04 106.243 24.77 107.923 23.87C109.603 22.97 111.613 22.52 113.953 22.52C115.353 22.52 116.703 22.73 118.003 23.15C119.303 23.57 120.353 24.14 121.153 24.86L119.503 29.21C118.623 28.57 117.743 28.1 116.863 27.8C115.983 27.48 115.083 27.32 114.163 27.32C112.303 27.32 110.903 27.85 109.963 28.91C109.023 29.95 108.553 31.45 108.553 33.41C108.553 35.39 109.023 36.91 109.963 37.97C110.903 39.01 112.303 39.53 114.163 39.53C115.083 39.53 115.983 39.38 116.863 39.08C117.743 38.76 118.623 38.28 119.503 37.64L121.153 41.99C120.353 42.69 119.303 43.26 118.003 43.7C116.703 44.12 115.353 44.33 113.953 44.33ZM123.928 44V22.85H128.518L135.808 35.9H134.758L142.018 22.85H146.488V44H141.508V31.43H142.138L136.678 40.88H133.678L128.218 31.4H128.908V44H123.928Z"
                  fill="#009DFF"
                />
                <path
                  d="M67.1605 127C63.7998 127 62.7557 124.176 64.485 121.904C65.9533 119.989 68.694 116.159 70.1623 113.335C59.8519 108.596 53 99.1508 53 88.5045C53 72.178 69.4444 59 90 59C110.556 59 127 72.178 127 88.5045C127 105.513 109.936 118.496 87.194 117.879C80.5705 122.586 71.5653 127 67.1605 127ZM70.5864 121.612C73.5556 120.411 79.3633 116.841 83.3765 113.952C84.6164 112.978 85.6605 112.556 87.0309 112.556C88.336 112.589 89.3474 112.621 90 112.621C107.619 112.621 121.616 101.78 121.616 88.5045C121.616 75.1967 107.619 64.3556 90 64.3556C72.4136 64.3556 58.4162 75.1967 58.4162 88.5045C58.4162 97.1384 64.2892 104.701 74.5344 109.44C76.6226 110.414 76.851 111.907 75.9374 113.595C74.828 115.672 72.2178 119.048 70.3907 121.287C70.2275 121.515 70.3254 121.709 70.5864 121.612Z"
                  fill="white"
                />
                <rect
                  x="55"
                  y="146"
                  width="15"
                  height="15"
                  rx="7.5"
                  fill="#009DFF"
                />
                <rect
                  x="82"
                  y="146"
                  width="15"
                  height="15"
                  rx="7.5"
                  fill="#009DFF"
                />
                <rect
                  x="109"
                  y="146"
                  width="15"
                  height="15"
                  rx="7.5"
                  fill="#009DFF"
                />
                <path
                  d="M89.9922 79.5C90.032 79.5008 90.071 79.5091 90.1074 79.5234L90.1836 79.5527L90.2646 79.5576C93.0299 79.7018 95.2273 81.902 95.2275 84.5996V86.7002H97.3633C98.0018 86.7002 98.4999 87.2026 98.5 87.7998V97.4004C98.4998 97.9975 98.0017 98.5 97.3633 98.5H82.6367C81.9983 98.5 81.5002 97.9975 81.5 97.4004V87.7998C81.5001 87.2026 81.9982 86.7002 82.6367 86.7002H84.7725V84.5996C84.7727 81.8055 87.1079 79.5041 89.9922 79.5ZM90 80.0996C87.4653 80.0996 85.4094 82.0942 85.4092 84.5996V86.7002H94.5908V84.5996C94.5906 82.0942 92.5347 80.0996 90 80.0996Z"
                  fill="white"
                  stroke="white"
                />
              </svg>
            </div>
            <p className="text-gray-500 dark:text-white">
              {t("authPage.anocm")}
            </p>
          </div>

          {authError && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
              {authError}
            </div>
          )}

          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg text-sm mb-4">
              {successMessage}
            </div>
          )}

          {/*Tab switcher */}
          <div className="relative bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-6">
            <div className="flex relative">
              <div
                className={`absolute top-1 bottom-1 w-1/2 bg-white dark:bg-gray-900 rounded-lg shadow-sm transition-transform duration-300 ease-out ${
                  authMode === "register" ? "transform translate-x-full" : ""
                }`}
              />

              <button
                onClick={() => setAuthMode("login")}
                className={`flex-1 py-3 text-center font-medium transition-colors duration-300 relative z-10 ${
                  authMode === "login"
                    ? "text-gray-900 dark:text-gray-100"
                    : "text-gray-500 dark:text-gray-400"
                }`}>
                {t("authPage.tabSwitcher.login")}
              </button>
              <button
                onClick={() => setAuthMode("register")}
                className={`flex-1 py-3 text-center font-medium transition-colors duration-300 relative z-10 ${
                  authMode === "register"
                    ? "text-gray-900 dark:text-gray-100"
                    : "text-gray-500 dark:text-gray-400"
                }`}>
                {t("authPage.tabSwitcher.register")}
              </button>
            </div>
          </div>

          {/* INPUT-FELDER */}
          <div className="space-y-4">
            <input
              type="text"
              placeholder={t("authPage.inputField.username")}
              value={loginForm.username}
              onChange={(e) =>
                setLoginForm((prev) => ({ ...prev, username: e.target.value }))
              }
              className="w-full px-4 py-4 bg-gray-50 border-0 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200"
            />

            <input
              type="password"
              placeholder={t("authPage.inputField.password")}
              value={loginForm.password}
              onChange={(e) =>
                setLoginForm((prev) => ({ ...prev, password: e.target.value }))
              }
              className="w-full px-4 py-4 bg-gray-50 border-0 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200"
            />

            <button
              onClick={() =>
                authMode === "login" ? handleLogin(false) : handleRegister()
              }
              disabled={!loginForm.username}
              className="w-full bg-blue-500 text-white dark:disabled:text-gray-400 py-4 rounded-xl font-semibold disabled:bg-gray-300 dark:disabled:bg-gray-700 transition-all duration-200 hover:bg-blue-600">
              {authMode === "login"
                ? t("authPage.buttons.login")
                : t("authPage.buttons.register")}
            </button>
          </div>

          <div className="text-center">
            <span className="text-gray-400 dark:text-white text-sm">
              {t("authPage.or")}
            </span>
          </div>

          <button
            onClick={() => handleLogin(true)}
            className="w-full bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 py-4 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-950 transition-all duration-200">
            {t("authPage.buttons.anonymous")}
          </button>
        </div>
        <div className="fixed top-4 right-4">
          <div className="relative inline-block text-right mr-2">
            <button
              className="inline-flex px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md shadow hover:bg-gray-50, dark:hover:bg-gray-700 focus:outline-none hover:cursor-pointer"
              onClick={() => toggleDropdown("languageSelector")}>
              <span>{i18n.resolvedLanguage}</span>
              <ChevronDown className="ml-2 mr-0" />
            </button>
            <div
              id="languageSelector"
              className="hidden origin-top-right absolute right-0 mt-2 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-gray-100 dark:ring-gray-700 ring-opacity-5">
              {Object.keys(lngs).map((lng) => (
                <button
                  key={lng}
                  className={`inline-flex items-center justify-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-md ${
                    i18n.resolvedLanguage === lng ? "font-bold" : "font-normal"
                  }`}
                  type="button"
                  onClick={() => i18n.changeLanguage(lng)}>
                  {lngs[lng].nativeName}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="fixed max-sm:top-4 max-sm:left-4 sm:bottom-4 sm:right-4">
          <button
            onClick={() => toggleDarkMode()}
            className="p-3 bg-gray-700 dark:bg-gray-200 text-gray-200 dark:text-gray-800 rounded-full shadow-lg hover:bg-gray-600 dark:hover:bg-gray-300 transition-colors"
            title="Toggle Light/Dark Mode">
            {isDarkMode ? <Moon /> : <Sun />}
          </button>
        </div>
      </div>
    );
  }

  // Main Chat Interface
  return (
    <div className="flex h-screen w-screen bg-white dark:bg-gray-900">
      {/* Desktop Sidebar*/}
      <div className="hidden md:flex w-16 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex-col items-center py-4 space-y-2">
        <button
          onClick={() => setActiveSection("chats")}
          className={`p-3 rounded-full transition-colors ${
            activeSection === "chats"
              ? "bg-blue-500 text-white"
              : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:hover:text-white"
          }`}>
          <MessageCircle className="w-5 h-5" />
        </button>

        <button
          onClick={() => setActiveSection("users")}
          className={`p-3 rounded-full transition-colors ${
            activeSection === "users"
              ? "bg-blue-500 text-white"
              : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:hover:text-white"
          }`}>
          <Users className="w-5 h-5" />
        </button>

        <div className="flex-1" />

        <button
          onClick={toggleDarkMode}
          className="p-3 bg-gray-700 dark:bg-gray-200 text-gray-200 dark:text-gray-800 rounded-full shadow-lg hover:bg-gray-600 dark:hover:bg-gray-300 transition-colors"
          title="Toggle Light/Dark Mode">
          {isDarkMode ? <Moon /> : <Sun />}
        </button>
        <button
          onClick={() => setShowLanguages(true)}
          className="p-3 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:hover:text-white transition-colors">
          <Languages />
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="p-3 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:hover:text-white transition-colors">
          <Settings className="w-5 h-5" />
        </button>

        <button
          onClick={handleLogout}
          className="p-3 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:hover:text-white transition-colors">
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Chat/Users List */}
      <div
        className={`${
          selectedChatId ? "hidden md:flex" : "flex"
        } w-full md:w-80 bg-white dark:bg-gray-700 border-r border-gray-200 flex-col pb-16 md:pb-0`}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              {activeSection === "chats" ? "Anocm" : t("chatList.contacts")}
            </h1>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setShowCreateChat(true)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:hover:text-white rounded-full transition-colors"
                title={t("chatList.createNewChat")}>
                <Edit className="w-5 h-5" />
              </button>

              {/* Refresh Button */}
              <button
                onClick={() => {
                  console.log("🔄 Lade Chats manuell neu...");
                  refreshChats();
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:hover:text-white rounded-full transition-colors"
                title={t("chatList.refreshChats")}>
                <RefreshCcw className="w-5 h-5" />
              </button>

              <button
                onClick={() => setShowSettings(true)}
                className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:hover:text-white rounded-full transition-colors">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t("chatList.search")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-100 border-0 rounded-full focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
          {activeSection === "chats" ? (
            <>
              {filteredChats.length > 0 ? (
                filteredChats.map((chat, index) => (
                  <div
                    key={chat.chatId}
                    onClick={() => setSelectedChatId(chat.chatId)}
                    className={`px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      selectedChatId === chat.chatId
                        ? "bg-blue-50 dark:bg-blue-950"
                        : ""
                    } ${
                      index > 0
                        ? "border-t border-gray-100 dark:border-gray-700"
                        : ""
                    }`}>
                    <div className="flex items-center space-x-3">
                      {/* Avatar */}
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm ${getAvatarColor(
                          chat.name,
                          chat.isAnonymous
                        )}`}>
                        {getInitials(chat.name)}
                      </div>

                      {/* Chat Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {chat.name}
                          </h3>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {chat.lastMessage
                              ? formatTimestamp(chat.lastMessage.timestamp)
                              : ""}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                            {decryptedLastMessages[chat.chatId] ||
                              t("chatList.noNewMessages")}
                          </p>
                          {chat.unreadCount > 0 && (
                            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 text-xs font-medium text-white bg-blue-500 rounded-full ml-2">
                              {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <p>
                    {searchTerm
                      ? t("chatList.noChatsFound")
                      : t("chatList.noChats")}
                  </p>
                </div>
              )}
            </>
          ) : (
            // Users List
            <>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user, index) => (
                  <div
                    key={user.userId}
                    className={`px-4 py-3 hover:bg-gray-50 transition-colors ${
                      index > 0 ? "border-t border-gray-100" : ""
                    }`}>
                    <div className="flex items-center space-x-3">
                      {/* Avatar */}
                      <div className="relative">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm ${getAvatarColor(
                            user.name,
                            user.isAnonymous
                          )}`}>
                          {getInitials(user.name)}
                        </div>
                        {user.isOnline && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                        )}
                      </div>

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {user.username}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {user.isOnline
                            ? t("chatList.online")
                            : t("chatList.offline")}
                        </p>
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={() => {
                          setNewChatUserId(user.userId);
                          setShowCreateChat(true);
                        }}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <MessageCircle className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <p>
                    {searchTerm
                      ? t("chatList.noContactsFound")
                      : t("chatList.noContacts")}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Chat Area*/}
      <div
        className={`${
          selectedChatId ? "flex" : "hidden md:flex"
        } flex-1 flex-col pb-16 md:pb-0 w-full overflow-x-hidden`}>
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setSelectedChatId(null)}
                    className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                    <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  </button>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm ${getAvatarColor(
                      selectedChat.name,
                      selectedChat.isAnonymous
                    )}`}>
                    {getInitials(selectedChat.name)}
                  </div>
                  <div>
                    <h2 className="text-sm font-medium text-gray-900 dark:text-white">
                      {selectedChat.name}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {selectedChat.isAnonymous
                        ? t("chatList.anonymousChat")
                        : t("chatList.recentlyActive")}
                    </p>
                  </div>
                </div>

                {/* 3-Punkte-Menü */}
                <div className="relative">
                  <button
                    onClick={handleOpenChatMenu}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors group">
                    <div className="flex flex-col space-y-1">
                      <div className="w-1 h-1 bg-gray-600 dark:group-hover:bg-white rounded-full" />
                      <div className="w-1 h-1 bg-gray-600 dark:group-hover:bg-white rounded-full" />
                      <div className="w-1 h-1 bg-gray-600 dark:group-hover:bg-white rounded-full" />
                    </div>
                  </button>

                  {showChatMenu && (
                    <div className="absolute right-0 top-full mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg p-3 min-w-64 z-10">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 px-1 font-medium">
                        {t("menus.manageChat")}
                      </div>

                      {/* Chat TTL Info */}
                      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg mb-3">
                        <div className="flex items-center space-x-2 mb-1">
                          <Clock className="w-4 h-4 text-gray-600 dark:text-white" />
                          <span className="text-sm font-medium text-gray-700 dark:text-white">
                            {chatSettings
                              ? `TTL: ${formatTTL(chatSettings.defaultTTL)}`
                              : "TTL: Standard"}
                          </span>
                        </div>
                        {chatSettings && (
                          <div className="text-xs text-gray-500 dark:text-400">
                            Min: {formatTTL(chatSettings.minTTL)} - Max:{" "}
                            {formatTTL(chatSettings.maxTTL)}
                          </div>
                        )}
                      </div>

                      {chatSettings && (
                        <div className="mb-4">
                          <label className="text-xs text-gray-500 dark:text-gray-400 font-medium block mb-1">
                            {t("menus.ttlInfo.pre")}
                          </label>
                          <select
                            value={
                              chatMessageTTLs[selectedChatId!] === undefined ||
                              chatMessageTTLs[selectedChatId!] === null
                                ? ""
                                : chatMessageTTLs[selectedChatId!]
                            }
                            onChange={(e) => {
                              const ttlValue =
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value);
                              setChatMessageTTLs((prev) => ({
                                ...prev,
                                [selectedChatId!]: ttlValue,
                              }));

                              console.log(
                                `[TTL] TTL für Chat ${selectedChatId} gesetzt auf:`,
                                ttlValue === null
                                  ? "Standard (Chat-Default)"
                                  : `${ttlValue} Sekunden`
                              );
                            }}
                            className="w-full px-2 py-1 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 dark:text-white rounded text-sm">
                            {/* Standard-Option */}
                            <option value="">
                              {t("common.standard")} (
                              {formatTTL(chatSettings.defaultTTL)})
                            </option>
                            {/* Dynamische Optionen von Backend */}
                            {getTtlOptions(
                              chatSettings.minTTL,
                              chatSettings.defaultTTL,
                              chatSettings.maxTTL
                            )
                              .filter((ttl) => ttl !== chatSettings.defaultTTL) // Standard nicht doppelt
                              .map((ttl) => (
                                <option key={ttl} value={ttl}>
                                  {formatTTL(ttl)}
                                </option>
                              ))}
                          </select>
                          <div className="text-xs text-gray-400 mt-1">
                            {t("menus.ttlInfo.post")}
                          </div>
                        </div>
                      )}

                      {/* Teilnehmer Verwaltung */}
                      <div className="border-t dark:border-gray-300 pt-3">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            👥 {t("menus.manageUsers.users")} (
                            {selectedChat?.chatUserList
                              ? Object.keys(selectedChat.chatUserList).length
                              : 0}
                            )
                          </span>
                          <button
                            onClick={() => {
                              setShowAddUser(true);
                              setShowChatMenu(false);
                            }}
                            className="flex items-center space-x-1 px-2 py-1 text-blue-500 dark:hover:bg-gray-700 hover:bg-blue-50 rounded transition-colors text-xs">
                            <UserPlus className="w-3 h-3" />
                            <span>{t("menus.manageUsers.addUser")}</span>
                          </button>
                        </div>

                        {/* Teilnehmer Liste */}
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {selectedChat?.chatUserList &&
                          Object.entries(selectedChat.chatUserList).length >
                            0 ? (
                            Object.entries(selectedChat.chatUserList).map(
                              ([userId, username]) => (
                                <div
                                  key={userId}
                                  className="flex items-center justify-between py-2 px-2 bg-gray-50 dark:bg-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                                  <div className="flex items-center space-x-2">
                                    <div
                                      className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium ${getAvatarColor(
                                        username,
                                        false
                                      )}`}>
                                      {getInitials(username)}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-sm font-medium text-gray-700 dark:text-white">
                                        {username}
                                        {userId === currentUser?.userId && (
                                          <span className="text-blue-600 text-xs ml-1">
                                            (Du)
                                          </span>
                                        )}
                                      </span>
                                      <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {userId.slice(0, 8)}...
                                      </span>
                                    </div>
                                  </div>
                                  {
                                    <button
                                      onClick={() =>
                                        handleRemoveUserFromChat(userId)
                                      }
                                      className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                                      title="User entfernen">
                                      <X className="w-3 h-3" />
                                    </button>
                                  }
                                </div>
                              )
                            )
                          ) : (
                            <div className="text-gray-500 dark:text-gray-400 text-sm italic py-4 text-center">
                              {t("menus.manageUsers.noUsersFound")}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Menü schließen */}
                      <div className="border-t dark:border-gray-300 pt-3 mt-3">
                        <button
                          onClick={() => setShowChatMenu(false)}
                          className="w-full text-center py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
                          {t("common.close")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {status && (
              <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded mb-2 mx-4">
                {status}
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-gray-50 dark:bg-gray-800 w-full">
              <div className="space-y-2">
                {messages?.map((message) => (
                  <div
                    key={message.id}
                    className={`flex w-full ${
                      message.isOwn ? "justify-end" : "justify-start"
                    }`}>
                    <div
                      className={`
                        max-w-[45%] px-3 py-2 rounded-2xl text-sm break-words whitespace-pre-wrap
                        ${
                          message.senderId === "system"
                            ? "bg-gray-200 text-gray-600 text-center mx-auto"
                            : message.isOwn
                            ? "bg-blue-500 text-white"
                            : "bg-white text-gray-900 border"
                        }`}>
                      <div>{message.content}</div>
                      <div
                        className={`text-xs mt-1 ${
                          message.isOwn ? "text-blue-100" : "text-gray-500"
                        }`}>
                        {formatTimestamp(message.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Message Input */}
            <div className="bg-white dark:bg-gray-900 border-t border-gray-200 px-4 py-4">
              <div className="flex align-items-center space-x-2">
                <div className="flex-1">
                  <textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={t("sendMessage.send")}
                    className="w-full px-3 py-2 dark:bg-white border border-gray-300 rounded-full resize-none focus:outline-none focus:border-blue-500 text-sm"
                    rows={1}
                    style={{ minHeight: "36px", maxHeight: "100px" }}
                  />
                </div>
                <textarea
                  value={messageTTL}
                  onChange={(e) => {
                    setMessageTTL(e.target.value);
                    console.log(e.target.value);
                  }}
                  onKeyPress={handleKeyPress}
                  placeholder={t("sendMessage.ttlInSeconds")}
                  className="w-35 px-3 py-2 dark:bg-white border border-gray-300 rounded-full resize-none focus:outline-none focus:border-blue-500 text-sm"
                  rows={1}
                  style={{ minHeight: "36px", maxHeight: "100px" }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed transition-colors">
                  <Send className="h-[100%]" />
                </button>
              </div>
            </div>
          </>
        ) : (
          // Empty State
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
            <div className="text-center max-w-sm">
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  width="180"
                  height="180"
                  viewBox="0 0 180 180"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M0 64C0 41.5979 0 30.3968 4.35974 21.8404C8.19467 14.3139 14.3139 8.19467 21.8404 4.35974C30.3968 0 41.5979 0 64 0H116C138.402 0 149.603 0 158.16 4.35974C165.686 8.19467 171.805 14.3139 175.64 21.8404C180 30.3968 180 41.5979 180 64V116C180 138.402 180 149.603 175.64 158.16C171.805 165.686 165.686 171.805 158.16 175.64C149.603 180 138.402 180 116 180H64C41.5979 180 30.3968 180 21.8404 175.64C14.3139 171.805 8.19467 165.686 4.35974 158.16C0 149.603 0 138.402 0 116V64Z"
                    fill="#323232"
                  />
                  <path
                    d="M30.9081 44L40.8081 22.85H45.1581L55.0581 44H49.5381L47.0481 38.18L49.1481 39.71H36.7881L38.9181 38.18L36.4281 44H30.9081ZM42.9381 28.61L39.4581 36.92L38.6181 35.48H47.3481L46.5081 36.92L42.9981 28.61H42.9381ZM56.3389 44V22.85H60.3889L70.9489 36.02H70.1089V22.85H75.2089V44H71.1889L60.6289 30.8H61.4689V44H56.3389ZM89.2733 44.33C87.6733 44.33 86.2133 44.07 84.8933 43.55C83.5733 43.03 82.4333 42.29 81.4733 41.33C80.5333 40.35 79.8033 39.19 79.2833 37.85C78.7833 36.51 78.5333 35.03 78.5333 33.41C78.5333 31.77 78.7833 30.28 79.2833 28.94C79.8033 27.6 80.5333 26.45 81.4733 25.49C82.4333 24.53 83.5733 23.8 84.8933 23.3C86.2133 22.78 87.6733 22.52 89.2733 22.52C90.8733 22.52 92.3333 22.78 93.6533 23.3C94.9733 23.8 96.1033 24.53 97.0433 25.49C98.0033 26.45 98.7333 27.6 99.2333 28.94C99.7533 30.26 100.013 31.74 100.013 33.38C100.013 35.04 99.7533 36.54 99.2333 37.88C98.7333 39.22 98.0033 40.38 97.0433 41.36C96.1033 42.32 94.9733 43.06 93.6533 43.58C92.3333 44.08 90.8733 44.33 89.2733 44.33ZM89.2733 39.71C90.3333 39.71 91.2333 39.46 91.9733 38.96C92.7133 38.46 93.2833 37.74 93.6833 36.8C94.0833 35.86 94.2833 34.73 94.2833 33.41C94.2833 32.09 94.0833 30.96 93.6833 30.02C93.3033 29.08 92.7333 28.37 91.9733 27.89C91.2333 27.39 90.3333 27.14 89.2733 27.14C88.2333 27.14 87.3333 27.39 86.5733 27.89C85.8333 28.37 85.2633 29.08 84.8633 30.02C84.4633 30.96 84.2633 32.09 84.2633 33.41C84.2633 34.73 84.4533 35.86 84.8333 36.8C85.2333 37.74 85.8133 38.46 86.5733 38.96C87.3333 39.46 88.2333 39.71 89.2733 39.71Z"
                    fill="white"
                  />
                  <path
                    d="M113.953 44.33C111.613 44.33 109.603 43.88 107.923 42.98C106.243 42.08 104.953 40.81 104.053 39.17C103.173 37.53 102.733 35.61 102.733 33.41C102.733 31.21 103.173 29.3 104.053 27.68C104.953 26.04 106.243 24.77 107.923 23.87C109.603 22.97 111.613 22.52 113.953 22.52C115.353 22.52 116.703 22.73 118.003 23.15C119.303 23.57 120.353 24.14 121.153 24.86L119.503 29.21C118.623 28.57 117.743 28.1 116.863 27.8C115.983 27.48 115.083 27.32 114.163 27.32C112.303 27.32 110.903 27.85 109.963 28.91C109.023 29.95 108.553 31.45 108.553 33.41C108.553 35.39 109.023 36.91 109.963 37.97C110.903 39.01 112.303 39.53 114.163 39.53C115.083 39.53 115.983 39.38 116.863 39.08C117.743 38.76 118.623 38.28 119.503 37.64L121.153 41.99C120.353 42.69 119.303 43.26 118.003 43.7C116.703 44.12 115.353 44.33 113.953 44.33ZM123.928 44V22.85H128.518L135.808 35.9H134.758L142.018 22.85H146.488V44H141.508V31.43H142.138L136.678 40.88H133.678L128.218 31.4H128.908V44H123.928Z"
                    fill="#009DFF"
                  />
                  <path
                    d="M67.1605 127C63.7998 127 62.7557 124.176 64.485 121.904C65.9533 119.989 68.694 116.159 70.1623 113.335C59.8519 108.596 53 99.1508 53 88.5045C53 72.178 69.4444 59 90 59C110.556 59 127 72.178 127 88.5045C127 105.513 109.936 118.496 87.194 117.879C80.5705 122.586 71.5653 127 67.1605 127ZM70.5864 121.612C73.5556 120.411 79.3633 116.841 83.3765 113.952C84.6164 112.978 85.6605 112.556 87.0309 112.556C88.336 112.589 89.3474 112.621 90 112.621C107.619 112.621 121.616 101.78 121.616 88.5045C121.616 75.1967 107.619 64.3556 90 64.3556C72.4136 64.3556 58.4162 75.1967 58.4162 88.5045C58.4162 97.1384 64.2892 104.701 74.5344 109.44C76.6226 110.414 76.851 111.907 75.9374 113.595C74.828 115.672 72.2178 119.048 70.3907 121.287C70.2275 121.515 70.3254 121.709 70.5864 121.612Z"
                    fill="white"
                  />
                  <rect
                    x="55"
                    y="146"
                    width="15"
                    height="15"
                    rx="7.5"
                    fill="#009DFF"
                  />
                  <rect
                    x="82"
                    y="146"
                    width="15"
                    height="15"
                    rx="7.5"
                    fill="#009DFF"
                  />
                  <rect
                    x="109"
                    y="146"
                    width="15"
                    height="15"
                    rx="7.5"
                    fill="#009DFF"
                  />
                  <path
                    d="M89.9922 79.5C90.032 79.5008 90.071 79.5091 90.1074 79.5234L90.1836 79.5527L90.2646 79.5576C93.0299 79.7018 95.2273 81.902 95.2275 84.5996V86.7002H97.3633C98.0018 86.7002 98.4999 87.2026 98.5 87.7998V97.4004C98.4998 97.9975 98.0017 98.5 97.3633 98.5H82.6367C81.9983 98.5 81.5002 97.9975 81.5 97.4004V87.7998C81.5001 87.2026 81.9982 86.7002 82.6367 86.7002H84.7725V84.5996C84.7727 81.8055 87.1079 79.5041 89.9922 79.5ZM90 80.0996C87.4653 80.0996 85.4094 82.0942 85.4092 84.5996V86.7002H94.5908V84.5996C94.5906 82.0942 92.5347 80.0996 90 80.0996Z"
                    fill="white"
                    stroke="white"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {t("initChatPage.welcome")}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm mb-6">
                {t("initChatPage.choose")}
              </p>
              <button
                onClick={() => setShowCreateChat(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm">
                {t("common.newMessage")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation*/}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 px-4 py-2 min-w-scren">
        <div className="flex justify-around items-center">
          <button
            onClick={() => {
              setActiveSection("chats");
              setSelectedChatId(null);
            }}
            className={`relative flex flex-col items-center px-4 py-2 ${
              activeSection === "chats" ? "text-blue-500" : "text-gray-500"
            }`}>
            <MessageCircle className="w-6 h-6 mb-1" />
            <span className="text-xs">{t("mobileNav.chats")}</span>
            {chats.reduce((total, chat) => total + chat.unreadCount, 0) > 0 && (
              <div className="absolute top-0 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-xs text-white font-medium">
                  {chats.reduce((total, chat) => total + chat.unreadCount, 0)}
                </span>
              </div>
            )}
          </button>

          <button
            onClick={() => {
              setActiveSection("users");
              setSelectedChatId(null);
            }}
            className={`flex flex-col items-center px-4 py-2 ${
              activeSection === "users" ? "text-blue-500" : "text-gray-500"
            }`}>
            <Users className="w-6 h-6 mb-1" />
            <span className="text-xs">{t("mobileNav.contacts")}</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex flex-col items-center px-4 py-2 text-gray-500">
            <LogOut className="w-6 h-6 mb-1" />
            <span className="text-xs">{t("mobileNav.logout")}</span>
          </button>
        </div>
      </div>

      {/* Create Chat Modal */}
      {showCreateChat && (
        <div className="fixed inset-0 bg-black dark:bg-gray-950 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-700 rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-medium text-gray-900 text-white mb-4">
              {t("common.newMessage")}
            </h3>

            <div className="space-y-4">
              {/* DROPDOWN
              <select
                value={newChatUserId}
                onChange={(e) => setNewChatUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="">Kontakt auswählen...</option>
                {users.map(user => (
                  <option key={user.userId || user.id} value={user.userId || user.id}>
                    {user.username || user.name}
                  </option>
                ))}
              </select>
              */}

              {/* Temporärer Input für Testing */}

              <input
                type="text"
                placeholder={t("modals.userId")}
                value={newChatUserId}
                onChange={(e) => setNewChatUserId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />

              {/* TTL Preset Auswahl */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  🕐 {t("modals.createChat.setTtl")}
                </label>

                <div>
                  <label
                    htmlFor="minTTL"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t("common.min")}:
                  </label>

                  <select
                    id="minTTL"
                    value={selectedMinTTL}
                    onChange={(e) =>
                      setSelectedMinTTL(parseInt(e.target.value))
                    }
                    className="w-full px-3 py-2 bg-white border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 mt-1">
                    {DROPDOWN_TTL_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.text}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="maxTTL"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t("common.max")}:
                  </label>

                  <select
                    id="maxTTL"
                    value={selectedMaxTTL}
                    onChange={(e) =>
                      setSelectedMaxTTL(parseInt(e.target.value))
                    }
                    className="w-full px-3 py-2 bg-white border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 mt-1">
                    {DROPDOWN_TTL_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.text}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="defaultTTL"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t("common.standard")}:
                  </label>

                  <select
                    id="defaultTTL"
                    value={selectedDefaultTTL}
                    onChange={(e) =>
                      setSelectedDefaultTTL(parseInt(e.target.value))
                    }
                    className="w-full px-3 py-2 bg-white border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 mt-1">
                    {DROPDOWN_TTL_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.text}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleCreateChat}
                  disabled={!newChatUserId}
                  className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-500 dark:disabled:text-gray-700 transition-colors text-sm">
                  {t("modals.createChat.startChat")}
                </button>
                <button
                  onClick={() => {
                    setShowCreateChat(false);
                    setNewChatUserId("");
                  }}
                  className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-red-500 transition-colors text-sm">
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Languages Modal*/}
      {showLanguages && (
        <div className="fixed inset-0 bg-black dark:bg-gray-950 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 text-center rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              {t("modals.languageSelect.title")}
            </h3>
            <div className="space-y-4">
              {Object.keys(lngs).map((lng) => (
                <button
                  key={lng}
                  className={`inline-flex items-center justify-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-md ${
                    i18n.resolvedLanguage === lng ? "font-bold" : "font-normal"
                  }`}
                  type="button"
                  onClick={() => {
                    i18n.changeLanguage(lng);
                    setShowLanguages(false);
                  }}>
                  {lngs[lng].nativeName}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal*/}
      {showSettings && (
        <div className="fixed inset-0 bg-black dark:bg-gray-950 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              {t("modals.settings.title")}
            </h3>

            <div className="space-y-4">
              <div className="text-sm">
                <div className="text-gray-500 dark:text-gray-400">
                  {t("modals.settings.user")}
                </div>
                <div className="font-medium dark:text-white">
                  {currentUser?.username}
                </div>
              </div>
              <div className="text-sm">
                <div className="text-gray-500 dark:text-gray-400">
                  {t("modals.settings.yourId")}
                </div>
                <div className="font-mono text-xs bg-gray-100 dark:bg-gray-700 dark:text-white p-2 rounded border break-all">
                  {currentUser?.userId}
                </div>
                {currentUser?.isAnonymous && (
                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    {t("modals.settings.shareId")}
                  </div>
                )}
              </div>
              <div className="text-sm">
                <div className="text-gray-500 dark:text-gray-400">
                  {t("modals.settings.status")}
                </div>
                <div className="font-medium dark:text-white">
                  {currentUser?.isAnonymous
                    ? t("modals.settings.anonymous")
                    : t("modals.settings.registered")}
                </div>
              </div>

              {/* Teilnehmer-Liste mit Entfernen-Buttons */}
              <div className="text-sm font-medium dark:text-gray-400">
                {t("menus.manageUsers.users")}
              </div>
              {selectedChat?.chatUserList ? (
                Object.entries(selectedChat.chatUserList).map(
                  ([userId, username]) => (
                    <div
                      key={userId}
                      className="flex items-center dark:text-white justify-between">
                      <span>
                        {username}
                        {userId === currentUser?.userId &&
                          ` (${t("common.you")})`}
                      </span>
                      {userId !== currentUser?.userId && (
                        <button
                          onClick={() =>
                            removeUserFromChat(
                              selectedChatId!,
                              userId,
                              currentUser!.userId,
                              currentUser!.token
                            )
                          }
                          className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs">
                          {t("menus.manageUsers.removeUser")}
                        </button>
                      )}
                    </div>
                  )
                )
              ) : (
                <div className="text-gray-500 dark:text-white italic">
                  {t("menus.manageUsers.noUser")}
                </div>
              )}
              <div className="text-sm font-medium dark:text-gray-400">
                {t("common.language")}
              </div>
              <div className="font-medium dark:text-white">
                {lngs[i18n.resolvedLanguage].nativeName}
              </div>
              <button
                onClick={() => {
                  setShowSettings(false);
                  setShowLanguages(true);
                }}
                className="w-full bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 py-4 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-950 transition-all duration-200 text-xs">
                {t("modals.languageSelect.changeLanguage")}
              </button>
              <div className="text-sm font-medium dark:text-gray-400">
                {t("modals.darkMode.theme")}
              </div>
              <div className="relative bg-gray-100 dark:bg-gray-700 rounded-xl p-1 mb-6">
                <div className="flex relative">
                  <div
                    className={`absolute top-1 bottom-1 w-1/2 bg-white dark:bg-gray-900 rounded-lg shadow-sm transition-transform duration-300 ease-out ${
                      isDarkMode === false ? "transform translate-x-full" : ""
                    }`}
                  />

                  <button
                    onClick={() => toggleDarkMode()}
                    className={`flex-1 py-3 text-center font-medium transition-colors duration-300 relative z-10 ${
                      isDarkMode === false
                        ? "text-gray-900 dark:text-gray-100"
                        : "text-gray-500 dark:text-gray-400"
                    }`}>
                    {t("modals.darkMode.dark")}
                  </button>
                  <button
                    onClick={() => toggleDarkMode()}
                    className={`flex-1 py-3 text-center font-medium transition-colors duration-300 relative z-10 ${
                      isDarkMode === true
                        ? "text-gray-900 dark:text-gray-100"
                        : "text-gray-500 dark:text-gray-400"
                    }`}>
                    {t("modals.darkMode.light")}
                  </button>
                </div>
              </div>

              <button
                onClick={() => setShowSettings(false)}
                className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors text-sm">
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              👤 {t("modals.addUser.title")}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t("modals.userId")}
                </label>
                <input
                  type="text"
                  placeholder="z.B. user123..."
                  value={newChatUserId}
                  onChange={(e) => setNewChatUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 mt-1"
                  autoFocus
                />
                <div className="text-xs text-gray-500 mt-1">
                  {t("modals.addUser.info")}
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleAddUserToChat}
                  disabled={!newChatUserId.trim()}
                  className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 transition-colors text-sm">
                  {t("menus.manageUsers.addUser")}
                </button>
                <button
                  onClick={() => {
                    setShowAddUser(false);
                    setNewChatUserId("");
                  }}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm">
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnocmUI;
