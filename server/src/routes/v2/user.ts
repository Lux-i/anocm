import { Request, Response } from "express";
import { Database } from "../../modules/database/database";
import { DatabaseResponse, Chat } from "@anocm/shared/dist";
import { UUID } from "crypto";

const express = require("express");
const router = express.Router();

export default () => {
  router.post("/newano", async (req: Request, res: Response) => {
    console.log("POST Request: new anonymous User");
    try {
      Database.createAnoUser().then((clientId: UUID) => {
        const response: DatabaseResponse = {
          success: true,
          id: clientId,
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
        (userId: UUID | false) => {
          if (userId == false) {
            const response: DatabaseResponse = {
              success: false,
              error: "Error creating User",
            };
            res.send(response);
          } else {
            const response: DatabaseResponse = {
              success: true,
              id: userId,
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

  router.post("/login", async (req: Request, res: Response) => {
    console.log("POST Request: new Login");
    try {
      Database.loginUser(req.body.userId_username, req.body.password).then(
        (token: string[] | false) => {
          if (token == false) {
            const response: DatabaseResponse = {
              success: false,
              error: "Error logging in",
            };
            res.send(response);
          } else {
            if (token.length == 1) {
              const response: DatabaseResponse = {
                success: true,
                id: req.body.userId_username,
                userData: token[0],
              };
              res.send(response);
            } else {
              const response: DatabaseResponse = {
                success: true,
                id: token[0] as UUID,
                userData: token[1],
              };
              res.send(response);
            }
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

  router.get("getUsers", async (req: Request, res: Response) => {
    try {
      Database.getAllNonAnoUsers().then((users) => {
        const response: DatabaseResponse = {
          success: true,
          userData: users,
        };
        res.send(response);
      });
    } catch (err: any) {
      const response: DatabaseResponse = {
        success: false,
        error: err,
      };
      res.send(response);
    }
  });

    router.get("getUsername", async (req: Request, res: Response) => {
    try {
      const [searchUserId, userId, token] = req.body as string;
      Database.getUsername(searchUserId, userId, token).then((username) => {
        if(username != false){
          const response: DatabaseResponse = {
            success: true,
            userData: username,
          };
          res.send(response);
        }else{
          const response: DatabaseResponse = {
            success: false,
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
    }
  });

  return router;
};
