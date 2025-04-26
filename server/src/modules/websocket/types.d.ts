import { UUID } from "crypto";
import "ws";

import "ws";

declare module "ws" {
  interface WebSocket {
    uid?: UUID;
  }
}
