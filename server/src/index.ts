//Use env file automatically
const result = require("dotenv").config();

if (result.error) {
  console.error("Env file not working :3");
  process.exit(1);
}

import { Request, Response, NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import WebSocket, { WebSocket as WebSocketType } from "ws";
import { WsMessage } from "@anocm/shared/dist";
import { routeMessageAction } from "./modules/action_router/actionRouter";
import { Database } from "./modules/database/database";
const express = require("express");
const cors = require("cors");
const app = express();

// Connect to database
Database.connectClient().then((succeeded: boolean) => {
  if (!succeeded) {
    console.log("Could not connect to Database");
    process.exit(1);
  }
});

//Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minutes
  limit: 10000,
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
    origin: ["https://anocm.tomatenbot.com"],
  })
);

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
app.set("trust proxy", 1);

//#region locales Endpoints
app.use("/locales", express.static(__dirname + "/locales"));
//#endregion

//#region API Endpoints
const v1Router = require("./routers/v1").default;
app.use("/api/v1", v1Router);

const v2Router = require("./routers/v2").default;
app.use("/api/v2", v2Router);
//#endregion

//#region Browser Endpoints
app.get("/ip", (req: Request, res: Response) => res.send(req.ip));
app.get("*", async (req: Request, res: Response) => {
  res.render(`${__dirname}/dist/index.html`);
});
//#endregion

const Greenlock = require("greenlock-express");

Greenlock.init({
  packageRoot: "../",
  configDir: "./greenlock.d",
  maintainerEmail: "lucjan.lubomski@gmail.com",
  cluster: false,
  // Add debug for verbose logs
  debug: true,
}).ready(httpsWorker);

function httpsWorker(glx: any) {
  const server = glx.httpsServer();

  console.log("WS-Server is starting...");
  // WebSocket setup
  const wss = new WebSocket.Server({ server: server });

  wss.on("connection", async (ws: WebSocketType, req: Request) => {
    // console.log("Connected to WebSocket");
    ws.send(JSON.stringify({ msg: "Connected to WebSocket" }));

    ws.on("message", async (data: WebSocket.RawData) => {
      const message: WsMessage = JSON.parse(data.toString());
      routeMessageAction(message, ws);

      console.log(`Received message: ${message.content}`);
    });

    ws.on("close", async () => {
      console.log("Disconnected");
    });
  });

  glx.serveApp(app);
}
