const express = require("express");
const app = express();
const server = require("http").createServer(app);
const WebSocket = require("ws");

const redis = require("redis");
const client = redis.createClient();


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
//content security policy for websocket to work when developing
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    `default-src 'self'; connect-src 'self' ws://localhost:${UsedPort};`
  );
  next();
});

//json and special json-error-handling middleware
app.use(express.json(), (err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ message: "Invalid JSON format." });
  }
  next();
});

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

//#region Browser Endpoints

app.get("*", (req, res) => {
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

wss.on("connection", (ws, req) => {
  console.log("Connected to WebSocket");
  ws.send(JSON.stringify({ msg: "Connected to WebSocket" }));

  ws.on("message", (data) => {
    //test
    const message = JSON.parse(data);
    console.log(`Received message: ${message.text}`);

    ws.send(JSON.stringify(`Received message: "${message.text}" successfully`));

    //Broadcast to all connected
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message.text));
      }
    });
  });

  ws.on("close", () => {
    console.log("Disconnected");
  });
});

//#endregion


//#region Redis
client.on('error', err => console.log("Redis client error: ", err));
client.connect();
//#endregion