import { UUID } from "crypto";
import { Action } from "../action_router/types";

export type Message = {
    action: Action,
    content: String,
    senderID: UUID,
    chatID: UUID,
    timestamp: EpochTimeStamp
}