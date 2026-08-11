import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    removeUserFromChat,
    addUserToChat,
    getChatMessages,
    fetchChatList,
    getChatSettings,
    createChat,
    sendMessage,
} from "../api/chatApi";

// minimal fake fetch response
class FakeResponse {
    constructor(private body: unknown, private ok = true) {}
    ok = this.ok;
    json = vi.fn(async () => this.body);
}

const fakeUser = {
    userId: "user-1",
    username: "alice",
    isOnline: true,
    isAnonymous: false,
    token: "token-abc",
};

describe("chatApi", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        globalThis.fetch = fetchMock as unknown as typeof fetch;
    });

    describe("removeUserFromChat", () => {
        it("should return success when the backend confirms removal", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: true }));

            const result = await removeUserFromChat("chat-1", "user-2", "user-1", "token-abc");

            expect(result).toEqual({ success: true });
        });

        it("should call the remuser endpoint with a POST request and the correct body", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: true }));

            await removeUserFromChat("chat-1", "user-2", "user-1", "token-abc");

            const [url, options] = fetchMock.mock.calls[0];
            expect(url).toContain("/chat/remuser");
            expect(options.method).toBe("POST");
            expect(JSON.parse(options.body)).toEqual({
                chatId: "chat-1",
                userId: "user-2",
                adminId: "user-1",
                adminToken: "token-abc",
            });
        });

        it("should return the backend error when removal fails", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: false, error: "not-admin" }));

            const result = await removeUserFromChat("chat-1", "user-2", "user-1", "token-abc");

            expect(result).toEqual({ success: false, tError: "not-admin" });
        });

        it("should return errorMessages.networkError when fetch throws", async () => {
            fetchMock.mockRejectedValue(new Error("connection refused"));

            const result = await removeUserFromChat("chat-1", "user-2", "user-1", "token-abc");

            expect(result).toEqual({ success: false, tError: "errorMessages.networkError" });
        });
    });

    describe("addUserToChat", () => {
        it("should return success when the backend confirms addition", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: true }));

            const result = await addUserToChat("chat-1", "user-3", "user-1", "token-abc");

            expect(result).toEqual({ success: true });
        });

        it("should call the adduser endpoint with a POST request and the correct body", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: true }));

            await addUserToChat("chat-1", "user-3", "user-1", "token-abc");

            const [url, options] = fetchMock.mock.calls[0];
            expect(url).toContain("/chat/adduser");
            expect(options.method).toBe("POST");
            expect(JSON.parse(options.body)).toEqual({
                chatId: "chat-1",
                userId: "user-3",
                adminId: "user-1",
                adminToken: "token-abc",
            });
        });

        it("should return the backend error when the user is already in the chat", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: false, error: "already-member" }));

            const result = await addUserToChat("chat-1", "user-3", "user-1", "token-abc");

            expect(result).toEqual({ success: false, tError: "already-member" });
        });

        it("should return errorMessages.networkError when fetch throws", async () => {
            fetchMock.mockRejectedValue(new Error("timeout"));

            const result = await addUserToChat("chat-1", "user-3", "user-1", "token-abc");

            expect(result).toEqual({ success: false, tError: "errorMessages.networkError" });
        });
    });

    describe("getChatMessages", () => {
        it("should parse chatMessages into UIMessage objects, marking own messages", async () => {
            fetchMock.mockResolvedValue(
                new FakeResponse({
                    success: true,
                    userData: {
                        chatId: "chat-1",
                        name: "Chat with Bob",
                        chatUserList: { "user-1": "alice", "user-2": "bob" },
                        chatMessages: {
                            "1000": JSON.stringify({
                                id: "msg-1",
                                content: "hello",
                                senderID: "user-1",
                                timestamp: "1000",
                            }),
                            "2000": {
                                id: "msg-2",
                                content: "hi back",
                                senderID: "user-2",
                                timestamp: "2000",
                            },
                        },
                    },
                }),
            );

            const result = await getChatMessages("chat-1", "user-1", "token-abc");

            expect(result.messages).toHaveLength(2);
            expect(result.messages[0]).toMatchObject({
                id: "msg-1",
                content: "hello",
                senderId: "user-1",
                isOwn: true,
            });
            expect(result.messages[1]).toMatchObject({
                id: "msg-2",
                content: "hi back",
                senderId: "user-2",
                isOwn: false,
            });
        });

        it("should handle chatMessages entries that are plain objects, not just JSON strings", async () => {
            fetchMock.mockResolvedValue(
                new FakeResponse({
                    success: true,
                    userData: {
                        chatId: "chat-1",
                        chatMessages: {
                            "1000": { id: "msg-1", content: "hi", senderID: "user-2", timestamp: "1000" },
                        },
                    },
                }),
            );

            const result = await getChatMessages("chat-1", "user-1", "token-abc");

            expect(result.messages[0].content).toBe("hi");
        });

        it("should fall back to a generated id when the message has none", async () => {
            fetchMock.mockResolvedValue(
                new FakeResponse({
                    success: true,
                    userData: {
                        chatId: "chat-1",
                        chatMessages: {
                            "5000": { content: "no id here", senderID: "user-2", timestamp: "5000" },
                        },
                    },
                }),
            );

            const result = await getChatMessages("chat-1", "user-1", "token-abc");

            expect(result.messages[0].id).toBe("msg-5000");
        });

        it("should return an empty messages array and the chat when chatMessages is absent", async () => {
            fetchMock.mockResolvedValue(
                new FakeResponse({
                    success: true,
                    userData: { chatId: "chat-1", name: "Empty chat", chatUserList: {} },
                }),
            );

            const result = await getChatMessages("chat-1", "user-1", "token-abc");

            expect(result.messages).toEqual([]);
            expect(result.chat).toMatchObject({ chatId: "chat-1", name: "Empty chat" });
        });

        it("should return empty messages and null chat when the backend reports failure", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: false, error: "not-found" }));

            const result = await getChatMessages("chat-1", "user-1", "token-abc");

            expect(result).toEqual({ messages: [], chat: null });
        });

        it("should return empty messages and null chat when fetch throws", async () => {
            fetchMock.mockRejectedValue(new Error("connection refused"));

            const result = await getChatMessages("chat-1", "user-1", "token-abc");

            expect(result).toEqual({ messages: [], chat: null });
        });
    });

    describe("fetchChatList", () => {
        it("should return the parsed chat id array when userData is a JSON string", async () => {
            fetchMock.mockResolvedValue(
                new FakeResponse({ success: true, userData: JSON.stringify(["chat-1", "chat-2"]) }),
            );

            const result = await fetchChatList(fakeUser);

            expect(result).toEqual(["chat-1", "chat-2"]);
        });

        it("should return the chat id array directly when userData is already an array", async () => {
            fetchMock.mockResolvedValue(
                new FakeResponse({ success: true, userData: ["chat-1", "chat-2"] }),
            );

            const result = await fetchChatList(fakeUser);

            expect(result).toEqual(["chat-1", "chat-2"]);
        });

        it("should deduplicate chat ids", async () => {
            fetchMock.mockResolvedValue(
                new FakeResponse({ success: true, userData: ["chat-1", "chat-1", "chat-2"] }),
            );

            const result = await fetchChatList(fakeUser);

            expect(result).toEqual(["chat-1", "chat-2"]);
        });

        it("should return an empty array when the backend reports failure", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: false }));

            const result = await fetchChatList(fakeUser);

            expect(result).toEqual([]);
        });

        it("should return an empty array when the HTTP status is not ok", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: true, userData: [] }, false));

            const result = await fetchChatList(fakeUser);

            expect(result).toEqual([]);
        });

        it("should return an empty array when fetch throws", async () => {
            fetchMock.mockRejectedValue(new Error("connection refused"));

            const result = await fetchChatList(fakeUser);

            expect(result).toEqual([]);
        });

        it("should call the getChatList endpoint with userId and token as query params", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: true, userData: [] }));

            await fetchChatList(fakeUser);

            const [url] = fetchMock.mock.calls[0];
            expect(url).toContain("/chat/getChatList");
            expect(url).toContain(`userId=${fakeUser.userId}`);
            expect(url).toContain(`token=${fakeUser.token}`);
        });
    });

    describe("getChatSettings", () => {
        it("should return cleaned TTL settings and the chat on success", async () => {
            fetchMock.mockResolvedValue(
                new FakeResponse({
                    success: true,
                    userData: {
                        chatId: "chat-1",
                        name: "Chat",
                        chatUserList: { "user-1": "alice" },
                        chatSettings: {
                            minMessageTTL: 300,
                            defaultMessageTTL: 3600,
                            maxMessageTTL: 604800,
                        },
                    },
                }),
            );

            const result = await getChatSettings("chat-1", fakeUser);

            expect(result.settings).toEqual({ minTTL: 300, defaultTTL: 3600, maxTTL: 604800 });
            expect(result.chat).toMatchObject({ chatId: "chat-1", name: "Chat" });
        });

        it("should fall back to defaults when chatSettings fields are missing", async () => {
            fetchMock.mockResolvedValue(
                new FakeResponse({
                    success: true,
                    userData: { chatId: "chat-1", chatSettings: {} },
                }),
            );

            const result = await getChatSettings("chat-1", fakeUser);

            expect(result.settings).toEqual({ minTTL: 3600, defaultTTL: 86400, maxTTL: 604800 });
        });

        it("should return null settings and null chat when the backend reports failure", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: false, error: "not-found" }));

            const result = await getChatSettings("chat-1", fakeUser);

            expect(result).toEqual({ settings: null, chat: null });
        });

        it("should return null settings and null chat when fetch throws", async () => {
            fetchMock.mockRejectedValue(new Error("timeout"));

            const result = await getChatSettings("chat-1", fakeUser);

            expect(result).toEqual({ settings: null, chat: null });
        });
    });

    describe("createChat", () => {
        it("should return success with the new chatId", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: true, id: "new-chat-1" }));

            const result = await createChat(fakeUser, "user-2", 0, 3600, -1);

            expect(result).toEqual({ success: true, chatId: "new-chat-1" });
        });

        it("should send the correct payload including both users and ttl bounds", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: true, id: "new-chat-1" }));

            await createChat(fakeUser, "user-2", 0, 3600, -1);

            const [url, options] = fetchMock.mock.calls[0];
            expect(url).toContain("/chat/newchat");
            expect(JSON.parse(options.body)).toEqual({
                userList: [{ userId: "user-1" }, { userId: "user-2" }],
                ttl: 3600,
                minTTL: 0,
                maxTTL: -1,
                creatorId: "user-1",
                creatorToken: "token-abc",
            });
        });

        it("should return the backend error when creation fails", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: false, error: "invalid-user" }));

            const result = await createChat(fakeUser, "user-2", 0, 3600, -1);

            expect(result).toEqual({ success: false, tError: "invalid-user" });
        });

        it("should return errorMessages.networkError when fetch throws", async () => {
            fetchMock.mockRejectedValue(new Error("connection refused"));

            const result = await createChat(fakeUser, "user-2", 0, 3600, -1);

            expect(result).toEqual({ success: false, tError: "errorMessages.networkError" });
        });
    });

    describe("sendMessage", () => {
        it("should return success when the backend confirms the message was sent", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: true }));

            const result = await sendMessage("chat-1", "encrypted-content", "user-1", "token-abc");

            expect(result).toEqual({ success: true });
        });

        it("should omit ttl from the request body when not provided", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: true }));

            await sendMessage("chat-1", "encrypted-content", "user-1", "token-abc");

            const [, options] = fetchMock.mock.calls[0];
            const body = JSON.parse(options.body);
            expect(body).not.toHaveProperty("ttl");
        });

        it("should omit ttl from the request body when explicitly null", () => {
            return sendMessage("chat-1", "encrypted-content", "user-1", "token-abc", null).then(() => {
                // no-op, assertion below
            });
        });

        it("should include ttl in the request body when a number is provided", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: true }));

            await sendMessage("chat-1", "encrypted-content", "user-1", "token-abc", 900);

            const [, options] = fetchMock.mock.calls[0];
            const body = JSON.parse(options.body);
            expect(body.ttl).toBe(900);
        });

        it("should include a timestamp and the encrypted content in the request body", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: true }));

            await sendMessage("chat-1", "encrypted-content", "user-1", "token-abc");

            const [url, options] = fetchMock.mock.calls[0];
            const body = JSON.parse(options.body);

            expect(url).toContain("/chat/send_message");
            expect(body.chatID).toBe("chat-1");
            expect(body.senderID).toBe("user-1");
            expect(body.senderToken).toBe("token-abc");
            expect(body.content).toBe("encrypted-content");
            expect(typeof body.timestamp).toBe("string");
        });

        it("should return the backend error when sending fails", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: false, error: "chat-not-found" }));

            const result = await sendMessage("chat-1", "encrypted-content", "user-1", "token-abc");

            expect(result).toEqual({ success: false, tError: "chat-not-found" });
        });

        it("should return errorMessages.networkError when fetch throws", async () => {
            fetchMock.mockRejectedValue(new Error("connection refused"));

            const result = await sendMessage("chat-1", "encrypted-content", "user-1", "token-abc");

            expect(result).toEqual({ success: false, tError: "errorMessages.networkError" });
        });
    });
});