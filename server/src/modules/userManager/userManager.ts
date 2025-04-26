//utility class to interact with a websocket connection based on a UUID

import { UUID } from "crypto";
import { Message } from "../chats/types";
import { WebSocket } from "ws";

export namespace UserManager {
  const users: Map<UUID, WebSocket> = new Map();

  /**
   * Sets the given websocket to be the one associated to the given user UUID in the map
   * @param id a users UUID
   * @param ws the websocket associated to the user
   */
  export function setUser(id: UUID, ws: WebSocket): void {
    //remove set uid from old websocket if one is still connected
    const oldWS = users.get(id);
    if (oldWS) delete oldWS.uid;

    //map to new websocket and set it's uid
    users.set(id, ws);
    ws.uid = id;

    //close (disconnect) event deletes uid and removes the websocket from mapping
    ws.on("close", () => {
      const storedWs = users.get(id);
      //checks if the closing WebSocket is still the one being mapped to by it's id
      //if it is, the map entry is deleted
      if (storedWs === ws) {
        users.delete(id);
      }
      //always delete it's uid
      delete ws.uid;
    });
  }

  /**
   * @param id a users UUID
   * @returns if the user (the websocket) is connected
   */
  export function isConnected(id: UUID): boolean {
    if (users.has(id)) {
      return users.get(id)?.readyState == WebSocket.OPEN;
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
  export function sendMessage(id: UUID, message: Message): boolean {
    if (isConnected(id)) {
      //get ws connection
      const conn = users.get(id) as WebSocket;
      //send msg
      conn.send(JSON.stringify(message));
      return true;
    } else {
      return false;
    }
  }

  //DATA INFO

  export function getConnectedCount(): number {
    return users.size;
  }
}
