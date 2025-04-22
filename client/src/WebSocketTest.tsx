import { useEffect, useRef, useState } from 'react';

enum Action {
  None = 0,
  Message = 1,
  DebugJoinChat = 2,
  DebugBroadcast = 3,
}

type Message = {
  action: Action;
  text: string;
  chatId: string;
  fromSelf?: boolean;
};

type StatusMessage = {
  trayId: string;
  status: number;
  message: string;
};

type MessageReq = {
  action: Action;
  text: string;
  chatId: string;
  trayId: string;
};

const WebSocketTest = () => {
  const [message, setMessage] = useState('');
  const [chatId, setChatId] = useState('');
  const [receivedMessages, setReceivedMessages] = useState<Message[]>([]);
  const [statusMessages, setStatusMessages] = useState<StatusMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [groupKey, setGroupKey] = useState<CryptoKey | null>(null);
  const [actionType, setActionType] = useState<'message' | 'broadcast'>('message');
  const [hasJoined, setHasJoined] = useState(false);


  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const deriveGroupKeyFromChatId = async (chatId: string): Promise<CryptoKey> => {
      const enc = new TextEncoder().encode(chatId);
      const hash = await crypto.subtle.digest("SHA-256", enc);
      return crypto.subtle.importKey(
        "raw",
        hash,
        { name: "AES-GCM" },
        true,
        ["encrypt", "decrypt"]
      );
    };

    const setupKey = async () => {
      const key = await deriveGroupKeyFromChatId(chatId);
      setGroupKey(key);
    };

    setupKey();
  }, [chatId]);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080');

    ws.onopen = () => {
      console.log('WebSocket verbunden');
      setConnected(true);
    };

    ws.onclose = () => {
      console.log('WebSocket getrennt');
      setConnected(false);
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Empfangene Daten:', data);


        //Begrüßungsnachricht vom server
        if ('msg' in data) {
          const message: Message = {
            action: Action.None,
            text: data.msg,
            chatId: 'server',
          };
          setReceivedMessages(prev => [...prev, message]);

          //Status Nachricht
        } else if ('trayId' in data && 'status' in data && 'message' in data) {
          setStatusMessages(prev => [...prev, data as StatusMessage]);

          const statusMsg: Message = {
            action: Action.None,
            text: `Status: ${data.message}`,
            chatId: 'system'
          };
          setReceivedMessages(prev => [...prev, statusMsg]);

          // normale Nachricht
        } else if ('action' in data && 'text' in data && 'chatId' in data && groupKey && data.action === Action.Message) {
          const decryptedText = await decryptMessage(data.text, groupKey);
          setReceivedMessages(prev => [...prev, {
            ...data,
            text: decryptedText
          }]);
        }

        else if (data.action === Action.DebugBroadcast){
            setReceivedMessages(prev => [...prev,{
                ...data,
                text: data.text
            }]);

        }

      } catch (error) {
        try {
          const text = event.data.toString();
          const match = text.match(/(.*) to chat \"(.*)\"/);

          if (match && match.length === 3) {
            const [_, messageText, receivedChatId] = match;

            const message: Message = {
              action: Action.Message,
              text: messageText,
              chatId: receivedChatId
            };

            setReceivedMessages(prev => [...prev, message]);
          } else {
            const message: Message = {
              action: Action.Message,
              text: text,
              chatId: 'broadcast'
            };
            setReceivedMessages(prev => [...prev, message]);
          }
        } catch (parseError) {
          console.error('Fehler beim Verarbeiten der Nachricht:', parseError);
        }
      }
    };

    wsRef.current = ws;
    return () => ws.close();
  }, []);

  const sendMessage = async () => {
    if (!wsRef.current || !connected || !groupKey || actionType === 'message' && !hasJoined) {
      alert('Noch keinem Chat beigetreten');
      return;
    }

    const encryptedText = await encryptMessage(message, groupKey);

    const messageReq: MessageReq = {
      action: actionType === 'broadcast' ? Action.DebugBroadcast : Action.Message,
      text: encryptedText,
      chatId,
      trayId: `tray-${Date.now()}`
    };

    console.log('Sende Nachricht:', messageReq);
    wsRef.current.send(JSON.stringify(messageReq));

    setReceivedMessages(prev => [...prev, {
      action: Action.Message,
      text: message,
      chatId,
      fromSelf: true
    }]);

    setMessage('');
  };

  const joinChat = () => {
    if (!wsRef.current || !connected) return;

    const joinChatMsg : MessageReq = {
      action: Action.DebugJoinChat,
      text: "Join Chat", chatId,
      trayId: `tray-${Date.now()}`
    };

    console.log('Sende Join-Chat:', joinChatMsg);
    wsRef.current.send(JSON.stringify(joinChatMsg));
    setHasJoined(true);

    const statusElement = document.getElementById("join-status");
    if (statusElement) {
      statusElement.textContent = `Beigetreten zu Chat: ${chatId}`;
    }
  };

  async function encryptMessage(plainText: string, key: CryptoKey): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plainText);
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
    const combined = new Uint8Array([...iv, ...new Uint8Array(encrypted)]);
    return btoa(String.fromCharCode(...combined));
  }

  async function decryptMessage(encoded: string, key: CryptoKey): Promise<string> {
    const data = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    const iv = data.slice(0, 12);
    const ciphertext = data.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white text-black font-sans space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">WebSocket Test</h2>
        <span className={`text-sm ${connected ? 'text-green-500' : 'text-red-500'}`}>{connected ? 'Verbunden' : 'Getrennt'}</span>
      </div>

      <div id="join-status" className="text-xs text-gray-600 mt-2">
        Nicht beigetreten
      </div>


    <div className="flex items-center gap-2">
      <input
        className="w-full p-2 border rounded text-sm"
        placeholder="Chat ID"
        value={chatId}
        onChange={(e) => setChatId(e.target.value)}
      />
      <button
        onClick={joinChat}
        disabled={!connected}
        className="px-3 py-1 rounded-full text-xs border bg-white hover:bg-gray-100"
      >
        Beitreten
      </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          className="flex-1 p-2 border rounded text-sm"
          placeholder="Nachricht eingeben..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <select
          className="text-sm border h-full rounded px-2 py-1"
          value={actionType}
          onChange={(e) => setActionType(e.target.value as 'message' | 'broadcast')}
        >
          <option value="message">Normale Nachricht</option>
          <option value="broadcast">Broadcast</option>
        </select>
        <button
          onClick={sendMessage}
          disabled={!connected}
          className={`px-3 py-2 rounded-full text-xs font-medium border transition ${
            connected ? 'bg-black text-white hover:bg-gray-800' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Senden
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold mb-1">Empfangene Nachrichten</h3>
          <ul className="space-y-1 text-sm">
            {receivedMessages.map((msg, i) => (
              <li
                key={i}
                className={`p-2 rounded border ${
                  msg.fromSelf ? 'text-right bg-gray-100' : 'text-left bg-white'
                }`}
              >
                <div className="text-xs text-gray-400">{msg.chatId}</div>
                <div>{msg.text}</div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-1">Statusnachrichten</h3>
          <ul className="space-y-1 text-sm">
            {statusMessages.map((status, i) => (
              <li key={i} className="p-2 border rounded text-xs bg-gray-50">
                <div><strong>TrayId:</strong> {status.trayId}</div>
                <div><strong>Status:</strong> {status.status}</div>
                <div><strong>Nachricht:</strong> {status.message}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default WebSocketTest;
