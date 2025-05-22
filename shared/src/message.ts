import { UUID } from "crypto";

export type Message = {
  action: Action;
  content: string;
  senderID: UUID;
  chatID: UUID;
  timestamp: EpochTimeStamp;
};

export type ResponseContent = {
  success: boolean;
  message: String;
  json?: Object;
};

export enum Action {
  None = "",
  BroadcastToChat = "BroadcastToChat",
  AddClientToChatNoConfirm = "AddClientToChatNoConfirm",
  RemoveClientFromChatNoConfirm = "RemoveClientFromChatNoConfirm",
  MessageResponse = "MessageResponse",
}
