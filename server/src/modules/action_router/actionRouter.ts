import { Message, Action } from "@anocm/shared/dist";
import {
  addToChatNoConfirm,
  broadcastToChat,
  removeFromChatNoConfirm,
} from "../message/message";

import { Database } from "../database/database";

/**
 *
 * @param message message object
 * @param database database to send messages / response
 * @param handler singleton ws manager
 */

export function routeMessageAction(message: Message, database: Database) {
  switch (message.action) {
    case Action.BroadcastToChat:
      broadcastToChat(message, database);
      break;
    case Action.AddClientToChatNoConfirm:
      addToChatNoConfirm(message, database);
      break;
    case Action.RemoveClientFromChatNoConfirm:
      removeFromChatNoConfirm(message, database);
      break;
    case Action.None:
    case Action.MessageResponse:
    default:
      console.log("Didnt route anything");
      return false;
  }
}
