//TODO: changed enum to be more descriptive for now (when frontent testing is implemented we can remove it)
export enum Action {
    None = "",
    BroadcastToChat = "BroadcastToChat",
    AddClientToChatNoConfirm = "AddClientToChatNoConfirm",
    RemoveClientFromChatNoConfirm = "RemoveClientFromChatNoConfirm",
    MessageResponse = "MessageResponse"
}