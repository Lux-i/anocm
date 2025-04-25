import { Message, Action } from "@anocm/shared/dist";
import { addToChatNoConfirm, broadcastToChat, removeFromChatNoConfirm } from "../message/message";

import { Database } from "../database/database";
import UserManager from "../userManager/userManager";

/**
 * 
 * @param message message object
 * @param database database to send messages / response
 * @param handler singleton ws manager
 */

export function routeMessageAction(message: Message, database: Database, handler: UserManager) {
    switch (message.action) {
        case Action.BroadcastToChat:
            broadcastToChat(message, database, handler);
            break;
        case Action.AddClientToChatNoConfirm:
            addToChatNoConfirm(message, database, handler);
            break;
        case Action.RemoveClientFromChatNoConfirm:
            removeFromChatNoConfirm(message, database, handler);
            break;
        case Action.None:
        case Action.MessageResponse:
        default:
            console.log("Didnt route anything");
            return false;
    }
}