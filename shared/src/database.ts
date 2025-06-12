import { UUID } from "crypto";

export interface User {
  userId: string;
  username?: string;
}

export interface Chat {
  chatId: string;
  chatUserList: Record<UUID, string>;
  chatSettings: any;
  chatMessages?: any;
}

export interface DatabaseResponse {
  success: boolean;
  error?: string;
  id?: string;
  userData?: any;
}

export interface ChatMessage {
  from: UUID;
  message: string;
}

export type messageStructure = {
  [key: EpochTimeStamp]: ChatMessage;
};

export interface chatSettings {
 defaultTTL: number,
 minTTL: number,
 maxTTL: number
}

