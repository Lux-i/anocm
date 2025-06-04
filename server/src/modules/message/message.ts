import { UUID } from "crypto";
import { Database } from "../database/database";
import { UserManager } from "../userManager/userManager";
import { Action, Message, ResponseContent } from "@anocm/shared/dist";
import { validate } from "uuid";

export async function broadcastToChat(message: Message) {
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

  let successful: number = 0;

  Object.keys(res.chatUserList).forEach((id) => {
    if (isUUID(id)) {
      const uuid: UUID = id;
      UserManager.sendMessage(uuid, message);
      successful++;
    }
  });

  UserManager.sendMessage(
    message.senderID,
    messageResponse(message.senderID, {
      success: true,
      message: `Message broadcasted to ${successful} Clients in '${message.chatID}'`,
    })
  );
}

//#region Unsafe

/**
 *
 * @param message Message object (here content has to be a valid UUID)
 * @param database Database object
 * @returns
 */
export async function addToChatNoConfirm(message: Message) {
  let receiver = isUUID(message.content) ? message.content : null;

  if (receiver === null) {
    UserManager.sendMessage(
      message.senderID,
      messageResponse(message.senderID, {
        success: false,
        message: "Wrong format for content, should be UUID",
      })
    );

    return;
  }

  const res = await Database.addUsertoChat(message.chatID, receiver);

  if (res === false) {
    UserManager.sendMessage(
      message.senderID,
      messageResponse(message.senderID, {
        success: false,
        message: "Could not add user to chat. User or chat may be invalid",
      })
    );

    return;
  } else {
    UserManager.sendMessage(
      message.senderID,
      messageResponse(message.senderID, {
        success: true,
        message: `Added client ${message.content} to chat ${message.chatID}`,
      })
    );
  }
}

// basically the same as add, might be able to save some code work but am too lazy rn
/**
 *
 * @param message Message object (here content has to be a valid UUID)
 * @param database Database object
 * @returns
 */
export async function removeFromChatNoConfirm(message: Message) {
  let reciever = isUUID(message.content) ? message.content : null;

  if (reciever === null) {
    UserManager.sendMessage(
      message.senderID,
      messageResponse(message.senderID, {
        success: false,
        message: "Wrong format for content, should be UUID",
      })
    );

    return;
  }

  console.log(reciever);

  const res = await Database.deleteUserFromChat(message.chatID, reciever);

  console.log(res);

  if (res === false) {
    UserManager.sendMessage(
      message.senderID,
      messageResponse(message.senderID, {
        success: false,
        message: "Could not remove user from chat.",
      })
    );

    return;
  } else {
    UserManager.sendMessage(
      message.senderID,
      messageResponse(message.senderID, {
        success: true,
        message: `Removed user ${message.content} from chat ${message.chatID}`,
      })
    );
  }
}

//#endregion

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
function messageResponse(senderID: UUID, content: ResponseContent): Message {
  const msg: Message = {
    action: Action.MessageResponse,
    content: JSON.stringify(content),
    timestamp: Date.now(),
    senderID: senderID,
    chatID: senderID,
  };

  return msg;
}

//#endregion
