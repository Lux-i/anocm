import { Request, Response } from "express";
import { Database } from "../modules/database/database";
import { Chat } from "@anocm/shared/types/database";
import { DatabaseResponse } from "@anocm/shared/types/database";

const express = require("express");
const router = express.Router();

import { UUID } from "crypto";



export default (database: Database) => {
  router.post("/newchat", async (req: Request, res: Response) => {
    console.log("POST Request: new Chat");
    try {
      database.createChat(req.body).then((chatId: UUID | false) => {
        if (chatId != false) {
          const response: DatabaseResponse = {
            success: true,
            id: chatId.toString(),
          };
          res.send(response);
        } else {
          const response: DatabaseResponse = {
            success: false,
            error: `Error creating Chat`,
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

      database.getChat(chatId!).then((chat: Chat | false) => {
        const response: DatabaseResponse = {
          success: true,
          userData: chat,
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

  router.post("/adduser", async (req: Request, res: Response) => {
    console.log("POST Request: add User to Chat");
    try {
      database.addUsertoChat(req.body.chatId, req.body.userId).then((response: boolean) => {
        if (response == true) {
          const response: DatabaseResponse = {
            success: true,
          };
          res.send(response);
        } else {
          const response: DatabaseResponse = {
            success: false,
            error: `Error adding User`,
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
      console.error("Error adding User: ", err);
    }
  });

  return router;
};