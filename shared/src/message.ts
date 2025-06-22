import { UUID } from "crypto";

export type WsMessage = {
  action: Action;
  content: string;
  senderID: UUID;
  senderToken?: string;
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
  Init = "Init",
  MessageResponse = "MessageResponse",
  DH_PUBLIC_EX = "dhpublic", //Diffie-Hellman public key exchange
  CK_EX = "chatkey", //Chat key exchange
}
