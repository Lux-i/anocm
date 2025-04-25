import { UUID } from "crypto";

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