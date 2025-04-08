import { randomUUID, UUID } from "crypto";
import { Chat, Message } from "./types";
import { WebSocket } from "ws"


const testChatId = randomUUID();

console.log(`Chatid: ${testChatId}`);


const chats: Array<Chat> = [
    {
        id: testChatId,
        clients: []
    }
]

export function broadcastToChat(message: Message, ws: WebSocket) {
    if (message.chatId === null || message.chatId === undefined) {
        ws.send(JSON.stringify(`Did not send message ${message.text}. No chatid specified"`))
        return;
    }

    ws.send(JSON.stringify(`Sent Message ${message.text} to chat "${message.chatId}"`))

    let currentChat: Chat | undefined;

    chats.forEach(chat => {
        if (chat.id === message.chatId) {
            currentChat = chat;
        }
    });

    // if chat was found broadcast, else do nothing
    currentChat?.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message.text));
        }
    })
}

export function addClientToChat(message: Message, ws: WebSocket) {
    if (message.chatId === null || message.chatId == undefined) {
        ws.send(JSON.stringify(`Couldnt add to chat, no id specified"`))
        return;
    }

    chats.forEach(chat => {
        if (chat.id === message.chatId) {
            chat.clients.push(ws);

            ws.send(JSON.stringify(`Adding client to chat ${message.chatId}`))
        }
    })

    // debug log
    console.log(chats);
}