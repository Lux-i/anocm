import { Message } from "../message/types";
import { Action } from "./types"
import { broadcastToChat } from "../message/message";

import { WebSocket } from "ws"
import { Database } from "../database/database";
import UserManager from "../userManager/userManager";

export function routeMessageAction(message: Message, database: Database, handler: UserManager) {
    switch (message.action) {
        case Action.BroadcastToChat:
            broadcastToChat(message, database, handler);
            break;
        case Action.None:
        case Action.MessageResponse:
        default:
            console.log("Didnt route anything");
            return false;
    }
}