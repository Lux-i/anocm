import { Request, Response } from "express";
import { Database } from "../../modules/database/database";
import { DatabaseResponse } from "@anocm/shared/dist";
import { UUID } from "crypto";

const express = require("express");
const router = express.Router();

export default () => {
  router.post("/newano", async (req: Request, res: Response) => {
    console.log("POST Request: new anonymous User");
    try {
      Database.createAnoUser().then((clientId: string) => {
        const response: DatabaseResponse = {
          success: true,
          id: clientId as UUID,
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

  router.post("/newuser", async (req: Request, res: Response) => {
    console.log("POST Request: new User");
    try {
      Database.createUser(req.body.username, req.body.password).then(
        (userId: string | false) => {
          if (userId == false) {
            const response: DatabaseResponse = {
              success: false,
              error: "Error creating User",
            };
            res.send(response);
          } else {
            const response: DatabaseResponse = {
              success: true,
              id: userId as UUID,
              userData: req.body.username,
            };
            res.send(response);
          }
        }
      );
    } catch (err: any) {
      const response: DatabaseResponse = {
        success: false,
        error: err,
      };
      res.send(response);
      console.error("Error sending response: ", err);
    }
  });
  return router;
};
