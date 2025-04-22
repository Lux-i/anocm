import { UUID } from "crypto";
import WebSocketWS, { WebSocket as WebSocketWSType } from "ws";

export class WebSocket extends WebSocketWS {
  uid: UUID | null = null;
  lastAuth: number | null = null;
}

export interface WebSocket extends WebSocketWSType {
  uid: UUID | null;
  lastAuth: number | null;
}
