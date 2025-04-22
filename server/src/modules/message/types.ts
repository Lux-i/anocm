import { UUID } from "crypto";
import { Action } from "../action_router/types";

export type Message = {
    action: Action,
    content: string,
    senderID: UUID,
    chatID: UUID,
    timestamp: EpochTimeStamp
}

export type ResponseContent = {
    sucess: boolean,
    message: String,
    json?: Object
}