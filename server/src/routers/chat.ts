import { Request, Response } from "express";
import { Database } from "../modules/database/database";
import { Chat } from "../modules/database/databaseTypes";
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
          error: "Missing chatid in query.",
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
};
