import React, { useState, useEffect, useRef } from 'react';

import { DatabaseResponse, User, Chat } from '@anocm/shared/dist';
import type { WsMessage } from '@anocm/shared/dist';

// for some reason this cannot be imported so idk what to do
enum Action {
  None = "",
  BroadcastToChat = "BroadcastToChat",
  Init = "Init",
  MessageResponse = "MessageResponse",
}



import { UUID } from "crypto";
import { NIL } from "uuid";

const SYSTEM_UUID = "00000000-0000-0000-0000-000000000000" as UUID;

// Erweiterter Message-Typ für Systemnachrichten
interface TestMessage extends WsMessage {
  system?: boolean;
}

const WebSocketTest = () => {
  const API_BASE = 'http://localhost:8080/api/v1';

  //auth states
  const [userId, setUserId] = useState<UUID | string>(NIL);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  //chat states
  const [activeChatId, setActiveChatId] = useState<UUID | string>(NIL);
  const [chatUsers, setChatUsers] = useState<User[]>([]);
  const [newUserId, setNewUserId] = useState<string>('');
  const [loadedChat, setLoadedChat] = useState<Chat | null>(null);

  //messages states
  const [messageContent, setMessageContent] = useState<string>('');
  const [messages, setMessages] = useState<TestMessage[]>([]);

  //status und error states
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  //websocket states
  const ws = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);



  //wenn userId gesetzt mit websocket verbinden
  useEffect(() => {
    if (userId && !connected) connectWebSocket();
    return () => { ws.current?.close(); };
  }, [userId]);


  const connectWebSocket = () => {
    if (!userId) return setError('Bitte zuerst einen Benutzer erstellen');

    // Bestehende Verbindung schließen
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }

    // Neue Verbindung mit Verzögerung erstellen
    setTimeout(() => {
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

      ws.current.onmessage = ev => {
        try {
          const msg = JSON.parse(ev.data);
          // Nur wichtige Ereignisse loggen
          if (msg.action === Action.BroadcastToChat) {
            console.log(`[WS] Chat-Nachricht empfangen in Chat: ${msg.chatID}`);
          } else if (msg.action === Action.MessageResponse) {
            console.log(`[WS] Server-Antwort empfangen`);
          }

          if (msg.action === Action.BroadcastToChat) {
            setMessages(prev => [...prev, msg]);
          } else if (msg.action === Action.MessageResponse) {
            try {
              const content = JSON.parse(msg.content);
              const txt = content?.message || msg.content;
              setStatus(`Server: ${txt}`);
            } catch (e) {
              setStatus(`Server: ${msg.content}`);
            }
          }
        } catch (err) {
          console.error('[WS] Fehler bei Nachrichtenverarbeitung:', err);
        }
      };

      ws.current.onclose = () => {
        console.log('[WS] Verbindung beendet');
        setConnected(false);
        setStatus('WebSocket getrennt');
      };

      ws.current.onerror = err => {
        console.error('[WS] Verbindungsfehler:', err);
        setError('WebSocket-Fehler');
      };
    }, 50);
  };

  const sendMessage = () => {
    if (!connected || !messageContent.trim()) return;
    console.log(`[WS] Sende Nachricht an Chat ${activeChatId}`);
    const msg: TestMessage = {
      action: Action.BroadcastToChat,
      content: messageContent,
      senderID: userId as UUID,
      chatID: activeChatId as UUID,
      timestamp: Date.now(),
    };
    ws.current!.send(JSON.stringify(msg));
    setMessages(prev => [...prev, msg]);
    setMessageContent('');
    setStatus('Nachricht gesendet');
  };

  const removeUserFromChat = () => {
    //TODO: GEHT GRAD NICHT

    return;
    /*
    if (!connected || !newUserId) return setError('IDs angeben');
    console.log(`[WS] Entferne Benutzer ${newUserId} aus Chat ${activeChatId}`);
    const payload = {
      action: Action.RemoveClientFromChatNoConfirm,
      content: newUserId,
      senderID: userId,
      chatID: activeChatId,
      timestamp: Date.now(),
    };
    ws.current!.send(JSON.stringify(payload));
    setMessages(prev => [
      ...prev,
      {
        system: true,
        action: Action.BroadcastToChat,
        content: `User ${newUserId} entfernt`,
        senderID: SYSTEM_UUID,
        chatID: activeChatId as UUID,
        timestamp: Date.now(),
      }
    ]);
    setStatus(`User entfernt: ${newUserId}`);
    setNewUserId('');

    */
  };

  //api funktionen
  const createAnonymousUser = async () => {
    console.log('[API] Anonymen Benutzer erstellen');
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/user/newano`, { method: 'POST' });
      const data: DatabaseResponse = await res.json();
      if (data.success && data.id) {
        console.log(`[API] Anonymer Benutzer erstellt: ${data.id}`);
        setUserId(data.id);
        setStatus(`Anon-User erstellt: ${data.id}`);

        if (ws.current) {
          ws.current.close();
        }

        setTimeout(() => {
          console.log('[WS] Neue Verbindung nach Benutzer-Erstellung');
          connectWebSocket();
        }, 100);

      } else throw new Error(data.error);
    } catch (err) {
      console.error('[API] Fehler bei Anon-User-Erstellung:', err);
      setError('Fehler beim Anlegen des anonymen Users');
    } finally {
      setLoading(false);
    }
  };

  const createUser = async () => {
    if (!username || !password) return setError('Name & Passwort angeben');
    console.log('[API] Benutzer registrieren');
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/user/newuser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data: DatabaseResponse = await res.json();
      if (data.success && data.id) {
        console.log(`[API] Benutzer '${username}' erstellt mit ID: ${data.id}`);
        setUserId(data.id);
        setStatus(`User erstellt: ${username}`);

        if (ws.current) {
          ws.current.close();
        }

        setTimeout(() => {
          console.log('[WS] Neue Verbindung nach Benutzer-Erstellung');
          connectWebSocket();
        }, 100);

      } else throw new Error(data.error);
    } catch (err) {
      console.error('[API] Fehler bei Benutzer-Registrierung:', err);
      setError('Fehler bei User-Erstellung');
    } finally {
      setLoading(false);
    }
  };

  //aktuelle chat user
  const renderChatUsersList = () => {
    if (chatUsers.length === 0) {
      return <div className="text-gray-500 italic">Keine Benutzer hinzugefügt</div>;
    }

    return (
      <div className="mt-2 space-y-2">
        <div className="font-semibold">Chat-Teilnehmer zum Erstellen:</div>
        <ul className="list-disc list-inside">
          {chatUsers.map((user, index) => (
            <li key={index}>
              {user.username || user.userId}
              <button
                onClick={() => setChatUsers(chatUsers.filter((_, i) => i !== index))}
                className="ml-4 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded"
              >
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  //user zur chat erstellung hinzufügen
  const addUserToChatCreation = () => {
    if (!newUserId.trim()) {
      setError('Bitte eine User-ID eingeben');
      return;
    }

    //schauen ob user bereits in liste
    if (chatUsers.some(user => user.userId === newUserId)) {
      setError('Dieser User ist bereits in der Liste');
      return;
    }

    setChatUsers(prev => [...prev, { userId: newUserId }]);
    setNewUserId('');
    setError('');
    setStatus(`User ${newUserId} zur Chat-Erstellung hinzugefügt`);
  };

  //aktuellen benutzer zur chat erstellung hinzufügen
  const addCurrentUserToChatCreation = () => {
    if (!userId) {
      setError('Kein Benutzer angemeldet');
      return;
    }

    //schauen ob user bereits in liste
    if (chatUsers.some(user => user.userId === userId)) {
      setError('Sie sind bereits in der Liste');
      return;
    }

    const newUser: User = {
      userId: userId,
      username: username || undefined
    };

    setChatUsers(prev => [...prev, newUser]);
    setStatus('Sie wurden zur Chat-Erstellung hinzugefügt');
  };

  const createChat = async () => {
    if (chatUsers.length < 2) return setError('Mind. 2 User nötig');
    console.log('[API] Chat wird erstellt');
    setLoading(true);
    setError('');
    try {
      const usersToSend = [
        { userId: chatUsers[0].userId },
        { userId: chatUsers[1].userId }
      ];

      console.log(`[API] Chat mit Teilnehmern: ${usersToSend[0].userId}, ${usersToSend[1].userId}`);

      const res = await fetch(`${API_BASE}/chat/newchat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(usersToSend),
      });

      const data: DatabaseResponse = await res.json();

      if (data.success && data.id) {
        console.log(`[API] Chat erfolgreich erstellt mit ID: ${data.id}`);
        setActiveChatId(data.id);
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

  const getChat = async () => {
    if (!activeChatId) return setError('Chat-ID angeben');
    console.log(`[API] Chat ${activeChatId} wird geladen`);
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/chat/getchat?chatid=${activeChatId}`);
      const data: DatabaseResponse = await res.json();
      if (data.success && data.userData) {
        console.log(`[API] Chat ${activeChatId} erfolgreich geladen`);
        setLoadedChat(data.userData as Chat);
        setMessages(prev => [
          ...prev,
          {
            system: true,
            action: Action.BroadcastToChat,
            content: `Chat ${activeChatId} geladen`,
            senderID: 'system' as UUID,
            chatID: activeChatId as UUID,
            timestamp: Date.now(),
          }
        ]);
        setStatus(`Chat geladen: ${activeChatId}`);
      } else throw new Error(data.error);
    } catch (err) {
      console.error('[API] Fehler beim Laden des Chats:', err);
      setError('Fehler beim Chat-Laden');
    } finally {
      setLoading(false);
    }
  };

  const addUserToChat = async () => {
    if (!activeChatId || !newUserId) return setError('IDs angeben');
    console.log(`[API] Füge Benutzer ${newUserId} zu Chat ${activeChatId} hinzu`);
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/chat/adduser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: activeChatId, userId: newUserId }),
      });
      const data: DatabaseResponse = await res.json();
      if (data.success) {
        console.log(`[API] Benutzer ${newUserId} erfolgreich zu Chat hinzugefügt`);
        await getChat();
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
      } else throw new Error(data.error);
    } catch (err) {
      console.error('[API] Fehler beim Hinzufügen des Benutzers:', err);
      setError('Fehler beim Hinzufügen des Users');
    } finally {
      setLoading(false);
      setNewUserId('');
    }
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString();

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 p-6 space-y-6">

      {/* status und error */}
      <div className="space-y-2">
        {status && (
          <div className="bg-green-100 text-green-800 p-3 rounded shadow">{status}</div>
        )}
        {error && (
          <div className="bg-red-100 text-red-800 p-3 rounded shadow">{error}</div>
        )}
      </div>

      {/* benutzer */}
      <div className="bg-white p-5 rounded-lg shadow-md space-y-3">
        <h2 className="text-2xl font-semibold text-gray-700">Benutzer</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={createAnonymousUser}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Anonym
          </button>
          <input
            placeholder="User"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded text-gray-900"
          />
          <input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded text-gray-900"
          />
          <button
            onClick={createUser}
            disabled={loading}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
          >
            Registrieren
          </button>
        </div>
        {userId && (
          <div className="text-gray-600">
            Angemeldet als <span className="font-mono text-blue-600">{userId}</span>
          </div>
        )}
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

          {renderChatUsersList()}

          <button
            onClick={createChat}
            disabled={loading || chatUsers.length < 2}
            className={`mt-3 px-4 py-2 rounded ${chatUsers.length < 2
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
              onClick={getChat}
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
              className={`max-w-[70%] p-2 rounded-lg shadow ${msg.system
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
          <div />
        </div>
      </div>
    </div>
  );
};

export default WebSocketTest;
