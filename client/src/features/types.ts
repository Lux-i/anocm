import { ChatMessage } from "@anocm/shared";

export type UIMessage = ChatMessage & {
    id: string;
    timestamp: Date;
    isOwn: boolean
};