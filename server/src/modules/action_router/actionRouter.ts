import { addClientToChat, broadcastToChat } from "../chats/chat";
import { Message } from "../chats/types";
import { Action } from "./types"

import { WebSocket } from "ws"

export function routeMessageAction(message: Message, ws: WebSocket) {
    switch (message.action) {
        case Action.Message:
            broadcastToChat(message, ws);
            return true;
        case Action.DebugJoinChat:
            addClientToChat(message, ws);
            return true;
        case Action.DebugBroadcast:
        case Action.None:
        default:
            console.log("Didnt route anything");
            return false;
    }
}