import { UUID } from "crypto";
import { Message } from "./types";
import { Database } from "../database/database";
import UserManager from "../userManager/userManager";
import { Action } from "../action_router/types";
import { validate } from "uuid"

export async function broadcastToChat(message: Message, database: Database, handler: UserManager) {
    const res = await database.getChat(message.chatID);

    if (res === false) {

        const msg: Message = {
            action: Action.MessageResponse,
            content: `Message could not be broadcasted to chat with id "${message.chatID}"`,
            timestamp: Date.now(),
            senderID: message.senderID,
            chatID: message.senderID
        };

        handler.sendMessage(message.senderID, msg)
        return;
    }

    res.chatUserList.forEach(user => {
        if (validate(user)) {
            handler.sendMessage(user as UUID, message);
        }
    });
}

function addToChatNoConfirm() {

}

function removeFromChatNoConfirm() {

}