import { Request, Response, NextFunction } from "express";
import WebSocket, { WebSocket as WebSocketType } from "ws";
import { Message } from "./modules/message/types";
import { routeMessageAction } from "./modules/action_router/actionRouter";
import { Database } from "./modules/database/database";
import { Chat } from "./modules/database/databaseTypes";
const express = require("express");
const cors = require("cors");
const app = express();
const server = require("http").createServer(app);

let configPort;
try {
  const { Port } = require("./config.json");
  configPort = Port;
} catch (err) {
  configPort = null;
}

const { request } = require("http");
const portArg = process.argv[2];

const UsedPort = portArg || configPort || 8080;

//#region middleware
app.use(
  cors({
    origin: /^http:\/\/localhost(:[0-9]{1,4})?$/
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

/*
app.use("/auth", require("./routers/auth")); // Auth router
app.use("/action", require("./routers/action")); // Action router
*/

//#endregion
//#region Redis
import { UUID } from "crypto";
import UserManager from "./modules/userManager/userManager";


interface DatabaseResponse {
  success: boolean;
  error?: string;
  id?: string;
  userData?: any;
}

const database = new Database();
app.post("/database/newano", async (req: Request, res: Response) => {
  console.log("POST Request: new anonymous User");
  try {
    database.createAnoUser().then((clientId: string) => {
      const response: DatabaseResponse = {
        success: true,
        id: clientId.toString(),
      }
      res.send(response);
    });
  } catch (err: any) {
    const response: DatabaseResponse = {
      success: false,
      error: err,
    }
    res.send(response);
    console.error("Error sending response: ", err);
  }
});

app.post("/database/newuser", async (req: Request, res: Response) => {
  console.log("POST Request: new User");
  try {
    database.createUser(req.body.username, req.body.password).then((userId: number | false) => {
      if (userId == false) {
        const response: DatabaseResponse = {
          success: false,
          error: "User already exists"
        }
        res.send(response);

      } else {
        const response: DatabaseResponse = {
          success: true,
          id: userId.toString(),
          userData: req.body.username,
        }
        res.send(response);
      }
    });
  } catch (err: any) {
    const response: DatabaseResponse = {
      success: false,
      error: err,
    }
    res.send(response);
    console.error("Error sending response: ", err);
  }
});


app.post("/database/newchat", async (req: Request, res: Response) => {
  console.log("POST Request: new Chat");
  try {
    database.createChat(req.body).then((chatId: UUID | false) => {
      if (chatId != false) {
        const response: DatabaseResponse = {
          success: true,
          id: chatId.toString(),

        }
        res.send(response);

      } else {
        const response: DatabaseResponse = {
          success: false,
          error: `Error creating Chat`
        }
        res.send(response);
      }
    });
  } catch (err: any) {
    const response: DatabaseResponse = {
      success: false,
      error: err,
    }
    res.send(response);
    console.error("Error creating new Chat: ", err);
  }
});


app.get("/database/getchat", async (req: Request, res: Response) => {
  try {
    const chatId = req.query.chatid as string;

    if (!chatId) {
      return res.status(400).json({
        success: false,
        error: "Missing chatid in query.",
      });
    }

    database.getChat(chatId!).then((chat: Chat | false) => {
      const response: DatabaseResponse = {
        success: true,
        userData: chat,
      }
      res.send(response);
    });
  } catch (err: any) {
    const response: DatabaseResponse = {
      success: false,
      error: err,
    }
    res.send(response);
  }

});
//#endregion
//#region Browser Endpoints

app.get("*", (req: Request, res: Response) => {
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

const userManager = new UserManager();

wss.on("connection", (ws: WebSocketType, req: Request) => {
  console.log("Connected to WebSocket");
  ws.send(JSON.stringify({ msg: "Connected to WebSocket" }));

  ws.on("message", (data: WebSocket.RawData) => {
    const message: Message = JSON.parse(data.toString());

    // for testing purposes this should link the ws
    userManager.setUser(message.senderID, ws);

    console.log(`Received message: ${message.content}`);

    let res = routeMessageAction(message, database, userManager);

    //Broadcast to all connected
    if (res === false) {
      wss.clients.forEach((client: WebSocket) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message.content));
        }
      });
    }
  });

  ws.on("close", () => {
    console.log("Disconnected");
  });
});

//#endregion

