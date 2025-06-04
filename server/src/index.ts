//Use env file automatically
const result = require("dotenv").config();

if (result.error) {
  console.error("Env file not working :3");
  process.exit(1);
}

import { Request, Response, NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import WebSocket, { WebSocket as WebSocketType } from "ws";
import { Message } from "@anocm/shared/dist";
import { routeMessageAction } from "./modules/action_router/actionRouter";
import { Database } from "./modules/database/database";
import { UserManager } from "./modules/userManager/userManager";
const express = require("express");
const cors = require("cors");
const app = express();
const server = require("http").createServer(app);

Database.connectClient().then((succeeded: boolean) => {
  if (!succeeded) {
    console.log("Could not connect to Database");
    process.exit(1);
  }
});

let configPort;
try {
  const { Port } = require("./config.json");
  configPort = Port;
} catch (err) {
  configPort = null;
}

const portArg = process.argv[2];

const UsedPort = portArg || configPort || 8080;

//Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minutes
  limit: 100,
  standardHeaders: "draft-8",
  message: { error: "Too many requests!" },
});

export const createUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minutes
  limit: 5,
  standardHeaders: "draft-8",
  message: { error: "Too many user creation requests!" },
});

app.use(limiter);

//#region middleware
app.use(
  cors({
    origin: /^http:\/\/localhost(:[0-9]{1,4})?$/,
  })
);

//content security policy for websocket to work when developing
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader(
    "Content-Security-Policy",
    `default-src 'self'; connect-src 'self' ws://localhost:${UsedPort};`
  );
  next();
});

//json and special json-error-handling middleware
app.use(
  express.json(),
  (err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({ message: "Invalid JSON format." });
    }
    next();
  }
);

app.use(
  express.static(__dirname + "/public", {
    //max age one week in ms
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
);
//#endregion
app.engine("html", require("ejs").renderFile);
app.set("views", __dirname + "/html");
app.set("view engine", "ejs");

//#region API Endpoints
const v1Router = require("./routers/v1").default;
app.use("/api/v1", v1Router);

//#endregion

//#region Browser Endpoints

app.get("*", async (req: Request, res: Response) => {
  res.render(`${__dirname}/dist/index.html`);
});

//#endregion

//Use Only when using Greenlock / etc.
//module.exports = app;

server.listen(UsedPort, () => {
  console.log(`Started webserver. Listening on port ${UsedPort}`);
});

//#region WebSocket

const wss = new WebSocket.Server({ server: server });

wss.on("connection", async (ws: WebSocketType, req: Request) => {
  console.log("Connected to WebSocket");
  ws.send(JSON.stringify({ msg: "Connected to WebSocket" }));

  ws.on("message", async (data: WebSocket.RawData) => {
    const message: Message = JSON.parse(data.toString());

    //TODO: for testing purposes this should link the ws
    UserManager.setUser(message.senderID, ws);

    console.log(`Received message: ${message.content}`);

    let res = routeMessageAction(message);

    //Broadcast to all connected
    if (res === false) {
      wss.clients.forEach((client: WebSocket) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message.content));
        }
      });
    }
  });

  ws.on("close", async () => {
    console.log("Disconnected");
  });
});

//#endregion
