import { WsMessage, Action } from "@anocm/shared/dist";
import {
  broadcastToChat,
  initWebsocketWithUserManager,
} from "../message/message";
import { WebSocket as WebSocketType } from "ws";
import { UserManager } from "../userManager/userManager";
import { UUID } from "crypto";
/**
 *
 * @param message message object
 * @param database database to send messages / response
 * @param handler singleton ws manager
 */

export function routeMessageAction(message: WsMessage, ws: WebSocketType) {
  switch (message.action) {
    case Action.BroadcastToChat || Action.CK_REQ:
      broadcastToChat(message);
      break;
    case Action.Init:
      initWebsocketWithUserManager(message, ws);
      break;
    case Action.DH_PUBLIC_EX || Action.CK_EX:
      //this action uses the chatID as the user ID and encapsulates the chatID into the content
      UserManager.sendMessage(message.chatID, message);
      break;
    case Action.None:
    case Action.MessageResponse:
    default:
      return false;
  }
}
