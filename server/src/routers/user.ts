import { Request, Response } from "express";
import { Database } from "../modules/database/database";
import { DatabaseTypes } from "@anocm/shared/dist";

const express = require("express");
const router = express.Router();

export default (database: Database) => {
  router.post("/newano", async (req: Request, res: Response) => {
    console.log("POST Request: new anonymous User");
    try {
      database.createAnoUser().then((clientId: string) => {
        const response: DatabaseTypes.DatabaseResponse = {
          success: true,
          id: clientId.toString(),
        };
        res.send(response);
      });
    } catch (err: any) {
      const response: DatabaseTypes.DatabaseResponse = {
        success: false,
        error: err,
      };
      res.send(response);
      console.error("Error sending response: ", err);
    }
  });

  router.post("/newuser", async (req: Request, res: Response) => {
    console.log("POST Request: new User");
    try {
      database
        .createUser(req.body.username, req.body.password)
        .then((userId: string | false) => {
          if (userId == false) {
            const response: DatabaseTypes.DatabaseResponse = {
              success: false,
              error: "Error creating User",
            };
            res.send(response);
          } else {
            const response: DatabaseTypes.DatabaseResponse = {
              success: true,
              id: userId.toString(),
              userData: req.body.username,
            };
            res.send(response);
          }
        });
    } catch (err: any) {
      const response: DatabaseTypes.DatabaseResponse = {
        success: false,
        error: err,
      };
      res.send(response);
      console.error("Error sending response: ", err);
    }
  });
  return router;
};
