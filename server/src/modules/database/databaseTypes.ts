import {UUID} from "crypto";

export interface User {
    userId: string,
    username?: string,
}

export interface Chat {
    chatId: string;
    chatUserList: any;
    chatSettings: any;
    chatMessages?: string[];
}