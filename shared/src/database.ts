import { UUID } from "crypto";

export namespace DatabaseTypes{
export interface User {
    userId: string,
    username?: string,
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
    timestamp: EpochTimeStamp;
}}