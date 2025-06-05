import { UUID } from "crypto";
import { Database } from "../database/database";
import { UserManager } from "../userManager/userManager";
import { Action, WsMessage, ResponseContent } from "@anocm/shared/dist";
import { validate } from "uuid";
import { WebSocket as WebSocketType } from "ws";

export async function broadcastToChat(message: WsMessage) {
    const res = await Database.getChat(message.chatID);

    if (res === false) {
        UserManager.sendMessage(
            message.senderID,
            messageResponse(message.senderID, {
                success: false,
                message: `Database Error`,
            })
        );
        return;
    }

    if (!(message.senderID in res.chatUserList)) {
        UserManager.sendMessage(
            message.senderID,
            messageResponse(message.senderID, {
                success: false,
                message: `Message could not be broadcasted to chat with id '${message.chatID}'`,
            })
        );
        return;
    }

    Object.keys(res.chatUserList).forEach((id) => {
        if (isUUID(id)) {
            const uuid: UUID = id;
            UserManager.sendMessage(uuid, message);
        }
    });

    UserManager.sendMessage(
        message.senderID,
        messageResponse(message.senderID, {
            success: true,
            message: `Message broadcasted to Clients in '${message.chatID}'`,
        })
    );
}

export async function initWebsocketWithUserManager(message: WsMessage, ws: WebSocketType) {
    if (!isUUID(message.senderID)) {
        ws.send(JSON.stringify(messageResponse(message.senderID, {
            success: false,
            message: `Invalid UUID "${message.senderID}"`,
        })));
    }

    UserManager.setUser(message.senderID, ws);

    if (UserManager.isConnected(message.senderID)) {
        UserManager.sendMessage(
            message.senderID,
            messageResponse(message.senderID, {
                success: true,
                message: `Connected user "${message.senderID}" to account websocket`,
            })
        );
    } else {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(messageResponse(message.senderID, {
                success: false,
                message: `Could not connect "${message.senderID}" to account websocket`,
            })));
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
function messageResponse(senderID: UUID, content: ResponseContent): WsMessage {
    const msg: WsMessage = {
        action: Action.MessageResponse,
        content: JSON.stringify(content),
        timestamp: Date.now(),
        senderID: senderID,
        chatID: senderID,
    };

    return msg;
}

//#endregion
