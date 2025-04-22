import { Request, Response } from "express";
import { Database } from "../modules/database/database";
const express = require("express");
const router = express.Router();

import { UUID } from "crypto";

interface DatabaseResponse {
  success: boolean;
  error?: string;
  id?: string;
  userData?: any;
}

export default (database: Database) => {
  router.post("/database/newano", async (req: Request, res: Response) => {
    console.log("POST Request: new anonymous User");
    try {
      database.createAnoUser().then((clientId: string) => {
        const response: DatabaseResponse = {
          success: true,
          id: clientId.toString(),
        };
        res.send(response);
      });
    } catch (err: any) {
      const response: DatabaseResponse = {
        success: false,
        error: err,
      };
      res.send(response);
      console.error("Error sending response: ", err);
    }
  });

  router.post("/database/newuser", async (req: Request, res: Response) => {
    console.log("POST Request: new User");
    try {
      database
        .createUser(req.body.username, req.body.password)
        .then((userId: number | false) => {
          if (userId == false) {
            const response: DatabaseResponse = {
              success: false,
              error: "User already exists",
            };
            res.send(response);
          } else {
            const response: DatabaseResponse = {
              success: true,
              id: userId.toString(),
              userData: req.body.username,
            };
            res.send(response);
          }
        });
    } catch (err: any) {
      const response: DatabaseResponse = {
        success: false,
        error: err,
      };
      res.send(response);
      console.error("Error sending response: ", err);
    }
  });
};
