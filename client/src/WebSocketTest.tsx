import React, { useState, useEffect, useRef } from 'react';

import { DatabaseTypes } from '@anocm/shared/dist';
import type { Message } from '@anocm/shared/dist';

import { UUID } from "crypto";
import { NIL } from "uuid";


// lokal weil import nicht funktioniert hat
enum Action {
  None = "",
  BroadcastToChat = "BroadcastToChat",
  AddClientToChatNoConfirm = "AddClientToChatNoConfirm",
  RemoveClientFromChatNoConfirm = "RemoveClientFromChatNoConfirm",
  MessageResponse = "MessageResponse"
}

// Für Systemnachrichten
interface TestMessage extends Message {
  system?: boolean;
}

const WebSocketTest = () => {
  const API_BASE = 'http://localhost:8080/api/v1';

  // Auth states
  const [userId, setUserId] = useState<UUID>(NIL);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  // Chat states
  const [activeChatId, setActiveChatId] = useState<UUID>(NIL);
  const [chatUsers, setChatUsers] = useState<DatabaseTypes.User[]>([]);
  const [newUserId, setNewUserId] = useState<string>('');
  const [loadedChat, setLoadedChat] = useState<DatabaseTypes.Chat | null>(null);

  // Messages states
  const [messageContent, setMessageContent] = useState<string>('');
  const [messages, setMessages] = useState<TestMessage[]>([]);

  // Status und error states
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // WebSocket states
  const ws = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);

  // Wenn userId gesetzt, mit WebSocket verbinden
  useEffect(() => {
    if (userId && userId !== NIL) {
      console.log(`[WS-EFFECT] UserId hat sich geändert auf: ${userId}, versuche zu verbinden`);
      connectWebSocket();
    }
    
    return () => {
      if (ws.current) {
        console.log(`[WS-EFFECT] Cleanup - schließe Verbindung`);
        ws.current.close();
      }
    };
  }, [userId]);
  
  const connectWebSocket = () => {
    if (!userId || userId === NIL) {
      console.log('[WS] Keine Benutzer-ID vorhanden, WebSocket-Verbindung wird übersprungen');
      return;
    }
    
    // Bestehende Verbindung schließen
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    
    // Neue Verbindung erstellen
    try {
      console.log(`[WS] Verbindung wird hergestellt für Benutzer: ${userId}`);
      ws.current = new WebSocket(`ws://localhost:8080`);
      
      ws.current.onopen = () => {
        console.log('[WS] Verbindung erfolgreich hergestellt');
        setConnected(true);
        setStatus('WebSocket verbunden');
        
        // Initialisierungsnachricht senden
        setTimeout(() => {
          const initMsg = {
            action: Action.None,
            content: "init",
            senderID: userId,
            chatID: userId,  
            timestamp: Date.now(),
          };
          console.log(`[WS] Benutzer ${userId} mit Server verknüpft`);
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify(initMsg));
          }
        }, 100);
      };
      
      ws.current.onmessage = handleWebSocketMessage;
      
      ws.current.onclose = () => {
        console.log('[WS] Verbindung beendet');
        setConnected(false);
        setStatus('WebSocket getrennt');
      };
      
      ws.current.onerror = err => {
        console.error('[WS] Verbindungsfehler:', err);
        setError('WebSocket-Fehler');
      };
    } catch (error) {
      console.error('[WS] Fehler beim Erstellen der WebSocket-Verbindung:', error);
      setError(`WebSocket-Verbindungsfehler: ${error}`);
    }
  };

 // WebSocket-Nachrichten
