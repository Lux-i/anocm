//utility class to interact with a websocket connection based on a UUID

import { UUID } from "crypto";
import { Message } from "../message/types";
import { WebSocket } from "ws";

export default class UserManager {
  private users: Map<UUID, WebSocket> = new Map();

  /**
   * Sets the given websocket to be the one associated to the given user UUID in the map
   * @param id a users UUID
   * @param ws the websocket associated to the user
   */
  public setUser(id: UUID, ws: WebSocket): void {
    this.users.set(id, ws);
  }

  /**
   * @param id a users UUID
   * @returns if the user (the websocket) is connected
   */
  public isConnected(id: UUID): boolean {
    if (this.users.has(id)) {
      return this.users.get(id)?.readyState == WebSocket.OPEN;
    } else {
      return false;
    }
  }

  /**
   * Checks if given user is connected through isConnected
   *
   * Then tries to broadcast given message to the websocket associated to user
   * @param id a users UUID
   * @param message message to send
   * @returns if message could be sent
   */
  public sendMessage(id: UUID, message: Message): boolean {
    if (this.isConnected(id)) {
      //get ws connection
      const conn = this.users.get(id) as WebSocket;
      //send msg
      conn.send(JSON.stringify(message));
      return true;
    } else {
      return false;
    }
  }
}
