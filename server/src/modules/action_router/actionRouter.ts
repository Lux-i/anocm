import { WsMessage, Action } from "@anocm/shared/dist";
import {
  broadcastToChat,
  initWebsocketWithUserManager,
} from "../message/message";
import { WebSocket as WebSocketType } from "ws";
/**
 *
 * @param message message object
 * @param database database to send messages / response
 * @param handler singleton ws manager
 */

export function routeMessageAction(message: WsMessage, ws: WebSocketType) {
  switch (message.action) {
    case Action.BroadcastToChat:
      broadcastToChat(message);
      break;
    case Action.Init:
      initWebsocketWithUserManager(message, ws);
      break;
    case Action.None:
    case Action.MessageResponse:
    default:
      return false;
  }
}
