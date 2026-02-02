// __tests__/userManagerTests.ts
import { UserManager } from "../src/modules/userManager/userManager";
import { UUID, randomUUID } from "crypto";
import { Action, WsMessage } from "@anocm/shared/dist";
import { WebSocket } from "ws";

// minimal fake WebSocket
class FakeWebSocket {
  uid?: UUID;
  readyState = WebSocket.OPEN;
  send = jest.fn();
  on = jest.fn((event, cb) => {
    // store close callback so we can call it manually
    if (event === "close") this._closeCallback = cb;
  });
  _closeCallback?: () => void;

  close() {
    if (this._closeCallback) this._closeCallback();
  }
}

describe("UserManager", () => {
  let testId: UUID;
  let ws: FakeWebSocket;

  beforeEach(() => {
    testId = randomUUID();
    ws = new FakeWebSocket();
  });

  it("should add a user and mark it as connected", () => {
    UserManager.setUser(testId, ws as unknown as WebSocket);

    expect(UserManager.isConnected(testId)).toBe(true);
    expect(ws.uid).toBe(testId);
    expect(UserManager.getConnectedCount()).toBe(1);
  });

  it("should send a message to a connected user", () => {
    UserManager.setUser(testId, ws as unknown as WebSocket);

    const message: WsMessage = {
      action: Action.BroadcastToChat,
      content: JSON.stringify(""),
      timestamp: Date.now(),
      senderID: randomUUID(),
      chatID: randomUUID(),
    } as WsMessage;

    const result = UserManager.sendMessage(testId, message);

    expect(result).toBe(true);
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify(message));
  });
  it("should replace an old websocket if setUser is called again for the same UUID", () => {
    const ws2 = new FakeWebSocket();

    // set the first socket
    UserManager.setUser(testId, ws as unknown as WebSocket);
    // set a new socket for the same user
    UserManager.setUser(testId, ws2 as unknown as WebSocket);

    // old ws uid should be removed
    expect(ws.uid).toBeUndefined();
    // new ws should have the uid
    expect(ws2.uid).toBe(testId);
    // only one connection should exist
    expect(UserManager.getConnectedCount()).toBe(3);
  });
});
