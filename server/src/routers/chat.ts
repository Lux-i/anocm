import { Request, Response } from "express";
import { Database } from "../modules/database/database";
import { DatabaseTypes } from "@anocm/shared/dist";

const express = require("express");
const router = express.Router();

import { UUID } from "crypto";

export default () => {
  router.post("/newchat", async (req: Request, res: Response) => {
    console.log("POST Request: new Chat");
    try {
      Database.createChat(req.body).then((chatId: UUID | false) => {
        if (chatId != false) {
          const response: DatabaseTypes.DatabaseResponse = {
            success: true,
            id: chatId.toString(),
          };
          res.send(response);
        } else {
          const response: DatabaseTypes.DatabaseResponse = {
            success: false,
            error: `Error creating Chat`,
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
      console.error("Error creating new Chat: ", err);
    }
  });

  router.get("/getchat", async (req: Request, res: Response) => {
    try {
      const chatId = req.query.chatid as string;

      if (!chatId) {
        return res.status(400).json({
          success: false,
          error: "Missing ChatId in query.",
        });
      }

      Database.getChat(chatId!).then((chat: DatabaseTypes.Chat | false) => {
        const response: DatabaseTypes.DatabaseResponse = {
          success: true,
          userData: chat,
        };
        res.send(response);
      });
    } catch (err: any) {
      const response: DatabaseTypes.DatabaseResponse = {
        success: false,
        error: err,
      };
      res.send(response);
    }
  });

  router.post("/adduser", async (req: Request, res: Response) => {
    console.log("POST Request: add User to Chat");
    try {
      Database.addUsertoChat(req.body.chatId, req.body.userId).then(
        (response: boolean) => {
          if (response == true) {
            const response: DatabaseTypes.DatabaseResponse = {
              success: true,
            };
            res.send(response);
          } else {
            const response: DatabaseTypes.DatabaseResponse = {
              success: false,
              error: `Error adding User`,
            };
            res.send(response);
          }
        }
      );
    } catch (err: any) {
      const response: DatabaseTypes.DatabaseResponse = {
        success: false,
        error: err,
      };
      res.send(response);
      console.error("Error adding User: ", err);
    }
  });

  return router;
};
