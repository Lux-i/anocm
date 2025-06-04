import { WsMessage, Action } from "@anocm/shared/dist";
import {
  broadcastToChat,
} from "../message/message";

/**
 *
 * @param message message object
 * @param database database to send messages / response
 * @param handler singleton ws manager
 */

export function routeMessageAction(message: WsMessage) {
  switch (message.action) {
    case Action.BroadcastToChat:
      broadcastToChat(message);
      break;
    case Action.Init:
      break;
    case Action.None:
    case Action.MessageResponse:
    default:
      return false;
  }
}
