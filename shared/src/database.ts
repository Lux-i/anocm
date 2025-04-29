import { UUID } from "crypto";

export namespace Database{
export interface User {
    userId: string,
    username?: string,
}

export interface Chat {
    chatId: string;
    chatUserList: Record<UUID, string>;
    chatSettings: any;
    chatMessages?: { id: string; message: { [x: string]: string; }; }[];
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