const handleWebSocketMessage = (ev: MessageEvent) => {
  try {
    const msg = JSON.parse(ev.data);
    
    // Verschiedene Nachrichtentypen
    if (msg.action === Action.BroadcastToChat) {
      console.log(`[WS] Chat-Nachricht empfangen in Chat: ${msg.chatID}`);
      
      // Nachricht zu vorhandenen Messages hinzufügen
      setMessages(prev => [...prev, msg]);
      
      // AUTOMATISCHE AKTIVIERUNG: Wenn eine Nachricht empfangen wird, 
      // automatisch den entsprechenden Chat aktivieren
      if (msg.chatID && msg.chatID !== activeChatId) {
        console.log(`[WS] Automatische Aktivierung von Chat: ${msg.chatID}`);
        setActiveChatId(msg.chatID);
        // Chat sofort laden für Teilnehmerinformationen
        getChat(msg.chatID, false);
      }
    } else if (msg.action === Action.MessageResponse) {
      console.log(`[WS] Server-Antwort empfangen:`, msg);
        
        try {
          const content = JSON.parse(msg.content);
          
          // Auf Erfolg/Fehler prüfen
          if (content.sucess === false) {
            setError(`Server: ${content.message}`);
          } else {
            setStatus(`Server: ${content.message}`);
            
            // Wenn ein Benutzer hinzugefügt oder entfernt wurde Chat neu laden
            if (
              content.message.includes("Added client") || 
              content.message.includes("Removed user")
            ) {
              if (activeChatId && activeChatId !== NIL) {
                getChat(activeChatId, false);
              }
            }
          }
        } catch (e) {
          // Falls die Nachricht kein gültiges JSON ist
          setStatus(`Server: ${msg.content}`);
        }

    }
  } catch (err) {
    console.error('[WS] Fehler bei Nachrichtenverarbeitung:', err);
    setError(`Nachrichtenverarbeitungsfehler: ${err}`);
  }
};

  //Nachricht an Chat senden
  const sendMessage = () => {
    if (!connected) {
      setError('WebSocket nicht verbunden');
      return;
    }
    
    if (!activeChatId || activeChatId === NIL) {
      setError('Kein Chat ausgewählt');
      return;
    }
    
    if (!messageContent.trim()) {
      setError('Nachricht darf nicht leer sein');
      return;
    }
    
    console.log(`[WS] Sende Nachricht an Chat ${activeChatId}`);
    
    const msg: TestMessage = {
      action: Action.BroadcastToChat,
      content: messageContent,
      senderID: userId,
      chatID: activeChatId,
      timestamp: Date.now(),
    };
    
    try {
      ws.current!.send(JSON.stringify(msg));
      setMessages(prev => [...prev, msg]);
      setMessageContent('');
      setStatus('Nachricht gesendet');
    } catch (error) {
      console.error('[WS] Fehler beim Senden der Nachricht:', error);
      setError(`Fehler beim Senden: ${error}`);
    }
  };

  // Benutzer aus Chat entfernen
  const removeUserFromChat = () => {
    if (!connected) {
      setError('WebSocket nicht verbunden');
      return;
    }
    
    if (!activeChatId || activeChatId === NIL) {
      setError('Kein Chat ausgewählt');
      return;
    }
    
    if (!newUserId) {
      setError('Keine Benutzer-ID angegeben');
      return;
    }
    
    console.log(`[WS] Entferne Benutzer ${newUserId} aus Chat ${activeChatId}`);
    
    const payload = {
      action: Action.RemoveClientFromChatNoConfirm,
      content: newUserId,
      senderID: userId,
      chatID: activeChatId,
      timestamp: Date.now(),
    };
    
    try {
      ws.current!.send(JSON.stringify(payload));
      
      // Systemnachricht hinzufügen
      setMessages(prev => [
        ...prev,
        {
          system: true,
          action: Action.BroadcastToChat,
          content: `User ${newUserId} entfernt`,
          senderID: 'system' as UUID,
          chatID: activeChatId,
          timestamp: Date.now(),
        }
      ]);
      
      setStatus(`Entferne Benutzer ${newUserId}...`);
      setNewUserId('');
      
      // Nach kurzer Verzögerung Chat Daten aktualisieren
      setTimeout(() => {
        getChat(activeChatId, false);
      }, 500);
    } catch (error) {
      console.error('[WS] Fehler beim Entfernen des Benutzers:', error);
      setError(`Fehler beim Entfernen: ${error}`);
    }
  };

  // Anonymen Benutzer erstellen
  const createAnonymousUser = async () => {
    console.log('[API] Anonymen Benutzer erstellen');
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`${API_BASE}/user/newano`, { method: 'POST' });
      const data: DatabaseTypes.DatabaseResponse = await res.json();
      
      if (data.success && data.id) {
        console.log(`[API] Anonymer Benutzer erstellt: ${data.id}`);
        
        // Erst User-ID setzen
        setUserId(data.id);
        setStatus(`Anon-User erstellt: ${data.id}`);
        
        // Bestehende Verbindung schließen falls vorhanden
        if (ws.current) {
          ws.current.close();
          ws.current = null;
        }
        
        // Kurze Verzögerung, damit React den State aktualisieren kann
        setTimeout(() => {
          console.log('[WS] Neue Verbindung nach Benutzer-Erstellung');
          connectWebSocket();
        }, 300);
      } else {
        throw new Error(data.error || 'Unbekannter Fehler');
      }
    } catch (err) {
      console.error('[API] Fehler bei Anon-User-Erstellung:', err);
      setError(`Fehler beim Anlegen des anonymen Users: ${err}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Registrierten Benutzer erstellen
  const createUser = async () => {
    if (!username || !password) {
      setError('Name & Passwort angeben');
      return;
    }
    
    console.log('[API] Benutzer registrieren');
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`${API_BASE}/user/newuser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      const data: DatabaseTypes.DatabaseResponse = await res.json();
      
      if (data.success && data.id) {
        console.log(`[API] Benutzer '${username}' erstellt mit ID: ${data.id}`);
        
        // Erst User ID setzen
        setUserId(data.id);
        setStatus(`User erstellt: ${username}`);
        
        // Bestehende Verbindung schließen falls vorhanden
        if (ws.current) {
          ws.current.close();
          ws.current = null;
        }
        
        // Kurze Verzögerung dass React State aktualisieren kann
        setTimeout(() => {
          console.log('[WS] Neue Verbindung nach Benutzer-Erstellung');
          connectWebSocket();
        }, 300);
      } else {
        throw new Error(data.error || 'Unbekannter Fehler');
      }
    } catch (err) {
      console.error('[API] Fehler bei Benutzer-Registrierung:', err);
      setError(`Fehler bei User-Erstellung: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  // Chat Teilnehmer anzeigen
  const renderChatUsersList = () => {
    if (chatUsers.length === 0) {
      return <div className="text-gray-500 italic">Keine Benutzer hinzugefügt</div>;
    }
    
    return (
      <div className="mt-2 space-y-2">
        <div className="font-semibold">Chat-Teilnehmer zum Erstellen:</div>
        <ul className="list-disc list-inside">
          {chatUsers.map((user, index) => (
            <li key={index} className="flex items-center justify-between py-1">
              <span className="truncate">{user.username || user.userId}</span>
              <button 
                onClick={() => setChatUsers(chatUsers.filter((_, i) => i !== index))}
                className="ml-2 bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1 rounded text-sm"
              >
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  // Benutzer zur Chat Erstellung hinzufügen
  const addUserToChatCreation = () => {
    if (!newUserId.trim()) {
      setError('Bitte eine User-ID eingeben');
      return;
    }
    
    // Prüfen ob Benutzer bereits in der Liste ist
    if (chatUsers.some(user => user.userId === newUserId)) {
      setError('Dieser User ist bereits in der Liste');
      return;
    }
    
    setChatUsers(prev => [...prev, { userId: newUserId }]);
    setNewUserId('');
    setError('');
    setStatus(`User ${newUserId.substring(0, 8)}... zur Chat-Erstellung hinzugefügt`);
  };

  // Aktuellen Benutzer zur Chat-Erstellung hinzufügen
  const addCurrentUserToChatCreation = () => {
    if (!userId || userId === NIL) {
      setError('Kein Benutzer angemeldet');
      return;
    }
    
    // Prüfen ob Benutzer bereits in der Liste ist
    if (chatUsers.some(user => user.userId === userId)) {
      setError('Sie sind bereits in der Liste');
      return;
    }
    
    const newUser: DatabaseTypes.User = {
      userId: userId,
      username: username || undefined
    };
    
    setChatUsers(prev => [...prev, newUser]);
    setStatus('Sie wurden zur Chat-Erstellung hinzugefügt');
  };

  // Chat erstellen
  const createChat = async () => {
    if (chatUsers.length < 2) {
      setError('Mind. 2 User nötig');
      return;
    }
    
    console.log('[API] Chat wird erstellt');
    setLoading(true);
    setError('');
    
    try {
      const usersToSend = [
        { userId: chatUsers[0].userId },
        { userId: chatUsers[1].userId }
      ];
      
      console.log(`[API] Chat mit Teilnehmern: ${usersToSend.map(u => u.userId).join(', ')}`);
      
      const res = await fetch(`${API_BASE}/chat/newchat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(usersToSend),
      });
      
      const data: DatabaseTypes.DatabaseResponse = await res.json();
      
      if (data.success && data.id) {
        console.log(`[API] Chat erfolgreich erstellt mit ID: ${data.id}`);
        
        // Aktiven Chat setzen und laden
        setActiveChatId(data.id);
        
        // Systemnachricht hinzufügen
        setMessages(prev => [
          ...prev,
          {
            system: true,
            action: Action.BroadcastToChat,
            content: `Chat ${data.id} erstellt`,
            senderID: 'system' as UUID,
            chatID: data.id as UUID,
            timestamp: Date.now(),
          }
        ]);
        
        setStatus(`Chat erstellt: ${data.id}`);
        
        // Chat-Liste leeren
        setChatUsers([]);
        
        // Chat sofort laden
        getChat(data.id, true);
      } else {
        throw new Error(data.error || 'Unbekannter Fehler bei Chat-Erstellung');
      }
    } catch (err) {
      console.error('[API] Fehler bei Chat-Erstellung:', err);
      setError(`Fehler beim Erstellen des Chats: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Chat laden
  const getChat = async (chatId = activeChatId, showStatus = true) => {
    if (!chatId || chatId === NIL) {
      setError('Chat-ID angeben');
      return;
    }
    
    if (showStatus) {
      console.log(`[API] Chat ${chatId} wird geladen`);
      setLoading(true);
    }
    
    setError('');
    
    try {
      const res = await fetch(`${API_BASE}/chat/getchat?chatid=${chatId}`);
      const data: DatabaseTypes.DatabaseResponse = await res.json();
      
      if (data.success && data.userData) {
        console.log(`[API] Chat ${chatId} erfolgreich geladen`);
        setLoadedChat(data.userData as DatabaseTypes.Chat);
        
        if (showStatus) {
          // Systemnachricht nur hinzufügen, wenn explizit geladen
          setMessages(prev => [
            ...prev,
            {
              system: true,
              action: Action.BroadcastToChat,
              content: `Chat ${chatId} geladen`,
              senderID: 'system' as UUID,
              chatID: chatId as UUID,
              timestamp: Date.now(),
            }
          ]);
          
          setStatus(`Chat geladen: ${chatId}`);
        }
        
        // Aktiven Chat setzen, falls noch nicht geschehen
        if (activeChatId !== chatId) {
          setActiveChatId(chatId);
        }
      } else {
        throw new Error(data.error || 'Unbekannter Fehler beim Laden des Chats');
      }
    } catch (err) {
      console.error('[API] Fehler beim Laden des Chats:', err);
      if (showStatus) {
        setError(`Fehler beim Chat-Laden: ${err}`);
      }
    } finally {
      if (showStatus) {
        setLoading(false);
      }
    }
  };

  // Benutzer zum Chat hinzufügen
  const addUserToChat = async () => {
    if (!activeChatId || activeChatId === NIL) {
      setError('Kein Chat ausgewählt');
      return;
    }
    
    if (!newUserId) {
      setError('Keine Benutzer-ID angegeben');
      return;
    }
    
    console.log(`[API] Füge Benutzer ${newUserId} zu Chat ${activeChatId} hinzu`);
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`${API_BASE}/chat/adduser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: activeChatId, userId: newUserId }),
      });
      
      const data: DatabaseTypes.DatabaseResponse = await res.json();
      
      if (data.success) {
        console.log(`[API] Benutzer ${newUserId} erfolgreich zu Chat hinzugefügt`);
        
        // Chat neu laden
        await getChat(activeChatId, false);
        
        // Systemnachricht hinzufügen
        setMessages(prev => [
          ...prev,
          {
            system: true,
            action: Action.BroadcastToChat,
            content: `User ${newUserId} hinzugefügt`,
            senderID: 'system' as UUID,
            chatID: activeChatId,
            timestamp: Date.now(),
          } as TestMessage
        ]);
        
        setStatus(`Benutzer ${newUserId.substring(0, 8)}... hinzugefügt`);
      } else {
        throw new Error(data.error || 'Unbekannter Fehler beim Hinzufügen des Benutzers');
      }
    } catch (err) {
      console.error('[API] Fehler beim Hinzufügen des Benutzers:', err);
      setError(`Fehler beim Hinzufügen: ${err}`);
    } finally {
      setLoading(false);
      setNewUserId('');
    }
  };

  // Zeit formatieren
  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString();
  };

  // Verkürzte UUID anzeigen
  const shortUUID = (id: string) => {
    return id ? `${id.substring(0, 8)}...` : '';
  };

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white text-black font-sans space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">WebSocket Test</h2>
        <span className={`text-sm ${connected ? 'text-green-500' : 'text-red-500'}`}>{connected ? 'Verbunden' : 'Getrennt'}</span>
      </div>

      <div id="join-status" className="text-xs text-gray-600 mt-2">
        Nicht beigetreten
      </div>

      {/* chat */}
      <div className="bg-white p-5 rounded-lg shadow-md space-y-3">
        <h2 className="text-2xl font-semibold text-gray-700">Chat</h2>
        
        {/* chat erstellung */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-lg font-medium text-gray-700 mb-2">Chat erstellen</h3>
          <div className="flex flex-wrap gap-3 mb-2">
            <input
              placeholder="User-ID hinzufügen"
              value={newUserId}
              onChange={e => setNewUserId(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded text-gray-900"
            />
            <button
              onClick={addUserToChatCreation}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded"
            >
              Hinzufügen
            </button>
          </div>
          
          <button
            onClick={addCurrentUserToChatCreation}
            disabled={chatUsers.some(u => u.userId === userId)}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded mt-2 disabled:bg-blue-300"
          >
            Mich hinzufügen
          </button>
          
          {renderChatUsersList()}
          
          <button
            onClick={createChat}
            disabled={loading || chatUsers.length < 2}
            className={`mt-3 px-4 py-2 rounded ${
              chatUsers.length < 2 
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            Chat erstellen ({chatUsers.length}/2)
          </button>
        </div>
        
        {/* chat verwaltung*/}
        <div className="pt-2">
          <h3 className="text-lg font-medium text-gray-700 mb-2">Chat verwalten</h3>
          <div className="flex flex-wrap gap-3">
            <input
              placeholder="Chat-ID"
              value={activeChatId}
              onChange={e => setActiveChatId(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded text-gray-900"
            />
            <button
              onClick={() => getChat()}
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Laden
            </button>
          </div>
          
          <div className="flex flex-wrap gap-3 mt-3">
            <input
              placeholder="User-ID"
              value={newUserId}
              onChange={e => setNewUserId(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded text-gray-900"
            />
            <button
              onClick={addUserToChat}
              disabled={loading || !activeChatId}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            >
              Hinzufügen
            </button>
            <button
              onClick={removeUserFromChat}
              disabled={!connected || !activeChatId || !newUserId}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
            >
              Entfernen
            </button>
          </div>
        </div>
        
        <div className="text-gray-600 mt-3">
          <div className="font-semibold">Aktuelle Teilnehmer:</div>
          {loadedChat
            ? Object.keys(loadedChat.chatUserList).map(u => (
                <span key={u} className="font-mono mx-1 bg-gray-100 px-2 py-1 rounded">
                  {u}
                  {u === userId && <span className="text-xs text-blue-600"> (Sie)</span>}
                </span>
              ))
            : 'Kein Chat geladen'}
        </div>
      </div>

      {/* nachrichten */}
      <div className="bg-white p-5 rounded-lg shadow-md flex flex-col space-y-3">
        <h2 className="text-2xl font-semibold text-gray-700">Nachrichten</h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Nachrichteninhalt"
            value={messageContent}
            onChange={e => setMessageContent(e.target.value)}
            disabled={!connected || !activeChatId}
            className="flex-1 px-3 py-2 border border-gray-300 rounded text-gray-900"
          />
          <button
            onClick={sendMessage}
            disabled={!connected || !activeChatId || !messageContent.trim()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Senden
          </button>
        </div>
        <div className="h-64 overflow-y-auto bg-gray-50 p-3 rounded flex flex-col space-y-2">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[70%] p-2 rounded-lg shadow ${
                msg.system
                  ? 'bg-gray-200 italic self-center'
                  : msg.senderID === userId
                  ? 'bg-blue-100 self-end text-right'
                  : 'bg-white self-start'
              }`}
            >
              <div className="text-sm">{msg.content}</div>
              <div className="text-xs text-gray-500 mt-1">
                {formatTime(msg.timestamp)}
                {msg.system ? '' : ` | ${msg.senderID === userId ? 'Sie' : msg.senderID}`}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WebSocketTest;
