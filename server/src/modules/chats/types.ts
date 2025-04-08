import { UUID } from "crypto";
import { Action } from "../action_router/types";
import { WebSocket } from "ws"


export interface Chat {
    id: UUID,
    clients: Array<WebSocket>,
}

export type Message = {
    action: Action,
    text: String,
    chatId: UUID
}
