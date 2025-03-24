const express = require("express");
const app = express();
const server = require("http").createServer(app);

const { Port } = require("./config.json");
const { request } = require("http");
const portArg = process.argv[2];

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

server.listen(portArg || Port, () => {
  console.log(
    `Started webserver. Listening on port ${portArg || Port || 8080}`
  );
});
