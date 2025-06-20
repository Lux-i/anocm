import { UUID } from "crypto";
import { Database } from "../database/database";
import { UserManager } from "../userManager/userManager";
import { Action, WsMessage, ResponseContent } from "@anocm/shared/dist";
import { validate } from "uuid";
import { WebSocket as WebSocketType } from "ws";

export async function broadcastToChat(message: WsMessage) {
    const messageCopy = JSON.parse(JSON.stringify(message));
    
    
    const res = await Database.getChatMessages(messageCopy.chatID, messageCopy.senderID, messageCopy.senderToken!);

    if (res === false) {
        UserManager.sendMessage(
            messageCopy.senderID,
            messageResponse(messageCopy.senderID, {
                success: false,
                message: `Database Error`,
            }, messageCopy.chatID)
        );
        return;
    }

    
    const uniqueSenderIDs = new Set(
        Object.values(res)
            .map((entry) => entry.senderId)
            .filter((id) => isUUID(id))
    );

    uniqueSenderIDs.forEach((uuid) => {
        const result = UserManager.sendMessage(uuid as UUID, messageCopy);
        console.log("res: ", result);
    });

    UserManager.sendMessage(
        messageCopy.senderID,
        messageResponse(messageCopy.senderID, {
            success: true,
            message: `Message broadcasted to Clients in '${messageCopy.chatID}'`,
        }, messageCopy.chatID)
    );
}

export async function initWebsocketWithUserManager(message: WsMessage, ws: WebSocketType) {
    if (!isUUID(message.senderID)) {
        ws.send(JSON.stringify(messageResponse(message.senderID, {
            success: false,
            message: `Invalid UUID "${message.senderID}"`,
        }, message.chatID)));
    }

    UserManager.setUser(message.senderID, ws);

    if (UserManager.isConnected(message.senderID)) {
        UserManager.sendMessage(
            message.senderID,
            messageResponse(message.senderID, {
                success: true,
                message: `Connected user "${message.senderID}" to account websocket`,
            }, message.chatID)
        );
    } else {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(messageResponse(message.senderID, {
                success: false,
                message: `Could not connect "${message.senderID}" to account websocket`,
            }, message.chatID)));
        }
    }


}
//#region other
/** 
 this is to assert that if the output is true, value is of type UUID
 */
function isUUID(value: string): value is UUID {
  return validate(value);
}

/**
 *
 * @param senderID UUID of the sender
 * @param content of type Response Content, has sucess bool, message and json response
 * @returns Message object
 */
function messageResponse(senderID: UUID, content: ResponseContent, chatID: UUID): WsMessage {
    const msg: WsMessage = {
        action: Action.MessageResponse,
        content: JSON.stringify(content),
        timestamp: Date.now(),
        senderID: senderID,
        chatID: chatID,
    };

  return msg;
}

//#endregion
