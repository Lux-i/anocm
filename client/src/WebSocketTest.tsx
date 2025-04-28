import React, { useState, useEffect, useRef } from 'react';
import { Action } from '@anocm/shared/dist';
import { User, Chat, DatabaseResponse } from '@anocm/shared/dist';
import type { Message } from '@anocm/shared/dist';

// Erweiterter Message-Typ für Systemnachrichten
interface TestMessage extends Message {
  system?: boolean;
}

const WebSocketTest: React.FC = () => {
  const API_BASE = 'http://localhost:8080/api/v1';

  //auth states
  const [userId, setUserId] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  //chat states
  const [activeChatId, setActiveChatId] = useState<string>('');
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

  //auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);

  //wenn userId gesetzt mit websocket verbinden
  useEffect(() => {
    if (userId && !connected) connectWebSocket();
    return () => { ws.current?.close(); };
  }, [userId]);

  //auto scroll bei neuen nachrichten
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  
//websocket funktionen
  const connectWebSocket = () => {
    console.log(`[WS] Connecting as ${userId}`);
    if (!userId) return setError('Bitte zuerst einen Benutzer erstellen');
    ws.current = new WebSocket(`ws://localhost:8080`);
    ws.current.onopen = () => {
      console.log('[WS] Connected');
      setConnected(true);
      setStatus('WebSocket verbunden');
    };
    ws.current.onmessage = ev => {
      const msg: Message = JSON.parse(ev.data);
      console.log(`[WS] Msg ${msg.action} in chat ${msg.chatID}`);
      if (msg.action === Action.BroadcastToChat) {
        setMessages(prev => [...prev, msg]);
      } else if (msg.action === Action.MessageResponse) {
        const txt = JSON.parse(msg.content)?.message || msg.content;
        setStatus(`Server: ${txt}`);
      }
    };
    ws.current.onclose = () => {
      console.log('[WS] Disconnected');
      setConnected(false);
      setStatus('WebSocket getrennt');
    };
    ws.current.onerror = err => {
      console.error('[WS] Error', err);
      setError('WebSocket-Fehler');
    };
  };

  const sendMessage = () => {
    if (!connected || !messageContent.trim()) return;
    console.log(`[WS] Send to ${activeChatId}: "${messageContent}"`);
    const msg: TestMessage = {
      action: Action.BroadcastToChat,
      content: messageContent,
      senderID: userId,
      chatID: activeChatId,
      timestamp: Date.now(),
    };
    ws.current!.send(JSON.stringify(msg));
    setMessages(prev => [...prev, msg]);
    setMessageContent('');
    setStatus('Nachricht gesendet');
  };

  const removeUserFromChat = () => {
    if (!connected || !newUserId) return setError('IDs angeben');
    console.log(`[WS] Remove ${newUserId} from ${activeChatId}`);
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
        senderID: 'system',
        chatID: activeChatId,
        timestamp: Date.now(),
      }
    ]);
    setStatus(`User entfernt: ${newUserId}`);
    setNewUserId('');
  };

  //api funktionen
  const createAnonymousUser = async () => {
    console.log('[API] POST /user/newano');
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/user/newano`, { method: 'POST' });
      const data: DatabaseResponse = await res.json();
      if (data.success && data.id) {
        console.log(`[API] Anonymous user ${data.id}`);
        setUserId(data.id);
        setStatus(`Anon-User erstellt: ${data.id}`);
        
        //nicht automatisch zur chat liste hinzufügen
        //extra hinzufügen lassen manuell
      } else throw new Error(data.error);
    } catch (err) {
      console.error('[API] newano failed', err);
      setError('Fehler beim Anlegen des anonymen Users');
    } finally {
      setLoading(false);
    }
  };

  const createUser = async () => {
    if (!username || !password) return setError('Name & Passwort angeben');
    console.log('[API] POST /user/newuser');
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
        console.log(`[API] User ${data.id}`);
        setUserId(data.id);
        setStatus(`User erstellt: ${username}`);
        
        //nicht automatisch zur chat liste hinzufügen
        //extra hinzufügen lassen manuell
      } else throw new Error(data.error);
    } catch (err) {
      console.error('[API] newuser failed', err);
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
            <li key={index} className="font-mono">
              {user.username || user.userId}
              <button 
                onClick={() => setChatUsers(chatUsers.filter((_, i) => i !== index))}
                className="ml-2 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-1 py-0.5 rounded"
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
    console.log('[API] POST /chat/newchat');
    setLoading(true);
    setError('');
    try {
      
      console.log('Erstelle Chat mit Benutzern:', chatUsers);
      console.log('JSON für Server:', JSON.stringify(chatUsers));
      
      //nur erste und zweite user id senden
    
      const usersToSend = [
        { userId: chatUsers[0].userId },
        { userId: chatUsers[1].userId }
      ];
      
      console.log('Geänderte User-Liste für Server:', usersToSend);
      console.log('Geändertes JSON für Server:', JSON.stringify(usersToSend));
      
      const res = await fetch(`${API_BASE}/chat/newchat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(usersToSend),
      });
      
      const data: DatabaseResponse = await res.json();
      console.log('Server-Antwort:', data);
      
      if (data.success && data.id) {
        console.log(`[API] Chat ${data.id}`);
        setActiveChatId(data.id);
        setMessages(prev => [
          ...prev,
          {
            system: true,
            action: Action.BroadcastToChat,
            content: `Chat ${data.id} erstellt`,
            senderID: 'system',
            chatID: data.id,
            timestamp: Date.now(),
          }
        ]);
        setStatus(`Chat erstellt: ${data.id}`);
      } else {
        throw new Error(data.error || 'Unbekannter Fehler bei Chat-Erstellung');
      }
    } catch (err) {
      console.error('[API] newchat failed', err);
      setError(`Fehler beim Erstellen des Chats: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const getChat = async () => {
    if (!activeChatId) return setError('Chat-ID angeben');
    console.log('[API] GET /chat/getchat');
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/chat/getchat?chatid=${activeChatId}`);
      const data: DatabaseResponse = await res.json();
      if (data.success && data.userData) {
        console.log(`[API] Loaded chat ${activeChatId}`);
        setLoadedChat(data.userData as Chat);
        setMessages(prev => [
          ...prev,
          {
            system: true,
            action: Action.BroadcastToChat,
            content: `Chat ${activeChatId} geladen`,
            senderID: 'system',
            chatID: activeChatId,
            timestamp: Date.now(),
          }
        ]);
        setStatus(`Chat geladen: ${activeChatId}`);
      } else throw new Error(data.error);
    } catch (err) {
      console.error('[API] getchat failed', err);
      setError('Fehler beim Chat-Laden');
    } finally {
      setLoading(false);
    }
  };

  const addUserToChat = async () => {
    if (!activeChatId || !newUserId) return setError('IDs angeben');
    console.log('[API] POST /chat/adduser');
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
        console.log(`[API] Added ${newUserId}`);
        await getChat();
        setMessages(prev => [
          ...prev,
          {
            system: true,
            action: Action.BroadcastToChat,
            content: `User ${newUserId} hinzugefügt`,
            senderID: 'system',
            chatID: activeChatId,
            timestamp: Date.now(),
          }
        ]);
      } else throw new Error(data.error);
    } catch (err) {
      console.error('[API] adduser failed', err);
      setError('Fehler beim Hinzufügen des Users');
    } finally {
      setLoading(false);
      setNewUserId('');
    }
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString();

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 p-6 space-y-6">
      <h1 className="text-4xl font-bold text-center text-blue-600">
        WebSocket-Backend-Tester
      </h1>

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
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
};

export default WebSocketTest;
