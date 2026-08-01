import { describe, it, expect, beforeEach, vi } from "vitest";
import { createAnonymousUser, loginUser, registerUser } from "../api/authApi";

// minimal fake fetch response
class FakeResponse {
    constructor(private body: unknown) {}
    json = vi.fn(async () => this.body);
}

describe("authApi", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        globalThis.fetch = fetchMock as unknown as typeof fetch;
    });

    describe("createAnonymousUser", () => {
        it("should return success with the new userId", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: true, id: "anon-123" }));

            const result = await createAnonymousUser();

            expect(result).toEqual({ success: true, userId: "anon-123" });
        });

        it("should call the newano endpoint with a POST request", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: true, id: "anon-123" }));

            await createAnonymousUser();

            const [url, options] = fetchMock.mock.calls[0];
            expect(url).toContain("/user/newano");
            expect(options.method).toBe("POST");
        });

        it("should return the backend error when creation fails", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: false, error: "rate-limited" }));

            const result = await createAnonymousUser();

            expect(result).toEqual({ success: false, tError: "rate-limited" });
        });

        it("should return errorMessages.networkError when fetch throws", async () => {
            fetchMock.mockRejectedValue(new Error("connection refused"));

            const result = await createAnonymousUser();

            expect(result).toEqual({ success: false, tError: "errorMessages.networkError" });
        });
    });

    describe("loginUser", () => {
        it("should return userId and token for the v2 array response shape", async () => {
            fetchMock.mockResolvedValue(
                new FakeResponse({ success: true, userData: ["user-1", "token-abc"] }),
            );

            const result = await loginUser("alice", "hunter2");

            expect(result).toEqual({ success: true, userId: "user-1", token: "token-abc" });
        });

        it("should return userId from data.id and token from the string response shape", async () => {
            fetchMock.mockResolvedValue(
                new FakeResponse({ success: true, id: "user-2", userData: "token-xyz" }),
            );

            const result = await loginUser("bob", "");

            expect(result).toEqual({ success: true, userId: "user-2", token: "token-xyz" });
        });

        it("should return errorMessages.unexpectedResponse when userData has neither shape", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: true, userData: { weird: true } }));

            const result = await loginUser("alice", "pw");

            expect(result).toEqual({ success: false, tError: "errorMessages.unexpectedResponse" });
        });

        it("should return the backend error on invalid credentials", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: false, error: "invalid-credentials" }));

            const result = await loginUser("alice", "wrongpw");

            expect(result).toEqual({ success: false, tError: "invalid-credentials" });
        });

        it("should return errorMessages.networkError when fetch throws", async () => {
            fetchMock.mockRejectedValue(new Error("timeout"));

            const result = await loginUser("alice", "pw");

            expect(result).toEqual({ success: false, tError: "errorMessages.networkError" });
        });

        it("should omit password from the request body when logging in anonymously", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: true, userData: ["u", "t"] }));

            await loginUser("anon-user", "");

            const [, options] = fetchMock.mock.calls[0];
            const body = JSON.parse(options.body);

            expect(body).toEqual({ userId_username: "anon-user" });
        });

        it("should include password in the request body when provided", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: true, userData: ["u", "t"] }));

            await loginUser("alice", "hunter2");

            const [, options] = fetchMock.mock.calls[0];
            const body = JSON.parse(options.body);

            expect(body).toEqual({ userId_username: "alice", password: "hunter2" });
        });
    });

    describe("registerUser", () => {
        it("should return success with the new userId", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: true, id: "new-user-1" }));

            const result = await registerUser("charlie", "pw123");

            expect(result).toEqual({ success: true, userId: "new-user-1" });
        });

        it("should send username and password in the request body", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: true, id: "new-user-1" }));

            await registerUser("charlie", "pw123");

            const [url, options] = fetchMock.mock.calls[0];
            expect(url).toContain("/user/newuser");
            expect(JSON.parse(options.body)).toEqual({ username: "charlie", password: "pw123" });
        });

        it("should return the backend error when the username is taken", async () => {
            fetchMock.mockResolvedValue(new FakeResponse({ success: false, error: "username-taken" }));

            const result = await registerUser("charlie", "pw123");

            expect(result).toEqual({ success: false, tError: "username-taken" });
        });

        it("should return errorMessages.networkError when fetch throws", async () => {
            fetchMock.mockRejectedValue(new Error("connection refused"));

            const result = await registerUser("charlie", "pw123");

            expect(result).toEqual({ success: false, tError: "errorMessages.networkError" });
        });
    });
});