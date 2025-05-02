import { Message, Action } from "@anocm/shared/dist";
import {
  addToChatNoConfirm,
  broadcastToChat,
  removeFromChatNoConfirm,
} from "../message/message";

/**
 *
 * @param message message object
 * @param database database to send messages / response
 * @param handler singleton ws manager
 */

export function routeMessageAction(message: Message) {
  switch (message.action) {
    case Action.BroadcastToChat:
      broadcastToChat(message);
      break;
    case Action.AddClientToChatNoConfirm:
      addToChatNoConfirm(message);
      break;
    case Action.RemoveClientFromChatNoConfirm:
      removeFromChatNoConfirm(message);
      break;
    case Action.None:
    case Action.MessageResponse:
    default:
      console.log("Didnt route anything");
      return false;
  }
}
