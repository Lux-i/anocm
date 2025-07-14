// Load environment variables
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
const http = require("http");
const app = express();

// Connect to database
Database.connectClient().then((succeeded: boolean) => {
  if (!succeeded) {
    console.log("Could not connect to Database");
    process.exit(1);
  }
});

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10000,
  standardHeaders: "draft-8",
  message: { error: "Too many requests!" },
});

export const createUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  message: { error: "Too many user creation requests!" },
});

app.use(limiter);

//#region middleware
app.use(
  cors({
    origin: ["https://anocm.onrender.com"], // add others if needed
  })
);

// JSON parsing and error handler
app.use(
  express.json(),
  (err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({ message: "Invalid JSON format." });
    }
    next();
  }
);

// Static files (frontend)
app.use(
  express.static(__dirname + "/public", {
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
);
console.log("Serving static files from:", __dirname + "/public");
import fs from "fs";
console.log("Public dir contents:", fs.readdirSync(__dirname + "/public"));
//#endregion

// Templating (if used)
app.engine("html", require("ejs").renderFile);
app.set("views", __dirname + "/html");
app.set("view engine", "ejs");
app.set("trust proxy", 1);

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

// Create and start HTTP server (Render will provide HTTPS externally)
const server = http.createServer(app);

// WebSocket setup
const wss = new WebSocket.Server({ server });

wss.on("connection", async (ws: WebSocketType, req: Request) => {
  ws.send(JSON.stringify({ msg: "Connected to WebSocket" }));

  ws.on("message", async (data: WebSocket.RawData) => {
    const message: WsMessage = JSON.parse(data.toString());
    routeMessageAction(message, ws);

    console.log(`Received message: ${message.content}`);
  });

  ws.on("close", async () => {
    console.log("WebSocket disconnected");
  });
});

// Render sets PORT automatically
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
