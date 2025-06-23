import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MessageCircle, Users, Menu, Edit, Send, Settings, Plus, LogOut, UserPlus, ArrowLeft } from 'lucide-react';
import { DatabaseResponse, User, Chat, ChatMessage } from '@anocm/shared/dist';
import type { WsMessage } from '@anocm/shared/dist';

const API_V1 = 'http://localhost:8080/api/v1';
const API_V2 = 'http://localhost:8080/api/v2';
const WS_URL = 'ws://localhost:8080';

enum Action {
  None = "",
  BroadcastToChat = "BroadcastToChat",
  Init = "Init", 
  MessageResponse = "MessageResponse",
}

type UIMessage = ChatMessage & {
  id: string; 
  timestamp: Date;  
  isOwn: boolean;   
};

const AnocmUI = () => {

  const wsRef = useRef<WebSocket | null>(null);
  const [wsActive, setWsActive] = useState(false);

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState<string | null>(null);

  // UI States
  const [activeSection, setActiveSection] = useState<'chats' | 'users'>('chats');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [messageInput, setMessageInput] = useState('');
  
  // Modal States
  const [showCreateChat, setShowCreateChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newChatUserId, setNewChatUserId] = useState('');

  // Data States
  const [chats, setChats] = useState<Chat[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<UIMessage[]>([]);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Helper Functions
  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'jetzt';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
    return `${Math.floor(diffMins / 1440)}d`;
  };

  const getInitials = (name: string): string => {
    if (!name || name.length === 0) {
      return '??';
    }
    
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string, isAnonymous: boolean) => {
    if (isAnonymous) {
      return 'bg-purple-500';
    }
    
    // Fallback falls name undefined/null/leer ist
    if (!name || name.length === 0) {
      return 'bg-gray-500';
    }
    
    const colors = [
      'bg-blue-500',
      'bg-green-500', 
      'bg-orange-500',
      'bg-red-500',
      'bg-purple-500',
      'bg-teal-500',
      'bg-pink-500',
      'bg-indigo-500'
    ];
    
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  //API Functions
  const removeUserFromChat = async (chatId: string, userId: string, adminId: string, adminToken: string) => {
    try {
      const res = await fetch(`${API_V2}/chat/remuser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, userId, adminId, adminToken }),
      });
      const data = await res.json() as DatabaseResponse;
      return data.success ? { success: true } : { success: false, error: data.error };
    } catch (err) {
      console.error('Fehler beim Entfernen:', err);
      return { success: false, error: 'Netzwerkfehler' };
    }
  };
    

    const getChatMessages = async (chatId: string, userId: string, token: string): Promise<UIMessage[]> => {
      try {
        const res = await fetch(`${API_V2}/chat/getchat?chatid=${chatId}&userid=${userId}&token=${token}`);
        const data = await res.json() as DatabaseResponse & { userData?: { chatMessages: Record<string, any> } };
        if (data.success && data.userData?.chatMessages) {
          return Object.entries(data.userData.chatMessages)
            .map(([ts, entry]) => {
              const msg = typeof entry === 'string' ? JSON.parse(entry) : entry;
              return {
                id: msg.id ?? `msg-${ts}`,
                content: msg.content,
                senderId: msg.senderID,
                isOwn: msg.senderID === userId,
                timestamp: new Date(Number(msg.timestamp)),
              } as UIMessage;
            });
        }
        return [];
      } catch (err) {
        console.error('Fehler beim Laden der Nachrichten:', err);
        return [];
      }
    };

    const refreshChats = async () => {
      if (!currentUser) {
        // Es gibt keinen angemeldeten Nutzer, deshalb keine Chats laden
        return;
      }
    
      try {
       
        const url = `${API_V2}/chat/getChatList?userId=${encodeURIComponent(currentUser.userId)}&token=${encodeURIComponent(currentUser.token)}`;
    
       
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
    
    
        if (!res.ok) {
          console.error(`Chat-API Fehler: ${res.status}`);
          setChats([]);
          return;
        }
    
        // JSON-Antwort auslesen
        const data = await res.json() as {
          success: boolean;
          userData?: string[] | string;
          error?: string;
        };
        console.log('API Response:', data);
    
        // Wenn success false leere Liste anzeigen
        if (!data.success) {
          setChats([]);
          return;
        }
    
        
        const chatIds: string[] = typeof data.userData === 'string'
          ? JSON.parse(data.userData)
          : data.userData ?? [];
    
        // für jede Chat-ID ein Chat-Objekt
        const chatList: Chat[] = chatIds.map(id => ({
          chatId: id,
          name: `Chat ${id.slice(0, 8)}...`,
          chatUserList: {},
          messages: [],
          lastMessage: null,
          unreadCount: 0,
        }));
    
        // State aktualisieren
        setChats(chatList);
      } catch (err) {
        console.error('Fehler beim Laden der Chats:', err);
        setChats([]);
      }
    };
    
    
    

    const fetchUsers = async (): Promise<User[]> => {
      try {
        const res = await fetch(`${API_V2}/user/getUsers`);
        const data = await res.json() as DatabaseResponse;
        if (data.success && Array.isArray(data.userData)) {
          return data.userData as User[];
        }
        return [];
      } catch (err) {
        console.error('Netzwerkfehler beim Laden der User:', err);
        return [];
      }
    };

    const createAnonymousUser = async (): Promise<{ success: boolean; userId?: string; error?: string }> => {
      try {
        const res = await fetch(`${API_V2}/user/newano`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json() as DatabaseResponse;
        
        if (data.success) {
          return { success: true, userId: data.id }; // Das ist die clientId zum Einloggen
        } else {
          return { success: false, error: data.error };
        }
      } catch (err) {
        console.error('Netzwerkfehler:', err);
        return { success: false, error: 'Netzwerkfehler' };
      }
     };
  
    const loginUser = async (username: string, password: string): Promise<{ success: boolean; userId?: string; token?: string; error?: string }> => {
      try {
        const res = await fetch(`${API_V2}/user/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userId_username: username, 
            ...(password && { password }) 
          }),
        });
        const data = await res.json() as DatabaseResponse;
        console.log('Login Response:', data);
        if (data.success) {
          // v2 liefert entweder [userId, token] oder [token]
          if (Array.isArray(data.userData) && data.userData.length >= 2) {
            return { success: true, userId: data.userData[0], token: data.userData[1] };
          } else if (typeof data.userData === 'string') {
            return { success: true, userId: data.id, token: data.userData };
          } else {
            return { success: false, error: 'Unerwartetes Antwortformat' };
          }
        } else {
          return { success: false, error: data.error };
        }
      } catch (err) {
        console.error('Netzwerkfehler:', err);
        return { success: false, error: 'Netzwerkfehler' };
      }
    };

    const registerUser = async (username: string, password: string): Promise<{ success: boolean; userId?: string; error?: string }> => {
      try {
        const res = await fetch(`${API_V2}/user/newuser`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json() as DatabaseResponse;
        if (data.success) {
          return { success: true, userId: data.id };
        } else {
          return { success: false, error: data.error };
        }
      } catch (err) {
        console.error('Netzwerkfehler:', err);
        return { success: false, error: 'Netzwerkfehler' };
      }
    };

      const sendMessage = async (chatId: string, content: string, senderId: string, token: string) => {
        try {
          const res = await fetch(`${API_V2}/chat/send_message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatID: chatId, senderID: senderId, senderToken: token, content, timestamp: Date.now().toString(), ttl: 86400 }),
          });
          const data = await res.json() as DatabaseResponse;
          return data.success ? { success: true } : { success: false, error: data.error };
        } catch (err) {
          console.error('Fehler beim Senden:', err);
          return { success: false, error: 'Netzwerkfehler' };
        }
      };
  
  // Event Handlers
  const handleLogin = async (asAnonymous = false) => {
    console.log('Login startet...');
    setAuthError(null);
    
    if (asAnonymous) {
      const result = await createAnonymousUser();
      
      if(result.success) {
        setAuthError(null);
        setSuccessMessage(`Account erstellt! Login-ID: ${result.userId} - Jetzt einloggen (ohne Passwort)`);
      } else {
        setAuthError('Anonymous User-Erstellung fehlgeschlagen: ' + result.error);
      }
    } 
    else {
      if (!loginForm.username) return; // Nur Username erforderlich
      
      const result = await loginUser(loginForm.username, loginForm.password);
  
      if(result.success) {
        const newUser = {
          userId: result.userId!,
          username: loginForm.username,
          isOnline: true,
          isAnonymous: !loginForm.password, // Anonym wenn kein Passwort
          token: result.token!
        };
        
        console.log('🔄 Setze beide States gleichzeitig...');
        
        setCurrentUser(newUser);
        setIsAuthenticated(true);
      } else {
        console.error('Login fehlgeschlagen:', result.error);
        setAuthError('Login fehlgeschlagen: ' + result.error);
      }
    }
  };

  const handleRegister = async () => {
    setAuthError(null);
  
    if(!loginForm.username || !loginForm.password){
      setAuthError('Bitte Benutzername und Passwort eingeben');
      return;
    }
    
    const result = await registerUser(loginForm.username, loginForm.password);
    if(!result.success){
      setAuthError('Registrierung fehlgeschlagen: ' + result.error);
      return;
    }
    
    const loginResult = await loginUser(loginForm.username, loginForm.password);
    if(loginResult.success){
      const newUser = {
        userId: loginResult.userId,
        username: loginResult.username,
        isOnline: true,
        isAnonymous: false,
        token: loginResult.token
      };
    
      setCurrentUser(newUser);
      setIsAuthenticated(true);
      
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setSelectedChatId(null);
    setChats([]);
    setMessages([]);
    setLoginForm({ username: '', password: '' });
  };

  const handleSendMessage = async () => {
    
    if(!messageInput.trim() || !selectedChatId || !currentUser){
      return;
    }

    const result = await sendMessage(selectedChatId, messageInput, currentUser.userId, currentUser.token);

    if(result.success){
      setMessageInput('');
      console.log('Nachricht gesendet');
    }
    else {
      console.error('Fehler beim Senden:', result.error);
    }

  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if(e.key === 'Enter' && !e.shiftKey)
    {
      e.preventDefault();

      handleSendMessage();
    }

  }

  const handleCreateChat = async () => {
    if (!newChatUserId || !currentUser) return;

    try {
    
      const res = await fetch(`${API_V2}/chat/newchat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userList: [
            { userId: currentUser.userId },
            { userId: newChatUserId }
          ],
          ttl: "86400", // 1 Tag
          minTTL: "60",    
          maxTTL: "345600", // 7 Tage
          creatorId: currentUser.userId,
          creatorToken: currentUser.token
        }),
      });
      const data = await res.json() as DatabaseResponse;

      if (data.success) {
        console.log("Chat erfolgreich erstellt:", data.id);
      
        //lokal in  State einfügen
        const newChat: Chat = {
          chatId: data.id,
          name: `Chat ${data.id.slice(0, 8)}...`,
          chatUserList: {
            [currentUser!.userId]: currentUser!.username || 'Anonym',
            [newChatUserId]: users.find(u => u.userId === newChatUserId)?.username
                             || `User ${newChatUserId.slice(0,8)}`
          },
          messages: [],
          lastMessage: null,
          unreadCount: 0,
        };
        setChats(prev => [newChat, ...prev]);
      
        //Modal schließen und chat öffnen
        setShowCreateChat(false);
        setSelectedChatId(data.id);
        setNewChatUserId('');
      
        await refreshChats();
      
      } else {
        console.error("Fehler beim Erstellen des Chats:", data.error);
        setAuthError(`Fehler beim Erstellen des Chats: ${data.error}`);
      }
    } catch (err) {
      console.error("Netzwerkfehler beim Erstellen des Chats:", err);
      setAuthError("Netzwerkfehler beim Erstellen des Chats");
    }
  };

  const loadChatList = async () => {
    if (!userId || !token) return;
    try {
      const url = `${API_BASE}/chat/getChatList?userId=${userId}&token=${token}`;
      const res = await fetch(url, { method: 'GET' });
      const data: DatabaseResponse = await res.json();
  
      if (data.success && Array.isArray(data.userData)) {
        setChatList(data.userData as UUID[]);
        setStatus(`Loaded ${data.userData.length} chats`);
      } else {
        throw new Error(data.error || 'Failed to load chat list');
      }
    } catch (e: any) {
      setError(`Load chat list error: ${e.message || e}`);
    }
  };

  useEffect(() => {
    // nur wenn eingeloggt
    if (!isAuthenticated || !currentUser?.userId) {
      return;
    }
  
    console.log('WebSocket-Setup für User:', currentUser.userId);
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
      };
      ws.send(JSON.stringify(initMsg));
      setTimeout(() => {
        console.log('Auto-refresh Chats nach WebSocket-Verbindung');
        refreshChats();
      }, 500);
    };
  
    ws.onmessage = (event) => {
      
      try {
        const data: WsMessage = JSON.parse(event.data);
        console.log("[WS] Parsed message:", data);
  
        if (data.action === Action.BroadcastToChat) {
          const contentText =
            typeof data.content === "string"
              ? data.content
              : JSON.stringify(data.content);
  
          const newMessage: UIMessage = {
            id: `msg-${Date.now()}`,
            content: contentText,
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
        console.log('📥 Lade Nachrichten für Chat:', selectedChatId);
        const chatMessages = await getChatMessages(selectedChatId, currentUser.userId, currentUser.token);
        chatMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        setMessages(chatMessages);
      } else {
        setMessages([]);
      }
    };
  
  loadMessages();
}, [selectedChatId, currentUser]);

  // Filtered Data
  const selectedChat = chats.find(chat => chat.chatId === selectedChatId);
  const filteredChats = chats.filter(chat =>
    chat.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.lastMessage?.content?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredUsers = users.filter(user =>
    user.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen min-w-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-sm w-full space-y-6">
          <div className="text-center mb-8">
            <div className="w-32 h-32 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="180" height="180" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 64C0 41.5979 0 30.3968 4.35974 21.8404C8.19467 14.3139 14.3139 8.19467 21.8404 4.35974C30.3968 0 41.5979 0 64 0H116C138.402 0 149.603 0 158.16 4.35974C165.686 8.19467 171.805 14.3139 175.64 21.8404C180 30.3968 180 41.5979 180 64V116C180 138.402 180 149.603 175.64 158.16C171.805 165.686 165.686 171.805 158.16 175.64C149.603 180 138.402 180 116 180H64C41.5979 180 30.3968 180 21.8404 175.64C14.3139 171.805 8.19467 165.686 4.35974 158.16C0 149.603 0 138.402 0 116V64Z" fill="#323232"/>
                <path d="M30.9081 44L40.8081 22.85H45.1581L55.0581 44H49.5381L47.0481 38.18L49.1481 39.71H36.7881L38.9181 38.18L36.4281 44H30.9081ZM42.9381 28.61L39.4581 36.92L38.6181 35.48H47.3481L46.5081 36.92L42.9981 28.61H42.9381ZM56.3389 44V22.85H60.3889L70.9489 36.02H70.1089V22.85H75.2089V44H71.1889L60.6289 30.8H61.4689V44H56.3389ZM89.2733 44.33C87.6733 44.33 86.2133 44.07 84.8933 43.55C83.5733 43.03 82.4333 42.29 81.4733 41.33C80.5333 40.35 79.8033 39.19 79.2833 37.85C78.7833 36.51 78.5333 35.03 78.5333 33.41C78.5333 31.77 78.7833 30.28 79.2833 28.94C79.8033 27.6 80.5333 26.45 81.4733 25.49C82.4333 24.53 83.5733 23.8 84.8933 23.3C86.2133 22.78 87.6733 22.52 89.2733 22.52C90.8733 22.52 92.3333 22.78 93.6533 23.3C94.9733 23.8 96.1033 24.53 97.0433 25.49C98.0033 26.45 98.7333 27.6 99.2333 28.94C99.7533 30.26 100.013 31.74 100.013 33.38C100.013 35.04 99.7533 36.54 99.2333 37.88C98.7333 39.22 98.0033 40.38 97.0433 41.36C96.1033 42.32 94.9733 43.06 93.6533 43.58C92.3333 44.08 90.8733 44.33 89.2733 44.33ZM89.2733 39.71C90.3333 39.71 91.2333 39.46 91.9733 38.96C92.7133 38.46 93.2833 37.74 93.6833 36.8C94.0833 35.86 94.2833 34.73 94.2833 33.41C94.2833 32.09 94.0833 30.96 93.6833 30.02C93.3033 29.08 92.7333 28.37 91.9733 27.89C91.2333 27.39 90.3333 27.14 89.2733 27.14C88.2333 27.14 87.3333 27.39 86.5733 27.89C85.8333 28.37 85.2633 29.08 84.8633 30.02C84.4633 30.96 84.2633 32.09 84.2633 33.41C84.2633 34.73 84.4533 35.86 84.8333 36.8C85.2333 37.74 85.8133 38.46 86.5733 38.96C87.3333 39.46 88.2333 39.71 89.2733 39.71Z" fill="white"/>
                <path d="M113.953 44.33C111.613 44.33 109.603 43.88 107.923 42.98C106.243 42.08 104.953 40.81 104.053 39.17C103.173 37.53 102.733 35.61 102.733 33.41C102.733 31.21 103.173 29.3 104.053 27.68C104.953 26.04 106.243 24.77 107.923 23.87C109.603 22.97 111.613 22.52 113.953 22.52C115.353 22.52 116.703 22.73 118.003 23.15C119.303 23.57 120.353 24.14 121.153 24.86L119.503 29.21C118.623 28.57 117.743 28.1 116.863 27.8C115.983 27.48 115.083 27.32 114.163 27.32C112.303 27.32 110.903 27.85 109.963 28.91C109.023 29.95 108.553 31.45 108.553 33.41C108.553 35.39 109.023 36.91 109.963 37.97C110.903 39.01 112.303 39.53 114.163 39.53C115.083 39.53 115.983 39.38 116.863 39.08C117.743 38.76 118.623 38.28 119.503 37.64L121.153 41.99C120.353 42.69 119.303 43.26 118.003 43.7C116.703 44.12 115.353 44.33 113.953 44.33ZM123.928 44V22.85H128.518L135.808 35.9H134.758L142.018 22.85H146.488V44H141.508V31.43H142.138L136.678 40.88H133.678L128.218 31.4H128.908V44H123.928Z" fill="#009DFF"/>
                <path d="M67.1605 127C63.7998 127 62.7557 124.176 64.485 121.904C65.9533 119.989 68.694 116.159 70.1623 113.335C59.8519 108.596 53 99.1508 53 88.5045C53 72.178 69.4444 59 90 59C110.556 59 127 72.178 127 88.5045C127 105.513 109.936 118.496 87.194 117.879C80.5705 122.586 71.5653 127 67.1605 127ZM70.5864 121.612C73.5556 120.411 79.3633 116.841 83.3765 113.952C84.6164 112.978 85.6605 112.556 87.0309 112.556C88.336 112.589 89.3474 112.621 90 112.621C107.619 112.621 121.616 101.78 121.616 88.5045C121.616 75.1967 107.619 64.3556 90 64.3556C72.4136 64.3556 58.4162 75.1967 58.4162 88.5045C58.4162 97.1384 64.2892 104.701 74.5344 109.44C76.6226 110.414 76.851 111.907 75.9374 113.595C74.828 115.672 72.2178 119.048 70.3907 121.287C70.2275 121.515 70.3254 121.709 70.5864 121.612Z" fill="white"/>
                <rect x="55" y="146" width="15" height="15" rx="7.5" fill="#009DFF"/>
                <rect x="82" y="146" width="15" height="15" rx="7.5" fill="#009DFF"/>
                <rect x="109" y="146" width="15" height="15" rx="7.5" fill="#009DFF"/>
                <path d="M89.9922 79.5C90.032 79.5008 90.071 79.5091 90.1074 79.5234L90.1836 79.5527L90.2646 79.5576C93.0299 79.7018 95.2273 81.902 95.2275 84.5996V86.7002H97.3633C98.0018 86.7002 98.4999 87.2026 98.5 87.7998V97.4004C98.4998 97.9975 98.0017 98.5 97.3633 98.5H82.6367C81.9983 98.5 81.5002 97.9975 81.5 97.4004V87.7998C81.5001 87.2026 81.9982 86.7002 82.6367 86.7002H84.7725V84.5996C84.7727 81.8055 87.1079 79.5041 89.9922 79.5ZM90 80.0996C87.4653 80.0996 85.4094 82.0942 85.4092 84.5996V86.7002H94.5908V84.5996C94.5906 82.0942 92.5347 80.0996 90 80.0996Z" fill="white" stroke="white"/>
            </svg>
            </div>
            <p className="text-gray-500">Anonymous Chat Messenger</p>
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
<div className="relative bg-gray-100 rounded-xl p-1 mb-6">
  <div className="flex relative">
    <div 
      className={`absolute top-1 bottom-1 w-1/2 bg-white rounded-lg shadow-sm transition-transform duration-300 ease-out ${
        authMode === 'register' ? 'transform translate-x-full' : ''
      }`}
    />
    
    <button
      onClick={() => setAuthMode('login')}
      className={`flex-1 py-3 text-center font-medium transition-colors duration-300 relative z-10 ${
        authMode === 'login' ? 'text-gray-900' : 'text-gray-500'
      }`}
    >
      Anmelden
    </button>
    <button
      onClick={() => setAuthMode('register')}
      className={`flex-1 py-3 text-center font-medium transition-colors duration-300 relative z-10 ${
        authMode === 'register' ? 'text-gray-900' : 'text-gray-500'
      }`}
    >
      Registrieren
    </button>

  </div>
</div>

{/* INPUT-FELDER */}
<div className="space-y-4">
  <input
    type="text"
    placeholder="Benutzername"
    value={loginForm.username}
    onChange={e => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
    className="w-full px-4 py-4 bg-gray-50 border-0 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200"
  />
  
  <input
    type="password"
    placeholder="Passwort"
    value={loginForm.password}
    onChange={e => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
    className="w-full px-4 py-4 bg-gray-50 border-0 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200"
  />

  <button
    onClick={() => authMode === 'login' ? handleLogin(false) : handleRegister()}
    disabled={!loginForm.username}
    className="w-full bg-blue-500 text-white py-4 rounded-xl font-semibold disabled:bg-gray-300 transition-all duration-200 hover:bg-blue-600"
  >
    {authMode === 'login' ? 'Anmelden' : 'Registrieren'}
  </button>
</div>

<div className="text-center">
  <span className="text-gray-400 text-sm">oder</span>
</div>

<button
  onClick={() => handleLogin(true)}
  className="w-full bg-white border-2 border-gray-200 text-gray-700 py-4 rounded-xl font-semibold hover:bg-gray-50 transition-all duration-200"
>
  Anonym fortfahren
</button>
        </div>
      </div>
    );
  }

  // Main Chat Interface
  return (
    <div className="flex h-screen w-screen bg-white">
      {/* Desktop Sidebar*/}
      <div className="hidden md:flex w-16 bg-white border-r border-gray-200 flex-col items-center py-4 space-y-2">
        
        <button
          onClick={() => setActiveSection('chats')}
          className={`p-3 rounded-full transition-colors ${
            activeSection === 'chats'
              ? 'bg-blue-500 text-white'
              : 'hover:bg-gray-100 text-gray-500'
          }`}
        >
          <MessageCircle className="w-5 h-5" />
        </button>
        
        <button
          onClick={() => setActiveSection('users')}
          className={`p-3 rounded-full transition-colors ${
            activeSection === 'users'
              ? 'bg-blue-500 text-white'
              : 'hover:bg-gray-100 text-gray-500'
          }`}
        >
          <Users className="w-5 h-5" />
        </button>

        <div className="flex-1" />

        <button
          onClick={() => setShowSettings(true)}
          className="p-3 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>

        <button
          onClick={handleLogout}
          className="p-3 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Chat/Users List */}
      <div className={`${selectedChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80 bg-white border-r border-gray-200 flex-col pb-16 md:pb-0`}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">
              {activeSection === 'chats' ? 'Anocm' : 'Kontakte'}
            </h1>
            <div className="flex items-center space-x-1">
              <button 
                onClick={() => setShowCreateChat(true)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="Neuen Chat erstellen"
              >
                <Edit className="w-5 h-5 text-gray-600" />
              </button>
              
              {/* Refresh Button */}
              <button 
                onClick={() => {
                  console.log('🔄 Lade Chats manuell neu...');
                  refreshChats();
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="Chats aktualisieren"
              >
                🔄
              </button>
              
              <button
                onClick={() => setShowSettings(true)}
                className="md:hidden p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <Settings className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-2 bg-white border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Suchen"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-100 border-0 rounded-full focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto bg-white">
          {activeSection === 'chats' ? (
            <>
              {filteredChats.length > 0 ? (
                filteredChats.map((chat, index) => (
                  <div
                    key={chat.chatId}
                    onClick={() => setSelectedChatId(chat.chatId)}
                    className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedChatId === chat.chatId ? 'bg-blue-50' : ''
                    } ${index > 0 ? 'border-t border-gray-100' : ''}`}
                  >
                    <div className="flex items-center space-x-3">
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm ${getAvatarColor(chat.name, chat.isAnonymous)}`}>
                        {getInitials(chat.name)}
                      </div>

                      {/* Chat Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-sm font-medium text-gray-900 truncate">
                            {chat.name}
                          </h3>
                          <span className="text-xs text-gray-500">
                            {chat.lastMessage ? formatTimestamp(chat.lastMessage.timestamp) : ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-600 truncate">
                            {chat.lastMessage?.content || 'Keine Nachrichten'}
                          </p>
                          {chat.unreadCount > 0 && (
                            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 text-xs font-medium text-white bg-blue-500 rounded-full ml-2">
                              {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <p>{searchTerm ? 'Keine Chats gefunden' : 'Keine Chats'}</p>
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
                    className={`px-4 py-3 hover:bg-gray-50 transition-colors ${index > 0 ? 'border-t border-gray-100' : ''}`}
                  >
                    <div className="flex items-center space-x-3">
                      {/* Avatar */}
                      <div className="relative">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm ${getAvatarColor(user.name, user.isAnonymous)}`}>
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
                          {user.isOnline ? 'Online' : 'Zuletzt aktiv vor kurzem'}
                        </p>
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={() => {
                          setNewChatUserId(user.userId);
                          setShowCreateChat(true);
                        }}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                      >
                        <MessageCircle className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <p>{searchTerm ? 'Keine Kontakte gefunden' : 'Keine Kontakte'}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Chat Area*/}
      <div className={`${selectedChatId ? 'flex' : 'hidden md:flex'} flex-1 flex-col pb-16 md:pb-0`}>
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="px-4 py-3 bg-white border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setSelectedChatId(null)}
                  className="md:hidden p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm ${getAvatarColor(selectedChat.name, selectedChat.isAnonymous)}`}>
                  {getInitials(selectedChat.name)}
                </div>
                <div>
                  <h2 className="text-sm font-medium text-gray-900">
                    {selectedChat.name}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {selectedChat.isAnonymous ? 'Anonymer Chat' : 'Zuletzt aktiv vor kurzem'}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              <div className="space-y-2">
                {messages?.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs px-3 py-2 rounded-2xl text-sm ${
                        message.senderId === 'system'
                          ? 'bg-gray-200 text-gray-600 text-center mx-auto'
                          : message.isOwn
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-gray-900 border'
                      }`}
                    >
                      <div>{message.content}</div>
                      <div className={`text-xs mt-1 ${
                        message.isOwn ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {formatTimestamp(message.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 px-4 py-4">
              <div className="flex  align-items-center space-x-2">
                <div className="flex-1">
                  <textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="send"
                    className="w-full px-3 py-2 border border-gray-300 rounded-full resize-none focus:outline-none focus:border-blue-500 text-sm"
                    rows={1}
                    style={{ minHeight: '36px', maxHeight: '100px' }}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="h-[100%]" />
                </button>
              </div>
            </div>
          </>
        ) : (
          // Empty State
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center max-w-sm">
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="180" height="180" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 64C0 41.5979 0 30.3968 4.35974 21.8404C8.19467 14.3139 14.3139 8.19467 21.8404 4.35974C30.3968 0 41.5979 0 64 0H116C138.402 0 149.603 0 158.16 4.35974C165.686 8.19467 171.805 14.3139 175.64 21.8404C180 30.3968 180 41.5979 180 64V116C180 138.402 180 149.603 175.64 158.16C171.805 165.686 165.686 171.805 158.16 175.64C149.603 180 138.402 180 116 180H64C41.5979 180 30.3968 180 21.8404 175.64C14.3139 171.805 8.19467 165.686 4.35974 158.16C0 149.603 0 138.402 0 116V64Z" fill="#323232"/>
                <path d="M30.9081 44L40.8081 22.85H45.1581L55.0581 44H49.5381L47.0481 38.18L49.1481 39.71H36.7881L38.9181 38.18L36.4281 44H30.9081ZM42.9381 28.61L39.4581 36.92L38.6181 35.48H47.3481L46.5081 36.92L42.9981 28.61H42.9381ZM56.3389 44V22.85H60.3889L70.9489 36.02H70.1089V22.85H75.2089V44H71.1889L60.6289 30.8H61.4689V44H56.3389ZM89.2733 44.33C87.6733 44.33 86.2133 44.07 84.8933 43.55C83.5733 43.03 82.4333 42.29 81.4733 41.33C80.5333 40.35 79.8033 39.19 79.2833 37.85C78.7833 36.51 78.5333 35.03 78.5333 33.41C78.5333 31.77 78.7833 30.28 79.2833 28.94C79.8033 27.6 80.5333 26.45 81.4733 25.49C82.4333 24.53 83.5733 23.8 84.8933 23.3C86.2133 22.78 87.6733 22.52 89.2733 22.52C90.8733 22.52 92.3333 22.78 93.6533 23.3C94.9733 23.8 96.1033 24.53 97.0433 25.49C98.0033 26.45 98.7333 27.6 99.2333 28.94C99.7533 30.26 100.013 31.74 100.013 33.38C100.013 35.04 99.7533 36.54 99.2333 37.88C98.7333 39.22 98.0033 40.38 97.0433 41.36C96.1033 42.32 94.9733 43.06 93.6533 43.58C92.3333 44.08 90.8733 44.33 89.2733 44.33ZM89.2733 39.71C90.3333 39.71 91.2333 39.46 91.9733 38.96C92.7133 38.46 93.2833 37.74 93.6833 36.8C94.0833 35.86 94.2833 34.73 94.2833 33.41C94.2833 32.09 94.0833 30.96 93.6833 30.02C93.3033 29.08 92.7333 28.37 91.9733 27.89C91.2333 27.39 90.3333 27.14 89.2733 27.14C88.2333 27.14 87.3333 27.39 86.5733 27.89C85.8333 28.37 85.2633 29.08 84.8633 30.02C84.4633 30.96 84.2633 32.09 84.2633 33.41C84.2633 34.73 84.4533 35.86 84.8333 36.8C85.2333 37.74 85.8133 38.46 86.5733 38.96C87.3333 39.46 88.2333 39.71 89.2733 39.71Z" fill="white"/>
                <path d="M113.953 44.33C111.613 44.33 109.603 43.88 107.923 42.98C106.243 42.08 104.953 40.81 104.053 39.17C103.173 37.53 102.733 35.61 102.733 33.41C102.733 31.21 103.173 29.3 104.053 27.68C104.953 26.04 106.243 24.77 107.923 23.87C109.603 22.97 111.613 22.52 113.953 22.52C115.353 22.52 116.703 22.73 118.003 23.15C119.303 23.57 120.353 24.14 121.153 24.86L119.503 29.21C118.623 28.57 117.743 28.1 116.863 27.8C115.983 27.48 115.083 27.32 114.163 27.32C112.303 27.32 110.903 27.85 109.963 28.91C109.023 29.95 108.553 31.45 108.553 33.41C108.553 35.39 109.023 36.91 109.963 37.97C110.903 39.01 112.303 39.53 114.163 39.53C115.083 39.53 115.983 39.38 116.863 39.08C117.743 38.76 118.623 38.28 119.503 37.64L121.153 41.99C120.353 42.69 119.303 43.26 118.003 43.7C116.703 44.12 115.353 44.33 113.953 44.33ZM123.928 44V22.85H128.518L135.808 35.9H134.758L142.018 22.85H146.488V44H141.508V31.43H142.138L136.678 40.88H133.678L128.218 31.4H128.908V44H123.928Z" fill="#009DFF"/>
                <path d="M67.1605 127C63.7998 127 62.7557 124.176 64.485 121.904C65.9533 119.989 68.694 116.159 70.1623 113.335C59.8519 108.596 53 99.1508 53 88.5045C53 72.178 69.4444 59 90 59C110.556 59 127 72.178 127 88.5045C127 105.513 109.936 118.496 87.194 117.879C80.5705 122.586 71.5653 127 67.1605 127ZM70.5864 121.612C73.5556 120.411 79.3633 116.841 83.3765 113.952C84.6164 112.978 85.6605 112.556 87.0309 112.556C88.336 112.589 89.3474 112.621 90 112.621C107.619 112.621 121.616 101.78 121.616 88.5045C121.616 75.1967 107.619 64.3556 90 64.3556C72.4136 64.3556 58.4162 75.1967 58.4162 88.5045C58.4162 97.1384 64.2892 104.701 74.5344 109.44C76.6226 110.414 76.851 111.907 75.9374 113.595C74.828 115.672 72.2178 119.048 70.3907 121.287C70.2275 121.515 70.3254 121.709 70.5864 121.612Z" fill="white"/>
                <rect x="55" y="146" width="15" height="15" rx="7.5" fill="#009DFF"/>
                <rect x="82" y="146" width="15" height="15" rx="7.5" fill="#009DFF"/>
                <rect x="109" y="146" width="15" height="15" rx="7.5" fill="#009DFF"/>
                <path d="M89.9922 79.5C90.032 79.5008 90.071 79.5091 90.1074 79.5234L90.1836 79.5527L90.2646 79.5576C93.0299 79.7018 95.2273 81.902 95.2275 84.5996V86.7002H97.3633C98.0018 86.7002 98.4999 87.2026 98.5 87.7998V97.4004C98.4998 97.9975 98.0017 98.5 97.3633 98.5H82.6367C81.9983 98.5 81.5002 97.9975 81.5 97.4004V87.7998C81.5001 87.2026 81.9982 86.7002 82.6367 86.7002H84.7725V84.5996C84.7727 81.8055 87.1079 79.5041 89.9922 79.5ZM90 80.0996C87.4653 80.0996 85.4094 82.0942 85.4092 84.5996V86.7002H94.5908V84.5996C94.5906 82.0942 92.5347 80.0996 90 80.0996Z" fill="white" stroke="white"/>
            </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Willkommen bei AnoCM
              </h3>
              <p className="text-gray-600 text-sm mb-6">
                Wählen Sie eine Unterhaltung aus, um loszulegen.
              </p>
              <button 
                onClick={() => setShowCreateChat(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
                Neue Nachricht
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation*/}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 min-w-scren">
        <div className="flex justify-around items-center">
          <button
            onClick={() => {
              setActiveSection('chats');
              setSelectedChatId(null);
            }}
            className={`relative flex flex-col items-center px-4 py-2 ${
              activeSection === 'chats' ? 'text-blue-500' : 'text-gray-500'
            }`}
          >
            <MessageCircle className="w-6 h-6 mb-1" />
            <span className="text-xs">Chats</span>
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
              setActiveSection('users');
              setSelectedChatId(null);
            }}
            className={`flex flex-col items-center px-4 py-2 ${
              activeSection === 'users' ? 'text-blue-500' : 'text-gray-500'
            }`}
          >
            <Users className="w-6 h-6 mb-1" />
            <span className="text-xs">Kontakte</span>
          </button>
          
          <button
            onClick={handleLogout}
            className="flex flex-col items-center px-4 py-2 text-gray-500"
          >
            <Settings className="w-6 h-6 mb-1" />
            <span className="text-xs">Mehr</span>
          </button>
        </div>
      </div>

      {/* Create Chat Modal */}
      {showCreateChat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Neue Nachricht
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
                placeholder="User ID"
                value={newChatUserId}
                onChange={(e) => setNewChatUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />

              
              <div className="flex space-x-3">
                <button
                  onClick={handleCreateChat}
                  disabled={!newChatUserId}
                  className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 transition-colors text-sm"
                >
                  Chat starten
                </button>
                <button
                  onClick={() => {
                    setShowCreateChat(false);
                    setNewChatUserId('');
                  }}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal*/}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Einstellungen</h3>
            
            <div className="space-y-4">
              <div className="text-sm">
                <div className="text-gray-500">Benutzer</div>
                <div className="font-medium">{currentUser?.username}</div>
              </div>
              <div className="text-sm">
                <div className="text-gray-500">Deine User ID</div>
                <div className="font-mono text-xs bg-gray-100 p-2 rounded border break-all">
                  {currentUser?.userId}
                </div>
                {currentUser?.isAnonymous && (
                  <div className="text-xs text-blue-600 mt-1">
                    Teile diese ID, damit andere dich zu Chats hinzufügen können
                  </div>
                )}
              </div>
              <div className="text-sm">
                <div className="text-gray-500">Status</div>
                <div className="font-medium">{currentUser?.isAnonymous ? 'Anonym' : 'Registriert'}</div>
              </div>
              
             {/* Teilnehmer-Liste mit Entfernen-Buttons */}
        <div className="text-sm font-medium">Teilnehmer:</div>
        {selectedChat?.chatUserList ? (
          Object.entries(selectedChat.chatUserList).map(([userId, username]) => (
            <div key={userId} className="flex items-center justify-between">
              <span>
                {username}
                {userId === currentUser?.userId && ' (Du)'}
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
                  className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs"
                >
                  Entfernen
                </button>
              )}
            </div>
          ))
        ) : (
          <div className="text-gray-500 italic">Keine Teilnehmer</div>
        )}

              <button
                onClick={() => setShowSettings(false)}
                className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnocmUI;
